-- Run as database owner against a development database. Every write rolls back.
BEGIN;
DO $$
DECLARE
  owner_id uuid;
  other_id uuid;
  test_id uuid;
  payload jsonb;
BEGIN
  SELECT id INTO owner_id FROM auth.users ORDER BY id LIMIT 1;
  SELECT id INTO other_id FROM auth.users WHERE id <> owner_id LIMIT 1;
  IF owner_id IS NULL OR other_id IS NULL THEN
    RAISE EXCEPTION 'Two test accounts are required';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', owner_id::text, true);
  test_id := (public.start_assessment_draft(
    '{"version":1,"preTestId":"pending","questions":[{"id":"q1","options":["A","B"],"question_text":"Test","difficulty":"Pemula"}],"answers":{},"answerResults":{},"phase":"test","currentQ":0,"timeLeft":90,"timedOut":false}'::jsonb
  )->>'preTestId')::uuid;
  IF (public.get_active_assessment_draft()->>'preTestId')::uuid IS DISTINCT FROM test_id THEN
    RAISE EXCEPTION 'Owner cannot restore draft';
  END IF;
  payload := public.get_active_assessment_draft()->'draft' || '{"answers":{"q1":1}}'::jsonb;
  PERFORM public.save_assessment_draft(test_id, payload);
  IF public.get_active_assessment_draft()->'draft'->'answers'->>'q1' <> '1' THEN
    RAISE EXCEPTION 'Saved answer was not restored';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', other_id::text, true);
  BEGIN
    PERFORM public.save_assessment_draft(test_id, payload);
    RAISE EXCEPTION 'Another member saved the draft';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Another member saved the draft' THEN RAISE; END IF;
  END;
  IF public.get_active_assessment_draft() IS NOT NULL THEN
    RAISE EXCEPTION 'Another member restored the draft';
  END IF;

  PERFORM set_config('request.jwt.claim.sub', owner_id::text, true);
  UPDATE public.pre_tests SET status = 'completed' WHERE id = test_id;
  BEGIN
    PERFORM public.save_assessment_draft(test_id, payload);
    RAISE EXCEPTION 'Completed draft was saved';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Completed draft was saved' THEN RAISE; END IF;
  END;
  IF public.get_active_assessment_draft() IS NOT NULL THEN
    RAISE EXCEPTION 'Completed draft was restored';
  END IF;
END $$;
ROLLBACK;