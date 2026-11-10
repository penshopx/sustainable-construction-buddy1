import assert from "node:assert/strict";
import test from "node:test";
import {
  LMS_QUIZ_HISTORY_NOTICE,
  LMS_QUIZ_WEIGHT_EXAMPLE,
  LMS_QUIZ_WEIGHT_FORMULA,
  quizAnswerCount,
} from "./lmsQuizScoringExplanation.ts";

test("jumlah benar tetap hitungan soal, bukan skor berbobot", () => {
  for (const score of [25, 75]) {
    const attempt = { correct_answers: 1, total_questions: 2, score };
    assert.equal(quizAnswerCount(attempt), "1 dari 2 soal dijawab benar.");
    assert.equal(attempt.score, score);
  }
  assert.equal(quizAnswerCount({ correct_answers: 0, total_questions: 2 }), "0 dari 2 soal dijawab benar.");
  assert.equal(quizAnswerCount({ correct_answers: 2, total_questions: 2 }), "2 dari 2 soal dijawab benar.");
});

test("penjelasan mencakup rumus, pembulatan, dan contoh bobot tidak sama", () => {
  assert.match(LMS_QUIZ_WEIGHT_FORMULA, /poin soal yang dijawab benar ÷ total poin seluruh soal × 100/);
  assert.match(LMS_QUIZ_WEIGHT_FORMULA, /dibulatkan ke bilangan bulat/);
  assert.match(LMS_QUIZ_WEIGHT_EXAMPLE, /1 dan 3 poin/);
  assert.match(LMS_QUIZ_WEIGHT_EXAMPLE, /25%.*75%.*bukan selalu 50%/);
});

test("hasil tanpa snapshot menyatakan keterbatasan, bukan merekonstruksi bobot", () => {
  assert.match(LMS_QUIZ_HISTORY_NOTICE, /saat pengiriman belum tersimpan/);
  assert.match(LMS_QUIZ_HISTORY_NOTICE, /hasil tersimpan/);
  assert.match(LMS_QUIZ_HISTORY_NOTICE, /bobot soal saat ini tidak digunakan/);
});
