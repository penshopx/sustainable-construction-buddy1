import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { build } from "esbuild";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { createCanvas } from "@napi-rs/canvas";

// Real local parser and synthetic PDFs only. No storage, hosted member data,
// credentials, network access or paid OCR calls.
const directory = await mkdtemp(fileURLToPath(new URL("../.coverage-test-", import.meta.url)));
const output = `${directory}/extractor.cjs`;
await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/vault-extractor.ts", import.meta.url))],
  outfile: output, bundle: true, platform: "node", format: "cjs",
  external: ["pdf-parse", "mammoth", "xlsx", "pdfjs-dist", "@napi-rs/canvas"],
});
test.after(() => rm(directory, { recursive: true, force: true }));

function extract(bytes) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(output, { workerData: { bytes, type: "PDF" }, env: {},
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16 } });
    const timer = setTimeout(() => { void worker.terminate(); reject(new Error("local extraction timed out")); }, 15000);
    worker.once("message", result => { clearTimeout(timer); void worker.terminate(); resolve(result); });
    worker.once("error", err => { clearTimeout(timer); reject(err); });
  });
}

async function syntheticPdf(count, blank = false) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  for (let n = 1; n <= count; n++) {
    const page = pdf.addPage();
    if (blank) continue;
    for (let line = 0; line < 12; line++) {
      page.drawText(`Halaman ${n} baris ${line}: isi kontrak sintetis untuk uji cakupan dokumen.`, {
        x: 30, y: 800 - line * 20, font, size: 10,
      });
    }
    if (n === count) page.drawText("BUKTI AKHIR JAMINAN 730 HARI", { x: 30, y: 450, font, size: 12 });
  }
  return await pdf.save({ useObjectStreams: false });
}

test("real PDF extraction includes page 161 and text past 100000 with exact page offsets", async () => {
  const result = await extract(await syntheticPdf(161));
  assert.ok(!result.error, JSON.stringify(result));
  assert.ok(result.text.length > 100000);
  assert.ok(result.text.includes("BUKTI AKHIR JAMINAN 730 HARI"));
  assert.equal(result.extraction.complete, true);
  const page = result.extraction.pages.at(-1);
  assert.equal(page.page, 161);
  assert.ok(result.text.slice(page.start, page.end).includes("BUKTI AKHIR JAMINAN 730 HARI"));
});

test("a raster scan PDF is flagged incomplete and never silently starts OCR", async () => {
  const canvas = createCanvas(600, 800);
  const context = canvas.getContext("2d");
  context.fillStyle = "white"; context.fillRect(0, 0, 600, 800);
  context.fillStyle = "black"; context.font = "24px sans-serif";
  context.fillText("SYNTHETIC SCAN JAMINAN 730 HARI", 20, 100);
  const pdf = await PDFDocument.create();
  const scan = await pdf.embedPng(canvas.toBuffer("image/png"));
  for (let i = 0; i < 2; i++) pdf.addPage([600, 800]).drawImage(scan, { x: 0, y: 0, width: 600, height: 800 });
  const result = await extract(await pdf.save({ useObjectStreams: false }));
  assert.ok(!result.error, JSON.stringify(result));
  assert.equal(result.text.trim(), "");
  assert.equal(result.extraction.complete, false);
  assert.match(result.extraction.note, /2 halaman tanpa teks/);
});

test("pages beyond resource cap are explicitly incomplete, not declared fully read", async () => {
  const result = await extract(await syntheticPdf(601, true));
  assert.ok(!result.error, JSON.stringify(result));
  assert.equal(result.extraction.complete, false);
  assert.match(result.extraction.note, /600\/601/);
  assert.equal(result.extraction.pages.length, 600);
});
