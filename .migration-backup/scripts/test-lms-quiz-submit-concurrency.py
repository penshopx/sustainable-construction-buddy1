#!/usr/bin/env python3
"""Two authenticated SQL sessions on fully migrated, disposable local Supabase.

Hold the first submission uncommitted and prove the second is waiting on its
advisory transaction lock. No sleeps as synchronization, test triggers, disabled
guards, or question-bank mutations during submissions.
"""
import json
import os
from pathlib import Path
import queue
import subprocess
import threading
import time
from urllib.parse import urlsplit
import uuid


ROOT = Path(__file__).resolve().parents[1]


def local_database(env):
    url = env.get("TEST_DATABASE_URL", "")
    parsed = urlsplit(url)
    if not (
        parsed.scheme in ("postgres", "postgresql")
        and parsed.hostname in ("127.0.0.1", "localhost")
        and parsed.port == 54322 and parsed.path == "/postgres"
        and parsed.username == "postgres" and not parsed.query and not parsed.fragment
    ):
        raise ValueError("Requires disposable local Supabase on port 54322")
    return url


def literal(value):
    return "'" + str(value).replace("'", "''") + "'"


class Connection:
    def __init__(self, database):
        # Do not let libpq environment overrides reroute the local connection.
        self.process = subprocess.Popen(
            ["psql", "-X", database, "-qAt", "-v", "ON_ERROR_STOP=1"],
            env={k: v for k, v in os.environ.items() if not k.startswith("PG")},
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            text=True, bufsize=1,
        )
        self.lines = queue.Queue()
        self.sequence = 0

        def read():
            for line in self.process.stdout:
                self.lines.put(line.rstrip())
            self.lines.put(None)

        threading.Thread(target=read, daemon=True).start()
        self.execute("SET statement_timeout = '15s'; SET lock_timeout = '12s';")

    def send(self, sql):
        self.sequence += 1
        marker = f"finished_{self.sequence}"
        self.process.stdin.write(sql + f"\n\\echo {marker}\n")
        self.process.stdin.flush()
        return marker

    def receive(self, marker):
        output = []
        deadline = time.monotonic() + 20
        while True:
            try:
                line = self.lines.get(timeout=max(0.01, deadline - time.monotonic()))
            except queue.Empty:
                raise AssertionError("Local quiz SQL session timed out") from None
            if line is None:
                raise AssertionError("Local quiz SQL session failed")
            if line == marker:
                return "\n".join(output)
            output.append(line)

    def execute(self, sql):
        return self.receive(self.send(sql))

    def close(self):
        if self.process.poll() is None:
            self.process.terminate()
        self.process.communicate(timeout=5)


