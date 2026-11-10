#!/usr/bin/env bash
# Sourced by test-submit-assessment-concurrency.sh before the owner's first
# submission and reused after completion. Never use the service role for
# member-data HTTP requests.
assessment_admin_http_token() {
  local status
  status="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/admin-session.json" --write-out '%{http_code}' \
    --request POST "${TEST_SUPABASE_URL%/}/auth/v1/token?grant_type=password" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY" \
    --header 'Content-Type: application/json' \
    --data "$(jq -nc --arg password "$ADMIN_PASSWORD" \
      '{email:"assessment-admin@example.invalid",password:$password}')")"
  if [[ "$status" != "200" ]] ||
     ! jq -e --arg admin "$TEST_ADMIN_USER_ID" --arg owner "$TEST_USER_ID" \
       --arg other "$TEST_OTHER_USER_ID" \
       '.user.id == $admin and .user.id != $owner and .user.id != $other and
        (.access_token | type) == "string" and (.access_token | length) > 0' \
       "$TMP_DIR/admin-session.json" >/dev/null; then
    echo "Could not obtain the local assessment admin's distinct Auth session (HTTP $status)" >&2
    return 1
  fi
  jq -r '.access_token' "$TMP_DIR/admin-session.json"
}

# Called with a verified real admin token while the owner's assessment is
# unfinished. All fixture reads/writes bypass RLS; every access under test uses
# Auth/PostgREST with the anon API key and the appropriate user's session.
assessment_admin_draft_privacy_state() {
  # Snapshot all member assessments and their complete rows, not the admin's
  # filtered HTTP view. Include every draft column (including updated_at).
  "${PSQL[@]}" -Atq <<SQL
SELECT jsonb_build_object(
  'pre_tests', (SELECT COALESCE(jsonb_agg(to_jsonb(pt) ORDER BY pt.id), '[]'::jsonb)
    FROM public.pre_tests pt WHERE pt.user_id = '$TEST_USER_ID'),
  'drafts', (SELECT COALESCE(jsonb_agg(to_jsonb(ad) ORDER BY ad.pre_test_id), '[]'::jsonb)
    FROM public.assessment_drafts ad JOIN public.pre_tests pt ON pt.id = ad.pre_test_id
    WHERE pt.user_id = '$TEST_USER_ID'),
  'answers', (SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.id), '[]'::jsonb)
    FROM public.pre_test_answers a JOIN public.pre_tests pt ON pt.id = a.pre_test_id
    WHERE pt.user_id = '$TEST_USER_ID'),
  'profile', (SELECT to_jsonb(p) FROM public.profiles p WHERE p.user_id = '$TEST_USER_ID')
)::text;
SQL
}

