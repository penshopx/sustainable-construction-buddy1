
-- 1. Create a safe view for questions (no correct_answer, no explanation)
CREATE OR REPLACE VIEW public.questions_safe
WITH (security_invoker = on) AS
SELECT id, question_text, options, difficulty, domain_id, created_at
FROM public.questions;

-- 2. Create function to check answer and return result + explanation
CREATE OR REPLACE FUNCTION public.check_question_answer(
  _question_id uuid,
  _selected_answer integer
)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'is_correct', (_selected_answer = q.correct_answer),
    'correct_answer', q.correct_answer,
    'explanation', q.explanation
  )
  FROM public.questions q
  WHERE q.id = _question_id
$$;

-- 3. Create function to submit full assessment server-side
CREATE OR REPLACE FUNCTION public.submit_assessment(
  _pre_test_id uuid,
  _answers jsonb -- array of {question_id, selected_answer}
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
BEGIN
  -- Get user_id from pre_test
  SELECT pt.user_id INTO _user_id FROM pre_tests pt WHERE pt.id = _pre_test_id;
  IF _user_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Pre-test not found');
  END IF;
  
  -- Verify caller owns this pre_test
  IF _user_id != auth.uid() THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  FOR _entry IN SELECT * FROM jsonb_array_elements(_answers)
  LOOP
    _q_id := (_entry->>'question_id')::uuid;
    _sel := (_entry->>'selected_answer')::integer;
    
    SELECT (_sel = q.correct_answer) INTO _is_correct
    FROM questions q WHERE q.id = _q_id;
    
    IF _is_correct THEN _correct := _correct + 1; END IF;
    _total := _total + 1;
    
    INSERT INTO pre_test_answers (pre_test_id, question_id, selected_answer, is_correct)
    VALUES (_pre_test_id, _q_id, _sel, COALESCE(_is_correct, false));
  END LOOP;

  _score := CASE WHEN _total > 0 THEN round((_correct::numeric / _total) * 100) ELSE 0 END;
  _level := CASE 
    WHEN _score >= 85 THEN 'Utama'
    WHEN _score >= 75 THEN 'Madya'
    WHEN _score >= 60 THEN 'Muda'
    ELSE 'Pemula'
  END;

  UPDATE pre_tests SET
    correct_answers = _correct,
    score = _score,
    determined_level = _level,
    status = 'completed',
    completed_at = now()
  WHERE id = _pre_test_id;

  UPDATE profiles SET
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

-- 4. Restrict base questions table: only admins can SELECT directly
DROP POLICY IF EXISTS "Questions readable by authenticated" ON public.questions;
CREATE POLICY "Questions readable by admins only"
  ON public.questions FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Fix e_course_modules: require authentication
DROP POLICY IF EXISTS "Modules readable by authenticated" ON public.e_course_modules;
CREATE POLICY "Modules readable by authenticated"
  ON public.e_course_modules FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 6. Revoke anon from questions and e_course_modules
REVOKE SELECT ON public.questions FROM anon;
REVOKE SELECT ON public.e_course_modules FROM anon;

-- 7. Grant authenticated access to the safe view
GRANT SELECT ON public.questions_safe TO authenticated;
