import { parentPort, workerData } from "node:worker_threads";
import pdf from "pdf-parse/lib/pdf-parse.js";
import mammoth from "mammoth";
import * as XLSX from "xlsx";
import { requestOcr, OCR_ERRORS } from "./vault-ocr-provider";
import { validOcrRange } from "./vault-pdf-range";
import { selectPdfPages } from "./vault-pdf-render";
import type { VaultExtraction } from "@workspace/api-zod";

async function extract() {
  const bytes = Buffer.from(workerData.bytes);
  if (workerData.apiKey) {
    if (bytes.length > (workerData.type === "PDF" ? 50 : 15) * 1024 * 1024 || !["PDF", "PNG", "JPG", "JPEG"].includes(workerData.type)) throw new Error("OCR input invalid");
    if (workerData.type === "PDF") {
      if (!validOcrRange(workerData.pageRange)) throw new Error("OCR_PAGE_RANGE");
      const selected = await selectPdfPages(bytes, workerData.pageRange);
      parentPort?.postMessage({ prepared: true });
      const numbers = Array.from({ length: workerData.pageRange.end - workerData.pageRange.start + 1 }, (_, i) => workerData.pageRange.start + i);
      const raw = await requestOcr(selected, "PDF", workerData.apiKey, fetch, numbers);
      let parsed;
      try { parsed = JSON.parse(raw); } catch { throw new Error("OCR_FAILED"); }
      if (!Array.isArray(parsed.pages) || parsed.pages.length !== numbers.length) throw new Error("OCR_FAILED");
      let text = "";
      const pages = numbers.map((page, i) => {
        const item = parsed.pages[i];
        if (item?.page !== page || typeof item.text !== "string") throw new Error("OCR_FAILED");
        const content = item.text.replace(/\0/g, "").trim();
        const start = text.length;
        text += content;
        const end = text.length;
        text += "\n\n";
        return { page, start, end };
      });
      if (text.length > 100_000) throw new Error("OCR_OUTPUT_LIMIT");
      parentPort?.postMessage({ text, pages });
      return;
    }
    const text = await requestOcr(bytes, workerData.type, workerData.apiKey);
    parentPort?.postMessage({ text });
    return;
  }
  // Old PDF.js expects slice() to copy; Buffer.slice() instead creates a view.
  // Allocate this copy only for local PDF parsing, not OCR range preparation.
  const pdfBytes = workerData.type === "PDF" ? new Uint8Array(bytes) as Buffer : bytes;
  let text = "";
  let extraction: VaultExtraction = { complete: false, note: "Cakupan format ini dibatasi; periksa file asli." };
  if (workerData.type === "PDF") {
    const pages: NonNullable<VaultExtraction["pages"]> = [];
    let rendered = 0, blank = 0;
    const parsed = await pdf(pdfBytes, {
      max: 600,
      pagerender: async (page: { pageIndex: number; getTextContent: (options: object) => Promise<{ items: { str: string; transform: number[] }[] }> }) => {
        const content = await page.getTextContent({ normalizeWhitespace: false, disableCombineTextItems: false });
        let previousY: number | undefined, value = "";
        for (const item of content.items) {
          value += (previousY !== undefined && previousY !== item.transform[5] ? "\n" : "") + item.str;
          previousY = item.transform[5];
        }
        value = value.replace(/\0/g, "").trim();
        if (!value) blank++;
        rendered++;
        const start = text.length;
        text += value + "\n\n";
        pages.push({ page: page.pageIndex + 1, start, end: text.length - 2 });
        return ""; // Accumulate our own normalized text and offsets, not parser separators.
      },
    });
    extraction = {
      complete: rendered === parsed.numpages && blank === 0 && text.length <= 600_000,
      note: `PDF: ${rendered}/${parsed.numpages} halaman diekstrak; ${blank} halaman tanpa teks (kosong/scan). Batas lokal 600 halaman/600.000 karakter. Halaman gagal atau tanpa teks tidak dianalisis; OCR memerlukan persetujuan terpisah.`,
      pages: pages.filter(p => p.start < 600_000).map(p => ({ ...p, end: Math.min(p.end, 600_000) })),
    };
  }
  if (workerData.type === "DOCX") {
    text = (await mammoth.extractRawText({ buffer: bytes })).value.replace(/\0/g, "").trim();
    // Text extraction does not establish coverage of drawings/embedded objects.
    extraction.note = "Teks DOCX diekstrak hingga 600.000 karakter; gambar/objek tertanam tidak dibaca.";
  }
  if (workerData.type === "XLSX") {
    const book = XLSX.read(bytes, { type: "buffer", sheetRows: 2000, bookVBA: false, cellHTML: false });
    text = book.SheetNames.slice(0, 20).map(name => `${name}\n${XLSX.utils.sheet_to_csv(book.Sheets[name])}`).join("\n");
  }
  parentPort?.postMessage({ text: text.replace(/\0/g, "").slice(0, 600_000), extraction });
}
extract().catch((error: unknown) => parentPort?.postMessage({
  error: true,
  code: error instanceof Error && Object.hasOwn(OCR_ERRORS, error.message) ? error.message : "OCR_FAILED",
}));