test_admin_http_draft_privacy() {
  local admin_token="$1" status before_state expected_admin expected_owner attack
  local operation method payload endpoint prefer
  local own_pre_test_id="00000000-0000-4000-8000-000000000182"

  "${PSQL[@]}" >/dev/null <<SQL
INSERT INTO public.pre_tests (
  id, user_id, total_questions, status, started_at, deadline_at, authorized_question_ids
)
SELECT '$own_pre_test_id', '$TEST_ADMIN_USER_ID', 1, 'in_progress',
  started_at - interval '1 second', deadline_at, ARRAY['$TEST_QUESTION_ID'::uuid]
FROM public.pre_tests WHERE id = '$TEST_OWNERSHIP_PRE_TEST_ID';
INSERT INTO public.assessment_drafts (pre_test_id, draft)
SELECT id, jsonb_build_object(
  'version', 1, 'revision', 0, 'preTestId', id,
  'questions', jsonb_build_array(jsonb_build_object('id', '$TEST_QUESTION_ID')),
  'answers', jsonb_build_object('$TEST_QUESTION_ID',
    CASE WHEN user_id = '$TEST_USER_ID'::uuid THEN 1 ELSE 0 END),
  'answerResults', '{}'::jsonb, 'phase', 'review'
)
FROM public.pre_tests WHERE id IN ('$TEST_OWNERSHIP_PRE_TEST_ID', '$own_pre_test_id');
DO \$\$
BEGIN
  IF (SELECT count(*) FROM public.pre_tests pt
      JOIN public.assessment_drafts ad ON ad.pre_test_id = pt.id
      WHERE pt.id IN ('$TEST_OWNERSHIP_PRE_TEST_ID', '$own_pre_test_id')
        AND pt.status = 'in_progress' AND pt.completed_at IS NULL
        AND pt.deadline_at IS NOT NULL
        AND NOT public.assessment_deadline_passed(pt.deadline_at, clock_timestamp())
        AND public.validate_assessment_draft(ad.draft) IS TRUE) <> 2 THEN
    RAISE EXCEPTION 'Draft privacy fixture requires two valid, unfinished, unexpired drafts';
  END IF;
END;
\$\$;
SQL
  before_state="$(assessment_admin_draft_privacy_state)"
  # Match every response field except the intentionally changing server clock.
  expected_admin="$("${PSQL[@]}" -Atq -c "
    SELECT jsonb_build_object('preTestId', pt.id, 'startedAt', pt.started_at,
      'deadlineAt', pt.deadline_at, 'totalQuestions', pt.total_questions, 'draft', ad.draft)
    FROM public.pre_tests pt JOIN public.assessment_drafts ad ON ad.pre_test_id = pt.id
    WHERE pt.id = '$own_pre_test_id'")"
  expected_owner="$("${PSQL[@]}" -Atq -c "
    SELECT jsonb_build_object('preTestId', pt.id, 'startedAt', pt.started_at,
      'deadlineAt', pt.deadline_at, 'totalQuestions', pt.total_questions, 'draft', ad.draft)
    FROM public.pre_tests pt JOIN public.assessment_drafts ad ON ad.pre_test_id = pt.id
    WHERE pt.id = '$TEST_OWNERSHIP_PRE_TEST_ID'")"

  status="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/admin-active-draft.json" --write-out '%{http_code}' \
    --request POST "${TEST_SUPABASE_URL%/}/rest/v1/rpc/get_active_assessment_draft" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY" \
    --header "Authorization: Bearer $admin_token" \
    --header 'Content-Type: application/json' --data '{}')"
  if [[ "$status" != "200" ]] ||
     ! jq -e --argjson expected "$expected_admin" \
       'del(.serverNow) == $expected' "$TMP_DIR/admin-active-draft.json" >/dev/null 2>&1; then
    echo "Admin HTTP recovery did not return only the admin's own draft (HTTP $status)" >&2
    exit 1
  fi

  # Exercise both an explicit victim filter and an unfiltered table read.
  # Current grants reject SELECT entirely; a future owner-only RLS policy
  # may return rows, but only the admin's exact fixture row is allowed.
  local filter
  for filter in "pre_test_id=eq.$TEST_OWNERSHIP_PRE_TEST_ID&select=*" "select=*"; do
    status="$(curl --silent --show-error --max-time 15 \
      --output "$TMP_DIR/admin-draft-table.json" --write-out '%{http_code}' \
      "${TEST_SUPABASE_URL%/}/rest/v1/assessment_drafts?$filter" \
      --header "apikey: $TEST_SUPABASE_ANON_KEY" \
      --header "Authorization: Bearer $admin_token")"
    if [[ "$status" == "403" ]]; then
      if ! jq -e '.code == "42501" and .message == "permission denied for table assessment_drafts"' \
        "$TMP_DIR/admin-draft-table.json" >/dev/null 2>&1; then
        echo "Admin draft SELECT failed for an unexpected reason" >&2
        exit 1
      fi
    elif [[ "$status" != "200" ]] ||
         ! jq -e --arg id "$own_pre_test_id" --arg filter "$filter" \
           --argjson expected "$expected_admin" \
           'type == "array" and
            (if $filter == "select=*" then
              all(.[]; .pre_test_id == $id and .draft == $expected.draft)
             else . == [] end)' "$TMP_DIR/admin-draft-table.json" >/dev/null 2>&1; then
      echo "Admin HTTP SELECT exposed member drafts or failed unexpectedly (HTTP $status)" >&2
      exit 1
    fi
  done

  # Change a real answer with a valid draft, so payload validation cannot
  # substitute for access control. Plain POST and merge-upsert must both be
  # denied, not merely fail on a duplicate key. PATCH/DELETE may instead be
  # successful no-ops under owner-only RLS, but must return no victim rows.
  attack="$(jq -nc --argjson expected "$expected_owner" --arg question "$TEST_QUESTION_ID" \
    '$expected.draft | .answers[$question] = 0')"
  for operation in patch delete insert upsert; do
    endpoint="assessment_drafts?pre_test_id=eq.$TEST_OWNERSHIP_PRE_TEST_ID"
    prefer='return=representation'
    case "$operation" in
      patch)
        method=PATCH
        payload="$(jq -nc --argjson draft "$attack" '{draft:$draft}')"
        ;;
      delete)
        method=DELETE
        payload=''
        ;;
      insert|upsert)
        method=POST
        endpoint='assessment_drafts'
        payload="$(jq -nc --arg id "$TEST_OWNERSHIP_PRE_TEST_ID" \
          --argjson draft "$attack" '{pre_test_id:$id,draft:$draft}')"
        if [[ "$operation" == upsert ]]; then
          endpoint+='?on_conflict=pre_test_id'
          prefer+=',resolution=merge-duplicates'
        fi
        ;;
    esac
    status="$(curl --silent --show-error --max-time 15 \
      --output "$TMP_DIR/admin-draft-$operation.json" --write-out '%{http_code}' \
      --request "$method" "${TEST_SUPABASE_URL%/}/rest/v1/$endpoint" \
      --header "apikey: $TEST_SUPABASE_ANON_KEY" \
      --header "Authorization: Bearer $admin_token" \
      --header "Prefer: $prefer" \
      --header 'Content-Type: application/json' --data "$payload")"
    if [[ "$status" == "403" ]]; then
      if ! jq -e '.code == "42501" and
        (.message == "permission denied for table assessment_drafts" or
         .message == "new row violates row-level security policy for table \"assessment_drafts\"")' \
        "$TMP_DIR/admin-draft-$operation.json" >/dev/null 2>&1; then
        echo "Admin draft $operation failed for an unexpected reason" >&2
        exit 1
      fi
    elif [[ "$operation" != patch && "$operation" != delete ]] ||
         [[ "$status" != "200" ]] ||
         ! jq -e '. == []' "$TMP_DIR/admin-draft-$operation.json" >/dev/null 2>&1; then
      echo "Admin HTTP draft $operation was not denied or a row-free no-op (HTTP $status)" >&2
      exit 1
    fi
    # Check after EACH attempt: a later operation must not hide a prior write.
    if [[ "$(assessment_admin_draft_privacy_state)" != "$before_state" ]]; then
      echo "Admin draft $operation changed member drafts, assessments, answers, or profile" >&2
      exit 1
    fi
  done

  # Structurally valid payload, matching roster and current revision: denial
  # must be ownership, not validation, expiry, or a compare-and-swap conflict.
  attack="$(jq -nc --argjson expected "$expected_owner" --arg question "$TEST_QUESTION_ID" \
    '{_pre_test_id:$expected.preTestId,
      _draft:($expected.draft | .answers[$question] = 0)}')"
  status="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/admin-save-member-draft.json" --write-out '%{http_code}' \
    --request POST "${TEST_SUPABASE_URL%/}/rest/v1/rpc/save_assessment_draft" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY" \
    --header "Authorization: Bearer $admin_token" \
    --header 'Content-Type: application/json' --data "$attack")"
  if [[ "$status" != "400" ]] ||
     ! jq -e '. == {code:"P0001",details:null,hint:null,message:"Assessment unavailable"}' \
       "$TMP_DIR/admin-save-member-draft.json" >/dev/null 2>&1; then
    echo "Admin HTTP save of member draft was not denied solely for ownership (HTTP $status)" >&2
    exit 1
  fi
  if [[ "$(assessment_admin_draft_privacy_state)" != "$before_state" ]]; then
    echo "Admin draft HTTP checks changed the member draft, assessment, answers, or profile" >&2
    exit 1
  fi

  status="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/owner-recovered-draft.json" --write-out '%{http_code}' \
    --request POST "${TEST_SUPABASE_URL%/}/rest/v1/rpc/get_active_assessment_draft" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY" \
    --header "Authorization: Bearer $OWNER_TOKEN" \
    --header 'Content-Type: application/json' --data '{}')"
  if [[ "$status" != "200" ]] ||
     ! jq -e --argjson expected "$expected_owner" 'del(.serverNow) == $expected' \
       "$TMP_DIR/owner-recovered-draft.json" >/dev/null 2>&1; then
    echo "Owner HTTP recovery did not preserve the original member draft (HTTP $status)" >&2
    exit 1
  fi
  if [[ "$(assessment_admin_draft_privacy_state)" != "$before_state" ]]; then
    echo "Owner draft recovery changed persisted member data" >&2
    exit 1
  fi
  "${PSQL[@]}" >/dev/null -c "DELETE FROM public.pre_tests WHERE id = '$own_pre_test_id'"
  echo "Admin HTTP recovered only its own draft; member draft SELECT/PATCH/DELETE/POST/upsert/save were blocked, all member rows stayed unchanged and owner recovery succeeded."
}

