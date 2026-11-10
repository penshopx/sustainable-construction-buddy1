CREATE OR REPLACE FUNCTION public.submit_assessment(
  _pre_test_id uuid,
  _answers jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _correct integer := 0;
  _total integer := 0;
  _score integer;
  _level text;
  _entry jsonb;
  _q_id uuid;
  _sel integer;
  _is_correct boolean;
  _user_id uuid;
  _status text;
BEGIN
  SELECT pt.user_id, pt.status, pt.correct_answers, pt.score, pt.determined_level
  INTO _user_id, _status, _correct, _score, _level
  FROM public.pre_tests pt
  WHERE pt.id = _pre_test_id
  FOR UPDATE;

  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Pre-test not found');
  END IF;

  IF auth.uid() IS NULL OR _user_id IS DISTINCT FROM auth.uid() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  IF _status = 'completed' THEN
    SELECT count(*)::integer
    INTO _total
    FROM public.pre_test_answers pta
    WHERE pta.pre_test_id = _pre_test_id;

    RETURN jsonb_build_object(
      'score', _score,
      'level', _level,
      'correct', _correct,
      'total', _total
    );
  END IF;

  FOR _entry IN SELECT * FROM jsonb_array_elements(_answers)
  LOOP
    _q_id := (_entry->>'question_id')::uuid;
    _sel := (_entry->>'selected_answer')::integer;

    SELECT (_sel = q.correct_answer)
    INTO _is_correct
    FROM public.questions q
    WHERE q.id = _q_id;

    IF _is_correct THEN
      _correct := _correct + 1;
    END IF;
    _total := _total + 1;

    INSERT INTO public.pre_test_answers (
      pre_test_id,
      question_id,
      selected_answer,
      is_correct
    )
    VALUES (
      _pre_test_id,
      _q_id,
      _sel,
      COALESCE(_is_correct, false)
    );
  END LOOP;

  _score := CASE
    WHEN _total > 0 THEN round((_correct::numeric / _total) * 100)
    ELSE 0
  END;
  _level := CASE
    WHEN _score >= 85 THEN 'Utama'
    WHEN _score >= 75 THEN 'Madya'
    WHEN _score >= 60 THEN 'Muda'
    ELSE 'Pemula'
  END;

  UPDATE public.pre_tests
  SET
    correct_answers = _correct,
    score = _score,
    determined_level = _level,
    status = 'completed',
    completed_at = now()
  WHERE id = _pre_test_id;

  UPDATE public.profiles
  SET
    current_level = _level,
    total_score = _score
  WHERE user_id = _user_id;

  RETURN jsonb_build_object(
    'score', _score,
    'level', _level,
    'correct', _correct,
    'total', _total
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_assessment(uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.submit_assessment(uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.submit_assessment(uuid, jsonb) TO authenticated;