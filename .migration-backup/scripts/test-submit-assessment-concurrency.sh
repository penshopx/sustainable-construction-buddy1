#!/usr/bin/env bash
set -euo pipefail

DATABASE_URL="${TEST_DATABASE_URL:-${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}}"
PSQL=(psql "$DATABASE_URL" -X -v ON_ERROR_STOP=1)
TEST_SUPABASE_URL="${TEST_SUPABASE_URL:-http://127.0.0.1:54321}"
TEST_SUPABASE_ANON_KEY="${TEST_SUPABASE_ANON_KEY:?Set TEST_SUPABASE_ANON_KEY to the local Supabase anon key}"
TEST_SUPABASE_SERVICE_ROLE_KEY="${TEST_SUPABASE_SERVICE_ROLE_KEY:?Set TEST_SUPABASE_SERVICE_ROLE_KEY to the local Supabase service role key}"
if [[ ! "$TEST_SUPABASE_URL" =~ ^http://(127\.0\.0\.1|localhost):[0-9]+/?$ ]]; then
  echo "Assessment HTTP fixture requires a local Supabase API URL" >&2
  exit 1
fi
if [[ ! "$DATABASE_URL" =~ ^postgres(ql)?://([^/@[:space:]]+@)?(127\.0\.0\.1|localhost):[0-9]+/[^?#[:space:]]+$ ]]; then
  echo "Assessment fixture requires a local Supabase database URL" >&2
  exit 1
fi
TMP_DIR="$(mktemp -d)"

TEST_USER_ID="00000000-0000-4000-8000-000000000161"
TEST_OTHER_USER_ID="00000000-0000-4000-8000-000000000169"
TEST_ADMIN_USER_ID="00000000-0000-4000-8000-000000000175"
TEST_SUPER_ADMIN_USER_ID="00000000-0000-4000-8000-000000000183"
TEST_DOMAIN_ID="00000000-0000-4000-8000-000000000162"
TEST_QUESTION_ID="00000000-0000-4000-8000-000000000163"
TEST_PRE_TEST_ID="00000000-0000-4000-8000-000000000164"
TEST_OLD_PRE_TEST_ID="00000000-0000-4000-8000-000000000165"
TEST_NEW_PRE_TEST_ID="00000000-0000-4000-8000-000000000166"
TEST_TIE_LOW_ID="00000000-0000-4000-8000-000000000167"
TEST_TIE_HIGH_ID="00000000-0000-4000-8000-000000000168"
TEST_OWNERSHIP_PRE_TEST_ID="00000000-0000-4000-8000-000000000170"
TEST_HTTP_PRE_TEST_ID="00000000-0000-4000-8000-000000000180"
TEST_EXPIRED_PRE_TEST_ID="00000000-0000-4000-8000-000000000181"
TEST_HTTP_EXPIRED_PRE_TEST_ID="00000000-0000-4000-8000-000000000186"
TEST_HTTP_EXPIRED_QUESTION_ID="00000000-0000-4000-8000-000000000187"

cleanup() {
  "${PSQL[@]}" >/dev/null 2>&1 <<SQL || true
DROP TRIGGER IF EXISTS assessment_http_answer_audit ON public.pre_test_answers;
DROP TRIGGER IF EXISTS assessment_http_completion_audit ON public.pre_tests;
DROP TRIGGER IF EXISTS assessment_http_profile_audit ON public.profiles;
DROP FUNCTION IF EXISTS public.record_assessment_http_write();
DROP TABLE IF EXISTS public.assessment_http_write_audit;
DROP TRIGGER IF EXISTS submit_assessment_concurrency_audit_trigger ON public.pre_tests;
DROP FUNCTION IF EXISTS public.record_submit_assessment_completion();
DROP TABLE IF EXISTS public.submit_assessment_concurrency_audit;
-- Certificates have no auth.users FK cascade; remove only this run's fixtures.
DELETE FROM public.certificates WHERE user_id IN ('$TEST_USER_ID', '$TEST_ADMIN_USER_ID');
DELETE FROM auth.users WHERE id IN ('$TEST_USER_ID', '$TEST_OTHER_USER_ID', '$TEST_ADMIN_USER_ID', '$TEST_SUPER_ADMIN_USER_ID');
DELETE FROM public.competency_domains WHERE id = '$TEST_DOMAIN_ID';
SQL
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

# Full privileged snapshots cannot hide writes behind the attacker's RLS view.
assessment_http_state() {
  local pre_test_id="${1:-$TEST_OWNERSHIP_PRE_TEST_ID}"
  "${PSQL[@]}" -Atq <<SQL
SELECT jsonb_build_object(
  'pre_test', (SELECT to_jsonb(pt) FROM public.pre_tests pt
               WHERE pt.id = '$pre_test_id'),
  'answers', (SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.id), '[]'::jsonb)
              FROM public.pre_test_answers a
              WHERE a.pre_test_id = '$pre_test_id'),
  'draft', (SELECT to_jsonb(ad) FROM public.assessment_drafts ad
            WHERE ad.pre_test_id = '$pre_test_id'),
  'profile', (SELECT to_jsonb(p) FROM public.profiles p
              WHERE p.user_id = '$TEST_USER_ID')
)::text;
SQL
}

# Seed the server snapshot before launching workers, never from a submit
# payload. Each fixture's expected choice is fixed even when replay/device
# payloads disagree. Use the assessment's own start time for historical cases.
seed_assessment_draft() {
  local pre_test_id="$1" answer="$2"
  "${PSQL[@]}" -v pre_test_id="$pre_test_id" -v answer="$answer" >/dev/null <<'SQL'
INSERT INTO public.assessment_drafts (pre_test_id, draft, updated_at)
SELECT id, jsonb_build_object(
  'version', 1, 'revision', 0, 'preTestId', id,
  'questions', (SELECT jsonb_agg(jsonb_build_object('id', q.id) ORDER BY q.position)
    FROM unnest(authorized_question_ids) WITH ORDINALITY q(id, position)),
  'answers', (SELECT jsonb_object_agg(q.id::text, :'answer'::integer)
    FROM unnest(authorized_question_ids) q(id)),
  'answerResults', '{}'::jsonb, 'phase', 'review'
), started_at
FROM public.pre_tests WHERE id = :'pre_test_id'::uuid;
SELECT set_config('test.seed_pre_test_id', :'pre_test_id', false);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.pre_tests pt
    JOIN public.assessment_drafts ad ON ad.pre_test_id = pt.id
    WHERE pt.id = current_setting('test.seed_pre_test_id')::uuid
      AND pt.status = 'in_progress' AND pt.completed_at IS NULL
      AND cardinality(pt.authorized_question_ids) = pt.total_questions
      AND public.validate_assessment_draft(ad.draft) IS TRUE
      AND public.assessment_question_ids(ad.draft->'questions') = pt.authorized_question_ids
      AND ad.updated_at < pt.deadline_at
      AND NOT EXISTS (SELECT 1 FROM public.pre_test_answers WHERE pre_test_id = pt.id)
  ) THEN
    RAISE EXCEPTION 'Scoring fixture requires a fixed roster and a valid pre-deadline server draft';
  END IF;
END;
$$;
SQL
}

cleanup

mkdir -p "$TMP_DIR"

# Create the owner through local Auth so HTTP submission and replay use a real password
# session rather than a JWT claim manually set on a privileged SQL connection.
OWNER_PASSWORD="$(openssl rand -hex 24)"
HTTP_STATUS="$(curl --silent --show-error --max-time 15 \
  --output "$TMP_DIR/owner-created.json" --write-out '%{http_code}' \
  --request POST "${TEST_SUPABASE_URL%/}/auth/v1/admin/users" \
  --header "apikey: $TEST_SUPABASE_SERVICE_ROLE_KEY" \
  --header "Authorization: Bearer $TEST_SUPABASE_SERVICE_ROLE_KEY" \
  --header 'Content-Type: application/json' \
  --data "$(jq -nc --arg password "$OWNER_PASSWORD" \
    '{email:"assessment-concurrency@example.invalid",password:$password,email_confirm:true}')")"
if [[ "$HTTP_STATUS" != "200" ]] ||
   ! jq -e '.id | strings | test("^[0-9a-fA-F-]{36}$")' "$TMP_DIR/owner-created.json" >/dev/null; then
  echo "Could not create the local assessment owner through Auth (HTTP $HTTP_STATUS)" >&2
  exit 1
fi
TEST_USER_ID="$(jq -r '.id' "$TMP_DIR/owner-created.json")"

# Create the stranger through Auth too; a manually inserted auth.users row
# cannot supply a real session token for the HTTP gateway check.
OTHER_PASSWORD="$(openssl rand -hex 24)"
HTTP_STATUS="$(curl --silent --show-error --max-time 15 \
  --output "$TMP_DIR/other-created.json" --write-out '%{http_code}' \
  --request POST "${TEST_SUPABASE_URL%/}/auth/v1/admin/users" \
  --header "apikey: $TEST_SUPABASE_SERVICE_ROLE_KEY" \
  --header "Authorization: Bearer $TEST_SUPABASE_SERVICE_ROLE_KEY" \
  --header 'Content-Type: application/json' \
  --data "$(jq -nc --arg password "$OTHER_PASSWORD" \
    '{email:"assessment-other-user@example.invalid",password:$password,email_confirm:true}')")"
if [[ "$HTTP_STATUS" != "200" ]] ||
   ! jq -e '.id | strings | test("^[0-9a-fA-F-]{36}$")' "$TMP_DIR/other-created.json" >/dev/null; then
  echo "Could not create the local assessment stranger through Auth (HTTP $HTTP_STATUS)" >&2
  exit 1
fi
TEST_OTHER_USER_ID="$(jq -r '.id' "$TMP_DIR/other-created.json")"

# The admin needs a real Auth identity for unfinished submission and replay checks.
ADMIN_PASSWORD="$(openssl rand -hex 24)"
HTTP_STATUS="$(curl --silent --show-error --max-time 15 \
  --output "$TMP_DIR/admin-created.json" --write-out '%{http_code}' \
  --request POST "${TEST_SUPABASE_URL%/}/auth/v1/admin/users" \
  --header "apikey: $TEST_SUPABASE_SERVICE_ROLE_KEY" \
  --header "Authorization: Bearer $TEST_SUPABASE_SERVICE_ROLE_KEY" \
  --header 'Content-Type: application/json' \
  --data "$(jq -nc --arg password "$ADMIN_PASSWORD" \
    '{email:"assessment-admin@example.invalid",password:$password,email_confirm:true}')")"
if [[ "$HTTP_STATUS" != "200" ]] ||
   ! jq -e '.id | strings | test("^[0-9a-fA-F-]{36}$")' "$TMP_DIR/admin-created.json" >/dev/null; then
  echo "Could not create the local assessment admin through Auth (HTTP $HTTP_STATUS)" >&2
  exit 1
fi
TEST_ADMIN_USER_ID="$(jq -r '.id' "$TMP_DIR/admin-created.json")"

source "$(dirname "${BASH_SOURCE[0]}")/test-submit-assessment-admin-http.sh"
source "$(dirname "${BASH_SOURCE[0]}")/test-admin-role-revocation-http.sh"
source "$(dirname "${BASH_SOURCE[0]}")/test-active-admin-role-escalation-http.sh"
source "$(dirname "${BASH_SOURCE[0]}")/test-admin-certificate-revocation-http.sh"
if [[ -z "${1:-}" || "${1:-}" == "--admin-certificate-revocation" ]]; then
  test_admin_http_certificate_revocation
  if [[ "${1:-}" == "--admin-certificate-revocation" ]]; then
    exit 0
  fi
fi
if [[ -z "${1:-}" || "${1:-}" == "--admin-role-revocation" || "${1:-}" == "--admin-role-escalation" ]]; then
  if [[ "${1:-}" == "--admin-role-escalation" ]]; then
    test_admin_http_role_revocation active
    exit 0
  elif [[ "${1:-}" == "--admin-role-revocation" ]]; then
    test_admin_http_role_revocation revocation
  else
    test_admin_http_role_revocation
  fi
  if [[ "${1:-}" == "--admin-role-revocation" ]]; then
    exit 0
  fi
fi

"${PSQL[@]}" >/dev/null <<SQL
INSERT INTO public.competency_domains (id, name)
VALUES ('$TEST_DOMAIN_ID', 'Assessment concurrency test');

INSERT INTO public.questions (
  id, domain_id, question_text, options, correct_answer
)
VALUES (
  '$TEST_QUESTION_ID',
  '$TEST_DOMAIN_ID',
  'Concurrency test question',
  '["A", "B"]'::jsonb,
  1
);

INSERT INTO public.pre_tests (id, user_id, total_questions, authorized_question_ids)
VALUES ('$TEST_PRE_TEST_ID', '$TEST_USER_ID', 1, ARRAY['$TEST_QUESTION_ID'::uuid]);

CREATE TABLE public.submit_assessment_concurrency_audit (
  pre_test_id uuid NOT NULL,
  old_completed_at timestamptz,
  new_completed_at timestamptz NOT NULL
);

CREATE FUNCTION public.record_submit_assessment_completion()
RETURNS trigger
LANGUAGE plpgsql
AS \$\$
BEGIN
  IF NEW.id = '$TEST_PRE_TEST_ID'::uuid
     AND NEW.completed_at IS DISTINCT FROM OLD.completed_at THEN
    INSERT INTO public.submit_assessment_concurrency_audit (
      pre_test_id, old_completed_at, new_completed_at
    )
    VALUES (NEW.id, OLD.completed_at, NEW.completed_at);
  END IF;
  RETURN NEW;
END;
\$\$;

CREATE TRIGGER submit_assessment_concurrency_audit_trigger
AFTER UPDATE ON public.pre_tests
FOR EACH ROW
EXECUTE FUNCTION public.record_submit_assessment_completion();
SQL
seed_assessment_draft "$TEST_PRE_TEST_ID" 1

# Independently runnable on the latest complete schema, even if an earlier
# legacy concurrency scenario fails before reaching the admin HTTP checks.
if [[ "${1:-}" != "--expired-http-concurrency" && "${1:-}" != "--admin-http-concurrency" ]]; then
  test_admin_http_profile_revocation
fi
if [[ "${1:-}" == "--admin-profile-revocation" ]]; then
  exit 0
fi

if [[ "${1:-}" == "--admin-draft-privacy" ]]; then
  "${PSQL[@]}" >/dev/null <<SQL
INSERT INTO public.pre_tests (id, user_id, total_questions, authorized_question_ids)
VALUES ('$TEST_OWNERSHIP_PRE_TEST_ID', '$TEST_USER_ID', 1, ARRAY['$TEST_QUESTION_ID'::uuid]);
SQL
  HTTP_STATUS="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/owner-session.json" --write-out '%{http_code}' \
    --request POST "${TEST_SUPABASE_URL%/}/auth/v1/token?grant_type=password" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY" \
    --header 'Content-Type: application/json' \
    --data "$(jq -nc --arg password "$OWNER_PASSWORD" \
      '{email:"assessment-concurrency@example.invalid",password:$password}')")"
  unset OWNER_PASSWORD
  if [[ "$HTTP_STATUS" != "200" ]] ||
     ! jq -e --arg owner "$TEST_USER_ID" \
       '.user.id == $owner and (.access_token | type) == "string" and (.access_token | length) > 0' \
       "$TMP_DIR/owner-session.json" >/dev/null; then
    echo "Could not obtain the draft owner's real Auth session (HTTP $HTTP_STATUS)" >&2
    exit 1
  fi
  OWNER_TOKEN="$(jq -r '.access_token' "$TMP_DIR/owner-session.json")"
  test_admin_http_unfinished
  exit 0
fi

# Dedicated privacy/concurrency modes skip unrelated scenarios; the default
# run exercises all fixtures against the same current question-authority schema.
if [[ "${1:-}" != "--expired-draft-privacy" && "${1:-}" != "--expired-http-concurrency" && "${1:-}" != "--admin-http-concurrency" ]]; then
# Hold the target row so both submit statements are active and waiting before
# either can complete. Releasing this transaction lets PostgreSQL serialize them.
"${PSQL[@]}" >/dev/null <<SQL &
BEGIN;
SELECT 1 FROM public.pre_tests WHERE id = '$TEST_PRE_TEST_ID' FOR UPDATE;
SELECT /* submit_assessment_concurrency_locker */ pg_sleep(5);
COMMIT;
SQL
LOCKER_PID=$!

LOCK_READY="f"
for _ in {1..100}; do
  LOCK_READY="$("${PSQL[@]}" -Atq -c "
    SELECT EXISTS (
      SELECT 1
      FROM pg_stat_activity
      WHERE query LIKE '%submit_assessment_concurrency_locker%'
        AND query NOT LIKE '%pg_stat_activity%'
        AND state = 'active'
    )
  ")"
  [[ "$LOCK_READY" == "t" ]] && break
  sleep 0.02
done

if [[ "$LOCK_READY" != "t" ]]; then
  echo "Failed to acquire the coordinating row lock." >&2
  exit 1
fi

submit() {
  local selected_answer="$1"
  local label="$2"
  "${PSQL[@]}" -Atq <<SQL
BEGIN;
SELECT set_config('request.jwt.claim.sub', '$TEST_USER_ID', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT /* submit_assessment_concurrency:$label */ public.submit_assessment(
  '$TEST_PRE_TEST_ID',
  jsonb_build_array(jsonb_build_object(
    'question_id', '$TEST_QUESTION_ID',
    'selected_answer', $selected_answer
  ))
)::text;
COMMIT;
SQL
}

submit 1 first >"$TMP_DIR/first.out" &
FIRST_PID=$!
submit 0 second >"$TMP_DIR/second.out" &
SECOND_PID=$!

CONCURRENT_CALLS=0
for _ in {1..100}; do
  CONCURRENT_CALLS="$("${PSQL[@]}" -Atq -c "
    SELECT count(*)
    FROM pg_stat_activity
    WHERE query LIKE '%submit_assessment_concurrency:%'
      AND query NOT LIKE '%pg_stat_activity%'
      AND state = 'active'
  ")"
  [[ "$CONCURRENT_CALLS" == "2" ]] && break
  sleep 0.02
done

if [[ "$CONCURRENT_CALLS" != "2" ]]; then
  echo "Expected two submit_assessment calls to be active concurrently; observed $CONCURRENT_CALLS." >&2
  exit 1
fi

wait "$LOCKER_PID"
wait "$FIRST_PID"
wait "$SECOND_PID"

FIRST_RESULT="$(grep '^{' "$TMP_DIR/first.out")"
SECOND_RESULT="$(grep '^{' "$TMP_DIR/second.out")"

if [[ "$FIRST_RESULT" != "$SECOND_RESULT" ]] ||
   ! jq -e '. == {"score":100,"level":"Utama","correct":1,"total":1}' \
     <<<"$FIRST_RESULT" >/dev/null; then
  printf 'Concurrent submissions returned different results:\nfirst: %s\nsecond: %s\n' \
    "$FIRST_RESULT" "$SECOND_RESULT" >&2
  exit 1
fi

"${PSQL[@]}" -v expected_result="$FIRST_RESULT" >/dev/null <<SQL
SELECT set_config('test.expected_result', :'expected_result', false);
DO \$\$
DECLARE
  result jsonb := current_setting('test.expected_result')::jsonb;
  answer_count integer;
  completion_write_count integer;
  stored_answer integer;
  final_completed_at timestamptz;
  audited_completed_at timestamptz;
BEGIN
  SELECT count(*)::integer, min(selected_answer)
  INTO answer_count, stored_answer
  FROM public.pre_test_answers
  WHERE pre_test_id = '$TEST_PRE_TEST_ID';

  IF answer_count <> 1 OR stored_answer IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Concurrent submissions created % answer rows instead of 1',
      answer_count;
  END IF;

  IF (stored_answer = 1) IS DISTINCT FROM ((result->>'score')::integer = 100) THEN
    RAISE EXCEPTION 'Stored answer does not match the shared result: answer %, result %',
      stored_answer, result;
  END IF;

  SELECT count(*)::integer, max(new_completed_at)
  INTO completion_write_count, audited_completed_at
  FROM public.submit_assessment_concurrency_audit
  WHERE pre_test_id = '$TEST_PRE_TEST_ID';

  SELECT completed_at
  INTO final_completed_at
  FROM public.pre_tests
  WHERE id = '$TEST_PRE_TEST_ID';

  IF NOT EXISTS (
    SELECT 1 FROM public.pre_tests WHERE id = '$TEST_PRE_TEST_ID'
      AND status = 'completed' AND completed_at IS NOT NULL
      AND score = 100 AND correct_answers = 1 AND total_questions = 1
      AND determined_level = 'Utama'
  ) THEN
    RAISE EXCEPTION 'Concurrent SQL submissions did not score the saved server draft';
  END IF;

  IF completion_write_count <> 1 THEN
    RAISE EXCEPTION 'completed_at was written % times instead of once',
      completion_write_count;
  END IF;

  IF final_completed_at IS DISTINCT FROM audited_completed_at THEN
    RAISE EXCEPTION 'Final completed_at differs from the original completion timestamp';
  END IF;
END;
\$\$;
SQL

# The newer-started assessment must own the profile even when the older one
# commits later. These submits use separate psql processes/connections.
"${PSQL[@]}" >/dev/null <<SQL
DELETE FROM public.pre_tests WHERE id = '$TEST_PRE_TEST_ID';

INSERT INTO public.pre_tests (id, user_id, total_questions, started_at, authorized_question_ids)
VALUES
  ('$TEST_OLD_PRE_TEST_ID', '$TEST_USER_ID', 1, '2026-09-10 10:00:00+00', ARRAY['$TEST_QUESTION_ID'::uuid]),
  ('$TEST_NEW_PRE_TEST_ID', '$TEST_USER_ID', 1, '2026-09-10 10:05:00+00', ARRAY['$TEST_QUESTION_ID'::uuid]);
SQL
seed_assessment_draft "$TEST_OLD_PRE_TEST_ID" 0
seed_assessment_draft "$TEST_NEW_PRE_TEST_ID" 1

"${PSQL[@]}" >/dev/null <<SQL &
BEGIN;
SELECT 1 FROM public.pre_tests WHERE id = '$TEST_OLD_PRE_TEST_ID' FOR UPDATE;
SELECT /* submit_assessment_cross_pretest_locker */ pg_sleep(5);
COMMIT;
SQL
CROSS_LOCKER_PID=$!

CROSS_LOCK_READY="f"
for _ in {1..100}; do
  CROSS_LOCK_READY="$("${PSQL[@]}" -Atq -c "
    SELECT EXISTS (
      SELECT 1
      FROM pg_stat_activity
      WHERE query LIKE '%submit_assessment_cross_pretest_locker%'
        AND query NOT LIKE '%pg_stat_activity%'
        AND state = 'active'
    )
  ")"
  [[ "$CROSS_LOCK_READY" == "t" ]] && break
  sleep 0.02
done

if [[ "$CROSS_LOCK_READY" != "t" ]]; then
  echo "Failed to acquire the cross-pre-test coordinating row lock." >&2
  exit 1
fi

submit_pre_test() {
  local pre_test_id="$1"
  local selected_answer="$2"
  local label="$3"
  "${PSQL[@]}" -Atq <<SQL
BEGIN;
SELECT set_config('request.jwt.claim.sub', '$TEST_USER_ID', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
SELECT /* submit_assessment_cross_pretest:$label */ public.submit_assessment(
  '$pre_test_id',
  jsonb_build_array(jsonb_build_object(
    'question_id', '$TEST_QUESTION_ID',
    'selected_answer', $selected_answer
  ))
)::text;
COMMIT;
SQL
}

# The older assessment is deliberately blocked so the newer assessment commits
# first. Without the per-user winner rule, the older score would overwrite it.
submit_pre_test "$TEST_OLD_PRE_TEST_ID" 0 older >"$TMP_DIR/older.out" &
OLDER_PID=$!

OLDER_ACTIVE="f"
for _ in {1..100}; do
  OLDER_ACTIVE="$("${PSQL[@]}" -Atq -c "
    SELECT EXISTS (
      SELECT 1
      FROM pg_stat_activity
      WHERE query LIKE '%submit_assessment_cross_pretest:older%'
        AND query NOT LIKE '%pg_stat_activity%'
        AND state = 'active'
    )
  ")"
  [[ "$OLDER_ACTIVE" == "t" ]] && break
  sleep 0.02
done

if [[ "$OLDER_ACTIVE" != "t" ]]; then
  echo "The older assessment submit did not become active." >&2
  exit 1
fi

submit_pre_test "$TEST_NEW_PRE_TEST_ID" 1 newer >"$TMP_DIR/newer.out" &
NEWER_PID=$!
wait "$NEWER_PID"

if ! kill -0 "$OLDER_PID" 2>/dev/null; then
  echo "Test setup invalid: the older assessment did not remain blocked until the newer assessment completed." >&2
  exit 1
fi

wait "$CROSS_LOCKER_PID"
wait "$OLDER_PID"

"${PSQL[@]}" >/dev/null <<SQL
DO \$\$
DECLARE
  profile_level text;
  profile_score integer;
BEGIN
  SELECT current_level, total_score
  INTO profile_level, profile_score
  FROM public.profiles
  WHERE user_id = '$TEST_USER_ID';

  IF profile_level IS DISTINCT FROM 'Utama' OR profile_score IS DISTINCT FROM 100 THEN
    RAISE EXCEPTION
      'Profile followed the wrong assessment: level %, score %; expected Utama, 100',
      profile_level, profile_score;
  END IF;
END;
\$\$;
SQL

# Both assessments are now completed. Replaying the older one with a different
# answer must return its original result without changing either stored data or
# the profile owned by the newer-started assessment.
OLDER_RESULT="$(grep '^{' "$TMP_DIR/older.out")"
NEWER_RESULT="$(grep '^{' "$TMP_DIR/newer.out")"
if ! jq -e '. == {"score":0,"level":"Pemula","correct":0,"total":1}' \
     <<<"$OLDER_RESULT" >/dev/null ||
   ! jq -e '. == {"score":100,"level":"Utama","correct":1,"total":1}' \
     <<<"$NEWER_RESULT" >/dev/null; then
  printf 'Cross-pre-test submissions did not produce distinct results:\nolder: %s\nnewer: %s\n' \
    "$OLDER_RESULT" "$NEWER_RESULT" >&2
  exit 1
fi

OLDER_COMPLETED_AT="$("${PSQL[@]}" -Atq -c "
  SELECT completed_at FROM public.pre_tests WHERE id = '$TEST_OLD_PRE_TEST_ID'
")"
submit_pre_test "$TEST_OLD_PRE_TEST_ID" 1 older_replay >"$TMP_DIR/older-replay.out"
OLDER_REPLAY_RESULT="$(grep '^{' "$TMP_DIR/older-replay.out")"
if [[ "$OLDER_REPLAY_RESULT" != "$OLDER_RESULT" ]]; then
  printf 'Replaying the older assessment changed its result:\noriginal: %s\nreplay: %s\n' \
    "$OLDER_RESULT" "$OLDER_REPLAY_RESULT" >&2
  exit 1
fi

"${PSQL[@]}" -v older_completed_at="$OLDER_COMPLETED_AT" >/dev/null <<SQL
SELECT set_config('test.older_completed_at', :'older_completed_at', false);
DO \$\$
DECLARE
  older_started_at timestamptz;
  newer_started_at timestamptz;
  older_completed_at timestamptz;
  older_score integer;
  newer_score integer;
  older_level text;
  profile_level text;
  profile_score integer;
  answer_count integer;
  stored_answer integer;
BEGIN
  SELECT started_at, completed_at, score, determined_level
  INTO older_started_at, older_completed_at, older_score, older_level
  FROM public.pre_tests
  WHERE id = '$TEST_OLD_PRE_TEST_ID' AND user_id = '$TEST_USER_ID' AND status = 'completed';

  SELECT started_at, score
  INTO newer_started_at, newer_score
  FROM public.pre_tests
  WHERE id = '$TEST_NEW_PRE_TEST_ID' AND user_id = '$TEST_USER_ID' AND status = 'completed';

  IF older_started_at IS NULL OR newer_started_at IS NULL
     OR older_started_at >= newer_started_at
     OR older_score IS DISTINCT FROM 0 OR newer_score IS DISTINCT FROM 100
     OR older_level IS DISTINCT FROM 'Pemula'
     OR older_completed_at IS DISTINCT FROM current_setting('test.older_completed_at')::timestamptz THEN
    RAISE EXCEPTION 'Replayed assessment changed or the distinct completed assessments were not set up correctly';
  END IF;

  SELECT count(*)::integer, min(selected_answer)
  INTO answer_count, stored_answer
  FROM public.pre_test_answers
  WHERE pre_test_id = '$TEST_OLD_PRE_TEST_ID';
  IF answer_count <> 1 OR stored_answer IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'Replaying the older assessment changed its saved answer: count %, answer %',
      answer_count, stored_answer;
  END IF;

  SELECT current_level, total_score
  INTO profile_level, profile_score
  FROM public.profiles
  WHERE user_id = '$TEST_USER_ID';
  IF profile_level IS DISTINCT FROM 'Utama' OR profile_score IS DISTINCT FROM 100 THEN
    RAISE EXCEPTION 'Replaying the older assessment changed the profile: level %, score %',
      profile_level, profile_score;
  END IF;
END;
\$\$;
SQL

# Both assessments start at exactly the same time. The higher UUID must own
# the profile regardless of which transaction finishes last.
run_tie_case() {
  local blocked_id="$1"
  local first_id="$2"
  local label="$3"
  local blocked_answer first_answer
  local lock_ready="f"
  local blocked_active="f"

  if [[ "$blocked_id" == "$TEST_TIE_HIGH_ID" ]]; then
    blocked_answer=1
    first_answer=0
  else
    blocked_answer=0
    first_answer=1
  fi

  "${PSQL[@]}" >/dev/null <<SQL
DELETE FROM public.pre_tests WHERE id IN ('$TEST_TIE_LOW_ID', '$TEST_TIE_HIGH_ID');
INSERT INTO public.pre_tests (id, user_id, total_questions, started_at, authorized_question_ids)
VALUES
  ('$TEST_TIE_LOW_ID', '$TEST_USER_ID', 1, '2026-09-10 11:00:00+00', ARRAY['$TEST_QUESTION_ID'::uuid]),
  ('$TEST_TIE_HIGH_ID', '$TEST_USER_ID', 1, '2026-09-10 11:00:00+00', ARRAY['$TEST_QUESTION_ID'::uuid]);
UPDATE public.profiles
SET current_level = 'Pemula', total_score = 0
WHERE user_id = '$TEST_USER_ID';
SQL
  seed_assessment_draft "$TEST_TIE_LOW_ID" 0
  seed_assessment_draft "$TEST_TIE_HIGH_ID" 1

  "${PSQL[@]}" >/dev/null <<SQL &
BEGIN;
SELECT 1 FROM public.pre_tests WHERE id = '$blocked_id' FOR UPDATE;
SELECT /* submit_assessment_tie_locker:$label */ pg_sleep(5);
COMMIT;
SQL
  local locker_pid=$!

  for _ in {1..100}; do
    lock_ready="$("${PSQL[@]}" -Atq -c "
      SELECT EXISTS (
        SELECT 1 FROM pg_stat_activity
        WHERE query LIKE '%submit_assessment_tie_locker:$label%'
          AND query NOT LIKE '%pg_stat_activity%'
          AND state = 'active'
      )
    ")"
    [[ "$lock_ready" == "t" ]] && break
    sleep 0.02
  done
  if [[ "$lock_ready" != "t" ]]; then
    echo "Failed to acquire the tie-case row lock ($label)." >&2
    exit 1
  fi

  submit_pre_test "$blocked_id" "$blocked_answer" "tie_blocked_$label" >"$TMP_DIR/tie-blocked-$label.out" &
  local blocked_pid=$!

  for _ in {1..100}; do
    blocked_active="$("${PSQL[@]}" -Atq -c "
      SELECT EXISTS (
        SELECT 1 FROM pg_stat_activity
        WHERE query LIKE '%submit_assessment_cross_pretest:tie_blocked_$label%'
          AND query NOT LIKE '%pg_stat_activity%'
          AND state = 'active'
      )
    ")"
    [[ "$blocked_active" == "t" ]] && break
    sleep 0.02
  done
  if [[ "$blocked_active" != "t" ]]; then
    echo "Blocked tie-case submit did not become active ($label)." >&2
    exit 1
  fi

  submit_pre_test "$first_id" "$first_answer" "tie_first_$label" >"$TMP_DIR/tie-first-$label.out" &
  local first_pid=$!
  wait "$first_pid"

  if ! kill -0 "$blocked_pid" 2>/dev/null; then
    echo "Tie-case setup invalid: blocked submit finished before the first one ($label)." >&2
    exit 1
  fi

  wait "$locker_pid"
  wait "$blocked_pid"

  local low_result high_result
  if [[ "$blocked_id" == "$TEST_TIE_LOW_ID" ]]; then
    low_result="$(grep '^{' "$TMP_DIR/tie-blocked-$label.out")"
    high_result="$(grep '^{' "$TMP_DIR/tie-first-$label.out")"
  else
    low_result="$(grep '^{' "$TMP_DIR/tie-first-$label.out")"
    high_result="$(grep '^{' "$TMP_DIR/tie-blocked-$label.out")"
  fi
  if ! jq -e '. == {"score":0,"level":"Pemula","correct":0,"total":1}' \
       <<<"$low_result" >/dev/null ||
     ! jq -e '. == {"score":100,"level":"Utama","correct":1,"total":1}' \
       <<<"$high_result" >/dev/null; then
    echo "Tie-case submissions did not score both saved drafts ($label)." >&2
    exit 1
  fi

  "${PSQL[@]}" >/dev/null <<SQL
DO \$\$
DECLARE
  profile_level text;
  profile_score integer;
  completed_count integer;
  shared_start_count integer;
  low_score integer;
  high_score integer;
BEGIN
  SELECT count(*), count(DISTINCT started_at)
  INTO completed_count, shared_start_count
  FROM public.pre_tests
  WHERE id IN ('$TEST_TIE_LOW_ID', '$TEST_TIE_HIGH_ID')
    AND user_id = '$TEST_USER_ID'
    AND status = 'completed';

  IF completed_count <> 2 OR shared_start_count <> 1 THEN
    RAISE EXCEPTION 'Tie-case assessments were not both completed with identical started_at (%)',
      '$label';
  END IF;

  SELECT score INTO low_score FROM public.pre_tests WHERE id = '$TEST_TIE_LOW_ID';
  SELECT score INTO high_score FROM public.pre_tests WHERE id = '$TEST_TIE_HIGH_ID';
  IF low_score IS DISTINCT FROM 0 OR high_score IS DISTINCT FROM 100 THEN
    RAISE EXCEPTION 'Tie-case assessment scores incorrect (%): low %, high %',
      '$label', low_score, high_score;
  END IF;

  SELECT current_level, total_score
  INTO profile_level, profile_score
  FROM public.profiles
  WHERE user_id = '$TEST_USER_ID';

  IF profile_level IS DISTINCT FROM 'Utama' OR profile_score IS DISTINCT FROM 100 THEN
    RAISE EXCEPTION
      'Tie-case profile followed wrong ID (%): level %, score %; expected Utama, 100 from %',
      '$label', profile_level, profile_score, '$TEST_TIE_HIGH_ID';
  END IF;
END;
\$\$;
SQL
}

# Higher ID finishes last, then higher ID finishes first.
run_tie_case "$TEST_TIE_HIGH_ID" "$TEST_TIE_LOW_ID" high_last
run_tie_case "$TEST_TIE_LOW_ID" "$TEST_TIE_HIGH_ID" high_first

# A different authenticated user must not be able to submit the owner's
# unfinished assessment. Compare complete rows before and after the attempt,
# then prove the owner can still submit the same pre-test successfully.
"${PSQL[@]}" >/dev/null <<SQL
INSERT INTO public.pre_tests (id, user_id, total_questions, authorized_question_ids)
VALUES ('$TEST_OWNERSHIP_PRE_TEST_ID', '$TEST_USER_ID', 1, ARRAY['$TEST_QUESTION_ID'::uuid]);

-- test_admin_http_draft_privacy seeds this owner's valid draft before the
-- first owner HTTP submission; do not insert a duplicate snapshot here.

UPDATE public.profiles
SET current_level = 'Muda', total_score = 73
WHERE user_id = '$TEST_USER_ID';

DO \$\$
DECLARE
  before_pre_test jsonb;
  before_profile jsonb;
  attacker_result jsonb;
  answer_count integer;
BEGIN
  SELECT to_jsonb(pt) INTO STRICT before_pre_test
  FROM public.pre_tests pt WHERE pt.id = '$TEST_OWNERSHIP_PRE_TEST_ID';
  SELECT to_jsonb(p) INTO STRICT before_profile
  FROM public.profiles p WHERE p.user_id = '$TEST_USER_ID';

  PERFORM set_config('request.jwt.claim.sub', '$TEST_OTHER_USER_ID', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  attacker_result := public.submit_assessment(
    '$TEST_OWNERSHIP_PRE_TEST_ID',
    jsonb_build_array(jsonb_build_object(
      'question_id', '$TEST_QUESTION_ID',
      'selected_answer', 0
    ))
  );

  IF attacker_result IS DISTINCT FROM '{"error":"Unauthorized"}'::jsonb THEN
    RAISE EXCEPTION 'Submitting another user''s pre-test returned %, expected Unauthorized',
      attacker_result;
  END IF;

  SELECT count(*) INTO answer_count
  FROM public.pre_test_answers WHERE pre_test_id = '$TEST_OWNERSHIP_PRE_TEST_ID';
  IF answer_count <> 0 THEN
    RAISE EXCEPTION 'Unauthorized submission saved % answers', answer_count;
  END IF;

  IF (SELECT to_jsonb(pt) FROM public.pre_tests pt
      WHERE pt.id = '$TEST_OWNERSHIP_PRE_TEST_ID') IS DISTINCT FROM before_pre_test THEN
    RAISE EXCEPTION 'Unauthorized submission changed the owner''s pre-test';
  END IF;
  IF (SELECT to_jsonb(p) FROM public.profiles p
      WHERE p.user_id = '$TEST_USER_ID') IS DISTINCT FROM before_profile THEN
    RAISE EXCEPTION 'Unauthorized submission changed the owner''s profile';
  END IF;
END;
\$\$;
SQL

fi

# Obtain a real owner session before the first submission. Unlike a replay of
# an already completed assessment, this exercises scoring and writes through
# PostgREST with the authenticated role, not a privileged SQL connection.
HTTP_STATUS="$(curl --silent --show-error --max-time 15 \
  --output "$TMP_DIR/owner-session.json" --write-out '%{http_code}' \
  --request POST "${TEST_SUPABASE_URL%/}/auth/v1/token?grant_type=password" \
  --header "apikey: $TEST_SUPABASE_ANON_KEY" \
  --header 'Content-Type: application/json' \
  --data "$(jq -nc --arg password "$OWNER_PASSWORD" \
    '{email:"assessment-concurrency@example.invalid",password:$password}')")"
unset OWNER_PASSWORD
if [[ "$HTTP_STATUS" != "200" ]] ||
   ! jq -e --arg owner "$TEST_USER_ID" \
     '.user.id == $owner and (.access_token | type) == "string" and (.access_token | length) > 0' \
     "$TMP_DIR/owner-session.json" >/dev/null; then
  echo "Could not obtain the local assessment owner's Auth session (HTTP $HTTP_STATUS)" >&2
  exit 1
fi
OWNER_TOKEN="$(jq -r '.access_token' "$TMP_DIR/owner-session.json")"

# This is two overlapping first submissions, not a lost-response replay.
source "$(dirname "${BASH_SOURCE[0]}")/test-submit-assessment-http-concurrency.sh"
if [[ "${1:-}" == "--admin-http-concurrency" ]]; then
  test_admin_http_concurrent_submit
  exit 0
fi
if [[ "${1:-}" == "--expired-http-concurrency" ]]; then
  test_concurrent_http_submissions expired
  exit 0
fi

# Sign in the stranger before the owner's first submission, so both the
# unfinished submission and completed replay use a real, distinct Auth session.
HTTP_STATUS="$(curl --silent --show-error --max-time 15 \
  --output "$TMP_DIR/other-session.json" --write-out '%{http_code}' \
  --request POST "${TEST_SUPABASE_URL%/}/auth/v1/token?grant_type=password" \
  --header "apikey: $TEST_SUPABASE_ANON_KEY" \
  --header 'Content-Type: application/json' \
  --data "$(jq -nc --arg password "$OTHER_PASSWORD" \
    '{email:"assessment-other-user@example.invalid",password:$password}')")"
unset OTHER_PASSWORD
if [[ "$HTTP_STATUS" != "200" ]] ||
   ! jq -e --arg other "$TEST_OTHER_USER_ID" --arg owner "$TEST_USER_ID" \
     '.user.id == $other and .user.id != $owner and
      (.access_token | type) == "string" and (.access_token | length) > 0' \
     "$TMP_DIR/other-session.json" >/dev/null; then
  echo "Could not obtain the local assessment stranger's distinct Auth session (HTTP $HTTP_STATUS)" >&2
  exit 1
fi
OTHER_TOKEN="$(jq -r '.access_token' "$TMP_DIR/other-session.json")"

if [[ "${1:-}" != "--expired-draft-privacy" ]]; then
# Keep the SQL concurrency cases above; additionally exercise real overlapping
# authenticated requests through the local Auth/PostgREST gateway.
test_concurrent_http_submissions
test_concurrent_http_submissions expired
test_admin_http_concurrent_submit

"${PSQL[@]}" >/dev/null <<SQL
DO \$\$
DECLARE
  unfinished_pre_test public.pre_tests%ROWTYPE;
BEGIN
  SELECT * INTO STRICT unfinished_pre_test FROM public.pre_tests
  WHERE id = '$TEST_OWNERSHIP_PRE_TEST_ID';
  IF unfinished_pre_test.user_id IS DISTINCT FROM '$TEST_USER_ID'::uuid
     OR unfinished_pre_test.status IS DISTINCT FROM 'in_progress'
     OR unfinished_pre_test.completed_at IS NOT NULL
     OR unfinished_pre_test.total_questions IS DISTINCT FROM 1
     OR public.assessment_deadline_passed(unfinished_pre_test.deadline_at, clock_timestamp())
     OR EXISTS (SELECT 1 FROM public.pre_test_answers
                WHERE pre_test_id = '$TEST_OWNERSHIP_PRE_TEST_ID') THEN
    RAISE EXCEPTION 'First HTTP submission requires an unfinished, unexpired owner assessment without saved answers';
  END IF;
END;
\$\$;
SQL

# Attempt the same unfinished assessment through Auth/PostgREST before the
# owner submits it. A transport/auth failure is not evidence of RPC ownership
# enforcement: require the function's exact Unauthorized result.
BEFORE_UNFINISHED_HTTP_STATE="$(assessment_http_state)"
if ! jq -e --arg owner "$TEST_USER_ID" \
  '.pre_test.user_id == $owner and .pre_test.status == "in_progress" and
   .pre_test.completed_at == null and .answers == [] and
   .profile.user_id == $owner' >/dev/null <<<"$BEFORE_UNFINISHED_HTTP_STATE"; then
  echo "Stranger HTTP submission requires an unfinished owner assessment and owner profile" >&2
  exit 1
fi
HTTP_STATUS="$(curl --silent --show-error --max-time 15 \
  --output "$TMP_DIR/other-unfinished-rpc-response.json" --write-out '%{http_code}' \
  --request POST "${TEST_SUPABASE_URL%/}/rest/v1/rpc/submit_assessment" \
  --header "apikey: $TEST_SUPABASE_ANON_KEY" \
  --header "Authorization: Bearer $OTHER_TOKEN" \
  --header 'Content-Type: application/json' \
  --data "{\"_pre_test_id\":\"$TEST_OWNERSHIP_PRE_TEST_ID\",\"_answers\":[{\"question_id\":\"$TEST_QUESTION_ID\",\"selected_answer\":0}]}")"
if [[ "$HTTP_STATUS" != "200" ]] ||
   ! jq -e '. == {"error":"Unauthorized"}' \
     "$TMP_DIR/other-unfinished-rpc-response.json" >/dev/null 2>&1; then
  echo "Stranger HTTP submission of unfinished assessment did not return only Unauthorized (HTTP $HTTP_STATUS)" >&2
  exit 1
fi
if [[ "$(assessment_http_state)" != "$BEFORE_UNFINISHED_HTTP_STATE" ]]; then
  echo "Stranger HTTP submission changed the unfinished assessment, answers, or owner profile" >&2
  exit 1
fi
echo "Stranger HTTP submission of unfinished assessment was denied without changing owner data."

# An API key alone is not an owner session. Deliberately omit Authorization
# while the assessment is still in_progress, before the owner can complete it.
# Require a gateway permission denial, not a successful RPC or a network error.
HTTP_STATUS="$(curl --silent --show-error --max-time 15 \
  --output "$TMP_DIR/anon-unfinished-rpc-response.json" --write-out '%{http_code}' \
  --request POST "${TEST_SUPABASE_URL%/}/rest/v1/rpc/submit_assessment" \
  --header "apikey: $TEST_SUPABASE_ANON_KEY" \
  --header 'Content-Type: application/json' \
  --data "{\"_pre_test_id\":\"$TEST_OWNERSHIP_PRE_TEST_ID\",\"_answers\":[{\"question_id\":\"$TEST_QUESTION_ID\",\"selected_answer\":0}]}")"
case "$HTTP_STATUS" in
  401|403|404) ;;
  *) echo "Anonymous HTTP submission of unfinished assessment was not rejected (HTTP $HTTP_STATUS)" >&2; exit 1 ;;
esac
if ! jq -e '
  type == "object" and (.code == "42501" or .code == "PGRST202")
  and (has("score") | not) and (has("level") | not)
  and (has("correct") | not) and (has("total") | not)
' "$TMP_DIR/anon-unfinished-rpc-response.json" >/dev/null 2>&1; then
  echo "Anonymous HTTP submission of unfinished assessment returned an unexpected response or exposed a result" >&2
  exit 1
fi
if [[ "$(assessment_http_state)" != "$BEFORE_UNFINISHED_HTTP_STATE" ]]; then
  echo "Anonymous HTTP submission changed the unfinished assessment, answers, or owner profile" >&2
  exit 1
fi
echo "Anonymous HTTP submission of unfinished assessment was denied without changing owner data."

test_admin_http_unfinished

# The owner must still be able to finish this exact assessment through the real
# Auth session after stranger, anonymous and admin submissions were rejected.
HTTP_STATUS="$(curl --silent --show-error --max-time 15 \
  --output "$TMP_DIR/owner-first-submit-response.json" --write-out '%{http_code}' \
  --request POST "${TEST_SUPABASE_URL%/}/rest/v1/rpc/submit_assessment" \
  --header "apikey: $TEST_SUPABASE_ANON_KEY" \
  --header "Authorization: Bearer $OWNER_TOKEN" \
  --header 'Content-Type: application/json' \
  --data "{\"_pre_test_id\":\"$TEST_OWNERSHIP_PRE_TEST_ID\",\"_answers\":[{\"question_id\":\"$TEST_QUESTION_ID\",\"selected_answer\":1}]}")"
if [[ "$HTTP_STATUS" != "200" ]] ||
   ! jq -e '. == {"score":100,"level":"Utama","correct":1,"total":1}' \
     "$TMP_DIR/owner-first-submit-response.json" >/dev/null 2>&1; then
  echo "Owner first HTTP assessment submission did not return the expected result (HTTP $HTTP_STATUS)" >&2
  exit 1
fi
OWNER_RESULT="$(cat "$TMP_DIR/owner-first-submit-response.json")"

"${PSQL[@]}" -v owner_result="$OWNER_RESULT" >/dev/null <<SQL
SELECT set_config('test.owner_result', :'owner_result', false);
DO \$\$
DECLARE
  answer_count integer;
  saved_answer integer;
  saved_correct boolean;
  owner_pre_test public.pre_tests%ROWTYPE;
  profile_level text;
  profile_score integer;
BEGIN
  IF current_setting('test.owner_result')::jsonb IS DISTINCT FROM
     '{"score":100,"level":"Utama","correct":1,"total":1}'::jsonb THEN
    RAISE EXCEPTION 'Owner could not complete the pre-test: %',
      current_setting('test.owner_result');
  END IF;

  SELECT * INTO STRICT owner_pre_test
  FROM public.pre_tests WHERE id = '$TEST_OWNERSHIP_PRE_TEST_ID';
  SELECT count(*), min(selected_answer), bool_and(is_correct)
  INTO answer_count, saved_answer, saved_correct
  FROM public.pre_test_answers WHERE pre_test_id = '$TEST_OWNERSHIP_PRE_TEST_ID';
  SELECT current_level, total_score INTO STRICT profile_level, profile_score
  FROM public.profiles WHERE user_id = '$TEST_USER_ID';

  IF owner_pre_test.status IS DISTINCT FROM 'completed'
     OR owner_pre_test.user_id IS DISTINCT FROM '$TEST_USER_ID'::uuid
     OR owner_pre_test.completed_at IS NULL
     OR owner_pre_test.total_questions IS DISTINCT FROM 1
     OR owner_pre_test.correct_answers IS DISTINCT FROM 1
     OR owner_pre_test.score IS DISTINCT FROM 100
     OR owner_pre_test.determined_level IS DISTINCT FROM 'Utama'
     OR answer_count <> 1 OR saved_answer IS DISTINCT FROM 1
     OR saved_correct IS DISTINCT FROM true
     OR profile_level IS DISTINCT FROM 'Utama' OR profile_score IS DISTINCT FROM 100 THEN
    RAISE EXCEPTION 'Owner first HTTP submission did not save the expected answer, result and profile';
  END IF;
  IF jsonb_build_object(
       'score', owner_pre_test.score,
       'level', owner_pre_test.determined_level,
       'correct', owner_pre_test.correct_answers,
       'total', answer_count
     ) IS DISTINCT FROM current_setting('test.owner_result')::jsonb
     OR NOT EXISTS (
       SELECT 1 FROM public.pre_test_answers
       WHERE pre_test_id = '$TEST_OWNERSHIP_PRE_TEST_ID'
         AND question_id = '$TEST_QUESTION_ID'
     ) THEN
    RAISE EXCEPTION 'First HTTP response does not match the persisted result and question';
  END IF;
END;
\$\$;
SQL

# A completed pre-test returns its original score on replay, but only to its
# owner. An authenticated stranger must not learn that score or change any of
# the completed assessment's rows, answers, or the owner's profile.
"${PSQL[@]}" -v owner_result="$OWNER_RESULT" >/dev/null <<SQL
SELECT set_config('test.owner_result', :'owner_result', false);
DO \$\$
DECLARE
  before_pre_test jsonb;
  before_answers jsonb;
  before_profile jsonb;
  attacker_result jsonb;
  owner_replay_result jsonb;
BEGIN
  SELECT to_jsonb(pt) INTO STRICT before_pre_test
  FROM public.pre_tests pt WHERE pt.id = '$TEST_OWNERSHIP_PRE_TEST_ID';
  SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.question_id), '[]'::jsonb)
  INTO before_answers
  FROM public.pre_test_answers a WHERE a.pre_test_id = '$TEST_OWNERSHIP_PRE_TEST_ID';
  SELECT to_jsonb(p) INTO STRICT before_profile
  FROM public.profiles p WHERE p.user_id = '$TEST_USER_ID';

  IF before_pre_test->>'status' IS DISTINCT FROM 'completed'
     OR jsonb_array_length(before_answers) <> 1 THEN
    RAISE EXCEPTION 'Completed ownership test was not set up correctly';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '$TEST_OTHER_USER_ID', true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);
  attacker_result := public.submit_assessment(
    '$TEST_OWNERSHIP_PRE_TEST_ID',
    jsonb_build_array(jsonb_build_object(
      'question_id', '$TEST_QUESTION_ID',
      'selected_answer', 0
    ))
  );

  IF attacker_result IS DISTINCT FROM '{"error":"Unauthorized"}'::jsonb THEN
    RAISE EXCEPTION 'Replaying another user''s completed pre-test returned %, expected only Unauthorized',
      attacker_result;
  END IF;

  IF (SELECT to_jsonb(pt) FROM public.pre_tests pt
      WHERE pt.id = '$TEST_OWNERSHIP_PRE_TEST_ID') IS DISTINCT FROM before_pre_test
     OR (SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.question_id), '[]'::jsonb)
         FROM public.pre_test_answers a
         WHERE a.pre_test_id = '$TEST_OWNERSHIP_PRE_TEST_ID') IS DISTINCT FROM before_answers
     OR (SELECT to_jsonb(p) FROM public.profiles p
         WHERE p.user_id = '$TEST_USER_ID') IS DISTINCT FROM before_profile THEN
    RAISE EXCEPTION 'Unauthorized completed pre-test replay changed the assessment, answers, or profile';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', '$TEST_USER_ID', true);
  owner_replay_result := public.submit_assessment(
    '$TEST_OWNERSHIP_PRE_TEST_ID',
    jsonb_build_array(jsonb_build_object(
      'question_id', '$TEST_QUESTION_ID',
      'selected_answer', 0
    ))
  );
  IF owner_replay_result IS DISTINCT FROM current_setting('test.owner_result')::jsonb THEN
    RAISE EXCEPTION 'Owner could not retrieve the original completed result: %',
      owner_replay_result;
  END IF;
