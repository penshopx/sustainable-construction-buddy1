import html2pdf from "html2pdf.js";

interface LkutRow {
  report_year: number;
  status: string;
  sbu_number: string;
  sbu_expiry_date: string | null;
  smap_fulfilled: boolean;
  tkk_replacement: boolean;
  gcg_applied: boolean;
  smk3_applied: boolean;
  asset_value_current: number;
  sales_value: number;
  total_employees: number;
  trained_employees: number;
}

interface GradeRow {
  period: string;
  grade: string;
  total_score: number;
  financial_score: number;
  project_score: number;
  compliance_score: number;
  risk_score: number;
}

interface ProjectRow {
  name: string;
  status: string;
  risk_class: string;
  value_amount: number;
}

interface RiskRow {
  risk_description: string;
  risk_level: string | null;
  status: string;
  probability_score: number;
  impact_score: number;
}

interface BujkDetailPdfData {
  fullName: string;
  company: string;
  lkutReports: LkutRow[];
  grades: GradeRow[];
  projects: ProjectRow[];
  risks: RiskRow[];
}

const boolIcon = (v: boolean) => v
  ? `<span style="color:#10b981;font-weight:700;">✓</span>`
  : `<span style="color:#d1d5db;">✗</span>`;

const gradeColorHex = (grade: string) => {
  if (grade.startsWith("A")) return "#10b981";
  if (grade.startsWith("B")) return "#0ea5e9";
  if (grade.startsWith("C")) return "#f59e0b";
  return "#ef4444";
};

const riskColorHex = (level: string | null) => {
  if (!level) return "#9ca3af";
  if (level === "extreme" || level === "high") return "#ef4444";
  if (level === "medium") return "#f59e0b";
  return "#10b981";
};

const statusLabel = (status: string) => {
  const map: Record<string, string> = {
    active: "Aktif", completed: "Selesai", on_hold: "Ditunda",
    open: "Terbuka", mitigated: "Dimitigasi", closed: "Ditutup",
  };
  return map[status] || status;
};

function sbuStatusHtml(sbuNumber: string, expiryDate: string | null): string {
  if (!sbuNumber) return `<span style="color:#9ca3af;">Tidak Ada</span>`;
  if (!expiryDate) return `<span style="color:#10b981;font-weight:600;">✓ Aktif</span>`;
  const days = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / 86400000);
  if (days < 0) return `<span style="color:#ef4444;font-weight:600;">✗ Expired</span>`;
  if (days <= 90) return `<span style="color:#f59e0b;font-weight:600;">⏳ ${days}h</span>`;
  return `<span style="color:#10b981;font-weight:600;">✓ Aktif (${days}h)</span>`;
}

