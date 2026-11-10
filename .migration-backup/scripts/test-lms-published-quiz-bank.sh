#!/usr/bin/env bash
# Isolated local PostgreSQL only; never reads a hosted connection string.
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
PSQL=(psql -X -U postgres -v ON_ERROR_STOP=1 -h "$TMP" -p "$PORT" -d postgres)
"${PSQL[@]}" -f "$ROOT/supabase/tests/aspekindo_lms_quiz_local_schema.sql" >/dev/null
"${PSQL[@]}" <<'SQL' >/dev/null
ALTER TABLE public.aspekindo_lms_quiz_answer_keys
  DROP CONSTRAINT aspekindo_lms_quiz_answer_keys_question_id_fkey,
  ADD FOREIGN KEY (question_id) REFERENCES public.aspekindo_lms_quiz_questions(id) ON DELETE CASCADE;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.aspekindo_lms_lessons,
  public.aspekindo_lms_quiz_questions, public.aspekindo_lms_quiz_answer_keys TO authenticated;
INSERT INTO public.aspekindo_lms_lessons(id, passing_score, is_published)
VALUES ('00000000-0000-0000-0000-000000000001', 70, true);
INSERT INTO public.aspekindo_lms_quiz_questions(id, lesson_id, question_text, options, points)
VALUES ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Soal', '["A","B","C"]', 1),
       ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Soal lain', '["A","B"]', 1);
INSERT INTO public.aspekindo_lms_quiz_answer_keys(question_id, correct_option)
VALUES ('00000000-0000-0000-0000-000000000011', 2), ('00000000-0000-0000-0000-000000000012', 0);
SQL
# Deliberately skip the earlier guard: hosted may not have installed it.
"${PSQL[@]}" -f "$ROOT/supabase/migrations/20261101100000_enforce_lms_lesson_publication.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/tests/aspekindo_lms_lesson_publication.sql" >/dev/null
"${PSQL[@]}" -f "$ROOT/supabase/tests/aspekindo_lms_published_quiz_bank.sql" >/dev/null

# The first transaction holds the lesson mutex while deleting q2. Wait until it
# actually acquired the mutex (a psql-side marker), not an arbitrary sleep.
for isolation in "READ COMMITTED" "REPEATABLE READ"; do
  "${PSQL[@]}" <<'SQL' >/dev/null
BEGIN;
INSERT INTO public.aspekindo_lms_quiz_questions(id, lesson_id, question_text, options, points)
VALUES ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Soal lain', '["A","B"]', 1);
INSERT INTO public.aspekindo_lms_quiz_answer_keys(question_id, correct_option)
VALUES ('00000000-0000-0000-0000-000000000012', 0);
COMMIT;
SQL
  rm -f "$TMP/locked"
  "${PSQL[@]}" >"$TMP/first.log" 2>&1 <<SQL &
BEGIN ISOLATION LEVEL $isolation;
SET LOCAL ROLE authenticated;
DELETE FROM public.aspekindo_lms_quiz_questions WHERE id = '00000000-0000-0000-0000-000000000012';
\! touch "$TMP/locked"
SELECT pg_sleep(1);
COMMIT;
SQL
  first_pid=$!
  for (( n=0; n<100; n++ )); do
    [[ -f "$TMP/locked" ]] && break
    sleep 0.02
  done
  [[ -f "$TMP/locked" ]] || { cat "$TMP/first.log"; exit 1; }
  if "${PSQL[@]}" >"$TMP/second.log" 2>&1 <<SQL
BEGIN ISOLATION LEVEL $isolation;
SET LOCAL ROLE authenticated;
SET LOCAL statement_timeout = '5s';
DELETE FROM public.aspekindo_lms_quiz_questions WHERE id = '00000000-0000-0000-0000-000000000011';
COMMIT;
SQL
  then
    echo "Concurrent deletion unexpectedly succeeded ($isolation)" >&2
    exit 1
  fi
  wait "$first_pid" || { cat "$TMP/first.log"; exit 1; }
  grep -Eq 'minimal satu soal valid|could not serialize access' "$TMP/second.log" || { cat "$TMP/second.log"; exit 1; }
  [[ "$("${PSQL[@]}" -Atc "SELECT count(*) FROM public.aspekindo_lms_quiz_questions")" == 1 ]]
  echo "Concurrent delete protected ($isolation)."
