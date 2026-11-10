import { test } from "node:test";
import assert from "node:assert/strict";
import { CHAT_ENGINES, helpdeskContext } from "./chatEngines.ts";

test("pilihan AI tetap lima keluarga yang dikenal dan Claude menjadi pilihan pertama", () => {
  assert.deepEqual(CHAT_ENGINES.map(item => item.id), ["claude", "gpt", "deepseek", "nvidia", "gemini"]);
});

test("konteks panjang dibatasi tanpa menghapus pertanyaan terbaru", () => {
  const context = helpdeskContext([
    ...Array.from({ length: 20 }, () => ({ role: "assistant" as const, content: "a".repeat(10000) })),
    { role: "user", content: "Pertanyaan terbaru" },
  ]);
  assert.ok(context.length <= 10);
  assert.ok(context.every(item => item.content.length <= 4000));
  assert.ok(context.reduce((total, item) => total + item.content.length, 0) <= 20000);
  assert.deepEqual(context.at(-1), { role: "user", content: "Pertanyaan terbaru" });
});
