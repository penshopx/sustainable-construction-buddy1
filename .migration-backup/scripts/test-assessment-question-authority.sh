#!/usr/bin/env bash
# Runs the real scoring migrations in disposable PostgreSQL. No hosted URL.
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
"${PSQL[@]}" -f "$ROOT/supabase/tests/assessment-question-authority-local-schema.sql" >/dev/null
for migration in \
  20260928100000_assessment_server_drafts \
  20260928110000_assessment_server_deadline \
  20260928111000_assessment_scoring_idempotent \
  20261029100000_assessment_draft_conflicts; do
  "${PSQL[@]}" -f "$ROOT/supabase/migrations/$migration.sql" >/dev/null
done
"${PSQL[@]}" -f "$ROOT/supabase/tests/assessment-question-authority-legacy.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261031100000_assessment_question_authority.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/tests/assessment-question-authority.sql"
echo "Assessment question authority tests passed (isolated PostgreSQL, real scorer)."
