#!/usr/bin/env bash
# Sourced by the local-only assessment runner. All attacks use a real Auth
# token and the anon API key; only fixture setup and assertions bypass RLS.
admin_role_http_request() {
  local token="$1" method="$2" path="$3" payload="$4"
  curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/admin-role-response.json" --write-out '%{http_code}' \
    --request "$method" "${TEST_SUPABASE_URL%/}/rest/v1/$path" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY" \
    --header "Authorization: Bearer $token" \
    --header 'Content-Type: application/json' \
    --header 'Prefer: return=representation' --data "$payload"
}

admin_role_privileged_state() {
  "${PSQL[@]}" -Atq -c "
    SELECT jsonb_build_object(
      'roles', (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id), '[]'::jsonb)
                FROM public.user_roles r),
      'admin', public.has_role('$TEST_ADMIN_USER_ID', 'admin'),
      'super_admin', public.has_role('$TEST_ADMIN_USER_ID', 'super_admin'))"
}

assert_admin_role_unchanged() {
  local expected="$1" label="$2" actual
  actual="$(admin_role_privileged_state)"
  if [[ "$actual" != "$expected" ]] ||
     ! jq -e --arg user "$TEST_ADMIN_USER_ID" \
       '.admin == false and .super_admin == false and
        all(.roles[]; .user_id != $user or (.role != "admin" and .role != "super_admin"))' \
       >/dev/null <<<"$actual"; then
    echo "Revoked admin changed stored roles or effective privileges via $label" >&2
    exit 1
  fi
}