export function exportBujkDetailPdf(data: BujkDetailPdfData) {
  const now = new Date();
  const dateStr = now.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });

  // Compliance summary
  const complianceRows = data.lkutReports.map(r => {
    const fulfilled = [!!r.sbu_number, !!r.smap_fulfilled, !!r.tkk_replacement, !!r.gcg_applied, !!r.smk3_applied].filter(Boolean).length;
    return `
      <tr>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;font-weight:600;">${r.report_year}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">${r.status === "submitted" ? '<span style="color:#10b981;">Terkirim</span>' : '<span style="color:#9ca3af;">Draft</span>'}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">${sbuStatusHtml(r.sbu_number, r.sbu_expiry_date)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">${boolIcon(!!r.smap_fulfilled)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">${boolIcon(!!r.tkk_replacement)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">${boolIcon(!!r.gcg_applied)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">${boolIcon(!!r.smk3_applied)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">
          <span style="color:${fulfilled >= 4 ? '#10b981' : fulfilled >= 2 ? '#f59e0b' : '#ef4444'};font-weight:700;">${fulfilled}/5</span>
        </td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;text-align:right;color:#6b7280;">
          ${r.asset_value_current > 0 ? `Rp ${(r.asset_value_current / 1e6).toFixed(0)} jt` : "-"}
        </td>
        <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;text-align:right;color:#6b7280;">
          ${r.total_employees > 0 ? `${r.trained_employees}/${r.total_employees}` : "-"}
        </td>
      </tr>`;
  }).join("");

  // Grading rows
  const gradingRows = [...data.grades].reverse().map(g => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;">${g.period}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">
        <span style="color:${gradeColorHex(g.grade)};font-weight:700;">${g.grade}</span>
      </td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;font-weight:700;">${Number(g.total_score).toFixed(1)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">${Number(g.financial_score)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">${Number(g.project_score)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">${Number(g.compliance_score)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">${Number(g.risk_score)}</td>
    </tr>
  `).join("");

  // Project rows
  const projectRows = data.projects.map(p => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;">${p.name}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">${statusLabel(p.status)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">
        <span style="color:${riskColorHex(p.risk_class)};font-weight:600;">${p.risk_class}</span>
      </td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:right;color:#6b7280;">
        ${p.value_amount > 0 ? `Rp ${(p.value_amount / 1e9).toFixed(2)} M` : "-"}
      </td>
    </tr>
  `).join("");

  // Risk rows
  const riskRows = data.risks.map(r => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:11px;max-width:200px;">${r.risk_description}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">
        <span style="color:${riskColorHex(r.risk_level)};font-weight:600;">${r.risk_level || "-"}</span>
      </td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;font-weight:600;">${r.probability_score}×${r.impact_score}=${r.probability_score * r.impact_score}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e5e7eb;font-size:12px;text-align:center;">${statusLabel(r.status)}</td>
    </tr>
  `).join("");

  const thStyle = `padding:8px 10px;font-size:11px;font-weight:600;text-align:center;`;
  const sectionTitle = (icon: string, title: string) =>
    `<h2 style="font-size:14px;font-weight:700;margin:24px 0 8px 0;display:flex;align-items:center;gap:6px;">${icon} ${title}</h2>`;

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:780px;margin:0 auto;padding:24px;color:#1f2937;">
      <!-- Header -->
      <div style="text-align:center;margin-bottom:20px;border-bottom:2px solid #1f2937;padding-bottom:16px;">
        <h1 style="font-size:18px;font-weight:700;margin:0;">LAPORAN DETAIL BUJK</h1>
        <p style="color:#6b7280;font-size:13px;margin:4px 0;">PUB ASPEKINDO — Riwayat Kepatuhan & Kinerja</p>
        <p style="color:#9ca3af;font-size:11px;margin:2px 0;">Digenerate: ${dateStr}</p>
      </div>

      <!-- Identity -->
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:14px 16px;margin-bottom:8px;">
        <table style="width:100%;">
          <tr>
            <td style="font-size:12px;color:#6b7280;width:120px;">Nama Lengkap</td>
            <td style="font-size:14px;font-weight:600;">${data.fullName}</td>
          </tr>
          <tr>
            <td style="font-size:12px;color:#6b7280;">Perusahaan</td>
            <td style="font-size:14px;font-weight:600;">${data.company || "-"}</td>
          </tr>
        </table>
      </div>

      <!-- Section: Kepatuhan -->
      ${sectionTitle("🛡️", "Riwayat Kepatuhan (LKUT)")}
      ${data.lkutReports.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#1f2937;color:#fff;">
            <th style="${thStyle}text-align:left;">Tahun</th>
            <th style="${thStyle}">Status</th>
            <th style="${thStyle}">SBU</th>
            <th style="${thStyle}">SMAP</th>
            <th style="${thStyle}">TKK</th>
            <th style="${thStyle}">GCG</th>
            <th style="${thStyle}">SMK3</th>
            <th style="${thStyle}">Skor</th>
            <th style="${thStyle}text-align:right;">Aset</th>
            <th style="${thStyle}text-align:right;">SDM</th>
          </tr>
        </thead>
        <tbody>${complianceRows}</tbody>
      </table>` : `<p style="color:#9ca3af;font-size:12px;text-align:center;">Belum ada data LKUT.</p>`}

      <!-- Section: Grading -->
      ${sectionTitle("📊", "Riwayat Grading Kinerja")}
      ${data.grades.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#1f2937;color:#fff;">
            <th style="${thStyle}text-align:left;">Periode</th>
            <th style="${thStyle}">Grade</th>
            <th style="${thStyle}">Total</th>
            <th style="${thStyle}">Keuangan</th>
            <th style="${thStyle}">Proyek</th>
            <th style="${thStyle}">Kepatuhan</th>
            <th style="${thStyle}">Risiko</th>
          </tr>
        </thead>
        <tbody>${gradingRows}</tbody>
      </table>` : `<p style="color:#9ca3af;font-size:12px;text-align:center;">Belum ada data grading.</p>`}

      <!-- Section: Proyek -->
      ${sectionTitle("📁", "Daftar Proyek")}
      ${data.projects.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#1f2937;color:#fff;">
            <th style="${thStyle}text-align:left;">Nama Proyek</th>
            <th style="${thStyle}">Status</th>
            <th style="${thStyle}">Kelas Risiko</th>
            <th style="${thStyle}text-align:right;">Nilai</th>
          </tr>
        </thead>
        <tbody>${projectRows}</tbody>
      </table>` : `<p style="color:#9ca3af;font-size:12px;text-align:center;">Belum ada proyek.</p>`}

      <!-- Section: Risiko -->
      ${sectionTitle("⚠️", "Register Risiko")}
      ${data.risks.length > 0 ? `
      <table style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <thead>
          <tr style="background:#1f2937;color:#fff;">
            <th style="${thStyle}text-align:left;">Deskripsi</th>
            <th style="${thStyle}">Level</th>
            <th style="${thStyle}">P×I</th>
            <th style="${thStyle}">Status</th>
          </tr>
        </thead>
        <tbody>${riskRows}</tbody>
      </table>` : `<p style="color:#9ca3af;font-size:12px;text-align:center;">Belum ada data risiko.</p>`}

      <!-- Footer -->
      <div style="text-align:center;margin-top:28px;padding-top:12px;border-top:1px solid #e5e7eb;">
        <p style="color:#9ca3af;font-size:10px;">Dokumen ini digenerate otomatis oleh sistem PUB ASPEKINDO</p>
        <p style="color:#9ca3af;font-size:10px;">Mencakup data Kepatuhan, Grading, Proyek, dan Risiko</p>
      </div>
    </div>
  `;

  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);

  html2pdf()
    .set({
      margin: [8, 8, 8, 8],
      filename: `Detail-BUJK-${data.fullName.replace(/\s+/g, "-")}-${now.toISOString().slice(0, 10)}.pdf`,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
    })
    .from(container)
    .save()
    .then(() => {
      document.body.removeChild(container);
    });
}
