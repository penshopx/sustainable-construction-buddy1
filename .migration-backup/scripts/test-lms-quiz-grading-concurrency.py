#!/usr/bin/env python3
"""Two real psql connections; only called inside the isolated local PG runner."""
import json
import queue
import subprocess
import sys
import threading
from pathlib import Path

PSQL = sys.argv[1:]


class Connection:
    def __init__(self):
        self.process = subprocess.Popen(
            [*PSQL, "-qAt"], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT, text=True, bufsize=1,
        )
        self.lines = queue.Queue()
        self.sequence = 0

        def read():
            for line in self.process.stdout:
                self.lines.put(line.rstrip())
            self.lines.put(None)

        threading.Thread(target=read, daemon=True).start()

    def execute(self, sql):
        self.sequence += 1
        marker = f"command_finished_{self.sequence}"
        self.process.stdin.write(sql + f"\n\\echo {marker}\n")
        self.process.stdin.flush()
        output = []
        while True:
            try:
                line = self.lines.get(timeout=20)
            except queue.Empty:
                raise AssertionError("Timed out waiting for admin connection") from None
            if line is None:
                raise AssertionError("\n".join(output))
            if line == marker:
                return "\n".join(output)
            output.append(line)

    def close(self):
        if self.process.poll() is None:
            self.process.terminate()
        self.process.communicate(timeout=5)


def uid(number):
    return f"00000000-0000-4000-8000-{number:012d}"


