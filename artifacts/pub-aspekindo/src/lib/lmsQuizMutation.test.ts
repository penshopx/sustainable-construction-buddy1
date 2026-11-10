import assert from "node:assert/strict";
import test from "node:test";
import { getQuizMutationError, QUIZ_MUTATION_GUIDANCE } from "./lmsLessonPublication.ts";

const question = { id: "q1", question_text: "Soal", options: ["A", "B"], points: 1 };
const key = { question_id: question.id, correct_option: 0 };
const replacement = { ...question, lesson_id: "lesson-1", correct_option: 0 };

function database() {
  const state = {
    lesson: { id: "lesson-1", is_published: true, passing_score: 70 },
    questions: [question],
    keys: [key],
    fail: "",
    reject: false,
  };
  const client = {
    from(table: string) {
      let single = false;
      const query = {
        select: () => query,
        eq: () => query,
        in: () => query,
        single: () => { single = true; return query; },
        then(resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) {
          if (state.reject) return Promise.reject(new Error("offline")).then(resolve, reject);
          const data = table === "aspekindo_lms_lessons" ? state.lesson
            : table === "aspekindo_lms_quiz_questions"
              ? single ? { lesson_id: state.lesson.id } : state.questions
              : state.keys;
          return Promise.resolve({ data, error: state.fail === table ? new Error("unavailable") : null }).then(resolve, reject);
        },
      };
      return query;
    },
  } as unknown as Parameters<typeof getQuizMutationError>[0];
  return { client, state };
}

test("penghapusan soal valid terakhir pada pelajaran terbit ditolak", async () => {
  const { client } = database();
  assert.equal(await getQuizMutationError(client, question.id), QUIZ_MUTATION_GUIDANCE);
  assert.match(QUIZ_MUTATION_GUIDANCE, /soal valid lain.*draf/);
});

test("soal invalid lain tidak membolehkan penghapusan soal valid terakhir", async () => {
  const { client, state } = database();
  state.questions.push({ ...question, id: "q2" });
  // q2 has no key.
  assert.equal(await getQuizMutationError(client, question.id), QUIZ_MUTATION_GUIDANCE);
  state.keys.push({ question_id: "q2", correct_option: 1 });
  assert.equal(await getQuizMutationError(client, question.id), null);
});

test("perubahan kunci, opsi, teks, dan poin yang merusak soal terakhir ditolak", async () => {
  const { client } = database();
  for (const invalid of [
    { correct_option: -1 }, { correct_option: 2 }, { correct_option: 0.5 },
    { options: ["A"] }, { options: ["A", " "] }, { options: ["A", 1] },
    { options: null }, { question_text: " " }, { points: 0 }, { points: 0.5 },
  ]) {
    assert.equal(await getQuizMutationError(client, question.id, { ...replacement, ...invalid }), QUIZ_MUTATION_GUIDANCE);
  }
  assert.equal(await getQuizMutationError(client, question.id, replacement), null);
});

test("perubahan opsi dan kunci valid dinilai sebagai satu kesatuan", async () => {
  const { client, state } = database();
  state.questions[0] = { ...question, options: ["A", "B", "C"] };
  state.keys[0] = { ...key, correct_option: 2 };
  assert.equal(await getQuizMutationError(client, question.id, replacement), null);
});

test("memindahkan soal valid terakhir juga ditolak", async () => {
  const { client, state } = database();
  assert.equal(await getQuizMutationError(client, question.id, { ...replacement, lesson_id: "other" }), QUIZ_MUTATION_GUIDANCE);
  state.questions.push({ ...question, id: "q2" });
  state.keys.push({ question_id: "q2", correct_option: 0 });
  assert.equal(await getQuizMutationError(client, question.id, { ...replacement, lesson_id: "other" }), null);
});

test("draf dan pelajaran tanpa kuis wajib boleh menghapus soal terakhir", async () => {
  const { client, state } = database();
  state.lesson.is_published = false;
  assert.equal(await getQuizMutationError(client, question.id), null);
  state.lesson.is_published = true;
  state.lesson.passing_score = 0;
  assert.equal(await getQuizMutationError(client, question.id), null);
});

test("setiap operasi membaca ulang status terbit dan bank soal", async () => {
  const { client, state } = database();
  state.lesson.is_published = false;
  assert.equal(await getQuizMutationError(client, question.id), null);
  state.lesson.is_published = true;
  assert.equal(await getQuizMutationError(client, question.id), QUIZ_MUTATION_GUIDANCE);
  state.questions.push({ ...question, id: "q2" });
  state.keys.push({ question_id: "q2", correct_option: 0 });
  assert.equal(await getQuizMutationError(client, question.id), null);
  state.questions.pop();
  assert.equal(await getQuizMutationError(client, question.id), QUIZ_MUTATION_GUIDANCE);
});

test("kegagalan membaca sumber, pelajaran, soal, atau kunci menolak perubahan", async () => {
  const { client, state } = database();
  state.questions.push({ ...question, id: "q2" });
  for (const table of ["aspekindo_lms_lessons", "aspekindo_lms_quiz_questions", "aspekindo_lms_quiz_answer_keys"]) {
    state.fail = table;
    assert.match((await getQuizMutationError(client, question.id))!, /Tidak ada perubahan yang disimpan/);
  }
  state.fail = "";
  state.reject = true;
  assert.match((await getQuizMutationError(client, question.id))!, /koneksi pulih/);
});
