import type { VaultSource } from "@workspace/api-zod";
import { retrieveKnowledge } from "./knowledge-base";
import { fail } from "./vault-errors";

export const COMPARISON_POLICY =
  "Mode perbandingan referensi. Pisahkan jawaban menjadi: Isi dokumen pengguna [1]; " +
  "Referensi eksternal [2] dan seterusnya; Perbedaan dan hal yang perlu diverifikasi. " +
  "Setiap temuan harus didukung kutipan persis dari sumber terkait. Nomor kutipan mengikuti urutan sumber. " +
  "Jangan menganggap isi referensi eksternal tercantum dalam dokumen pengguna. " +
  "Jika teks yang diberikan tidak cukup, nyatakan tidak ditemukan pada cuplikan, bukan tidak ada di seluruh file. " +
  "KB46 adalah materi paparan/OCR pendukung implementasi Permen PU 6/2025, bukan naskah resmi atau rujukan tunggal. " +
  "Baca bersama naskah resmi dan aturan turunannya sesuai bukti. Permen PUPR 7/2024 tidak otomatis turunan Permen PU 6/2025. " +
  "Catat potensi kesalahan OCR dan keterbatasan kutipan tabel. Tidak ada penelusuran hukum terbaru; " +
  "jangan menyimpulkan kepatuhan, keabsahan, pencabutan, kelulusan sertifikasi, atau kewajiban tanpa bukti. " +
  "Hasil hanya bantuan telaah, bukan keputusan resmi atau nasihat hukum.";

export function comparisonSources(question: string): VaultSource[] {
  const excerpts = retrieveKnowledge(question);
  const seen = new Set<string>();
  const documents = new Set<string>();
  const primary: typeof excerpts = [], additional: typeof excerpts = [];
  for (const excerpt of excerpts) {
    (documents.has(excerpt.id) ? additional : primary).push(excerpt);
    documents.add(excerpt.id);
  }
  const sources: VaultSource[] = [];
  let characters = 0;
  for (const excerpt of [...primary, ...additional]) {
    const key = `${excerpt.id}:${excerpt.page}:${excerpt.lineStart}`;
    if (seen.has(key) || sources.length >= 4 || characters + excerpt.text.length > 5000) continue;
    seen.add(key);
    characters += excerpt.text.length;
    sources.push({
      id: key,
      name: `REFERENSI EKSTERNAL — ${excerpt.id} — ${excerpt.title} (${excerpt.kind}; ${
        excerpt.page ? `halaman PDF fisik ${excerpt.page}` : `baris ${excerpt.lineStart}`
      }; ${excerpt.method}). Catatan sumber: ${excerpt.note}`,
      quote: excerpt.text,
    });
  }
  if (!sources.length) fail(422, "Referensi yang cocok tidak ditemukan di knowledge base. Sebutkan nomor peraturan atau ID sumber, misalnya KB19 atau KB46. Belum ada permintaan AI yang dikirim.");
  return sources;
}
