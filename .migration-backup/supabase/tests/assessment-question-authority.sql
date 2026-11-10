BEGIN;
DO $$
DECLARE
  owner_id constant uuid := '00000000-0000-4000-8000-000000000001';
  other_id constant uuid := '00000000-0000-4000-8000-000000000002';
  q1 constant uuid := '00000000-0000-4000-8000-000000000101';
  q2 constant uuid := '00000000-0000-4000-8000-000000000102';
  q3 constant uuid := '00000000-0000-4000-8000-000000000103';
  q4 constant uuid := '00000000-0000-4000-8000-000000000104';
  q5 constant uuid := '00000000-0000-4000-8000-000000000105';
  test_id uuid;
  foreign_test_id uuid;
  legacy_id uuid;
  base jsonb;
  draft jsonb;
  payload jsonb;
  valid jsonb;
  result jsonb;
  before_test jsonb;
  before_draft jsonb;
  before_profile jsonb;
  before_count integer;
BEGIN
  IF (SELECT authorized_question_ids FROM public.pre_tests
      WHERE id = '00000000-0000-4000-8000-000000000301')
        IS DISTINCT FROM ARRAY['00000000-0000-4000-8000-000000000201'::uuid]
     OR EXISTS (SELECT 1 FROM public.pre_tests
       WHERE id IN ('00000000-0000-4000-8000-000000000302', '00000000-0000-4000-8000-000000000303')
         AND authorized_question_ids IS NOT NULL) THEN
    RAISE EXCEPTION 'Legacy backfill trusted a duplicate/missing draft or lost a valid draft';
  END IF;
  DELETE FROM public.assessment_drafts WHERE pre_test_id IN
    ('00000000-0000-4000-8000-000000000301', '00000000-0000-4000-8000-000000000302');
  DELETE FROM public.pre_tests WHERE user_id = '00000000-0000-4000-8000-000000000003';
  DELETE FROM public.questions WHERE id = '00000000-0000-4000-8000-000000000201';
  INSERT INTO public.questions(id, correct_answer) VALUES (q1, 1), (q2, 0), (q3, 1), (q4, 0), (q5, 0);
  INSERT INTO public.profiles(user_id) VALUES (owner_id), (other_id);
  base := jsonb_build_object('version', 1, 'preTestId', 'pending',
    'questions', jsonb_build_array(jsonb_build_object('id', q1), jsonb_build_object('id', q2),
      jsonb_build_object('id', q4), jsonb_build_object('id', q5)),
    'answers', '{}'::jsonb, 'answerResults', '{}'::jsonb, 'phase', 'test');

  PERFORM set_config('request.jwt.claim.sub', other_id::text, true);
  foreign_test_id := (public.start_assessment_draft(base ||
    jsonb_build_object('questions', jsonb_build_array(jsonb_build_object('id', q1), jsonb_build_object('id', q2),
      jsonb_build_object('id', q4), jsonb_build_object('id', q3))))->>'preTestId')::uuid;
  PERFORM set_config('request.jwt.claim.sub', owner_id::text, true);
  SELECT count(*) INTO before_count FROM public.pre_tests;
  -- Starts cannot authorize duplicates, invented IDs, null IDs, or an empty list.
  FOR payload IN SELECT value FROM jsonb_array_elements(jsonb_build_array(
    jsonb_build_array(jsonb_build_object('id', q1)), -- known correct, valid ID; not a complete assessment
    base->'questions' || jsonb_build_array(jsonb_build_object('id', q3)), -- over quota
    jsonb_build_array(jsonb_build_object('id', q1), jsonb_build_object('id', q1)),
    jsonb_build_array(jsonb_build_object('id', '00000000-0000-4000-8000-000000000999')),
    '[{"id":null}]'::jsonb, '[]'::jsonb, '[{}]'::jsonb
  )) LOOP
    BEGIN
      PERFORM public.start_assessment_draft(base || jsonb_build_object('questions', payload));
      RAISE EXCEPTION 'Invalid start accepted';
    EXCEPTION WHEN raise_exception THEN
      IF SQLERRM NOT IN ('Invalid assessment questions', 'Invalid assessment draft') THEN RAISE; END IF;
    END;
  END LOOP;
  -- Omitting a whole eligible domain is invalid even if the other domain has
  -- its full quota. Domains with fewer than four questions require all of them.
  INSERT INTO public.questions(id, correct_answer, domain_id)
    VALUES ('00000000-0000-4000-8000-000000000106', 0, '00000000-0000-4000-8000-000000000402');
  BEGIN
    PERFORM public.start_assessment_draft(base);
    RAISE EXCEPTION 'Missing domain accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Invalid assessment questions' THEN RAISE; END IF;
  END;
  -- Including the small domain's only question is a complete roster.
  IF NOT public.assessment_roster_is_complete(ARRAY[q1, q2, q4, q5,
      '00000000-0000-4000-8000-000000000106'::uuid]) THEN
    RAISE EXCEPTION 'Small domain quota rejected';
  END IF;
  DELETE FROM public.questions WHERE id = '00000000-0000-4000-8000-000000000106';
  IF (SELECT count(*) FROM public.pre_tests) <> before_count THEN
    RAISE EXCEPTION 'Rejected start created a result row';
  END IF;
  test_id := (public.start_assessment_draft(base)->>'preTestId')::uuid;
  IF (SELECT authorized_question_ids FROM public.pre_tests WHERE id = test_id)
     IS DISTINCT FROM ARRAY[q1, q2, q4, q5] THEN RAISE EXCEPTION 'Start did not freeze roster'; END IF;
  draft := public.get_active_assessment_draft()->'draft';
  -- Only one of four questions answered correctly: the denominator must stay 4.
  PERFORM public.save_assessment_draft(test_id, draft ||
    jsonb_build_object('answers', jsonb_build_object(q1::text, 1)));
  valid := jsonb_build_array(
    jsonb_build_object('question_id', q1, 'selected_answer', 1),
    jsonb_build_object('question_id', q2, 'selected_answer', -1),
    jsonb_build_object('question_id', q4, 'selected_answer', -1),
    jsonb_build_object('question_id', q5, 'selected_answer', -1));
  SELECT to_jsonb(pt) INTO before_test FROM public.pre_tests pt WHERE id = test_id;
  SELECT to_jsonb(ad) INTO before_draft FROM public.assessment_drafts ad WHERE pre_test_id = test_id;
  SELECT to_jsonb(p) INTO before_profile FROM public.profiles p WHERE user_id = owner_id;
  FOR payload IN SELECT value FROM jsonb_array_elements(jsonb_build_array(
    valid || jsonb_build_array(jsonb_build_object('question_id', q3, 'selected_answer', 1)),
    jsonb_build_array(valid->0, valid->0),
    jsonb_build_array(valid->0, valid->1, valid->2, valid->0),
    jsonb_build_array(valid->0),
    jsonb_build_array(valid->0, jsonb_build_object('question_id', q3, 'selected_answer', 1)),
    jsonb_build_array(valid->0, valid->1, valid->2, jsonb_build_object('question_id', q3, 'selected_answer', 1)),
    jsonb_build_array(valid->0, '{"question_id":null}'::jsonb),
    jsonb_build_array(valid->0, '{"question_id":"not-a-uuid"}'::jsonb),
    '[]'::jsonb, '{}'::jsonb, 'null'::jsonb
  )) LOOP
    result := public.submit_assessment(test_id, payload);
    IF result->>'error' IS DISTINCT FROM 'Invalid assessment questions' THEN
      RAISE EXCEPTION 'Forged submission accepted: %, result %', payload, result;
    END IF;
    result := public.submit_assessment_scoring(test_id, payload);
    IF result->>'error' IS DISTINCT FROM 'Invalid assessment questions' THEN
      RAISE EXCEPTION 'Private scorer accepted forged list: %', payload;
    END IF;
    IF (SELECT to_jsonb(pt) FROM public.pre_tests pt WHERE id = test_id) IS DISTINCT FROM before_test
       OR (SELECT to_jsonb(ad) FROM public.assessment_drafts ad WHERE pre_test_id = test_id) IS DISTINCT FROM before_draft
       OR (SELECT to_jsonb(p) FROM public.profiles p WHERE user_id = owner_id) IS DISTINCT FROM before_profile
       OR EXISTS (SELECT 1 FROM public.pre_test_answers WHERE pre_test_id = test_id) THEN
      RAISE EXCEPTION 'Rejected submission mutated assessment state';
    END IF;
  END LOOP;
  result := public.submit_assessment(foreign_test_id,
    jsonb_build_array(jsonb_build_object('question_id', q3, 'selected_answer', 1)));
  IF result->>'error' IS DISTINCT FROM 'Unauthorized' THEN RAISE EXCEPTION 'Foreign test accepted'; END IF;
  -- Existing save RPC cannot replace the fixed questions, even with a current revision.
  draft := public.get_active_assessment_draft()->'draft';
  BEGIN
    PERFORM public.save_assessment_draft(test_id, draft ||
      jsonb_build_object('questions', jsonb_build_array(jsonb_build_object('id', q1),
        jsonb_build_object('id', q2), jsonb_build_object('id', q4), jsonb_build_object('id', q3))));
    RAISE EXCEPTION 'Roster replacement accepted';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM <> 'Assessment questions changed' THEN RAISE; END IF;
  END;
  UPDATE public.pre_tests SET deadline_at = clock_timestamp() - interval '1 second' WHERE id = test_id;
  result := public.submit_assessment(test_id, jsonb_build_array(valid->0, valid->0));
  IF result->>'error' IS DISTINCT FROM 'Invalid assessment questions' THEN
    RAISE EXCEPTION 'Expiry bypassed roster validation';
  END IF;
  -- Deliberately corrupt the mutable snapshot as database owner. Even this
  -- cannot replace the fixed IDs or denominator passed to the real scorer.
  UPDATE public.assessment_drafts ad SET draft = ad.draft ||
    jsonb_build_object('questions', jsonb_build_array(jsonb_build_object('id', q3)))
  WHERE pre_test_id = test_id;
  result := public.submit_assessment(test_id,
    jsonb_build_array(valid->3, valid->2, valid->1, valid->0)); -- order need not match
  IF result IS DISTINCT FROM '{"score":25,"level":"Pemula","correct":1,"total":4}'::jsonb
     OR (SELECT count(*) FROM public.pre_test_answers WHERE pre_test_id = test_id) <> 4
     OR EXISTS (SELECT 1 FROM public.pre_test_answers WHERE pre_test_id = test_id AND question_id = q3) THEN
    RAISE EXCEPTION 'Score did not use authorized roster: %', result;
  END IF;
  IF public.submit_assessment(test_id, '[]'::jsonb) IS DISTINCT FROM result THEN
    RAISE EXCEPTION 'Completed retry changed original result';
  END IF;
  -- On-time finalization also uses all roster entries, not just answered ones
  -- or the choices in the request. Initial answer snapshots remain supported.
  test_id := (public.start_assessment_draft(base ||
    jsonb_build_object('answers', jsonb_build_object(q1::text, 1, q2::text, 0, q4::text, 0, q5::text, 0)))->>'preTestId')::uuid;
  result := public.submit_assessment(test_id, valid);
  IF result IS DISTINCT FROM '{"score":100,"level":"Utama","correct":4,"total":4}'::jsonb THEN
    RAISE EXCEPTION 'On-time submit lost saved choices: %', result;
  END IF;
  -- A missing mutable draft must never enable a client-answer fallback.
  test_id := (public.start_assessment_draft(base)->>'preTestId')::uuid;
  DELETE FROM public.assessment_drafts WHERE pre_test_id = test_id;
  result := public.submit_assessment(test_id, valid);
  IF result->>'error' IS DISTINCT FROM 'Assessment draft unavailable; restart assessment'
     OR EXISTS (SELECT 1 FROM public.pre_test_answers WHERE pre_test_id = test_id) THEN
    RAISE EXCEPTION 'Missing draft enabled client-answer fallback';
  END IF;
  INSERT INTO public.pre_tests(user_id, total_questions, status)
    VALUES(owner_id, 1, 'in_progress') RETURNING id INTO legacy_id;
  result := public.submit_assessment(legacy_id, jsonb_build_array(valid->0));
  IF result->>'error' IS DISTINCT FROM 'Invalid assessment questions'
     OR (SELECT status FROM public.pre_tests WHERE id = legacy_id) <> 'in_progress' THEN
    RAISE EXCEPTION 'Browser-only legacy test invented roster';
  END IF;
  IF has_function_privilege('authenticated', 'public.submit_assessment_scoring(uuid,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.submit_assessment_scoring_unchecked(uuid,jsonb)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.start_assessment_draft_unversioned(jsonb)', 'EXECUTE')
     OR has_table_privilege('authenticated', 'public.pre_tests', 'UPDATE') THEN
    RAISE EXCEPTION 'Authenticated role can bypass authority boundary';
  END IF;
END;
$$;
ROLLBACK;
