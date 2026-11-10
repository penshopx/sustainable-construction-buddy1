import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { Worker } from "node:worker_threads";
import { build } from "esbuild";
import { createRequire } from "node:module";

const requireApi = createRequire(new URL("../package.json", import.meta.url));

const dir = new URL("../../../generated-artifacts/vault-ocr-worker-tests/", import.meta.url);
await mkdir(dir, { recursive: true });
const workerPath = new URL("worker.cjs", dir);
await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/vault-extractor.ts", import.meta.url))],
  outfile: fileURLToPath(workerPath), bundle: true, platform: "node", format: "cjs",
  external: ["pdf-parse", "mammoth", "xlsx", "pdfjs-dist", "@napi-rs/canvas"],
  banner: { js: `require = require("node:module").createRequire(${JSON.stringify(fileURLToPath(new URL("../package.json", import.meta.url)))});` },
  plugins: [{
    name: "no-external-inference",
    setup(b) {
      b.onResolve({ filter: /^(pdfjs-dist\/legacy\/build\/pdf\.mjs|@napi-rs\/canvas)$/ }, args => ({
        path: requireApi.resolve(args.path), external: true,
      }));
      b.onLoad({ filter: /vault-ocr-provider\.ts$/ }, () => ({ contents: `
        import { PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
        export const OCR_ERRORS = { OCR_PDF_LIMIT: "limit", OCR_PAGE_RANGE: "range", OCR_FAILED: "failed", OCR_OUTPUT_LIMIT: "output" };
        export async function requestOcr(bytes, type, key, fetch, numbers) {
          const { workerData } = await import("node:worker_threads");
          if (workerData.responseCase === "malformed") return "not JSON";
          if (workerData.responseCase === "missing") return JSON.stringify({ pages: [] });
          if (workerData.responseCase === "wrongPage") return JSON.stringify({ pages: [{ page: 1, text: "wrong number" }] });
          if (workerData.responseCase === "oversized") return JSON.stringify({ pages: [{ page: numbers[0], text: "x".repeat(100001) }] });
          const selected = await PDFDocument.load(bytes);
          if (selected.getPageCount() !== numbers.length) throw new Error("OCR_FAILED");
          if (workerData.responseCase === "privacy") {
            const markers = ["PRIVATE_PAGE_ATTACHMENT", "PRIVATE_UNUSED_RESOURCE", "PRIVATE_ORIGINAL_METADATA"];
            const objects = selected.context.enumerateIndirectObjects();
            for (const [, object] of objects) {
              const raw = object instanceof PDFRawStream ? Buffer.from(object.getContents()).toString("latin1") : object.toString();
              if (markers.some(marker => raw.includes(marker)) || ["EmbeddedFile", "Filespec", "/AF"].some(key => raw.includes(key))) throw new Error("OCR_FAILED");
            }
            // Every exported page has exactly one newly encoded raster image,
            // never a copied page resource or a hidden, unused XObject.
            for (const page of selected.getPages()) {
              const xobjects = page.node.Resources().lookup(PDFName.of("XObject"));
              if (xobjects.keys().length !== 1) throw new Error("OCR_FAILED");
              const image = xobjects.lookup(xobjects.keys()[0]);
              if (image.dict.get(PDFName.of("Subtype")).toString() !== "/Image") throw new Error("OCR_FAILED");
              const { loadImage, createCanvas } = await import("@napi-rs/canvas");
              const decoded = await loadImage(Buffer.from(image.getContents()));
              const canvas = createCanvas(decoded.width, decoded.height);
              const ctx = canvas.getContext("2d"); ctx.drawImage(decoded, 0, 0);
              const pixel = ctx.getImageData(Math.floor(decoded.width / 2), Math.floor(decoded.height / 2), 1, 1).data;
              if (pixel[2] < 200 || pixel[0] > 30) throw new Error("OCR_FAILED");
              canvas.width = 1; canvas.height = 1;
            }
          }
          const pages = selected.getPages().map((p, i) => {
            if (Math.abs(p.getWidth() - numbers[i] - 99) > 0.001) throw new Error("OCR_FAILED");
            if (p.node.Annots()?.size()) throw new Error("OCR_FAILED");
            return { page: numbers[i], text: "SYNTHETIC PAGE " + numbers[i] };
          });
          return JSON.stringify({ pages });
        }
      ` }));
    },
  }],
});
test.after(() => rm(dir, { recursive: true, force: true }));

