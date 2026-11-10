#!/usr/bin/env python3
"""Question-roster authority through real Auth/PostgREST on full local Supabase.

Uses the existing local-only transport, never application/hosted credentials.
This is assessment coverage, not LMS quiz coverage.
Start attacks exercise both a fresh member and a member with saved answers and
completed history; whole-row snapshots detect inserts, updates and deletions.
Valid controls include every question of a disposable two-question domain.
"""
import importlib.util
import json
from pathlib import Path
import secrets
import unittest
import uuid


spec = importlib.util.spec_from_file_location(
    "draft_http", Path(__file__).with_name("test-assessment-draft-conflicts-http.py")
)
transport = importlib.util.module_from_spec(spec)
spec.loader.exec_module(transport)
LocalSupabase, literal, ROOT = transport.LocalSupabase, transport.literal, transport.ROOT


class QuestionAuthorityHTTP(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = LocalSupabase()
        versions = sorted({p.name.split("_")[0] for p in
                           (ROOT / "supabase/migrations").glob("*.sql")})
        if not versions:
            raise AssertionError("No repository migrations found")
        if cls.db.sql("""
            SELECT count(*) FROM unnest(ARRAY[%s]) expected(version)
            WHERE NOT EXISTS (
              SELECT 1 FROM supabase_migrations.schema_migrations applied
              WHERE applied.version = expected.version);
        """ % ",".join(map(literal, versions))) != "0":
            raise AssertionError("Full Supabase suite requires EVERY repository migration")
        if cls.db.sql("""
            SELECT
              (SELECT relrowsecurity FROM pg_class WHERE oid='public.pre_tests'::regclass)
              AND NOT has_column_privilege('authenticated', 'public.pre_tests',
                                           'authorized_question_ids', 'UPDATE')
              AND NOT has_table_privilege('authenticated', 'public.pre_tests', 'INSERT')
              AND has_function_privilege('authenticated',
                    'public.submit_assessment(uuid,jsonb)', 'EXECUTE')
              AND NOT has_function_privilege('authenticated',
                    'public.submit_assessment_scoring(uuid,jsonb)', 'EXECUTE')
              AND NOT has_function_privilege('authenticated',
                    'public.submit_assessment_scoring_unchecked(uuid,jsonb)', 'EXECUTE');
        """) != "t":
            raise AssertionError("Question authority RLS/grants are not active")

        cls.users = []
        cls.domain = str(uuid.uuid4())
        cls.small_domain = str(uuid.uuid4())
        cls.questions = [str(uuid.uuid4()) for _ in range(5)]
        cls.small_questions = [str(uuid.uuid4()) for _ in range(2)]
        cls.addClassCleanup(cls.cleanup)
        cls.owner, cls.owner_token = cls.create_user("owner")
        cls.stranger, cls.stranger_token = cls.create_user("stranger")
        cls.newcomer, cls.newcomer_token = cls.create_user("newcomer")
        cls.db.sql(f"""
            INSERT INTO public.competency_domains(id,name)
              VALUES ({literal(cls.domain)}, 'Disposable roster authority test'),
                     ({literal(cls.small_domain)}, 'Disposable two-question domain');
            INSERT INTO public.questions(id,domain_id,question_text,options,correct_answer)
              VALUES {','.join(
                  f"({literal(q)}, {literal(domain)}, 'Roster authority fixture', "
                  "'[\"A\",\"B\"]'::jsonb, 1)"
                  for domain, questions in ((cls.domain, cls.questions),
                                            (cls.small_domain, cls.small_questions))
                  for q in questions)};
        """)
        # Preserve seeded questions and meet four-per-domain quotas everywhere.
        seeded = json.loads(cls.db.sql(f"""
            SELECT COALESCE(jsonb_agg(jsonb_build_object('id',id,'options',options,
                     'question_text',question_text) ORDER BY domain_id,id), '[]'::jsonb)
            FROM (SELECT q.*, row_number() OVER (PARTITION BY domain_id ORDER BY id) rn
                  FROM public.questions q WHERE domain_id NOT IN
                    ({literal(cls.domain)}, {literal(cls.small_domain)})) ranked
            WHERE rn <= 4;
        """))
        own = [{"id": q, "options": ["A", "B"], "question_text": "Roster authority fixture"}
               for q in cls.questions]
        small = [{"id": q, "options": ["A", "B"], "question_text": "Roster authority fixture"}
                 for q in cls.small_questions]
        cls.seeded_roster, cls.own_roster, cls.small_roster = seeded, own, small
        cls.roster = seeded + own[:4] + small
        cls.foreign_roster = seeded + own[:3] + own[4:] + small
        if not seeded or not 6 <= len(cls.roster) <= 99:
            raise AssertionError("Fixture requires seeded domains and room for one extra question")

        # Nonempty historical answers/profile detect destructive writes too.
        historical, _ = cls.start(cls.owner_token, cls.roster)
        status, result = cls.db.rpc("submit_assessment", cls.owner_token, {
            "_pre_test_id": historical, "_answers": cls.answers(cls.roster),
        })
        if status != 200 or result != {
            "score": 0, "level": "Pemula", "correct": 0, "total": len(cls.roster)
        }:
            raise AssertionError("Real scorer positive control failed")
        if cls.db.sql(f"""
            SELECT count(*) FROM public.profiles
            WHERE user_id={literal(cls.owner)} AND total_score=0 AND current_level='Pemula';
        """) != "1":
            raise AssertionError("Real Auth profile trigger/scorer did not create baseline")
        cls.foreign_test, _ = cls.start(cls.stranger_token, cls.foreign_roster)

    @classmethod
    def create_user(cls, label):
        email = f"roster-{label}-{uuid.uuid4().hex}@example.invalid"
        password = secrets.token_hex(24)
        status, user = cls.db.request("/auth/v1/admin/users", privileged=True, payload={
            "email": email, "password": password, "email_confirm": True,
        })
        if status != 200 or not user.get("id"):
            raise AssertionError(f"Local Auth could not create {label}: HTTP {status}")
        user_id = str(uuid.UUID(user["id"]))
        cls.users.append(user_id)
        status, session = cls.db.request("/auth/v1/token?grant_type=password", payload={
            "email": email, "password": password,
        })
        if status != 200 or session.get("user", {}).get("id") != user_id:
            raise AssertionError(f"Local Auth password login failed: HTTP {status}")
        return user_id, session["access_token"]

    @classmethod
    def cleanup(cls):
        failures = []
        for user in cls.users:
            status, _ = cls.db.request(f"/auth/v1/admin/users/{user}",
                                      privileged=True, method="DELETE")
            if status != 200:
                failures.append(user)
        cls.db.sql("DELETE FROM public.competency_domains WHERE id IN "
                   f"({literal(cls.domain)}, {literal(cls.small_domain)});")
        if failures:
            raise AssertionError("Could not remove disposable Auth fixtures")

    @staticmethod
    def answers(roster):
        return [{"question_id": q["id"], "selected_answer": -1} for q in roster]

    @classmethod
    def start_payload(cls, roster):
        return {"_draft": {
            "version": 1, "preTestId": "pending", "questions": roster,
            "answers": {}, "answerResults": {}, "phase": "test",
            "currentQ": 0, "timeLeft": 180, "timedOut": False,
        }}

    @classmethod
    def start(cls, token, roster):
        status, result = cls.db.rpc("start_assessment_draft", token, cls.start_payload(roster))
        if status != 200 or not isinstance(result, dict) or not result.get("preTestId"):
            raise AssertionError(f"Real start RPC failed: HTTP {status}")
        test_id = str(uuid.UUID(result["preTestId"]))
        status, active = cls.db.rpc("get_active_assessment_draft", token)
        if status != 200 or not active or active["draft"]["preTestId"] != test_id:
            raise AssertionError("Started assessment is not the active server draft")
        return test_id, active["draft"]

    def setUp(self):
        self.pre_test, draft = self.start(self.owner_token, self.roster)
        # Save one known correct answer through the versioned public RPC.
        status, saved = self.db.rpc("save_assessment_draft", self.owner_token, {
            "_pre_test_id": self.pre_test,
            "_draft": {**draft, "answers": {self.questions[0]: 1}},
        })
        self.assertEqual(status, 200)
        self.assertIs(saved["saved"], True)
        self.draft = saved["draft"]
        self.valid = self.answers(self.roster)
        # Prove PostgREST schema cache, user identity, row visibility and frozen IDs
        # work before accepting any denial as evidence.
        status, rows = self.db.request(
            f"/rest/v1/pre_tests?id=eq.{self.pre_test}&select=id,authorized_question_ids",
            self.owner_token, method="GET",
        )
        self.assertEqual((status, rows), (200, [{
            "id": self.pre_test, "authorized_question_ids": [q["id"] for q in self.roster],
        }]))

    def snapshot(self):
        # Privileged, deterministic whole-row comparisons include hidden rows,
        # timestamps, new result rows, drafts and both users' historical answers.
        users = ",".join(map(literal, self.users))
        return self.db.sql(f"""
            SELECT jsonb_build_object(
              'tests', (SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY id), '[]')
                        FROM public.pre_tests p WHERE user_id IN ({users})),
              'profiles', (SELECT jsonb_agg(to_jsonb(p) ORDER BY user_id)
                           FROM public.profiles p WHERE user_id IN ({users})),
              'answers', (SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.id), '[]')
                          FROM public.pre_test_answers a JOIN public.pre_tests p
                          ON p.id=a.pre_test_id WHERE p.user_id IN ({users})),
              'drafts', (SELECT COALESCE(jsonb_agg(to_jsonb(d) ORDER BY pre_test_id), '[]')
                         FROM public.assessment_drafts d JOIN public.pre_tests p
                         ON p.id=d.pre_test_id WHERE p.user_id IN ({users})));
        """)

    def submit(self, answers, token=None, test=None):
        return self.db.rpc("submit_assessment", token or self.owner_token, {
            "_pre_test_id": test or self.pre_test, "_answers": answers,
        })

    def assert_rpc_rejection(self, response, error, before):
        self.assertEqual(response, (200, {"error": error}))
        self.assertEqual(self.snapshot(), before, "Rejected request changed persistent state")

    def assert_permission_denied(self, response, message, before):
        status, body = response
        self.assertEqual(status, 403)
        self.assertEqual(body["code"], "42501")
        self.assertEqual(body["message"], message)
        # New PostgREST versions add a GRANT hint to table denials. The hint
        # is diagnostic wording, not part of the permission boundary.
        self.assertEqual(self.snapshot(), before, "Denied request changed persistent state")

    def assert_start_rejected(self, response, before):
        # A missing RPC, expired token, or generic draft validation failure is
        # not evidence that the question-authority migration rejected the roster.
        self.assertEqual(response, (400, {
            "code": "P0001", "details": None, "hint": None,
            "message": "Invalid assessment questions",
        }))
        self.assertEqual(self.snapshot(), before, "Rejected start changed persistent state")

    def test_start_rejects_favorable_or_incomplete_rosters_atomically(self):
        seeded, own, small = self.seeded_roster, self.own_roster, self.small_roster
        unknown = {**own[0], "id": str(uuid.uuid4())}
        cases = (
            ("single known-correct question", own[:1]),
            ("only known-correct fixture domains", own[:4] + small),
            ("too many in large domain", seeded + own + small),
            ("too few in large domain", seeded + own[:3] + small),
            ("large domain omitted", seeded + small),
            ("small domain omitted", seeded + own[:4]),
            ("too few in small domain", seeded + own[:4] + small[:1]),
            # Same total as a valid roster: total-count validation alone fails.
            ("balanced wrong domain quotas", seeded + own + small[:1]),
            ("unknown UUID", seeded + own[:3] + [unknown] + small),
            ("malformed ID", seeded + own[:3] + [{**unknown, "id": "not-a-uuid"}] + small),
            ("duplicate replacing question", seeded + own[:3] + own[:1] + small),
            ("extra duplicate", self.roster + own[:1]),
        )
        self.assertEqual(self.db.sql(
            "SELECT count(*) FROM public.pre_tests "
            f"WHERE user_id={literal(self.newcomer)};"), "0")
        # Auth itself creates a profile. It must remain unchanged, not disappear.
        self.assertEqual(self.db.sql(
            "SELECT count(*) FROM public.profiles "
            f"WHERE user_id={literal(self.newcomer)};"), "1")
        for token in (self.newcomer_token, self.owner_token):
            for label, roster in cases:
                with self.subTest(attack=label, existing_history=token == self.owner_token):
                    payload = self.start_payload(roster)
                    # These fixtures really have key 1, so accepting the subset
                    # would allow the member to manufacture a favorable score.
                    payload["_draft"]["answers"] = {
                        q["id"]: 1 for q in roster
                        if q["id"] in self.questions + self.small_questions
                    }
                    before = self.snapshot()
                    self.assert_start_rejected(self.db.rpc(
                        "start_assessment_draft", token, payload), before)
        # Same real Auth token must also succeed; auth/transport outages must
        # never turn every denial above into a false positive.
        self.assert_small_domain_start(self.newcomer_token, self.newcomer)

    def assert_small_domain_start(self, token, user):
        roster = list(reversed(self.roster))
        test_id, draft = self.start(token, roster)
        ids = [q["id"] for q in roster]
        self.assertEqual([q["id"] for q in draft["questions"]], ids)
        self.assertEqual(json.loads(self.db.sql(f"""
            SELECT jsonb_build_object(
              'owner', user_id, 'status', status, 'total', total_questions,
              'ids', authorized_question_ids,
              'small_count', (SELECT count(*) FROM public.questions q
                WHERE q.domain_id={literal(self.small_domain)}
                  AND q.id=ANY(p.authorized_question_ids)),
              'drafts', (SELECT count(*) FROM public.assessment_drafts d
                        WHERE d.pre_test_id=p.id))
            FROM public.pre_tests p WHERE id={literal(test_id)};
        """)), {
            "owner": user, "status": "in_progress", "total": len(roster),
            "ids": ids, "small_count": 2, "drafts": 1,
        })
        return test_id

    def test_start_accepts_complete_roster_with_less_than_four_in_domain(self):
        self.assert_small_domain_start(self.owner_token, self.owner)

    def test_postgrest_cannot_replace_frozen_roster(self):
        for token in (self.owner_token, self.stranger_token):
            for payload in (
                {"authorized_question_ids": [self.questions[0]]},
                {"authorized_question_ids": [q["id"] for q in self.foreign_roster],
                 "total_questions": len(self.foreign_roster)},
                {"authorized_question_ids": None},
            ):
                with self.subTest(payload=payload, owner=token == self.owner_token):
                    before = self.snapshot()
                    self.assert_permission_denied(self.db.request(
                        f"/rest/v1/pre_tests?id=eq.{self.pre_test}", token, payload, "PATCH",
                    ), "permission denied for table pre_tests", before)
        before = self.snapshot()
        self.assert_permission_denied(self.db.request(
            "/rest/v1/pre_tests", self.owner_token, {
                "user_id": self.owner, "total_questions": 1, "status": "in_progress",
                "authorized_question_ids": [self.questions[0]],
            },
        ), "permission denied for table pre_tests", before)

    def test_private_scorers_cannot_be_called_even_with_valid_answers(self):
        for name in ("submit_assessment_scoring", "submit_assessment_scoring_unchecked"):
            for payload in (self.valid, self.valid + [self.valid[0]]):
                with self.subTest(scorer=name, valid=payload == self.valid):
                    before = self.snapshot()
                    self.assert_permission_denied(self.db.rpc(name, self.owner_token, {
                        "_pre_test_id": self.pre_test, "_answers": payload,
                    }), f"permission denied for function {name}", before)

    def assert_forged_answers_rejected(self):
        foreign = {"question_id": self.questions[4], "selected_answer": 1}
        for label, answers in (
            ("extra bank question", self.valid + [foreign]),
            ("extra duplicate", self.valid + [self.valid[0]]),
            ("same-length duplicate", self.valid[:-1] + [self.valid[0]]),
            ("question authorized only in other assessment", self.valid[:-1] + [foreign]),
            ("missing question", self.valid[:-1]),
            ("unknown ID", self.valid[:-1] + [{
                "question_id": str(uuid.uuid4()), "selected_answer": 1}]),
            ("empty", []), ("not array", {}), ("null", None),
        ):
            with self.subTest(attack=label):
                before = self.snapshot()
                self.assert_rpc_rejection(self.submit(answers), "Invalid assessment questions",
                                          before)

    def assert_valid_completion(self):
        # Reverse order and deliberately wrong client choices: only server-saved
        # choices should count, and the complete frozen roster is the denominator.
        status, result = self.submit(list(reversed(self.valid)))
        total = len(self.roster)
        score = (100 + total // 2) // total
        self.assertEqual((status, result), (200, {
            "score": score, "level": "Pemula", "correct": 1, "total": total,
        }))
        persisted = json.loads(self.db.sql(f"""
            SELECT jsonb_build_object(
              'status', (SELECT status FROM public.pre_tests WHERE id={literal(self.pre_test)}),
              'score', (SELECT score FROM public.pre_tests WHERE id={literal(self.pre_test)}),
              'answers', (SELECT jsonb_object_agg(question_id, selected_answer)
                          FROM public.pre_test_answers WHERE pre_test_id={literal(self.pre_test)}),
              'profile', (SELECT jsonb_build_object('score',total_score,'level',current_level)
                          FROM public.profiles WHERE user_id={literal(self.owner)}));
        """))
        self.assertEqual(persisted, {
            "status": "completed", "score": score,
            "answers": {q["id"]: 1 if q["id"] == self.questions[0] else -1 for q in self.roster},
            "profile": {"score": score, "level": "Pemula"},
        })

    def test_forged_submissions_are_atomic_and_valid_submission_still_works(self):
        self.assert_forged_answers_rejected()
        self.assert_valid_completion()

    def test_expiry_does_not_bypass_authority(self):
        self.db.sql(f"UPDATE public.pre_tests SET deadline_at=clock_timestamp()-interval '1 second'"
                    f" WHERE id={literal(self.pre_test)};")
        self.assert_forged_answers_rejected()
        self.assert_valid_completion()

    def test_other_assessment_and_draft_are_not_authority(self):
        # Another assessment exists and really authorized the replacement question.
        self.assertEqual(json.loads(self.db.sql(
            "SELECT to_jsonb(authorized_question_ids) FROM public.pre_tests "
            f"WHERE id={literal(self.foreign_test)};")),
            [q["id"] for q in self.foreign_roster])
        before = self.snapshot()
        self.assert_rpc_rejection(self.submit(
            self.answers(self.foreign_roster), test=self.foreign_test),
            "Unauthorized", before)
        self.assert_rpc_rejection(self.submit(
            self.valid, token=self.stranger_token), "Unauthorized", before)
        status, body = self.db.rpc("save_assessment_draft", self.owner_token, {
            "_pre_test_id": self.pre_test,
            "_draft": {**self.draft, "questions": self.foreign_roster},
        })
        self.assertEqual((status, body), (400, {
            "code": "P0001", "details": None, "hint": None,
            "message": "Assessment questions changed",
        }))
        self.assertEqual(self.snapshot(), before)


if __name__ == "__main__":
    unittest.main(verbosity=2)
