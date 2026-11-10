import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const instances = [];
class FakeWorker extends EventEmitter {
  constructor(url, options) { super(); this.options = options; instances.push(this); }
  terminate() { return new Promise(resolve => { this.finishTermination = resolve; }); }
}
globalThis.__vaultFakeWorker = FakeWorker;
const result = await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/vault-files.ts", import.meta.url))],
  bundle: true, platform: "node", format: "cjs", write: false,
  define: { "import.meta.url": JSON.stringify(new URL("../src/lib/vault-files.ts", import.meta.url).href) },
  plugins: [{
    name: "worker-boundaries",
    setup(b) {
      b.onResolve({ filter: /^node:worker_threads$/ }, () => ({ path: "worker", namespace: "fake" }));
      b.onResolve({ filter: /^@google-cloud\/storage$/ }, () => ({ path: "storage", namespace: "fake" }));
      b.onLoad({ filter: /.*/, namespace: "fake" }, args => ({ contents: args.path === "worker"
        ? "export const Worker = globalThis.__vaultFakeWorker;"
        : "export class Storage {}" }));
      b.onLoad({ filter: /vault-store\.ts$/ }, () => ({
        contents: 'export { fail } from "./vault-errors";',
        resolveDir: fileURLToPath(new URL("../src/lib/", import.meta.url)),
      }));
    },
  }],
});
const compiled = { exports: {} };
new Function("require", "module", "exports", result.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
delete globalThis.__vaultFakeWorker;
const { extractText, reserveExtractionWorker, runExtractionWorker } = compiled.exports;

test("local parsers and OCR share two slots; release is idempotent", async () => {
  const one = reserveExtractionWorker(), two = reserveExtractionWorker();
  assert.throws(reserveExtractionWorker, e => e.status === 429);
  await assert.rejects(extractText(Buffer.from("PDF"), "PDF"), e => e.status === 429);
  one(); one();
  const replacement = reserveExtractionWorker();
  assert.throws(reserveExtractionWorker, e => e.status === 429);
  two(); replacement();
});

test("parser slot stays occupied until worker termination; heap and environment are bounded", async () => {
  const parsed = extractText(Buffer.from("PDF"), "PDF");
  const worker = instances.at(-1);
  assert.deepEqual(worker.options.resourceLimits, { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16 });
  assert.deepEqual(worker.options.env, {});
  const second = reserveExtractionWorker();
  worker.emit("message", { text: "synthetic result" });
  assert.throws(reserveExtractionWorker, e => e.status === 429);
  worker.finishTermination(0);
  assert.equal(await parsed, "synthetic result");
  const replacement = reserveExtractionWorker();
  second(); replacement();
});

test("clean early exit and malformed parser response reject rather than leaving a hung request", async () => {
  for (const event of ["exit", "message", "error"]) {
    const promise = runExtractionWorker(Buffer.from("synthetic"), "PNG", "test-only-key");
    const rejection = assert.rejects(promise);
    const worker = instances.at(-1);
    worker.emit(event, event === "exit" ? 0 : event === "error" ? new Error("private error") : { unexpected: true });
    worker.finishTermination(0);
    await rejection;
  }
});

test("text/image uploads never launch paid OCR implicitly", async () => {
  const count = instances.length;
  assert.equal(await extractText(Buffer.from("UJI"), "TXT"), "UJI");
  assert.equal(await extractText(Buffer.from("image"), "PNG"), "");
  assert.equal(instances.length, count);
});

test("local TXT extraction declares character truncation and never silently loses its coverage boundary", async () => {
  let extraction;
  const text = await extractText(Buffer.from("A".repeat(600000) + "BUKTI AKHIR"), "TXT", value => { extraction = value; });
  assert.equal(text.length, 600000);
  assert.equal(extraction.complete, false);
  assert.match(extraction.note, /akhir file belum terbaca/);
  const complete = await extractText(Buffer.from("Sumber utuh"), "TXT", value => { extraction = value; });
  assert.equal(complete, "Sumber utuh");
  assert.equal(extraction.complete, true);
});

test("PDF preparation phase does not settle OCR early and forwards the consent range and page map", async () => {
  let pages;
  const pageRange = { start: 51, end: 52 };
  const promise = runExtractionWorker(Buffer.from("synthetic PDF"), "PDF", "test-only-key", {
    pageRange, onPages: value => { pages = value; },
  });
  const worker = instances.at(-1);
  assert.deepEqual(worker.options.workerData.pageRange, pageRange);
  worker.emit("message", { prepared: true });
  assert.equal(worker.finishTermination, undefined);
  const map = [{ page: 51, start: 0, end: 4 }];
  worker.emit("message", { text: "TEST", pages: map });
  worker.finishTermination(0);
  assert.equal(await promise, "TEST");
  assert.deepEqual(pages, map);
});