END;
\$\$;
SQL

# An anonymous caller must not be able to replay a completed assessment.
# Use the actual database role, not only a JWT claim on the postgres session,
# so the test catches accidental EXECUTE grants as well as leaked results.
"${PSQL[@]}" >/dev/null <<SQL
BEGIN;
CREATE TEMP TABLE assessment_anon_before AS
SELECT
  (SELECT to_jsonb(pt) FROM public.pre_tests pt
   WHERE pt.id = '$TEST_OWNERSHIP_PRE_TEST_ID') AS pre_test,
  (SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.id), '[]'::jsonb)
   FROM public.pre_test_answers a
   WHERE a.pre_test_id = '$TEST_OWNERSHIP_PRE_TEST_ID') AS answers,
  (SELECT to_jsonb(p) FROM public.profiles p
   WHERE p.user_id = '$TEST_USER_ID') AS profile;

DO \$\$
BEGIN
  IF (SELECT pre_test->>'status' IS DISTINCT FROM 'completed'
             OR jsonb_array_length(answers) IS DISTINCT FROM 1
             OR profile IS NULL
      FROM assessment_anon_before) THEN
    RAISE EXCEPTION 'Anonymous replay fixture must have a completed assessment, answer and profile';
  END IF;
END;
\$\$;

SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claim.role', 'anon', true);
DO \$\$
DECLARE
  visible_pre_tests integer := 0;
  visible_answers integer := 0;
