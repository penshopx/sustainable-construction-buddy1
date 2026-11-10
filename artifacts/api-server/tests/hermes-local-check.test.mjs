import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import express from "express";

const bundle = await build({ stdin: {
  contents: 'export {createHermesLocalCheckRouter} from "./src/routes/hermes-local-check"; export {runHermesLocalCheck} from "./src/lib/hermes-local-check"; export {buildBg001Fixture,runHermesBg001Check} from "./src/lib/hermes-bg001-check"; export {runHermesSchemeFixture} from "./src/lib/smap-pilot-runtime"; export {runHermesBg001Chat,verifyBg001Answer} from "./src/lib/hermes-bg001-chat"; export {HermesBillingError} from "./src/lib/hermes-billing-error"; export {PilotError} from "./src/lib/smap-pilot-data";',
  loader: "ts", resolveDir: fileURLToPath(new URL("..", import.meta.url)),
}, bundle: true, platform: "node", format: "cjs", external: ["express"], write: false });
const module = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const { createHermesLocalCheckRouter, runHermesLocalCheck, buildBg001Fixture, runHermesBg001Check, runHermesSchemeFixture,
  runHermesBg001Chat, verifyBg001Answer, HermesBillingError, PilotError } = module.exports;
const fixture = { status: "completed", runtime: "hermes", provider: "local-mock", dataScope: "synthetic-only",
  toolCount: 0, localProviderRequests: 1, externalModelRequests: 0, documentCount: 1, elapsedMs: 10, fixtureReply: "Contoh sintetis" };
const bgFixture = { ...fixture, dataScope: "uploaded-reference-only", documentCount: 3, schemeCode: "BG001",
  contextVerified: true, citationsVerified: true, question: "Pertanyaan BG001", sources: [
    { id: "KB09", title: "Skema", page: 21, quote: "41011 BG001" },
    { id: "KB19", title: "Ruang lingkup", page: 17, quote: "pembongkaran" },
    { id: "KB44", title: "BPS 2025", page: 573, quote: "KONSTRUKSI KONVENSIONAL GEDUNG HUNIAN" },
  ] };
const chatFixture = { status: "completed", runtime: "hermes", provider: "openrouter-claude", schemeCode: "BG001",
  dataScope: "question-and-public-references", toolCount: 0, externalModelRequests: 1, contextVerified: true,
  model: "anthropic/claude-test", answer: "BG001 dipetakan ke 41011. [KB09, halaman PDF 21]",
  insufficientEvidence: false, elapsedMs: 100, sources: [bgFixture.sources[0]] };
