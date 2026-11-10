import assert from "node:assert/strict";
import test from "node:test";
import { mergeAssessmentDrafts, resolveDraftSave, type AssessmentDraft } from "./assessmentDraft.ts";

const base: AssessmentDraft = {
  version: 1, revision: 0, preTestId: "test",
  questions: ["q1", "q2", "q3"].map(id => ({ id, question_text: id, options: ["A", "B"], difficulty: "Pemula" })),
  answers: {}, answerResults: {}, currentQ: 0, phase: "test", timeLeft: 270, timedOut: false,
};

test("independent edits on two devices merge without losing either answer", () => {
  const local = { ...base, answers: { q1: 0 } };
  const remote = { ...base, revision: 1, answers: { q2: 1 } };
  const merged = mergeAssessmentDrafts(base, local, remote);
  assert.deepEqual(merged.conflicts, []);
  assert.deepEqual(merged.draft.answers, { q1: 0, q2: 1 });
  assert.equal(merged.draft.revision, 1);
});

test("different answers for the same question require a choice; both alternatives survive", () => {
  const local = { ...base, answers: { q1: 0, q3: 1 } };
  const remote = { ...base, revision: 1, answers: { q1: 1, q2: 0 } };
  const merged = mergeAssessmentDrafts(base, local, remote);
  assert.deepEqual(merged.conflicts, ["q1"]);
  assert.equal(merged.draft.answers.q1, 0);
  assert.equal(remote.answers.q1, 1);
  assert.deepEqual(merged.draft.answers, { q1: 0, q2: 0, q3: 1 });
});

test("a stale unchanged answer must not undo a resolved choice from the other device", () => {
  const previous = { ...base, answers: { q1: 0 } };
  const remote = { ...previous, revision: 2, answers: { q1: 1 } };
  const merged = mergeAssessmentDrafts(previous, { ...previous, answers: { q1: 0, q2: 1 } }, remote);
  assert.deepEqual(merged.conflicts, []);
  assert.deepEqual(merged.draft.answers, { q1: 1, q2: 1 });
});

test("identical concurrent choices are not conflicts and failed-save recovery is conservative", () => {
  const local = { ...base, answers: { q1: 0 } };
  assert.deepEqual(mergeAssessmentDrafts(base, local, { ...local, revision: 1 }).conflicts, []);
  assert.deepEqual(mergeAssessmentDrafts(null, local, { ...base, revision: 2, answers: { q1: 1 } }).conflicts, ["q1"]);
});

test("merge uses results for the chosen answer, not the overwritten choice", () => {
  const result = { selected: 1, is_correct: true, correct_answer: 1, explanation: "B" };
  const remote = { ...base, revision: 1, answers: { q1: 1 }, answerResults: { q1: result } };
  assert.deepEqual(mergeAssessmentDrafts(base, { ...base, answers: { q1: 0 } }, remote).draft.answerResults, {});
  assert.deepEqual(mergeAssessmentDrafts(base, base, remote).draft.answerResults, { q1: result });
});

test("reject mismatched tests/questions and invalid save envelopes", () => {
  assert.throws(() => mergeAssessmentDrafts(base, base, { ...base, preTestId: "other" }));
  assert.throws(() => mergeAssessmentDrafts(base, base, { ...base, questions: [...base.questions].reverse() }));
  assert.equal(resolveDraftSave(undefined), null);
  assert.equal(resolveDraftSave({ saved: true, draft: { ...base, revision: undefined } }), null);
  assert.equal(resolveDraftSave({ saved: false, draft: { ...base, revision: -1 } }), null);
  assert.deepEqual(resolveDraftSave({ saved: false, draft: base }), { saved: false, draft: base });
});
