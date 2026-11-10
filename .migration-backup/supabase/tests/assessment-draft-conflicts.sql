SET request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';
DO $$
DECLARE
  _id uuid;
  _base jsonb;
  _response jsonb;
  _result jsonb;
BEGIN
  _id := (public.start_assessment_draft(
    '{"version":1,"preTestId":"pending","questions":[{"id":"q1","options":["A","B"],"question_text":"Test","difficulty":"Pemula"}],"answers":{},"answerResults":{},"phase":"test","currentQ":0,"timeLeft":90,"timedOut":false}'::jsonb
  )->>'preTestId')::uuid;
  _base := public.get_active_assessment_draft()->'draft';
  IF _base->>'revision' <> '0' THEN RAISE EXCEPTION 'Missing initial revision'; END IF;
  _response := public.save_assessment_draft(_id, _base || '{"answers":{"q1":0}}'::jsonb);
  IF _response->>'saved' <> 'true' OR _response->'draft'->>'revision' <> '1' THEN
    RAISE EXCEPTION 'First save failed';
  END IF;
  _response := public.save_assessment_draft(_id, _base || '{"answers":{"q1":1}}'::jsonb);
  IF _response->>'saved' <> 'false' OR _response->'draft'->'answers'->>'q1' <> '0' THEN
    RAISE EXCEPTION 'Stale save overwrote first answer';
  END IF;
  BEGIN
    PERFORM public.save_assessment_draft(_id, _base - 'revision');
    RAISE EXCEPTION 'Old client bypassed version check';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Assessment version is required; reload the application' THEN RAISE; END IF;
  END;
  _base := _response->'draft';
  _response := public.save_assessment_draft(_id, _base || '{"answers":{"q1":1}}'::jsonb);
  IF _response->>'saved' <> 'true' OR _response->'draft'->>'revision' <> '2' THEN
    RAISE EXCEPTION 'Explicit resolution failed';
  END IF;
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
  BEGIN
    PERFORM public.save_assessment_draft(_id, _base);
    RAISE EXCEPTION 'Other owner accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Assessment unavailable' THEN RAISE; END IF;
  END;
  PERFORM set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
  UPDATE public.pre_tests SET deadline_at = clock_timestamp() - interval '1 second' WHERE id = _id;
  BEGIN
    PERFORM public.save_assessment_draft(_id, _base);
    RAISE EXCEPTION 'Expired save accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Assessment deadline has passed' THEN RAISE; END IF;
  END;
  UPDATE public.pre_tests SET status = 'completed' WHERE id = _id;
  BEGIN
    PERFORM public.save_assessment_draft(_id, _base);
    RAISE EXCEPTION 'Completed save accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Assessment unavailable' THEN RAISE; END IF;
  END;

  -- A syncs q1, B adds q2, then A sends its older answer array. The actual
  -- submission wrapper must pass both committed answers to the scorer.
  _id := (public.start_assessment_draft(
    '{"version":1,"preTestId":"pending","questions":[{"id":"q1","options":["A","B"]},{"id":"q2","options":["A","B"]}],"answers":{},"answerResults":{},"phase":"test"}'::jsonb
  )->>'preTestId')::uuid;
  _base := public.get_active_assessment_draft()->'draft';
  _response := public.save_assessment_draft(_id, _base || '{"answers":{"q1":0}}'::jsonb);
  _response := public.save_assessment_draft(_id, _response->'draft' || '{"answers":{"q1":0,"q2":1}}'::jsonb);
  _result := public.submit_assessment(_id, '[{"question_id":"q1","selected_answer":0},{"question_id":"q2","selected_answer":-1}]'::jsonb);
  IF _result->'answers' IS DISTINCT FROM '[{"question_id":"q1","selected_answer":0},{"question_id":"q2","selected_answer":1}]'::jsonb THEN
    RAISE EXCEPTION 'Stale submission discarded a committed answer: %', _result;
  END IF;
  IF public.submit_assessment(_id, '[]'::jsonb) IS DISTINCT FROM _result THEN
    RAISE EXCEPTION 'Retry changed recorded answers';
  END IF;
  -- The same authoritative snapshot rule applies after expiry.
  _id := (public.start_assessment_draft(
    '{"version":1,"preTestId":"pending","questions":[{"id":"q1","options":["A","B"]}],"answers":{"q1":1},"answerResults":{},"phase":"test"}'::jsonb
  )->>'preTestId')::uuid;
  UPDATE public.pre_tests SET deadline_at = clock_timestamp() - interval '1 second' WHERE id = _id;
  _result := public.submit_assessment(_id, '[{"question_id":"q1","selected_answer":0}]'::jsonb);
  IF _result->'answers'->0->>'selected_answer' <> '1' THEN
    RAISE EXCEPTION 'Expiry allowed client payload to override saved answer';
  END IF;
END $$;
-- Seed a separate row for the shell's two concurrent sessions.
INSERT INTO public.pre_tests(id, user_id, total_questions, status)
VALUES ('00000000-0000-4000-8000-000000000010', auth.uid(), 1, 'in_progress');
INSERT INTO public.assessment_drafts(pre_test_id, draft)
VALUES ('00000000-0000-4000-8000-000000000010',
  '{"version":1,"revision":0,"preTestId":"00000000-0000-4000-8000-000000000010","questions":[{"id":"q1","options":["A","B"],"question_text":"Test","difficulty":"Pemula"}],"answers":{},"answerResults":{},"phase":"test","currentQ":0,"timeLeft":90,"timedOut":false}');
INSERT INTO public.pre_tests(id, user_id, total_questions, status)
VALUES ('00000000-0000-4000-8000-000000000011', auth.uid(), 2, 'in_progress');
INSERT INTO public.assessment_drafts(pre_test_id, draft)
VALUES ('00000000-0000-4000-8000-000000000011',
  '{"version":1,"revision":0,"preTestId":"00000000-0000-4000-8000-000000000011","questions":[{"id":"q1","options":["A","B"]},{"id":"q2","options":["A","B"]}],"answers":{"q1":0},"answerResults":{},"phase":"test"}');
