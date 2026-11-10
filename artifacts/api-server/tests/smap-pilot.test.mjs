import { test } from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import express from "express";
import { existsSync } from "node:fs";

const bundle = await build({
  stdin: { contents: `export {createSmapPilotRouter} from "./src/routes/smap-pilot";
    export {runSmapPilot,pilotAnswer} from "./src/lib/smap-pilot-runtime";
    export {toPilotDocument,pilotJson} from "./src/lib/smap-pilot-data";`,
    resolveDir: fileURLToPath(new URL("..", import.meta.url)), loader: "ts" },
  bundle: true, platform: "node", format: "cjs", external: ["express"], write: false,
});
const compiled = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(
  createRequire(import.meta.url), compiled, compiled.exports);
const { createSmapPilotRouter, runSmapPilot, pilotAnswer, toPilotDocument, pilotJson } = compiled.exports;
const OWNER = "11111111-1111-4111-8111-111111111111";
const ID = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
const ENV = { NODE_ENV: "development", SUPABASE_URL: "https://fixture.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "fixture-public", OPENROUTER_API_KEY: "fixture-not-a-real-key",
  AI_CLAUDE_MODEL: "anthropic/claude-fixture" };
const ROW = { id: ID, user_id: OWNER, doc_type: "surat_pernyataan",
  company_name: "PRIVATE_COMPANY", document_number: "PRIVATE_NUMBER",
  signatory_name: "PRIVATE_PERSON", file_name: "PRIVATE_FILENAME",
  file_url: "PRIVATE_SIGNED_URL", notes: "PRIVATE_NOTES" };
const INPUT = { documentIds: [ID], consent: "smap-presence-v1" };
const REPLY = { analysis: "Lengkapi indikator yang belum terisi.", model: ENV.AI_CLAUDE_MODEL,
  documentCount: 1, runtime: "hermes", dataScope: "presence-only" };

