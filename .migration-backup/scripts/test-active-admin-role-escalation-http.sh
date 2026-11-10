#!/usr/bin/env bash
# Sourced by the local-only assessment runner after the bootstrap super-admin
# has granted a real operational admin role and both actors have Auth sessions.
active_admin_role_state() {
  "${PSQL[@]}" -Atq -c "
    SELECT jsonb_build_object(
      'roles', (SELECT COALESCE(jsonb_agg(to_jsonb(r) ORDER BY r.id), '[]'::jsonb)
                FROM public.user_roles r),
      'actor_admin', public.has_role('$TEST_ADMIN_USER_ID', 'admin'),
      'actor_super', public.has_role('$TEST_ADMIN_USER_ID', 'super_admin'),
      'member_admin', public.has_role('$TEST_OTHER_USER_ID', 'admin'),
      'member_super', public.has_role('$TEST_OTHER_USER_ID', 'super_admin'),
      'bootstrap_admin', public.has_role('$TEST_SUPER_ADMIN_USER_ID', 'admin'),
      'bootstrap_super', public.has_role('$TEST_SUPER_ADMIN_USER_ID', 'super_admin'))"
}

assert_active_admin_roles_unchanged() {
  local expected="$1" label="$2" actual
  actual="$(active_admin_role_state)"
  if [[ "$actual" != "$expected" ]] ||
     ! jq -e '.actor_admin == true and .actor_super == false and
       .member_admin == false and .member_super == false and
       .bootstrap_admin == true and .bootstrap_super == true' >/dev/null <<<"$actual"; then
    echo "Active admin role state changed unexpectedly via $label" >&2
    exit 1
  fi
}

test_active_admin_http_role_escalation() {
  local admin_token="$1" super_token="$2"
  local baseline target role role_id status method path payload label
  # UPDATE must target an existing row visible through this exact admin token.
  # Use the admin's real admin row for self-promotion, and a member's user row
  # for delegation; neither attempt can fail merely due to a unique collision.
  "${PSQL[@]}" >/dev/null -c "
    INSERT INTO public.user_roles (user_id, role)
    VALUES ('$TEST_OTHER_USER_ID', 'user')
    ON CONFLICT (user_id, role) DO NOTHING"
  baseline="$(active_admin_role_state)"
  assert_active_admin_roles_unchanged "$baseline" "active fixture"
  for target in "$TEST_ADMIN_USER_ID" "$TEST_OTHER_USER_ID"; do
    if [[ "$target" == "$TEST_ADMIN_USER_ID" ]]; then
      role=super_admin
      label=self-promotion
      role_id="$("${PSQL[@]}" -Atq -c "
        SELECT id FROM public.user_roles WHERE user_id = '$target' AND role = 'admin'")"
    else
      role=admin
      label=member-delegation
      role_id="$("${PSQL[@]}" -Atq -c "
        SELECT id FROM public.user_roles WHERE user_id = '$target' AND role = 'user'")"
    fi
    status="$(admin_role_http_request "$admin_token" GET \
      "user_roles?id=eq.$role_id&select=id,user_id,role" '{}')"
    if [[ "$status" != "200" ]] ||
       ! jq -e --arg id "$role_id" --arg user "$target" --arg role "$role" \
         '. == [{id:$id,user_id:$user,role:(if $role == "super_admin" then "admin" else "user" end)}]' \
         "$TMP_DIR/admin-role-response.json" >/dev/null; then
      echo "Active admin cannot read the existing $label UPDATE target (HTTP $status)" >&2
      exit 1
    fi
    for method in POST PATCH; do
      path=user_roles
      payload="$(jq -nc --arg user "$target" --arg role "$role" '{user_id:$user,role:$role}')"
      if [[ "$method" == "PATCH" ]]; then
        path="user_roles?id=eq.$role_id&user_id=eq.$target"
        payload="$(jq -nc --arg role "$role" '{role:$role}')"
      fi
      status="$(admin_role_http_request "$admin_token" "$method" "$path" "$payload")"
      # No UPDATE policy means PostgREST returns 200/[] (zero rows), not 403.
      # Never accept an unrelated error (bad JWT, missing endpoint, constraint).
      if [[ "$method" == "PATCH" && "$status" == "200" ]]; then
        if ! jq -e '. == []' "$TMP_DIR/admin-role-response.json" >/dev/null; then
          echo "Active admin $label PATCH affected rows instead of being filtered by RLS" >&2
          exit 1
        fi
      elif [[ "$status" != "403" ]] ||
           ! jq -e '.code == "42501" and
             (.message == "new row violates row-level security policy for table \"user_roles\"" or
              .message == "permission denied for table user_roles")' \
             "$TMP_DIR/admin-role-response.json" >/dev/null; then
        echo "Active admin $label $method was not denied by authorization (HTTP $status)" >&2
        exit 1
      fi
      assert_active_admin_roles_unchanged "$baseline" "$label $method"
    done
    payload="$(jq -nc --arg user "$target" '{_target_user:$user}')"
    status="$(admin_role_http_request "$admin_token" POST rpc/grant_admin_role "$payload")"
    if [[ "$status" != "400" ]] ||
       ! jq -e '. == {code:"P0001",details:null,hint:null,
         message:"Only the bootstrap super admin can grant admin access"}' \
         "$TMP_DIR/admin-role-response.json" >/dev/null; then
      echo "Active admin $label RPC was not denied by authorization (HTTP $status)" >&2
      exit 1
    fi
    assert_active_admin_roles_unchanged "$baseline" "$label RPC"
  done

  # Repeat the exact member INSERT and RPC using the legitimate bootstrap
  # session. Both must actually grant the stored AND effective admin privilege.
  # UPDATE has no positive write control: the schema intentionally permits no
  # UPDATE policy on user_roles, even for the bootstrap super-admin.
  for path in user_roles rpc/grant_admin_role; do
    if [[ "$path" == user_roles ]]; then
      payload="$(jq -nc --arg user "$TEST_OTHER_USER_ID" '{user_id:$user,role:"admin"}')"
    else
      payload="$(jq -nc --arg user "$TEST_OTHER_USER_ID" '{_target_user:$user}')"
    fi
    status="$(admin_role_http_request "$super_token" POST "$path" "$payload")"
    if [[ "$status" != "200" && "$status" != "201" && "$status" != "204" ]] ||
       [[ "$("${PSQL[@]}" -Atq -c "
         SELECT public.has_role('$TEST_OTHER_USER_ID', 'admin')
           AND NOT public.has_role('$TEST_OTHER_USER_ID', 'super_admin')
           AND EXISTS (SELECT 1 FROM public.user_roles
             WHERE user_id = '$TEST_OTHER_USER_ID' AND role = 'admin')")" != t ]]; then
      echo "Bootstrap positive control failed to grant member admin via $path (HTTP $status)" >&2
      exit 1
    fi
    payload="$(jq -nc --arg user "$TEST_OTHER_USER_ID" '{_target_user:$user}')"
    status="$(admin_role_http_request "$super_token" POST rpc/revoke_admin_role "$payload")"
    if [[ "$status" != "200" && "$status" != "204" ]]; then
      echo "Bootstrap could not reset the positive control (HTTP $status)" >&2
      exit 1
    fi
    assert_active_admin_roles_unchanged "$baseline" "bootstrap control reset"
  done
  echo "Active admin: self-promotion and member delegation denied through INSERT, UPDATE and grant_admin_role; all stored roles and effective privileges unchanged. Bootstrap INSERT/RPC grants succeeded."
}