user, course, lesson, enrollment, first, second, extra = map(uid, range(801, 808))
admin = Connection()
submission = None
try:
    admin.execute(f"""
SET statement_timeout = '15s';
CREATE FUNCTION public.test_pause_quiz_grading() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- The attempt is inserted AFTER the denominator has been read, but BEFORE
  -- individual answers are graded. No timing assumptions or grader edits.
  PERFORM pg_advisory_xact_lock(129, 1);
  RETURN NEW;
END;
$$;
CREATE TRIGGER test_pause_quiz_grading
BEFORE INSERT ON public.aspekindo_lms_quiz_attempts
FOR EACH ROW EXECUTE FUNCTION public.test_pause_quiz_grading();
INSERT INTO auth.users(id) VALUES ('{user}');
INSERT INTO public.aspekindo_lms_courses(id) VALUES ('{course}');
INSERT INTO public.aspekindo_lms_lessons(id, course_id, passing_score, is_published)
VALUES ('{lesson}', '{course}', 70, true);
INSERT INTO public.aspekindo_lms_enrollments(id, course_id, user_id)
VALUES ('{enrollment}', '{course}', '{user}');
""")
    mutations = {
        "points": f"UPDATE public.aspekindo_lms_quiz_questions SET points = 30 WHERE id = '{first}';",
        "key": f"UPDATE public.aspekindo_lms_quiz_answer_keys SET correct_option = 0 WHERE question_id = '{first}';",
        "add": f"""
INSERT INTO public.aspekindo_lms_quiz_questions(id, lesson_id, question_text, options, points)
VALUES ('{extra}', '{lesson}', 'Extra?', '["A","B"]', 90);
INSERT INTO public.aspekindo_lms_quiz_answer_keys VALUES ('{extra}', 0);
""",
        "delete": f"""
DELETE FROM public.aspekindo_lms_quiz_answer_keys WHERE question_id = '{second}';
DELETE FROM public.aspekindo_lms_quiz_questions WHERE id = '{second}';
""",
    }
    # Exercise the actual admin mutation guards as well as bare table writes.
    # READ COMMITTED is the PostgREST default; RR also must never mix versions.
    for guarded in (False, True):
        if guarded:
            migration = (
                Path(__file__).resolve().parents[1]
                / "supabase/migrations/20261101100000_enforce_lms_lesson_publication.sql"
            )
            admin.execute(migration.read_text())
        for isolation in ("READ COMMITTED", "REPEATABLE READ"):
            for scenario, mutation in mutations.items():
                admin.execute(f"""
BEGIN;
DELETE FROM public.aspekindo_lms_quiz_answers;
DELETE FROM public.aspekindo_lms_quiz_attempts;
DELETE FROM public.aspekindo_lms_quiz_answer_keys;
DELETE FROM public.aspekindo_lms_quiz_questions;
INSERT INTO public.aspekindo_lms_quiz_questions(id, lesson_id, question_text, options, points)
VALUES ('{first}', '{lesson}', 'First?', '["A","B"]', 3),
       ('{second}', '{lesson}', 'Second?', '["A","B"]', 7);
INSERT INTO public.aspekindo_lms_quiz_answer_keys VALUES ('{first}', 1), ('{second}', 0);
COMMIT;
SELECT pg_advisory_lock(129, 1);
""")
                # This connection runs as the member, not as the database owner.
                submission = subprocess.Popen(
                    [*PSQL, "-qAt"], stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                    stderr=subprocess.STDOUT, text=True,
                )
                submission.stdin.write(f"""
\\set VERBOSITY verbose
SET application_name = 'quiz_snapshot_submission';
SET statement_timeout = '15s';
BEGIN ISOLATION LEVEL {isolation};
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '{user}', true);
DO $$
DECLARE result public.aspekindo_lms_quiz_attempts;
BEGIN
  result := public.submit_aspekindo_lms_quiz('{lesson}', '{{"{first}":1,"{second}":1}}');
  IF result.score IS DISTINCT FROM 30 OR result.correct_answers IS DISTINCT FROM 1
     OR result.total_questions IS DISTINCT FROM 2 OR result.passed IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Mixed grading versions: %', result;
  END IF;
END;
$$;
COMMIT;
""")
                submission.stdin.flush()
                # Wait for the grader to reach the exact statement boundary.
                admin.execute("""
DO $$
DECLARE deadline timestamptz := clock_timestamp() + interval '10 seconds';
BEGIN
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_locks
      WHERE locktype = 'advisory' AND classid = 129 AND objid = 1
        AND NOT granted
    ) THEN EXIT; END IF;
    IF clock_timestamp() > deadline THEN
      RAISE EXCEPTION 'Submission did not reach grading barrier';
    END IF;
    PERFORM pg_sleep(0.01);
  END LOOP;
END;
$$;
""")
                # Commit edits while the member submission is still in flight.
                admin.execute(f"BEGIN;\n{mutation}\nCOMMIT;\nSELECT pg_advisory_unlock(129, 1);")
                output, _ = submission.communicate(timeout=20)
                code = submission.returncode
                submission = None
                if scenario == "delete":
                    # Its FK target disappeared: fail atomically, never regrade
                    # against a changed roster or keep a half-written attempt.
                    error_code = "23503" if isolation == "READ COMMITTED" else "40001"
                    assert code != 0 and f"ERROR:  {error_code}:" in output, output
                    expected = "0|0"
                else:
                    assert code == 0, f"{scenario} / {isolation} / guards={guarded}:\n{output}"
                    expected = "1|2"
                actual = admin.execute("""
SELECT (SELECT count(*) FROM public.aspekindo_lms_quiz_attempts) || '|' ||
       (SELECT count(*) FROM public.aspekindo_lms_quiz_answers);
""")
                assert actual == expected, (scenario, actual, expected)
                # A later submission must see the committed admin version, not
                # a stale cross-call cache. Previous results stay historical.
                answers = {first: 1, second: 1}
                next_score, next_total = 30, 2
                if scenario == "points":
                    next_score = 81  # round(30 / 37 * 100)
                elif scenario == "key":
                    next_score = 0
                elif scenario == "add":
                    answers[extra] = 0
                    next_score, next_total = 93, 3
                else:
                    del answers[second]
                    next_score, next_total = 100, 1
                answer_json = json.dumps(answers)
                admin.execute(f"""
SET ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '{user}', false);
DO $$
DECLARE result public.aspekindo_lms_quiz_attempts;
BEGIN
  result := public.submit_aspekindo_lms_quiz('{lesson}', '{answer_json}');
  IF result.score IS DISTINCT FROM {next_score}
     OR result.total_questions IS DISTINCT FROM {next_total}
     OR result.passed IS DISTINCT FROM ({next_score} >= 70) THEN
    RAISE EXCEPTION 'Next submission did not see committed edits: %', result;
  END IF;
  IF EXISTS (SELECT 1 FROM public.aspekindo_lms_quiz_attempts
             WHERE id <> result.id AND score <> 30) THEN
    RAISE EXCEPTION 'Concurrent edits changed a historical result';
  END IF;
END;
$$;
RESET ROLE;
""")
                print(f"PASS grading snapshot: {scenario}, {isolation}, admin guards={guarded}")
finally:
    if submission is not None:
        submission.kill()
        submission.communicate()
    admin.close()
