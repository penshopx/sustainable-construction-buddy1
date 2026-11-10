-- ASPEKINDO native LMS course foundation.
-- This namespace is intentionally separate from legacy e_course_*,
-- pub_programs, and the public aspekindo_learning_agendas catalog.

CREATE TABLE public.aspekindo_lms_courses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_code TEXT NOT NULL DEFAULT (
    'ASPEKINDO-LMS-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
  ),
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  description_markdown TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  member_only BOOLEAN NOT NULL DEFAULT true,
  agenda_id UUID REFERENCES public.aspekindo_learning_agendas(id) ON DELETE SET NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT aspekindo_lms_courses_code_format
    CHECK (course_code ~ '^ASPEKINDO-LMS-[A-Z0-9-]+$'),
  CONSTRAINT aspekindo_lms_courses_slug_format
    CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$')
);

CREATE UNIQUE INDEX aspekindo_lms_courses_code_unique
  ON public.aspekindo_lms_courses (course_code);
CREATE UNIQUE INDEX aspekindo_lms_courses_slug_unique
  ON public.aspekindo_lms_courses (slug);
CREATE INDEX aspekindo_lms_courses_catalog_idx
  ON public.aspekindo_lms_courses (status, member_only, created_at DESC);

CREATE TABLE public.aspekindo_lms_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_code TEXT NOT NULL DEFAULT (
    'ASPEKINDO-SESSION-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 12))
  ),
  course_id UUID NOT NULL REFERENCES public.aspekindo_lms_courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description_markdown TEXT NOT NULL DEFAULT '',
  delivery_mode TEXT NOT NULL DEFAULT 'internal'
    CHECK (delivery_mode IN ('internal', 'external', 'hybrid')),
  source_type TEXT NOT NULL DEFAULT 'native'
    CHECK (source_type IN ('native', 'external')),
  source_name TEXT NOT NULL DEFAULT 'PUB ASPEKINDO',
  source_url TEXT NOT NULL DEFAULT '',
  source_activity_id UUID REFERENCES public.aspekindo_pub_activities(id) ON DELETE SET NULL,
  evidence_requirement JSONB NOT NULL DEFAULT
    '{"required":true,"accepted":["attendance","completion","reflection"]}'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT aspekindo_lms_sessions_code_format
    CHECK (session_code ~ '^ASPEKINDO-SESSION-[A-Z0-9-]+$'),
  CONSTRAINT aspekindo_lms_sessions_valid_dates
    CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at >= starts_at),
  CONSTRAINT aspekindo_lms_sessions_safe_source_url
    CHECK (source_url = '' OR source_url ~* '^https://'),
  CONSTRAINT aspekindo_lms_sessions_source_required
    CHECK (
      (source_type = 'native' AND source_name <> '')
      OR (source_type = 'external' AND source_name <> '' AND source_url <> '')
    ),
  CONSTRAINT aspekindo_lms_sessions_external_delivery_source
    CHECK (delivery_mode = 'internal' OR source_type = 'external' OR source_activity_id IS NOT NULL)
);

CREATE UNIQUE INDEX aspekindo_lms_sessions_code_unique
  ON public.aspekindo_lms_sessions (session_code);
CREATE UNIQUE INDEX aspekindo_lms_sessions_course_order_unique
  ON public.aspekindo_lms_sessions (course_id, sort_order);
CREATE UNIQUE INDEX aspekindo_lms_sessions_id_course_unique
  ON public.aspekindo_lms_sessions (id, course_id);
CREATE INDEX aspekindo_lms_sessions_catalog_idx
  ON public.aspekindo_lms_sessions (course_id, status, sort_order);

