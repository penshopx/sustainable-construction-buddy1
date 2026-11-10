-- Run against a migrated test database as its owner (or with the local runner).
-- All fixture rows, including the test Auth users, are rolled back.
BEGIN;

\if :full_schema
-- Fail rather than silently exercising the minimal harness or a partially
-- migrated database. The runner supplies the repository's migration versions.
SELECT set_config('test.expected_migrations', :'expected_migrations', true);
DO $$
DECLARE
  missing text;
  target regclass;
BEGIN
  SELECT string_agg(version, ', ' ORDER BY version) INTO missing
  FROM unnest(string_to_array(current_setting('test.expected_migrations'), ',')) AS expected(version)
  WHERE NOT EXISTS (
    SELECT 1 FROM supabase_migrations.schema_migrations applied
    WHERE applied.version = expected.version
  );
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'Supabase test database is missing migrations: %', missing;
  END IF;
  FOREACH target IN ARRAY ARRAY[
    'public.aspekindo_lms_quiz_attempts'::regclass,
    'public.aspekindo_lms_quiz_answers'::regclass,
    'public.aspekindo_lms_quiz_answer_keys'::regclass,
    'public.aspekindo_lms_lesson_progress'::regclass
  ] LOOP
    IF NOT (SELECT relrowsecurity FROM pg_class WHERE oid = target)
       OR NOT EXISTS (SELECT 1 FROM pg_policy WHERE polrelid = target) THEN
      RAISE EXCEPTION 'RLS or policies missing on %', target;
    END IF;
  END LOOP;
  IF (SELECT rolbypassrls OR rolsuper FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE EXCEPTION 'authenticated must not bypass RLS';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.submit_aspekindo_lms_quiz(uuid,jsonb)', 'EXECUTE')
     OR NOT has_function_privilege('authenticated', 'public.complete_aspekindo_lms_lesson(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.submit_aspekindo_lms_quiz(uuid,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.complete_aspekindo_lms_lesson(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'Unexpected quiz/completion execution grants';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.aspekindo_lms_quiz_attempts'::regclass
      AND tgname = 'aspekindo_lms_quiz_attempt_number_lock' AND tgenabled = 'O'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.aspekindo_lms_quiz_attempts'::regclass
      AND tgname = 'aspekindo_lms_attempt_active_course' AND tgenabled = 'O'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.aspekindo_lms_lesson_progress'::regclass
      AND tgname = 'aspekindo_lms_progress_active_course' AND tgenabled = 'O'
  ) THEN
    RAISE EXCEPTION 'Expected LMS authority triggers are not enabled';
  END IF;
END;
$$;
\endif

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at
) VALUES (
  '00000000-0000-4000-8000-000000000711',
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'lms-quiz-authority@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
), (
  '00000000-0000-4000-8000-000000000799',
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'lms-quiz-stranger@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
);

INSERT INTO public.aspekindo_lms_courses (id, slug, title, status, member_only)
VALUES ('00000000-0000-4000-8000-000000000712', 'quiz-authority-test', 'Quiz authority test', 'published', false);
INSERT INTO public.aspekindo_lms_lessons (id, course_id, title, slug, passing_score, is_published)
VALUES (
  '00000000-0000-4000-8000-000000000713',
  '00000000-0000-4000-8000-000000000712', 'Quiz lesson', 'quiz-lesson', 70, true
);
INSERT INTO public.aspekindo_lms_enrollments (id, course_id, user_id)
VALUES (
  '00000000-0000-4000-8000-000000000714',
  '00000000-0000-4000-8000-000000000712',
  '00000000-0000-4000-8000-000000000711'
);
INSERT INTO public.aspekindo_lms_quiz_questions (id, lesson_id, question_text, options, sort_order)
VALUES
  ('00000000-0000-4000-8000-000000000715', '00000000-0000-4000-8000-000000000713', 'First?', '["wrong","right"]', 0),
  ('00000000-0000-4000-8000-000000000716', '00000000-0000-4000-8000-000000000713', 'Second?', '["right","wrong"]', 1);
