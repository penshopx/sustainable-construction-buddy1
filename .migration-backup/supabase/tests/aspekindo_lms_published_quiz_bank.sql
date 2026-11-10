\set ON_ERROR_STOP on
SET ROLE authenticated;

-- A different valid question allows deletion; the removed key cascades.
DELETE FROM public.aspekindo_lms_quiz_questions
WHERE id = '00000000-0000-0000-0000-000000000012';

-- Catch errors only after forcing deferred constraint checks, like a commit.
DO $$
DECLARE
  mutation text;
BEGIN
  FOREACH mutation IN ARRAY ARRAY[
    $sql$DELETE FROM public.aspekindo_lms_quiz_questions WHERE id = '00000000-0000-0000-0000-000000000011'$sql$,
    $sql$DELETE FROM public.aspekindo_lms_quiz_answer_keys WHERE question_id = '00000000-0000-0000-0000-000000000011'$sql$,
    $sql$UPDATE public.aspekindo_lms_quiz_answer_keys SET correct_option = 9$sql$,
    $sql$UPDATE public.aspekindo_lms_quiz_questions SET options = '["A","B"]'$sql$,
    $sql$UPDATE public.aspekindo_lms_quiz_questions SET options = '["A","B"," "]'$sql$,
    $sql$UPDATE public.aspekindo_lms_quiz_questions SET options = '["A","B",null]'$sql$,
    $sql$UPDATE public.aspekindo_lms_quiz_questions SET options = '{}'$sql$,
    $sql$UPDATE public.aspekindo_lms_quiz_questions SET question_text = E' \n\t '$sql$
  ] LOOP
    BEGIN
      EXECUTE mutation;
      SET CONSTRAINTS ALL IMMEDIATE;
      RAISE EXCEPTION 'Unsafe mutation was accepted: %', mutation;
    EXCEPTION WHEN check_violation THEN
      IF SQLERRM NOT LIKE '%minimal satu soal valid%' THEN RAISE; END IF;
    END;
  END LOOP;
END;
$$;

-- Atomic shortening of options with a matching new key is allowed.
BEGIN;
UPDATE public.aspekindo_lms_quiz_questions SET options = '["A","B"]';
UPDATE public.aspekindo_lms_quiz_answer_keys SET correct_option = 0;
COMMIT;

-- Moving the last question away must protect its original published lesson.
INSERT INTO public.aspekindo_lms_lessons(id, passing_score, is_published)
VALUES ('00000000-0000-0000-0000-000000000002', 70, false);
DO $$
BEGIN
  BEGIN
    UPDATE public.aspekindo_lms_quiz_questions SET lesson_id = '00000000-0000-0000-0000-000000000002';
    SET CONSTRAINTS ALL IMMEDIATE;
    RAISE EXCEPTION 'Last valid question was moved';
  EXCEPTION WHEN check_violation THEN
    IF SQLERRM NOT LIKE '%minimal satu soal valid%' THEN RAISE; END IF;
  END;
END;
$$;

-- Draft and non-mandatory lessons may have no valid questions. Roll back so
-- subsequent concurrent tests can reuse the original bank.
BEGIN;
UPDATE public.aspekindo_lms_lessons SET is_published = false;
DELETE FROM public.aspekindo_lms_quiz_questions;
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
BEGIN;
UPDATE public.aspekindo_lms_lessons SET passing_score = 0;
DELETE FROM public.aspekindo_lms_quiz_questions;
SET CONSTRAINTS ALL IMMEDIATE;
ROLLBACK;
RESET ROLE;