async function harness(t, overrides = {}) {
  const state = { role: true, roleFailure: false, checks: 0, runs: 0, calls: [], signal: null };
  const app = express(); app.use(express.json());
  app.use(createHermesLocalCheckRouter({
    env: { NODE_ENV: "development", VITE_SUPABASE_URL: "https://fixture.supabase.co",
      VITE_SUPABASE_PUBLISHABLE_KEY: "synthetic-public-key", ...overrides.env },
    fetchImpl: async (url, init) => {
      state.calls.push({ url, init });
      const path = new URL(url).pathname;
      if (path === "/auth/v1/user") return Response.json({ id: "11111111-1111-4111-8111-111111111111" });
      assert.equal(path, "/rest/v1/rpc/current_user_is_super_admin");
      state.checks++;
      if (state.roleFailure) throw new Error("PRIVATE_ERROR_CANARY");
      return Response.json(state.role);
    },
    run: async signal => { state.runs++; state.signal = signal; return overrides.run ? overrides.run(state, signal) : fixture; },
    runBg001: async signal => { state.runs++; state.signal = signal; return overrides.runBg001 ? overrides.runBg001(state, signal) : bgFixture; },
    runBg001Chat: async (question, _env, signal) => {
      state.runs++; state.signal = signal; state.question = question;
      return overrides.runChat ? overrides.runChat(state, signal) : chatFixture;
    },
  }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const request = (body = { consent: true }, options = {}) =>
    fetch(`http://127.0.0.1:${server.address().port}/operator/hermes/${options.chat ? "bg001-chat" : options.bg001 ? "bg001-check" : "local-check"}${options.query ?? ""}`, {
      method: "POST", headers: { Authorization: "Bearer " + "a".repeat(30), "Content-Type": "application/json", ...options.headers },
      body: JSON.stringify(body), ...(options.signal ? { signal: options.signal } : {}),
    });
  return { state, request };
}
test("production, anonymous and non-super-admin requests never run Hermes", async t => {
  const prod = await harness(t, { env: { NODE_ENV: "production" } });
  assert.equal((await prod.request()).status, 404); assert.equal(prod.state.calls.length, 0);
  const h = await harness(t);
  assert.equal((await h.request({ consent: true }, { headers: { Authorization: "" } })).status, 401);
  h.state.role = false;
  assert.equal((await h.request({ consent: true, role: "super_admin" })).status, 403);
  assert.equal(h.state.runs, 0);
});
test("explicit consent, strict input and no caller-controlled documents/model are enforced", async t => {
  const h = await harness(t);
  for (const body of [{}, { consent: false }, { consent: true, documentIds: ["private"] }, { consent: true, model: "other" }])
    assert.equal((await h.request(body)).status, 400);
  assert.equal((await h.request({ consent: true }, { query: "?role=super_admin" })).status, 400);
  assert.equal(h.state.runs, 0);
});
test("success checks fresh roles before and after the worker, and uses only public key/member bearer", async t => {
  const h = await harness(t), res = await h.request();
  assert.equal(res.status, 200); assert.deepEqual(await res.json(), fixture);
  assert.equal(h.state.checks, 2); assert.equal(h.state.runs, 1);
  assert.equal(res.headers.get("cache-control"), "no-store");
  for (const call of h.state.calls) {
    assert.equal(call.init.headers.apikey, "synthetic-public-key");
    assert.match(call.init.headers.Authorization, /^Bearer a+$/);
  }
});
test("role loss, verification failure, missing runtime and invalid worker results fail closed", async t => {
  const lost = await harness(t, { run: state => { state.role = false; return fixture; } });
  assert.equal((await lost.request()).status, 403);
  const failed = await harness(t); failed.state.roleFailure = true;
  const auth = await failed.request(); assert.equal(auth.status, 503);
  assert.doesNotMatch(await auth.text(), /PRIVATE_ERROR_CANARY/); assert.equal(failed.state.runs, 0);
  const missing = await harness(t, { run: () => { throw new Error("PRIVATE_RUNTIME_CANARY"); } });
  const res = await missing.request(); assert.equal(res.status, 503);
  assert.doesNotMatch(await res.text(), /PRIVATE_RUNTIME_CANARY/);
  const malformed = await harness(t, { run: () => ({ ...fixture, runtime: "mock" }) });
  assert.equal((await malformed.request()).status, 503);
});
test("a fourth run is blocked; concurrent execution is rejected and capacity is released", async t => {
  const budget = await harness(t);
  for (let i = 0; i < 3; i++) assert.equal((await budget.request()).status, 200);
  const capped = await budget.request(); assert.equal(capped.status, 429);
  assert.ok(Number(capped.headers.get("retry-after")) > 0); assert.equal(budget.state.runs, 3);
  let release;
  const h = await harness(t, { run: () => new Promise(resolve => { release = resolve; }) });
  const first = h.request();
  while (!release) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal((await h.request()).status, 429);
  release(fixture); assert.equal((await first).status, 200);
  assert.equal(h.state.signal.aborted, true);
});
test("disconnect propagates cancellation and does not retry", async t => {
  const h = await harness(t, { run: (_state, signal) => new Promise((_resolve, reject) => {
    signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
  }) });
  const controller = new AbortController(), pending = h.request({ consent: true }, { signal: controller.signal });
  while (!h.state.runs) await new Promise(resolve => setTimeout(resolve, 5));
  controller.abort(); await assert.rejects(pending);
  for (let i = 0; i < 30 && !h.state.signal.aborted; i++) await new Promise(resolve => setTimeout(resolve, 5));
  assert.equal(h.state.signal.aborted, true); assert.equal(h.state.runs, 1);
});
test("real local Hermes completes with no global fetch or model credentials", {
  skip: !existsSync(fileURLToPath(new URL("../../../generated-artifacts/hermes/runtime", import.meta.url))),
  timeout: 95000,
}, async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("External fetch must never run"); };
  try {
    const result = await runHermesLocalCheck(new AbortController().signal);
    assert.equal(result.status, "completed"); assert.equal(result.runtime, "hermes");
    assert.equal(result.provider, "local-mock"); assert.equal(result.externalModelRequests, 0);
    assert.equal(result.localProviderRequests, 1); assert.equal(result.toolCount, 0);
  } finally { globalThis.fetch = original; }
});

