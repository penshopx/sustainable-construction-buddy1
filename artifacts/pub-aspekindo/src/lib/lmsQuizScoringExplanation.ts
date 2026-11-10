export const LMS_QUIZ_WEIGHT_FORMULA =
  "Nilai kuis berbobot = jumlah poin soal yang dijawab benar ÷ total poin seluruh soal × 100, lalu dibulatkan ke bilangan bulat. Jumlah jawaban benar adalah hitungan soal, bukan persentase nilai.";

export const LMS_QUIZ_WEIGHT_EXAMPLE =
  "Contoh: dua soal berbobot 1 dan 3 poin. Satu jawaban benar pada soal 1 poin menghasilkan 25%; pada soal 3 poin menghasilkan 75%, bukan selalu 50%.";

export const LMS_QUIZ_HISTORY_NOTICE =
  "Rincian poin saat pengiriman belum tersimpan untuk percobaan ini. Nilai yang ditampilkan adalah hasil tersimpan; bobot soal saat ini tidak digunakan untuk menghitung ulang hasil ini.";

// Deliberately accepts only attempt counts: today's editable questions cannot
// provide evidence of the weights used for a previously submitted attempt.
export function quizAnswerCount(attempt: {
  correct_answers: number;
  total_questions: number;
}): string {
  return `${attempt.correct_answers} dari ${attempt.total_questions} soal dijawab benar.`;
}