test_admin_http_role_revocation() {
  local scope="${1:-all}"
  local versions status super_password super_token admin_token baseline user_role_id role payload method path
  # Refuse a partial schema: denial by a missing table/function is not evidence.
  versions="$(find "$(dirname "${BASH_SOURCE[0]}")/../supabase/migrations" \
    -name '*.sql' -printf '%f\n' | cut -d_ -f1 | sort -u | paste -sd,)"
  "${PSQL[@]}" >/dev/null <<SQL
DO \$\$
BEGIN
  IF EXISTS (
    SELECT 1 FROM unnest(string_to_array('$versions', ',')) expected(version)
    WHERE NOT EXISTS (
      SELECT 1 FROM supabase_migrations.schema_migrations applied
      WHERE applied.version = expected.version
    )
  ) THEN
    RAISE EXCEPTION 'Admin role HTTP test requires every repository migration';
  END IF;
  IF pg_get_function_arguments('public.grant_admin_role(uuid)'::regprocedure)
       <> '_target_user uuid' THEN
    RAISE EXCEPTION 'grant_admin_role signature changed; update the HTTP test payload';
  END IF;
END;
\$\$;
SQL

  # The active migration identifies the bootstrap super-admin by email,
  # not by inserting a super_admin role on an arbitrary account.
  super_password="$(openssl rand -hex 24)"
  status="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/super-admin-created.json" --write-out '%{http_code}' \
    --request POST "${TEST_SUPABASE_URL%/}/auth/v1/admin/users" \
    --header "apikey: $TEST_SUPABASE_SERVICE_ROLE_KEY" \
    --header "Authorization: Bearer $TEST_SUPABASE_SERVICE_ROLE_KEY" \
    --header 'Content-Type: application/json' \
    --data "$(jq -nc --arg password "$super_password" \
      '{email:"penshopx@gmail.com",password:$password,email_confirm:true}')")"
  if [[ "$status" != "200" ]] ||
     ! jq -e '.id | strings | test("^[0-9a-fA-F-]{36}$")' \
       "$TMP_DIR/super-admin-created.json" >/dev/null; then
    echo "Could not create disposable bootstrap super-admin (HTTP $status); use a clean local stack" >&2
    exit 1
  fi
  # Global so the runner's EXIT trap removes this Auth fixture even on failure.
  TEST_SUPER_ADMIN_USER_ID="$(jq -r '.id' "$TMP_DIR/super-admin-created.json")"
  status="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/super-admin-session.json" --write-out '%{http_code}' \
    --request POST "${TEST_SUPABASE_URL%/}/auth/v1/token?grant_type=password" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY" \
    --header 'Content-Type: application/json' \
    --data "$(jq -nc --arg password "$super_password" \
      '{email:"penshopx@gmail.com",password:$password}')")"
  if [[ "$status" != "200" ]] ||
     ! jq -e --arg super "$TEST_SUPER_ADMIN_USER_ID" --arg admin "$TEST_ADMIN_USER_ID" \
       '.user.id == $super and .user.id != $admin and
        (.access_token | type == "string" and length > 0)' \
       "$TMP_DIR/super-admin-session.json" >/dev/null; then
    echo "Could not obtain distinct bootstrap super-admin session (HTTP $status)" >&2
    exit 1
  fi
  super_token="$(jq -r '.access_token' "$TMP_DIR/super-admin-session.json")"
  unset super_password
  if [[ "$("${PSQL[@]}" -Atq -c "
    SELECT public.is_super_admin('$TEST_SUPER_ADMIN_USER_ID')
      AND NOT public.is_super_admin('$TEST_ADMIN_USER_ID')")" != "t" ]]; then
    echo "Role fixture does not match the active bootstrap super-admin definition" >&2
    exit 1
  fi

  payload="$(jq -nc --arg user "$TEST_ADMIN_USER_ID" '{_target_user:$user}')"
  # Positive control uses the exact endpoint, parameter and target attacked below.
  status="$(admin_role_http_request "$super_token" POST rpc/grant_admin_role "$payload")"
  if [[ "$status" != "200" && "$status" != "204" ]] ||
     [[ "$("${PSQL[@]}" -Atq -c "
       SELECT public.has_role('$TEST_ADMIN_USER_ID', 'admin') AND EXISTS (
         SELECT 1 FROM public.user_roles
         WHERE user_id = '$TEST_ADMIN_USER_ID' AND role = 'admin')")" != "t" ]]; then
    echo "Legitimate super-admin HTTP grant failed (HTTP $status)" >&2
    exit 1
  fi
  admin_token="$(assessment_admin_http_token)"
  status="$(admin_role_http_request "$admin_token" GET \
    "user_roles?user_id=eq.$TEST_ADMIN_USER_ID&role=eq.admin&select=user_id,role" '{}')"
  if [[ "$status" != "200" ]] ||
     ! jq -e --arg user "$TEST_ADMIN_USER_ID" '. == [{user_id:$user,role:"admin"}]' \
       "$TMP_DIR/admin-role-response.json" >/dev/null; then
    echo "Admin token did not have the granted role before revocation (HTTP $status)" >&2
    exit 1
  fi

  if [[ "$scope" != "revocation" ]]; then
    test_active_admin_http_role_escalation "$admin_token" "$super_token"
    if [[ "$scope" == "active" ]]; then
      # The parent EXIT trap removes all Auth users and their role rows.
      return
    fi
  fi

  # Commit revocation with the privileged fixture; keep the exact same token.
  # A real, visible user row ensures UPDATE is not a vacuous missing-row check.
  "${PSQL[@]}" >/dev/null <<SQL
