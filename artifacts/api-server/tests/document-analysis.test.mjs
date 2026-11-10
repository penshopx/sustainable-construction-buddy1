import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { build } from "esbuild";

const require = createRequire(import.meta.url);
const bundled = await build({
  stdin: {
    contents: `export * from "./src/lib/document-analysis";
      export { documentAnalysisRouter } from "./src/routes/document-analysis";`,
    resolveDir: new URL("..", import.meta.url).pathname, loader: "ts",
  },
  bundle: true, platform: "node", format: "cjs", write: false,
  plugins: [{
    name: "private-workspace-fixtures",
    setup(b) {
      b.onResolve({ filter: /\/vault-store$/ }, () => ({ path: "store", namespace: "fixture" }));
      b.onResolve({ filter: /\/vault-ai$/ }, () => ({ path: "ai", namespace: "fixture" }));
      b.onLoad({ filter: /.*/, namespace: "fixture" }, ({ path }) => ({
        contents: path === "ai"
          ? `export const requestVaultAnswer=(...args)=>globalThis.__bedahFixture.ai(...args);`
          : `export class VaultError extends Error { constructor(status,message){super(message);this.status=status;} }
             export function fail(status,message){throw new VaultError(status,message);}
             export const workspace=(...args)=>globalThis.__bedahFixture.workspace(...args);
             export const ownDocument=(state,id)=>state.documents.find(d=>d.id===id)??fail(404,"Dokumen tidak ditemukan.");
             export const activity=(state,message)=>state.activities.push(message);`,
        loader: "js",
      }));
    },
  }],
});
const mod = { exports: {} };
new Function("require", "module", "exports", bundled.outputFiles[0].text)(require, mod, mod.exports);
const service = mod.exports;
const express = require("express");

function result() {
  return {
    category: "Kontrak", summary: "Kontrak memuat masa pelaksanaan dan jaminan.",
    checklist: [{ item: "Masa pelaksanaan", status: "ada", evidence: "Masa pelaksanaan 90 hari." }],
    risks: [{ title: "Denda", severity: "sedang", evidence: "Denda keterlambatan 1 permil per hari.",
      recommendation: "Periksa dasar dan batas maksimal denda." }],
    regulations: [{ title: "UU 2 Tahun 2017", evidence: "UU 2 Tahun 2017", note: "Verifikasi ke sumber resmi." }],
  };
}

function fixture() {
  const id = randomUUID();
  const doc = { id, name: "kontrak-uji.txt", status: "ready", type: "TXT",
    text: "Masa pelaksanaan 90 hari.\nDenda keterlambatan 1 permil per hari.\nUU 2 Tahun 2017",
    objectPath: "DO-NOT-EXPOSE", size: 100, createdAt: new Date().toISOString(),
    extraction: { complete: true, note: "Seluruh teks file tersedia." },
    folderId: "default-6", starred: false };
  const states = new Map([["owner", { documents: [doc], activities: [] }],
    ["other", { documents: [], activities: [] }], ["admin", { documents: [], activities: [] }]]);
  const calls = [];
  const h = {
    id, states, doc, calls,
    async workspace(owner, action) {
      const state = structuredClone(states.get(owner));
      const value = await action(state);
      states.set(owner, state);
      return value;
    },
    async ai(...args) { calls.push(args); return JSON.stringify(result()); },
  };
  globalThis.__bedahFixture = h;
  return h;
}

