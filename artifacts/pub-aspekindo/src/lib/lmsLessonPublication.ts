import type { supabase } from "../integrations/supabase/client";

type QuizQuestion = {
  id: string;
  question_text: string;
  options: unknown;
  points: number;
};
type AnswerKey = { question_id: string; correct_option: number };

export const QUIZ_MUTATION_GUIDANCE =
  "Perubahan ditolak karena pelajaran terbit dengan kuis wajib harus tetap memiliki minimal satu soal valid beserta kunci jawaban. Tambahkan soal valid lain atau jadikan pelajaran draf terlebih dahulu.";

// Re-read both the source lesson and its bank: another admin may have changed
// publication status, the question's lesson, or the other questions since loading.
export async function getQuizMutationError(
  client: typeof supabase,
  questionId: string,
  replacement?: Omit<QuizQuestion, "id"> & { lesson_id: string; correct_option: number },
): Promise<string | null> {
  try {
    const source = await client.from("aspekindo_lms_quiz_questions")
      .select("lesson_id").eq("id", questionId).single();
    if (source.error || !source.data) throw source.error ?? new Error("Question missing");
    const lesson = await client.from("aspekindo_lms_lessons")
      .select("id, is_published, passing_score").eq("id", source.data.lesson_id).single();
    if (lesson.error || !lesson.data) throw lesson.error ?? new Error("Lesson missing");
    if (!lesson.data.is_published || lesson.data.passing_score <= 0) return null;
    const questions = await client.from("aspekindo_lms_quiz_questions")
      .select("id, question_text, options, points").eq("lesson_id", lesson.data.id);
    if (questions.error || !questions.data) throw questions.error ?? new Error("Questions missing");
    const remaining: QuizQuestion[] = questions.data.filter((question) => question.id !== questionId);
    const keys = remaining.length
      ? await client.from("aspekindo_lms_quiz_answer_keys")
        .select("question_id, correct_option").in("question_id", remaining.map((question) => question.id))
      : { data: [], error: null };
    if (keys.error) throw keys.error;
    const projectedKeys = [...(keys.data ?? [])];
    if (replacement?.lesson_id === lesson.data.id) {
      remaining.push({ ...replacement, id: questionId });
      projectedKeys.push({ question_id: questionId, correct_option: replacement.correct_option });
    }
    return hasValidQuizQuestion(remaining, projectedKeys) ? null : QUIZ_MUTATION_GUIDANCE;
  } catch {
    return "Keamanan perubahan kuis belum dapat diperiksa. Tidak ada perubahan yang disimpan. Coba kembali setelah koneksi pulih.";
  }
}

export const QUIZ_PUBLICATION_GUIDANCE =
  "Simpan pelajaran sebagai draf, lalu tambahkan minimal satu soal valid di Bank soal dengan pertanyaan, minimal dua opsi jawaban, poin positif, dan kunci jawaban yang sesuai. Setelah itu, terbitkan kembali pelajaran.";

export function hasValidQuizQuestion(questions: QuizQuestion[], keys: AnswerKey[]): boolean {
  return questions.some((question) => {
    const options = question.options;
    const key = keys.find((item) => item.question_id === question.id);
    return Boolean(
      question.question_text.trim() &&
      Array.isArray(options) &&
      options.length >= 2 &&
      options.every((option) => typeof option === "string" && option.trim()) &&
      Number.isInteger(question.points) && question.points > 0 &&
      key && Number.isInteger(key.correct_option) &&
      key.correct_option >= 0 && key.correct_option < options.length,
    );
  });
}

// Read on every publish/save, not from the quiz tab's potentially stale state.
export async function getLessonPublicationError(
  client: typeof supabase,
  lesson: { id?: string; is_published: boolean; passing_score: number },
): Promise<string | null> {
  if (!lesson.is_published || lesson.passing_score <= 0) return null;
  if (!lesson.id) return QUIZ_PUBLICATION_GUIDANCE;
  try {
    const questions = await client.from("aspekindo_lms_quiz_questions")
      .select("id, question_text, options, points").eq("lesson_id", lesson.id);
    if (questions.error) throw questions.error;
    if (!questions.data?.length) return QUIZ_PUBLICATION_GUIDANCE;
    const keys = await client.from("aspekindo_lms_quiz_answer_keys")
      .select("question_id, correct_option").in("question_id", questions.data.map((question) => question.id));
    if (keys.error) throw keys.error;
    return hasValidQuizQuestion(questions.data, keys.data ?? []) ? null : QUIZ_PUBLICATION_GUIDANCE;
  } catch {
    return "Kesiapan kuis belum dapat diperiksa. Pelajaran belum diterbitkan. Coba simpan kembali setelah koneksi pulih atau simpan sebagai draf.";
  }
}