CREATE TABLE public.aspekindo_lms_lessons (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.aspekindo_lms_courses(id) ON DELETE CASCADE,
  session_id UUID,
  title TEXT NOT NULL,
  slug TEXT NOT NULL,
  content_markdown TEXT NOT NULL DEFAULT '',
  passing_score INTEGER NOT NULL DEFAULT 70 CHECK (passing_score BETWEEN 0 AND 100),
  is_published BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT aspekindo_lms_lessons_slug_format
    CHECK (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  UNIQUE (id, course_id),
  UNIQUE (course_id, slug),
  UNIQUE (course_id, sort_order),
  CONSTRAINT aspekindo_lms_lessons_session_same_course
    FOREIGN KEY (session_id, course_id)
    REFERENCES public.aspekindo_lms_sessions (id, course_id)
    ON DELETE SET NULL (session_id)
);

CREATE INDEX aspekindo_lms_lessons_catalog_idx
  ON public.aspekindo_lms_lessons (course_id, is_published, sort_order);

CREATE TABLE public.aspekindo_lms_materials (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL REFERENCES public.aspekindo_lms_lessons(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  material_type TEXT NOT NULL DEFAULT 'markdown'
    CHECK (material_type IN ('markdown', 'link')),
  content_markdown TEXT NOT NULL DEFAULT '',
  external_url TEXT NOT NULL DEFAULT '',
  is_published BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT aspekindo_lms_materials_safe_external_url
    CHECK (external_url = '' OR external_url ~* '^https://'),
  CONSTRAINT aspekindo_lms_materials_has_content
    CHECK (
      (material_type = 'markdown' AND content_markdown <> '')
      OR (material_type = 'link' AND external_url <> '')
    ),
  UNIQUE (lesson_id, sort_order)
);

CREATE INDEX aspekindo_lms_materials_published_idx
  ON public.aspekindo_lms_materials (lesson_id, is_published, sort_order);

CREATE TABLE public.aspekindo_lms_enrollments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  course_id UUID NOT NULL REFERENCES public.aspekindo_lms_courses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'enrolled'
    CHECK (status IN ('enrolled', 'in_progress', 'completed', 'withdrawn')),
  enrolled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  last_activity_at TIMESTAMPTZ,
  notes TEXT NOT NULL DEFAULT '',
  UNIQUE (course_id, user_id),
  UNIQUE (id, user_id, course_id),
  CONSTRAINT aspekindo_lms_enrollments_completion_date
    CHECK (completed_at IS NULL OR status = 'completed')
);

CREATE INDEX aspekindo_lms_enrollments_user_idx
  ON public.aspekindo_lms_enrollments (user_id, status, enrolled_at DESC);

CREATE TABLE public.aspekindo_lms_lesson_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID NOT NULL,
  course_id UUID NOT NULL,
  lesson_id UUID NOT NULL,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (status IN ('not_started', 'in_progress', 'completed')),
  progress_percent INTEGER NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, lesson_id),
  CONSTRAINT aspekindo_lms_progress_enrollment_fk
    FOREIGN KEY (enrollment_id, user_id, course_id)
    REFERENCES public.aspekindo_lms_enrollments (id, user_id, course_id)
    ON DELETE CASCADE,
  CONSTRAINT aspekindo_lms_progress_lesson_fk
    FOREIGN KEY (lesson_id, course_id)
    REFERENCES public.aspekindo_lms_lessons (id, course_id)
    ON DELETE CASCADE,
  CONSTRAINT aspekindo_lms_progress_state_values
    CHECK (
      (status = 'not_started' AND progress_percent = 0)
      OR (status = 'in_progress' AND progress_percent BETWEEN 1 AND 99)
      OR (status = 'completed' AND progress_percent = 100)
    ),
  CONSTRAINT aspekindo_lms_progress_completion_date
    CHECK (completed_at IS NULL OR status = 'completed')
);

CREATE INDEX aspekindo_lms_progress_user_idx
  ON public.aspekindo_lms_lesson_progress (user_id, course_id, status);

CREATE TABLE public.aspekindo_lms_quiz_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lesson_id UUID NOT NULL REFERENCES public.aspekindo_lms_lessons(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  points INTEGER NOT NULL DEFAULT 1 CHECK (points > 0),
  sort_order INTEGER NOT NULL DEFAULT 0 CHECK (sort_order >= 0),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT aspekindo_lms_quiz_questions_options_array
    CHECK (jsonb_typeof(options) = 'array' AND jsonb_array_length(options) >= 2),
  UNIQUE (id, lesson_id),
  UNIQUE (lesson_id, sort_order)
);

