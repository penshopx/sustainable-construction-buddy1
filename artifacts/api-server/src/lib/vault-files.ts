import { Storage } from "@google-cloud/storage";
import { randomUUID } from "node:crypto";
import { Worker } from "node:worker_threads";
import { fail } from "./vault-store";
import type { OcrPageRange } from "./vault-pdf-range";
import type { VaultOcrPage, VaultExtraction } from "@workspace/api-zod";

const storage = new Storage({
  credentials: {
    audience: "replit", subject_token_type: "access_token",
    token_url: "http://127.0.0.1:1106/token", type: "external_account",
    credential_source: { url: "http://127.0.0.1:1106/credential", format: { type: "json", subject_token_field_name: "access_token" } },
    universe_domain: "googleapis.com",
  }, projectId: "",
});
export function privateFile(path: string) {
  const root = process.env.PRIVATE_OBJECT_DIR ?? "";
  if (!root || !path.startsWith(`${root}/ruang-simpan/`)) fail(503, "Penyimpanan privat belum siap.");
  const parts = path.replace(/^\//, "").split("/");
  const bucket = parts.shift()!;
  return storage.bucket(bucket).file(parts.join("/"));
}
export function objectPath(owner: string) {
  const root = process.env.PRIVATE_OBJECT_DIR;
  if (!root) fail(503, "Penyimpanan privat belum siap.");
  return `${root}/ruang-simpan/${owner}/${randomUUID()}`;
}
const formats: Record<string, string> = {
  pdf: "application/pdf", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain", md: "text/markdown", csv: "text/csv", jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
};
export function validateFile(name: string, bytes: Buffer) {
  const type = name.split(".").pop()?.toLowerCase() ?? "";
  if (!formats[type]) fail(400, "Format belum didukung. Gunakan PDF, DOCX, XLSX, TXT, MD, CSV, JPG, atau PNG.");
  if (!bytes.length) fail(400, "File kosong tidak dapat diunggah.");
  if (type === "pdf" && !bytes.subarray(0, 5).equals(Buffer.from("%PDF-"))) fail(400, "Isi file bukan PDF yang valid.");
  if (["docx", "xlsx"].includes(type) && !bytes.subarray(0, 2).equals(Buffer.from("PK"))) fail(400, "Dokumen Office tidak valid.");
  if (type === "png" && !bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) fail(400, "Gambar PNG tidak valid.");
  if (["jpg", "jpeg"].includes(type) && (bytes[0] !== 255 || bytes[1] !== 216)) fail(400, "Gambar JPG tidak valid.");
  return { type: type.toUpperCase(), mime: formats[type] };
}
let extractionCount = 0;
export function reserveExtractionWorker() {
  if (extractionCount >= 2) fail(429, "Pekerja pembacaan dokumen sedang penuh. Coba lagi sebentar.");
  extractionCount++;
  let released = false;
  return () => { if (!released) { released = true; extractionCount--; } };
}
export function runExtractionWorker(bytes: Buffer, type: string, apiKey?: string, options?: {
  pageRange?: OcrPageRange;
  onPages?: (pages: VaultOcrPage[]) => void;
  onExtraction?: (extraction: VaultExtraction) => void;
}): Promise<string> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./vault-extractor.cjs", import.meta.url), {
      workerData: { bytes, type, apiKey, pageRange: options?.pageRange },
      env: {},
      resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16 },
    });
    let settled = false;
    const finish = (error?: Error, text = "") => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearTimeout(preparationTimer);
      // Keep the slot reserved until termination actually finishes.
      void worker.terminate().finally(() => error ? reject(error) : resolve(text));
    };
    const timer = setTimeout(() => finish(new Error("OCR_TIMEOUT")), apiKey ? 60_000 : 15_000);
    const preparationTimer = apiKey && type === "PDF"
      ? setTimeout(() => finish(new Error("OCR_TIMEOUT")), 15_000) : undefined;
    worker.on("message", (result: { text?: string; error?: boolean; code?: string; pages?: VaultOcrPage[]; prepared?: boolean; extraction?: VaultExtraction }) => {
      if (result.prepared) { clearTimeout(preparationTimer); return; }
      if (result.error || typeof result.text !== "string") finish(new Error(result.code ?? "OCR_FAILED"));
      else {
        if (result.pages) options?.onPages?.(result.pages);
        if (result.extraction) options?.onExtraction?.(result.extraction);
        finish(undefined, result.text);
      }
    });
    worker.once("error", () => finish(new Error("Extraction failed")));
    worker.once("exit", () => finish(new Error("Extraction stopped")));
  });
}
export async function extractText(bytes: Buffer, type: string, onExtraction?: (extraction: VaultExtraction) => void): Promise<string> {
  if (["TXT", "MD", "CSV"].includes(type)) {
    const text = bytes.toString("utf8").replace(/\0/g, "").trim();
    onExtraction?.({ complete: text.length <= 600_000, note: text.length > 600_000 ? "Ekstraksi teks dibatasi 600.000 karakter; akhir file belum terbaca." : "Seluruh teks file tersedia." });
    return text.slice(0, 600_000);
  }
  if (!["PDF", "DOCX", "XLSX"].includes(type)) return "";
  const release = reserveExtractionWorker();
  try {
    return await runExtractionWorker(bytes, type, undefined, { onExtraction });
  } finally { release(); }
}