async function harness(t, options = {}) {
  const calls = [], runs = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url: String(url), init });
    return Response.json(String(url).includes("/auth/v1/user") ? { id: OWNER } : options.rows ?? [ROW]);
  };
  const app = express();
  app.use(express.json());
  app.use(createSmapPilotRouter({
    env: { ...ENV, ...options.env }, fetchImpl,
    ready: options.ready ?? (async () => {}),
    run: async (...args) => { runs.push(args); return options.run ? options.run(...args) : REPLY; },
  }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}`;
  const request = (body = INPUT, auth = true) => fetch(base + "/smap/pilot/analyze", {
    method: "POST", headers: { "Content-Type": "application/json",
      ...(auth ? { Authorization: `Bearer ${"m".repeat(30)}` } : {}) }, body: JSON.stringify(body),
  });
  return { request, calls, runs, base };
}

test("pilot is closed in production and to anonymous requests before any data or AI access", async t => {
  const prod = await harness(t, { env: { NODE_ENV: "production" } });
  assert.equal((await prod.request()).status, 404);
  assert.equal(prod.calls.length, 0);
  const anon = await harness(t);
  assert.equal((await anon.request(INPUT, false)).status, 401);
  assert.equal(anon.calls.length, 0);
});

test("consent, selection bounds, unique IDs and strict input are enforced before document access", async t => {
  const h = await harness(t);
  for (const body of [
    { documentIds: [ID] }, { ...INPUT, consent: "yes" }, { ...INPUT, documentIds: [] },
    { ...INPUT, documentIds: [ID, ID] }, { ...INPUT, documentIds: ["not-a-uuid"] },
    { ...INPUT, metadata: { company_name: "injected" } },
  ]) assert.equal((await h.request(body)).status, 400);
  assert.equal(h.runs.length, 0);
  assert.ok(h.calls.every(call => call.url.includes("/auth/v1/user")));
});

test("list and analysis expose only indicators and use member JWT plus explicit ownership filters", async t => {
  const h = await harness(t);
  const list = await fetch(h.base + "/smap/pilot/documents", {
    headers: { Authorization: `Bearer ${"m".repeat(30)}` },
  });
  assert.equal(list.status, 200);
  assert.equal(list.headers.get("cache-control"), "no-store");
  assert.doesNotMatch(JSON.stringify(await list.json()), /PRIVATE_|user_id/);
  const response = await h.request();
  assert.equal(response.status, 200);
  const args = h.runs[0];
  assert.doesNotMatch(JSON.stringify(args[0]), /PRIVATE_|user_id/);
  const read = h.calls.find(call => call.url.includes("/rest/"));
  const url = new URL(read.url);
  assert.equal(url.searchParams.get("user_id"), `eq.${OWNER}`);
  assert.equal(read.init.headers.apikey, "fixture-public");
  assert.match(read.init.headers.Authorization, /^Bearer m+/);
  assert.doesNotMatch(url.searchParams.get("select"), /file_url|notes|verified/);
});

test("missing, foreign-owned and unexpected documents never reach the worker", async t => {
  for (const rows of [[], [{ ...ROW, user_id: OTHER }], [{ ...ROW, id: OTHER }]]) {
    const h = await harness(t, { rows });
    assert.notEqual((await h.request()).status, 200);
    assert.equal(h.runs.length, 0);
  }
});

test("missing runtime fails explicitly and does not fall back to a plain model call", async t => {
  const h = await harness(t, { ready: async () => { throw new Error("PRIVATE_RUNTIME_DETAIL"); } });
  const response = await h.request();
  assert.equal(response.status, 503);
  assert.doesNotMatch(JSON.stringify(await response.json()), /PRIVATE_RUNTIME/);
  assert.equal(h.runs.length, 0);
  assert.equal(h.calls.length, 1);
});

test("per-member analysis budget prevents a fourth execution", async t => {
  const h = await harness(t);
  for (let i = 0; i < 3; i++) assert.equal((await h.request()).status, 200);
  const rejected = await h.request();
  assert.equal(rejected.status, 429);
  assert.ok(Number(rejected.headers.get("retry-after")) > 0);
  assert.equal(h.runs.length, 3);
});

test("concurrency gate blocks a second job and releases after completion", async t => {
  let release;
  const h = await harness(t, { run: () => new Promise(resolve => { release = () => resolve(REPLY); }) });
  const first = h.request();
  while (!release) await new Promise(resolve => setImmediate(resolve));
  assert.equal((await h.request()).status, 429);
  release();
  assert.equal((await first).status, 200);
  assert.equal(h.runs.length, 1);
});

test("disconnect cancels the runner and releases capacity without retrying", { timeout: 5000 }, async t => {
  let started, cancelled, attempts = 0;
  const start = new Promise(resolve => { started = resolve; });
  const cancel = new Promise(resolve => { cancelled = resolve; });
  const h = await harness(t, { run: (_docs, _env, signal) => {
    if (++attempts > 1) return REPLY;
    started();
    return new Promise((_resolve, reject) => signal.addEventListener("abort", () => {
      cancelled(); reject(new Error("cancelled"));
    }, { once: true }));
  } });
  const controller = new AbortController();
  const pending = fetch(h.base + "/smap/pilot/analyze", {
    method: "POST", signal: controller.signal,
    headers: { Authorization: `Bearer ${"m".repeat(30)}`, "Content-Type": "application/json" },
    body: JSON.stringify(INPUT),
  });
  await start;
  controller.abort();
  await assert.rejects(pending, error => error.name === "AbortError");
  await cancel;
  assert.equal(attempts, 1);
  assert.equal((await h.request()).status, 200);
});

test("model mismatch, truncated output, missing text and oversized replies fail closed", () => {
  const valid = { model: ENV.AI_CLAUDE_MODEL, choices: [{ finish_reason: "stop", message: { content: "Draf." } }] };
  assert.equal(pilotAnswer(valid, ENV.AI_CLAUDE_MODEL), "Draf.");
  for (const value of [
    null, {}, { ...valid, model: "different/model" }, { ...valid, choices: [] },
    { ...valid, choices: [{ finish_reason: "length", message: { content: "Draf terpotong." } }] },
    { ...valid, choices: [{ finish_reason: "stop", message: { content: "" } }] },
    { ...valid, choices: [{ finish_reason: "stop", message: { content: "a".repeat(12001) } }] },
  ]) assert.throws(() => pilotAnswer(value, ENV.AI_CLAUDE_MODEL), error => error.code === "pilot_unavailable");
});

test("streamed database/provider JSON is bounded before parsing and oversized streams are cancelled", async () => {
  assert.deepEqual(await pilotJson(Response.json({ ok: true }), 100), { ok: true });
  let cancelled = false;
  const response = new Response(new ReadableStream({
    pull(controller) { controller.enqueue(new Uint8Array(16)); },
    cancel() { cancelled = true; },
  }));
  await assert.rejects(pilotJson(response, 20), error => error.code === "pilot_unavailable");
  assert.equal(cancelled, true);
});

test("real Hermes worker uses one mocked provider call, with no raw values, IDs or SDK context sent upstream",
  { skip: !existsSync(fileURLToPath(new URL("../../../generated-artifacts/hermes/runtime", import.meta.url))) },
  async () => {
    const calls = [];
    const result = await runSmapPilot([toPilotDocument(ROW)], ENV, new AbortController().signal, async (url, init) => {
      calls.push({ url, init });
      return Response.json({ model: ENV.AI_CLAUDE_MODEL,
        choices: [{ finish_reason: "stop", message: { content: REPLY.analysis } }] });
    });
    assert.equal(result.analysis, REPLY.analysis);
    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "https://openrouter.ai/api/v1/chat/completions");
    const body = JSON.parse(calls[0].init.body);
    assert.equal(body.model, ENV.AI_CLAUDE_MODEL);
    assert.deepEqual(body.provider, { allow_fallbacks: false, data_collection: "deny" });
    assert.doesNotMatch(JSON.stringify(body), /PRIVATE_|11111111|22222222|capability|127\.0\.0\.1|nix\/store/);
    assert.equal(JSON.parse(body.messages[1].content)[0].checks[0].complete, true);
  });