BEGIN
  IF current_user IS DISTINCT FROM 'anon' OR auth.uid() IS NOT NULL THEN
    RAISE EXCEPTION 'Anonymous replay did not run without a user session';
  END IF;

  -- A direct SELECT may be denied by table privileges or return no rows via RLS.
  -- Either way, the completed owner's assessment and answer must stay hidden.
  BEGIN
    SELECT count(*) INTO visible_pre_tests
    FROM public.pre_tests
    WHERE id = '$TEST_OWNERSHIP_PRE_TEST_ID';
  EXCEPTION WHEN insufficient_privilege THEN
    visible_pre_tests := 0;
  END;
  IF visible_pre_tests <> 0 THEN
    RAISE EXCEPTION 'Anonymous SELECT exposed the completed pre-test';
  END IF;

  BEGIN
    SELECT count(*) INTO visible_answers
    FROM public.pre_test_answers
    WHERE pre_test_id = '$TEST_OWNERSHIP_PRE_TEST_ID';
  EXCEPTION WHEN insufficient_privilege THEN
    visible_answers := 0;
  END;
  IF visible_answers <> 0 THEN
    RAISE EXCEPTION 'Anonymous SELECT exposed the completed pre-test answer';
  END IF;

  IF has_function_privilege(current_user, 'public.submit_assessment(uuid, jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Anonymous role unexpectedly has EXECUTE on submit_assessment';
  END IF;

  BEGIN
    PERFORM public.submit_assessment(
      '$TEST_OWNERSHIP_PRE_TEST_ID',
      jsonb_build_array(jsonb_build_object(
        'question_id', '$TEST_QUESTION_ID',
        'selected_answer', 0
      ))
    );
    RAISE EXCEPTION 'Anonymous caller executed submit_assessment on a completed assessment';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL; -- Expected: anon has no EXECUTE privilege on submit_assessment.
  END;
END;
\$\$;
RESET ROLE;

DO \$\$
BEGIN
  IF (SELECT (SELECT to_jsonb(pt) FROM public.pre_tests pt
              WHERE pt.id = '$TEST_OWNERSHIP_PRE_TEST_ID') IS DISTINCT FROM pre_test
             OR (SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.id), '[]'::jsonb)
                 FROM public.pre_test_answers a
                 WHERE a.pre_test_id = '$TEST_OWNERSHIP_PRE_TEST_ID') IS DISTINCT FROM answers
             OR (SELECT to_jsonb(p) FROM public.profiles p
                 WHERE p.user_id = '$TEST_USER_ID') IS DISTINCT FROM profile
      FROM assessment_anon_before) THEN
    RAISE EXCEPTION 'Anonymous replay changed the completed assessment, answers, or owner profile';
  END IF;
