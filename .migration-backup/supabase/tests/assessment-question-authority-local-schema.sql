CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE TABLE public.questions (
  id uuid PRIMARY KEY, correct_answer integer NOT NULL,
  domain_id uuid NOT NULL DEFAULT '00000000-0000-4000-8000-000000000401'
);
CREATE TABLE public.profiles (
  user_id uuid PRIMARY KEY, current_level text, total_score integer
);
CREATE TABLE public.pre_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  total_questions integer NOT NULL, status text NOT NULL,
  correct_answers integer NOT NULL DEFAULT 0, score integer, determined_level text,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp(), completed_at timestamptz
);
CREATE TABLE public.pre_test_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pre_test_id uuid REFERENCES public.pre_tests(id),
  question_id uuid REFERENCES public.questions(id),
  selected_answer integer, is_correct boolean
);
-- The deadline migration renames this; the next migration installs the real scorer.
CREATE FUNCTION public.submit_assessment(uuid, jsonb)
RETURNS jsonb LANGUAGE sql AS $$ SELECT '{}'::jsonb; $$;
