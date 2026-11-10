-- Serialize all bank mutations on the lesson, then validate the final transaction
-- state. Deferral allows the existing save RPC to update options and key together.
CREATE OR REPLACE FUNCTION public.aspekindo_lms_protect_published_quiz_bank()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_lessons uuid[] := ARRAY[]::uuid[];
  affected_questions uuid[] := ARRAY[]::uuid[];
  lesson_id_to_check uuid;
BEGIN
  IF TG_TABLE_NAME = 'aspekindo_lms_quiz_questions' THEN
    IF TG_OP <> 'INSERT' THEN
      affected_lessons := array_append(affected_lessons, OLD.lesson_id);
    END IF;
    IF TG_OP <> 'DELETE' THEN
      affected_lessons := array_append(affected_lessons, NEW.lesson_id);
    END IF;
  ELSE
    IF TG_OP <> 'INSERT' THEN
      affected_questions := array_append(affected_questions, OLD.question_id);
    END IF;
    IF TG_OP <> 'DELETE' THEN
      affected_questions := array_append(affected_questions, NEW.question_id);
    END IF;
    SELECT array_agg(question.lesson_id) INTO affected_lessons
    FROM public.aspekindo_lms_quiz_questions question
    WHERE question.id = ANY(affected_questions);
    -- A cascaded key deletion may no longer find its question. The question's
    -- own deferred event checks OLD.lesson_id in that case.
  END IF;

  FOR lesson_id_to_check IN
    SELECT DISTINCT id FROM unnest(affected_lessons) AS ids(id)
    WHERE id IS NOT NULL ORDER BY id
  LOOP
    IF TG_ARGV[0] = 'lock' THEN
      -- A real parent-row write acts as the per-lesson mutex. Unlike FOR UPDATE
      -- alone, it also causes stale REPEATABLE READ snapshots to fail safely
      -- with a serialization error instead of allowing write skew.
      UPDATE public.aspekindo_lms_lessons SET id = id
      WHERE id = lesson_id_to_check;
    ELSE
      IF EXISTS (
        SELECT 1 FROM public.aspekindo_lms_lessons lesson
        WHERE lesson.id = lesson_id_to_check
          AND lesson.is_published AND lesson.passing_score > 0
      ) AND NOT EXISTS (
        SELECT 1
        FROM public.aspekindo_lms_quiz_questions question
        JOIN public.aspekindo_lms_quiz_answer_keys answer_key
          ON answer_key.question_id = question.id
        CROSS JOIN LATERAL (
          SELECT CASE WHEN jsonb_typeof(question.options) = 'array'
            THEN question.options ELSE '[]'::jsonb END AS options
        ) normalized
        WHERE question.lesson_id = lesson_id_to_check
          AND question.question_text ~ '[^[:space:]]'
          AND question.points > 0
          AND jsonb_array_length(normalized.options) >= 2
          AND NOT EXISTS (
            SELECT 1 FROM jsonb_array_elements(normalized.options) AS item(value)
            WHERE jsonb_typeof(item.value) <> 'string'
              OR NOT ((item.value #>> '{}') ~ '[^[:space:]]')
          )
          AND answer_key.correct_option >= 0
          AND answer_key.correct_option < jsonb_array_length(normalized.options)
      ) THEN
        RAISE EXCEPTION USING
          ERRCODE = '23514',
          MESSAGE = 'Pelajaran terbit dengan kuis wajib harus tetap memiliki minimal satu soal valid beserta kunci jawaban. Tambahkan soal valid lain atau jadikan pelajaran draf terlebih dahulu.';
      END IF;
    END IF;
  END LOOP;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.aspekindo_lms_protect_published_quiz_bank() FROM PUBLIC;

DROP TRIGGER IF EXISTS aspekindo_lms_quiz_bank_lock ON public.aspekindo_lms_quiz_questions;
CREATE TRIGGER aspekindo_lms_quiz_bank_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.aspekindo_lms_quiz_questions
  FOR EACH ROW EXECUTE FUNCTION public.aspekindo_lms_protect_published_quiz_bank('lock');
DROP TRIGGER IF EXISTS aspekindo_lms_quiz_key_bank_lock ON public.aspekindo_lms_quiz_answer_keys;
CREATE TRIGGER aspekindo_lms_quiz_key_bank_lock
  BEFORE INSERT OR UPDATE OR DELETE ON public.aspekindo_lms_quiz_answer_keys
  FOR EACH ROW EXECUTE FUNCTION public.aspekindo_lms_protect_published_quiz_bank('lock');

DROP TRIGGER IF EXISTS aspekindo_lms_quiz_bank_valid ON public.aspekindo_lms_quiz_questions;
CREATE CONSTRAINT TRIGGER aspekindo_lms_quiz_bank_valid
  AFTER INSERT OR UPDATE OR DELETE ON public.aspekindo_lms_quiz_questions
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.aspekindo_lms_protect_published_quiz_bank('check');
DROP TRIGGER IF EXISTS aspekindo_lms_quiz_key_bank_valid ON public.aspekindo_lms_quiz_answer_keys;
CREATE CONSTRAINT TRIGGER aspekindo_lms_quiz_key_bank_valid
  AFTER INSERT OR UPDATE OR DELETE ON public.aspekindo_lms_quiz_answer_keys
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.aspekindo_lms_protect_published_quiz_bank('check');