END;
\$\$;
COMMIT;
SQL

# Exercise the local PostgREST gateway as well as the database role. An API key
# identifies the project, but without an Authorization header the first request
# has no user session. Never point this fixture test at the deployed Supabase URL.
BEFORE_HTTP_STATE="$(assessment_http_state)"
if ! jq -e '.pre_test.status == "completed" and (.answers | length) == 1 and (.profile | type) == "object"' \
  >/dev/null <<<"$BEFORE_HTTP_STATE"; then
  echo "HTTP replay fixture is not a completed assessment with an answer and owner profile" >&2
  exit 1
fi

# A project API key alone is not a user session. Request the completed owner's
# row and answer through PostgREST without Authorization, so gateway behavior is
# tested in addition to the direct anon-role SELECT above.
assert_anon_table_hidden() {
  local table="$1"
  local filter="$2"
  local status
  status="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/anon-${table}-response.json" --write-out '%{http_code}' \
    --request GET "${TEST_SUPABASE_URL%/}/rest/v1/${table}?${filter}" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY")"

  case "$status" in
    200)
      if ! jq -e '. == []' "$TMP_DIR/anon-${table}-response.json" >/dev/null 2>&1; then
        echo "Anonymous HTTP GET exposed rows from $table or returned an unexpected response" >&2
        exit 1
      fi
      ;;
    401|403|404)
      if ! jq -e --arg owner "$TEST_USER_ID" --arg pre_test "$TEST_OWNERSHIP_PRE_TEST_ID" \
        'type == "object" and (.code | type) == "string" and
         (tostring | contains($owner) | not) and
         (tostring | contains($pre_test) | not)' \
        "$TMP_DIR/anon-${table}-response.json" >/dev/null 2>&1; then
        echo "Anonymous HTTP GET for $table returned an unexpected denial or exposed fixture data (HTTP $status)" >&2
        exit 1
      fi
      ;;
    *)
      echo "Anonymous HTTP GET for $table was not denied or empty (HTTP $status)" >&2
      exit 1
      ;;
  esac
}