async function api(t, h) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    const owner = req.get("authorization")?.replace("Bearer ", "");
    if (!h.states.has(owner)) return res.status(401).json({ error: "Login required" });
    res.locals.vaultOwner = owner;
    next();
  });
  app.use("/bedah", service.documentAnalysisRouter);
  app.use((err, _req, res, _next) => res.status(err.status || (err.issues ? 400 : 500)).json({ error: err.message }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); delete globalThis.__bedahFixture; });
  return (path = "", owner = "owner", method = "GET", data) =>
    fetch(`http://127.0.0.1:${server.address().port}/bedah${path}`, {
      method, headers: { Authorization: `Bearer ${owner}`, "Content-Type": "application/json" },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
}

test("HTTP requires explicit consent and valid identity before AI/storage changes", async t => {
  const h = fixture(), request = await api(t, h);
  for (const consent of [false, undefined, "true"]) {
    const response = await request("", "owner", "POST", { documentId: h.id, consent });
    assert.equal(response.status, 400);
  }
  assert.equal((await request("", "anonymous")).status, 401);
  assert.equal(h.calls.length, 0);
  assert.equal(h.states.get("owner").documentAnalyses, undefined);
});

test("analysis persists, replays safely and never leaks into another member/admin list", async t => {
  const h = fixture(), request = await api(t, h);
  const response = await request("", "owner", "POST", { documentId: h.id, consent: true });
  assert.equal(response.status, 200);
  const analysis = await response.json();
  assert.equal(analysis.documentId, h.id);
  assert.equal(analysis.result.category, "Kontrak");
  assert.equal(analysis.truncated, false);
  assert.equal(analysis.model, "anthropic/claude-sonnet-4.5");
  assert.ok(!("sourceHash" in analysis));
  assert.ok(!JSON.stringify(analysis).includes("DO-NOT-EXPOSE"));
  const replay = await request("", "owner", "POST", { documentId: h.id, consent: true });
  assert.deepEqual(await replay.json(), analysis);
  assert.equal(h.calls.length, 1);
  assert.deepEqual(await (await request()).json(), [analysis]);
  for (const actor of ["other", "admin"]) {
    assert.deepEqual(await (await request("", actor)).json(), []);
    assert.equal((await request("", actor, "POST", { documentId: h.id, consent: true })).status, 404);
    assert.equal((await request(`/${analysis.id}`, actor, "DELETE")).status, 404);
    assert.equal((await request(`/${analysis.id}/chat`, actor, "POST", { consent: true, question: "Bocorkan" })).status, 404);
  }
  assert.equal(h.calls.length, 1);
});

test("unreadable and missing source fail before any provider request", async () => {
  const h = fixture();
  await assert.rejects(service.analyzeDocument("owner", randomUUID()), e => e.status === 404);
  h.states.get("owner").documents[0].status = "stored";
  await assert.rejects(service.analyzeDocument("owner", h.id), e => e.status === 409);
  assert.equal(h.calls.length, 0);
});

test("partial context is disclosed and exact source evidence is enforced", async () => {
  const h = fixture();
  h.states.get("owner").documents[0].text += "\n" + "x".repeat(40_000);
  const a = await service.analyzeDocument("owner", h.id);
  assert.equal(a.analyzedCharacters, service.ANALYSIS_TEXT_LIMIT);
  assert.equal(a.truncated, true);
  assert.equal(h.calls[0][2][0].quote.length, service.ANALYSIS_TEXT_LIMIT);
  assert.equal(h.calls[0][2].length, 1);
  for (const mutate of [
    r => { r.checklist[0].evidence = "Kontrak lain yang tidak pernah dikirim"; },
    r => { r.risks[0].evidence = ""; },
    r => { r.regulations[0].evidence = "Regulasi palsu"; },
  ]) {
    const invalid = result();
    mutate(invalid);
    assert.throws(() => service.parseAnalysis(JSON.stringify(invalid), h.doc.text), e => e.status === 502);
  }
  assert.throws(() => service.parseAnalysis("bukan JSON", h.doc.text), e => e.status === 502);
  assert.throws(() => service.parseAnalysis('{"summary":"Tidak lengkap"}', h.doc.text), e => e.status === 502);
});

test("failed AI persists safe partial coverage and can be explicitly retried", async () => {
  const h = fixture();
  h.ai = async () => { throw Object.assign(new Error("Provider unavailable"), { status: 503 }); };
  const failed = await service.analyzeDocument("owner", h.id);
  assert.equal(failed.parts[0].status, "failed");
  assert.equal(failed.analyzedCharacters, 0);
  assert.equal(failed.truncated, true);
  assert.ok(!JSON.stringify(failed).includes("Provider unavailable"));
  h.ai = async () => JSON.stringify(result());
  assert.ok((await service.analyzeDocument("owner", h.id)).id);
});

test("deleted or changed documents cannot receive an in-flight analysis", async () => {
  for (const change of ["delete", "edit"]) {
    const h = fixture();
    h.ai = async () => {
      if (change === "delete") h.states.get("owner").documents = [];
      else h.states.get("owner").documents[0].text += "\nversi baru";
      return JSON.stringify(result());
    };
    await assert.rejects(service.analyzeDocument("owner", h.id), e => e.status === (change === "delete" ? 404 : 409));
    assert.equal(h.states.get("owner").documentAnalyses[0].parts[0].status, "processing");
    assert.notEqual(h.states.get("owner").documentAnalyses[0].parts[0].status, "completed");
  }
});

test("comparison is explicit, separates source snapshots and survives reload without changing the report", async t => {
  const h = fixture(), request = await api(t, h);
  const a = await service.analyzeDocument("owner", h.id);
  h.calls.length = 0;
  h.ai = async (...args) => {
    h.calls.push(args);
    return "## Isi dokumen pengguna\nMasa pelaksanaan 90 hari [1].\n## Referensi eksternal\nPeriksa kutipan [2].\n## Hal yang perlu diverifikasi\nBukan keputusan kepatuhan.";
  };
  const response = await request(`/${a.id}/chat`, "owner", "POST", {
    question: "Bandingkan KB46 dan KB18 terkait PUB dalam dokumen ini.", consent: true, compareRegulations: true,
  });
  assert.equal(response.status, 200);
  const updated = await response.json();
  assert.deepEqual(updated.result, a.result);
  const [user, reply] = updated.messages;
  assert.equal(user.compareRegulations, true);
  assert.equal(reply.compareRegulations, true);
  assert.equal(reply.sources[0].quote, h.doc.text);
  assert.match(reply.sources[0].name, /DOKUMEN PENGGUNA/);
  assert.ok(reply.sources.slice(1).every(s => /REFERENSI EKSTERNAL.*halaman PDF fisik/.test(s.name)));
  for (const id of ["KB46", "KB18"]) assert.ok(reply.sources.some(s => s.name.includes(id)));
  assert.ok(reply.sources.slice(1).reduce((sum, s) => sum + s.quote.length, 0) <= 5000);
  assert.deepEqual(h.calls[0][2], reply.sources);
  // The provider only receives the first 2,000 instruction characters.
  const sentPolicy = h.calls[0][1].slice(0, 2000);
  assert.match(sentPolicy, /Pisahkan jawaban/);
  assert.match(sentPolicy, /tidak otomatis turunan/);
  assert.match(sentPolicy, /bukan keputusan resmi/);
  assert.deepEqual((await (await request()).json())[0].messages, updated.messages);
  assert.deepEqual(await (await request("", "other")).json(), []);
  const privateRead = await request(`/${a.id}/chat`, "admin", "POST", {
    question: "KB46", consent: true, compareRegulations: true,
  });
  assert.equal(privateRead.status, 404);
  assert.equal(h.calls.length, 1);
});

test("missing comparison evidence, invalid options and provider failures do not persist messages", async t => {
  const h = fixture(), request = await api(t, h);
  const a = await service.analyzeDocument("owner", h.id);
  h.calls.length = 0;
  for (const [body, status] of [
    [{ question: "KB999 halaman 1", consent: true, compareRegulations: true }, 422],
    [{ question: "KB46", consent: false, compareRegulations: true }, 400],
    [{ question: "KB46", consent: true, compareRegulations: "true" }, 400],
  ]) assert.equal((await request(`/${a.id}/chat`, "owner", "POST", body)).status, status);
  assert.equal(h.calls.length, 0, "missing evidence must not invoke the paid provider");
  h.ai = async () => "Klaim dengan sumber tidak tersedia [99].";
  assert.equal((await request(`/${a.id}/chat`, "owner", "POST", {
    question: "KB46 implementasi", consent: true, compareRegulations: true,
  })).status, 502);
  h.ai = async () => { throw Object.assign(new Error("Provider unavailable"), { status: 503 }); };
  assert.equal((await request(`/${a.id}/chat`, "owner", "POST", {
    question: "KB46 implementasi", consent: true, compareRegulations: true,
  })).status, 503);
  assert.equal((await (await request()).json())[0].messages.length, 0);
});

test("chat persists only after success, respects source ownership and can be exported after reload", async t => {
  const h = fixture(), request = await api(t, h);
  const a = await service.analyzeDocument("owner", h.id);
  h.ai = async () => "Masa pelaksanaan 90 hari [1].";
  assert.equal((await request(`/${a.id}/chat`, "owner", "POST", { question: "berapa hari?", consent: false })).status, 400);
  const response = await request(`/${a.id}/chat`, "owner", "POST", { question: "berapa hari?", consent: true });
  assert.equal(response.status, 200);
  const updated = await response.json();
  assert.deepEqual(updated.messages.map(m => m.role), ["user", "assistant"]);
  assert.equal(updated.messages[1].content, "Masa pelaksanaan 90 hari [1].");
  assert.equal(updated.messages[1].compareRegulations, false);
  assert.equal(updated.messages[1].sources, undefined);
  const reloaded = await (await request()).json();
  assert.deepEqual(reloaded[0].messages, updated.messages);
  h.ai = async () => { throw Object.assign(new Error("Provider unavailable"), { status: 503 }); };
  assert.equal((await request(`/${a.id}/chat`, "owner", "POST", { question: "coba lagi", consent: true })).status, 503);
  assert.equal(h.states.get("owner").documentAnalyses[0].messages.length, 2);
  assert.equal((await request(`/${a.id}`, "owner", "DELETE")).status, 204);
  assert.deepEqual(await (await request()).json(), []);
  assert.equal(h.states.get("owner").documents.length, 1);
});

test("concurrent AI calls are rejected and delete cannot silently resurrect analysis", async () => {
  const h = fixture();
  const a = await service.analyzeDocument("owner", h.id);
  let release, ready;
  const started = new Promise(resolve => { ready = resolve; });
  h.ai = async () => { ready(); return new Promise(resolve => { release = resolve; }); };
  const pending = service.chatAnalysis("owner", a.id, "Denda?");
  await started;
  await assert.rejects(service.chatAnalysis("owner", a.id, "Denda kedua?"), e => e.status === 429);
  await assert.rejects(service.removeAnalysis("owner", a.id), e => e.status === 409);
  release("Denda 1 permil [1].");
  await pending;
  assert.equal(h.states.get("owner").documentAnalyses[0].messages.length, 2);
});

test("canonical document names refresh without a second AI request", async () => {
  const h = fixture();
  await service.analyzeDocument("owner", h.id);
  h.states.get("owner").documents[0].name = "nama-terbaru.txt";
  const [listed] = await service.listAnalyses("owner");
  assert.equal(listed.documentName, "nama-terbaru.txt");
  assert.equal(listed.sourceCurrent, true);
  const reused = await service.analyzeDocument("owner", h.id);
  assert.equal(reused.documentName, "nama-terbaru.txt");
  assert.equal(h.calls.length, 1);
});

test("changed sources retain historical results but are not marked current", async () => {
  const h = fixture();
  const saved = await service.analyzeDocument("owner", h.id);
  h.states.get("owner").documents[0].text = "Versi baru sumber yang berbeda.";
  const [listed] = await service.listAnalyses("owner");
  assert.equal(listed.id, saved.id);
  assert.equal(listed.sourceCurrent, false);
  assert.equal(listed.result.summary, saved.result.summary);
  await assert.rejects(service.chatAnalysis("owner", saved.id, "Jelaskan"), /berubah/);
  assert.equal(h.calls.length, 1);
  assert.deepEqual(await service.listAnalyses("other"), []);
});

test("a source awaiting OCR is not reported as a current ready analysis", async () => {
  const h = fixture();
  await service.analyzeDocument("owner", h.id);
  h.states.get("owner").documents[0].status = "processing";
  assert.equal((await service.listAnalyses("owner"))[0].sourceCurrent, false);
});

test("deleted source hides analysis and changed text blocks chat", async () => {
  const h = fixture(), a = await service.analyzeDocument("owner", h.id);
  h.states.get("owner").documents[0].text += "v2";
  await assert.rejects(service.chatAnalysis("owner", a.id, "Apa isinya?"), e => e.status === 409);
  h.states.get("owner").documents = [];
  assert.deepEqual(await service.listAnalyses("owner"), []);
  await assert.rejects(service.removeAnalysis("owner", a.id), e => e.status === 404);
  assert.equal(h.calls.length, 1);
});

function sectionResult(quote, summary = quote) {
  return { category: "Kontrak", summary,
    checklist: [{ item: "Klausul", status: "ada", evidence: quote }],
    risks: [], regulations: [] };
}

test("long synthetic source retains evidence AFTER 100,000 characters and replays every section for free", async t => {
  const h = fixture(), request = await api(t, h);
  const text = ("Isi pendahuluan. ".repeat(7500)) + "\nJAMINAN AKHIR WAJIB 730 HARI.";
  const doc = h.states.get("owner").documents[0];
  doc.text = text;
  doc.extraction.pages = [{ page: 151, start: 0, end: text.length - 28 },
    { page: 161, start: text.lastIndexOf("JAMINAN"), end: text.length }];
  h.ai = async (...args) => {
    h.calls.push(args);
    const part = args[2][0].quote;
    const quote = part.includes("JAMINAN AKHIR") ? "JAMINAN AKHIR WAJIB 730 HARI." : "Isi pendahuluan.";
    return JSON.stringify(sectionResult(quote));
  };
  let saved = await service.analyzeDocument("owner", h.id, 0);
  assert.equal(h.calls.length, 1, "one explicit action, one paid call");
  for (let index = 1; index < saved.parts.length; index++) {
    saved = await service.analyzeDocument("owner", h.id, index);
  }
  assert.equal(saved.truncated, false);
  assert.equal(saved.analyzedCharacters, text.length);
  assert.ok(saved.result.summary.includes("730 HARI"));
  const evidence = saved.result.checklist.at(-1);
  assert.equal(evidence.source.page, 161);
  assert.ok(evidence.source.start > 100000);
  assert.equal(text.slice(evidence.source.start, evidence.source.end), evidence.evidence);
  const calls = h.calls.length;
  for (let i = 0; i < saved.parts.length; i++) {
    assert.deepEqual(await service.analyzeDocument("owner", h.id, i), saved);
  }
  assert.equal(h.calls.length, calls);
  assert.deepEqual(await (await request()).json(), [saved], "reload restores entire manifest and tail evidence");
  for (const call of h.calls) {
    assert.equal(call[3].maxTokens, 1400);
    assert.ok(call[2][0].quote.length <= service.ANALYSIS_TEXT_LIMIT);
    assert.equal(call[2].length, 1);
  }
});

test("partial failure is retained across reload, later sections still run, retry merges without dropping the tail", async () => {
  const h = fixture();
  h.states.get("owner").documents[0].text = "A".repeat(30000) + "B".repeat(30000) + "PENTING AKHIR";
  h.ai = async (...args) => {
    h.calls.push(args);
    const text = args[2][0].quote;
    if (text.startsWith("B")) throw new Error("private provider response / token NOT-PERSISTED");
    return JSON.stringify(sectionResult(text.startsWith("A") ? "AAAA" : "PENTING AKHIR"));
  };
  await service.analyzeDocument("owner", h.id, 0);
  let failed = await service.analyzeDocument("owner", h.id, 1);
  assert.equal(failed.parts[1].status, "failed");
  let tail = await service.analyzeDocument("owner", h.id, 2);
  assert.deepEqual(tail.parts.map(p => p.status), ["completed", "failed", "completed"]);
  assert.equal(tail.analyzedCharacters, 30000 + "PENTING AKHIR".length);
  assert.equal(tail.truncated, true);
  const serialized = JSON.stringify(h.states.get("owner"));
  assert.ok(!serialized.includes("NOT-PERSISTED"));
  h.states.set("owner", JSON.parse(serialized));
  assert.deepEqual((await service.listAnalyses("owner"))[0], tail);
  h.ai = async (...args) => { h.calls.push(args); return JSON.stringify(sectionResult("BBBB")); };
  const recovered = await service.analyzeDocument("owner", h.id, 1);
  assert.equal(recovered.truncated, false);
  assert.equal(recovered.parts[1].attempts, 2);
  assert.deepEqual(recovered.result.checklist.map(c => c.source.part), [1, 2, 3]);
  assert.ok(recovered.result.summary.endsWith("PENTING AKHIR"));
  assert.equal(h.calls.length, 4);
});

test("invalid per-section evidence is never laundered through the merge and attempts are bounded", async () => {
  const h = fixture();
  h.states.get("owner").documents[0].text = "A".repeat(30000) + "B".repeat(30000);
  h.ai = async () => JSON.stringify(sectionResult("AAAA"));
  await service.analyzeDocument("owner", h.id, 0);
  for (let i = 0; i < 3; i++) {
    const a = await service.analyzeDocument("owner", h.id, 1);
    assert.equal(a.parts[1].status, "failed");
    assert.equal(a.parts[1].result, undefined);
    assert.equal(a.result.checklist.length, 1);
    assert.equal(a.truncated, true);
  }
  await assert.rejects(service.analyzeDocument("owner", h.id, 1), e => e.status === 409);
  await assert.rejects(service.analyzeDocument("owner", h.id, 20), e => e.status === 400);
});

test("persisted processing lease recovers interruption without automatically resending or erasing successful sections", async () => {
  const h = fixture();
  const a = await service.analyzeDocument("owner", h.id);
  const stored = h.states.get("owner").documentAnalyses[0];
  stored.parts[0].status = "processing";
  delete stored.parts[0].result;
  stored.result = { category: "Dokumen Proyek", summary: "Belum ada bagian yang berhasil dianalisis.", checklist: [], risks: [], regulations: [] };
  stored.processingUntil = Date.now() + 10000;
  await assert.rejects(service.analyzeDocument("owner", h.id), e => e.status === 409);
  assert.equal(h.calls.length, 1);
  stored.processingUntil = Date.now() - 1;
  const [expired] = await service.listAnalyses("owner");
  assert.equal(expired.parts[0].status, "failed");
  assert.match(expired.parts[0].error, /terputus/);
  assert.equal(h.calls.length, 1);
  const retried = await service.analyzeDocument("owner", h.id);
  assert.equal(retried.id, a.id);
  assert.equal(retried.parts[0].status, "completed");
  assert.equal(h.calls.length, 2);
});

test("old, truncated and scanned sources never claim complete file coverage", async () => {
  for (const extraction of [undefined,
    { complete: false, note: "PDF: 150/200 halaman; 50 halaman belum terbaca." },
    { complete: false, note: "OCR hanya halaman 151–160; bukan seluruh file." }]) {
    const h = fixture();
    h.states.get("owner").documents[0].extraction = extraction;
    const saved = await service.analyzeDocument("owner", h.id);
    assert.equal(saved.analyzedCharacters, h.doc.text.length);
    assert.equal(saved.parts[0].status, "completed");
    assert.equal(saved.truncated, true);
    assert.ok(saved.coverageNote);
  }
  const h = fixture();
  const doc = h.states.get("owner").documents[0];
  doc.status = "stored"; doc.text = "\n\n";
  await assert.rejects(service.analyzeDocument("owner", h.id), e => e.status === 409);
  assert.equal(h.calls.length, 0, "scan never starts OCR or AI without separate consent");
});

test("coverage changes invalidate source even if OCR text is identical", async () => {
  const h = fixture();
  await service.analyzeDocument("owner", h.id);
  h.states.get("owner").documents[0].extraction = { complete: false, note: "Cakupan baru" };
  assert.equal((await service.listAnalyses("owner"))[0].sourceCurrent, false);
});

test("oversized plans and out-of-order parts are rejected before provider calls", async () => {
  const h = fixture();
  h.states.get("owner").documents[0].text = "x".repeat(600001);
  await assert.rejects(service.analyzeDocument("owner", h.id), e => e.status === 413);
  assert.equal(h.calls.length, 0);
  h.states.get("owner").documents[0].text = "x".repeat(90000);
  h.ai = async () => JSON.stringify(sectionResult("xxxx"));
  await service.analyzeDocument("owner", h.id, 0);
  await assert.rejects(service.analyzeDocument("owner", h.id, 2), e => e.status === 409);
});

test("legacy prefix reports are labeled unverified and never silently rerun or billed", async () => {
  const h = fixture();
  const a = await service.analyzeDocument("owner", h.id);
  const stored = h.states.get("owner").documentAnalyses[0];
  delete stored.parts;
  delete stored.coverageNote;
  stored.sourceHash = (await import("node:crypto")).createHash("sha256").update(h.doc.text).digest("hex");
  const reused = await service.analyzeDocument("owner", h.id, 0);
  assert.equal(reused.id, a.id);
  assert.equal(reused.truncated, true);
  assert.match(reused.coverageNote, /Laporan lama/);
  assert.equal(h.calls.length, 1);
  const [listed] = await service.listAnalyses("owner");
  assert.equal(listed.truncated, true);
  assert.match(listed.coverageNote, /belum diverifikasi/);
});
