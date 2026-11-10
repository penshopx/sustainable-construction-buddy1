#!/usr/bin/env python3
"""No database/network needed: check CI staging and local-only runner guards."""
import importlib.util
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

SCRIPTS = Path(__file__).resolve().parent


class QuizCI(unittest.TestCase):
    def test_admin_role_runner_rejects_hosted_and_connection_overrides(self):
        with tempfile.TemporaryDirectory() as directory:
            fake = Path(directory) / "psql"
            fake.write_text('#!/bin/sh\ntouch "$CALL_LOG"\nexit 99\n')
            fake.chmod(0o755)
            log = Path(directory) / "called"
            for url in (
                "postgresql://postgres:postgres@production.invalid:54322/postgres",
                "postgresql://postgres:postgres@127.0.0.1:54322/postgres?host=production.invalid",
                "postgresql://postgres:postgres@127.0.0.1:54322/postgres#fragment",
            ):
                with self.subTest(url=url):
                    env = {
                        **os.environ, "PATH": directory + os.pathsep + os.environ["PATH"],
                        "CALL_LOG": str(log), "TEST_DATABASE_URL": url,
                        "TEST_SUPABASE_URL": "http://127.0.0.1:54321",
                        "TEST_SUPABASE_ANON_KEY": "dummy",
                        "TEST_SUPABASE_SERVICE_ROLE_KEY": "dummy",
                    }
                    result = subprocess.run(
                        ["bash", str(SCRIPTS / "test-submit-assessment-concurrency.sh"),
                         "--admin-role-revocation"],
                        env=env, capture_output=True, text=True,
                    )
                    self.assertEqual(result.returncode, 1)
                    self.assertIn("requires a local Supabase database URL", result.stderr)
                    self.assertFalse(log.exists(), "Unsafe URL reached the database client")

    def test_admin_role_snapshot_requires_unchanged_rows_and_no_effective_admin(self):
        import json
        baseline = {
            "roles": [{"id": "existing-user-row", "user_id": "former-admin", "role": "user"}],
            "admin": False, "super_admin": False,
        }
        for label, actual, expected, succeeds in (
            ("unchanged", baseline, baseline, True),
            ("hidden insert", {**baseline, "roles": baseline["roles"] + [
                {"id": "injected-row", "user_id": "former-admin", "role": "admin"}
            ]}, baseline, False),
            ("hidden update", {**baseline, "roles": [
                {"id": "existing-user-row", "user_id": "former-admin", "role": "super_admin"}
            ]}, baseline, False),
            ("effective admin", {**baseline, "admin": True}, baseline, False),
            ("effective super-admin", {**baseline, "super_admin": True}, baseline, False),
            # Even an accidentally bad baseline cannot approve stored/effective roles.
            ("bad baseline", {**baseline, "super_admin": True},
             {**baseline, "super_admin": True}, False),
        ):
            with self.subTest(label=label):
                result = subprocess.run(
                    ["bash", "-c", """
set -euo pipefail
source "$1"
TEST_ADMIN_USER_ID=former-admin
admin_role_privileged_state() { printf '%s\\n' "$ACTUAL"; }
assert_admin_role_unchanged "$EXPECTED" "snapshot unit check"
""", "snapshot-check", str(SCRIPTS / "test-admin-role-revocation-http.sh")],
                    env={**os.environ, "ACTUAL": json.dumps(actual),
                         "EXPECTED": json.dumps(expected)},
                    capture_output=True, text=True,
                )
                self.assertEqual(result.returncode == 0, succeeds, result.stderr)

    def test_active_admin_snapshot_detects_hidden_writes_and_bad_fixture_privileges(self):
        import json
        baseline = {
            "roles": [
                {"id": "actor-row", "user_id": "actor", "role": "admin"},
                {"id": "member-row", "user_id": "member", "role": "user"},
            ],
            "actor_admin": True, "actor_super": False,
            "member_admin": False, "member_super": False,
            "bootstrap_admin": True, "bootstrap_super": True,
        }
        mutations = [
            ("hidden insert", {**baseline, "roles": baseline["roles"] + [
                {"id": "injected", "user_id": "actor", "role": "super_admin"}]}),
            ("hidden update", {**baseline, "roles": [
                baseline["roles"][0], {"id": "member-row", "user_id": "member", "role": "admin"}
            ]}),
            *[(key, {**baseline, key: not baseline[key]}) for key in baseline if key != "roles"],
        ]
        cases = [("unchanged", baseline, baseline, True)]
        for label, mutated in mutations:
            cases.append((label, mutated, baseline, False))
            if label not in ("hidden insert", "hidden update"):
                cases.append(("bad baseline " + label, mutated, mutated, False))
        for label, actual, expected, succeeds in cases:
            with self.subTest(label=label):
                result = subprocess.run(
                    ["bash", "-c", """
set -euo pipefail
source "$1"
active_admin_role_state() { printf '%s\\n' "$ACTUAL"; }
assert_active_admin_roles_unchanged "$EXPECTED" "snapshot unit check"
""", "snapshot-check", str(SCRIPTS / "test-active-admin-role-escalation-http.sh")],
                    env={**os.environ, "ACTUAL": json.dumps(actual),
                         "EXPECTED": json.dumps(expected)},
                    capture_output=True, text=True,
                )
                self.assertEqual(result.returncode == 0, succeeds, result.stderr)

    def test_active_admin_runner_rejects_hosted_targets_before_any_io(self):
        with tempfile.TemporaryDirectory() as directory:
            log = Path(directory) / "called"
            for name in ("psql", "curl"):
                fake = Path(directory) / name
                fake.write_text('#!/bin/sh\ntouch "$CALL_LOG"\nexit 99\n')
                fake.chmod(0o755)
            local = {
                **os.environ, "PATH": directory + os.pathsep + os.environ["PATH"],
                "CALL_LOG": str(log),
                "TEST_DATABASE_URL": "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
                "TEST_SUPABASE_URL": "http://127.0.0.1:54321",
                "TEST_SUPABASE_ANON_KEY": "dummy",
                "TEST_SUPABASE_SERVICE_ROLE_KEY": "dummy",
            }
            for key, value in (
                ("TEST_DATABASE_URL", "postgresql://postgres:pw@hosted.invalid:54322/postgres"),
                ("TEST_DATABASE_URL", local["TEST_DATABASE_URL"] + "?host=hosted.invalid"),
                ("TEST_DATABASE_URL", local["TEST_DATABASE_URL"] + "#fragment"),
                ("TEST_SUPABASE_URL", "https://hosted.invalid"),
                ("TEST_SUPABASE_URL", "http://127.0.0.1:54321@hosted.invalid"),
                ("TEST_SUPABASE_URL", "http://127.0.0.1:54321/path"),
            ):
                with self.subTest(key=key, value=value):
                    result = subprocess.run(
                        ["bash", str(SCRIPTS / "test-submit-assessment-concurrency.sh"),
                         "--admin-role-escalation"],
                        env={**local, key: value}, capture_output=True, text=True, timeout=10,
                    )
                    self.assertEqual(result.returncode, 1)
                    self.assertIn("requires a local Supabase", result.stderr)
                    self.assertFalse(log.exists(), "Unsafe target reached psql or curl")

    def test_all_migrations_staged_once_in_order(self):
        spec = importlib.util.spec_from_file_location(
            "prepare", SCRIPTS / "prepare-supabase-test-project.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        with tempfile.TemporaryDirectory() as directory:
            module.prepare(Path(directory))
            target = Path(directory) / "supabase"
            staged = sorted((target / "migrations").glob("*.sql"))
            original = sorted((SCRIPTS.parent / "supabase/migrations").glob("*.sql"))
            contents = "\n".join(file.read_text() for file in staged)
            positions = []
            for file in original:
                marker = f"-- Source: {file.name}\n"
                self.assertEqual(contents.count(marker), 1, file.name)
                self.assertIn(marker + file.read_text(), contents)
                positions.append(contents.index(marker))
            self.assertEqual(positions, sorted(positions))
            self.assertEqual(len(staged), len({f.name.split("_")[0] for f in original}) + 1)
            prerequisite = target / "migrations/20260827051515_ci_enum_prerequisite.sql"
            self.assertIn("ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'super_admin';",
                          prerequisite.read_text())
            self.assertLess(staged.index(prerequisite),
                            staged.index(target / "migrations/20260827051516_ci.sql"))
            self.assertEqual((target / "config.toml").read_text(), 'project_id = "aspekindo-ci"\n')
            self.assertFalse((target / ".temp").exists())

    def run_runner(self, url, concurrent_exit=0):
        with tempfile.TemporaryDirectory() as directory:
            fake = Path(directory) / "psql"
            # A sentinel proves rejected URLs never reach the database client.
            fake.write_text('#!/bin/sh\nprintf "%s\\n" "$@" > "$CALL_LOG"\n')
            fake.chmod(0o755)
            python = Path(directory) / "python3"
            python.write_text(
                '#!/bin/sh\ncase "$1" in\n'
                '  */test-lms-quiz-submit-concurrency.py) printf "%s\\n" "$1" >> "$CALL_LOG"; '
                'exit "$CONCURRENT_EXIT";;\n'
                f'esac\nexec "{sys.executable}" "$@"\n'
            )
            python.chmod(0o755)
            log = Path(directory) / "called"
            env = {**os.environ, "PATH": directory + os.pathsep + os.environ["PATH"],
                   "CALL_LOG": str(log), "CONCURRENT_EXIT": str(concurrent_exit),
                   "DATABASE_URL": "postgresql://production.invalid/postgres"}
            env.pop("TEST_DATABASE_URL", None)
            if url is not None:
                env["TEST_DATABASE_URL"] = url
            result = subprocess.run(
                ["bash", str(SCRIPTS / "test-aspekindo-lms-quiz-authority.sh"), "--supabase"],
                env=env, capture_output=True, text=True,
            )
            return result.returncode, log.read_text() if log.exists() else None

    def test_local_supabase_uses_full_schema_suite(self):
        code, args = self.run_runner("postgresql://postgres:postgres@127.0.0.1:54322/postgres")
        self.assertEqual(code, 0)
        self.assertIn("full_schema=true", args)
        self.assertIn("expected_migrations=", args)
        self.assertIn("aspekindo_lms_quiz_authority.sql", args)
        self.assertIn("test-lms-quiz-submit-concurrency.py", args)
        self.assertNotIn("aspekindo_lms_quiz_local_schema.sql", args)

    def test_concurrent_failure_fails_the_full_schema_runner(self):
        code, args = self.run_runner(
            "postgresql://postgres:postgres@127.0.0.1:54322/postgres", concurrent_exit=23,
        )
        self.assertEqual(code, 23)
        self.assertIn("test-lms-quiz-submit-concurrency.py", args)

    def test_concurrent_submit_script_rejects_unsafe_targets_before_io(self):
        with tempfile.TemporaryDirectory() as directory:
            fake = Path(directory) / "psql"
            fake.write_text('#!/bin/sh\ntouch "$CALL_LOG"\nexit 99\n')
            fake.chmod(0o755)
            log = Path(directory) / "called"
            for url in (
                "", "postgresql://postgres:pw@production.invalid:54322/postgres",
                "postgresql://postgres:pw@127.0.0.1:5432/postgres",
                "postgresql://postgres:pw@127.0.0.1:54322/production",
                "postgresql://postgres:pw@127.0.0.1:54322/postgres?host=production.invalid",
                "postgresql://postgres:pw@127.0.0.1:54322/postgres#fragment",
            ):
                with self.subTest(url=url):
                    result = subprocess.run(
                        [sys.executable, str(SCRIPTS / "test-lms-quiz-submit-concurrency.py")],
                        env={**os.environ, "PATH": directory + os.pathsep + os.environ["PATH"],
                             "CALL_LOG": str(log), "TEST_DATABASE_URL": url,
                             "DATABASE_URL": "postgresql://production.invalid/postgres"},
                        capture_output=True, text=True, timeout=10,
                    )
                    self.assertNotEqual(result.returncode, 0)
                    self.assertIn("Requires disposable local Supabase", result.stderr)
                    self.assertFalse(log.exists(), "Unsafe target reached psql")

    def test_concurrent_submit_requires_full_migrations_and_enabled_trigger(self):
        spec = importlib.util.spec_from_file_location(
            "quiz_concurrent", SCRIPTS / "test-lms-quiz-submit-concurrency.py"
        )
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        for results, message in (
            (["1"], "EVERY repository migration"),
            (["0", "0"], "Attempt-number lock trigger"),
        ):
            with self.subTest(message=message):
                connection = Mock()
                connection.execute.side_effect = results
                with patch.object(module, "Connection", return_value=connection), patch.dict(
                    os.environ,
                    {"TEST_DATABASE_URL": "postgresql://postgres:postgres@127.0.0.1:54322/postgres"},
                ):
                    with self.assertRaisesRegex(AssertionError, message):
                        module.run()
                self.assertEqual(connection.execute.call_count, len(results))
                connection.close.assert_called_once()
                query = connection.execute.call_args_list[0].args[0]
                for migration in (SCRIPTS.parent / "supabase/migrations").glob("*.sql"):
                    self.assertIn(module.literal(migration.name.split("_")[0]), query)

    def test_reject_missing_hosted_and_connection_overrides(self):
        for url in (
            None,
            "postgresql://postgres:postgres@production.invalid:54322/postgres",
            "postgresql://postgres:postgres@127.0.0.1:5432/postgres",
            "postgresql://postgres:postgres@127.0.0.1:54322/production",
            "postgresql://postgres:postgres@127.0.0.1:54322/postgres?host=production.invalid",
            "postgresql://postgres:postgres@127.0.0.1:54322/postgres#fragment",
        ):
            with self.subTest(url=url):
                code, args = self.run_runner(url)
                self.assertNotEqual(code, 0)
                self.assertIsNone(args)


if __name__ == "__main__":
    unittest.main()
