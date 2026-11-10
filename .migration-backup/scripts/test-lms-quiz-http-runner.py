#!/usr/bin/env python3
"""Offline safety checks for the HTTP quiz runner, not an HTTP test substitute."""
import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch


SCRIPT = Path(__file__).with_name("test-lms-quiz-authority-http.py")
spec = importlib.util.spec_from_file_location("quiz_http", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
LOCAL = {
    "TEST_SUPABASE_URL": "http://127.0.0.1:54321",
    "TEST_DATABASE_URL": "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    "TEST_SUPABASE_ANON_KEY": "local-test-placeholder",
    "TEST_SUPABASE_SERVICE_ROLE_KEY": "local-test-placeholder",
}


class QuizHTTPRunner(unittest.TestCase):
    def test_unsafe_config_rejected_before_io(self):
        with tempfile.TemporaryDirectory() as directory:
            marker = Path(directory) / "psql-called"
            fake = Path(directory) / "psql"
            fake.write_text('#!/bin/sh\ntouch "$CALL_LOG"\nexit 99\n')
            fake.chmod(0o755)
            for key, value in (
                ("TEST_DATABASE_URL", ""),
                ("TEST_DATABASE_URL", "postgresql://postgres:pw@hosted.invalid:54322/postgres"),
                ("TEST_DATABASE_URL", LOCAL["TEST_DATABASE_URL"] + "?host=hosted.invalid"),
                ("TEST_DATABASE_URL", LOCAL["TEST_DATABASE_URL"] + "#fragment"),
                ("TEST_DATABASE_URL", "postgresql://postgres:pw@127.0.0.1:5432/postgres"),
                ("TEST_SUPABASE_URL", ""),
                ("TEST_SUPABASE_URL", "https://hosted.invalid"),
                ("TEST_SUPABASE_URL", "http://127.0.0.1:54321@hosted.invalid"),
                ("TEST_SUPABASE_URL", "http://127.0.0.1:54321/redirect"),
                ("TEST_SUPABASE_ANON_KEY", ""),
                ("TEST_SUPABASE_SERVICE_ROLE_KEY", ""),
            ):
                with self.subTest(key=key, value=value):
                    result = subprocess.run(
                        ["python3", str(SCRIPT)],
                        env={**os.environ, **LOCAL, key: value,
                             "DATABASE_URL": "postgresql://hosted.invalid/postgres",
                             "CALL_LOG": str(marker),
                             "PATH": directory + os.pathsep + os.environ["PATH"]},
                        text=True, capture_output=True, timeout=10,
                    )
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn("Requires", result.stderr)
                    self.assertFalse(marker.exists())

    def test_missing_migrations_fail_before_auth(self):
        db = Mock()
        db.sql.return_value = "1"
        with patch.object(module, "LocalSupabase", return_value=db):
            with self.assertRaisesRegex(AssertionError, "EVERY repository migration"):
                module.QuizAuthorityHTTP.setUpClass()
        db.request.assert_not_called()
        for migration in (module.ROOT / "supabase/migrations").glob("*.sql"):
            self.assertIn(module.literal(migration.name.split("_")[0]),
                          db.sql.call_args.args[0])

    def test_denials_cannot_hide_writes_or_accept_transport_failures(self):
        case = module.QuizAuthorityHTTP()
        baseline = {"attempts": [{"score": 30}], "answers": [{"is_correct": False}]}
        changed = {"attempts": [{"score": 100}], "answers": [{"is_correct": True}]}
        for status, body, state, passes in (
            (200, [], baseline, True),  # Legitimate RLS no-op.
            (403, {"code": "42501"}, baseline, True),
            (200, [], changed, False),  # Hidden privileged write.
            (200, [{"score": 100}], baseline, False),
            (500, {"code": "XX000"}, baseline, False),
            (404, {"code": "PGRST205"}, baseline, False),  # Missing table != RLS.
        ):
            with self.subTest(status=status, state=state):
                case.state = Mock(side_effect=[baseline, state])
                case.table = Mock(return_value=(status, body))
                if passes:
                    case.assert_write_denied("quiz_attempts", "token", "PATCH", {})
                else:
                    with self.assertRaises(AssertionError):
                        case.assert_write_denied("quiz_attempts", "token", "PATCH", {})


if __name__ == "__main__":
    unittest.main(verbosity=2)