# Both queue orders use distinct real Auth sessions and the same valid roster,
# but opposing answers. The shared worker proves overlap at the database lock.
test_admin_http_concurrent_submit() (
  set -euo pipefail
  local ADMIN_RACE_TOKEN status
  "${PSQL[@]}" >/dev/null -c "
    INSERT INTO public.user_roles (user_id, role) VALUES ('$TEST_ADMIN_USER_ID', 'admin')"
  ADMIN_RACE_TOKEN="$(assessment_admin_http_token)"
  status="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/admin-race-role.json" --write-out '%{http_code}' \
    "${TEST_SUPABASE_URL%/}/rest/v1/user_roles?user_id=eq.$TEST_ADMIN_USER_ID&role=eq.admin&select=user_id,role" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY" \
    --header "Authorization: Bearer $ADMIN_RACE_TOKEN")"
  if [[ "$status" != "200" ]] ||
     ! jq -e --arg admin "$TEST_ADMIN_USER_ID" '. == [{"user_id":$admin,"role":"admin"}]' \
       "$TMP_DIR/admin-race-role.json" >/dev/null 2>&1; then
    echo "Concurrent admin Auth session lacks the application admin role (HTTP $status)" >&2
    exit 1
  fi
  test_concurrent_http_submissions admin-first
  test_concurrent_http_submissions owner-first
  "${PSQL[@]}" >/dev/null -c "
    DELETE FROM public.user_roles WHERE user_id = '$TEST_ADMIN_USER_ID' AND role = 'admin'"
)

