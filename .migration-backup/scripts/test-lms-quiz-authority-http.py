#!/usr/bin/env python3
"""Quiz authority over real Auth/PostgREST; fully migrated local Supabase only."""
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
PREFIX = "aspekindo_lms_"


class QuizAuthorityHTTP(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = LocalSupabase()  # Validates local-only URLs before any I/O.
        versions = sorted({p.name.split("_")[0] for p in
                           (ROOT / "supabase/migrations").glob("*.sql")})
        if not versions or cls.db.sql("""
            SELECT count(*) FROM unnest(ARRAY[%s]) expected(version)
            WHERE NOT EXISTS (
              SELECT 1 FROM supabase_migrations.schema_migrations applied
              WHERE applied.version = expected.version);
        """ % ",".join(map(literal, versions))) != "0":
            raise AssertionError("Full quiz HTTP suite requires EVERY repository migration")
        cls.users = []
        cls.course = str(uuid.uuid4())
        cls.lesson = str(uuid.uuid4())
        cls.enrollment = str(uuid.uuid4())
        cls.questions = [str(uuid.uuid4()), str(uuid.uuid4())]
        cls.addClassCleanup(cls.cleanup)
        cls.owner, cls.owner_token = cls.create_user("owner")
        cls.stranger, cls.stranger_token = cls.create_user("stranger")
        if cls.owner == cls.stranger or cls.owner_token == cls.stranger_token:
            raise AssertionError("Requires distinct real Auth identities")
        # Publish only after the complete bank is valid, as in the real editor.
        cls.db.sql(f"""
            INSERT INTO public.{PREFIX}courses(id,slug,title,status,member_only)
              VALUES ({literal(cls.course)}, {literal('quiz-http-' + cls.course)},
                      'Disposable quiz HTTP authority', 'draft', false);
            INSERT INTO public.{PREFIX}lessons(id,course_id,title,slug,passing_score,is_published)
              VALUES ({literal(cls.lesson)}, {literal(cls.course)}, 'HTTP quiz',
                      'http-quiz', 70, false);
            INSERT INTO public.{PREFIX}quiz_questions
              (id,lesson_id,question_text,options,sort_order,points) VALUES
              ({literal(cls.questions[0])}, {literal(cls.lesson)}, 'Low weight?',
               '["wrong","right"]', 0, 3),
              ({literal(cls.questions[1])}, {literal(cls.lesson)}, 'High weight?',
               '["right","wrong"]', 1, 7);
            INSERT INTO public.{PREFIX}quiz_answer_keys
              (question_id,correct_option,explanation_markdown) VALUES
              ({literal(cls.questions[0])}, 1, 'PRIVATE-KEY-EXPLANATION'),
              ({literal(cls.questions[1])}, 0, 'PRIVATE-KEY-EXPLANATION');
            UPDATE public.{PREFIX}lessons SET is_published=true WHERE id={literal(cls.lesson)};
            UPDATE public.{PREFIX}courses SET status='published' WHERE id={literal(cls.course)};
            INSERT INTO public.{PREFIX}enrollments(id,course_id,user_id)
              VALUES ({literal(cls.enrollment)}, {literal(cls.course)}, {literal(cls.owner)});
        """)

    @classmethod
    def create_user(cls, label):
        email = f"quiz-http-{label}-{uuid.uuid4().hex}@example.invalid"
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
        if (status != 200 or session.get("user", {}).get("id") != user_id
                or not isinstance(session.get("access_token"), str)
                or not session["access_token"]):
            raise AssertionError(f"Local Auth password login failed for {label}: HTTP {status}")
        return user_id, session["access_token"]

    @classmethod
    def cleanup(cls):
        # Delete only this run's fixtures; never disable RLS, grants or triggers.
        cls.db.sql(f"DELETE FROM public.{PREFIX}courses WHERE id={literal(cls.course)};")
        failures = []
        for user in cls.users:
            status, _ = cls.db.request(f"/auth/v1/admin/users/{user}",
                                       method="DELETE", privileged=True)
            if status not in (200, 204):
                failures.append(status)
        if failures:
            raise AssertionError(f"Local Auth fixture cleanup failed: HTTP {failures}")

    def state(self):
        """Privileged complete snapshots detect writes hidden by caller RLS."""
        tables = {
            "attempts": ("quiz_attempts", "lesson_id", self.lesson),
            "answers": ("quiz_answers", "lesson_id", self.lesson),
            "progress": ("lesson_progress", "lesson_id", self.lesson),
            "enrollments": ("enrollments", "course_id", self.course),
            "keys": ("quiz_answer_keys", "question_id", None),
        }
        result = {}
        for name, (table, column, value) in tables.items():
            where = (f"{column}={literal(value)}" if value else
                     f"{column} IN ({','.join(map(literal, self.questions))})")
            result[name] = json.loads(self.db.sql(f"""
                SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text), '[]')
                FROM public.{PREFIX}{table} t WHERE {where};
            """))
        return result

    def assert_private(self, response):
        serialized = json.dumps(response)
        for field in ("correct_option", "explanation_markdown", "PRIVATE-KEY-EXPLANATION"):
            self.assertNotIn(field, serialized)

    def rpc_error(self, name, token, payload, message):
        before = self.state()
        status, body = self.db.rpc(name, token, payload)
        self.assertEqual(status, 400)
        self.assertEqual(body.get("code"), "P0001")
        self.assertEqual(body.get("message"), message)
        self.assert_private(body)
        self.assertEqual(self.state(), before, "Rejected RPC changed persistent data")

    def table(self, name, token, method="GET", payload=None, query=""):
        return self.db.request(f"/rest/v1/{PREFIX}{name}{query}", token,
                               payload=payload, method=method)

    def assert_write_denied(self, name, token, method, payload=None, query=""):
        before = self.state()
        status, body = self.table(name, token, method, payload, query)
        if method == "POST":
            self.assertIn(status, (401, 403))
            self.assertEqual(body.get("code"), "42501")
        elif status in (200, 204):
            # PostgREST may accept an UPDATE/DELETE but RLS must affect zero rows.
            self.assertEqual(body, [] if status == 200 else None)
        else:
            self.assertIn(status, (401, 403))
            self.assertEqual(body.get("code"), "42501")
        self.assert_private(body)
        self.assertEqual(self.state(), before, "Direct table write changed protected data")

    def submit(self, choices, score, passed, correct, number):
        status, result = self.db.rpc("submit_aspekindo_lms_quiz", self.owner_token, {
            "_lesson_id": self.lesson, "_answers": dict(zip(self.questions, choices)),
        })
        self.assertEqual(status, 200)
        self.assert_private(result)
        for key, expected in {
            "user_id": self.owner, "enrollment_id": self.enrollment,
            "course_id": self.course, "lesson_id": self.lesson,
            "score": score, "passed": passed, "correct_answers": correct,
            "total_questions": 2, "attempt_number": number,
        }.items():
            self.assertEqual(result[key], expected, key)
        state = self.state()
        self.assertIn(result, state["attempts"], "HTTP score differs from persisted result")
        answers = [a for a in state["answers"] if a["attempt_id"] == result["id"]]
        self.assertEqual(len(answers), 2)
        for q, choice, key in zip(self.questions, choices, (1, 0)):
            answer = next(a for a in answers if a["question_id"] == q)
            self.assertEqual(answer["selected_option"], choice)
            self.assertEqual(answer["is_correct"], choice == key)
        return result

    def test_quiz_authority(self):
        """One ordered journey: attacks before grading, failing then passing."""
        lesson = {"_lesson_id": self.lesson}
        wrong = dict(zip(self.questions, (0, 1)))
        for token in (self.stranger_token, None):
            for rpc, payload in (
                ("submit_aspekindo_lms_quiz", {**lesson, "_answers": wrong}),
                ("complete_aspekindo_lms_lesson", lesson),
            ):
                with self.subTest(caller="stranger" if token else "anonymous", rpc=rpc):
                    if token:
                        message = ("Enrollment tidak ditemukan" if rpc.startswith("submit")
                                   else "Enrollment aktif tidak ditemukan")
                        self.rpc_error(rpc, token, payload, message)
                    else:
                        before = self.state()
                        status, body = self.db.rpc(rpc, None, payload)
                        self.assertIn(status, (401, 403, 404))
                        self.assertIn(body.get("code"), ("42501", "PGRST202"))
                        self.assert_private(body)
                        self.assertNotIn("score", body)
                        self.assertEqual(self.state(), before)

        self.rpc_error("submit_aspekindo_lms_quiz", self.owner_token,
                       {**lesson, "_answers": {**wrong, "score": 100}},
                       "Jumlah jawaban kuis harus sama dengan jumlah soal")
        # Same answer count, fabricated choice: catch validation after attempt INSERT
        # and ensure that a partially written attempt/answer is rolled back.
        malformed = {q: "not-an-integer" for q in self.questions}
        self.rpc_error("submit_aspekindo_lms_quiz", self.owner_token,
                       {**lesson, "_answers": malformed}, "Format jawaban kuis tidak valid")
        # Only the low-weight answer is correct: 1/2 answers is NOT a score of 50.
        failed = self.submit((1, 1), 30, False, 1, 1)
        self.rpc_error("complete_aspekindo_lms_lesson", self.owner_token, lesson,
                       "Kuis pelajaran harus lulus sebelum diselesaikan")
        self.assertEqual(self.state()["progress"], [])
        status, started = self.table("lesson_progress", self.owner_token, "POST", {
            "enrollment_id": self.enrollment, "course_id": self.course,
            "lesson_id": self.lesson, "user_id": self.owner,
            "status": "in_progress", "progress_percent": 10,
        })
        self.assertEqual(status, 201)
        self.assertEqual(len(started), 1)
        self.assertEqual(self.state()["progress"], started)

        for token in (self.owner_token, self.stranger_token, None):
            with self.subTest(caller="owner" if token == self.owner_token else
                              "stranger" if token else "anonymous"):
                # Positive read controls avoid mistaking a broken gateway for RLS.
                for table in ("quiz_attempts", "quiz_answers"):
                    status, rows = self.table(table, token,
                                             query=f"?lesson_id=eq.{self.lesson}&select=*")
                    self.assertEqual(status, 200)
                    self.assert_private(rows)
                    if token == self.owner_token:
                        self.assertEqual(len(rows), 1 if table == "quiz_attempts" else 2)
                        if table == "quiz_attempts":
                            self.assertEqual(rows, [failed])
                    else:
                        self.assertEqual(rows, [])
                status, keys = self.table("quiz_answer_keys", token,
                                          query="?question_id=in.(" +
                                          ",".join(self.questions) + ")&select=*")
                self.assertEqual((status, keys), (200, []))
                status, questions = self.table(
                    "quiz_questions", token, query=f"?lesson_id=eq.{self.lesson}&select=*")
                self.assertEqual(status, 200)
                self.assert_private(questions)
                self.assertEqual(len(questions), 2 if token == self.owner_token else 0)
                # Embedded reads must not bypass key RLS either.
                status, embedded = self.table(
                    "quiz_questions", token,
                    query=f"?lesson_id=eq.{self.lesson}&select=id,aspekindo_lms_quiz_answer_keys(*)")
                self.assertEqual(status, 200)
                self.assert_private(embedded)
                if token == self.owner_token:
                    self.assertEqual(len(embedded), 2)
                    for row in embedded:
                        self.assertIn(row["aspekindo_lms_quiz_answer_keys"], (None, []))
                else:
                    self.assertEqual(embedded, [])

                forged = {
                    "enrollment_id": self.enrollment, "course_id": self.course,
                    "lesson_id": self.lesson, "user_id": self.owner,
                    "attempt_number": 99, "score": 100, "passed": True,
                    "total_questions": 2, "correct_answers": 2,
                }
                self.assert_write_denied("quiz_attempts", token, "POST", forged)
                self.assert_write_denied("quiz_attempts", token, "PATCH",
                                         {"score": 100, "passed": True},
                                         f"?id=eq.{failed['id']}")
                self.assert_write_denied("quiz_answers", token, "PATCH",
                                         {"is_correct": True, "selected_option": 0},
                                         f"?attempt_id=eq.{failed['id']}")
                self.assert_write_denied("quiz_answers", token, "POST", {
                    "attempt_id": failed["id"], "lesson_id": self.lesson,
                    # Existing answer must not reach uniqueness validation; RLS denies first.
                    "question_id": self.questions[0], "selected_option": 1, "is_correct": True,
                })
                self.assert_write_denied("quiz_attempts", token, "DELETE",
                                         query=f"?id=eq.{failed['id']}")
                self.assert_write_denied("quiz_answers", token, "DELETE",
                                         query=f"?attempt_id=eq.{failed['id']}")
                self.assert_write_denied("lesson_progress", token, "POST", {
                    "enrollment_id": self.enrollment, "course_id": self.course,
                    "lesson_id": self.lesson, "user_id": self.owner,
                    "status": "completed", "progress_percent": 100,
                })
                self.assert_write_denied("lesson_progress", token, "PATCH", {
                    "status": "completed", "progress_percent": 100,
                }, f"?id=eq.{started[0]['id']}")

        # Correct choices at the exact weighted pass mark unlock completion.
        self.submit((0, 0), 70, True, 1, 2)
        status, progress = self.db.rpc("complete_aspekindo_lms_lesson", self.owner_token, lesson)
        self.assertEqual(status, 200)
        self.assertEqual(progress["status"], "completed")
        self.assertEqual(progress["progress_percent"], 100)
        self.assertEqual(progress["user_id"], self.owner)
        self.assertEqual(progress["enrollment_id"], self.enrollment)
        self.assertEqual(progress["lesson_id"], self.lesson)
        self.assertIsNotNone(progress["completed_at"])
        self.assertEqual(self.state()["progress"], [progress])
        # Reading another user's now-completed progress must still return nothing.
        for token in (self.stranger_token, None):
            status, rows = self.table("lesson_progress", token,
                                     query=f"?lesson_id=eq.{self.lesson}&select=*")
            self.assertEqual((status, rows), (200, []))


if __name__ == "__main__":
    unittest.main()