CREATE TABLE public.aspekindo_lms_quiz_answer_keys (
  question_id UUID PRIMARY KEY REFERENCES public.aspekindo_lms_quiz_questions(id) ON DELETE CASCADE,
  correct_option INTEGER NOT NULL CHECK (correct_option >= 0),
  explanation_markdown TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.aspekindo_lms_quiz_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enrollment_id UUID NOT NULL,
  course_id UUID NOT NULL,
  lesson_id UUID NOT NULL,
  user_id UUID NOT NULL,
  attempt_number INTEGER NOT NULL CHECK (attempt_number > 0),
  score INTEGER NOT NULL DEFAULT 0 CHECK (score BETWEEN 0 AND 100),
  total_questions INTEGER NOT NULL DEFAULT 0 CHECK (total_questions >= 0),
  correct_answers INTEGER NOT NULL DEFAULT 0 CHECK (correct_answers >= 0),
  passed BOOLEAN NOT NULL DEFAULT false,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, lesson_id, attempt_number),
  UNIQUE (id, lesson_id),
  CONSTRAINT aspekindo_lms_attempts_enrollment_fk
    FOREIGN KEY (enrollment_id, user_id, course_id)
    REFERENCES public.aspekindo_lms_enrollments (id, user_id, course_id)
    ON DELETE CASCADE,
  CONSTRAINT aspekindo_lms_attempts_lesson_fk
    FOREIGN KEY (lesson_id, course_id)
    REFERENCES public.aspekindo_lms_lessons (id, course_id)
    ON DELETE CASCADE,
  CONSTRAINT aspekindo_lms_attempts_answer_count
    CHECK (correct_answers <= total_questions)
);

CREATE TABLE public.aspekindo_lms_quiz_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID NOT NULL,
  lesson_id UUID NOT NULL,
  question_id UUID NOT NULL,
  selected_option INTEGER NOT NULL CHECK (selected_option >= 0),
  is_correct BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (attempt_id, question_id),
  CONSTRAINT aspekindo_lms_answers_attempt_fk
    FOREIGN KEY (attempt_id, lesson_id)
    REFERENCES public.aspekindo_lms_quiz_attempts (id, lesson_id)
    ON DELETE CASCADE,
  CONSTRAINT aspekindo_lms_answers_question_fk
    FOREIGN KEY (question_id, lesson_id)
    REFERENCES public.aspekindo_lms_quiz_questions (id, lesson_id)
    ON DELETE CASCADE
);

CREATE TABLE public.aspekindo_lms_completion_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  record_number TEXT NOT NULL DEFAULT '',
  export_schema_version TEXT NOT NULL DEFAULT 'aspekindo-pub-lms-v1',
  enrollment_id UUID NOT NULL,
  course_id UUID NOT NULL,
  session_id UUID,
  user_id UUID NOT NULL,
  record_type TEXT NOT NULL DEFAULT 'completion'
    CHECK (record_type IN ('completion', 'attendance', 'participation')),
  status TEXT NOT NULL DEFAULT 'ready_for_review'
    CHECK (status IN ('draft', 'ready_for_review', 'exported')),
  evidence_title TEXT NOT NULL,
  evidence_description TEXT NOT NULL DEFAULT '',
  evidence_url TEXT NOT NULL DEFAULT '',
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  export_batch_id TEXT,
  exported_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (record_number),
  CONSTRAINT aspekindo_lms_completion_enrollment_fk
    FOREIGN KEY (enrollment_id, user_id, course_id)
    REFERENCES public.aspekindo_lms_enrollments (id, user_id, course_id)
    ON DELETE CASCADE,
  CONSTRAINT aspekindo_lms_completion_session_fk
    FOREIGN KEY (session_id, course_id)
    REFERENCES public.aspekindo_lms_sessions (id, course_id)
    ON DELETE SET NULL (session_id),
  CONSTRAINT aspekindo_lms_completion_safe_url
    CHECK (evidence_url = '' OR evidence_url ~* '^https://'),
  CONSTRAINT aspekindo_lms_completion_record_scope
    CHECK (
      (record_type = 'completion' AND session_id IS NULL)
      OR (record_type IN ('attendance', 'participation') AND session_id IS NOT NULL)
    ),
  CONSTRAINT aspekindo_lms_completion_export_metadata
    CHECK (
      (status <> 'exported' AND exported_at IS NULL)
      OR (status = 'exported' AND export_batch_id IS NOT NULL AND exported_at IS NOT NULL)
    )
);