test_admin_http_unfinished() {
  local status admin_token before_state
  # Commit the role so the real Auth/PostgREST session sees admin privileges.
  "${PSQL[@]}" >/dev/null <<SQL
INSERT INTO public.user_roles (user_id, role)
VALUES ('$TEST_ADMIN_USER_ID', 'admin');
SQL
  admin_token="$(assessment_admin_http_token)"
  before_state="$(assessment_http_state)"
  if ! jq -e --arg owner "$TEST_USER_ID" \
    '.pre_test.user_id == $owner and .pre_test.status == "in_progress" and
     .pre_test.completed_at == null and .answers == [] and
     .profile.user_id == $owner' >/dev/null <<<"$before_state"; then
    echo "Admin first HTTP submission requires an unfinished owner assessment without saved answers" >&2
    exit 1
  fi

  status="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/admin-unfinished-role.json" --write-out '%{http_code}' \
    "${TEST_SUPABASE_URL%/}/rest/v1/user_roles?user_id=eq.$TEST_ADMIN_USER_ID&role=eq.admin&select=user_id,role" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY" \
    --header "Authorization: Bearer $admin_token")"
  if [[ "$status" != "200" ]] ||
     ! jq -e --arg admin "$TEST_ADMIN_USER_ID" \
       '. == [{"user_id":$admin,"role":"admin"}]' \
       "$TMP_DIR/admin-unfinished-role.json" >/dev/null 2>&1; then
    echo "Admin first HTTP submission lacks the application admin role (HTTP $status)" >&2
    exit 1
  fi
  # Positive control: summary visibility must not imply permission to submit.
  status="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/admin-unfinished-summary.json" --write-out '%{http_code}' \
    "${TEST_SUPABASE_URL%/}/rest/v1/pre_tests?id=eq.$TEST_OWNERSHIP_PRE_TEST_ID&select=id,user_id,status,score,determined_level,correct_answers,total_questions" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY" \
    --header "Authorization: Bearer $admin_token")"
  if [[ "$status" != "200" ]] ||
     ! jq -e --argjson state "$before_state" \
       '. == [$state.pre_test | {id,user_id,status,score,determined_level,correct_answers,total_questions}]' \
       "$TMP_DIR/admin-unfinished-summary.json" >/dev/null 2>&1; then
    echo "Admin cannot read the unfinished member summary (HTTP $status)" >&2
    exit 1
  fi
  test_admin_http_draft_privacy "$admin_token"
  # The privacy check intentionally adds a member draft. Include it in the
  # baseline for the subsequent unauthorized submission check.
  before_state="$(assessment_http_state)"
  # Check the actual database clock immediately before the attack, not a
  # client-side timestamp or the fixture's earlier creation time.
  if [[ "$("${PSQL[@]}" -Atq -c "
    SELECT status = 'in_progress' AND completed_at IS NULL
      AND deadline_at IS NOT NULL
      AND NOT public.assessment_deadline_passed(deadline_at, clock_timestamp())
    FROM public.pre_tests WHERE id = '$TEST_OWNERSHIP_PRE_TEST_ID'")" != "t" ]]; then
    echo "Admin first HTTP submission requires an unfinished, unexpired assessment" >&2
    exit 1
  fi
  status="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/admin-unfinished-rpc.json" --write-out '%{http_code}' \
    --request POST "${TEST_SUPABASE_URL%/}/rest/v1/rpc/submit_assessment" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY" \
    --header "Authorization: Bearer $admin_token" \
    --header 'Content-Type: application/json' \
    --data "$(jq -nc --arg id "$TEST_OWNERSHIP_PRE_TEST_ID" --arg question "$TEST_QUESTION_ID" \
      '{_pre_test_id:$id,_answers:[{question_id:$question,selected_answer:0}]}')")"
  if [[ "$status" != "200" ]] ||
     ! jq -e '. == {"error":"Unauthorized"}' \
       "$TMP_DIR/admin-unfinished-rpc.json" >/dev/null 2>&1; then
    echo "Admin first HTTP submission did not return only Unauthorized (HTTP $status)" >&2
    exit 1
  fi
  # Privileged snapshots include every column, answers, draft and owner profile,
  # so RLS cannot conceal a write made by an accidentally permissive RPC.
  if [[ "$(assessment_http_state)" != "$before_state" ]]; then
    echo "Admin first HTTP submission changed the assessment, answers, draft, or owner profile" >&2
    exit 1
  fi
  "${PSQL[@]}" >/dev/null -c "
    DELETE FROM public.user_roles WHERE user_id = '$TEST_ADMIN_USER_ID' AND role = 'admin'"
  unset admin_token
  echo "Admin HTTP submission of unfinished assessment returned only Unauthorized without changing owner data."
}

