import html2pdf from "html2pdf.js";

interface ComplianceRow {
  fullName: string;
  company: string;
  sbuNumber: string;
  sbuStatus: "valid" | "expiring" | "expired" | "missing";
  sbuDaysLeft: number | null;
  smap: boolean;
  tkk: boolean;
  gcg: boolean;
  smk3: boolean;
  score: number;
}

function sbuLabel(row: ComplianceRow): string {
  switch (row.sbuStatus) {
    case "valid": return `<span style="color:#10b981;font-weight:600;">✓ Aktif</span>`;
    case "expiring": return `<span style="color:#f59e0b;font-weight:600;">⏳ ${row.sbuDaysLeft}h</span>`;
    case "expired": return `<span style="color:#ef4444;font-weight:600;">✗ Expired</span>`;
    default: return `<span style="color:#9ca3af;">-</span>`;
  }
}

function boolIcon(val: boolean): string {
  return val
    ? `<span style="color:#10b981;font-weight:700;">✓</span>`
    : `<span style="color:#d1d5db;">✗</span>`;
}

function scoreColor(score: number): string {
  if (score >= 4) return "#10b981";
  if (score >= 2) return "#f59e0b";
  return "#ef4444";
}

export function exportCompliancePdf(rows: ComplianceRow[]) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  const totalBujk = rows.length;
  const sbuActive = rows.filter(r => r.sbuStatus === "valid" || r.sbuStatus === "expiring").length;
  const smapCount = rows.filter(r => r.smap).length;
  const tkkCount = rows.filter(r => r.tkk).length;
  const gcgCount = rows.filter(r => r.gcg).length;
  const smk3Count = rows.filter(r => r.smk3).length;
  const avgScore = totalBujk > 0 ? (rows.reduce((s, r) => s + r.score, 0) / totalBujk).toFixed(1) : "0";

  const tableRows = rows
    .map(
      (r, i) => `
      <tr style="background:${i % 2 === 0 ? "#ffffff" : "#f9fafb"};">
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;font-weight:500;">${r.fullName}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;color:#6b7280;">${r.company || "-"}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">${sbuLabel(r)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">${boolIcon(r.smap)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">${boolIcon(r.tkk)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">${boolIcon(r.gcg)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">${boolIcon(r.smk3)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">
          <span style="color:${scoreColor(r.score)};font-weight:700;">${r.score}/5</span>
        </td>
      </tr>`
    )
    .join("");

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:780px;margin:0 auto;padding:24px;color:#1f2937;">
      <!-- Header -->
      <div style="text-align:center;margin-bottom:20px;">
        <h1 style="font-size:18px;font-weight:700;margin:0;">LAPORAN KEPATUHAN BUJK</h1>
        <p style="color:#6b7280;font-size:12px;margin:4px 0;">PUB ASPEKINDO — Corporate Compliance Overview</p>
        <p style="color:#9ca3af;font-size:11px;margin:2px 0;">Digenerate: ${dateStr}</p>
      </div>

      <!-- Summary Cards -->
      <div style="display:flex;gap:8px;margin-bottom:20px;">
        ${[
          { label: "Total BUJK", value: totalBujk },
          { label: "SBU Aktif", value: `${sbuActive}/${totalBujk}` },
          { label: "SMAP", value: `${smapCount}/${totalBujk}` },
          { label: "TKK", value: `${tkkCount}/${totalBujk}` },
          { label: "GCG", value: `${gcgCount}/${totalBujk}` },
          { label: "SMK3", value: `${smk3Count}/${totalBujk}` },
          { label: "Rata-rata Skor", value: avgScore },
        ]
          .map(
            (s) => `<div style="flex:1;text-align:center;padding:10px 4px;background:#f3f4f6;border-radius:8px;border:1px solid #e5e7eb;">
              <div style="font-size:10px;color:#6b7280;">${s.label}</div>
              <div style="font-size:16px;font-weight:700;">${s.value}</div>
            </div>`
          )
          .join("")}
      </div>

      <!-- Table -->
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#1f2937;color:#ffffff;">
            <th style="padding:10px;font-size:11px;text-align:left;font-weight:600;">Nama</th>
            <th style="padding:10px;font-size:11px;text-align:left;font-weight:600;">Perusahaan</th>
            <th style="padding:10px;font-size:11px;text-align:center;font-weight:600;">SBU</th>
            <th style="padding:10px;font-size:11px;text-align:center;font-weight:600;">SMAP</th>
            <th style="padding:10px;font-size:11px;text-align:center;font-weight:600;">TKK</th>
            <th style="padding:10px;font-size:11px;text-align:center;font-weight:600;">GCG</th>
            <th style="padding:10px;font-size:11px;text-align:center;font-weight:600;">SMK3</th>
            <th style="padding:10px;font-size:11px;text-align:center;font-weight:600;">Skor</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>

      <!-- Risk Highlight -->
      ${rows.filter(r => r.score < 3).length > 0 ? `
      <div style="margin-top:16px;padding:12px;background:#fef2f2;border:1px solid #fecaca;border-radius:8px;">
        <p style="font-size:12px;font-weight:600;color:#ef4444;margin:0 0 4px 0;">⚠ BUJK Perlu Perhatian (Skor &lt; 3/5):</p>
        <ul style="margin:0;padding-left:20px;">
          ${rows.filter(r => r.score < 3).map(r => `<li style="font-size:11px;color:#6b7280;">${r.fullName} (${r.company || "-"}) — Skor ${r.score}/5</li>`).join("")}
        </ul>
      </div>` : ""}

      <!-- Footer -->
      <div style="text-align:center;margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;">
        <p style="color:#9ca3af;font-size:10px;">Dokumen ini digenerate otomatis oleh sistem PUB ASPEKINDO</p>
        <p style="color:#9ca3af;font-size:10px;">Berdasarkan data LKUT terbaru — SBU, SMAP, TKK, GCG, SMK3</p>
      </div>
    </div>
  `;

  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);

  html2pdf()
    .set({
      margin: [8, 8, 8, 8],
      filename: `Kepatuhan-BUJK-${now.toISOString().slice(0, 10)}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "landscape" },
    })
    .from(container)
    .save()
    .then(() => {
      document.body.removeChild(container);
    });
}
