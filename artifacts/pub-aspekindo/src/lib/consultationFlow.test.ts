import assert from "node:assert/strict";
import test from "node:test";
import { deriveFlow, PROFESSIONS, stripTag, tagQuestion } from "./consultationFlow.ts";

test("consultation offers all seven requested professions", () => {
  assert.equal(PROFESSIONS.length, 7);
  assert.equal(new Set(PROFESSIONS.map(p => p.id)).size, 7);
  assert.ok(PROFESSIONS.some(p => p.name === "ASN / Aparatur Sipil Negara"));
  assert.ok(PROFESSIONS.some(p => p.name === "Profesional Lainnya"));
});

test("failed or unanswered diagnosis does not advance the stage", () => {
  const question = tagQuestion("Jadwal terlambat", "kontraktor", "diagnosis");
  assert.equal(stripTag(question), "Jadwal terlambat");
  assert.equal(deriveFlow([{ role: "user", content: question }]).stage, "diagnosis");
});

test("persisted replies advance stages and restore profession without local state", () => {
  const messages = [
    { role: "user" as const, content: tagQuestion("Masalah", "kontraktor", "diagnosis") },
    { role: "assistant" as const, content: "Apa bukti kendalanya?" },
    { role: "user" as const, content: tagQuestion("Bukti", "kontraktor", "eksplorasi") },
    { role: "assistant" as const, content: "Pilihan perbaikan" },
  ];
  assert.deepEqual(deriveFlow(messages), {
    professionId: "kontraktor", stage: "blueprint",
    completed: ["diagnosis", "eksplorasi"], tagged: true,
  });
});
