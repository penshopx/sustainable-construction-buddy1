-- Run after all migrations. Every write is rolled back.
BEGIN;

DO $$
DECLARE
  test_user_id constant uuid := '00000000-0000-4000-8000-000000000151';
  test_domain_id constant uuid := '00000000-0000-4000-8000-000000000152';
  test_question_id constant uuid := '00000000-0000-4000-8000-000000000153';
  test_pre_test_id constant uuid := '00000000-0000-4000-8000-000000000154';
  first_result jsonb;
  second_result jsonb;
  first_completed_at timestamptz;
  answer_count integer;
BEGIN
  INSERT INTO auth.users (
    id,
    instance_id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at
  )
  VALUES (
    test_user_id,
    '00000000-0000-0000-0000-000000000000',
    'authenticated',
    'authenticated',
    'assessment-idempotency@example.invalid',
    '',
    now(),
    '{}'::jsonb,
    '{"full_name":"Assessment Idempotency Test"}'::jsonb,
    now(),
    now()
  );

  INSERT INTO public.competency_domains (id, name)
  VALUES (test_domain_id, 'Assessment idempotency test');

  INSERT INTO public.questions (
    id,
    domain_id,
    question_text,
    options,
    correct_answer
  )
  VALUES (
    test_question_id,
    test_domain_id,
    'Idempotency test question',
    '["A", "B"]'::jsonb,
    1
  );

  INSERT INTO public.pre_tests (id, user_id, total_questions)
  VALUES (test_pre_test_id, test_user_id, 1);

  PERFORM set_config('request.jwt.claim.sub', test_user_id::text, true);
  PERFORM set_config('request.jwt.claim.role', 'authenticated', true);

  first_result := public.submit_assessment(
    test_pre_test_id,
    jsonb_build_array(jsonb_build_object(
      'question_id', test_question_id,
      'selected_answer', 1
    ))
  );

  SELECT completed_at
  INTO first_completed_at
  FROM public.pre_tests
  WHERE id = test_pre_test_id;

  second_result := public.submit_assessment(
    test_pre_test_id,
    jsonb_build_array(jsonb_build_object(
      'question_id', test_question_id,
      'selected_answer', 0
    ))
  );

  IF second_result IS DISTINCT FROM first_result THEN
    RAISE EXCEPTION 'Repeated submission must return the original result: first %, second %',
      first_result, second_result;
  END IF;

  SELECT count(*)::integer
  INTO answer_count
  FROM public.pre_test_answers
  WHERE pre_test_id = test_pre_test_id;

  IF answer_count <> 1 THEN
    RAISE EXCEPTION 'Repeated submission created % answer rows instead of 1', answer_count;
  END IF;

  IF (SELECT selected_answer FROM public.pre_test_answers
      WHERE pre_test_id = test_pre_test_id) <> 1 THEN
    RAISE EXCEPTION 'Repeated submission changed the original answer';
  END IF;

  IF (SELECT completed_at FROM public.pre_tests
      WHERE id = test_pre_test_id) IS DISTINCT FROM first_completed_at THEN
    RAISE EXCEPTION 'Repeated submission changed the completion timestamp';
  END IF;

  IF (SELECT current_level FROM public.profiles
      WHERE user_id = test_user_id) <> (first_result->>'level')
     OR
     (SELECT total_score FROM public.profiles
      WHERE user_id = test_user_id) <> (first_result->>'score')::integer THEN
    RAISE EXCEPTION 'Repeated submission changed the profile result';
  END IF;
END;
$$;

INSERT INTO public.pre_tests (id, user_id, total_questions)
VALUES (
  '00000000-0000-4000-8000-000000000155',
  '00000000-0000-4000-8000-000000000151',
  1
);

SELECT set_config('request.jwt.claim.sub', '', true);
SELECT set_config('request.jwt.claim.role', 'anon', true);

SET LOCAL ROLE anon;
DO $$
BEGIN
  BEGIN
    PERFORM public.submit_assessment(
      '00000000-0000-4000-8000-000000000155',
      jsonb_build_array(jsonb_build_object(
        'question_id', '00000000-0000-4000-8000-000000000153',
        'selected_answer', 1
      ))
    );
    RAISE EXCEPTION 'Anonymous submission unexpectedly executed';
  EXCEPTION
    WHEN insufficient_privilege THEN
      NULL;
  END;
END;
$$;
RESET ROLE;

DO $$
BEGIN
  IF (SELECT status FROM public.pre_tests
      WHERE id = '00000000-0000-4000-8000-000000000155') <> 'in_progress' THEN
    RAISE EXCEPTION 'Anonymous submission changed the pre-test status';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.pre_test_answers
    WHERE pre_test_id = '00000000-0000-4000-8000-000000000155'
  ) THEN
    RAISE EXCEPTION 'Anonymous submission created answer rows';
  END IF;

  IF (SELECT current_level FROM public.profiles
      WHERE user_id = '00000000-0000-4000-8000-000000000151') <> 'Utama'
     OR
     (SELECT total_score FROM public.profiles
      WHERE user_id = '00000000-0000-4000-8000-000000000151') <> 100 THEN
    RAISE EXCEPTION 'Anonymous submission changed the profile result';
  END IF;
END;
$$;

ROLLBACK;