import type { DocumentAnalysis, DocumentAnalysisResult, VaultDocument } from "@workspace/api-zod";
import { fail } from "./vault-errors";

export const PART_SIZE = 30_000;
export const MAX_ANALYSIS_CHARACTERS = 600_000;
export const EMPTY_RESULT: DocumentAnalysisResult = {
  category: "Dokumen Proyek", summary: "Belum ada bagian yang berhasil dianalisis.",
  checklist: [], risks: [], regulations: [],
};

export function planParts(text: string): NonNullable<DocumentAnalysis["parts"]> {
  if (text.length > MAX_ANALYSIS_CHARACTERS) fail(413, "Teks melebihi batas 600.000 karakter. Pisahkan dokumen sebelum analisis.");
  return Array.from({ length: Math.ceil(text.length / PART_SIZE) }, (_, index) => ({
    index, start: index * PART_SIZE, end: Math.min(text.length, (index + 1) * PART_SIZE),
    status: "pending", attempts: 0,
  }));
}

export function coverageNote(doc: VaultDocument) {
  return doc.extraction?.complete
    ? "Seluruh teks hasil ekstraksi tersedia. Kelengkapan isi dan ketepatan AI tetap perlu diverifikasi."
    : doc.extraction?.note || "Cakupan ekstraksi sumber lama/OCR tidak diketahui. Jangan anggap seluruh file telah terbaca; unggah ulang untuk pemeriksaan ekstraksi lokal.";
}

// Source coordinates are computed by the server, never trusted from model output.
export function locateEvidence(result: DocumentAnalysisResult, text: string, start: number, part: number, doc: VaultDocument) {
  for (const item of [...result.checklist, ...result.risks, ...result.regulations]) {
    delete item.source;
    if (!item.evidence.trim()) continue;
    const pattern = item.evidence.trim().split(/\s+/).map(word => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("\\s+");
    const match = new RegExp(pattern, "i").exec(text);
    if (!match) fail(502, "Bukti tidak ditemukan dalam bagian sumber.");
    item.evidence = match[0];
    const offset = start + match.index;
    const end = offset + match[0].length;
    const page = (doc.extraction?.pages ?? doc.ocrPages)?.find(p => p.start <= offset && p.end >= end)?.page;
    item.source = { part, start: offset, end, ...(page ? { page } : {}) };
  }
  return result;
}

// Deterministic merge retains EVERY successful section and its evidence; no
// extra provider request, selective synthesis, or loss of the last section.
export function mergeParts(parts: NonNullable<DocumentAnalysis["parts"]>): DocumentAnalysisResult {
  const done = parts.filter(p => p.status === "completed" && p.result);
  if (!done.length) return structuredClone(EMPTY_RESULT);
  return {
    category: done[0].result!.category,
    summary: done.map(p => `Bagian ${p.index + 1}: ${p.result!.summary}`).join("\n\n"),
    checklist: done.flatMap(p => p.result!.checklist.map(c => ({
      ...c, item: `Bagian ${p.index + 1}: ${c.item}`,
      // Absence in one section does not prove absence in the file.
      status: c.status === "tidak_ditemukan" ? "perlu_dicek" as const : c.status,
    }))),
    risks: done.flatMap(p => p.result!.risks),
    regulations: done.flatMap(p => p.result!.regulations),
  };
}