def run():
    database = local_database(os.environ)  # Validate before opening any connection.
    connections = []
    admin = Connection(database)
    connections.append(admin)
    user, course, lesson, enrollment, low, high = [str(uuid.uuid4()) for _ in range(6)]
    fixtures_started = False
    try:
        versions = sorted({p.name.split("_")[0] for p in
                           (ROOT / "supabase/migrations").glob("*.sql")})
        assert versions, "Repository migrations missing"
        assert admin.execute("""
            SELECT count(*) FROM unnest(ARRAY[%s]) expected(version)
            WHERE NOT EXISTS (
              SELECT 1 FROM supabase_migrations.schema_migrations applied
              WHERE applied.version = expected.version);
        """ % ",".join(map(literal, versions))) == "0", "Requires EVERY repository migration"
        assert admin.execute("""
            SELECT count(*) FROM pg_trigger
            WHERE tgrelid = 'public.aspekindo_lms_quiz_attempts'::regclass
              AND tgname = 'aspekindo_lms_quiz_attempt_number_lock'
              AND tgenabled = 'O' AND NOT tgisinternal;
        """) == "1", "Attempt-number lock trigger must be enabled"
        fixtures_started = True
        admin.execute(f"""
            BEGIN;
            INSERT INTO auth.users(id, aud, role, email, raw_app_meta_data, raw_user_meta_data)
              VALUES ({literal(user)}, 'authenticated', 'authenticated',
                      {literal('quiz-concurrent-' + user + '@example.invalid')}, '{{}}', '{{}}');
            INSERT INTO public.aspekindo_lms_courses(id,slug,title,status,member_only)
              VALUES ({literal(course)}, {literal('quiz-concurrent-' + course)},
                      'Disposable concurrent submissions', 'draft', false);
            INSERT INTO public.aspekindo_lms_lessons
              (id,course_id,title,slug,passing_score,is_published)
              VALUES ({literal(lesson)}, {literal(course)}, 'Concurrent quiz', 'quiz', 70, false);
            INSERT INTO public.aspekindo_lms_quiz_questions
              (id,lesson_id,question_text,options,sort_order,points) VALUES
              ({literal(low)}, {literal(lesson)}, 'Low weight?', '["wrong","right"]', 0, 3),
              ({literal(high)}, {literal(lesson)}, 'High weight?', '["right","wrong"]', 1, 7);
            INSERT INTO public.aspekindo_lms_quiz_answer_keys(question_id,correct_option) VALUES
              ({literal(low)}, 1), ({literal(high)}, 0);
            UPDATE public.aspekindo_lms_lessons SET is_published=true WHERE id={literal(lesson)};
            UPDATE public.aspekindo_lms_courses SET status='published' WHERE id={literal(course)};
            INSERT INTO public.aspekindo_lms_enrollments(id,course_id,user_id)
              VALUES ({literal(enrollment)}, {literal(course)}, {literal(user)});
            COMMIT;
        """)
        participants = [Connection(database), Connection(database)]
        connections.extend(participants)
        pids = []
        for participant in participants:
            pids.append(int(participant.execute("SELECT pg_backend_pid();")))
            participant.execute(f"""
                SET ROLE authenticated;
                SELECT set_config('request.jwt.claim.sub', {literal(user)}, false);
                SELECT set_config('request.jwt.claim.role', 'authenticated', false);
                DO $$ BEGIN
                  IF current_user <> 'authenticated' OR auth.uid() IS DISTINCT FROM {literal(user)}::uuid
                     OR current_setting('row_security') <> 'on'
                     OR (SELECT rolbypassrls OR rolsuper FROM pg_roles WHERE rolname=current_user) THEN
                    RAISE EXCEPTION 'Requires authenticated owner without RLS bypass';
                  END IF;
                END $$;
            """)
        assert pids[0] != pids[1], "Requires independent database connections"
        expected = {}
        for round_number in range(3):
            # Alternate scores/order, while preserving the exact same bank.
            payloads = [{low: 1, high: 1}, {low: 0, high: 0}]
            if round_number % 2:
                payloads.reverse()

            def submit_sql(payload):
                return (
                    "SELECT row_to_json(result) FROM public.submit_aspekindo_lms_quiz("
                    f"{literal(lesson)}, {literal(json.dumps(payload))}::jsonb) result;"
                )

            first, second = participants
            first.execute("BEGIN ISOLATION LEVEL READ COMMITTED;")
            first_result = json.loads(first.execute(submit_sql(payloads[0])))
            second.execute("BEGIN ISOLATION LEVEL READ COMMITTED;")
            pending = second.send(submit_sql(payloads[1]))
            deadline = time.monotonic() + 8
            while True:
                # Prove overlap at the real advisory lock, not merely two
                # successful sequential calls or an unrelated row-lock wait.
                blocked = admin.execute(f"""
                    SELECT EXISTS (
                      SELECT 1 FROM pg_locks
                      WHERE pid={pids[1]} AND locktype='advisory' AND NOT granted
                        AND {pids[0]} = ANY(pg_blocking_pids({pids[1]})));
                """)
                if blocked == "t":
                    break
                assert time.monotonic() < deadline, "Second submit did not wait on first advisory lock"
                time.sleep(0.02)
            first.execute("COMMIT;")
            second_result = json.loads(second.receive(pending))
            second.execute("COMMIT;")
            for offset, (result, payload) in enumerate(zip((first_result, second_result), payloads), 1):
                score = 30 if payload[low] == 1 else 70
                assert result["id"] not in expected, "Submission overwrote another attempt"
                assert result["attempt_number"] == round_number * 2 + offset
                assert result["enrollment_id"] == enrollment and result["lesson_id"] == lesson
                assert result["user_id"] == user and result["course_id"] == course
                assert result["score"] == score and result["passed"] == (score >= 70)
                assert result["correct_answers"] == 1 and result["total_questions"] == 2
                expected[result["id"]] = (result, payload)

            stored = json.loads(admin.execute(f"""
                SELECT coalesce(json_agg(row_to_json(a) ORDER BY attempt_number), '[]')
                FROM public.aspekindo_lms_quiz_attempts a WHERE lesson_id={literal(lesson)};
            """))
            assert [row["attempt_number"] for row in stored] == list(range(1, len(expected) + 1))
            assert len(stored) == len(expected)
            for row in stored:
                assert row == expected[row["id"]][0], "Persisted score/attempt changed"
            answers = json.loads(admin.execute(f"""
                SELECT coalesce(json_agg(row_to_json(a)), '[]')
                FROM public.aspekindo_lms_quiz_answers a WHERE lesson_id={literal(lesson)};
            """))
            assert len(answers) == 2 * len(expected)
            for attempt_id, (_, payload) in expected.items():
                own = [a for a in answers if a["attempt_id"] == attempt_id]
                assert len(own) == 2 and {a["question_id"] for a in own} == {low, high}
                for answer in own:
                    question = answer["question_id"]
                    assert answer["selected_option"] == payload[question], "Answer attached to wrong attempt"
                    assert answer["is_correct"] == (payload[question] == (1 if question == low else 0))
        print("PASS: 3 overlapping authenticated submit pairs; attempts 1–6, distinct scores and answer ownership.")
    finally:
        # Close participant transactions before fixture deletion (also on error).
        for connection in reversed(connections[1:]):
            connection.close()
        try:
            if fixtures_started:
                admin.execute(f"""
                    ROLLBACK;
                    DELETE FROM public.aspekindo_lms_courses WHERE id={literal(course)};
                    DELETE FROM auth.users WHERE id={literal(user)};
                """)
        finally:
            admin.close()


if __name__ == "__main__":
    run()
