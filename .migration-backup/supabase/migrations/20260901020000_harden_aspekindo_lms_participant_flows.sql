-- Keep participant state transitions authoritative and safe under retries.

CREATE OR REPLACE FUNCTION public.enroll_aspekindo_lms_course(_course_id UUID)
RETURNS public.aspekindo_lms_enrollments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enrollment_row public.aspekindo_lms_enrollments;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Anda harus masuk untuk mendaftar kursus';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.aspekindo_lms_courses course
    WHERE course.id = _course_id
      AND course.status = 'published'
      AND (
        course.member_only = false
        OR EXISTS (
          SELECT 1 FROM public.aspekindo_members member
          WHERE member.user_id = auth.uid()
            AND member.membership_status = 'active'
        )
      )
  ) THEN
    RAISE EXCEPTION 'Kursus tidak tersedia untuk pendaftaran';
  END IF;

  INSERT INTO public.aspekindo_lms_enrollments (course_id, user_id)
  VALUES (_course_id, auth.uid())
  ON CONFLICT (course_id, user_id) DO UPDATE
  SET course_id = EXCLUDED.course_id
  RETURNING * INTO enrollment_row;

  RETURN enrollment_row;
END;
$$;

REVOKE ALL ON FUNCTION public.enroll_aspekindo_lms_course(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enroll_aspekindo_lms_course(UUID) TO authenticated;

DROP POLICY IF EXISTS "Users can start their own ASPEKINDO LMS progress"
  ON public.aspekindo_lms_lesson_progress;
CREATE POLICY "Users can start unlocked ASPEKINDO LMS progress"
  ON public.aspekindo_lms_lesson_progress FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status IN ('not_started', 'in_progress')
    AND EXISTS (
      SELECT 1
      FROM public.aspekindo_lms_enrollments enrollment
      JOIN public.aspekindo_lms_lessons current_lesson
        ON current_lesson.id = aspekindo_lms_lesson_progress.lesson_id
       AND current_lesson.course_id = enrollment.course_id
       AND current_lesson.is_published = true
      WHERE enrollment.id = aspekindo_lms_lesson_progress.enrollment_id
        AND enrollment.user_id = auth.uid()
        AND enrollment.course_id = aspekindo_lms_lesson_progress.course_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.aspekindo_lms_lessons prior_lesson
          WHERE prior_lesson.course_id = current_lesson.course_id
            AND prior_lesson.is_published = true
            AND (
              prior_lesson.sort_order < current_lesson.sort_order
              OR (
                prior_lesson.sort_order = current_lesson.sort_order
                AND prior_lesson.created_at < current_lesson.created_at
              )
            )
            AND NOT EXISTS (
              SELECT 1
              FROM public.aspekindo_lms_lesson_progress prior_progress
              WHERE prior_progress.enrollment_id = enrollment.id
                AND prior_progress.lesson_id = prior_lesson.id
                AND prior_progress.status = 'completed'
            )
        )
    )
  );

DROP POLICY IF EXISTS "Users can update non-terminal ASPEKINDO LMS progress"
  ON public.aspekindo_lms_lesson_progress;
CREATE POLICY "Users can update their unlocked ASPEKINDO LMS progress"
  ON public.aspekindo_lms_lesson_progress FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND status IN ('not_started', 'in_progress')
    AND EXISTS (
      SELECT 1
      FROM public.aspekindo_lms_enrollments enrollment
      JOIN public.aspekindo_lms_lessons current_lesson
        ON current_lesson.id = aspekindo_lms_lesson_progress.lesson_id
       AND current_lesson.course_id = enrollment.course_id
       AND current_lesson.is_published = true
      WHERE enrollment.id = aspekindo_lms_lesson_progress.enrollment_id
        AND enrollment.user_id = auth.uid()
        AND enrollment.course_id = aspekindo_lms_lesson_progress.course_id
        AND NOT EXISTS (
          SELECT 1
          FROM public.aspekindo_lms_lessons prior_lesson
          WHERE prior_lesson.course_id = current_lesson.course_id
            AND prior_lesson.is_published = true
            AND (
              prior_lesson.sort_order < current_lesson.sort_order
              OR (
                prior_lesson.sort_order = current_lesson.sort_order
                AND prior_lesson.created_at < current_lesson.created_at
              )
            )
            AND NOT EXISTS (
              SELECT 1
              FROM public.aspekindo_lms_lesson_progress prior_progress
              WHERE prior_progress.enrollment_id = enrollment.id
                AND prior_progress.lesson_id = prior_lesson.id
                AND prior_progress.status = 'completed'
            )
        )
    )
  );

