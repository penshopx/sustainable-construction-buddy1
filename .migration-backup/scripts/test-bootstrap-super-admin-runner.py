#!/usr/bin/env python3
"""Offline runner guards, not substitutes for real local API integration."""
import importlib.util
import os
from pathlib import Path
import subprocess
import tempfile
import unittest
from unittest.mock import Mock, patch


SCRIPT = Path(__file__).with_name("test-bootstrap-super-admin-http.py")
spec = importlib.util.spec_from_file_location("bootstrap_http", SCRIPT)
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)
LOCAL = {
    "TEST_SUPABASE_URL": "http://127.0.0.1:54321",
    "TEST_DATABASE_URL": "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    "TEST_SUPABASE_ANON_KEY": "dummy",
    "TEST_SUPABASE_SERVICE_ROLE_KEY": "dummy",
}


class RunnerSafety(unittest.TestCase):
    def test_unsafe_targets_fail_before_io(self):
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
                ("TEST_DATABASE_URL", ""),
                ("TEST_SUPABASE_ANON_KEY", ""),
                ("TEST_SUPABASE_SERVICE_ROLE_KEY", ""),
            ]
            for key, value in cases:
                with self.subTest(key=key):
                    result = subprocess.run(["python3", str(SCRIPT)], capture_output=True,
                                            text=True, timeout=10, env={
                        **os.environ, **LOCAL, key: value,
                        "DATABASE_URL": "postgresql://hosted.invalid/postgres",
                        "CALL_LOG": str(marker),
                        "PATH": directory + os.pathsep + os.environ["PATH"],
                    })
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn("Requires", result.stderr)
                    self.assertFalse(marker.exists())

    def test_full_migrations_and_rls_required_before_auth_setup(self):
        for responses, error in [
            (["1"], "EVERY repository migration"),
            (["0", "f"], "RLS/grants are not active"),
            (["0", "t", "1"], "clean disposable stack"),
        ]:
            with self.subTest(error=error):
                db = Mock()
                db.sql.side_effect = responses
                with patch.object(module, "LocalSupabase", return_value=db):
                    with self.assertRaisesRegex(AssertionError, error):
                        module.BootstrapSuperAdminHTTP.setUpClass()
                db.request.assert_not_called()
                ledger = db.sql.call_args_list[0].args[0]
                for migration in (module.ROOT / "supabase/migrations").glob("*.sql"):
                    self.assertIn(module.literal(migration.name.split("_")[0]), ledger)

    def test_rest_cannot_pass_for_affected_rows_or_unrelated_errors(self):
        case = module.BootstrapSuperAdminHTTP()
        with patch.object(case, "assert_unchanged") as unchanged:
            case.assert_rest_denied((200, []), "before")
            case.assert_rest_denied((403, {
                "code": "42501", "message": "permission denied for table user_roles",
            }), "before")
            for response in [
                (200, [{"role": "admin"}]), (204, None), (401, {"code": "PGRST301"}),
                (404, {"code": "PGRST202"}),
                (403, {"code": "42501", "message": "unrelated"}),
            ]:
                with self.subTest(response=response), self.assertRaises(AssertionError):
                    case.assert_rest_denied(response, "before")
            self.assertEqual(unchanged.call_count, 2)

    def test_rpc_must_reject_specifically_for_permanent_bootstrap(self):
        case = module.BootstrapSuperAdminHTTP()
        with patch.object(case, "assert_unchanged") as unchanged:
            case.assert_rpc_denied((400, {
                "code": "P0001", "message": "The bootstrap super admin cannot be revoked",
            }), "before")
            for response in [
                (200, None), (404, {"code": "PGRST202"}),
                (400, {"code": "P0001",
                       "message": "Only the bootstrap super admin can revoke admin access"}),
            ]:
                with self.subTest(response=response), self.assertRaises(AssertionError):
                    case.assert_rpc_denied(response, "before")
            unchanged.assert_called_once_with("before")

    def test_denied_request_cannot_hide_privileged_state_change(self):
        case = module.BootstrapSuperAdminHTTP()
        with patch.object(case, "state", return_value={"roles": "changed"}):
            with self.assertRaisesRegex(AssertionError, "persistent state"):
                case.assert_rest_denied((200, []), {"roles": "before"})
            with self.assertRaisesRegex(AssertionError, "persistent state"):
                case.assert_rpc_denied((400, {
                    "code": "P0001", "message": "The bootstrap super admin cannot be revoked",
                }), {"roles": "before"})


if __name__ == "__main__":
    unittest.main(verbosity=2)