CREATE INDEX aspekindo_lms_completion_user_idx
  ON public.aspekindo_lms_completion_records (user_id, issued_at DESC);
CREATE INDEX aspekindo_lms_completion_export_idx
  ON public.aspekindo_lms_completion_records (status, issued_at);
CREATE UNIQUE INDEX aspekindo_lms_completion_per_enrollment_unique
  ON public.aspekindo_lms_completion_records (enrollment_id)
  WHERE record_type = 'completion';
CREATE UNIQUE INDEX aspekindo_lms_session_evidence_unique
  ON public.aspekindo_lms_completion_records (enrollment_id, session_id, record_type)
  WHERE record_type IN ('attendance', 'participation');

ALTER TABLE public.aspekindo_lms_courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aspekindo_lms_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aspekindo_lms_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aspekindo_lms_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aspekindo_lms_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aspekindo_lms_lesson_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aspekindo_lms_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aspekindo_lms_quiz_answer_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aspekindo_lms_quiz_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aspekindo_lms_quiz_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.aspekindo_lms_completion_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated members can view published ASPEKINDO LMS courses"
  ON public.aspekindo_lms_courses FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      status = 'published'
      AND (
        member_only = false
        OR EXISTS (
          SELECT 1 FROM public.aspekindo_members member
          WHERE member.user_id = auth.uid()
            AND member.membership_status = 'active'
        )
      )
    )
  );
CREATE POLICY "Admins can manage ASPEKINDO LMS courses"
  ON public.aspekindo_lms_courses FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated members can view published ASPEKINDO LMS sessions"
  ON public.aspekindo_lms_sessions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      status = 'published'
      AND EXISTS (
        SELECT 1 FROM public.aspekindo_lms_courses course
        WHERE course.id = course_id
          AND course.status = 'published'
          AND (
            course.member_only = false
            OR EXISTS (
              SELECT 1 FROM public.aspekindo_members member
              WHERE member.user_id = auth.uid()
                AND member.membership_status = 'active'
            )
          )
      )
    )
  );
CREATE POLICY "Admins can manage ASPEKINDO LMS sessions"
  ON public.aspekindo_lms_sessions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated members can view published ASPEKINDO LMS lessons"
  ON public.aspekindo_lms_lessons FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      is_published = true
      AND EXISTS (
        SELECT 1 FROM public.aspekindo_lms_courses course
        WHERE course.id = course_id
          AND course.status = 'published'
          AND (
            course.member_only = false
            OR EXISTS (
              SELECT 1 FROM public.aspekindo_members member
              WHERE member.user_id = auth.uid()
                AND member.membership_status = 'active'
            )
          )
      )
    )
  );
CREATE POLICY "Admins can manage ASPEKINDO LMS lessons"
  ON public.aspekindo_lms_lessons FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated members can view published ASPEKINDO LMS materials"
  ON public.aspekindo_lms_materials FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR (
      is_published = true
      AND EXISTS (
        SELECT 1
        FROM public.aspekindo_lms_lessons lesson
        JOIN public.aspekindo_lms_courses course ON course.id = lesson.course_id
        WHERE lesson.id = lesson_id
          AND lesson.is_published = true
          AND course.status = 'published'
          AND (
            course.member_only = false
            OR EXISTS (
              SELECT 1 FROM public.aspekindo_members member
              WHERE member.user_id = auth.uid()
                AND member.membership_status = 'active'
            )
          )
      )
    )
  );
CREATE POLICY "Admins can manage ASPEKINDO LMS materials"
  ON public.aspekindo_lms_materials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own ASPEKINDO LMS enrollments"
  ON public.aspekindo_lms_enrollments FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can enroll in eligible published ASPEKINDO LMS courses"
  ON public.aspekindo_lms_enrollments FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'enrolled'
    AND EXISTS (
      SELECT 1 FROM public.aspekindo_lms_courses course
      WHERE course.id = course_id
        AND course.status = 'published'
        AND (
          course.member_only = false
          OR EXISTS (
            SELECT 1 FROM public.aspekindo_members member
            WHERE member.user_id = auth.uid()
              AND member.membership_status = 'active'
          )
        )
    )
  );
