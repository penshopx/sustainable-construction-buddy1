import { useState } from "react";
import { BookOpen } from "lucide-react";
import catalog from "@/data/lpjk-knowledge-catalog.json";

const labels: Record<string, string> = {
  keputusan_dan_surat: "Keputusan dan surat",
  paparan: "Materi paparan",
  paparan_dan_usulan: "Paparan dan usulan",
  perspektif_pelaku_usaha: "Perspektif pelaku usaha",
  format_skema: "Format skema LSBU",
  peraturan_pemerintah: "Peraturan Pemerintah",
  peraturan_menteri: "Peraturan Menteri",
  peraturan_presiden: "Peraturan Presiden",
  peraturan_lembaga: "Peraturan Lembaga",
  lampiran_peraturan: "Lampiran peraturan",
  publikasi_statistik: "Publikasi statistik BPS",
  tabel_pemetaan: "Tabel pemetaan salinan",
};

export default function SharedKnowledgeBase() {
  const [search, setSearch] = useState("");
  const documents = catalog.documents.filter(doc =>
    `${doc.id} ${doc.title} ${doc.fileName} ${labels[doc.kind]}`.toLowerCase().includes(search.toLowerCase()));
  const pageCount = catalog.documents.reduce((sum, doc) => sum + doc.pageCount, 0);
  const lineCount = catalog.documents.reduce((sum, doc) => sum + doc.lineCount, 0);
  const pdfCount = catalog.documents.filter(doc => doc.format === "pdf").length;
  const textCount = catalog.documents.filter(doc => doc.format === "text").length;
  return (
    <details className="mb-4 rounded-xl border border-border bg-card p-4">
      <summary className="cursor-pointer text-sm font-semibold text-foreground">
        <BookOpen aria-hidden className="mr-2 inline h-4 w-4" />
        Knowledge base rujukan bersama · {catalog.documents.length} dokumen · {pageCount} halaman PDF · {lineCount} baris teks
      </summary>
      <div className="mt-3 space-y-3">
        <p className="text-xs text-muted-foreground">
          Helpdesk memilih kutipan relevan dari {pdfCount} PDF dan {textCount} berkas teks unggahan. Rujukan PDF ditulis sebagai
          [KB04, hlm. 4], mengikuti urutan halaman PDF; rujukan teks memakai [KB45, baris 3].
          Ini bukan knowledge base pribadi Mentor,
          bukan bukti kesiapan SIJK, dan bukan pengganti keputusan otoritas resmi.
        </p>
        <label className="block text-sm">
          Cari sumber
          <input value={search} onChange={event => setSearch(event.target.value)} type="search"
            className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-foreground"
            placeholder="Judul, ID sumber, atau nama file" />
        </label>
        <ul className="grid gap-2 md:grid-cols-2" aria-label="Daftar sumber knowledge base">
          {documents.map(doc => <li key={doc.id} className="rounded-lg border border-border p-3 text-sm">
            <p className="font-semibold text-foreground">{doc.id} · {doc.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">{labels[doc.kind]} · {doc.format === "text"
              ? `${doc.entryCount} entri · ${doc.lineCount} baris teks`
              : `${doc.pageCount} halaman PDF`}</p>
            <p className="mt-1 break-all text-xs text-muted-foreground">{doc.fileName}</p>
            {doc.note && <p className="mt-2 text-xs text-foreground">Catatan sumber: {doc.note}</p>}
            {doc.visualSummaryPages.length > 0 && <p className="mt-2 text-xs text-muted-foreground">
              Halaman {doc.visualSummaryPages.join(", ")} berupa ringkasan visual pindai, bukan transkripsi lengkap.
            </p>}
          </li>)}
        </ul>
        {documents.length === 0 && <p role="status" className="text-sm text-muted-foreground">Tidak ada sumber yang cocok.</p>}
        <p className="text-xs text-muted-foreground">
          Jenis sumber dipertahankan: usulan dan perspektif bukan ketentuan yang telah berlaku.
          Detail tabel atau gambar yang tidak utuh dalam kutipan perlu diperiksa pada PDF asli.
          Lampiran PP 28/2025 yang tersedia hanya bagian yang diunggah, bukan klaim kelengkapan seluruh lampiran.
          Penambahan referensi ini tidak melatih ulang model AI dan tidak memperbarui regulasi secara otomatis.
        </p>
      </div>
    </details>
  );
}
