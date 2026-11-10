import { PDFDocument } from "pdf-lib";
import { dirname, join } from "node:path";
import { validOcrRange, type OcrPageRange } from "./vault-pdf-range";

// Only imported by the memory/time-limited CJS extraction worker.
export async function selectPdfPages(bytes: Buffer, range: OcrPageRange) {
  if (!validOcrRange(range)) throw new Error("OCR_PAGE_RANGE");
  // Never copy PDF objects: page dictionaries, /AF files and unused shared
  // resources may contain data outside the consent range. Export pixels only.
  const { getDocument, AnnotationMode } = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const { createCanvas } = await import("@napi-rs/canvas");
  const assets = dirname(require.resolve("pdfjs-dist/package.json"));
  const task = getDocument({
    data: new Uint8Array(bytes),
    useWorkerFetch: false, useSystemFonts: false,
    stopAtErrors: true, maxImageSize: 16_000_000,
    standardFontDataUrl: join(assets, "standard_fonts/"),
    cMapUrl: join(assets, "cmaps/"), cMapPacked: true,
    wasmUrl: join(assets, "wasm/"), verbosity: 0,
  });
  try {
    const source = await task.promise;
    if (range.end > source.numPages) throw new Error("OCR_PAGE_RANGE");
    const output = await PDFDocument.create();
    let imageBytes = 0;
    for (let number = range.start; number <= range.end; number++) {
      const page = await source.getPage(number);
      const base = page.getViewport({ scale: 1 });
      if (!Number.isFinite(base.width * base.height) || base.width <= 0 || base.height <= 0) throw new Error("OCR_FAILED");
      const scale = Math.min(2, 2400 / Math.max(base.width, base.height), Math.sqrt(4_000_000 / (base.width * base.height)));
      const viewport = page.getViewport({ scale });
      const canvas = createCanvas(Math.max(1, Math.floor(viewport.width)), Math.max(1, Math.floor(viewport.height)));
      try {
        await page.render({
          canvas: canvas as unknown as Parameters<typeof page.render>[0]["canvas"],
          canvasContext: canvas.getContext("2d") as unknown as Parameters<typeof page.render>[0]["canvasContext"],
          viewport, annotationMode: AnnotationMode.DISABLE, background: "rgb(255,255,255)",
        }).promise;
        const jpeg = canvas.toBuffer("image/jpeg", 85);
        imageBytes += jpeg.length;
        if (imageBytes > 15 * 1024 * 1024) throw new Error("OCR_PDF_LIMIT");
        const image = await output.embedJpg(jpeg);
        output.addPage([base.width, base.height]).drawImage(image, { x: 0, y: 0, width: base.width, height: base.height });
      } finally {
        canvas.width = 1; canvas.height = 1;
        page.cleanup();
      }
    }
    const selected = Buffer.from(await output.save());
    if (selected.length > 15 * 1024 * 1024) throw new Error("OCR_PDF_LIMIT");
    return selected;
  } finally { await task.destroy(); }
}
