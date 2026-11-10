#!/usr/bin/env python3
"""Offline safety checks for the real-HTTP draft conflict runner."""
import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch


SCRIPT = Path(__file__).with_name("test-assessment-draft-conflicts-http.py")
spec = importlib.util.spec_from_file_location("draft_http", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

LOCAL = {
    "TEST_SUPABASE_URL": "http://127.0.0.1:54321",
    "TEST_DATABASE_URL": "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    "TEST_SUPABASE_ANON_KEY": "dummy",
    "TEST_SUPABASE_SERVICE_ROLE_KEY": "dummy",
}


class RunnerSafety(unittest.TestCase):
    def test_accept_only_explicit_disposable_local_config(self):
        self.assertEqual(module.local_config(LOCAL), (
            LOCAL["TEST_SUPABASE_URL"], LOCAL["TEST_DATABASE_URL"], "dummy", "dummy",
        ))
        for key in LOCAL:
            with self.subTest(missing=key):
                with self.assertRaises(ValueError):
                    module.local_config({k: v for k, v in LOCAL.items() if k != key})

    def test_hosted_and_rerouting_urls_fail_before_database_or_network(self):
        with tempfile.TemporaryDirectory() as directory:
            marker = Path(directory) / "called"
            psql = Path(directory) / "psql"
            psql.write_text('#!/bin/sh\ntouch "$CALL_LOG"\nexit 99\n')
            psql.chmod(0o755)
            cases = [
                ("TEST_SUPABASE_URL", "https://project.supabase.co"),
                ("TEST_SUPABASE_URL", "http://127.0.0.1:54321@production.invalid"),
                ("TEST_SUPABASE_URL", "http://127.0.0.1:54321/redirect"),
                ("TEST_DATABASE_URL", "postgresql://postgres:pw@production.invalid:54322/postgres"),
                ("TEST_DATABASE_URL", LOCAL["TEST_DATABASE_URL"] + "?host=production.invalid"),
                ("TEST_DATABASE_URL", LOCAL["TEST_DATABASE_URL"] + "#fragment"),
                ("TEST_DATABASE_URL", "postgresql://postgres:pw@127.0.0.1:5432/postgres"),
                ("TEST_DATABASE_URL", "postgresql://postgres:pw@127.0.0.1:54322/production"),
                ("TEST_DATABASE_URL", ""),
            ]
            for key, value in cases:
                with self.subTest(key=key, value=value):
                    env = {**os.environ, **LOCAL, key: value,
                           "DATABASE_URL": "postgresql://hosted.invalid/postgres",
                           "CALL_LOG": str(marker),
                           "PATH": directory + os.pathsep + os.environ["PATH"]}
                    result = subprocess.run(
                        ["python3", str(SCRIPT)], env=env, capture_output=True,
                        text=True, timeout=10,
                    )
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn("Requires", result.stderr)
                    self.assertFalse(marker.exists(), "Unsafe target reached psql")

    def test_libpq_environment_overrides_are_removed(self):
        with tempfile.TemporaryDirectory() as directory:
            psql = Path(directory) / "psql"
            psql.write_text("""#!/bin/sh
if env | grep '^PG' >/dev/null; then exit 99; fi
cat >/dev/null
printf 'local-only\\n'
""")
            psql.chmod(0o755)
            env = {**os.environ, **LOCAL, "PGHOST": "hosted.invalid",
                   "PGSERVICE": "hosted", "PGOPTIONS": "injected",
                   "PATH": directory + os.pathsep + os.environ["PATH"]}
            result = subprocess.run(
                ["python3", "-c", """
import importlib.util, sys
spec = importlib.util.spec_from_file_location("draft_http", sys.argv[1])
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
assert module.LocalSupabase().sql("SELECT 1;") == "local-only"
""", str(SCRIPT)], env=env, capture_output=True, text=True, timeout=10,
            )
            self.assertEqual(result.returncode, 0, result.stderr)

    def test_redirects_cannot_send_local_keys_off_machine(self):
        self.assertIsNone(module.NoRedirect().redirect_request(
            None, None, 302, "redirect", {}, "https://hosted.invalid",
        ))

    def test_acl_hint_is_version_dependent_but_denial_must_be_exact(self):
        case = module.DraftConflictsHTTP()
        for hint in (None, "Grant the required privileges to the current role"):
            case.assert_error((403, {
                "code": "42501", "message": "permission denied for table assessment_drafts",
                "details": None, "hint": hint,
            }), "permission denied for table assessment_drafts", code="42501", status=403)
        with self.assertRaises(AssertionError):
            case.assert_error((200, {
                "code": "42501", "message": "permission denied for table assessment_drafts",
            }), "permission denied for table assessment_drafts", code="42501", status=403)

    def test_partial_schema_and_missing_acl_fail_before_auth_fixtures(self):
        for sql_results, message in (
            (["1"], "EVERY repository migration"),
            (["0", "f"], "RLS/grants are not active"),
        ):
            with self.subTest(message=message):
                db = Mock()
                db.sql.side_effect = sql_results
                with patch.object(module, "LocalSupabase", return_value=db):
                    with self.assertRaisesRegex(AssertionError, message):
                        module.DraftConflictsHTTP.setUpClass()
                db.request.assert_not_called()
                ledger_query = db.sql.call_args_list[0].args[0]
                for migration in (module.ROOT / "supabase/migrations").glob("*.sql"):
                    self.assertIn(module.literal(migration.name.split("_")[0]), ledger_query)


if __name__ == "__main__":
    unittest.main(verbosity=2)
