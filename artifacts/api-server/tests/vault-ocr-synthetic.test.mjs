// Offline harness/protocol checks ONLY. Passing does not measure provider accuracy.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { evaluate } from "../scripts/vault-ocr-synthetic/score.mjs";
const reference = JSON.parse(await readFile(new URL("../scripts/vault-ocr-synthetic/reference.json", import.meta.url)));
const root = fileURLToPath(new URL("..", import.meta.url));
const bundled = await build({
  stdin: { contents: `
    export { requestOcr, OCR_MODEL } from "./src/lib/vault-ocr-provider";
    export { vaultSourceWindows } from "./src/lib/vault-sources";
  `, resolveDir: root, loader: "ts" },
  bundle: true, platform: "node", format: "cjs", write: false,
});
const module = { exports: {} };
new Function("module", "exports", bundled.outputFiles[0].text)(module, module.exports);
const { requestOcr, OCR_MODEL, vaultSourceWindows } = module.exports;

const score = (key, text, pages) => evaluate(reference[key], { text, pages },
  vaultSourceWindows({ id: "synthetic", name: "synthetic", text, ocrPages: pages }), "synthetic");

test("oracle scoring accepts harmless markup but rejects omitted text, changed digits, negation and table row swaps", () => {
  for (const key of ["certificate", "indonesia", "table"]) {
    const text = reference[key].pages[0].text;
    const good = score(key, text);
    assert.equal(good.pass, true);
    assert.equal(good.pages[0].cer, 0);
    assert.equal(good.pages[0].wer, 0);
    assert.equal(score(key, text.replace(/\n/g, "\n| ").toUpperCase()).pass, true);
    assert.equal(score(key, text.slice(0, text.indexOf("AKHIR"))).pass, false);
  }
  const table = reference.table.pages[0].text;
  assert.equal(score("table", table.replace("780.000", "780.001")).pass, false);
  assert.equal(score("table", table.replace("Semen 12 780.000", "Semen 7 1.925.000").replace("Baja 7 1.925.000", "Baja 12 780.000")).pass, false);
  assert.equal(score("indonesia", reference.indonesia.pages[0].text.replace("belum disetujui", "disetujui")).pass, false);
});

function multi() {
  let text = "";
  const pages = ["certificate", "indonesia", "table"].map((key, i) => {
    const start = text.length;
    text += reference[key].pages[0].text;
    const end = text.length;
    text += "\n\n";
    return { page: i + 1, start, end };
  });
  return { text, pages };
}
test("physical page citations require independent evidence, correct labels and bounded quotes", () => {
  const { text, pages } = multi();
  assert.equal(score("multipage", text, pages).pass, true);
  assert.equal(score("multipage", text, pages.slice(0, 2)).pass, false);
  assert.equal(score("multipage", text, pages.map(p => ({ ...p, page: p.page + 1 }))).pass, false);
  assert.equal(score("multipage", text, [pages[1], pages[0], pages[2]]).pass, false);
  const sources = vaultSourceWindows({ id: "synthetic", name: "synthetic", text, ocrPages: pages });
  assert.equal(evaluate(reference.multipage, { text, pages }, sources.map(s => ({ ...s, name: "synthetic — halaman 1" })), "synthetic").pass, false);
  assert.equal(evaluate(reference.multipage, { text, pages }, sources.map(s => ({ ...s, quote: text })), "synthetic").pass, false);
  // Correct original page numbers survive a subset beginning after page 1.
  const start = pages[1].start;
  assert.equal(score("selected", text.slice(start), pages.slice(1).map(p => ({ ...p, start: p.start - start, end: p.end - start }))).pass, true);
  assert.equal(evaluate(reference.multipage, { text, pages }, [], "synthetic").pass, false);
});

test("real provider parser rejects truncated output even when all expected evidence is present (protocol only)", async () => {
  for (const [payload, code] of [
    [{ model: OCR_MODEL, choices: [{ finish_reason: "length", message: { content: reference.certificate.pages[0].text } }] }, "OCR_OUTPUT_LIMIT"],
    [{ model: OCR_MODEL, choices: [{ finish_reason: "stop", message: { content: "x".repeat(100_001) } }] }, "OCR_OUTPUT_LIMIT"],
  ]) {
    let calls = 0;
    await assert.rejects(requestOcr(Buffer.from("synthetic-only"), "PNG", "not-a-credential", async () => {
      calls++; return Response.json(payload);
    }), { message: code });
    assert.equal(calls, 1);
  }
  await assert.rejects(requestOcr(Buffer.from("synthetic-only"), "PNG", "not-a-credential",
    async () => new Response(null, { status: 402 })), { message: "OCR_CREDIT" });
});

