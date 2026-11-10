#!/usr/bin/env bash
# Default: isolated PostgreSQL RPC test. --supabase: fully migrated local Supabase.
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if [[ "${1:-}" == "--supabase" && "$#" == 1 ]]; then
  # Never fall back to DATABASE_URL (which may point at a hosted project).
  TEST_DATABASE_URL="${TEST_DATABASE_URL:?Set TEST_DATABASE_URL to local Supabase}"
  python3 - "$TEST_DATABASE_URL" <<'PY'
import sys
from urllib.parse import urlsplit

url = urlsplit(sys.argv[1])
if not (
    url.scheme in ("postgres", "postgresql")
    and url.hostname in ("127.0.0.1", "localhost")
    and url.port == 54322
    and url.path == "/postgres"
    and url.username == "postgres"
    and not url.query and not url.fragment
):
    sys.exit("Quiz authority tests require local Supabase on port 54322; hosted URLs are forbidden")
PY
  # libpq environment overrides must not reroute the checked loopback URL.
  for variable in ${!PG@}; do unset "$variable"; done
  versions="$(find "$ROOT/supabase/migrations" -name '*.sql' -printf '%f\n' | cut -d_ -f1 | sort -u | paste -sd,)"
  psql -X "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 \
    -v full_schema=true -v expected_migrations="$versions" \
    -f "$ROOT/supabase/tests/aspekindo_lms_quiz_authority.sql"
  python3 "$ROOT/scripts/test-lms-quiz-submit-concurrency.py"
  echo "LMS quiz authority test passed (fully migrated local Supabase, authenticated role)."
  exit 0
elif (( $# )); then
  echo "Usage: $0 [--supabase]" >&2
  exit 2
fi

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
PSQL=(psql -X -U postgres -v ON_ERROR_STOP=1 -h "$TMP" -p "$PORT" -d postgres)
"${PSQL[@]}" -f "$ROOT/supabase/tests/aspekindo_lms_quiz_local_schema.sql" >/dev/null

# Load the real migrated RPC bodies instead of maintaining a second copy in
# the test harness. The later migration replaces the lesson completion RPC.
python3 - "$ROOT/supabase/migrations" "$TMP/functions.sql" <<'PY'
from pathlib import Path
import sys

migrations, output = Path(sys.argv[1]), Path(sys.argv[2])
functions = [
    ("20261101110000_snapshot_lms_quiz_grading.sql", "submit_aspekindo_lms_quiz"),
    ("20260901020000_harden_aspekindo_lms_participant_flows.sql", "complete_aspekindo_lms_lesson"),
]
with output.open("w") as target:
    for filename, name in functions:
        source = (migrations / filename).read_text()
        start = source.index(f"CREATE OR REPLACE FUNCTION public.{name}(")
        end = source.index("\n$$;", start) + len("\n$$;")
        target.write(source[start:end] + "\n")
PY
"${PSQL[@]}" -f "$TMP/functions.sql" >/dev/null
"${PSQL[@]}" -v full_schema=false -f "$ROOT/supabase/tests/aspekindo_lms_quiz_authority.sql" >/dev/null
python3 "$ROOT/scripts/test-lms-quiz-grading-concurrency.py" "${PSQL[@]}"
echo "LMS quiz scoring and completion RPC test passed (isolated local PostgreSQL)."