CREATE POLICY "Admins can manage ASPEKINDO LMS enrollments"
  ON public.aspekindo_lms_enrollments FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own ASPEKINDO LMS progress"
  ON public.aspekindo_lms_lesson_progress FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can start their own ASPEKINDO LMS progress"
  ON public.aspekindo_lms_lesson_progress FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status IN ('not_started', 'in_progress')
    AND EXISTS (
      SELECT 1 FROM public.aspekindo_lms_enrollments enrollment
      WHERE enrollment.id = enrollment_id
        AND enrollment.user_id = auth.uid()
        AND enrollment.course_id = course_id
    )
  );
CREATE POLICY "Users can update non-terminal ASPEKINDO LMS progress"
  ON public.aspekindo_lms_lesson_progress FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (
    user_id = auth.uid()
    AND status IN ('not_started', 'in_progress')
    AND EXISTS (
      SELECT 1 FROM public.aspekindo_lms_enrollments enrollment
      WHERE enrollment.id = enrollment_id
        AND enrollment.user_id = auth.uid()
        AND enrollment.course_id = course_id
    )
  );
CREATE POLICY "Admins can manage ASPEKINDO LMS progress"
  ON public.aspekindo_lms_lesson_progress FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Enrolled users can view published ASPEKINDO LMS quiz questions"
  ON public.aspekindo_lms_quiz_questions FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1
      FROM public.aspekindo_lms_lessons lesson
      JOIN public.aspekindo_lms_courses course ON course.id = lesson.course_id
      JOIN public.aspekindo_lms_enrollments enrollment ON enrollment.course_id = course.id
      WHERE lesson.id = lesson_id
        AND lesson.is_published = true
        AND course.status = 'published'
        AND enrollment.user_id = auth.uid()
        AND enrollment.status IN ('enrolled', 'in_progress', 'completed')
    )
  );
CREATE POLICY "Admins can manage ASPEKINDO LMS quiz questions"
  ON public.aspekindo_lms_quiz_questions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- Answer keys are intentionally admin-only. Participants receive only the
-- question/options columns and submit through the server-side RPC below.
CREATE POLICY "Admins can manage ASPEKINDO LMS quiz answer keys"
  ON public.aspekindo_lms_quiz_answer_keys FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own ASPEKINDO LMS quiz attempts"
  ON public.aspekindo_lms_quiz_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage ASPEKINDO LMS quiz attempts"
  ON public.aspekindo_lms_quiz_attempts FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own ASPEKINDO LMS quiz answers"
  ON public.aspekindo_lms_quiz_answers FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.aspekindo_lms_quiz_attempts attempt
      WHERE attempt.id = attempt_id
        AND attempt.user_id = auth.uid()
    )
  );
