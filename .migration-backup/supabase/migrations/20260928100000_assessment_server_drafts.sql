-- Drafts are private to their owner and are not exposed as table rows through PostgREST.
CREATE TABLE public.assessment_drafts (
  pre_test_id uuid PRIMARY KEY REFERENCES public.pre_tests(id) ON DELETE CASCADE,
  draft jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.assessment_drafts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.assessment_drafts FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.validate_assessment_draft(_draft jsonb)
RETURNS boolean LANGUAGE sql IMMUTABLE SET search_path = public AS $$
  SELECT jsonb_typeof(_draft) = 'object'
    AND _draft->>'version' = '1'
    AND jsonb_typeof(_draft->'questions') = 'array'
    AND jsonb_array_length(CASE WHEN jsonb_typeof(_draft->'questions') = 'array' THEN _draft->'questions' ELSE '[]'::jsonb END) BETWEEN 1 AND 100
    AND jsonb_typeof(_draft->'answers') = 'object'
    AND jsonb_typeof(_draft->'answerResults') = 'object'
    AND _draft->>'phase' IN ('test', 'review')
    AND pg_column_size(_draft) < 100000;
$$;
REVOKE ALL ON FUNCTION public.validate_assessment_draft(jsonb) FROM PUBLIC, anon, authenticated;

CREATE FUNCTION public.start_assessment_draft(_draft jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _id uuid;
  _count integer;
  _started_at timestamptz;
BEGIN
  IF auth.uid() IS NULL OR NOT public.validate_assessment_draft(_draft) THEN
    RAISE EXCEPTION 'Invalid assessment draft';
  END IF;
  _count := jsonb_array_length(_draft->'questions');
  INSERT INTO public.pre_tests (user_id, total_questions, status)
    VALUES (auth.uid(), _count, 'in_progress') RETURNING id, started_at INTO _id, _started_at;
  INSERT INTO public.assessment_drafts (pre_test_id, draft)
    VALUES (_id, _draft || jsonb_build_object('preTestId', _id));
  RETURN jsonb_build_object('preTestId', _id, 'startedAt', _started_at);
END;
$$;
REVOKE ALL ON FUNCTION public.start_assessment_draft(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_assessment_draft(jsonb) TO authenticated;

CREATE FUNCTION public.save_assessment_draft(_pre_test_id uuid, _draft jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _test public.pre_tests%ROWTYPE;
BEGIN
  SELECT * INTO _test FROM public.pre_tests WHERE id = _pre_test_id FOR UPDATE;
  IF auth.uid() IS NULL OR _test.user_id IS DISTINCT FROM auth.uid()
     OR _test.status IS DISTINCT FROM 'in_progress' THEN
    RAISE EXCEPTION 'Assessment unavailable';
  END IF;
  IF NOT public.validate_assessment_draft(_draft)
     OR _draft->>'preTestId' IS DISTINCT FROM _pre_test_id::text
     OR jsonb_array_length(_draft->'questions') <> _test.total_questions THEN
    RAISE EXCEPTION 'Invalid assessment draft';
  END IF;
  INSERT INTO public.assessment_drafts (pre_test_id, draft, updated_at)
    VALUES (_pre_test_id, _draft, now())
    ON CONFLICT (pre_test_id) DO UPDATE SET draft = EXCLUDED.draft, updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.save_assessment_draft(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_assessment_draft(uuid, jsonb) TO authenticated;

CREATE FUNCTION public.get_active_assessment_draft()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _record record;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  SELECT pt.id, pt.started_at, pt.total_questions, ad.draft
    INTO _record
    FROM public.pre_tests pt
    JOIN public.assessment_drafts ad ON ad.pre_test_id = pt.id
    WHERE pt.user_id = auth.uid() AND pt.status = 'in_progress'
    ORDER BY pt.started_at DESC, pt.id DESC LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('preTestId', _record.id, 'startedAt', _record.started_at,
    'totalQuestions', _record.total_questions, 'draft', _record.draft);
END;
$$;
REVOKE ALL ON FUNCTION public.get_active_assessment_draft() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_active_assessment_draft() TO authenticated;