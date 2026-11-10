#!/usr/bin/env python3
"""Permanent bootstrap access through real Auth/PostgREST on local full schema."""
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


class BootstrapSuperAdminHTTP(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.db = LocalSupabase()  # Reject hosted targets before any SQL or HTTP.
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
            raise AssertionError("Bootstrap HTTP suite requires EVERY repository migration")
        checks = cls.db.sql("""
            SELECT c.relrowsecurity
              AND has_table_privilege('authenticated', c.oid, 'SELECT')
              AND has_function_privilege('authenticated',
                    'public.revoke_admin_role(uuid)', 'EXECUTE')
              AND has_function_privilege('authenticated',
                    'public.grant_admin_role(uuid)', 'EXECUTE')
              AND NOT has_function_privilege('anon',
                    'public.revoke_admin_role(uuid)', 'EXECUTE')
            FROM pg_class c WHERE c.oid = 'public.user_roles'::regclass;
        """)
        if checks != "t":
            raise AssertionError("Bootstrap role RLS/grants are not active")
        # Never alter a pre-existing bootstrap identity, even on a local stack.
        if cls.db.sql("""
            SELECT count(*) FROM auth.users
            WHERE lower(email) = 'penshopx@gmail.com';
        """) != "0":
            raise AssertionError("Requires a clean disposable stack without bootstrap user")
        cls.users = []
        cls.addClassCleanup(cls.cleanup)
        cls.bootstrap, cls.token = cls.create_user("penshopx@gmail.com")
        cls.operator, cls.operator_token = cls.create_user(
            f"bootstrap-control-{uuid.uuid4().hex}@example.invalid"
        )

    @classmethod
    def create_user(cls, email):
        password = secrets.token_hex(24)
        status, user = cls.db.request("/auth/v1/admin/users", privileged=True, payload={
            "email": email, "password": password, "email_confirm": True,
        })
        if status != 200 or not user.get("id"):
            raise AssertionError(f"Could not create local Auth fixture: HTTP {status}")
        user_id = str(uuid.UUID(user["id"]))
        cls.users.append(user_id)
        status, session = cls.db.request("/auth/v1/token?grant_type=password", payload={
            "email": email, "password": password,
        })
        if (status != 200 or session.get("user", {}).get("id") != user_id
                or not isinstance(session.get("access_token"), str)
                or not session["access_token"]):
            raise AssertionError(f"Real local Auth login failed: HTTP {status}")
        return user_id, session["access_token"]

    @classmethod
    def cleanup(cls):
        failures = []
        for user in reversed(cls.users):
            status, _ = cls.db.request(f"/auth/v1/admin/users/{user}",
                                       method="DELETE", privileged=True)
            if status not in (200, 204):
                failures.append(status)
        if failures:
            raise AssertionError(f"Local Auth fixture cleanup failed: HTTP {failures}")

    def state(self):
        """Privileged rows AND effective privileges: caller RLS cannot hide writes."""
        return json.loads(self.db.sql(f"""
            SELECT jsonb_build_object(
              'roles', (SELECT coalesce(jsonb_agg(to_jsonb(r) ORDER BY r.id), '[]')
                        FROM public.user_roles r),
              'bootstrap_super', public.is_super_admin({literal(self.bootstrap)}),
              'bootstrap_effective_super', public.has_role({literal(self.bootstrap)}, 'super_admin'),
              'bootstrap_effective_admin', public.has_role({literal(self.bootstrap)}, 'admin'),
              'operator_super', public.is_super_admin({literal(self.operator)}),
              'operator_effective_super', public.has_role({literal(self.operator)}, 'super_admin'),
              'operator_effective_admin', public.has_role({literal(self.operator)}, 'admin'));
        """))

    def assert_bootstrap(self, state):
        self.assertIs(state["bootstrap_super"], True)
        self.assertIs(state["bootstrap_effective_super"], True)
        self.assertIs(state["bootstrap_effective_admin"], True)
        self.assertIs(state["operator_super"], False)
        self.assertIs(state["operator_effective_super"], False)
        rows = [r for r in state["roles"]
                if r["user_id"] == self.bootstrap and r["role"] == "super_admin"]
        self.assertEqual(len(rows), 1, "Bootstrap trigger must seed a real target row")
        return rows[0]

    def assert_unchanged(self, before):
        self.assertEqual(self.state(), before, "Privileged persistent state changed")
        self.assert_bootstrap(before)
        # The exact same real session must retain effective super-admin access.
        self.assertEqual(self.db.rpc("current_user_is_super_admin", self.token), (200, True))

    def assert_rpc_denied(self, response, before):
        status, body = response
        self.assertEqual(status, 400)
        self.assertEqual(body.get("code"), "P0001")
        self.assertEqual(body.get("message"), "The bootstrap super admin cannot be revoked")
        self.assert_unchanged(before)

    def assert_rest_denied(self, response, before):
        status, body = response
        if status == 200:
            self.assertEqual(body, [], "REST mutation must affect zero rows")
        else:
            self.assertEqual(status, 403)
            self.assertEqual(body.get("code"), "42501")
            self.assertIn(body.get("message"), (
                'permission denied for table user_roles',
                'new row violates row-level security policy for table "user_roles"',
            ))
        self.assert_unchanged(before)

    def operational_control(self, method):
        """Same bootstrap token can grant and really revoke a normal admin."""
        payload = {"_target_user": self.operator}
        status, _ = self.db.rpc("grant_admin_role", self.token, payload)
        self.assertIn(status, (200, 204))
        granted = self.state()
        self.assert_bootstrap(granted)
        self.assertIs(granted["operator_effective_admin"], True)
        rows = [r for r in granted["roles"]
                if r["user_id"] == self.operator and r["role"] == "admin"]
        self.assertEqual(len(rows), 1)
        self.assertEqual(
            self.db.rpc("has_role", self.operator_token,
                        {"_user_id": self.operator, "_role": "admin"}), (200, True)
        )
        if method == "RPC":
            status, _ = self.db.rpc("revoke_admin_role", self.token, payload)
            self.assertIn(status, (200, 204))
        else:
            status, body = self.db.request(
                f"/rest/v1/user_roles?id=eq.{rows[0]['id']}&select=id,user_id,role",
                self.token, method="DELETE",
            )
            self.assertEqual(status, 200)
            self.assertEqual(body, [{
                "id": rows[0]["id"], "user_id": self.operator, "role": "admin",
            }], "REST control must actually delete its target, not silently do nothing")
        revoked = self.state()
        self.assert_bootstrap(revoked)
        self.assertIs(revoked["operator_effective_admin"], False)
        expected = {**granted, "operator_effective_admin": False,
                    "roles": [r for r in granted["roles"] if r["id"] != rows[0]["id"]]}
        self.assertEqual(revoked, expected, "Revocation must change only the intended role")
        self.assertEqual(
            self.db.rpc("has_role", self.operator_token,
                        {"_user_id": self.operator, "_role": "admin"}), (200, False)
        )

    def test_bootstrap_access_is_permanent_through_rpc_and_rest(self):
        row = self.assert_bootstrap(self.state())
        path = f"/rest/v1/user_roles?id=eq.{row['id']}&select=id,user_id,role"
        self.assertEqual(self.db.request(path, self.token, method="GET"), (200, [{
            "id": row["id"], "user_id": self.bootstrap, "role": "super_admin",
        }]), "Mutation target must exist and be visible to this session")
        self.operational_control("RPC")
        baseline = self.state()
        self.assert_rpc_denied(
            self.db.rpc("revoke_admin_role", self.token, {"_target_user": self.bootstrap}),
            baseline,
        )
        attacks = [
            ("DELETE", None),
            ("PATCH", {"role": "admin"}),
            ("PATCH", {"role": "user"}),
            ("PATCH", {"user_id": self.operator}),
        ]
        for method, payload in attacks:
            with self.subTest(method=method, payload=payload):
                self.assert_rest_denied(
                    self.db.request(path, self.token, payload=payload, method=method),
                    baseline,
                )
        # Controls after attacks rule out endpoint/session failure as the denial cause.
        self.operational_control("RPC")
        self.operational_control("REST")
        self.assert_unchanged(baseline)


if __name__ == "__main__":
    unittest.main(verbosity=2)
