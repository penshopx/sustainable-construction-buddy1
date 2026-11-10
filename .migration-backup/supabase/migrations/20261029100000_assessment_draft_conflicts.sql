-- Compare-and-swap under the same result-row lock used by submission.
-- Tokens live inside the draft, so old clients without a token cannot overwrite it.
UPDATE public.assessment_drafts SET draft = draft || '{"revision":0}'::jsonb;

DROP FUNCTION public.save_assessment_draft(uuid, jsonb);
CREATE FUNCTION public.save_assessment_draft(_pre_test_id uuid, _draft jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _test public.pre_tests%ROWTYPE;
  _saved jsonb;
  _revision bigint;
BEGIN
  SELECT * INTO _test FROM public.pre_tests WHERE id = _pre_test_id FOR UPDATE;
  IF auth.uid() IS NULL OR _test.user_id IS DISTINCT FROM auth.uid()
     OR _test.status IS DISTINCT FROM 'in_progress' THEN
    RAISE EXCEPTION 'Assessment unavailable';
  END IF;
  IF public.assessment_deadline_passed(_test.deadline_at, clock_timestamp()) THEN
    RAISE EXCEPTION 'Assessment deadline has passed';
  END IF;
  IF public.validate_assessment_draft(_draft) IS NOT TRUE
     OR _draft->>'preTestId' IS DISTINCT FROM _pre_test_id::text
     OR jsonb_array_length(_draft->'questions') <> _test.total_questions THEN
    RAISE EXCEPTION 'Invalid assessment draft';
  END IF;
  -- Older app bundles ignore JSON success bodies. Return a real error so they
  -- retain their local fallback instead of treating a rejected write as saved.
  IF NOT (_draft ? 'revision') THEN
    RAISE EXCEPTION 'Assessment version is required; reload the application';
  END IF;
  SELECT draft INTO _saved FROM public.assessment_drafts WHERE pre_test_id = _pre_test_id;
  _revision := COALESCE((_saved->>'revision')::bigint, 0);
  IF _draft->'revision' IS DISTINCT FROM to_jsonb(_revision) THEN
    RETURN jsonb_build_object('saved', false, 'draft', _saved || jsonb_build_object('revision', _revision));
  END IF;
  IF _saved IS NOT NULL AND _saved->'questions' IS DISTINCT FROM _draft->'questions' THEN
    RAISE EXCEPTION 'Assessment questions changed';
  END IF;
  _saved := _draft || jsonb_build_object('revision', _revision + 1);
  INSERT INTO public.assessment_drafts (pre_test_id, draft, updated_at)
    VALUES (_pre_test_id, _saved, clock_timestamp())
    ON CONFLICT (pre_test_id) DO UPDATE SET draft = EXCLUDED.draft, updated_at = EXCLUDED.updated_at;
  RETURN jsonb_build_object('saved', true, 'draft', _saved);
END;
$$;
REVOKE ALL ON FUNCTION public.save_assessment_draft(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_assessment_draft(uuid, jsonb) TO authenticated;

-- New drafts start at revision zero; wrap without changing clock/ownership logic.
ALTER FUNCTION public.start_assessment_draft(jsonb) RENAME TO start_assessment_draft_unversioned;
REVOKE ALL ON FUNCTION public.start_assessment_draft_unversioned(jsonb) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.start_assessment_draft(_draft jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN public.start_assessment_draft_unversioned(_draft || '{"revision":0}'::jsonb)
    || '{"revision":0}'::jsonb;
END;
$$;
REVOKE ALL ON FUNCTION public.start_assessment_draft(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.start_assessment_draft(jsonb) TO authenticated;

-- Finalization and draft saves take the same pre-test row lock. Always score
-- the newest committed draft, including writes committed after the browser's
-- final sync. A separate client snapshot must not undo another device's save.
CREATE OR REPLACE FUNCTION public.submit_assessment(_pre_test_id uuid, _answers jsonb)
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
  IF _test.status = 'completed' THEN
    RETURN public.submit_assessment_scoring(_pre_test_id, _answers);
  END IF;
  SELECT draft INTO _saved FROM public.assessment_drafts WHERE pre_test_id = _pre_test_id;
  _effective := _answers;
  -- Preserve legacy pre-deadline submissions with no server draft. Expired
  -- assessments still cannot introduce client-only answers.
  IF _saved IS NOT NULL OR public.assessment_deadline_passed(_test.deadline_at, clock_timestamp()) THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'question_id', q.value->>'id',
      'selected_answer', COALESCE((_saved->'answers'->>(q.value->>'id'))::integer, -1)
    ) ORDER BY q.position), '[]'::jsonb) INTO _effective
    FROM jsonb_array_elements(COALESCE(_saved->'questions', '[]'::jsonb))
      WITH ORDINALITY AS q(value, position);
  END IF;
  RETURN public.submit_assessment_scoring(_pre_test_id, _effective);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_assessment(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_assessment(uuid, jsonb) TO authenticated;