function blankPdf(pages) {
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${i + 3} 0 R`).join(" ")}] /Count ${pages} >>`,
    ...Array.from({ length: pages }, (_, i) => `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${100 + i} 100] /Resources << >> /Annots [<< /Type /Annot /Subtype /Link /Rect [0 0 10 10] /Dest [3 0 R /Fit] >>] >>`),
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((body, i) => { offsets.push(Buffer.byteLength(pdf)); pdf += `${i + 1} 0 obj\n${body}\nendobj\n`; });
  const xref = Buffer.byteLength(pdf);
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map(n => `${String(n).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(pdf);
}
async function extract(bytes, type, pageRange, responseCase) {
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, {
      workerData: { bytes, type, apiKey: "synthetic-not-a-key", pageRange, responseCase }, env: {},
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16 },
    });
    const timer = setTimeout(() => { void worker.terminate(); reject(new Error("Worker timeout")); }, 15_000);
    worker.on("message", value => {
      if (value.prepared) return;
      clearTimeout(timer); void worker.terminate().then(() => resolve(value));
    });
    worker.once("error", error => { clearTimeout(timer); reject(error); });
  });
}
test("long PDF sends only selected original pages and returns exact offsets", async () => {
  const result = await extract(blankPdf(80), "PDF", { start: 51, end: 52 });
  assert.equal(result.text, "SYNTHETIC PAGE 51\n\nSYNTHETIC PAGE 52\n\n");
  assert.deepEqual(result.pages, [{ page: 51, start: 0, end: 17 }, { page: 52, start: 19, end: 36 }]);
});
test("30 selected pages allowed regardless of original length; invalid ranges never reach provider", async () => {
  assert.equal((await extract(blankPdf(80), "PDF", { start: 51, end: 80 })).pages.length, 30);
  for (const range of [undefined, { start: 1, end: 31 }, { start: 80, end: 81 }, { start: 0, end: 1 }, { start: 2, end: 1 }, { start: 1.5, end: 2 }]) {
    assert.deepEqual(await extract(blankPdf(80), "PDF", range), { error: true, code: "OCR_PAGE_RANGE" });
  }
});
test("actual worker rejects oversized input and unsupported format before provider invocation", async () => {
  for (const [bytes, type] of [[Buffer.alloc(15 * 1024 * 1024 + 1), "PNG"], [Buffer.from("synthetic"), "DOCX"]]) {
    assert.deepEqual(await extract(bytes, type), { error: true, code: "OCR_FAILED" });
  }
});
test("malformed, missing or incorrectly numbered page output is rejected, never partially indexed", async () => {
  for (const scenario of ["malformed", "missing", "wrongPage", "oversized"]) {
    assert.deepEqual(await extract(blankPdf(80), "PDF", { start: 51, end: 51 }, scenario), {
      error: true, code: scenario === "oversized" ? "OCR_OUTPUT_LIMIT" : "OCR_FAILED",
    });
  }
});
test("provider receives only rendered selected pixels, not page attachments, metadata or unused shared resources", async () => {
  const { PDFDocument, PDFName, rgb } = requireApi("pdf-lib");
  const source = await PDFDocument.load(blankPdf(80));
  source.setTitle("PRIVATE_ORIGINAL_METADATA");
  const attachment = source.context.register(source.context.stream(Buffer.from("PRIVATE_PAGE_ATTACHMENT"), { Type: "EmbeddedFile" }));
  const file = source.context.register(source.context.obj({ Type: "Filespec", F: "hidden.txt", EF: { F: attachment } }));
  const unused = source.context.register(source.context.stream(Buffer.from("PRIVATE_UNUSED_RESOURCE"), {
    Type: "XObject", Subtype: "Form", BBox: [0, 0, 100, 100], Resources: {},
  }));
  // A shared resource dictionary contains a Form not used by the selected page.
  const resources = source.context.obj({ XObject: { UnusedSecret: unused } });
  for (const page of [source.getPage(0), source.getPage(50)]) {
    page.node.set(PDFName.of("Resources"), resources);
  }
  const page = source.getPage(50);
  page.node.set(PDFName.of("AF"), source.context.obj([file]));
  page.drawRectangle({ x: 0, y: 0, width: page.getWidth(), height: page.getHeight(), color: rgb(0, 0, 1) });
  const bytes = Buffer.from(await source.save());
  const original = Buffer.from(bytes);
  const result = await extract(bytes, "PDF", { start: 51, end: 51 }, "privacy");
  assert.equal(result.text, "SYNTHETIC PAGE 51\n\n");
  assert.deepEqual(bytes, original);
});