BEGIN;
DELETE FROM public.user_roles
WHERE user_id = '$TEST_ADMIN_USER_ID' AND role = 'admin';
INSERT INTO public.user_roles (user_id, role)
VALUES ('$TEST_ADMIN_USER_ID', 'user')
ON CONFLICT (user_id, role) DO NOTHING;
COMMIT;
SQL
  user_role_id="$("${PSQL[@]}" -Atq -c "
    SELECT id FROM public.user_roles WHERE user_id = '$TEST_ADMIN_USER_ID' AND role = 'user'")"
  status="$(admin_role_http_request "$admin_token" GET \
    "user_roles?id=eq.$user_role_id&select=id,user_id,role" '{}')"
  if [[ "$status" != "200" ]] ||
     ! jq -e --arg id "$user_role_id" --arg user "$TEST_ADMIN_USER_ID" \
       '. == [{id:$id,user_id:$user,role:"user"}]' \
       "$TMP_DIR/admin-role-response.json" >/dev/null; then
    echo "Unchanged revoked token cannot read the existing UPDATE target (HTTP $status)" >&2
    exit 1
  fi
  baseline="$(admin_role_privileged_state)"
  assert_admin_role_unchanged "$baseline" "revocation fixture"
  for role in admin super_admin; do
    for method in POST PATCH; do
      path="user_roles"
      payload="$(jq -nc --arg user "$TEST_ADMIN_USER_ID" --arg role "$role" \
        '{user_id:$user,role:$role}')"
      if [[ "$method" == "PATCH" ]]; then
        path="user_roles?id=eq.$user_role_id&user_id=eq.$TEST_ADMIN_USER_ID"
        payload="$(jq -nc --arg role "$role" '{role:$role}')"
      fi
      status="$(admin_role_http_request "$admin_token" "$method" "$path" "$payload")"
      # PostgREST UPDATE with no applicable RLS policy succeeds with zero
      # affected rows. Require [] plus the privileged unchanged-row assertion.
      if [[ "$method" == "PATCH" && "$status" == "200" ]]; then
        jq -e '. == []' "$TMP_DIR/admin-role-response.json" >/dev/null || exit 1
      elif [[ "$status" != "403" ]] ||
           ! jq -e '.code == "42501" and
             (.message == "new row violates row-level security policy for table \"user_roles\"" or
              .message == "permission denied for table user_roles")' \
             "$TMP_DIR/admin-role-response.json" >/dev/null; then
        echo "Revoked admin $method to $role was not denied by role authorization (HTTP $status)" >&2
        exit 1
      fi
      assert_admin_role_unchanged "$baseline" "$method $role"
    done
  done
  payload="$(jq -nc --arg user "$TEST_ADMIN_USER_ID" '{_target_user:$user}')"
  status="$(admin_role_http_request "$admin_token" POST rpc/grant_admin_role "$payload")"
  if [[ "$status" != "400" ]] ||
     ! jq -e '. == {code:"P0001",details:null,hint:null,
       message:"Only the bootstrap super admin can grant admin access"}' \
       "$TMP_DIR/admin-role-response.json" >/dev/null; then
    echo "Revoked admin self-grant RPC did not fail for authorization (HTTP $status)" >&2
    exit 1
  fi
  assert_admin_role_unchanged "$baseline" "grant_admin_role"
  # Re-run the legitimate path after the attacks to rule out a broken endpoint.
  status="$(admin_role_http_request "$super_token" POST rpc/grant_admin_role "$payload")"
  if [[ "$status" != "200" && "$status" != "204" ]] ||
     [[ "$("${PSQL[@]}" -Atq -c "
       SELECT public.has_role('$TEST_ADMIN_USER_ID', 'admin')
         AND NOT public.has_role('$TEST_ADMIN_USER_ID', 'super_admin')
         AND EXISTS (SELECT 1 FROM public.user_roles
                     WHERE user_id = '$TEST_ADMIN_USER_ID' AND role = 'admin')")" != "t" ]]; then
    echo "Legitimate super-admin cannot restore admin after denied attacks (HTTP $status)" >&2
    exit 1
  fi
  "${PSQL[@]}" >/dev/null -c "
    DELETE FROM public.user_roles WHERE user_id = '$TEST_ADMIN_USER_ID' AND role IN ('admin', 'user');
    DELETE FROM auth.users WHERE id = '$TEST_SUPER_ADMIN_USER_ID'"
  echo "Revoked admin's unchanged Auth token could not INSERT/UPDATE admin or super_admin roles or self-grant via RPC; privileged rows stayed unchanged and legitimate super-admin grants succeeded."
}
