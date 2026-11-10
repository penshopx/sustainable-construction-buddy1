import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import express from "express";

// Real routes, schemas, store ownership helpers and job orchestration; no live
// accounts, private files, database or paid inference are used by this suite.
const memory = new Map();
const blobs = new Map();
let workerCalls = 0, releaseJob;
let workerResult = "SERTIFIKAT SINTETIS\nNomor UJI-7319\nNilai Rp 815 juta";
let workerFailure = false;
let workerOptions;
let workerPages;
let busy = false;
globalThis.__vaultOcrTest = {
  memory, blobs,
  async worker(_bytes, _type, _key, options) {
    workerCalls++;
    workerOptions = options;
    await new Promise(resolve => { releaseJob = resolve; });
    if (workerFailure) throw new Error("secret upstream details");
    if (workerPages) options?.onPages?.(workerPages);
    return workerResult;
  },
  reserve() { if (busy) { const e = new Error("busy"); e.status = 429; throw e; } return () => {}; },
};
const root = fileURLToPath(new URL("..", import.meta.url));
const bundle = await build({
  stdin: { contents: `
    export { vaultRouter } from "./src/routes/vault";
    export { requestOcr } from "./src/lib/vault-ocr-provider";
    export { initialWorkspace, publicWorkspace } from "./src/lib/vault-store";
  `, resolveDir: root, loader: "ts" },
  bundle: true, platform: "node", format: "cjs", write: false,
  plugins: [{
    name: "isolated-vault-boundaries",
    setup(b) {
      b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "db", namespace: "fake" }));
      b.onLoad({ filter: /.*/, namespace: "fake" }, () => ({ contents: `
        const memory = globalThis.__vaultOcrTest.memory;
        export const pool = { async connect() { return {
          async query(sql, args) {
            if (sql.startsWith("INSERT") && !memory.has(args[0])) memory.set(args[0], JSON.parse(args[1]));
            if (sql.startsWith("SELECT state")) return { rows: [{ state: structuredClone(memory.get(args[0])) }] };
            if (sql.startsWith("UPDATE")) memory.set(args[0], JSON.parse(args[1]));
            return { rows: [] };
          }, release() {}
        }; } };
      ` }));
      b.onLoad({ filter: /vault-pub-auth\.ts$/ }, () => ({ contents: `
        import { fail } from "./vault-errors";
        export function vaultPubMiddleware(req, res, next) {
          const token = req.get("authorization");
          if (!["Bearer account-A", "Bearer account-B"].includes(token)) { try { fail(401, "Login required"); } catch (e) { next(e); } return; }
          res.locals.vaultOwner = token.slice(7); next();
        }
        export const pubAuthorization = req => req.get("authorization");
        export const openPubSession = (_req, res) => res.sendStatus(401);
        export const closePubSession = (_req, res) => res.sendStatus(204);
      `, resolveDir: `${root}/src/lib` }));
      b.onLoad({ filter: /vault-company-names\.ts$/ }, () => ({ contents: "export async function visibleCompanyNames() { return {}; }" }));
      b.onLoad({ filter: /logger\.ts$/ }, () => ({ contents: "export const logger = { warn() {} };" }));
      b.onLoad({ filter: /vault-files\.ts$/, namespace: "file" }, () => ({ contents: `
        import { Readable } from "node:stream";
        import { fail } from "./vault-errors";
        export { validateFile } from "./vault-test-validation-placeholder";
        export const reserveExtractionWorker = () => { try { return globalThis.__vaultOcrTest.reserve(); } catch(e) { fail(e.status, "busy"); } };
        export const runExtractionWorker = (...args) => globalThis.__vaultOcrTest.worker(...args);
        export const extractText = async () => "";
        export const objectPath = owner => "/private/" + owner + "/synthetic";
        export function privateFile(path) {
          return {
            async save(bytes) { globalThis.__vaultOcrTest.blobs.set(path, bytes); },
            createReadStream() { return Readable.from([globalThis.__vaultOcrTest.blobs.get(path)]); },
            async exists() { return [globalThis.__vaultOcrTest.blobs.has(path)]; },
            async delete() { globalThis.__vaultOcrTest.blobs.delete(path); },
          };
        }
      `, resolveDir: `${root}/src/lib` }));
      b.onResolve({ filter: /vault-test-validation-placeholder$/ }, () => ({ path: `${root}/src/lib/vault-files.ts`, namespace: "actual-validation" }));
      b.onLoad({ filter: /.*/, namespace: "actual-validation" }, async () => {
        // Keep the real format/size validator, but don't instantiate App Storage.
        const { readFile } = await import("node:fs/promises");
        const code = await readFile(`${root}/src/lib/vault-files.ts`, "utf8");
        return { contents: 'import { fail } from "./vault-errors";\n' + code.slice(code.indexOf("const formats:"), code.indexOf("let extractionCount")), loader: "ts", resolveDir: `${root}/src/lib` };
      });
    },
  }],
});
const compiled = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const { vaultRouter, requestOcr, initialWorkspace, publicWorkspace } = compiled.exports;
const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.log = { warn() {} }; next(); });
app.use("/api/ruang-simpan", vaultRouter);
const server = app.listen(0, "127.0.0.1");
await new Promise(resolve => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}/api/ruang-simpan`;
const keyBefore = process.env.OPENROUTER_API_KEY;
process.env.OPENROUTER_API_KEY = "synthetic-test-key";
const consent = { consent: true, provider: "openrouter-anthropic-v1" };
const realFetch = globalThis.fetch;
let sentSources;
globalThis.fetch = async (url, init) => {
  if (String(url).startsWith("https://openrouter.ai/")) {
    sentSources = JSON.parse(JSON.parse(init.body).messages[1].content).kutipan;
    return Response.json({ model: "anthropic/claude-sonnet-4.5", choices: [{ message: { content: "Nilai Rp 815 juta [1]." } }] });
  }
  return realFetch(url, init);
};
test.after(() => {
  server.close();
  globalThis.fetch = realFetch;
  if (keyBefore === undefined) delete process.env.OPENROUTER_API_KEY;
  else process.env.OPENROUTER_API_KEY = keyBefore;
  delete globalThis.__vaultOcrTest;
});
const api = (path, method = "GET", body, account = "A") => realFetch(base + path, {
  method, headers: { Authorization: `Bearer account-${account}`, ...(body ? { "Content-Type": "application/json" } : {}) },
  ...(body ? { body: JSON.stringify(body) } : {}),
});
async function waitForJob(id) {
  for (let i = 0; i < 100; i++) {
    const d = memory.get("account-A").documents.find(d => d.id === id);
    if (!d || d.status !== "processing") return d;
    await new Promise(r => setTimeout(r, 5));
  }
  assert.fail("OCR job did not settle");
}
async function finish() {
  for (let i = 0; !releaseJob && i < 100; i++) await new Promise(r => setTimeout(r, 5));
  assert.ok(releaseJob);
  releaseJob(); releaseJob = undefined;
}

test("two owner identities: consent, processing, persistence, search evidence and chat source privacy", async () => {
  memory.set("account-A", initialWorkspace()); memory.set("account-B", initialWorkspace());
  // A valid tiny synthetic PNG is enough for the storage/ownership path. The
  // provider transcription is a fixture, not a claim of measured OCR accuracy.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=", "base64");
  const upload = await realFetch(base + "/documents?name=synthetic.png&folderId=default-0", {
    method: "POST", headers: { Authorization: "Bearer account-A", "Content-Type": "application/octet-stream" }, body: png,
  });
  assert.equal(upload.status, 200);
  const doc = await upload.json();
  assert.equal(doc.status, "stored"); assert.equal(workerCalls, 0);
  const path = `/documents/${doc.id}/ocr`;
  for (const body of [{}, { consent: false, provider: consent.provider }, { consent: true, provider: "other" }]) {
    assert.equal((await api(path, "POST", body)).status, 400);
  }
  assert.equal(workerCalls, 0);
  assert.equal((await api(path, "POST", consent, "B")).status, 404);
  assert.equal((await api(`/documents/${doc.id}/download`, "GET", undefined, "B")).status, 404);
  assert.deepEqual((await (await api("/workspace", "GET", undefined, "B")).json()).documents, []);
  const accepted = await api(path, "POST", { ...consent, owner: "account-B" });
  assert.equal(accepted.status, 202);
  const processing = await accepted.json();
  assert.equal(processing.status, "processing");
  assert.equal(processing.text, "");
  assert.equal(processing.objectPath, undefined); assert.equal(processing.ocrJob, undefined);
  assert.equal((await api(path, "POST", consent)).status, 409);
  assert.equal((await api("/questions", "POST", { question: "Nilai kontrak?", consent: true, documentIds: [doc.id] })).status, 400);
  await finish();
  const ready = await waitForJob(doc.id);
  assert.equal(ready.status, "ready");
  const ws = await (await api("/workspace")).json();
  assert.ok(ws.documents[0].text.includes("UJI-7319")); // same text used by portal search
  assert.equal(ws.usedBytes, png.length);
  assert.ok(ws.activities.some(a => a.action.includes("Persetujuan OCR")));
  assert.ok(ws.activities.some(a => a.action.includes("teks tersimpan")));
  const answer = await api("/questions", "POST", { question: "Berapa nilai?", consent: true, documentIds: [doc.id] });
  assert.equal(answer.status, 200);
  const reply = await answer.json();
  assert.equal(reply.sources[0].id, doc.id);
  assert.ok(reply.sources[0].quote.includes("815 juta"));
  assert.equal(sentSources[0].kutipan, reply.sources[0].quote);
  assert.equal((await api("/questions", "POST", { question: "UJI-7319", consent: true, documentIds: [doc.id] }, "B")).status, 400);
  assert.equal((await api(path, "POST", consent)).status, 409);
  assert.ok(!JSON.stringify(publicWorkspace(memory.get("account-A"))).includes("ocrJob"));
});

test("failure, retry, cooldown, full worker pool, interrupted job and deletion never become falsely ready", async () => {
  const state = memory.get("account-A");
  const original = state.documents[0];
  state.documents.push({ ...original, id: "failure", status: "stored", text: "", ocrAttemptedAt: undefined });
  const path = "/documents/failure/ocr";
  busy = true;
  assert.equal((await api(path, "POST", consent)).status, 429);
  busy = false; workerFailure = true;
  assert.equal((await api(path, "POST", consent)).status, 202);
  await finish();
  let failed = await waitForJob("failure");
  assert.equal(failed.status, "failed");
  assert.equal(failed.text, "");
  assert.ok(failed.ocrError.includes("OCR gagal"));
  assert.ok(!failed.ocrError.includes("secret"));
  assert.equal((await api(path, "POST", consent)).status, 429);
  memory.get("account-A").documents.find(d => d.id === "failure").ocrAttemptedAt = new Date(Date.now() - 61_000).toISOString();
  workerFailure = false; workerResult = "";
  assert.equal((await api(path, "POST", consent)).status, 202);
  await finish();
  failed = await waitForJob("failure");
  assert.equal(failed.status, "failed"); assert.ok(failed.ocrError.includes("Tidak ada teks"));
  const current = memory.get("account-A").documents.find(d => d.id === "failure");
  current.status = "processing"; current.ocrJob = "interrupted";
  current.ocrAttemptedAt = new Date(Date.now() - 121_000).toISOString();
  const workspace = await (await api("/workspace")).json();
  assert.equal(workspace.documents.find(d => d.id === "failure").status, "failed");
  workerResult = "text after delete";
  assert.equal((await api(path, "POST", consent)).status, 202);
  assert.equal((await api("/documents/failure", "DELETE")).status, 204);
  await finish();
  await new Promise(r => setTimeout(r, 20));
  assert.ok(!memory.get("account-A").documents.some(d => d.id === "failure"));
});

test("PDF range is consent-bound, owner-isolated, audited and cited using original page numbers", async () => {
  const state = memory.get("account-A");
  const original = state.documents[0];
  blobs.set(original.objectPath, Buffer.alloc(original.size));
  state.documents.push({ ...original, id: "pdf-range", name: "long.pdf", type: "PDF", status: "stored", text: "", ocrAttemptedAt: undefined });
  const path = "/documents/pdf-range/ocr";
  const calls = workerCalls;
  for (const pageRange of [undefined, { start: 0, end: 1 }, { start: 8, end: 7 }, { start: 1, end: 31 }, { start: 1.2, end: 2 }]) {
    assert.equal((await api(path, "POST", { ...consent, pageRange })).status, 400);
  }
  assert.equal(workerCalls, calls);
  assert.equal((await api(path, "POST", { ...consent, pageRange: { start: 51, end: 52 } }, "B")).status, 404);
  const used = (await (await api("/workspace")).json()).usedBytes;
  workerResult = "KONTRAK UJI HALAMAN LIMA PULUH SATU\n\nIZIN UJI HALAMAN LIMA PULUH DUA";
  const split = workerResult.indexOf("\n\n");
  workerPages = [{ page: 51, start: 0, end: split }, { page: 52, start: split + 2, end: workerResult.length }];
  assert.equal((await api(path, "POST", { ...consent, pageRange: { start: 51, end: 52 } })).status, 202);
  await finish();
  const doc = await waitForJob("pdf-range");
  assert.equal(doc.status, "ready");
  assert.deepEqual(workerOptions.pageRange, { start: 51, end: 52 });
  assert.deepEqual(doc.ocrPages, workerPages);
  workerPages = undefined;
  const ws = await (await api("/workspace")).json();
  assert.equal(ws.usedBytes, used);
  assert.ok(ws.activities.some(a => a.action.includes("Persetujuan OCR") && a.action.includes("51–52")));
  assert.ok(ws.activities.some(a => a.action.includes("teks tersimpan") && a.action.includes("51–52")));
  const reply = await (await api("/questions", "POST", { question: "kontrak izin", consent: true, documentIds: ["pdf-range"] })).json();
  assert.equal(reply.sources.length, 2);
  assert.ok(reply.sources.some(s => s.name.endsWith("halaman 51") && s.quote.startsWith("KONTRAK") && !s.quote.includes("IZIN")));
  assert.ok(reply.sources.some(s => s.name.endsWith("halaman 52") && s.quote.startsWith("IZIN") && !s.quote.includes("KONTRAK")));
  assert.equal((await api("/questions", "POST", { question: "izin", consent: true, documentIds: ["pdf-range"] }, "B")).status, 400);
});

test("provider payload uses private inline bytes, explicit native PDF and pinned provider without fallbacks", async () => {
  for (const type of ["PNG", "JPG", "PDF"]) {
    let calls = 0;
    const text = await requestOcr(Buffer.from("synthetic-only"), type, "test-only", async (url, init) => {
      calls++;
      assert.equal(url, "https://openrouter.ai/api/v1/chat/completions");
      assert.equal(init.redirect, "error");
      const body = JSON.parse(init.body);
      assert.deepEqual(body.provider, { only: ["Anthropic"], allow_fallbacks: false, data_collection: "deny" });
      assert.equal(body.max_tokens, 12000);
      const part = body.messages[1].content[1];
      if (type === "PDF") {
        assert.equal(body.plugins[0].pdf.engine, "native");
        assert.ok(part.file.file_data.startsWith("data:application/pdf;base64,"));
      } else assert.ok(part.image_url.url.startsWith("data:image/"));
      return Response.json({ model: body.model, choices: [{ finish_reason: "stop", message: { content: " UJI-7319\0 " } }] });
    });
    assert.equal(text, "UJI-7319"); assert.equal(calls, 1);
  }
});

test("provider rejects partial, wrong-model, oversized, malformed and failed responses without retry", async () => {
  const valid = { model: "anthropic/claude-sonnet-4.5", choices: [{ finish_reason: "stop", message: { content: "sample" } }] };
  for (const response of [
    Response.json({ ...valid, model: "other" }),
    Response.json({ ...valid, choices: [{ finish_reason: "length", message: { content: "partial" } }] }),
    new Response("invalid json"),
    new Response("secret error", { status: 402 }),
    new Response("x".repeat(1024 * 1024 + 1)),
    Response.json({ ...valid, choices: [{ finish_reason: "stop", message: { content: "x".repeat(100_001) } }] }),
  ]) {
    let calls = 0;
    await assert.rejects(requestOcr(Buffer.from("synthetic"), "PNG", "test", async () => { calls++; return response; }));
    assert.equal(calls, 1);
  }
});
