-- A result's roster is fixed when the server accepts the start request.
-- Never recover a missing roster from a submit payload.
ALTER TABLE public.pre_tests ADD COLUMN authorized_question_ids uuid[];

CREATE FUNCTION public.assessment_question_ids(_questions jsonb)
RETURNS uuid[] LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE
  _ids uuid[];
  _count integer;
BEGIN
  IF jsonb_typeof(_questions) IS DISTINCT FROM 'array' THEN RETURN NULL; END IF;
  _count := jsonb_array_length(_questions);
  IF _count NOT BETWEEN 1 AND 100 THEN RETURN NULL; END IF;
  SELECT array_agg(q.id ORDER BY entry.position) INTO _ids
  FROM jsonb_array_elements(_questions) WITH ORDINALITY AS entry(value, position)
  JOIN public.questions q ON q.id::text = entry.value->>'id';
  IF cardinality(_ids) IS DISTINCT FROM _count
     OR (SELECT count(DISTINCT id) FROM unnest(_ids) id) <> _count THEN
    RETURN NULL;
  END IF;
  RETURN _ids;
END;
$$;
REVOKE ALL ON FUNCTION public.assessment_question_ids(jsonb) FROM PUBLIC, anon, authenticated;

-- Match the product's four-per-domain rule independently of the browser.
-- Valid IDs alone are not authority: a one-question favorable subset must
-- not become a full assessment just because it was sent at start.
CREATE FUNCTION public.assessment_roster_is_complete(_ids uuid[])
RETURNS boolean LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT _ids IS NOT NULL AND cardinality(_ids) BETWEEN 1 AND 100
    AND NOT EXISTS (
      SELECT q.domain_id
      FROM public.questions q
      GROUP BY q.domain_id
      HAVING count(*) FILTER (WHERE q.id = ANY(_ids)) <> LEAST(4, count(*))
    );
$$;
REVOKE ALL ON FUNCTION public.assessment_roster_is_complete(uuid[]) FROM PUBLIC, anon, authenticated;

-- Only existing, unambiguous server drafts can establish a legacy roster.
-- Browser-only or corrupted drafts must restart instead of choosing a roster
-- during submission. Completed historical results remain readable/idempotent.
UPDATE public.pre_tests pt
SET authorized_question_ids = public.assessment_question_ids(ad.draft->'questions')
FROM public.assessment_drafts ad
WHERE ad.pre_test_id = pt.id
  AND cardinality(public.assessment_question_ids(ad.draft->'questions')) = pt.total_questions
  AND public.assessment_roster_is_complete(public.assessment_question_ids(ad.draft->'questions'));

CREATE OR REPLACE FUNCTION public.start_assessment_draft(_draft jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _ids uuid[];
  _result jsonb;
BEGIN
  IF auth.uid() IS NULL OR public.validate_assessment_draft(_draft) IS NOT TRUE THEN
    RAISE EXCEPTION 'Invalid assessment draft';
  END IF;
  _ids := public.assessment_question_ids(_draft->'questions');
  IF _ids IS NULL OR NOT public.assessment_roster_is_complete(_ids) THEN
    RAISE EXCEPTION 'Invalid assessment questions';
  END IF;
  _result := public.start_assessment_draft_unversioned(_draft || '{"revision":0}'::jsonb);
  UPDATE public.pre_tests SET authorized_question_ids = _ids,
    total_questions = cardinality(_ids)
  WHERE id = (_result->>'preTestId')::uuid;
  RETURN _result || '{"revision":0}'::jsonb;
END;
$$;

CREATE FUNCTION public.assessment_answers_match_roster(_answers jsonb, _ids uuid[])
RETURNS boolean LANGUAGE plpgsql IMMUTABLE SET search_path = public AS $$
BEGIN
  IF _ids IS NULL OR cardinality(_ids) = 0
     OR jsonb_typeof(_answers) IS DISTINCT FROM 'array' THEN RETURN false; END IF;
  RETURN jsonb_array_length(_answers) = cardinality(_ids)
    AND (SELECT count(DISTINCT entry->>'question_id')
         FROM jsonb_array_elements(_answers) entry) = cardinality(_ids)
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(_answers) entry
      WHERE jsonb_typeof(entry) IS DISTINCT FROM 'object'
         OR entry->>'question_id' IS NULL
         OR NOT (entry->>'question_id' = ANY(ARRAY(SELECT id::text FROM unnest(_ids) id)))
    );
END;
$$;
REVOKE ALL ON FUNCTION public.assessment_answers_match_roster(jsonb, uuid[]) FROM PUBLIC, anon, authenticated;

-- Defense in depth at the scoring boundary, not only the public wrapper.
ALTER FUNCTION public.submit_assessment_scoring(uuid, jsonb) RENAME TO submit_assessment_scoring_unchecked;
REVOKE ALL ON FUNCTION public.submit_assessment_scoring_unchecked(uuid, jsonb) FROM PUBLIC, anon, authenticated;
CREATE FUNCTION public.submit_assessment_scoring(_pre_test_id uuid, _answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _test public.pre_tests%ROWTYPE;
BEGIN
  SELECT * INTO _test FROM public.pre_tests WHERE id = _pre_test_id FOR UPDATE;
  IF NOT FOUND THEN RETURN jsonb_build_object('error', 'Pre-test not found'); END IF;
  IF auth.uid() IS NULL OR _test.user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;
  IF _test.status <> 'completed' AND (
    cardinality(_test.authorized_question_ids) IS DISTINCT FROM _test.total_questions
    OR NOT public.assessment_answers_match_roster(_answers, _test.authorized_question_ids)
  ) THEN
    RETURN jsonb_build_object('error', 'Invalid assessment questions');
  END IF;
  RETURN public.submit_assessment_scoring_unchecked(_pre_test_id, _answers);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_assessment_scoring(uuid, jsonb) FROM PUBLIC, anon, authenticated;

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
  IF cardinality(_test.authorized_question_ids) IS DISTINCT FROM _test.total_questions
     OR NOT public.assessment_answers_match_roster(_answers, _test.authorized_question_ids) THEN
    RETURN jsonb_build_object('error', 'Invalid assessment questions');
  END IF;
  SELECT draft INTO _saved FROM public.assessment_drafts WHERE pre_test_id = _pre_test_id;
  IF _saved IS NULL THEN
    RETURN jsonb_build_object('error', 'Assessment draft unavailable; restart assessment');
  END IF;
  -- The denominator and IDs come from the fixed roster. The choices come from
  -- the latest committed snapshot, never a stale submit array (even on expiry).
  SELECT jsonb_agg(jsonb_build_object(
    'question_id', q.id,
    'selected_answer', COALESCE((_saved->'answers'->>(q.id::text))::integer, -1)
  ) ORDER BY q.position) INTO _effective
  FROM unnest(_test.authorized_question_ids) WITH ORDINALITY AS q(id, position);
  RETURN public.submit_assessment_scoring(_pre_test_id, _effective);
END;
$$;
REVOKE ALL ON FUNCTION public.submit_assessment(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_assessment(uuid, jsonb) TO authenticated;
