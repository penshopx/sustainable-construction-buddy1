import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
const compiled = await build({ stdin: {
  contents: 'export * from "./src/lib/ai-harness"; export * from "./src/lib/harness-citations"; export {createChatService} from "./src/lib/chat-service"; export {SendHelpdeskMessageResponse} from "@workspace/api-zod";',
  resolveDir: fileURLToPath(new URL("..", import.meta.url)), loader: "ts",
}, bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent" });
const module = { exports: {} };
new Function("require", "module", "exports", compiled.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const { runReadOnlyHarness, AiHarnessError, checkCitationLinks, schemeCitationPairs, createChatService, SendHelpdeskMessageResponse } = module.exports;
const plan = () => ({ model: "openai/gpt-test" });

test("harness orders preparation, one model request and verification without leaking metadata", async () => {
  const events = [];
  const value = await runReadOnlyHarness({
    prepare: () => { events.push("prepare"); return plan(); },
    execute: async (prepared, request) => request(async signal => {
      assert.equal(prepared.model, "openai/gpt-test"); assert.equal(signal.aborted, false);
      events.push("model"); return "raw";
    }),
    verify: raw => { events.push("verify"); return raw.toUpperCase(); },
  });
  assert.equal(value, "RAW"); assert.deepEqual(events, ["prepare", "model", "verify"]);
});
test("invalid model and pre-aborted input stop before generation", async () => {
  let calls = 0;
  const base = { execute: async () => { calls++; }, verify: value => value };
  for (const model of ["", undefined, "https://provider.invalid/model", "x".repeat(121)])
    await assert.rejects(runReadOnlyHarness({ ...base, prepare: () => ({ model }) }), AiHarnessError);
  await assert.rejects(runReadOnlyHarness({ ...base, signal: AbortSignal.abort(), prepare: plan }), AiHarnessError);
  assert.equal(calls, 0);
});
test("second model attempt is blocked even if an adapter swallows the error; the request capability closes", async () => {
  let network = 0, captured;
  await assert.rejects(runReadOnlyHarness({ prepare: plan, execute: async (_plan, request) => {
    captured = request;
    const value = await request(async () => ++network);
    await assert.rejects(request(async () => ++network), AiHarnessError);
    return value;
  }, verify: value => value }), AiHarnessError);
  assert.equal(network, 1);
  await assert.rejects(captured(async () => ++network), AiHarnessError);
  assert.equal(network, 1);
});
test("canned success without a completed model call and hidden fallback after model failure are rejected", async () => {
  for (const execute of [async () => "fake", async (_plan, request) => {
    try { await request(async () => { throw new Error("provider failed"); }); } catch {}
    return "fake fallback";
  }]) await assert.rejects(runReadOnlyHarness({ prepare: plan, execute, verify: value => value }), AiHarnessError);
});
test("cancellation propagates to the adapter and prevents verification", async () => {
  const controller = new AbortController(); let verified = false;
  await assert.rejects(runReadOnlyHarness({ signal: controller.signal, prepare: plan,
    execute: async (_plan, request) => request(async signal => {
      controller.abort(); assert.equal(signal.aborted, true); return "late";
    }), verify: () => { verified = true; },
  }), AiHarnessError);
  assert.equal(verified, false);
});
test("verification failure is not retried and does not become a successful answer", async () => {
  let calls = 0;
  await assert.rejects(runReadOnlyHarness({ prepare: plan,
    execute: async (_plan, request) => request(async () => { calls++; return "unverified"; }),
    verify: () => { throw new Error("citation rejected"); },
  }), /citation rejected/);
  assert.equal(calls, 1);
});
test("citation allowlist contains supplied mapping/excerpts, never section headers without evidence", () => {
  const context = "DATA_SKEMA_TIDAK_TEPERCAYA=" + JSON.stringify({
    mappingReference: { id: "KB09", page: 21 },
    generalRequirementSectionStarts: [{ id: "KB09", page: 4, text: "Judul bagian, bukan isi kriteria" }],
    subclassificationScope: { references: [{ id: "KB19", page: 17, excerpt: "Ruang lingkup" }] },
  }) + "\nAKHIR_DATA_SKEMA";
  const refs = schemeCitationPairs(context);
  assert.equal(checkCitationLinks("Sumber [KB09, halaman PDF 21] [KB19, hlm. 17]", refs), 2);
  assert.equal(checkCitationLinks("Belum ada bukti.", refs), 0);
  for (const bad of ["[KB99, halaman PDF 1]", "[KB09, halaman PDF 4]", "[KB09]"])
    assert.throws(() => checkCitationLinks(bad, refs));
});
test("direct-provider adapter annotates missing citations, accepts supplied pages and rejects invented references", async () => {
  const env = { OPENROUTER_API_KEY: "synthetic-provider-not-production" };
  for (const [answer, expected] of [
    ["BG001: 41011. [KB09, halaman PDF 21]", /ID sumber dan halaman kutipan cocok/],
    ["Mohon periksa ulang rujukan.", /belum memuat kutipan sumber/],
    ["Rekaan [KB99, halaman PDF 999]", null],
  ]) {
    let requests = 0;
    const service = createChatService({ env, fetchImpl: async () => {
      requests++; return Response.json({ model: "openai/gpt-4o-mini", choices: [{ message: { content: answer } }] });
    } });
    const pending = service.reply([{ role: "user", content: "Jelaskan BG001" }], undefined, { engine: "gpt", scheme_code: "BG001" });
    if (expected) assert.match(await pending, expected);
    else await assert.rejects(pending, error => error.status === 503 && error.code === "ai_citation_invalid");
    assert.equal(requests, 1);
  }
});
test("direct-provider adapter forwards abort to its in-flight model request", async () => {
  const controller = new AbortController();
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const service = createChatService({ env: { OPENROUTER_API_KEY: "synthetic-provider-not-production" },
    fetchImpl: async (_url, init) => {
      started();
      return new Promise((_resolve, reject) => init.signal.addEventListener("abort",
        () => reject(new DOMException("aborted", "AbortError")), { once: true }));
    },
  });
  const pending = service.reply([{ role: "user", content: "Pertanyaan sintetis" }], undefined, undefined, controller.signal);
  await ready; controller.abort();
  await assert.rejects(pending, error => error.status === 504);
});
test("response budget reserves room for the application warning without truncating or raising the raw model limit", async () => {
  for (const length of [32000, 32001]) {
    const service = createChatService({ env: { OPENROUTER_API_KEY: "synthetic-provider-not-production" },
      fetchImpl: async () => Response.json({ model: "openai/gpt-4o-mini",
        choices: [{ message: { content: "x".repeat(length) } }] }),
    });
    const pending = service.reply([{ role: "user", content: "Jelaskan BG001" }], undefined, { scheme_code: "BG001", engine: "gpt" });
    if (length === 32001) await assert.rejects(pending, error => error.status === 503);
    else {
      const reply = await pending;
      assert.ok(reply.startsWith("x".repeat(32000)));
      assert.ok(reply.length > 32000 && reply.length <= 32512);
      assert.equal(SendHelpdeskMessageResponse.parse({ reply }).reply, reply);
    }
  }
});
