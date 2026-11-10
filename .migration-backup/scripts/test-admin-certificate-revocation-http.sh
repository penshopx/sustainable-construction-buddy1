#!/usr/bin/env bash
# Sourced by the local-only assessment runner. Fixture SQL is privileged;
# every HTTP read uses a real Auth session and only the anon API key.
assessment_certificate_state() {
  "${PSQL[@]}" -Atq -c "
    SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.id), '[]'::jsonb)
    FROM public.certificates c
    WHERE c.user_id IN ('$TEST_USER_ID', '$TEST_ADMIN_USER_ID')"
}

test_admin_http_certificate_revocation() {
  local versions admin_token before_state listing_before expected status phase filter
  local member_id="00000000-0000-4000-8000-000000000190"
  local own_id="00000000-0000-4000-8000-000000000191"
  versions="$(find "$(dirname "${BASH_SOURCE[0]}")/../supabase/migrations" \
    -name '*.sql' -printf '%f\n' | cut -d_ -f1 | sort -u | paste -sd,)"
  # Refuse a partial database rather than passing on a missing table/policy.
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
    RAISE EXCEPTION 'Certificate HTTP test requires every repository migration';
  END IF;
END;
\$\$;
BEGIN;
INSERT INTO public.user_roles (user_id, role)
VALUES ('$TEST_ADMIN_USER_ID', 'admin');
INSERT INTO public.certificates
  (id, user_id, level, certificate_number, full_name, module_name)
VALUES
  ('$member_id', '$TEST_USER_ID', 'Utama', 'HTTP-REVOCATION-MEMBER',
    'Certificate member fixture', 'Member module'),
  ('$own_id', '$TEST_ADMIN_USER_ID', 'Madya', 'HTTP-REVOCATION-ADMIN',
    'Certificate admin fixture', 'Admin module');
COMMIT;
DO \$\$
BEGIN
  IF NOT public.has_role('$TEST_ADMIN_USER_ID', 'admin'::public.app_role)
     OR (SELECT count(*) FROM public.certificates
         WHERE user_id IN ('$TEST_USER_ID', '$TEST_ADMIN_USER_ID')) <> 2 THEN
    RAISE EXCEPTION 'Certificate fixture requires an effective admin and two certificates';
  END IF;
END;
\$\$;
SQL
  admin_token="$(assessment_admin_http_token)"
  before_state="$(assessment_certificate_state)"
  listing_before="$("${PSQL[@]}" -Atq -c "
    SELECT COALESCE(jsonb_agg(to_jsonb(c) ORDER BY c.id), '[]'::jsonb)
    FROM public.certificates c")"

  for phase in active revoked; do
    if [[ "$phase" == revoked ]]; then
      # A separate committed fixture connection changes live role membership.
      # Never sign in again, refresh, or replace admin_token after this point.
      "${PSQL[@]}" >/dev/null <<SQL
BEGIN;
DELETE FROM public.user_roles
WHERE user_id = '$TEST_ADMIN_USER_ID' AND role = 'admin';
COMMIT;
DO \$\$
BEGIN
  IF public.has_role('$TEST_ADMIN_USER_ID', 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Certificate fixture still has effective admin access after COMMIT';
  END IF;
END;
\$\$;
SQL
    fi
    # Check targeted reads, a combined listing and an unfiltered table read.
    # Exact full-row equality rejects missing own data or extra member fields.
    for filter in "id=eq.$member_id" "id=eq.$own_id" \
      "id=in.($member_id,$own_id)" ""; do
      expected="$(jq -c --arg phase "$phase" --arg filter "$filter" \
        --arg own "$own_id" --arg member "$member_id" '
        map(select(
          (if $phase == "revoked" then .id == $own else true end) and
          (if $filter == ("id=eq." + $member) then .id == $member
           elif $filter == ("id=eq." + $own) then .id == $own
           else true end)))' \
        <<<"$(if [[ -z "$filter" ]]; then echo "$listing_before"; else echo "$before_state"; fi)")"
      status="$(curl --silent --show-error --max-time 15 --globoff \
        --output "$TMP_DIR/admin-certificate-response.json" --write-out '%{http_code}' \
        "${TEST_SUPABASE_URL%/}/rest/v1/certificates?${filter:+$filter&}select=*&order=id.asc" \
        --header "apikey: $TEST_SUPABASE_ANON_KEY" \
        --header "Authorization: Bearer $admin_token")"
      if [[ "$status" != "200" ]] ||
         ! jq -e --argjson expected "$expected" '. == $expected' \
           "$TMP_DIR/admin-certificate-response.json" >/dev/null 2>&1; then
        echo "Certificate HTTP $phase read ($filter) did not match allowed full rows (HTTP $status)" >&2
        exit 1
      fi
      if [[ "$(assessment_certificate_state)" != "$before_state" ]]; then
        echo "Certificate HTTP checks changed or removed a fixture certificate" >&2
        exit 1
      fi
    done
  done
  unset admin_token
  "${PSQL[@]}" >/dev/null -c "
    DELETE FROM public.certificates WHERE id IN ('$member_id', '$own_id')"
  echo "Admin HTTP read both certificates before COMMIT; after role revocation the identical Auth token hid the member certificate, retained the complete own certificate, and left both stored rows unchanged."
}
