#!/usr/bin/env python3
"""Offline guard checks for the assessment question-authority HTTP suite."""
import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch


SCRIPT = Path(__file__).with_name("test-assessment-question-authority-http.py")
spec = importlib.util.spec_from_file_location("question_http", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

LOCAL = {
    "TEST_SUPABASE_URL": "http://127.0.0.1:54321",
    "TEST_DATABASE_URL": "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    "TEST_SUPABASE_ANON_KEY": "dummy",
    "TEST_SUPABASE_SERVICE_ROLE_KEY": "dummy",
}


class RunnerSafety(unittest.TestCase):
    def test_unsafe_targets_fail_before_any_database_or_http_io(self):
        with tempfile.TemporaryDirectory() as directory:
            marker = Path(directory) / "called"
            psql = Path(directory) / "psql"
            psql.write_text('#!/bin/sh\ntouch "$CALL_LOG"\nexit 99\n')
            psql.chmod(0o755)
            cases = [
                ("TEST_SUPABASE_URL", "https://project.supabase.co"),
                ("TEST_SUPABASE_URL", "http://127.0.0.1:54321@hosted.invalid"),
                ("TEST_SUPABASE_URL", "http://127.0.0.1:54321/redirect"),
                ("TEST_DATABASE_URL", "postgresql://postgres:pw@hosted.invalid:54322/postgres"),
                ("TEST_DATABASE_URL", LOCAL["TEST_DATABASE_URL"] + "?host=hosted.invalid"),
                ("TEST_DATABASE_URL", LOCAL["TEST_DATABASE_URL"] + "#fragment"),
                ("TEST_DATABASE_URL", "postgresql://postgres:pw@127.0.0.1:5432/postgres"),
                ("TEST_DATABASE_URL", ""),
                ("TEST_SUPABASE_ANON_KEY", ""),
                ("TEST_SUPABASE_SERVICE_ROLE_KEY", ""),
            ]
            for key, value in cases:
                with self.subTest(key=key, value=value):
                    env = {**os.environ, **LOCAL, key: value,
                           "DATABASE_URL": "postgresql://hosted.invalid/postgres",
                           "CALL_LOG": str(marker),
                           "PATH": directory + os.pathsep + os.environ["PATH"]}
                    result = subprocess.run(
                        ["python3", str(SCRIPT)], env=env,
                        capture_output=True, text=True, timeout=10,
                    )
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn("Requires", result.stderr)
                    self.assertFalse(marker.exists(), "Unsafe target reached psql")

    def test_all_migrations_and_real_acls_are_required_before_auth_setup(self):
        for results, message in (
            (["1"], "EVERY repository migration"),
            (["0", "f"], "Question authority RLS/grants are not active"),
        ):
            with self.subTest(message=message):
                db = Mock()
                db.sql.side_effect = results
                with patch.object(module, "LocalSupabase", return_value=db):
                    with self.assertRaisesRegex(AssertionError, message):
                        module.QuestionAuthorityHTTP.setUpClass()
                db.request.assert_not_called()
                ledger_query = db.sql.call_args_list[0].args[0]
                for migration in (module.ROOT / "supabase/migrations").glob("*.sql"):
                    self.assertIn(module.literal(migration.name.split("_")[0]), ledger_query)

    def test_rejected_http_200_error_must_not_be_mistaken_for_success(self):
        case = module.QuestionAuthorityHTTP()
        with patch.object(case, "snapshot", return_value="unchanged"):
            case.assert_rpc_rejection((200, {"error": "Invalid assessment questions"}),
                                      "Invalid assessment questions", "unchanged")
            for response in ((200, {"score": 100}), (400, {"error": "unrelated failure"})):
                with self.assertRaises(AssertionError):
                    case.assert_rpc_rejection(response, "Invalid assessment questions", "unchanged")

    def test_hidden_writes_fail_even_when_request_was_denied(self):
        case = module.QuestionAuthorityHTTP()
        with patch.object(case, "snapshot", return_value="changed"):
            with self.assertRaisesRegex(AssertionError, "persistent state"):
                case.assert_rpc_rejection((200, {"error": "Invalid assessment questions"}),
                                          "Invalid assessment questions", "before")
            with self.assertRaisesRegex(AssertionError, "persistent state"):
                case.assert_permission_denied((403, {
                    "code": "42501", "details": None, "hint": None,
                    "message": "permission denied for table pre_tests",
                }), "permission denied for table pre_tests", "before")

    def test_start_denial_requires_question_authority_error_and_unchanged_state(self):
        case = module.QuestionAuthorityHTTP()
        denied = (400, {
            "code": "P0001", "details": None, "hint": None,
            "message": "Invalid assessment questions",
        })
        with patch.object(case, "snapshot", return_value="unchanged"):
            case.assert_start_rejected(denied, "unchanged")
            for response in (
                (200, {"preTestId": "unexpected success"}),
                (401, {"message": "Expired JWT"}),
                (404, {"code": "PGRST202"}),
                (400, {**denied[1], "message": "Invalid assessment draft"}),
            ):
                with self.subTest(response=response):
                    with self.assertRaises(AssertionError):
                        case.assert_start_rejected(response, "unchanged")
        with patch.object(case, "snapshot", return_value="changed"):
            with self.assertRaisesRegex(AssertionError, "persistent state"):
                case.assert_start_rejected(denied, "before")

    def test_postgrest_grant_hint_does_not_change_the_security_assertion(self):
        case = module.QuestionAuthorityHTTP()
        with patch.object(case, "snapshot", return_value="unchanged"):
            for hint in (None, "Grant the required privileges to the current role"):
                case.assert_permission_denied((403, {
                    "code": "42501", "details": None, "hint": hint,
                    "message": "permission denied for table pre_tests",
                }), "permission denied for table pre_tests", "unchanged")
            for status, code in ((200, "42501"), (403, "PGRST202")):
                with self.assertRaises(AssertionError):
                    case.assert_permission_denied((status, {
                        "code": code, "message": "permission denied for table pre_tests",
                    }), "permission denied for table pre_tests", "unchanged")


if __name__ == "__main__":
    unittest.main(verbosity=2)
