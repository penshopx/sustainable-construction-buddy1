-- Minimal test-only dependencies for the actual LMS RPC definitions, never deploy.
CREATE SCHEMA auth;
CREATE ROLE authenticated NOLOGIN;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;
CREATE TABLE auth.users (
  id uuid PRIMARY KEY, instance_id uuid, aud text, role text, email text,
  encrypted_password text, email_confirmed_at timestamptz,
  raw_app_meta_data jsonb, raw_user_meta_data jsonb,
  created_at timestamptz, updated_at timestamptz
);
CREATE TABLE public.aspekindo_lms_courses (
  id uuid PRIMARY KEY, slug text, title text, status text, member_only boolean
);
CREATE TABLE public.aspekindo_lms_lessons (
  id uuid PRIMARY KEY, course_id uuid REFERENCES public.aspekindo_lms_courses(id),
  title text, slug text, passing_score integer, is_published boolean,
  sort_order integer DEFAULT 0, created_at timestamptz DEFAULT now()
);
CREATE TABLE public.aspekindo_lms_enrollments (
  id uuid PRIMARY KEY, course_id uuid REFERENCES public.aspekindo_lms_courses(id),
  user_id uuid REFERENCES auth.users(id), status text DEFAULT 'enrolled',
  last_activity_at timestamptz
);
CREATE TABLE public.aspekindo_lms_quiz_questions (
  id uuid PRIMARY KEY, lesson_id uuid REFERENCES public.aspekindo_lms_lessons(id),
  question_text text, options jsonb, sort_order integer,
  points integer NOT NULL DEFAULT 1 CHECK (points > 0)
);
CREATE TABLE public.aspekindo_lms_quiz_answer_keys (
  question_id uuid PRIMARY KEY REFERENCES public.aspekindo_lms_quiz_questions(id),
  correct_option integer
);
CREATE TABLE public.aspekindo_lms_quiz_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid REFERENCES public.aspekindo_lms_enrollments(id),
  course_id uuid REFERENCES public.aspekindo_lms_courses(id),
  lesson_id uuid REFERENCES public.aspekindo_lms_lessons(id),
  user_id uuid REFERENCES auth.users(id),
  attempt_number integer, score integer DEFAULT 0, total_questions integer DEFAULT 0,
  correct_answers integer DEFAULT 0, passed boolean DEFAULT false,
  UNIQUE (enrollment_id, lesson_id, attempt_number)
);
CREATE TABLE public.aspekindo_lms_quiz_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid REFERENCES public.aspekindo_lms_quiz_attempts(id),
  lesson_id uuid REFERENCES public.aspekindo_lms_lessons(id),
  question_id uuid REFERENCES public.aspekindo_lms_quiz_questions(id),
  selected_option integer, is_correct boolean
);
CREATE TABLE public.aspekindo_lms_lesson_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid REFERENCES public.aspekindo_lms_enrollments(id),
  course_id uuid REFERENCES public.aspekindo_lms_courses(id),
  lesson_id uuid REFERENCES public.aspekindo_lms_lessons(id),
  user_id uuid REFERENCES auth.users(id),
  status text, progress_percent integer, started_at timestamptz,
  completed_at timestamptz,
  UNIQUE (enrollment_id, lesson_id)
);
GRANT USAGE ON SCHEMA auth, public TO authenticated;
GRANT EXECUTE ON FUNCTION auth.uid() TO authenticated;
GRANT SELECT ON public.aspekindo_lms_quiz_attempts,
  public.aspekindo_lms_quiz_answers, public.aspekindo_lms_lesson_progress
  TO authenticated;