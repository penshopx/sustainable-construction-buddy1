#!/usr/bin/env bash
# Isolated PostgreSQL only. Never reads a hosted database URL.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TMP="$(mktemp -d)"
PORT=$((50000 + $$ % 10000))
started=0
cleanup() {
  if (( started )); then pg_ctl -D "$TMP/db" -m immediate stop >/dev/null; fi
  rm -rf "$TMP"
}
trap cleanup EXIT
initdb -D "$TMP/db" -U postgres -A trust --no-instructions >/dev/null
pg_ctl -D "$TMP/db" -o "-c listen_addresses='' -k $TMP -p $PORT" -l "$TMP/server.log" start >/dev/null
started=1
PSQL=(psql -X -v ON_ERROR_STOP=1 -h "$TMP" -p "$PORT" -U postgres -d postgres)
"${PSQL[@]}" -f "$ROOT/supabase/tests/assessment-draft-local-schema.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20260928100000_assessment_server_drafts.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20260928110000_assessment_server_deadline.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261029100000_assessment_draft_conflicts.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/tests/assessment-draft-conflicts.sql" >/dev/null

# Two actual connections race with the same version. Exactly one may commit.
for choice in 0 1; do
  "${PSQL[@]}" -Atc "
    SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
    SELECT public.save_assessment_draft(
      '00000000-0000-4000-8000-000000000010',
      draft || jsonb_build_object('revision', 0, 'answers', jsonb_build_object('q1', $choice))
    )->>'saved' FROM public.assessment_drafts
    WHERE pre_test_id = '00000000-0000-4000-8000-000000000010';" >"$TMP/result-$choice" &
done
wait
test "$(cat "$TMP"/result-* | grep -c '^true$')" = 1
test "$(cat "$TMP"/result-* | grep -c '^false$')" = 1

# Hold B's save transaction open while A submits its stale pre-sync array.
# The FIFO is a deterministic barrier: A starts only after B has saved q2
# while holding the pre-test lock, and must wait for B's commit.
mkfifo "$TMP/save-ready"
cat >"$TMP/save.sql" <<SQL
BEGIN;
SET LOCAL request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
SELECT public.save_assessment_draft(
  '00000000-0000-4000-8000-000000000011',
  draft || '{"answers":{"q1":0,"q2":1}}'::jsonb
) FROM public.assessment_drafts WHERE pre_test_id = '00000000-0000-4000-8000-000000000011';
\\! echo ready > "$TMP/save-ready"
SELECT pg_sleep(0.5);
COMMIT;
SQL
"${PSQL[@]}" -f "$TMP/save.sql" >"$TMP/save-result" &
save_pid=$!
read -r ready <"$TMP/save-ready"
test "$ready" = ready
"${PSQL[@]}" <<'SQL' >/dev/null
SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
DO $$
DECLARE _result jsonb;
BEGIN
  _result := public.submit_assessment('00000000-0000-4000-8000-000000000011',
    '[{"question_id":"q1","selected_answer":0},{"question_id":"q2","selected_answer":-1}]'::jsonb);
  IF _result->'answers' IS DISTINCT FROM '[{"question_id":"q1","selected_answer":0},{"question_id":"q2","selected_answer":1}]'::jsonb THEN
    RAISE EXCEPTION 'Concurrent submission lost device B answer: %', _result;
  END IF;
END $$;
SQL
wait "$save_pid"
echo "Assessment draft tests passed (isolated PostgreSQL: concurrent saves, save-vs-submit, expiry and idempotency)."
