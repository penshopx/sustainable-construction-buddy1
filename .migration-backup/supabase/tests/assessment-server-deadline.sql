-- Run after migrations as database owner; no fixture survives rollback.
BEGIN;
DO $$
DECLARE
  test_user constant uuid := '00000000-0000-4000-8000-000000000168';
  test_domain constant uuid := '00000000-0000-4000-8000-000000000169';
  test_question constant uuid := '00000000-0000-4000-8000-000000000170';
  test_id uuid;
  started jsonb;
  result jsonb;
  retry jsonb;
  saved jsonb;
BEGIN
  IF NOT public.assessment_deadline_passed('2026-09-28T10:00:00Z', '2026-09-28T10:00:00Z')
     OR public.assessment_deadline_passed('2026-09-28T10:00:00Z', '2026-09-28T09:59:59.999999Z') THEN
    RAISE EXCEPTION 'Exact deadline must count as expired, earlier arrival must not';
  END IF;

  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  VALUES (test_user, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    'assessment-deadline@example.invalid', '', now(), '{}'::jsonb, '{}'::jsonb, now(), now());
  INSERT INTO public.competency_domains (id, name) VALUES (test_domain, 'Deadline fixture');
  INSERT INTO public.questions (id, domain_id, question_text, options, correct_answer)
  VALUES (test_question, test_domain, 'Deadline question', '["A","B"]'::jsonb, 1);
  PERFORM set_config('request.jwt.claim.sub', test_user::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  started := public.start_assessment_draft(jsonb_build_object(
    'version', 1, 'preTestId', 'pending',
    'questions', jsonb_build_array(jsonb_build_object('id', test_question::text, 'options', jsonb_build_array('A','B'))),
    'answers', '{}'::jsonb, 'answerResults', '{}'::jsonb, 'phase', 'test',
    'currentQ', 0, 'timeLeft', 90, 'timedOut', false, 'deadlineAt', '9999-01-01'));
  test_id := (started->>'preTestId')::uuid;
  IF (started->>'deadlineAt')::timestamptz IS DISTINCT FROM
       (SELECT deadline_at FROM public.pre_tests WHERE id = test_id)
     OR (started->>'deadlineAt')::timestamptz <= (started->>'serverNow')::timestamptz
     OR (started->>'deadlineAt')::timestamptz >
       (started->>'serverNow')::timestamptz + interval '90 seconds' THEN
    RAISE EXCEPTION 'Start did not establish the deadline on the server';
  END IF;

  saved := (public.get_active_assessment_draft()->'draft') ||
    jsonb_build_object('answers', jsonb_build_object(test_question::text, 1),
      'deadlineAt', 9999999999999::bigint, 'timeLeft', 999999);
  PERFORM public.save_assessment_draft(test_id, saved);
  UPDATE public.pre_tests SET deadline_at = clock_timestamp() - interval '1 second' WHERE id = test_id;

  BEGIN
    PERFORM public.save_assessment_draft(test_id, saved ||
      jsonb_build_object('answers', jsonb_build_object(test_question::text, 0)));
    RAISE EXCEPTION 'Late draft write succeeded';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM = 'Late draft write succeeded' THEN RAISE; END IF;
  END;
  result := public.submit_assessment(test_id,
    jsonb_build_array(jsonb_build_object('question_id', test_question, 'selected_answer', 0)));
  IF result->>'score' <> '100'
     OR (SELECT selected_answer FROM public.pre_test_answers WHERE pre_test_id = test_id) <> 1 THEN
    RAISE EXCEPTION 'Late client answer overrode the saved server snapshot: %', result;
  END IF;
  retry := public.submit_assessment(test_id,
    jsonb_build_array(jsonb_build_object('question_id', test_question, 'selected_answer', 0)));
  IF retry IS DISTINCT FROM result THEN RAISE EXCEPTION 'Late retry changed result'; END IF;
END;
$$;
ROLLBACK;