assert_anon_table_hidden pre_tests "id=eq.$TEST_OWNERSHIP_PRE_TEST_ID"
assert_anon_table_hidden pre_test_answers "pre_test_id=eq.$TEST_OWNERSHIP_PRE_TEST_ID"
if [[ "$(assessment_http_state)" != "$BEFORE_HTTP_STATE" ]]; then
  echo "Anonymous HTTP table reads changed the assessment, answers, or owner profile" >&2
  exit 1
fi

# Reuse the stranger's distinct Auth session. Even on a completed pre-test,
# the RPC must not return the owner's stored score.
HTTP_STATUS="$(curl --silent --show-error --max-time 15 \
  --output "$TMP_DIR/other-rpc-response.json" --write-out '%{http_code}' \
  --request POST "${TEST_SUPABASE_URL%/}/rest/v1/rpc/submit_assessment" \
  --header "apikey: $TEST_SUPABASE_ANON_KEY" \
  --header "Authorization: Bearer $OTHER_TOKEN" \
  --header 'Content-Type: application/json' \
  --data "{\"_pre_test_id\":\"$TEST_OWNERSHIP_PRE_TEST_ID\",\"_answers\":[{\"question_id\":\"$TEST_QUESTION_ID\",\"selected_answer\":0}]}")"
