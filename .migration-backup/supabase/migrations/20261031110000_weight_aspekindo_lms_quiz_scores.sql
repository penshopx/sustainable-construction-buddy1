-- points is the grading weight of each question, not a separate reward.
-- Keep integer percentage rounding and compare that stored score to the pass mark.
-- Existing attempts remain historical results; only new submissions are graded here.
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

  SELECT count(*)::INTEGER, sum(question.points::NUMERIC)
  INTO question_total, total_points
  FROM public.aspekindo_lms_quiz_questions question
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
      SELECT key.correct_option, question.points INTO answer_key, question_points
      FROM public.aspekindo_lms_quiz_answer_keys key
      JOIN public.aspekindo_lms_quiz_questions question ON question.id = key.question_id
      WHERE question.id = answer_entry.key::UUID AND question.lesson_id = _lesson_id;
    EXCEPTION WHEN invalid_text_representation OR invalid_parameter_value THEN
      RAISE EXCEPTION 'Format jawaban kuis tidak valid';
    END;
    IF NOT FOUND THEN
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
