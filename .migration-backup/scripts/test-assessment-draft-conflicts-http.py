#!/usr/bin/env python3
"""Real Auth/PostgREST draft conflict checks; disposable local Supabase only.

No SDK, hosted credentials, SQL schema substitutes, or mocked API responses.
Run after prepare-supabase-test-project.py and `supabase start`; see tests README.
"""
import base64
from concurrent.futures import ThreadPoolExecutor
import copy
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import build_opener, HTTPRedirectHandler, ProxyHandler, Request
import uuid


ROOT = Path(__file__).resolve().parents[1]


def local_config(env):
    """Fail before any I/O; never fall back to the application's DATABASE_URL."""
    api = env.get("TEST_SUPABASE_URL", "")
    database = env.get("TEST_DATABASE_URL", "")
    if not re.fullmatch(r"http://127\.0\.0\.1:54321/?", api):
        raise ValueError("Requires TEST_SUPABASE_URL=http://127.0.0.1:54321")
    if not re.fullmatch(
        r"postgres(?:ql)?://postgres(?::[^/@?#\s]+)?@127\.0\.0\.1:54322/postgres",
        database,
    ):
        raise ValueError("Requires a disposable local TEST_DATABASE_URL on port 54322")
    keys = [env.get(key, "") for key in (
        "TEST_SUPABASE_ANON_KEY", "TEST_SUPABASE_SERVICE_ROLE_KEY"
    )]
    if not all(keys):
        raise ValueError("Requires keys from the disposable local Supabase status")
    return api.rstrip("/"), database, *keys


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # Never follow a local gateway redirect to a remote endpoint.
        return None


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


class LocalSupabase:
    def __init__(self):
        self.api, self.database, self.anon, self.service = local_config(os.environ)

    def sql(self, query):
        # libpq environment overrides must not reroute a loopback URL.
        env = {k: v for k, v in os.environ.items() if not k.startswith("PG")}
        result = subprocess.run(
            ["psql", self.database, "-X", "-Atq", "-v", "ON_ERROR_STOP=1"],
            input=query, text=True, capture_output=True, env=env, timeout=30,
        )
        if result.returncode:
            # Do not print credentials, SQL fixture payloads, or libpq diagnostics.
            raise AssertionError("Local SQL setup/assertion failed (psql nonzero)")
        return result.stdout.strip()

    def request(self, path, token=None, payload=None, method="POST", privileged=False):
        key = self.service if privileged else self.anon
        headers = {"apikey": key, "Content-Type": "application/json",
                   "Prefer": "return=representation"}
        if token or privileged:
            headers["Authorization"] = "Bearer " + (token or key)
        request = Request(
            self.api + path, headers=headers, method=method,
            data=json.dumps(payload).encode() if payload is not None else None,
        )
        # Neither environment proxies nor redirects may send local keys elsewhere.
        opener = build_opener(ProxyHandler({}), NoRedirect())
        try:
            with opener.open(request, timeout=20) as response:
                return response.status, json.loads(response.read() or b"null")
        except HTTPError as error:
            return error.code, json.loads(error.read() or b"null")

    def rpc(self, name, token, payload=None):
        return self.request("/rest/v1/rpc/" + name, token, payload or {})