test_admin_http_expired() {
  local status admin_token before_state
  "${PSQL[@]}" >/dev/null -c "
    INSERT INTO public.user_roles (user_id, role) VALUES ('$TEST_ADMIN_USER_ID', 'admin')"
  admin_token="$(assessment_admin_http_token)"
  before_state="$(assessment_http_state "$TEST_EXPIRED_PRE_TEST_ID")"
  if ! jq -e --arg owner "$TEST_USER_ID" --arg id "$TEST_EXPIRED_PRE_TEST_ID" \
    '.pre_test.id == $id and .pre_test.user_id == $owner and
     .pre_test.status == "in_progress" and .pre_test.completed_at == null and
     .answers == [] and .draft.pre_test_id == $id and .profile.user_id == $owner' \
    >/dev/null <<<"$before_state"; then
    echo "Admin expired HTTP submission requires an unfinished member assessment, draft and profile" >&2
    exit 1
  fi
  # Verify the real database clock, valid roster/draft and pre-deadline save.
  # A missing draft or invalid payload must not disguise an ownership failure.
  if [[ "$("${PSQL[@]}" -Atq -c "
    SELECT pt.deadline_at IS NOT NULL
      AND public.assessment_deadline_passed(pt.deadline_at, clock_timestamp()) IS TRUE
      AND ad.updated_at < pt.deadline_at
      AND public.validate_assessment_draft(ad.draft) IS TRUE
      AND pt.authorized_question_ids = ARRAY['$TEST_QUESTION_ID'::uuid]
      AND pt.total_questions = 1
      AND ad.draft->>'preTestId' = pt.id::text
      AND ad.draft->'questions' = jsonb_build_array(jsonb_build_object('id', '$TEST_QUESTION_ID'))
      AND ad.draft->'answers'->>'$TEST_QUESTION_ID' = '1'
      AND public.assessment_answers_match_roster(
        jsonb_build_array(jsonb_build_object(
          'question_id', '$TEST_QUESTION_ID', 'selected_answer', 0
        )), pt.authorized_question_ids
      ) IS TRUE
    FROM public.pre_tests pt JOIN public.assessment_drafts ad ON ad.pre_test_id = pt.id
    WHERE pt.id = '$TEST_EXPIRED_PRE_TEST_ID'")" != "t" ]]; then
    echo "Admin expired HTTP submission requires a passed deadline and valid pre-deadline draft/roster" >&2
    exit 1
  fi

  status="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/admin-expired-role.json" --write-out '%{http_code}' \
    "${TEST_SUPABASE_URL%/}/rest/v1/user_roles?user_id=eq.$TEST_ADMIN_USER_ID&role=eq.admin&select=user_id,role" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY" \
    --header "Authorization: Bearer $admin_token")"
  if [[ "$status" != "200" ]] ||
     ! jq -e --arg admin "$TEST_ADMIN_USER_ID" '. == [{"user_id":$admin,"role":"admin"}]' \
       "$TMP_DIR/admin-expired-role.json" >/dev/null 2>&1; then
    echo "Admin expired HTTP submission lacks the application admin role (HTTP $status)" >&2
    exit 1
  fi
  # Positive control with the very same token used to submit below.
  status="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/admin-expired-summary.json" --write-out '%{http_code}' \
    "${TEST_SUPABASE_URL%/}/rest/v1/pre_tests?id=eq.$TEST_EXPIRED_PRE_TEST_ID&select=id,user_id,status,score,determined_level,correct_answers,total_questions" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY" \
    --header "Authorization: Bearer $admin_token")"
  if [[ "$status" != "200" ]] ||
     ! jq -e --argjson state "$before_state" \
       '. == [$state.pre_test | {id,user_id,status,score,determined_level,correct_answers,total_questions}]' \
       "$TMP_DIR/admin-expired-summary.json" >/dev/null 2>&1; then
    echo "Admin cannot read the expired member summary (HTTP $status)" >&2
    exit 1
  fi
  status="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/admin-expired-rpc.json" --write-out '%{http_code}' \
    --request POST "${TEST_SUPABASE_URL%/}/rest/v1/rpc/submit_assessment" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY" \
    --header "Authorization: Bearer $admin_token" \
    --header 'Content-Type: application/json' \
    --data "$(jq -nc --arg id "$TEST_EXPIRED_PRE_TEST_ID" --arg question "$TEST_QUESTION_ID" \
      '{_pre_test_id:$id,_answers:[{question_id:$question,selected_answer:0}]}')")"
  if [[ "$status" != "200" ]] ||
     ! jq -e '. == {"error":"Unauthorized"}' "$TMP_DIR/admin-expired-rpc.json" >/dev/null 2>&1; then
    echo "Admin expired HTTP submission did not return only Unauthorized (HTTP $status)" >&2
    exit 1
  fi
  if [[ "$(assessment_http_state "$TEST_EXPIRED_PRE_TEST_ID")" != "$before_state" ]]; then
    echo "Admin expired HTTP submission changed the assessment, answers, draft, or full owner profile" >&2
    exit 1
  fi
  "${PSQL[@]}" >/dev/null -c "
    DELETE FROM public.user_roles WHERE user_id = '$TEST_ADMIN_USER_ID' AND role = 'admin'"
  unset admin_token ADMIN_PASSWORD
  echo "Admin HTTP read the expired member summary but submission returned only Unauthorized without changing assessment, answers, draft or profile."
}

test_admin_http_profile_revocation() {
  local admin_token status expected_before expected_own profiles_before filter
  local member_before own_before own_after payload own_name

  # Auth's signup trigger supplies both profiles. Fail rather than accepting
  # empty fixture data as evidence that the profile policy works.
  profiles_before="$("${PSQL[@]}" -Atq -c "
    SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.user_id), '[]'::jsonb)
    FROM public.profiles p
    WHERE p.user_id IN ('$TEST_USER_ID', '$TEST_ADMIN_USER_ID')")"
  if ! jq -e --arg owner "$TEST_USER_ID" --arg admin "$TEST_ADMIN_USER_ID" \
    'length == 2 and (map(.user_id) | sort) == ([$owner,$admin] | sort)' \
    >/dev/null <<<"$profiles_before"; then
    echo "Profile revocation requires distinct, existing owner and admin profiles" >&2
    exit 1
  fi
  expected_before="$(jq 'map({id,user_id}) | sort_by(.user_id)' <<<"$profiles_before")"
  expected_own="$(jq --arg admin "$TEST_ADMIN_USER_ID" \
    'map(select(.user_id == $admin) | {id,user_id})' <<<"$profiles_before")"
  member_before="$(jq -c --arg owner "$TEST_USER_ID" \
    '.[] | select(.user_id == $owner)' <<<"$profiles_before")"
  own_before="$(jq -c --arg admin "$TEST_ADMIN_USER_ID" \
    '.[] | select(.user_id == $admin)' <<<"$profiles_before")"
  "${PSQL[@]}" >/dev/null <<SQL
