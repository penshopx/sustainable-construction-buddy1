import html2pdf from "html2pdf.js";
import * as XLSX from "xlsx";

export interface PancekExportRow {
  company_name: string;
  full_name?: string;
  npwp: string;
  nib: string;
  period_year: number;
  status: string;
  completion_percent: number;
  komitmen_score: number; komitmen_total: number;
  perencanaan_score: number; perencanaan_total: number;
  pelaksanaan_score: number; pelaksanaan_total: number;
  evaluasi_score: number; evaluasi_total: number;
  perbaikan_score: number; perbaikan_total: number;
  respon_score: number; respon_total: number;
  verified_by: string;
  verified_at: string | null;
  verification_notes: string;
}

const WEIGHTS: { score: keyof Pick<PancekExportRow, "komitmen_score" | "perencanaan_score" | "pelaksanaan_score" | "evaluasi_score" | "perbaikan_score" | "respon_score">; total: keyof Pick<PancekExportRow, "komitmen_total" | "perencanaan_total" | "pelaksanaan_total" | "evaluasi_total" | "perbaikan_total" | "respon_total">; label: string; w: number }[] = [
  { score: "komitmen_score", total: "komitmen_total", label: "Komitmen", w: 25 },
  { score: "perencanaan_score", total: "perencanaan_total", label: "Perencanaan", w: 10 },
  { score: "pelaksanaan_score", total: "pelaksanaan_total", label: "Pelaksanaan", w: 25 },
  { score: "evaluasi_score", total: "evaluasi_total", label: "Evaluasi", w: 15 },
  { score: "perbaikan_score", total: "perbaikan_total", label: "Perbaikan", w: 15 },
  { score: "respon_score", total: "respon_total", label: "Respon", w: 10 },
];

function calcWeightedScore(r: PancekExportRow): number {
  let ws = 0;
  for (const p of WEIGHTS) {
    const sc = r[p.score] || 0;
    const tot = r[p.total] || 1;
    ws += (sc / tot) * p.w;
  }
  return Math.round(ws * 100) / 100;
}

const statusLabel = (s: string) => {
  switch (s) {
    case "submitted": return "Menunggu Verifikasi";
    case "verified": return "Terverifikasi";
    case "rejected": return "Ditolak";
    default: return "Draft";
  }
};