INSERT INTO public.aspekindo_lms_quiz_answer_keys (question_id, correct_option)
VALUES
  ('00000000-0000-4000-8000-000000000715', 1),
  ('00000000-0000-4000-8000-000000000716', 0);

SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000711', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

DO $$
BEGIN
  IF current_user <> 'authenticated'
     OR auth.uid() IS DISTINCT FROM '00000000-0000-4000-8000-000000000711'::uuid
     OR current_setting('row_security') <> 'on' THEN
    RAISE EXCEPTION 'Quiz test must execute as authenticated owner with RLS enabled';
  END IF;
END;
$$;

DO $$
DECLARE
  v_lesson_id constant uuid := '00000000-0000-4000-8000-000000000713';
  failed public.aspekindo_lms_quiz_attempts;
BEGIN
  -- A direct RPC caller can send an invented score, but only answer IDs/choices
  -- are accepted by the grader. The extra field must not affect the result.
  failed := public.submit_aspekindo_lms_quiz(v_lesson_id,
    '{"00000000-0000-4000-8000-000000000715":0,"00000000-0000-4000-8000-000000000716":1,"score":100}'::jsonb);
  RAISE EXCEPTION 'Unexpected acceptance of an extra score field: %', failed;
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM NOT LIKE 'Jumlah jawaban kuis harus sama dengan jumlah soal%' THEN
    RAISE;
  END IF;
END;
$$;

DO $$
DECLARE
  v_lesson_id constant uuid := '00000000-0000-4000-8000-000000000713';
  v_enrollment_id constant uuid := '00000000-0000-4000-8000-000000000714';
  failed public.aspekindo_lms_quiz_attempts;
  passed public.aspekindo_lms_quiz_attempts;
  progress public.aspekindo_lms_lesson_progress;
BEGIN
  failed := public.submit_aspekindo_lms_quiz(v_lesson_id,
    '{"00000000-0000-4000-8000-000000000715":0,"00000000-0000-4000-8000-000000000716":1}'::jsonb);
  IF failed.score IS DISTINCT FROM 0 OR failed.passed IS DISTINCT FROM false
     OR failed.total_questions IS DISTINCT FROM 2 OR failed.correct_answers IS DISTINCT FROM 0
     OR (SELECT count(*) FROM public.aspekindo_lms_quiz_answers
         WHERE attempt_id = failed.id AND is_correct = false) <> 2 THEN
    RAISE EXCEPTION 'Server did not grade wrong answers as failing: %', failed;
  END IF;

  BEGIN
    PERFORM public.complete_aspekindo_lms_lesson(v_lesson_id);
    RAISE EXCEPTION 'Failed quiz incorrectly allowed lesson completion';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Kuis pelajaran harus lulus sebelum diselesaikan' THEN RAISE; END IF;
  END;
  IF EXISTS (SELECT 1 FROM public.aspekindo_lms_lesson_progress lp
             WHERE lp.enrollment_id = v_enrollment_id AND lp.lesson_id = v_lesson_id AND lp.status = 'completed') THEN
    RAISE EXCEPTION 'Completion persisted despite the failed quiz';
  END IF;

  passed := public.submit_aspekindo_lms_quiz(v_lesson_id,
    '{"00000000-0000-4000-8000-000000000715":1,"00000000-0000-4000-8000-000000000716":0}'::jsonb);
  IF passed.score IS DISTINCT FROM 100 OR passed.passed IS DISTINCT FROM true
     OR passed.correct_answers IS DISTINCT FROM 2 OR passed.total_questions IS DISTINCT FROM 2
     OR passed.attempt_number IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Server did not grade correct answers as passing: %', passed;
  END IF;
  progress := public.complete_aspekindo_lms_lesson(v_lesson_id);
  IF progress.status IS DISTINCT FROM 'completed' OR progress.progress_percent IS DISTINCT FROM 100
     OR progress.user_id IS DISTINCT FROM auth.uid()
     OR progress.enrollment_id IS DISTINCT FROM v_enrollment_id
     OR progress.lesson_id IS DISTINCT FROM v_lesson_id
     OR progress.completed_at IS NULL THEN
    RAISE EXCEPTION 'Passing quiz did not permit lesson completion: %', progress;
  END IF;