CREATE POLICY "Admins can manage ASPEKINDO LMS quiz answers"
  ON public.aspekindo_lms_quiz_answers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Users can view their own ASPEKINDO LMS completion records"
  ON public.aspekindo_lms_completion_records FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can manage ASPEKINDO LMS completion records"
  ON public.aspekindo_lms_completion_records FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.aspekindo_lms_set_record_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.record_number = '' THEN
    NEW.record_number := 'PUB-LMS-' || to_char(NEW.issued_at, 'YYYY') || '-' ||
      upper(substr(replace(NEW.id::text, '-', ''), 1, 12));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER aspekindo_lms_completion_record_number
  BEFORE INSERT ON public.aspekindo_lms_completion_records
  FOR EACH ROW EXECUTE FUNCTION public.aspekindo_lms_set_record_number();

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
  question_total INTEGER;
  correct_total INTEGER := 0;
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

  SELECT count(*)::INTEGER INTO question_total
  FROM public.aspekindo_lms_quiz_questions question
  WHERE question.lesson_id = _lesson_id;
  IF question_total = 0 OR jsonb_object_length(_answers) <> question_total THEN
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
      SELECT correct_option INTO answer_key
      FROM public.aspekindo_lms_quiz_answer_keys
      WHERE question_id = answer_entry.key::UUID;
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
    END IF;
  END LOOP;

  UPDATE public.aspekindo_lms_quiz_attempts
  SET total_questions = question_total,
      correct_answers = correct_total,
      score = round((correct_total::NUMERIC / question_total) * 100)::INTEGER,
      passed = round((correct_total::NUMERIC / question_total) * 100)::INTEGER >= lesson_row.passing_score
  WHERE id = attempt_row.id
  RETURNING * INTO attempt_row;

  RETURN attempt_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.submit_aspekindo_lms_quiz(UUID, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.submit_aspekindo_lms_quiz(UUID, JSONB) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_aspekindo_lms_quiz(UUID, JSONB) TO authenticated;

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

REVOKE EXECUTE ON FUNCTION public.complete_aspekindo_lms_lesson(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_aspekindo_lms_lesson(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_aspekindo_lms_lesson(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_aspekindo_lms_course(_course_id UUID)
RETURNS public.aspekindo_lms_enrollments
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  enrollment_row public.aspekindo_lms_enrollments;
  completed_count INTEGER;
  lesson_count INTEGER;
BEGIN
  SELECT * INTO enrollment_row
  FROM public.aspekindo_lms_enrollments
  WHERE course_id = _course_id
    AND user_id = auth.uid()
    AND status IN ('enrolled', 'in_progress');
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment kursus tidak ditemukan atau sudah selesai';
  END IF;

  SELECT count(*)::INTEGER INTO lesson_count
  FROM public.aspekindo_lms_lessons
  WHERE course_id = _course_id AND is_published = true;
  SELECT count(*)::INTEGER INTO completed_count
  FROM public.aspekindo_lms_lesson_progress progress
  JOIN public.aspekindo_lms_lessons lesson ON lesson.id = progress.lesson_id
  WHERE progress.enrollment_id = enrollment_row.id
    AND progress.status = 'completed'
    AND lesson.is_published = true;
  IF lesson_count = 0 OR completed_count <> lesson_count THEN
    RAISE EXCEPTION 'Selesaikan seluruh pelajaran terbit terlebih dahulu';
  END IF;

  UPDATE public.aspekindo_lms_enrollments
  SET status = 'completed', completed_at = COALESCE(completed_at, now()),
      last_activity_at = now()
  WHERE id = enrollment_row.id
  RETURNING * INTO enrollment_row;

  INSERT INTO public.aspekindo_lms_completion_records (
    enrollment_id, course_id, user_id, record_type, evidence_title,
    evidence_description, metadata, created_by
  )
  SELECT enrollment_row.id, _course_id, auth.uid(), 'completion',
    course.title || ' — Completion Record PUB',
    'Catatan penyelesaian pembelajaran untuk persiapan peninjauan dan rekap LKUT. PUB ASPEKINDO tidak menggantikan aplikasi resmi Kementerian PU/LPJK.',
    jsonb_build_object(
      'course_code', course.course_code,
      'course_slug', course.slug,
      'course_title', course.title,
      'completed_at', enrollment_row.completed_at,
      'preparation_only', true
    ),
    auth.uid()
  FROM public.aspekindo_lms_courses course
  WHERE course.id = _course_id
  ON CONFLICT (enrollment_id) WHERE record_type = 'completion' DO NOTHING;

  RETURN enrollment_row;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.complete_aspekindo_lms_course(UUID) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.complete_aspekindo_lms_course(UUID) FROM anon;
GRANT EXECUTE ON FUNCTION public.complete_aspekindo_lms_course(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_aspekindo_lms_courses_updated_at
  BEFORE UPDATE ON public.aspekindo_lms_courses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_aspekindo_lms_sessions_updated_at
  BEFORE UPDATE ON public.aspekindo_lms_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_aspekindo_lms_lessons_updated_at
  BEFORE UPDATE ON public.aspekindo_lms_lessons
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_aspekindo_lms_materials_updated_at
  BEFORE UPDATE ON public.aspekindo_lms_materials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_aspekindo_lms_lesson_progress_updated_at
  BEFORE UPDATE ON public.aspekindo_lms_lesson_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_aspekindo_lms_completion_records_updated_at
  BEFORE UPDATE ON public.aspekindo_lms_completion_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();