# Keep the same stranger session for the expired-draft checks below.
if [[ "$HTTP_STATUS" != "200" ]] ||
   ! jq -e '. == {"error":"Unauthorized"}' \
     "$TMP_DIR/other-rpc-response.json" >/dev/null 2>&1; then
  echo "Stranger HTTP assessment replay did not return only Unauthorized (HTTP $HTTP_STATUS)" >&2
  exit 1
fi
if [[ "$(assessment_http_state)" != "$BEFORE_HTTP_STATE" ]]; then
  echo "Stranger HTTP assessment replay changed the assessment, answers, or owner profile" >&2
  exit 1
fi

# Summary access for an admin must not imply permission to replay the owner's RPC.
test_admin_http_replay

HTTP_STATUS="$(curl --silent --show-error --max-time 15 \
  --output "$TMP_DIR/anon-rpc-response.json" --write-out '%{http_code}' \
  --request POST "${TEST_SUPABASE_URL%/}/rest/v1/rpc/submit_assessment" \
  --header "apikey: $TEST_SUPABASE_ANON_KEY" \
  --header 'Content-Type: application/json' \
  --data "{\"_pre_test_id\":\"$TEST_OWNERSHIP_PRE_TEST_ID\",\"_answers\":[{\"question_id\":\"$TEST_QUESTION_ID\",\"selected_answer\":0}]}")"

# A successful RPC may return the completed assessment's original score even
# if the caller's proposed answer differs. Reject that case, not only writes.
case "$HTTP_STATUS" in
  401|403|404) ;;
  *) echo "Anonymous HTTP assessment replay was not rejected (HTTP $HTTP_STATUS)" >&2; exit 1 ;;
esac
if ! jq -e '
  type == "object" and (.code == "42501" or .code == "PGRST202")
  and (has("score") | not) and (has("level") | not)
  and (has("correct") | not) and (has("total") | not)
' "$TMP_DIR/anon-rpc-response.json" >/dev/null 2>&1; then
  echo "Anonymous HTTP assessment replay returned an unexpected response or exposed a result" >&2
  exit 1
fi
if [[ "$(assessment_http_state)" != "$BEFORE_HTTP_STATE" ]]; then
  echo "Anonymous HTTP assessment replay changed the assessment, answers, or owner profile" >&2
  exit 1
fi

# Reuse the owner's Auth session, then replay with a deliberately different
# answer. The HTTP gateway must return the stored result without writing again.
HTTP_STATUS="$(curl --silent --show-error --max-time 15 \
  --output "$TMP_DIR/owner-rpc-response.json" --write-out '%{http_code}' \
  --request POST "${TEST_SUPABASE_URL%/}/rest/v1/rpc/submit_assessment" \
  --header "apikey: $TEST_SUPABASE_ANON_KEY" \
  --header "Authorization: Bearer $OWNER_TOKEN" \
  --header 'Content-Type: application/json' \
  --data "{\"_pre_test_id\":\"$TEST_OWNERSHIP_PRE_TEST_ID\",\"_answers\":[{\"question_id\":\"$TEST_QUESTION_ID\",\"selected_answer\":0}]}")"
# Keep the same owner session for expired-draft finalization below.
if [[ "$HTTP_STATUS" != "200" ]] ||
   ! jq -e --argjson expected "$OWNER_RESULT" '. == $expected' \
     "$TMP_DIR/owner-rpc-response.json" >/dev/null 2>&1; then
  echo "Owner HTTP assessment replay did not return the original result (HTTP $HTTP_STATUS)" >&2
  exit 1
fi
if [[ "$(assessment_http_state)" != "$BEFORE_HTTP_STATE" ]]; then
  echo "Owner HTTP assessment replay changed the assessment, answers, or owner profile" >&2
  exit 1
fi

# Exercise table policies as an actual authenticated database role, not as the
# postgres connection used to seed fixtures (which bypasses RLS). Keep this in
# the same transaction so a failed assertion rolls back every test write.
"${PSQL[@]}" >/dev/null <<SQL
BEGIN;
-- Admins may see members' summary results, but only their own per-question
-- answers. Give every identity its own assessment to test both sides of RLS.
INSERT INTO public.user_roles (user_id, role)
VALUES ('$TEST_ADMIN_USER_ID', 'admin');
INSERT INTO public.pre_tests (id, user_id, total_questions, status, score)
VALUES
  ('00000000-0000-4000-8000-000000000176', '$TEST_ADMIN_USER_ID', 1, 'completed', 50),
  ('00000000-0000-4000-8000-000000000178', '$TEST_OTHER_USER_ID', 1, 'completed', 25);
INSERT INTO public.pre_test_answers (id, pre_test_id, question_id, selected_answer)
VALUES
  ('00000000-0000-4000-8000-000000000177',
   '00000000-0000-4000-8000-000000000176', '$TEST_QUESTION_ID', 1),
  ('00000000-0000-4000-8000-000000000179',
   '00000000-0000-4000-8000-000000000178', '$TEST_QUESTION_ID', 0);
CREATE TEMP TABLE assessment_rls_before AS
SELECT
  (SELECT to_jsonb(pt) FROM public.pre_tests pt
   WHERE pt.id = '$TEST_OWNERSHIP_PRE_TEST_ID') AS pre_test,
  (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.pre_test_answers a
   WHERE a.pre_test_id = '$TEST_OWNERSHIP_PRE_TEST_ID') AS answers;

DO \$\$
BEGIN
  IF (SELECT pre_test->>'status' IS DISTINCT FROM 'completed'
             OR jsonb_array_length(answers) IS DISTINCT FROM 1
      FROM assessment_rls_before) THEN
    RAISE EXCEPTION 'RLS fixture must contain a completed pre-test and its answer';
  END IF;
END;
\$\$;

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '$TEST_USER_ID', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);
DO \$\$
DECLARE
  visible_pre_test public.pre_tests%ROWTYPE;
  visible_answer public.pre_test_answers%ROWTYPE;
BEGIN
  IF current_user IS DISTINCT FROM 'authenticated'
     OR auth.uid() IS DISTINCT FROM '$TEST_USER_ID'::uuid THEN
    RAISE EXCEPTION 'Owner table reads did not use the authenticated owner role and JWT';
  END IF;

  SELECT * INTO STRICT visible_pre_test FROM public.pre_tests
  WHERE id = '$TEST_OWNERSHIP_PRE_TEST_ID';
  SELECT * INTO STRICT visible_answer FROM public.pre_test_answers
  WHERE pre_test_id = '$TEST_OWNERSHIP_PRE_TEST_ID';
  IF visible_pre_test.user_id IS DISTINCT FROM '$TEST_USER_ID'::uuid
     OR visible_pre_test.status IS DISTINCT FROM 'completed'
     OR visible_pre_test.score IS DISTINCT FROM 100
     OR visible_pre_test.determined_level IS DISTINCT FROM 'Utama'
     OR visible_answer.selected_answer IS DISTINCT FROM 1
     OR visible_answer.is_correct IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Owner cannot read the saved completed result and answer directly';
  END IF;

  -- Server-deadline authority revoked direct writes even for the owner.
  -- The positive write control is the successful owner RPC above, not a
  -- client-side result insert that bypasses the authorized roster/draft.
  BEGIN
    UPDATE public.pre_tests SET total_questions = total_questions
    WHERE id = '$TEST_OWNERSHIP_PRE_TEST_ID';
    RAISE EXCEPTION 'Owner directly updated their pre-test';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.pre_tests (id, user_id, total_questions)
    VALUES ('00000000-0000-4000-8000-000000000173', '$TEST_USER_ID', 1);
    RAISE EXCEPTION 'Owner directly created a pre-test';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.pre_tests WHERE id = '$TEST_OWNERSHIP_PRE_TEST_ID';
    RAISE EXCEPTION 'Owner directly deleted their pre-test';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.pre_test_answers (id, pre_test_id, question_id, selected_answer)
    VALUES ('00000000-0000-4000-8000-000000000174',
            '$TEST_OWNERSHIP_PRE_TEST_ID', '$TEST_QUESTION_ID', 1);
    RAISE EXCEPTION 'Owner directly created an answer';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.pre_test_answers SET selected_answer = 0
    WHERE pre_test_id = '$TEST_OWNERSHIP_PRE_TEST_ID';
    RAISE EXCEPTION 'Owner directly updated their answer';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM public.pre_test_answers WHERE pre_test_id = '$TEST_OWNERSHIP_PRE_TEST_ID';
    RAISE EXCEPTION 'Owner directly deleted their answer';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
