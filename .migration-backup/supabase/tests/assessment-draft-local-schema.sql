CREATE ROLE anon;
CREATE ROLE authenticated;
CREATE SCHEMA auth;
CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$
  SELECT NULLIF(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;
CREATE TABLE public.pre_tests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL,
  total_questions integer NOT NULL, status text NOT NULL,
  submitted_answers jsonb,
  started_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE public.pre_test_answers (id uuid PRIMARY KEY);
-- Scorer spy: the real migrated submission wrapper decides the answer set;
-- this isolated fixture records it and models idempotent completion.
CREATE FUNCTION public.submit_assessment(_pre_test_id uuid, _answers jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE _recorded jsonb;
BEGIN
  SELECT submitted_answers INTO _recorded FROM public.pre_tests
    WHERE id = _pre_test_id AND status = 'completed';
  IF NOT FOUND THEN
    _recorded := _answers;
    UPDATE public.pre_tests SET status = 'completed', submitted_answers = _recorded
      WHERE id = _pre_test_id;
  END IF;
  RETURN jsonb_build_object('answers', _recorded);
END;
$$;