END;
$$;

-- Unequal weights must affect scores, not the diagnostic answer counts.
RESET ROLE;
UPDATE public.aspekindo_lms_quiz_questions
SET points = CASE WHEN sort_order = 0 THEN 3 ELSE 7 END
WHERE lesson_id = '00000000-0000-4000-8000-000000000713';
-- Isolate this scenario: completion accepts any historical passing attempt.
DELETE FROM public.aspekindo_lms_quiz_answers
WHERE lesson_id = '00000000-0000-4000-8000-000000000713';
DELETE FROM public.aspekindo_lms_quiz_attempts
WHERE lesson_id = '00000000-0000-4000-8000-000000000713';
DELETE FROM public.aspekindo_lms_lesson_progress
WHERE lesson_id = '00000000-0000-4000-8000-000000000713';
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_lesson_id constant uuid := '00000000-0000-4000-8000-000000000713';
  result public.aspekindo_lms_quiz_attempts;
  progress public.aspekindo_lms_lesson_progress;
BEGIN
  result := public.submit_aspekindo_lms_quiz(v_lesson_id,
    '{"00000000-0000-4000-8000-000000000715":1,"00000000-0000-4000-8000-000000000716":1}'::jsonb);
  IF result.score IS DISTINCT FROM 30 OR result.passed IS DISTINCT FROM false
     OR result.correct_answers IS DISTINCT FROM 1 OR result.total_questions IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'Low-weight correct answer must score 30 and fail: %', result;
  END IF;
  BEGIN
    PERFORM public.complete_aspekindo_lms_lesson(v_lesson_id);
    RAISE EXCEPTION 'Low-weight correct answer incorrectly allowed completion';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Kuis pelajaran harus lulus sebelum diselesaikan' THEN RAISE; END IF;
  END;

  result := public.submit_aspekindo_lms_quiz(v_lesson_id,
    '{"00000000-0000-4000-8000-000000000715":0,"00000000-0000-4000-8000-000000000716":0}'::jsonb);
  IF result.score IS DISTINCT FROM 70 OR result.passed IS DISTINCT FROM true
     OR result.correct_answers IS DISTINCT FROM 1 OR result.total_questions IS DISTINCT FROM 2
     OR result.attempt_number IS DISTINCT FROM 2
     OR (SELECT count(*) FROM public.aspekindo_lms_quiz_answers
         WHERE attempt_id = result.id AND is_correct) <> 1 THEN
    RAISE EXCEPTION 'High-weight correct answer must pass exactly at 70: %', result;
  END IF;
  progress := public.complete_aspekindo_lms_lesson(v_lesson_id);
  IF progress.status IS DISTINCT FROM 'completed' THEN
    RAISE EXCEPTION 'Weighted pass did not permit completion: %', progress;
  END IF;

  result := public.submit_aspekindo_lms_quiz(v_lesson_id,
    '{"00000000-0000-4000-8000-000000000715":0,"00000000-0000-4000-8000-000000000716":1}'::jsonb);
  IF result.score IS DISTINCT FROM 0 OR result.passed IS DISTINCT FROM false
     OR result.correct_answers IS DISTINCT FROM 0 THEN
    RAISE EXCEPTION 'All weighted answers wrong must score zero: %', result;
  END IF;
  result := public.submit_aspekindo_lms_quiz(v_lesson_id,
    '{"00000000-0000-4000-8000-000000000715":1,"00000000-0000-4000-8000-000000000716":0}'::jsonb);
  IF result.score IS DISTINCT FROM 100 OR result.passed IS DISTINCT FROM true
     OR result.correct_answers IS DISTINCT FROM 2 THEN
    RAISE EXCEPTION 'All weighted answers correct must score 100: %', result;
  END IF;
