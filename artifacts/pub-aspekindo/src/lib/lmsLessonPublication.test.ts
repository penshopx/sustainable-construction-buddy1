import assert from "node:assert/strict";
import test from "node:test";
import { getLessonPublicationError, hasValidQuizQuestion, QUIZ_PUBLICATION_GUIDANCE } from "./lmsLessonPublication.ts";

const question = { id: "q1", question_text: "Apa jawaban yang benar?", options: ["A", "B"], points: 1 };
const key = { question_id: "q1", correct_option: 0 };
const lesson = { id: "lesson-1", passing_score: 70, is_published: true };

function database(questions = [question], keys = [key], errorTable = "", reject = false) {
  const reads: { table: string; filter: unknown[] }[] = [];
  const client = {
    from(table: string) {
      return {
        select() {
          const result = (...filter: unknown[]) => {
            reads.push({ table, filter });
            if (reject) return Promise.reject(new Error("offline"));
            return Promise.resolve({
              data: table === "aspekindo_lms_quiz_questions" ? questions : keys,
              error: errorTable === table ? new Error("unavailable") : null,
            });
          };
          return { eq: result, in: result };
        },
      };
    },
  } as unknown as Parameters<typeof getLessonPublicationError>[0];
  return { client, reads };
}

test("pelajaran wajib kuis tanpa soal tidak dapat diterbitkan", async () => {
  const { client, reads } = database([]);
  assert.equal(await getLessonPublicationError(client, lesson), QUIZ_PUBLICATION_GUIDANCE);
  assert.deepEqual(reads, [{ table: "aspekindo_lms_quiz_questions", filter: ["lesson_id", lesson.id] }]);
  assert.match(QUIZ_PUBLICATION_GUIDANCE, /draf.*Bank soal.*kunci jawaban.*terbitkan/);
});

test("pelajaran baru wajib kuis harus disimpan sebagai draf lebih dahulu", async () => {
  const { client, reads } = database();
  assert.equal(await getLessonPublicationError(client, { ...lesson, id: undefined }), QUIZ_PUBLICATION_GUIDANCE);
  assert.equal(reads.length, 0);
});

test("soal lengkap dengan kunci yang sesuai mengizinkan penerbitan", async () => {
  const { client, reads } = database();
  assert.equal(await getLessonPublicationError(client, lesson), null);
  assert.deepEqual(reads[1], { table: "aspekindo_lms_quiz_answer_keys", filter: ["question_id", ["q1"]] });
});

test("draf dan pelajaran tanpa kewajiban kuis tetap dapat disimpan tanpa soal", async () => {
  const { client, reads } = database([]);
  assert.equal(await getLessonPublicationError(client, { ...lesson, is_published: false }), null);
  assert.equal(await getLessonPublicationError(client, { ...lesson, passing_score: 0 }), null);
  assert.equal(reads.length, 0);
});

test("soal tanpa kunci atau dengan jawaban di luar opsi tidak dianggap siap", async () => {
  for (const keys of [[], [{ ...key, correct_option: -1 }], [{ ...key, correct_option: 2 }], [{ ...key, correct_option: 0.5 }], [{ ...key, question_id: "other" }]]) {
    assert.equal(await getLessonPublicationError(database([question], keys).client, lesson), QUIZ_PUBLICATION_GUIDANCE);
  }
});

test("pertanyaan kosong, opsi rusak, dan poin tidak valid tidak lolos", () => {
  for (const invalid of [
    { ...question, question_text: " " },
    { ...question, options: ["A"] },
    { ...question, options: ["A", " "] },
    { ...question, options: ["A", 1] },
    { ...question, options: null },
    { ...question, points: 0 },
    { ...question, points: -1 },
    { ...question, points: 0.5 },
  ]) assert.equal(hasValidQuizQuestion([invalid], [key]), false);
  assert.equal(hasValidQuizQuestion([], []), false);
  assert.equal(hasValidQuizQuestion([question], [key]), true);
});

test("gagal membaca soal atau kunci menahan penerbitan dan memberi langkah pemulihan", async () => {
  for (const table of ["aspekindo_lms_quiz_questions", "aspekindo_lms_quiz_answer_keys"]) {
    const error = await getLessonPublicationError(database([question], [key], table).client, lesson);
    assert.match(error!, /belum dapat diperiksa.*Coba simpan kembali/);
  }
  assert.match((await getLessonPublicationError(database([question], [key], "", true).client, lesson))!, /belum diterbitkan/);
});

test("pemeriksaan ulang memakai bank soal terbaru, bukan hasil yang tersimpan di cache", async () => {
  const questions = [question];
  const { client } = database(questions);
  assert.equal(await getLessonPublicationError(client, lesson), null);
  questions.splice(0);
  assert.equal(await getLessonPublicationError(client, lesson), QUIZ_PUBLICATION_GUIDANCE);
  questions.push(question);
  assert.equal(await getLessonPublicationError(client, lesson), null);
});