done

# Publication and bank writes must share the same mutex in BOTH orders.
# Exercise question deletion and key invalidation under both isolation levels.
for isolation in "READ COMMITTED" "REPEATABLE READ"; do
  for mutation in delete-question invalidate-key; do
    for first_writer in publisher bank; do
      "${PSQL[@]}" <<'SQL' >/dev/null
BEGIN;
UPDATE public.aspekindo_lms_lessons SET is_published = false
WHERE id = '00000000-0000-0000-0000-000000000001';
INSERT INTO public.aspekindo_lms_quiz_questions(id, lesson_id, question_text, options, points)
VALUES ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001',
        'Soal', '["A","B"]', 1)
ON CONFLICT (id) DO UPDATE SET options = EXCLUDED.options;
INSERT INTO public.aspekindo_lms_quiz_answer_keys(question_id, correct_option)
VALUES ('00000000-0000-0000-0000-000000000011', 0)
ON CONFLICT (question_id) DO UPDATE SET correct_option = 0;
COMMIT;
SQL
      publish_sql="UPDATE public.aspekindo_lms_lessons SET is_published = true WHERE id = '00000000-0000-0000-0000-000000000001';"
      if [[ "$mutation" == delete-question ]]; then
        bank_sql="DELETE FROM public.aspekindo_lms_quiz_questions WHERE id = '00000000-0000-0000-0000-000000000011';"
      else
        bank_sql="UPDATE public.aspekindo_lms_quiz_answer_keys SET correct_option = 9 WHERE question_id = '00000000-0000-0000-0000-000000000011';"
      fi
      if [[ "$first_writer" == publisher ]]; then
        first_sql="$publish_sql"; second_sql="$bank_sql"
      else
        first_sql="$bank_sql"; second_sql="$publish_sql"
      fi
      rm -f "$TMP/locked"
      "${PSQL[@]}" >"$TMP/first.log" 2>&1 <<SQL &
BEGIN ISOLATION LEVEL $isolation;
SET LOCAL ROLE authenticated;
$first_sql
\! touch "$TMP/locked"
SELECT pg_sleep(1);
COMMIT;
SQL
      first_pid=$!
      for (( n=0; n<100; n++ )); do
        [[ -f "$TMP/locked" ]] && break
        sleep 0.02
      done
      [[ -f "$TMP/locked" ]] || { cat "$TMP/first.log"; exit 1; }
      if "${PSQL[@]}" >"$TMP/second.log" 2>&1 <<SQL
\set VERBOSITY verbose
BEGIN ISOLATION LEVEL $isolation;
SET LOCAL ROLE authenticated;
SET LOCAL statement_timeout = '5s';
-- Establish a snapshot before waiting on the first writer's lesson row.
SELECT count(*) FROM public.aspekindo_lms_quiz_questions;
$second_sql
COMMIT;
SQL
      then
        echo "Publication race unexpectedly succeeded ($isolation/$mutation/$first_writer)" >&2
        exit 1
      fi
      wait "$first_pid" || { cat "$TMP/first.log"; exit 1; }
      # Timeouts/deadlocks are NOT evidence that the invariant was enforced.
      grep -Eq '23514:.*minimal satu soal valid|40001:.*could not serialize access' "$TMP/second.log" ||
        { cat "$TMP/second.log"; exit 1; }
      expected=false
      [[ "$first_writer" == publisher ]] && expected=true
      [[ "$("${PSQL[@]}" -Atc "SELECT is_published::text FROM public.aspekindo_lms_lessons WHERE id = '00000000-0000-0000-0000-000000000001'")" == "$expected" ]]
      echo "Publication race protected ($isolation/$mutation/$first_writer first)."
    done
  done
done
echo "Published quiz bank database safeguards passed."