\$\$;

SELECT set_config('request.jwt.claim.sub', '$TEST_OTHER_USER_ID', true);
DO \$\$
DECLARE
  affected integer;
BEGIN
  IF current_user IS DISTINCT FROM 'authenticated'
     OR auth.uid() IS DISTINCT FROM '$TEST_OTHER_USER_ID'::uuid THEN
    RAISE EXCEPTION 'Stranger table reads did not use the authenticated stranger role and JWT';
  END IF;

  -- Check both lookup-by-ID and a direct table scan; neither may expose
  -- the completed result or its answer to a different authenticated user.
  IF EXISTS (SELECT 1 FROM public.pre_tests
             WHERE id = '$TEST_OWNERSHIP_PRE_TEST_ID')
     OR EXISTS (SELECT 1 FROM public.pre_test_answers
                WHERE pre_test_id = '$TEST_OWNERSHIP_PRE_TEST_ID')
      OR EXISTS (SELECT 1 FROM public.pre_tests
                 WHERE id = '00000000-0000-4000-8000-000000000176')
      OR EXISTS (SELECT 1 FROM public.pre_test_answers
                 WHERE pre_test_id = '00000000-0000-4000-8000-000000000176')
     OR (SELECT count(*) FILTER (WHERE user_id = '$TEST_USER_ID'::uuid)
         FROM public.pre_tests) <> 0
     OR (SELECT count(*) FILTER (WHERE pre_test_id = '$TEST_OWNERSHIP_PRE_TEST_ID'::uuid)
         FROM public.pre_test_answers) <> 0 THEN
    RAISE EXCEPTION 'Another user can SELECT the owner''s completed result or answer directly';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.pre_tests
                 WHERE id = '00000000-0000-4000-8000-000000000178'
                   AND user_id = '$TEST_OTHER_USER_ID' AND score = 25)
     OR NOT EXISTS (SELECT 1 FROM public.pre_test_answers
                    WHERE id = '00000000-0000-4000-8000-000000000179'
                      AND selected_answer = 0) THEN
    RAISE EXCEPTION 'Non-admin cannot read their own result and answer';
  END IF;

  BEGIN
    UPDATE public.pre_tests SET score = -1
    WHERE id = '$TEST_OWNERSHIP_PRE_TEST_ID';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 0 THEN
      RAISE EXCEPTION 'Another user updated the owner''s pre-test';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    UPDATE public.pre_test_answers SET selected_answer = 0
    WHERE pre_test_id = '$TEST_OWNERSHIP_PRE_TEST_ID';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 0 THEN
      RAISE EXCEPTION 'Another user updated the owner''s answer';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    DELETE FROM public.pre_test_answers
    WHERE pre_test_id = '$TEST_OWNERSHIP_PRE_TEST_ID';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 0 THEN
      RAISE EXCEPTION 'Another user deleted the owner''s answer';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    DELETE FROM public.pre_tests WHERE id = '$TEST_OWNERSHIP_PRE_TEST_ID';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 0 THEN
      RAISE EXCEPTION 'Another user deleted the owner''s pre-test';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    INSERT INTO public.pre_tests (id, user_id, total_questions)
    VALUES ('00000000-0000-4000-8000-000000000171', '$TEST_USER_ID', 1);
    RAISE EXCEPTION 'Another user created a pre-test for the owner';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;

  BEGIN
    INSERT INTO public.pre_test_answers (id, pre_test_id, question_id, selected_answer)
    VALUES ('00000000-0000-4000-8000-000000000172',
            '$TEST_OWNERSHIP_PRE_TEST_ID', '$TEST_QUESTION_ID', 0);
    RAISE EXCEPTION 'Another user created an answer on the owner''s pre-test';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
\$\$;

-- The real authenticated DB role uses the admin identity from user_roles,
-- not an admin JWT claim or a postgres connection that bypasses RLS.
SELECT set_config('request.jwt.claim.sub', '$TEST_ADMIN_USER_ID', true);
DO \$\$
DECLARE
  member_result public.pre_tests%ROWTYPE;
  other_result public.pre_tests%ROWTYPE;
  own_answer public.pre_test_answers%ROWTYPE;
BEGIN
  IF current_user IS DISTINCT FROM 'authenticated'
     OR auth.uid() IS DISTINCT FROM '$TEST_ADMIN_USER_ID'::uuid
     OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Admin SELECT did not run as an authenticated admin';
  END IF;

  SELECT * INTO STRICT member_result FROM public.pre_tests
  WHERE id = '$TEST_OWNERSHIP_PRE_TEST_ID';
  SELECT * INTO STRICT other_result FROM public.pre_tests
  WHERE id = '00000000-0000-4000-8000-000000000178';
  IF member_result.user_id IS DISTINCT FROM '$TEST_USER_ID'::uuid
     OR member_result.status IS DISTINCT FROM 'completed'
     OR member_result.score IS DISTINCT FROM 100
     OR other_result.user_id IS DISTINCT FROM '$TEST_OTHER_USER_ID'::uuid
     OR other_result.score IS DISTINCT FROM 25 THEN
    RAISE EXCEPTION 'Admin cannot read members'' completed assessment results';
  END IF;

  SELECT * INTO STRICT own_answer FROM public.pre_test_answers
  WHERE id = '00000000-0000-4000-8000-000000000177';
  IF own_answer.pre_test_id IS DISTINCT FROM '00000000-0000-4000-8000-000000000176'::uuid THEN
    RAISE EXCEPTION 'Admin cannot read their own answer';
  END IF;
  IF EXISTS (SELECT 1 FROM public.pre_test_answers
             WHERE pre_test_id IN ('$TEST_OWNERSHIP_PRE_TEST_ID'::uuid,
                                   '00000000-0000-4000-8000-000000000178'::uuid))
     OR (SELECT count(*) FILTER (
           WHERE pre_test_id IN ('$TEST_OWNERSHIP_PRE_TEST_ID'::uuid,
                                 '00000000-0000-4000-8000-000000000178'::uuid))
         FROM public.pre_test_answers) <> 0 THEN
    RAISE EXCEPTION 'Admin can read a member''s per-question answers';
  END IF;
END;
\$\$;

-- Revoke the role without replacing the connection or changing its JWT
-- identity. The fixture connection briefly resumes its privileged role solely
-- to simulate a role administrator deleting the row.
RESET ROLE;
DELETE FROM public.user_roles
WHERE user_id = '$TEST_ADMIN_USER_ID' AND role = 'admin';
DO \$\$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles
             WHERE user_id = '$TEST_ADMIN_USER_ID' AND role = 'admin') THEN
    RAISE EXCEPTION 'Admin role revocation did not remove the role row';
  END IF;
END;
\$\$;
SET LOCAL ROLE authenticated;
DO \$\$
DECLARE
  own_result public.pre_tests%ROWTYPE;
  own_answer public.pre_test_answers%ROWTYPE;
BEGIN
  IF current_user IS DISTINCT FROM 'authenticated'
     OR auth.uid() IS DISTINCT FROM '$TEST_ADMIN_USER_ID'::uuid
     OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Revoked admin check did not retain the authenticated identity without admin access';
  END IF;

  IF EXISTS (SELECT 1 FROM public.pre_tests
             WHERE id IN ('$TEST_OWNERSHIP_PRE_TEST_ID'::uuid,
                          '00000000-0000-4000-8000-000000000178'::uuid))
     OR (SELECT count(*) FROM public.pre_tests
         WHERE user_id IN ('$TEST_USER_ID'::uuid, '$TEST_OTHER_USER_ID'::uuid)) <> 0 THEN
    RAISE EXCEPTION 'Revoked admin can still SELECT members'' completed results';
  END IF;

  SELECT * INTO STRICT own_result FROM public.pre_tests
  WHERE id = '00000000-0000-4000-8000-000000000176';
  SELECT * INTO STRICT own_answer FROM public.pre_test_answers
  WHERE id = '00000000-0000-4000-8000-000000000177';
  IF own_result.user_id IS DISTINCT FROM '$TEST_ADMIN_USER_ID'::uuid
     OR own_result.status IS DISTINCT FROM 'completed'
     OR own_result.score IS DISTINCT FROM 50
     OR own_answer.pre_test_id IS DISTINCT FROM own_result.id
     OR own_answer.selected_answer IS DISTINCT FROM 1 THEN
    RAISE EXCEPTION 'Revoked admin cannot read their own completed result and answer';
  END IF;
END;
\$\$;

RESET ROLE;
DO \$\$
BEGIN
  IF (SELECT to_jsonb(pt) FROM public.pre_tests pt
      WHERE pt.id = '$TEST_OWNERSHIP_PRE_TEST_ID')
     IS DISTINCT FROM (SELECT pre_test FROM assessment_rls_before)
     OR (SELECT jsonb_agg(to_jsonb(a) ORDER BY a.id) FROM public.pre_test_answers a
         WHERE a.pre_test_id = '$TEST_OWNERSHIP_PRE_TEST_ID')
        IS DISTINCT FROM (SELECT answers FROM assessment_rls_before) THEN
    RAISE EXCEPTION 'Direct table access changed the owner''s assessment or answer';
  END IF;
END;
\$\$;
ROLLBACK;
SQL

fi

# Expiry can finalize an assessment from a saved draft, even when the request
# supplies a different answer. Ownership must be checked BEFORE that path runs.
# Use a separate fixture so the unexpired/replay cases above stay independent.
"${PSQL[@]}" >/dev/null <<SQL
INSERT INTO public.pre_tests (
  id, user_id, total_questions, status, started_at, deadline_at,
  authorized_question_ids
)
VALUES (
  '$TEST_EXPIRED_PRE_TEST_ID', '$TEST_USER_ID', 1, 'in_progress',
  clock_timestamp() - interval '3 minutes',
  clock_timestamp() - interval '90 seconds', ARRAY['$TEST_QUESTION_ID'::uuid]
);
INSERT INTO public.assessment_drafts (pre_test_id, draft, updated_at)
VALUES (
  '$TEST_EXPIRED_PRE_TEST_ID',
  jsonb_build_object(
    'version', 1, 'revision', 0, 'preTestId', '$TEST_EXPIRED_PRE_TEST_ID',
    'questions', jsonb_build_array(jsonb_build_object('id', '$TEST_QUESTION_ID')),
    'answers', jsonb_build_object('$TEST_QUESTION_ID', 1),
    'answerResults', '{}'::jsonb, 'phase', 'review'
  ),
  clock_timestamp() - interval '2 minutes'
);
DO \$\$
DECLARE
  expired_test public.pre_tests%ROWTYPE;
  saved_draft public.assessment_drafts%ROWTYPE;
