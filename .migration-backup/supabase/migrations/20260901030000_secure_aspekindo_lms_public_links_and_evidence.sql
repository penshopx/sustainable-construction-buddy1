CREATE OR REPLACE FUNCTION public.get_public_aspekindo_lms_agenda_links(_agenda_ids UUID[])
RETURNS TABLE (
  id UUID,
  agenda_id UUID,
  title TEXT,
  course_code TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT course.id, course.agenda_id, course.title, course.course_code
  FROM public.aspekindo_lms_courses course
  JOIN public.aspekindo_learning_agendas agenda ON agenda.id = course.agenda_id
  WHERE course.status = 'published'
    AND agenda.status = 'published'
    AND course.agenda_id = ANY(_agenda_ids);
$$;

REVOKE ALL ON FUNCTION public.get_public_aspekindo_lms_agenda_links(UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_public_aspekindo_lms_agenda_links(UUID[]) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.aspekindo_lms_validate_answer_key()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  option_count INTEGER;
BEGIN
  SELECT jsonb_array_length(question.options)
    INTO option_count
  FROM public.aspekindo_lms_quiz_questions question
  WHERE question.id = NEW.question_id;

  IF option_count IS NULL OR NEW.correct_option < 0 OR NEW.correct_option >= option_count THEN
    RAISE EXCEPTION 'Kunci jawaban berada di luar pilihan yang tersedia';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aspekindo_lms_answer_key_bounds
  ON public.aspekindo_lms_quiz_answer_keys;
CREATE TRIGGER aspekindo_lms_answer_key_bounds
  BEFORE INSERT OR UPDATE ON public.aspekindo_lms_quiz_answer_keys
  FOR EACH ROW EXECUTE FUNCTION public.aspekindo_lms_validate_answer_key();

CREATE OR REPLACE FUNCTION public.save_aspekindo_lms_quiz_question(
  _question_id UUID,
  _lesson_id UUID,
  _question_text TEXT,
  _options JSONB,
  _correct_option INTEGER,
  _explanation_markdown TEXT,
  _points INTEGER,
  _sort_order INTEGER
)
RETURNS public.aspekindo_lms_quiz_questions
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  saved_question public.aspekindo_lms_quiz_questions;
BEGIN
  IF auth.uid() IS NULL OR NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Akses admin diperlukan';
  END IF;
  IF btrim(_question_text) = ''
    OR jsonb_typeof(_options) <> 'array'
    OR jsonb_array_length(_options) < 2
    OR _correct_option < 0
    OR _correct_option >= jsonb_array_length(_options)
    OR _points < 1
    OR _sort_order < 0
  THEN
    RAISE EXCEPTION 'Data soal kuis tidak valid';
  END IF;

  IF _question_id IS NULL THEN
    INSERT INTO public.aspekindo_lms_quiz_questions (
      lesson_id, question_text, options, points, sort_order, created_by
    ) VALUES (
      _lesson_id, btrim(_question_text), _options, _points, _sort_order, auth.uid()
    )
    RETURNING * INTO saved_question;
  ELSE
    UPDATE public.aspekindo_lms_quiz_questions
    SET question_text = btrim(_question_text),
        options = _options,
        points = _points,
        sort_order = _sort_order
    WHERE id = _question_id AND lesson_id = _lesson_id
    RETURNING * INTO saved_question;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Soal kuis tidak ditemukan';
    END IF;
  END IF;

  INSERT INTO public.aspekindo_lms_quiz_answer_keys (
    question_id, correct_option, explanation_markdown
  ) VALUES (
    saved_question.id, _correct_option, btrim(_explanation_markdown)
  )
  ON CONFLICT (question_id) DO UPDATE
  SET correct_option = EXCLUDED.correct_option,
      explanation_markdown = EXCLUDED.explanation_markdown;

  RETURN saved_question;
END;
$$;

REVOKE ALL ON FUNCTION public.save_aspekindo_lms_quiz_question(UUID, UUID, TEXT, JSONB, INTEGER, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_aspekindo_lms_quiz_question(UUID, UUID, TEXT, JSONB, INTEGER, TEXT, INTEGER, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.aspekindo_lms_require_active_course()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_course_id UUID;
BEGIN
  IF auth.uid() IS NULL OR public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'aspekindo_lms_quiz_attempts' THEN
    target_course_id := NEW.course_id;
  ELSIF TG_TABLE_NAME = 'aspekindo_lms_lesson_progress' THEN
    target_course_id := NEW.course_id;
  ELSE
    target_course_id := NEW.course_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.aspekindo_lms_courses course
    WHERE course.id = target_course_id
      AND course.status = 'published'
      AND (
        course.member_only = false
        OR EXISTS (
          SELECT 1
          FROM public.aspekindo_members member
          WHERE member.user_id = auth.uid()
            AND member.membership_status = 'active'
        )
      )
  ) THEN
    RAISE EXCEPTION 'Kursus tidak lagi tersedia untuk aktivitas peserta';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aspekindo_lms_progress_active_course
  ON public.aspekindo_lms_lesson_progress;
CREATE TRIGGER aspekindo_lms_progress_active_course
  BEFORE INSERT OR UPDATE ON public.aspekindo_lms_lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.aspekindo_lms_require_active_course();

DROP TRIGGER IF EXISTS aspekindo_lms_attempt_active_course
  ON public.aspekindo_lms_quiz_attempts;
CREATE TRIGGER aspekindo_lms_attempt_active_course
  BEFORE INSERT OR UPDATE ON public.aspekindo_lms_quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.aspekindo_lms_require_active_course();

DROP TRIGGER IF EXISTS aspekindo_lms_enrollment_active_course
  ON public.aspekindo_lms_enrollments;
CREATE TRIGGER aspekindo_lms_enrollment_active_course
  BEFORE UPDATE ON public.aspekindo_lms_enrollments
  FOR EACH ROW
  WHEN (NEW.status IN ('in_progress', 'completed') AND NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.aspekindo_lms_require_active_course();