export function exportPancekExcel(rows: PancekExportRow[]) {
  const data = rows.map((r) => ({
    "Badan Usaha": r.company_name || "-",
    "Nama PIC": r.full_name || "-",
    "NPWP": r.npwp || "-",
    "NIB": r.nib || "-",
    "Periode": r.period_year,
    "Status": statusLabel(r.status),
    "Kelengkapan (%)": r.completion_percent,
    "Komitmen": `${r.komitmen_score}/${r.komitmen_total}`,
    "Perencanaan": `${r.perencanaan_score}/${r.perencanaan_total}`,
    "Pelaksanaan": `${r.pelaksanaan_score}/${r.pelaksanaan_total}`,
    "Evaluasi": `${r.evaluasi_score}/${r.evaluasi_total}`,
    "Perbaikan": `${r.perbaikan_score}/${r.perbaikan_total}`,
    "Respon": `${r.respon_score}/${r.respon_total}`,
    "Skor Tertimbang": calcWeightedScore(r),
    "Verifikator": r.verified_by || "-",
    "Tgl Verifikasi": r.verified_at ? new Date(r.verified_at).toLocaleDateString("id-ID") : "-",
    "Catatan Verifikasi": r.verification_notes || "-",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ringkasan PANCEK");
  XLSX.writeFile(wb, `Ringkasan_PANCEK_Asosiasi_${new Date().getFullYear()}.xlsx`);
}

export function exportPancekPdf(rows: PancekExportRow[]) {
  const now = new Date();
  const totalRows = rows.length;
  const verified = rows.filter(r => r.status === "verified").length;
  const submitted = rows.filter(r => r.status === "submitted").length;
  const rejected = rows.filter(r => r.status === "rejected").length;
  const draft = rows.filter(r => r.status === "draft").length;

  const tableRows = rows.map((r) => {
    const ws = calcWeightedScore(r);
    return `
      <tr>
        <td style="padding:6px 8px;border:1px solid #ddd;font-size:11px;">${r.company_name || "-"}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;font-size:11px;">${r.period_year}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;font-size:11px;text-align:center;">${r.completion_percent}%</td>
        <td style="padding:6px 8px;border:1px solid #ddd;font-size:11px;text-align:center;font-weight:bold;color:${ws >= 50 ? "#16a34a" : ws >= 30 ? "#d97706" : "#dc2626"}">${ws}</td>
        <td style="padding:6px 8px;border:1px solid #ddd;font-size:11px;text-align:center;">
          <span style="padding:2px 8px;border-radius:12px;font-size:10px;background:${
            r.status === "verified" ? "#dcfce7;color:#16a34a" :
            r.status === "submitted" ? "#e0f2fe;color:#0284c7" :
            r.status === "rejected" ? "#fee2e2;color:#dc2626" :
            "#f3f4f6;color:#6b7280"
          }">${statusLabel(r.status)}</span>
        </td>
        <td style="padding:6px 8px;border:1px solid #ddd;font-size:11px;">${r.verified_by || "-"}</td>
      </tr>
    `;
  }).join("");

  const html = `
    <div style="font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;padding:20px;max-width:800px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h2 style="margin:0;font-size:18px;color:#1e293b;">LAPORAN RINGKASAN VERIFIKASI PANCEK</h2>
        <p style="margin:4px 0 0;font-size:12px;color:#64748b;">Panduan Cegah Korupsi — Platform Jaga.id KPK</p>
        <p style="margin:2px 0 0;font-size:11px;color:#94a3b8;">Dicetak: ${now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>
      </div>

      <div style="display:flex;gap:12px;margin-bottom:20px;">
        <div style="flex:1;padding:12px;border-radius:8px;background:#f0f9ff;text-align:center;">
          <div style="font-size:22px;font-weight:bold;color:#0284c7;">${totalRows}</div>
          <div style="font-size:10px;color:#64748b;">Total Asesmen</div>
        </div>
        <div style="flex:1;padding:12px;border-radius:8px;background:#f0fdf4;text-align:center;">
          <div style="font-size:22px;font-weight:bold;color:#16a34a;">${verified}</div>
          <div style="font-size:10px;color:#64748b;">Terverifikasi</div>
        </div>
        <div style="flex:1;padding:12px;border-radius:8px;background:#fefce8;text-align:center;">
          <div style="font-size:22px;font-weight:bold;color:#d97706;">${submitted}</div>
          <div style="font-size:10px;color:#64748b;">Menunggu</div>
        </div>
        <div style="flex:1;padding:12px;border-radius:8px;background:#fef2f2;text-align:center;">
          <div style="font-size:22px;font-weight:bold;color:#dc2626;">${rejected}</div>
          <div style="font-size:10px;color:#64748b;">Ditolak</div>
        </div>
      </div>

      <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
        <thead>
          <tr style="background:#f1f5f9;">
            <th style="padding:8px;border:1px solid #ddd;font-size:11px;text-align:left;">Badan Usaha</th>
            <th style="padding:8px;border:1px solid #ddd;font-size:11px;text-align:center;">Periode</th>
            <th style="padding:8px;border:1px solid #ddd;font-size:11px;text-align:center;">Kelengkapan</th>
            <th style="padding:8px;border:1px solid #ddd;font-size:11px;text-align:center;">Skor</th>
            <th style="padding:8px;border:1px solid #ddd;font-size:11px;text-align:center;">Status</th>
            <th style="padding:8px;border:1px solid #ddd;font-size:11px;text-align:left;">Verifikator</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;">
        <p style="font-size:10px;color:#94a3b8;text-align:center;">
          Dokumen ini digenerate secara otomatis oleh Sistem Informasi PUB — Aspekindo.
        </p>
      </div>
    </div>
  `;

  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);

  html2pdf()
    .set({
      margin: [10, 10, 10, 10],
      filename: `Ringkasan_PANCEK_Asosiasi_${now.getFullYear()}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
    })
    .from(container)
    .save()
    .then(() => document.body.removeChild(container));
}