class DraftConflictsHTTP(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = LocalSupabase()
        cls.users = []
        cls.domain = str(uuid.uuid4())
        cls.questions = [str(uuid.uuid4()), str(uuid.uuid4())]
        versions = sorted({p.name.split("_")[0] for p in
                           (ROOT / "supabase/migrations").glob("*.sql")})
        if not versions:
            raise AssertionError("No repository migrations found")
        missing = cls.db.sql("""
            SELECT count(*) FROM unnest(ARRAY[%s]) expected(version)
            WHERE NOT EXISTS (
              SELECT 1 FROM supabase_migrations.schema_migrations applied
              WHERE applied.version = expected.version);
        """ % ",".join(map(literal, versions)))
        if missing != "0":
            raise AssertionError("Full Supabase suite requires EVERY repository migration")
        # Missing ACLs/RLS must not be mistaken for a successful security test.
        checks = cls.db.sql("""
            SELECT c.relrowsecurity
              AND NOT has_table_privilege('authenticated', c.oid, 'SELECT')
              AND NOT has_table_privilege('authenticated', c.oid, 'INSERT')
              AND NOT has_table_privilege('authenticated', c.oid, 'UPDATE')
              AND NOT has_table_privilege('authenticated', c.oid, 'DELETE')
              AND NOT has_table_privilege('anon', c.oid, 'SELECT')
              AND has_function_privilege('authenticated',
                'public.save_assessment_draft(uuid,jsonb)', 'EXECUTE')
              AND NOT has_function_privilege('anon',
                'public.save_assessment_draft(uuid,jsonb)', 'EXECUTE')
              AND NOT has_function_privilege('authenticated',
                'public.start_assessment_draft_unversioned(jsonb)', 'EXECUTE')
            FROM pg_class c WHERE c.oid = 'public.assessment_drafts'::regclass;
        """)
        if checks != "t":
            raise AssertionError("Expected draft RLS/grants are not active")
        cls.addClassCleanup(cls.cleanup)
        cls.owner, cls.owner_a = cls.create_user("owner")
        # A second password login produces a separate Auth session for the SAME user.
        cls.owner_b = cls.login(cls.owner_email, cls.owner_password, cls.owner)
        cls.stranger, cls.stranger_token = cls.create_user("stranger")
        cls.admin, cls.admin_token = cls.create_user("admin")
        if cls.session_id(cls.owner_a) == cls.session_id(cls.owner_b):
            raise AssertionError("Owner tokens must represent distinct Auth sessions")
        cls.db.sql(f"""
            INSERT INTO public.user_roles(user_id,role)
              VALUES ({literal(cls.admin)}, 'admin') ON CONFLICT DO NOTHING;
            INSERT INTO public.competency_domains(id,name)
              VALUES ({literal(cls.domain)}, 'Disposable draft conflict test');
            INSERT INTO public.questions(id,domain_id,question_text,options,correct_answer)
              VALUES {','.join(
                  f"({literal(q)}, {literal(cls.domain)}, 'Draft conflict fixture', "
                  "'[\"A\",\"B\"]'::jsonb, 1)" for q in cls.questions)};
        """)
        if cls.db.sql(f"SELECT public.has_role({literal(cls.admin)}, 'admin');") != "t":
            raise AssertionError("Admin fixture has no effective admin role")
        # Include the full four-per-domain roster required by later migrations,
        # without deleting/replacing the existing seeded questions.
        cls.roster = json.loads(cls.db.sql("""
            SELECT jsonb_agg(jsonb_build_object('id',id,'options',options,
              'question_text',question_text) ORDER BY domain_id,id)
            FROM (SELECT q.*, row_number() OVER (PARTITION BY domain_id ORDER BY id) rn
                  FROM public.questions q) ranked WHERE rn <= 4;
        """))
        if not 2 <= len(cls.roster) <= 100:
            raise AssertionError("Fixture needs a valid complete assessment roster")

    @classmethod
    def session_id(cls, token):
        part = token.split(".")[1]
        claims = json.loads(base64.urlsafe_b64decode(part + "=" * (-len(part) % 4)))
        if not claims.get("session_id"):
            raise AssertionError("Auth token is missing its real session identifier")
        return claims["session_id"]

    @classmethod
    def create_user(cls, label):
        email = f"draft-{label}-{uuid.uuid4().hex}@example.invalid"
        password = secrets.token_hex(24)
        status, user = cls.db.request("/auth/v1/admin/users", privileged=True, payload={
            "email": email, "password": password, "email_confirm": True,
        })
        if status != 200 or not user.get("id"):
            raise AssertionError(f"Local Auth could not create {label}: HTTP {status}")
        user_id = str(uuid.UUID(user["id"]))
        cls.users.append(user_id)
        token = cls.login(email, password, user_id)
        if label == "owner":
            cls.owner_email, cls.owner_password = email, password
        return user_id, token

    @classmethod
    def login(cls, email, password, user_id):
        status, result = cls.db.request("/auth/v1/token?grant_type=password", payload={
            "email": email, "password": password,
        })
        if status != 200 or result.get("user", {}).get("id") != user_id:
            raise AssertionError(f"Local Auth password login failed: HTTP {status}")
        return result["access_token"]

    @classmethod
    def cleanup(cls):
        # Only delete random fixture IDs created in this run, including partial setup.
        failures = []
        for user in cls.users:
            status, _ = cls.db.request(f"/auth/v1/admin/users/{user}",
                                      privileged=True, method="DELETE")
            if status != 200:
                failures.append(user)
        cls.db.sql(f"DELETE FROM public.competency_domains WHERE id={literal(cls.domain)};")
        if failures:
            raise AssertionError("Could not remove disposable Auth fixtures")

    def setUp(self):
        status, started = self.db.rpc("start_assessment_draft", self.owner_a, {"_draft": {
            "version": 1, "revision": 99, "preTestId": "pending",
            "questions": self.roster, "answers": {}, "answerResults": {},
            "phase": "test", "currentQ": 0, "timeLeft": 180, "timedOut": False,
        }})
        self.assertEqual(status, 200, "Owner start RPC must succeed")
        self.pre_test = str(uuid.UUID(started["preTestId"]))
        # Do not leave earlier tests' unfinished drafts visible to later tests.
        # Only this test's random fixture is removed; real rows are untouched.
        self.addCleanup(self.db.sql,
                        f"DELETE FROM public.pre_tests WHERE id={literal(self.pre_test)}"
                        f" AND user_id={literal(self.owner)};")
        self.assertEqual(started["revision"], 0)
        self.base = self.active(self.owner_a)
        self.assertEqual(self.base["preTestId"], self.pre_test)
        self.assertEqual(self.base["revision"], 0)

    def active(self, token):
        status, response = self.db.rpc("get_active_assessment_draft", token)
        self.assertEqual(status, 200)
        return response["draft"] if response else None

    def changed(self, source, answers):
        draft = copy.deepcopy(source)
        draft["answers"] = answers
        return draft

    def save(self, token, draft):
        return self.db.rpc("save_assessment_draft", token, {
            "_pre_test_id": self.pre_test, "_draft": draft,
        })

    def snapshot(self):
        # A privileged comparison catches hidden writes even when RLS hides rows.
        return self.db.sql(f"""
            SELECT jsonb_build_object(
              'draft', (SELECT to_jsonb(d) FROM public.assessment_drafts d
                        WHERE pre_test_id={literal(self.pre_test)}),
              'test', (SELECT to_jsonb(p) FROM public.pre_tests p
                       WHERE id={literal(self.pre_test)}));
        """)

    def assert_error(self, response, message, code="P0001", status=400):
        if code == "42501":
            # PostgREST 16 may include a GRANT hint for table ACL denials.
            # Keep status, SQLSTATE and message strict across server versions.
            actual_status, body = response
            self.assertEqual(actual_status, status)
            self.assertEqual(body["code"], code)
            self.assertEqual(body["message"], message)
            return
        self.assertEqual(response, (status, {
            "code": code, "details": None, "hint": None, "message": message,
        }))

    def test_stale_revision_and_explicit_resolution(self):
        base_b = self.active(self.owner_b)
        self.assertEqual(base_b, self.base)
        q1, q2 = self.questions
        draft_a = self.changed(self.base, {q1: 0})
        status, saved = self.save(self.owner_a, draft_a)
        self.assertEqual((status, saved["saved"], saved["draft"]["revision"]), (200, True, 1))
        self.assertEqual(saved["draft"], {**draft_a, "revision": 1})
        baseline = self.snapshot()
        # Device B cannot silently replace A with its revision-zero snapshot.
        status, stale = self.save(self.owner_b, self.changed(base_b, {q1: 1}))
        self.assertEqual((status, stale), (200, {"saved": False, "draft": saved["draft"]}))
        self.assertEqual(self.snapshot(), baseline)
        self.assertEqual(self.active(self.owner_b), saved["draft"])
        # Explicit choice + merge preserves the other question and increments once.
        resolved = self.changed(stale["draft"], {q1: 1, q2: 0})
        status, result = self.save(self.owner_b, resolved)
        self.assertEqual((status, result), (200, {
            "saved": True, "draft": {**resolved, "revision": 2},
        }))
        self.assertEqual(self.active(self.owner_a), result["draft"])

    def test_two_real_sessions_race_same_revision(self):
        base_b = self.active(self.owner_b)
        barrier = threading.Barrier(2)

        def race(token, draft):
            barrier.wait(timeout=5)
            return self.save(token, draft)

        with ThreadPoolExecutor(max_workers=2) as pool:
            futures = [pool.submit(race, token, self.changed(base, {self.questions[0]: choice}))
                       for token, base, choice in (
                           (self.owner_a, self.base, 0), (self.owner_b, base_b, 1))]
            responses = [future.result(timeout=25) for future in futures]
        self.assertEqual([status for status, _ in responses], [200, 200])
        winners = [body for _, body in responses if body.get("saved") is True]
        losers = [body for _, body in responses if body.get("saved") is False]
        self.assertEqual(len(winners), 1)
        self.assertEqual(len(losers), 1)
        self.assertEqual(winners[0]["draft"]["revision"], 1)
        self.assertEqual(losers[0]["draft"], winners[0]["draft"])
        self.assertEqual(self.active(self.owner_a), winners[0]["draft"])

    def test_old_client_gets_real_http_error_without_revision(self):
        status, saved = self.save(self.owner_a,
                                  self.changed(self.base, {self.questions[0]: 0}))
        self.assertEqual((status, saved["saved"], saved["draft"]["revision"]), (200, True, 1))
        for token in (self.owner_a, self.owner_b):
            draft = self.changed(saved["draft"], {self.questions[0]: 1})
            del draft["revision"]
            before = self.snapshot()
            self.assert_error(self.save(token, draft),
                              "Assessment version is required; reload the application")
            self.assertEqual(self.snapshot(), before)
        self.assertEqual(self.active(self.owner_b), saved["draft"])

    def test_other_user_and_admin_cannot_read_or_save_draft(self):
        before = self.snapshot()
        for token in (self.stranger_token, self.admin_token):
            with self.subTest(role="admin" if token == self.admin_token else "stranger"):
                self.assertIsNone(self.active(token))
                for revision in (0, -1):
                    self.assert_error(self.save(token, {
                        **self.base, "revision": revision,
                        "answers": {self.questions[0]: 1},
                    }), "Assessment unavailable")
                    self.assertEqual(self.snapshot(), before)
        self.assertEqual(self.active(self.owner_a), self.base)

    def test_table_and_internal_rpc_are_not_bypass_paths(self):
        before = self.snapshot()
        path = f"/rest/v1/assessment_drafts?pre_test_id=eq.{self.pre_test}"
        for token in (self.owner_a, self.stranger_token, self.admin_token, None):
            for method in ("GET", "POST", "PATCH", "DELETE"):
                with self.subTest(role="anonymous" if token is None else "authenticated",
                                  method=method):
                    payload = None if method in ("GET", "DELETE") else {
                        "pre_test_id": self.pre_test, "draft": self.base,
                    }
                    self.assert_error(self.db.request(path, token, payload, method),
                                      "permission denied for table assessment_drafts",
                                      code="42501", status=401 if token is None else 403)
                    self.assertEqual(self.snapshot(), before)
        # Authenticated callers cannot bypass the version wrapper at start.
        self.assert_error(self.db.rpc("start_assessment_draft_unversioned", self.owner_a,
                                     {"_draft": self.base}),
                          "permission denied for function start_assessment_draft_unversioned",
                          code="42501", status=403)
        self.assertEqual(self.snapshot(), before)

    def test_anonymous_cannot_call_public_draft_rpcs(self):
        before = self.snapshot()
        for name, payload in (
            ("get_active_assessment_draft", {}),
            ("save_assessment_draft", {"_pre_test_id": self.pre_test, "_draft": self.base}),
            ("start_assessment_draft", {"_draft": self.base}),
        ):
            self.assert_error(self.db.rpc(name, None, payload),
                              f"permission denied for function {name}", code="42501", status=401)
            self.assertEqual(self.snapshot(), before)

    def test_completed_assessment_rejects_current_and_stale_saves(self):
        # Completion through the real RPC, not privileged status manipulation.
        answers = [{"question_id": q["id"], "selected_answer": -1} for q in self.roster]
        status, result = self.db.rpc("submit_assessment", self.owner_a, {
            "_pre_test_id": self.pre_test, "_answers": answers,
        })
        self.assertEqual(status, 200)
        self.assertNotIn("error", result)
        self.assertEqual(self.db.sql(
            f"SELECT status FROM public.pre_tests WHERE id={literal(self.pre_test)};"),
            "completed")
        before = self.snapshot()
        for token in (self.owner_a, self.owner_b):
            for revision in (0, -1):
                self.assert_error(self.save(token, {**self.base, "revision": revision}),
                                  "Assessment unavailable")
                self.assertEqual(self.snapshot(), before)
        self.assertIsNone(self.active(self.owner_a))

    def test_expired_assessment_rejects_current_and_stale_saves(self):
        self.db.sql(f"UPDATE public.pre_tests SET deadline_at=clock_timestamp()-interval '1 second'"
                    f" WHERE id={literal(self.pre_test)};")
        before = self.snapshot()
        for token in (self.owner_a, self.owner_b):
            for revision in (0, -1):
                self.assert_error(self.save(token, {**self.base, "revision": revision}),
                                  "Assessment deadline has passed")
                self.assertEqual(self.snapshot(), before)


if __name__ == "__main__":
    unittest.main(verbosity=2)