test("BG001 stays preview/operator-only with strict consent and no caller-supplied context", async t => {
  const prod = await harness(t, { env: { NODE_ENV: "production" } });
  assert.equal((await prod.request({ consent: true }, { bg001: true })).status, 404);
  assert.equal(prod.state.calls.length, 0);
  const h = await harness(t);
  assert.equal((await h.request({ consent: true }, { bg001: true, headers: { Authorization: "" } })).status, 401);
  h.state.role = false;
  assert.equal((await h.request({ consent: true }, { bg001: true })).status, 403);
  h.state.role = true;
  for (const body of [{ consent: false }, { consent: true, schemeCode: "BS019" }, { consent: true, context: "private" }])
    assert.equal((await h.request(body, { bg001: true })).status, 400);
  assert.equal(h.state.runs, 0);
});
test("BG001 verifies role twice and shares the three-run quota with the synthetic mode", async t => {
  const h = await harness(t);
  assert.equal((await h.request()).status, 200);
  const bg = await h.request({ consent: true }, { bg001: true });
  assert.equal(bg.status, 200); assert.deepEqual(await bg.json(), bgFixture);
  assert.equal(h.state.checks, 4);
  assert.equal((await h.request()).status, 200);
  assert.equal((await h.request({ consent: true }, { bg001: true })).status, 429);
  assert.equal(h.state.runs, 3);
  const denied = await harness(t, { runBg001: state => { state.role = false; return bgFixture; } });
  assert.equal((await denied.request({ consent: true }, { bg001: true })).status, 403);
});
test("BG001 preflight retains only the three canonical PDF sources and exact citations", () => {
  const built = buildBg001Fixture();
  assert.deepEqual(built.sources.map(source => [source.id, source.page]), [["KB09", 21], ["KB19", 17], ["KB44", 573]]);
  assert.match(built.context, /BG001/); assert.ok(built.context.length < 16000);
  assert.match(built.reply, /41011/); assert.match(built.reply, /pembongkaran/);
  assert.match(built.reply, /bukan keluaran AI/);
});
test("real Hermes receives the exact BG001 context and returns only the server-owned fixture without external fetch", {
  skip: !existsSync(fileURLToPath(new URL("../../../generated-artifacts/hermes/runtime", import.meta.url))),
  timeout: 95000,
}, async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("External fetch must never run"); };
  try {
    const value = await runHermesBg001Check(new AbortController().signal);
    assert.equal(value.schemeCode, "BG001"); assert.equal(value.contextVerified, true);
    assert.equal(value.citationsVerified, true); assert.equal(value.externalModelRequests, 0);
    assert.equal(value.localProviderRequests, 1);
    assert.deepEqual(value.sources.map(source => [source.id, source.page]), [["KB09", 21], ["KB19", 17], ["KB44", 573]]);
    await assert.rejects(runHermesSchemeFixture({ question: "test", context: "x".repeat(16000), reply: "test" }, new AbortController().signal));
  } finally { globalThis.fetch = original; }
});