BEGIN;
INSERT INTO public.user_roles (user_id, role)
VALUES ('$TEST_ADMIN_USER_ID', 'admin');
COMMIT;
SQL
  admin_token="$(assessment_admin_http_token)"
  filter="user_id=in.($TEST_USER_ID,$TEST_ADMIN_USER_ID)&select=id,user_id&order=user_id"
  status="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/admin-profiles-before-revocation.json" --write-out '%{http_code}' \
    "${TEST_SUPABASE_URL%/}/rest/v1/profiles?$filter" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY" \
    --header "Authorization: Bearer $admin_token")"
  if [[ "$status" != "200" ]] ||
     ! jq -e --argjson expected "$expected_before" '. == $expected' \
       "$TMP_DIR/admin-profiles-before-revocation.json" >/dev/null 2>&1; then
    echo "Admin HTTP token cannot read both member and own profiles before revocation (HTTP $status)" >&2
    exit 1
  fi

  # Commit on the privileged fixture connection before the next HTTP read.
  # Keep the exact same access token: no login, refresh, or service-role read.
  "${PSQL[@]}" >/dev/null <<SQL
BEGIN;
DELETE FROM public.user_roles
WHERE user_id = '$TEST_ADMIN_USER_ID' AND role = 'admin';
DO \$\$
BEGIN
  IF public.has_role('$TEST_ADMIN_USER_ID', 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Profile revocation fixture still has effective admin access';
  END IF;
END;
\$\$;
COMMIT;
SQL
  status="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/admin-profiles-after-revocation.json" --write-out '%{http_code}' \
    "${TEST_SUPABASE_URL%/}/rest/v1/profiles?$filter" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY" \
    --header "Authorization: Bearer $admin_token")"
  if [[ "$status" != "200" ]] ||
     ! jq -e --argjson expected "$expected_own" '. == $expected' \
       "$TMP_DIR/admin-profiles-after-revocation.json" >/dev/null 2>&1; then
    echo "Revoked admin's unchanged HTTP token must read only their own profile (HTTP $status)" >&2
    exit 1
  fi
  status="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/revoked-admin-member-profile.json" --write-out '%{http_code}' \
    "${TEST_SUPABASE_URL%/}/rest/v1/profiles?user_id=eq.$TEST_USER_ID&select=id,user_id" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY" \
    --header "Authorization: Bearer $admin_token")"
  if [[ "$status" != "200" ]] ||
     ! jq -e '. == []' "$TMP_DIR/revoked-admin-member-profile.json" >/dev/null 2>&1; then
    echo "Revoked admin's unchanged HTTP token exposed a member profile or failed (HTTP $status)" >&2
    exit 1
  fi
  if [[ "$("${PSQL[@]}" -Atq -c "
    SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.user_id), '[]'::jsonb)
    FROM public.profiles p
    WHERE p.user_id IN ('$TEST_USER_ID', '$TEST_ADMIN_USER_ID')")" != "$profiles_before" ]]; then
    echo "Profile revocation checks changed or removed a fixture profile" >&2
    exit 1
  fi

  # A valid, changed editable field ensures validation cannot masquerade as
  # revoked UPDATE access. Inspect the whole persisted victim row via the
  # privileged fixture, never via the now-filtered HTTP SELECT or service role.
  payload="$(jq -nc --arg name "$(jq -r '.full_name' <<<"$member_before") (blocked edit)" \
    '{full_name:$name}')"
  status="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/revoked-admin-patch-member-profile.json" --write-out '%{http_code}' \
    --request PATCH "${TEST_SUPABASE_URL%/}/rest/v1/profiles?user_id=eq.$TEST_USER_ID" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY" \
    --header "Authorization: Bearer $admin_token" \
    --header 'Prefer: return=representation' \
    --header 'Content-Type: application/json' --data "$payload")"
  if [[ "$status" == "403" ]]; then
    if ! jq -e '.code == "42501" and
      (.message == "permission denied for table profiles" or
       .message == "new row violates row-level security policy for table \"profiles\"")' \
      "$TMP_DIR/revoked-admin-patch-member-profile.json" >/dev/null 2>&1; then
      echo "Revoked admin profile PATCH failed for an unexpected reason" >&2
      exit 1
    fi
  elif [[ "$status" != "200" ]] ||
       ! jq -e '. == []' "$TMP_DIR/revoked-admin-patch-member-profile.json" >/dev/null 2>&1; then
    echo "Revoked admin member profile PATCH was not denied or a row-free no-op (HTTP $status)" >&2
    exit 1
  fi
  if [[ "$("${PSQL[@]}" -Atq -c "
    SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.user_id), '[]'::jsonb)
    FROM public.profiles p
    WHERE p.user_id IN ('$TEST_USER_ID', '$TEST_ADMIN_USER_ID')")" != "$profiles_before" ]]; then
    echo "Revoked admin member profile PATCH changed or removed a full fixture row" >&2
    exit 1
  fi

  # Positive UPDATE control with the exact same token after COMMIT: a stale
  # session, malformed payload, or deny-all UPDATE policy must not pass.
  own_name="$(jq -r '.full_name' <<<"$own_before") (allowed self edit)"
  payload="$(jq -nc --arg name "$own_name" '{full_name:$name}')"
  status="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/revoked-admin-patch-own-profile.json" --write-out '%{http_code}' \
    --request PATCH "${TEST_SUPABASE_URL%/}/rest/v1/profiles?user_id=eq.$TEST_ADMIN_USER_ID" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY" \
    --header "Authorization: Bearer $admin_token" \
    --header 'Prefer: return=representation' \
    --header 'Content-Type: application/json' --data "$payload")"
  if [[ "$status" != "200" ]] ||
     ! jq -e --argjson before "$own_before" --arg name "$own_name" \
       'length == 1 and
        (.[0] | del(.updated_at)) == ($before | .full_name = $name | del(.updated_at))' \
       "$TMP_DIR/revoked-admin-patch-own-profile.json" >/dev/null 2>&1; then
    echo "Revoked admin's unchanged HTTP token could not edit only their own profile name (HTTP $status)" >&2
    exit 1
  fi
  own_after="$("${PSQL[@]}" -Atq -c "
    SELECT to_jsonb(p) FROM public.profiles p WHERE p.user_id = '$TEST_ADMIN_USER_ID'")"
  if ! jq -e --argjson persisted "$own_after" '. == [$persisted]' \
       "$TMP_DIR/revoked-admin-patch-own-profile.json" >/dev/null 2>&1; then
    echo "Own-profile HTTP PATCH did not persist its returned full row" >&2
    exit 1
  fi
  if [[ "$("${PSQL[@]}" -Atq -c "
    SELECT to_jsonb(p) FROM public.profiles p WHERE p.user_id = '$TEST_USER_ID'" | jq -c .)" != "$member_before" ]]; then
    echo "Own-profile HTTP PATCH changed or removed the member's full profile row" >&2
    exit 1
  fi
  unset admin_token
  echo "Admin HTTP read both profiles before revocation; the unchanged token then hid and could not PATCH the member profile, preserved the full member row, and successfully updated only its own profile name."
}