test("live runner refuses before reading credentials or preparing files without both approvals", () => {
  for (const extra of [{}, { RS_OCR_PAID_APPROVED: "1" }, { RS_OCR_CREDIT_CONFIRMED: "1" }]) {
    const run = spawnSync(process.execPath, [fileURLToPath(new URL("../scripts/check-vault-ocr-synthetic.mjs", import.meta.url))], {
      env: { PATH: process.env.PATH, RS_OCR_SYNTHETIC_LIVE: "1", ...extra }, encoding: "utf8",
    });
    assert.notEqual(run.status, 0);
    assert.match(run.stderr, /Paid testing approval AND confirmation/);
  }
});

test("prepared PDF has three raster-only pages, without a text layer", async () => {
  const dir = new URL("../../../generated-artifacts/vault-ocr-synthetic-tests/", import.meta.url);
  const { mkdir } = await import("node:fs/promises");
  await mkdir(dir, { recursive: true });
  const { generateFixtures } = await import("../scripts/vault-ocr-synthetic/fixtures.mjs");
  const fixtures = await generateFixtures(dir);
  assert.equal(fixtures.length, 7);
  const { PDFDocument, PDFName } = await import("pdf-lib");
  const pdf = await PDFDocument.load(await readFile(new URL("multipage.pdf", dir)));
  assert.equal(pdf.getPageCount(), 3);
  for (const page of pdf.getPages()) {
    assert.equal(page.node.Resources().lookup(PDFName.of("XObject")).keys().length, 1);
    // Compare primitives, not PDF dictionaries whose assertion formatting can
    // traverse the entire cyclic document graph on failure.
    assert.equal(page.node.Resources().lookup(PDFName.of("Font"))?.keys().length ?? 0, 0);
  }
  const requireApi = createRequire(new URL("../package.json", import.meta.url));
  const pdfjs = await import(requireApi.resolve("pdfjs-dist/legacy/build/pdf.mjs"));
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(await readFile(new URL("multipage.pdf", dir))), useSystemFonts: true });
  const doc = await loadingTask.promise;
  try {
    for (let i = 1; i <= 3; i++) assert.equal((await (await doc.getPage(i)).getTextContent()).items.length, 0);
  } finally { await loadingTask.destroy(); }
  // Exercise the SAME generated worker build and lifecycle as live mode,
  // including real PDF rasterization and external native dependency resolution.
  // Only inference is replaced. This is a packaging smoke test, not accuracy.
  const { buildSyntheticWorker, extractSyntheticFixture } = await import("../scripts/vault-ocr-synthetic/worker.mjs");
  const worker = new URL("pdf-smoke.cjs", dir);
  await buildSyntheticWorker(worker, [{
    name: "offline-only-provider",
    setup(b) {
      b.onLoad({ filter: /vault-ocr-provider\.ts$/ }, () => ({
        contents: `
          import { PDFDocument, PDFName } from "pdf-lib";
          export const OCR_ERRORS = { OCR_FAILED: "failed" };
          export async function requestOcr(bytes, type, key, fetch, numbers) {
            if (type !== "PDF" || key !== "offline-smoke") throw new Error("OCR_FAILED");
            const pdf = await PDFDocument.load(bytes);
            if (pdf.getPageCount() !== numbers.length) throw new Error("OCR_FAILED");
            for (const page of pdf.getPages()) {
              if (page.node.Resources().lookup(PDFName.of("XObject")).keys().length !== 1) throw new Error("OCR_FAILED");
            }
            return JSON.stringify({ pages: numbers.map(page => ({ page, text: "PACKAGING ONLY PAGE " + page })) });
          }`,
        resolveDir: root, loader: "ts",
      }));
    },
  }]);
  for (const fixture of fixtures.filter(f => f.type === "PDF")) {
    const result = await extractSyntheticFixture(worker, fixture, "offline-smoke");
    const numbers = Array.from({ length: fixture.pageRange.end - fixture.pageRange.start + 1 }, (_, i) => fixture.pageRange.start + i);
    assert.equal(typeof result.text, "string"); // not the {prepared:true} event
    assert.deepEqual(result.pages.map(p => p.page), numbers);
    for (const p of result.pages) assert.equal(result.text.slice(p.start, p.end), `PACKAGING ONLY PAGE ${p.page}`);
  }
});
