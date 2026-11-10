import assert from "node:assert/strict";
import test from "node:test";
import { createServer, type ViteDevServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

let server: ViteDevServer;

test.before(async () => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    },
  });
  process.env.PORT ||= "4173";
  process.env.BASE_PATH ||= "/";
  server = await createServer({
    cacheDir: "node_modules/.vite-assessment-submit-tests",
    configFile: new URL("../../vite.config.ts", import.meta.url).pathname,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true },
    appType: "custom",
  });
});

test.after(async () => {
  await server.close();
});

test("respons submit_assessment valid masuk ke hasil dan merender ringkasan lengkap", async () => {
  const { AssessmentResultView, resolveAssessmentSubmitResponse } =
    await server.ssrLoadModule("/src/pages/Assessment.tsx");
  const outcome = resolveAssessmentSubmitResponse({
    score: 88,
    level: "Utama",
    correct: 21,
    total: 24,
  });

  assert.equal(outcome.ok, true);
  assert.equal(outcome.nextPhase, "result");
  assert.ok(outcome.ok);

  const html = renderToStaticMarkup(
    React.createElement(AssessmentResultView, { result: outcome.result }),
  );
  assert.match(html, /Skor: 88/);
  assert.match(html, />Utama</);
  assert.match(html, /21 dari 24 jawaban benar/);
});

test("respons submit_assessment tidak valid tetap di review dan memberi pesan jelas", async () => {
  const { resolveAssessmentSubmitResponse } =
    await server.ssrLoadModule("/src/pages/Assessment.tsx");
  const outcome = resolveAssessmentSubmitResponse({
    score: "88",
    level: "Utama",
    correct: 21,
    total: 24,
  });

  assert.deepEqual(outcome, {
    ok: false,
    message: "Respons assessment tidak valid.",
    nextPhase: "review",
  });
});

test("timer habis dan submit manual bersamaan hanya menjalankan satu permintaan", async () => {
  const { createAssessmentSubmitGuard } =
    await server.ssrLoadModule("/src/pages/Assessment.tsx");
  const guard = createAssessmentSubmitGuard();
  let rpcCalls = 0;
  let finishRpc: (() => void) | undefined;
  const rpcPending = new Promise<void>((resolve) => {
    finishRpc = resolve;
  });
  const submitAssessment = async () => {
    rpcCalls += 1;
    await rpcPending;
  };

  const manualSubmit = guard(submitAssessment);
  const timerSubmit = guard(submitAssessment);
  const repeatedClick = guard(submitAssessment);

  await Promise.resolve();
  assert.equal(rpcCalls, 1);
  assert.equal(manualSubmit, timerSubmit);
  assert.equal(manualSubmit, repeatedClick);

  finishRpc?.();
  await Promise.all([manualSubmit, timerSubmit, repeatedClick]);
  assert.equal(rpcCalls, 1);
});

test("penolakan daftar soal dan draf server dikenali dari respons error-only", async () => {
  const { resolveAssessmentSubmitResponse } = await server.ssrLoadModule("/src/pages/Assessment.tsx");
  for (const error of ["Invalid assessment questions", "Assessment draft unavailable; restart assessment"]) {
    const outcome = resolveAssessmentSubmitResponse({ error });
    assert.equal(outcome.ok, false);
    assert.equal(outcome.nextPhase, "restart");
    assert.match(outcome.message, /Mulai ulang/);
    assert.match(outcome.message, /Hasil assessment yang sudah selesai tetap tersimpan/);
    assert.doesNotMatch(outcome.message, /Invalid|unavailable/);
  }
  for (const error of ["Unauthorized", "Pre-test not found", "Network unavailable"]) {
    const outcome = resolveAssessmentSubmitResponse({ error });
    assert.equal(outcome.ok, false);
    assert.equal(outcome.nextPhase, "review");
    assert.match(outcome.message, /belum dapat dikirim/);
  }
});