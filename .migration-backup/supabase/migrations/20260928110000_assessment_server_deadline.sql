-- The server owns assessment start/deadline and all writes to result rows.
ALTER TABLE public.pre_tests
  ADD COLUMN deadline_at timestamptz;
UPDATE public.pre_tests
  SET deadline_at = started_at + total_questions * interval '90 seconds';
-- Existing SQL callers that insert a pre-test without an explicit deadline
-- still receive a server-calculated one.
CREATE FUNCTION public.set_assessment_deadline()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.deadline_at IS NULL THEN
    NEW.deadline_at := NEW.started_at + NEW.total_questions * interval '90 seconds';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER set_assessment_deadline_before_insert
  BEFORE INSERT ON public.pre_tests
  FOR EACH ROW EXECUTE FUNCTION public.set_assessment_deadline();
ALTER TABLE public.pre_tests ALTER COLUMN deadline_at SET NOT NULL;
REVOKE ALL ON FUNCTION public.set_assessment_deadline() FROM PUBLIC, anon, authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.pre_tests FROM authenticated, anon;
REVOKE INSERT, UPDATE, DELETE ON public.pre_test_answers FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.start_assessment_draft(_draft jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _id uuid;
  _count integer;
  _started_at timestamptz;
  _deadline_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.validate_assessment_draft(_draft) THEN
    RAISE EXCEPTION 'Invalid assessment draft';
  END IF;
  _count := jsonb_array_length(_draft->'questions');
  _started_at := clock_timestamp();
  _deadline_at := _started_at + _count * interval '90 seconds';
  INSERT INTO public.pre_tests (user_id, total_questions, status, started_at, deadline_at)
    VALUES (auth.uid(), _count, 'in_progress', _started_at, _deadline_at) RETURNING id INTO _id;
  INSERT INTO public.assessment_drafts (pre_test_id, draft)
    VALUES (_id, _draft || jsonb_build_object('preTestId', _id));
  RETURN jsonb_build_object('preTestId', _id, 'startedAt', _started_at,
    'deadlineAt', _deadline_at, 'serverNow', clock_timestamp());
END;
$$;
REVOKE ALL ON FUNCTION public.start_assessment_draft(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_assessment_draft(jsonb) TO authenticated;

CREATE FUNCTION public.assessment_deadline_passed(_deadline_at timestamptz, _received_at timestamptz)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT _received_at >= _deadline_at;
$$;
REVOKE ALL ON FUNCTION public.assessment_deadline_passed(timestamptz, timestamptz) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.save_assessment_draft(_pre_test_id uuid, _draft jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _test public.pre_tests%ROWTYPE;
BEGIN
  SELECT * INTO _test FROM public.pre_tests WHERE id = _pre_test_id FOR UPDATE;
  IF auth.uid() IS NULL OR _test.user_id IS DISTINCT FROM auth.uid()
     OR _test.status IS DISTINCT FROM 'in_progress' THEN
    RAISE EXCEPTION 'Assessment unavailable';
  END IF;
  IF public.assessment_deadline_passed(_test.deadline_at, clock_timestamp()) THEN
    RAISE EXCEPTION 'Assessment deadline has passed';
  END IF;
  IF NOT public.validate_assessment_draft(_draft)
     OR _draft->>'preTestId' IS DISTINCT FROM _pre_test_id::text
     OR jsonb_array_length(_draft->'questions') <> _test.total_questions THEN
    RAISE EXCEPTION 'Invalid assessment draft';
  END IF;
  INSERT INTO public.assessment_drafts (pre_test_id, draft, updated_at)
    VALUES (_pre_test_id, _draft, clock_timestamp())
    ON CONFLICT (pre_test_id) DO UPDATE SET draft = EXCLUDED.draft, updated_at = clock_timestamp();
END;
$$;
REVOKE ALL ON FUNCTION public.save_assessment_draft(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_assessment_draft(uuid, jsonb) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_active_assessment_draft()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _record record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  SELECT pt.id, pt.started_at, pt.deadline_at, pt.total_questions, ad.draft
    INTO _record
    FROM public.pre_tests pt
    JOIN public.assessment_drafts ad ON ad.pre_test_id = pt.id
    WHERE pt.user_id = auth.uid() AND pt.status = 'in_progress'
    ORDER BY pt.started_at DESC, pt.id DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('preTestId', _record.id, 'startedAt', _record.started_at,
    'deadlineAt', _record.deadline_at, 'serverNow', clock_timestamp(),
    'totalQuestions', _record.total_questions, 'draft', _record.draft);
END;
$$;
REVOKE ALL ON FUNCTION public.get_active_assessment_draft() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_assessment_draft() TO authenticated;

-- For browser-only drafts created before server draft storage existed.
CREATE FUNCTION public.get_assessment_time(_pre_test_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _deadline_at timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT deadline_at INTO _deadline_at FROM public.pre_tests
    WHERE id = _pre_test_id AND user_id = auth.uid() AND status = 'in_progress';
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('deadlineAt', _deadline_at, 'serverNow', clock_timestamp());
END;
$$;
REVOKE ALL ON FUNCTION public.get_assessment_time(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_assessment_time(uuid) TO authenticated;

-- Preserve the existing scoring/profile implementation behind a non-public entry point.
ALTER FUNCTION public.submit_assessment(uuid, jsonb) RENAME TO submit_assessment_scoring;
REVOKE ALL ON FUNCTION public.submit_assessment_scoring(uuid, jsonb) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.submit_assessment(_pre_test_id uuid, _answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _test public.pre_tests%ROWTYPE;
  _saved jsonb;
  _effective jsonb;
BEGIN
  SELECT * INTO _test FROM public.pre_tests WHERE id = _pre_test_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Pre-test not found'); END IF;
  IF auth.uid() IS NULL OR _test.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;
  -- A previously completed submission always returns the original result, even after expiry.
  IF _test.status = 'completed' THEN
    RETURN public.submit_assessment_scoring(_pre_test_id, _answers);
  END IF;
  _effective := _answers;
  -- Equality is expired. A late request may finalize the test, but cannot inject
  -- answers: only the last snapshot committed before expiry is scored.
  IF public.assessment_deadline_passed(_test.deadline_at, clock_timestamp()) THEN
    SELECT draft INTO _saved FROM public.assessment_drafts WHERE pre_test_id = _pre_test_id;
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'question_id', q.value->>'id',
      'selected_answer', COALESCE((_saved->'answers'->>(q.value->>'id'))::integer, -1)
    )), '[]'::jsonb) INTO _effective
    FROM jsonb_array_elements(COALESCE(_saved->'questions', '[]'::jsonb)) AS q(value);
  END IF;
  RETURN public.submit_assessment_scoring(_pre_test_id, _effective);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_assessment(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_assessment(uuid, jsonb) TO authenticated;