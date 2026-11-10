\set ON_ERROR_STOP on
BEGIN;
SET LOCAL ROLE authenticated;

-- No existing fixtures required. These direct writes model PostgREST, not UI.
DO $$
DECLARE mutation text;
BEGIN
  FOREACH mutation IN ARRAY ARRAY[
    $sql$INSERT INTO public.aspekindo_lms_lessons(id, passing_score, is_published)
      VALUES ('00000000-0000-0000-0000-000000000101', 70, true)$sql$,
    $sql$INSERT INTO public.aspekindo_lms_lessons(id, passing_score, is_published)
      VALUES ('00000000-0000-0000-0000-000000000101', 70, false);
      UPDATE public.aspekindo_lms_lessons SET is_published = true
      WHERE id = '00000000-0000-0000-0000-000000000101'$sql$,
    $sql$INSERT INTO public.aspekindo_lms_lessons(id, passing_score, is_published)
      VALUES ('00000000-0000-0000-0000-000000000101', 0, true);
      UPDATE public.aspekindo_lms_lessons SET passing_score = 70
      WHERE id = '00000000-0000-0000-0000-000000000101'$sql$
  ] LOOP
    BEGIN
      EXECUTE mutation;
      SET CONSTRAINTS ALL IMMEDIATE;
      RAISE EXCEPTION 'Invalid publication accepted: %', mutation;
    EXCEPTION WHEN check_violation THEN
      IF SQLERRM NOT LIKE '%minimal satu soal valid%' THEN RAISE; END IF;
    END;
  END LOOP;
END;
$$;

-- Both exemption paths persist without questions across a constraint check.
INSERT INTO public.aspekindo_lms_lessons(id, passing_score, is_published)
VALUES ('00000000-0000-0000-0000-000000000101', 70, false),
       ('00000000-0000-0000-0000-000000000102', 0, true);
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;

INSERT INTO public.aspekindo_lms_quiz_questions(id, lesson_id, question_text, options, points)
VALUES ('00000000-0000-0000-0000-000000000111', '00000000-0000-0000-0000-000000000101',
        'Pertanyaan lengkap', '["A","B"]', 1);

-- A question without a key, with a null key, or out-of-range key cannot publish.
DO $$
DECLARE answer integer;
BEGIN
  FOREACH answer IN ARRAY ARRAY[NULL::integer, -1, 2] LOOP
    BEGIN
      INSERT INTO public.aspekindo_lms_quiz_answer_keys(question_id, correct_option)
      VALUES ('00000000-0000-0000-0000-000000000111', answer);
      UPDATE public.aspekindo_lms_lessons SET is_published = true
      WHERE id = '00000000-0000-0000-0000-000000000101';
      SET CONSTRAINTS ALL IMMEDIATE;
      RAISE EXCEPTION 'Invalid key accepted: %', answer;
    EXCEPTION WHEN check_violation THEN
      IF SQLERRM NOT LIKE '%minimal satu soal valid%' THEN RAISE; END IF;
    END;
  END LOOP;
  BEGIN
    UPDATE public.aspekindo_lms_lessons SET is_published = true
    WHERE id = '00000000-0000-0000-0000-000000000101';
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'Missing key accepted';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE '%minimal satu soal valid%' THEN RAISE; END IF;
  END;
END;
$$;

INSERT INTO public.aspekindo_lms_quiz_answer_keys(question_id, correct_option)
VALUES ('00000000-0000-0000-0000-000000000111', 1);

-- Invalid question shapes cannot publish even with a key.
DO $$
DECLARE mutation text;
BEGIN
  FOREACH mutation IN ARRAY ARRAY[
    $sql$UPDATE public.aspekindo_lms_quiz_questions SET question_text = E' \n\t'
      WHERE id = '00000000-0000-0000-0000-000000000111'$sql$,
    $sql$UPDATE public.aspekindo_lms_quiz_questions SET options = '["A"," "]'
      WHERE id = '00000000-0000-0000-0000-000000000111'$sql$,
    $sql$UPDATE public.aspekindo_lms_quiz_questions SET options = '["A",null]'
      WHERE id = '00000000-0000-0000-0000-000000000111'$sql$,
    $sql$UPDATE public.aspekindo_lms_quiz_questions SET options = '{}'
      WHERE id = '00000000-0000-0000-0000-000000000111'$sql$,
    $sql$UPDATE public.aspekindo_lms_quiz_questions SET options = '["A"]'
      WHERE id = '00000000-0000-0000-0000-000000000111'$sql$
  ] LOOP
    BEGIN
      EXECUTE mutation;
      UPDATE public.aspekindo_lms_lessons SET is_published = true
      WHERE id = '00000000-0000-0000-0000-000000000101';
      SET CONSTRAINTS ALL IMMEDIATE;
      RAISE EXCEPTION 'Incomplete question accepted: %', mutation;
    EXCEPTION WHEN check_violation THEN
      IF SQLERRM NOT LIKE '%minimal satu soal valid%' THEN RAISE; END IF;
    END;
  END LOOP;
END;
$$;

UPDATE public.aspekindo_lms_lessons SET is_published = true
WHERE id = '00000000-0000-0000-0000-000000000101';
SET CONSTRAINTS ALL IMMEDIATE;
SET CONSTRAINTS ALL DEFERRED;

-- Direct published INSERT succeeds when the same transaction supplies its bank.
INSERT INTO public.aspekindo_lms_lessons(id, passing_score, is_published)
VALUES ('00000000-0000-0000-0000-000000000103', 70, true);
INSERT INTO public.aspekindo_lms_quiz_questions(id, lesson_id, question_text, options, points)
VALUES ('00000000-0000-0000-0000-000000000113', '00000000-0000-0000-0000-000000000103',
        'Soal atomik', '["A","B"]', 2);
INSERT INTO public.aspekindo_lms_quiz_answer_keys(question_id, correct_option)
VALUES ('00000000-0000-0000-0000-000000000113', 0);
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