test("paid chat is preview/operator-only; exact consent/question contract rejects model/history/document injections", async t => {
  const prod = await harness(t, { env: { NODE_ENV: "production" } });
  const input = { consent: true, question: "Bagaimana ruang lingkup BG001?" };
  assert.equal((await prod.request(input, { chat: true })).status, 404);
  assert.equal(prod.state.calls.length, 0);
  const h = await harness(t);
  assert.equal((await h.request(input, { chat: true, headers: { Authorization: "" } })).status, 401);
  h.state.role = false;
  assert.equal((await h.request(input, { chat: true })).status, 403);
  h.state.role = true;
  for (const body of [{ ...input, consent: false }, { consent: true }, { ...input, question: "     " },
    { ...input, question: "a".repeat(1001) }, { ...input, model: "fake" }, { ...input, history: [] },
    { ...input, documents: [] }, { ...input, schemeCode: "BS019" }])
    assert.equal((await h.request(body, { chat: true })).status, 400);
  assert.equal(h.state.runs, 0);
  const success = await h.request(input, { chat: true });
  assert.equal(success.status, 200); assert.deepEqual(await success.json(), chatFixture);
  assert.equal(h.state.question, input.question);
});
test("paid chat shares budget, checks permission after execution, and returns sanitized 402 without retry", async t => {
  const input = { consent: true, question: "Jelaskan BG001" };
  const h = await harness(t);
  assert.equal((await h.request()).status, 200);
  assert.equal((await h.request({ consent: true }, { bg001: true })).status, 200);
  assert.equal((await h.request(input, { chat: true })).status, 200);
  assert.equal((await h.request(input, { chat: true })).status, 429);
  const lost = await harness(t, { runChat: state => { state.role = false; return chatFixture; } });
  assert.equal((await lost.request(input, { chat: true })).status, 403);
  const billed = await harness(t, { runChat: () => { throw new HermesBillingError(); } });
  assert.equal((await billed.request(input, { chat: true })).status, 402);
  assert.equal(billed.state.runs, 1);
  const timed = await harness(t, { runChat: () => { throw new PilotError(504, "pilot_timeout", "PRIVATE_TIMEOUT_CANARY"); } });
  const timeout = await timed.request(input, { chat: true });
  assert.equal(timeout.status, 504); assert.doesNotMatch(await timeout.text(), /PRIVATE_TIMEOUT_CANARY/);
});
test("Claude answer validation checks exact source/page links and permits explicit insufficient-evidence replies", () => {
  const refs = buildBg001Fixture().sources;
  const good = { answer: chatFixture.answer, insufficientEvidence: false, evidence: [{ id: "KB09", page: 21 }] };
  assert.equal(verifyBg001Answer(JSON.stringify(good), refs).sources.length, 1);
  assert.equal(verifyBg001Answer(JSON.stringify({ answer: "Rujukan tidak cukup.", insufficientEvidence: true, evidence: [] }), refs).sources.length, 0);
  for (const body of [{ ...good, evidence: [] }, { ...good, evidence: [{ id: "KB09", page: 22 }] },
    { ...good, answer: "Rekaan [KB99, halaman PDF 1]" }, { ...good, answer: "Tanpa kutipan" },
    { ...good, answer: "[KB09, hlm. 21]" }, { ...good, extra: "not allowed" },
    { ...good, evidence: [good.evidence[0], good.evidence[0]] }])
    assert.throws(() => verifyBg001Answer(JSON.stringify(body), refs));
  assert.throws(() => verifyBg001Answer("```json\n{}\n```", refs));
});
test("real Hermes live path uses one MOCKED Claude request with only the submitted question and public references", {
  skip: !existsSync(fileURLToPath(new URL("../../../generated-artifacts/hermes/runtime", import.meta.url))), timeout: 95000,
}, async () => {
  let calls = 0;
  const env = { OPENROUTER_API_KEY: "synthetic-provider-not-production", AI_CLAUDE_MODEL: "anthropic/claude-test",
    SESSION_SECRET: "PRIVATE_SESSION_CANARY", SUPABASE_SERVICE_ROLE_KEY: "PRIVATE_SERVICE_CANARY" };
  const mock = async (url, init) => {
    calls++; assert.equal(String(url), "https://openrouter.ai/api/v1/chat/completions");
    const body = JSON.parse(init.body);
    assert.equal(body.model, env.AI_CLAUDE_MODEL); assert.equal(body.provider.allow_fallbacks, false);
    assert.equal(body.messages.length, 2); assert.equal(init.redirect, "error");
    const packet = JSON.parse(body.messages[1].content);
    assert.equal(packet.question, "Jelaskan pembongkaran pada BG001");
    assert.equal(packet.scheme_code, "BG001");
    const references = JSON.parse(packet.referenceContext);
    assert.deepEqual(references.sources.map(ref => [ref.id, ref.page]), [["KB09", 21], ["KB19", 17], ["KB44", 573]]);
    assert.doesNotMatch(init.body, /PRIVATE_SESSION_CANARY|PRIVATE_SERVICE_CANARY|Hermes Agent|surat_pernyataan/);
    return Response.json({ model: env.AI_CLAUDE_MODEL, choices: [{ finish_reason: "stop", message: {
      content: JSON.stringify({ answer: chatFixture.answer, insufficientEvidence: false, evidence: [{ id: "KB09", page: 21 }] }),
    } }] });
  };
  const saved = globalThis.fetch; globalThis.fetch = async () => { throw new Error("Real network forbidden"); };
  try {
    const output = await runHermesBg001Chat("Jelaskan pembongkaran pada BG001", env, new AbortController().signal, mock);
    assert.equal(calls, 1); assert.equal(output.contextVerified, true);
    assert.equal(output.provider, "openrouter-claude"); assert.equal(output.sources.length, 1);
    assert.equal(output.answer, chatFixture.answer);
  } finally { globalThis.fetch = saved; }
});
test("real Hermes propagates MOCKED provider 402 without a second request or fallback", {
  skip: !existsSync(fileURLToPath(new URL("../../../generated-artifacts/hermes/runtime", import.meta.url))), timeout: 95000,
}, async () => {
  let calls = 0;
  await assert.rejects(runHermesBg001Chat("Jelaskan BG001", {
    OPENROUTER_API_KEY: "synthetic-provider-not-production", AI_CLAUDE_MODEL: "anthropic/claude-test",
  }, new AbortController().signal, async () => {
    calls++; return Response.json({ error: "DO_NOT_EXPOSE_PROVIDER_DETAILS" }, { status: 402 });
  }), error => error.status === 402 && !error.message.includes("DO_NOT_EXPOSE"));
  assert.equal(calls, 1);
});