BEGIN
  SELECT * INTO STRICT expired_test FROM public.pre_tests
    WHERE id = '$TEST_EXPIRED_PRE_TEST_ID';
  SELECT * INTO STRICT saved_draft FROM public.assessment_drafts
    WHERE pre_test_id = expired_test.id;
  IF expired_test.user_id IS DISTINCT FROM '$TEST_USER_ID'::uuid
     OR expired_test.status IS DISTINCT FROM 'in_progress'
     OR expired_test.completed_at IS NOT NULL
     OR NOT public.assessment_deadline_passed(expired_test.deadline_at, clock_timestamp())
     OR saved_draft.updated_at >= expired_test.deadline_at
     OR public.validate_assessment_draft(saved_draft.draft) IS NOT TRUE
     OR saved_draft.draft->'answers'->>'$TEST_QUESTION_ID' IS DISTINCT FROM '1'
     OR EXISTS (SELECT 1 FROM public.pre_test_answers WHERE pre_test_id = expired_test.id) THEN
    RAISE EXCEPTION 'Expired HTTP fixture requires an unfinished owner assessment and a valid pre-deadline draft';
  END IF;
END;
\$\$;
SQL

BEFORE_EXPIRED_HTTP_STATE="$(assessment_http_state "$TEST_EXPIRED_PRE_TEST_ID")"
HTTP_STATUS="$(curl --silent --show-error --max-time 15 \
  --output "$TMP_DIR/other-expired-rpc-response.json" --write-out '%{http_code}' \
  --request POST "${TEST_SUPABASE_URL%/}/rest/v1/rpc/submit_assessment" \
  --header "apikey: $TEST_SUPABASE_ANON_KEY" \
  --header "Authorization: Bearer $OTHER_TOKEN" \
  --header 'Content-Type: application/json' \
  --data "{\"_pre_test_id\":\"$TEST_EXPIRED_PRE_TEST_ID\",\"_answers\":[{\"question_id\":\"$TEST_QUESTION_ID\",\"selected_answer\":0}]}")"
if [[ "$HTTP_STATUS" != "200" ]] ||
   ! jq -e '. == {"error":"Unauthorized"}' \
     "$TMP_DIR/other-expired-rpc-response.json" >/dev/null 2>&1; then
  echo "Stranger HTTP submission of expired assessment did not return only Unauthorized (HTTP $HTTP_STATUS)" >&2
  exit 1
fi
if [[ "$(assessment_http_state "$TEST_EXPIRED_PRE_TEST_ID")" != "$BEFORE_EXPIRED_HTTP_STATE" ]]; then
  echo "Stranger HTTP submission changed the expired assessment, answers, draft, or owner profile" >&2
  exit 1
fi
echo "Stranger HTTP submission of expired assessment was denied without changing owner data or draft."

test_admin_http_expired

# A denial alone could pass if expiry were broken for everyone. Prove the same
# assessment still finalizes for its owner after both stranger and admin denial,
# using the saved correct answer (1),
# not the deliberately incorrect late payload (0).
HTTP_STATUS="$(curl --silent --show-error --max-time 15 \
  --output "$TMP_DIR/owner-expired-rpc-response.json" --write-out '%{http_code}' \
  --request POST "${TEST_SUPABASE_URL%/}/rest/v1/rpc/submit_assessment" \
  --header "apikey: $TEST_SUPABASE_ANON_KEY" \
  --header "Authorization: Bearer $OWNER_TOKEN" \
  --header 'Content-Type: application/json' \
  --data "{\"_pre_test_id\":\"$TEST_EXPIRED_PRE_TEST_ID\",\"_answers\":[{\"question_id\":\"$TEST_QUESTION_ID\",\"selected_answer\":0}]}")"
if [[ "$HTTP_STATUS" != "200" ]] ||
   ! jq -e '. == {"score":100,"level":"Utama","correct":1,"total":1}' \
     "$TMP_DIR/owner-expired-rpc-response.json" >/dev/null 2>&1; then
  echo "Owner could not finalize the expired assessment from the saved draft (HTTP $HTTP_STATUS)" >&2
  exit 1
fi
"${PSQL[@]}" >/dev/null <<SQL
DO \$\$
DECLARE
  finished public.pre_tests%ROWTYPE;
  latest_result public.pre_tests%ROWTYPE;
  owner_profile public.profiles%ROWTYPE;
BEGIN
  SELECT * INTO STRICT finished FROM public.pre_tests WHERE id = '$TEST_EXPIRED_PRE_TEST_ID';
  SELECT * INTO STRICT latest_result FROM public.pre_tests
    WHERE user_id = '$TEST_USER_ID' AND status = 'completed'
    ORDER BY started_at DESC, id DESC LIMIT 1;
  SELECT * INTO STRICT owner_profile FROM public.profiles WHERE user_id = '$TEST_USER_ID';
  IF finished.user_id IS DISTINCT FROM '$TEST_USER_ID'::uuid
     OR finished.status IS DISTINCT FROM 'completed' OR finished.completed_at IS NULL
     OR finished.score IS DISTINCT FROM 100 OR finished.correct_answers IS DISTINCT FROM 1
     OR finished.total_questions IS DISTINCT FROM 1
     OR finished.determined_level IS DISTINCT FROM 'Utama'
     OR (SELECT count(*) FROM public.pre_test_answers WHERE pre_test_id = finished.id) <> 1
     OR NOT EXISTS (SELECT 1 FROM public.pre_test_answers
                    WHERE pre_test_id = finished.id AND question_id = '$TEST_QUESTION_ID'
                      AND selected_answer = 1 AND is_correct IS TRUE)
     OR owner_profile.total_score IS DISTINCT FROM latest_result.score
     OR owner_profile.current_level IS DISTINCT FROM latest_result.determined_level THEN
    RAISE EXCEPTION 'Owner expiry finalization did not persist the saved answer, result, and correct profile';
  END IF;
END;
\$\$;
SQL
echo "Owner HTTP finalization of the same expired assessment used the saved draft successfully."

# Missing/corrupt drafts must not reveal whether another user's expired
# assessment can be recovered. Keep the valid-draft owner control above and
# the question-authority suite independent: these fixtures have valid rosters.
for DRAFT_CASE in missing corrupt; do
  if [[ "$DRAFT_CASE" == "missing" ]]; then
    BROKEN_DRAFT_PRE_TEST_ID="00000000-0000-4000-8000-000000000184"
  else
    BROKEN_DRAFT_PRE_TEST_ID="00000000-0000-4000-8000-000000000185"
  fi
  "${PSQL[@]}" >/dev/null <<SQL
INSERT INTO public.pre_tests (
  id, user_id, total_questions, status, started_at, deadline_at,
  authorized_question_ids
)
VALUES (
  '$BROKEN_DRAFT_PRE_TEST_ID', '$TEST_USER_ID', 1, 'in_progress',
  clock_timestamp() - interval '3 minutes',
  clock_timestamp() - interval '90 seconds', ARRAY['$TEST_QUESTION_ID'::uuid]
);
-- Only the privileged fixture connection writes malformed server state.
INSERT INTO public.assessment_drafts (pre_test_id, draft, updated_at)
SELECT '$BROKEN_DRAFT_PRE_TEST_ID', '[]'::jsonb,
       clock_timestamp() - interval '2 minutes'
WHERE '$DRAFT_CASE' = 'corrupt';
DO \$\$
DECLARE
  expired_test public.pre_tests%ROWTYPE;
  saved_draft public.assessment_drafts%ROWTYPE;
  has_draft boolean;
BEGIN
  SELECT * INTO STRICT expired_test FROM public.pre_tests
    WHERE id = '$BROKEN_DRAFT_PRE_TEST_ID';
  SELECT * INTO saved_draft FROM public.assessment_drafts
    WHERE pre_test_id = expired_test.id;
  has_draft := FOUND;
  IF expired_test.user_id IS DISTINCT FROM '$TEST_USER_ID'::uuid
     OR expired_test.status IS DISTINCT FROM 'in_progress'
     OR expired_test.completed_at IS NOT NULL
     OR public.assessment_deadline_passed(expired_test.deadline_at, clock_timestamp()) IS NOT TRUE
     OR expired_test.authorized_question_ids IS DISTINCT FROM ARRAY['$TEST_QUESTION_ID'::uuid]
     OR expired_test.total_questions IS DISTINCT FROM 1
     OR public.assessment_answers_match_roster(
       jsonb_build_array(jsonb_build_object(
         'question_id', '$TEST_QUESTION_ID', 'selected_answer', 0
       )), expired_test.authorized_question_ids
     ) IS NOT TRUE
     OR EXISTS (SELECT 1 FROM public.pre_test_answers WHERE pre_test_id = expired_test.id)
     OR ('$DRAFT_CASE' = 'missing' AND has_draft)
     OR ('$DRAFT_CASE' = 'corrupt' AND (
       NOT has_draft OR saved_draft.draft IS DISTINCT FROM '[]'::jsonb
       OR saved_draft.updated_at >= expired_test.deadline_at
       OR public.validate_assessment_draft(saved_draft.draft) IS NOT FALSE
     )) THEN
    RAISE EXCEPTION 'Expired $DRAFT_CASE draft fixture has invalid preconditions';
  END IF;
END;
\$\$;
SQL

  BEFORE_BROKEN_DRAFT_HTTP_STATE="$(assessment_http_state "$BROKEN_DRAFT_PRE_TEST_ID")"
  HTTP_STATUS="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/other-expired-$DRAFT_CASE-rpc-response.json" --write-out '%{http_code}' \
    --request POST "${TEST_SUPABASE_URL%/}/rest/v1/rpc/submit_assessment" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY" \
    --header "Authorization: Bearer $OTHER_TOKEN" \
    --header 'Content-Type: application/json' \
    --data "{\"_pre_test_id\":\"$BROKEN_DRAFT_PRE_TEST_ID\",\"_answers\":[{\"question_id\":\"$TEST_QUESTION_ID\",\"selected_answer\":0}]}")"
  if [[ "$HTTP_STATUS" != "200" ]] ||
     ! jq -e '. == {"error":"Unauthorized"}' \
       "$TMP_DIR/other-expired-$DRAFT_CASE-rpc-response.json" >/dev/null 2>&1; then
    echo "Stranger HTTP submission of expired assessment with $DRAFT_CASE draft did not return only Unauthorized (HTTP $HTTP_STATUS)" >&2
    exit 1
  fi
  if [[ "$(assessment_http_state "$BROKEN_DRAFT_PRE_TEST_ID")" != "$BEFORE_BROKEN_DRAFT_HTTP_STATE" ]]; then
    echo "Stranger HTTP submission with $DRAFT_CASE draft changed the assessment, answers, draft, or full owner profile" >&2
    exit 1
  fi
  echo "Stranger HTTP submission with $DRAFT_CASE draft returned only Unauthorized without changing owner data."
done

unset OWNER_TOKEN OTHER_TOKEN

if [[ "${1:-}" == "--expired-draft-privacy" ]]; then
  echo "Expired assessment HTTP privacy passed for stranger valid/missing/corrupt drafts and admin valid draft; owner finalized the same assessment from its draft."
  exit 0
fi

echo "Concurrent SQL and owner HTTP submit_assessment, single answer/completion writes, stranger, anonymous and admin unfinished HTTP denial with unchanged owner data and subsequent owner completion, owner first HTTP submission and persisted result, anonymous HTTP table reads, anonymous, stranger and owner HTTP replay, admin HTTP summary access and replay denial with unchanged owner data, same-token HTTP admin revocation with preserved own-result access, direct table RLS including admin revocation, stranger and admin expired HTTP denial with unchanged assessment, answers, draft and profile followed by owner finalization, and stranger expired HTTP denial with missing and corrupt drafts tests passed."