END;
$$;

RESET ROLE;
UPDATE public.aspekindo_lms_lessons SET passing_score = 71
WHERE id = '00000000-0000-4000-8000-000000000713';
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  result public.aspekindo_lms_quiz_attempts;
BEGIN
  result := public.submit_aspekindo_lms_quiz('00000000-0000-4000-8000-000000000713',
    '{"00000000-0000-4000-8000-000000000715":0,"00000000-0000-4000-8000-000000000716":0}'::jsonb);
  IF result.score IS DISTINCT FROM 70 OR result.passed IS DISTINCT FROM false THEN
    RAISE EXCEPTION 'Weighted 70 must fail a pass mark of 71: %', result;
  END IF;
END;
$$;

-- Fractional weighted percentages use the same integer rounding as legacy scores.
RESET ROLE;
UPDATE public.aspekindo_lms_quiz_questions
SET points = CASE WHEN sort_order = 0 THEN 1 ELSE 2 END
WHERE lesson_id = '00000000-0000-4000-8000-000000000713';
UPDATE public.aspekindo_lms_lessons SET passing_score = 67
WHERE id = '00000000-0000-4000-8000-000000000713';
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  result public.aspekindo_lms_quiz_attempts;
BEGIN
  result := public.submit_aspekindo_lms_quiz('00000000-0000-4000-8000-000000000713',
    '{"00000000-0000-4000-8000-000000000715":0,"00000000-0000-4000-8000-000000000716":0}'::jsonb);
  IF result.score IS DISTINCT FROM 67 OR result.passed IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Two thirds must round to 67 and pass at 67: %', result;
  END IF;
END;
$$;

\if :full_schema
-- Exercise table policies, not just SECURITY DEFINER RPCs. Owners must not
-- read answer keys or manufacture/alter a passing result directly.
DO $$
DECLARE
  changed integer;
BEGIN
  IF EXISTS (SELECT 1 FROM public.aspekindo_lms_quiz_answer_keys
             WHERE question_id = '00000000-0000-4000-8000-000000000715') THEN
    RAISE EXCEPTION 'Participant can read the private answer key';
  END IF;
  BEGIN
    INSERT INTO public.aspekindo_lms_quiz_attempts
      (enrollment_id, course_id, lesson_id, user_id, attempt_number, score, passed)
    VALUES (
      '00000000-0000-4000-8000-000000000714',
      '00000000-0000-4000-8000-000000000712',
      '00000000-0000-4000-8000-000000000713',
      auth.uid(), 99, 100, true
    );
    RAISE EXCEPTION 'Participant can insert a forged passing attempt';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  UPDATE public.aspekindo_lms_quiz_attempts SET score = 100, passed = true
  WHERE lesson_id = '00000000-0000-4000-8000-000000000713' AND score < 100;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN
    RAISE EXCEPTION 'Participant can overwrite server grading';
  END IF;
  UPDATE public.aspekindo_lms_quiz_answers SET is_correct = true
  WHERE lesson_id = '00000000-0000-4000-8000-000000000713' AND NOT is_correct;
  GET DIAGNOSTICS changed = ROW_COUNT;
  IF changed <> 0 THEN
    RAISE EXCEPTION 'Participant can overwrite answer correctness';
  END IF;
END;
$$;

-- Same real database role, different JWT subject: neither results nor answers
-- may leak across accounts.
SELECT set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000799', true);
DO $$
BEGIN
  IF current_user <> 'authenticated' OR EXISTS (
    SELECT 1 FROM public.aspekindo_lms_quiz_attempts
    WHERE lesson_id = '00000000-0000-4000-8000-000000000713'
  ) OR EXISTS (
    SELECT 1 FROM public.aspekindo_lms_quiz_answers
    WHERE lesson_id = '00000000-0000-4000-8000-000000000713'
  ) THEN
    RAISE EXCEPTION 'Another participant can read owner quiz data';
  END IF;
END;
$$;
\endif

ROLLBACK;