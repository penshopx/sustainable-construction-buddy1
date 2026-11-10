import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createServer } from "vite";

test("penjelasan yang dirender membedakan persiapan kuis dari hasil tersimpan", async () => {
  process.env.PORT ||= "4173";
  process.env.BASE_PATH ||= "/";
  const server = await createServer({
    configFile: new URL("../../vite.config.ts", import.meta.url).pathname,
    cacheDir: "node_modules/.vite-lms-score-explanation-tests",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true },
    appType: "custom",
  });
  try {
    const { QuizScoringExplanation } = await server.ssrLoadModule(
      "/src/components/lms/QuizScoringExplanation.tsx",
    );
    const preparation = renderToStaticMarkup(React.createElement(QuizScoringExplanation));
    assert.match(preparation, /25%.*75%/);
    assert.doesNotMatch(preparation, /percobaan ini|soal dijawab benar\./);

    // Both an immediate RPC response and a result loaded from history have the
    // same counts, regardless of score or any later changes to the question bank.
    for (const score of [25, 75]) {
      const attempt = { correct_answers: 1, total_questions: 2, score };
      const result = renderToStaticMarkup(React.createElement(QuizScoringExplanation, { attempt }));
      assert.match(result, /1 dari 2 soal dijawab benar/);
      assert.match(result, /saat pengiriman belum tersimpan/);
      assert.match(result, /bobot soal saat ini tidak digunakan/);
      assert.equal(attempt.score, score);
    }
  } finally {
    await server.close();
  }
});