test_admin_http_replay() {
  local status admin_token before_state payload label own_summary
  local own_pre_test_id="00000000-0000-4000-8000-000000000181"

  # Commit the application role so PostgREST's separate connections see it.
  # Remove it below before the existing transactional table-policy tests.
  "${PSQL[@]}" >/dev/null <<SQL
INSERT INTO public.user_roles (user_id, role)
VALUES ('$TEST_ADMIN_USER_ID', 'admin');
INSERT INTO public.pre_tests (
  id, user_id, total_questions, status, score,
  determined_level, correct_answers, completed_at
)
VALUES (
  '$own_pre_test_id', '$TEST_ADMIN_USER_ID', 1, 'completed', 100,
  'Utama', 1, now()
);
SQL
  own_summary="$("${PSQL[@]}" -Atq -c "
    SELECT jsonb_build_object(
      'id', id, 'user_id', user_id, 'status', status, 'score', score,
      'determined_level', determined_level, 'correct_answers', correct_answers,
      'total_questions', total_questions
    ) FROM public.pre_tests WHERE id = '$own_pre_test_id'")"

  admin_token="$(assessment_admin_http_token)"
  before_state="$(assessment_http_state)"
  if ! jq -e --arg owner "$TEST_USER_ID" \
    '.pre_test.user_id == $owner and .pre_test.status == "completed" and
     (.answers | length) == 1 and .profile.user_id == $owner' \
    >/dev/null <<<"$before_state"; then
    echo "Admin HTTP replay requires a completed owner assessment, answer and profile" >&2
    exit 1
  fi

  status="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/admin-role-response.json" --write-out '%{http_code}' \
    "${TEST_SUPABASE_URL%/}/rest/v1/user_roles?user_id=eq.$TEST_ADMIN_USER_ID&role=eq.admin&select=user_id,role" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY" \
    --header "Authorization: Bearer $admin_token")"
  if [[ "$status" != "200" ]] ||
     ! jq -e --arg admin "$TEST_ADMIN_USER_ID" \
       '. == [{"user_id":$admin,"role":"admin"}]' \
       "$TMP_DIR/admin-role-response.json" >/dev/null 2>&1; then
    echo "Admin HTTP replay session does not have the application admin role (HTTP $status)" >&2
    exit 1
  fi

  # Positive control: the same token can read the member's stored summary.
  status="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/admin-summary-response.json" --write-out '%{http_code}' \
    "${TEST_SUPABASE_URL%/}/rest/v1/pre_tests?id=eq.$TEST_OWNERSHIP_PRE_TEST_ID&select=id,user_id,status,score,determined_level,correct_answers,total_questions" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY" \
    --header "Authorization: Bearer $admin_token")"
  if [[ "$status" != "200" ]] ||
     ! jq -e --argjson state "$before_state" \
       '. == [$state.pre_test | {id,user_id,status,score,determined_level,correct_answers,total_questions}]' \
       "$TMP_DIR/admin-summary-response.json" >/dev/null 2>&1; then
    echo "Admin HTTP session cannot read the member's saved summary (HTTP $status)" >&2
    exit 1
  fi

  status="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/admin-answers-response.json" --write-out '%{http_code}' \
    "${TEST_SUPABASE_URL%/}/rest/v1/pre_test_answers?pre_test_id=eq.$TEST_OWNERSHIP_PRE_TEST_ID" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY" \
    --header "Authorization: Bearer $admin_token")"
  if [[ "$status" != "200" ]] ||
     ! jq -e '. == []' "$TMP_DIR/admin-answers-response.json" >/dev/null 2>&1; then
    echo "Admin HTTP table read exposed the member's per-question answers (HTTP $status)" >&2
    exit 1
  fi
  if [[ "$(assessment_http_state)" != "$before_state" ]]; then
    echo "Admin HTTP reads changed the assessment, answers, or owner profile" >&2
    exit 1
  fi

  # Check an ordinary replay and an empty replay. Exact equality rejects any
  # result leakage, including an error object with extra score/answer fields.
  for label in changed-answer empty-answers; do
    payload='[]'
    if [[ "$label" == "changed-answer" ]]; then
      payload="$(jq -nc --arg question "$TEST_QUESTION_ID" \
        '[{question_id:$question,selected_answer:0}]')"
    fi
    status="$(curl --silent --show-error --max-time 15 \
      --output "$TMP_DIR/admin-rpc-$label-response.json" --write-out '%{http_code}' \
      --request POST "${TEST_SUPABASE_URL%/}/rest/v1/rpc/submit_assessment" \
      --header "apikey: $TEST_SUPABASE_ANON_KEY" \
      --header "Authorization: Bearer $admin_token" \
      --header 'Content-Type: application/json' \
      --data "$(jq -nc --arg id "$TEST_OWNERSHIP_PRE_TEST_ID" --argjson answers "$payload" \
        '{_pre_test_id:$id,_answers:$answers}')")"
    if [[ "$status" != "200" ]] ||
       ! jq -e '. == {"error":"Unauthorized"}' \
         "$TMP_DIR/admin-rpc-$label-response.json" >/dev/null 2>&1; then
      echo "Admin HTTP assessment replay ($label) did not return only Unauthorized (HTTP $status)" >&2
      exit 1
    fi
    # Use privileged full-row snapshots: the admin's RLS view hides answers
    # and would otherwise conceal a write by an accidentally permissive RPC.
    if [[ "$(assessment_http_state)" != "$before_state" ]]; then
      echo "Admin HTTP replay ($label) changed the assessment, answers, or owner profile" >&2
      exit 1
    fi
  done
  # Commit revocation through the privileged fixture connection. Do not sign
  # in, refresh, or replace admin_token: PostgREST must apply the new database
  # role membership to the very same Auth session on its next request.
  "${PSQL[@]}" >/dev/null <<SQL
DELETE FROM public.user_roles
WHERE user_id = '$TEST_ADMIN_USER_ID' AND role = 'admin';
DO \$\$
BEGIN
  IF public.has_role('$TEST_ADMIN_USER_ID', 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'HTTP revocation fixture still has effective admin access';
  END IF;
END;
\$\$;
SQL
  status="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/revoked-admin-member-summary.json" --write-out '%{http_code}' \
    "${TEST_SUPABASE_URL%/}/rest/v1/pre_tests?id=eq.$TEST_OWNERSHIP_PRE_TEST_ID&select=id,user_id,status,score,determined_level,correct_answers,total_questions" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY" \
    --header "Authorization: Bearer $admin_token")"
  if [[ "$status" != "200" ]] ||
     ! jq -e '. == []' "$TMP_DIR/revoked-admin-member-summary.json" >/dev/null 2>&1; then
    echo "Revoked admin's unchanged HTTP token can still read a member result or failed (HTTP $status)" >&2
    exit 1
  fi

  # Positive control: an expired/rejected token or a deny-all SELECT policy
  # must not masquerade as successful revocation of access to other members.
  status="$(curl --silent --show-error --max-time 15 \
    --output "$TMP_DIR/revoked-admin-own-summary.json" --write-out '%{http_code}' \
    "${TEST_SUPABASE_URL%/}/rest/v1/pre_tests?id=eq.$own_pre_test_id&select=id,user_id,status,score,determined_level,correct_answers,total_questions" \
    --header "apikey: $TEST_SUPABASE_ANON_KEY" \
    --header "Authorization: Bearer $admin_token")"
  if [[ "$status" != "200" ]] ||
     ! jq -e --argjson expected "$own_summary" '. == [$expected]' \
       "$TMP_DIR/revoked-admin-own-summary.json" >/dev/null 2>&1; then
    echo "Revoked admin's unchanged HTTP token cannot read their own saved result (HTTP $status)" >&2
    exit 1
  fi
  if [[ "$(assessment_http_state)" != "$before_state" ]]; then
    echo "Admin HTTP revocation checks changed the member assessment, answers, or profile" >&2
    exit 1
  fi
  unset admin_token
  "${PSQL[@]}" >/dev/null <<SQL
DELETE FROM public.pre_tests WHERE id = '$own_pre_test_id';
SQL
  echo "Admin HTTP summary access succeeded; per-question answers stayed hidden and RPC replays were denied without changing owner data."
  echo "After admin revocation, the unchanged HTTP token hid the member result and still returned the admin's own saved result."
}
