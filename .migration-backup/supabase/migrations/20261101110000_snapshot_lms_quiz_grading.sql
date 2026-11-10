-- Capture the roster, weights and keys in ONE MVCC statement snapshot.
-- Admin edits need no new locks/protocol and can commit while grading runs.
-- If a captured question is deleted before its answer is inserted, the existing
-- answer FK aborts the entire submission; never persist a partial attempt.
-- Historical attempts are not recalculated, and this is an in-memory grading
-- snapshot, not a backfill of historical point details.
CREATE OR REPLACE FUNCTION public.submit_aspekindo_lms_quiz(
  _lesson_id UUID,
  _answers JSONB
)
RETURNS public.aspekindo_lms_quiz_attempts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enrollment_row public.aspekindo_lms_enrollments;
  lesson_row public.aspekindo_lms_lessons;
  attempt_row public.aspekindo_lms_quiz_attempts;
  answer_entry RECORD;
  answer_key INTEGER;
  question_points INTEGER;
  question_snapshot JSONB;
  question_total INTEGER;
  correct_total INTEGER := 0;
  total_points NUMERIC;
  earned_points NUMERIC := 0;
  weighted_score INTEGER;
  selected_value INTEGER;
BEGIN
  IF auth.uid() IS NULL OR jsonb_typeof(_answers) <> 'object' THEN
    RAISE EXCEPTION 'Jawaban kuis tidak valid';
  END IF;

  SELECT * INTO lesson_row
  FROM public.aspekindo_lms_lessons
  WHERE id = _lesson_id AND is_published = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pelajaran tidak ditemukan';
  END IF;

  SELECT enrollment.* INTO enrollment_row
  FROM public.aspekindo_lms_enrollments enrollment
  WHERE enrollment.course_id = lesson_row.course_id
    AND enrollment.user_id = auth.uid()
    AND enrollment.status IN ('enrolled', 'in_progress', 'completed');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment tidak ditemukan';
  END IF;

  -- LEFT JOIN keeps unkeyed questions in the roster/denominator, so a missing
  -- key still fails rather than silently reducing the number of questions.
  SELECT count(*)::INTEGER, sum(question.points::NUMERIC),
         jsonb_object_agg(question.id::TEXT, jsonb_build_object(
           'points', question.points, 'correct_option', key.correct_option
         ))
  INTO question_total, total_points, question_snapshot
  FROM public.aspekindo_lms_quiz_questions question
  LEFT JOIN public.aspekindo_lms_quiz_answer_keys key ON key.question_id = question.id
  WHERE question.lesson_id = _lesson_id;
  IF question_total = 0
     OR (SELECT count(*) FROM jsonb_object_keys(_answers)) <> question_total THEN
    RAISE EXCEPTION 'Jumlah jawaban kuis harus sama dengan jumlah soal';
  END IF;

  INSERT INTO public.aspekindo_lms_quiz_attempts (
    enrollment_id, course_id, lesson_id, user_id, attempt_number
  )
  SELECT enrollment_row.id, lesson_row.course_id, _lesson_id, auth.uid(),
    COALESCE(max(attempt_number), 0) + 1
  FROM public.aspekindo_lms_quiz_attempts
  WHERE enrollment_id = enrollment_row.id AND lesson_id = _lesson_id
  RETURNING * INTO attempt_row;

  FOR answer_entry IN SELECT * FROM jsonb_each(_answers) LOOP
    BEGIN
      selected_value := (answer_entry.value #>> '{}')::INTEGER;
      -- Canonicalize UUIDs as the previous live-table lookup did.
      answer_key := (question_snapshot -> (answer_entry.key::UUID)::TEXT ->> 'correct_option')::INTEGER;
      question_points := (question_snapshot -> (answer_entry.key::UUID)::TEXT ->> 'points')::INTEGER;
    EXCEPTION WHEN invalid_text_representation OR invalid_parameter_value THEN
      RAISE EXCEPTION 'Format jawaban kuis tidak valid';
    END;
    IF answer_key IS NULL THEN
      RAISE EXCEPTION 'Kunci jawaban kuis belum tersedia';
    END IF;
    INSERT INTO public.aspekindo_lms_quiz_answers (
      attempt_id, lesson_id, question_id, selected_option, is_correct
    ) VALUES (
      attempt_row.id, _lesson_id, answer_entry.key::UUID, selected_value,
      selected_value = answer_key
    );
    IF selected_value = answer_key THEN
      correct_total := correct_total + 1;
      earned_points := earned_points + question_points;
    END IF;
  END LOOP;

  weighted_score := round((earned_points / total_points) * 100)::INTEGER;
  UPDATE public.aspekindo_lms_quiz_attempts
  SET total_questions = question_total,
      correct_answers = correct_total,
      score = weighted_score,
      passed = weighted_score >= lesson_row.passing_score
  WHERE id = attempt_row.id
  RETURNING * INTO attempt_row;

  RETURN attempt_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_aspekindo_lms_quiz(UUID, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_aspekindo_lms_quiz(UUID, JSONB) TO authenticated;
