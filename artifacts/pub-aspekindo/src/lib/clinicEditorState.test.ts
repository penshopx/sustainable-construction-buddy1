import test from "node:test";
import assert from "node:assert/strict";
import { clinicEditorInitial, receiveClinicVersion, rebaseClinicDraft, type ClinicVersion } from "./clinicEditorState.ts";

const original: ClinicVersion = { revision: 0, status: "open", operatorReply: "" };
const latest: ClinicVersion = { revision: 1, status: "answered", operatorReply: "Balasan admin pertama" };

test("polling and conflict reload preserve the second operator's reply and status", () => {
  const dirty = { ...clinicEditorInitial(original), reply: "Draf admin kedua", status: "in_review" as const };
  assert.equal(receiveClinicVersion(dirty, latest), dirty);
  assert.equal(dirty.base.revision, 0, "polling cannot silently authorize overwriting a newer reply");
  const rebased = rebaseClinicDraft(dirty, latest);
  assert.equal(rebased.reply, "Draf admin kedua");
  assert.equal(rebased.status, "in_review");
  assert.equal(rebased.base.revision, 1);
  assert.equal(rebased.base.operatorReply, "Balasan admin pertama");
  assert.equal(receiveClinicVersion(rebased, latest), rebased);
});

test("clean editors follow server updates and older requests cannot roll a revision back", () => {
  const clean = receiveClinicVersion(clinicEditorInitial(original), latest);
  assert.equal(clean.reply, latest.operatorReply);
  assert.equal(clean.base.revision, 1);
  assert.equal(receiveClinicVersion(clean, original), clean);
  assert.equal(rebaseClinicDraft(clean, original), clean);
});