CREATE OR REPLACE FUNCTION public.complete_aspekindo_lms_lesson(_lesson_id UUID)
RETURNS public.aspekindo_lms_lesson_progress
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enrollment_row public.aspekindo_lms_enrollments;
  lesson_row public.aspekindo_lms_lessons;
  progress_row public.aspekindo_lms_lesson_progress;
  question_total INTEGER;
BEGIN
  SELECT * INTO lesson_row
  FROM public.aspekindo_lms_lessons
  WHERE id = _lesson_id AND is_published = true;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pelajaran tidak ditemukan';
  END IF;

  SELECT * INTO enrollment_row
  FROM public.aspekindo_lms_enrollments
  WHERE course_id = lesson_row.course_id
    AND user_id = auth.uid()
    AND status IN ('enrolled', 'in_progress');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment aktif tidak ditemukan';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.aspekindo_lms_lessons prior_lesson
    WHERE prior_lesson.course_id = lesson_row.course_id
      AND prior_lesson.is_published = true
      AND (
        prior_lesson.sort_order < lesson_row.sort_order
        OR (
          prior_lesson.sort_order = lesson_row.sort_order
          AND prior_lesson.created_at < lesson_row.created_at
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM public.aspekindo_lms_lesson_progress prior_progress
        WHERE prior_progress.enrollment_id = enrollment_row.id
          AND prior_progress.lesson_id = prior_lesson.id
          AND prior_progress.status = 'completed'
      )
  ) THEN
    RAISE EXCEPTION 'Selesaikan pelajaran sebelumnya terlebih dahulu';
  END IF;

  SELECT count(*)::INTEGER INTO question_total
  FROM public.aspekindo_lms_quiz_questions
  WHERE lesson_id = _lesson_id;
  IF question_total > 0 AND NOT EXISTS (
    SELECT 1 FROM public.aspekindo_lms_quiz_attempts
    WHERE enrollment_id = enrollment_row.id
      AND lesson_id = _lesson_id
      AND passed = true
  ) THEN
    RAISE EXCEPTION 'Kuis pelajaran harus lulus sebelum diselesaikan';
  END IF;

  INSERT INTO public.aspekindo_lms_lesson_progress (
    enrollment_id, course_id, lesson_id, user_id, status,
    progress_percent, started_at, completed_at
  ) VALUES (
    enrollment_row.id, lesson_row.course_id, _lesson_id, auth.uid(), 'completed',
    100, now(), now()
  )
  ON CONFLICT (enrollment_id, lesson_id) DO UPDATE
  SET status = 'completed',
      progress_percent = 100,
      started_at = COALESCE(aspekindo_lms_lesson_progress.started_at, now()),
      completed_at = COALESCE(aspekindo_lms_lesson_progress.completed_at, now())
  RETURNING * INTO progress_row;

  UPDATE public.aspekindo_lms_enrollments
  SET status = 'in_progress', last_activity_at = now()
  WHERE id = enrollment_row.id AND status = 'enrolled';

  RETURN progress_row;
END;
$$;

-- Serialize attempt-number allocation per enrollment and lesson. The existing
-- grading RPC remains the only participant write path for attempts/answers.
CREATE OR REPLACE FUNCTION public.aspekindo_lms_lock_quiz_attempt_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.enrollment_id::TEXT || ':' || NEW.lesson_id::TEXT, 0)
  );
  SELECT COALESCE(max(attempt_number), 0) + 1
    INTO NEW.attempt_number
  FROM public.aspekindo_lms_quiz_attempts
  WHERE enrollment_id = NEW.enrollment_id
    AND lesson_id = NEW.lesson_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS aspekindo_lms_quiz_attempt_number_lock
  ON public.aspekindo_lms_quiz_attempts;
CREATE TRIGGER aspekindo_lms_quiz_attempt_number_lock
  BEFORE INSERT ON public.aspekindo_lms_quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.aspekindo_lms_lock_quiz_attempt_number();