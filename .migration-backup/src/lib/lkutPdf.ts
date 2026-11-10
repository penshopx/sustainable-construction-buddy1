import html2pdf from "html2pdf.js";
import { LkutReport } from "@/hooks/useLkutReports";

function fmt(val: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(val);
}

function fmtDate(d: string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
}

function yesNo(v: boolean | null): string {
  if (v === null || v === undefined) return "-";
  return v ? "Ya" : "Tidak";
}

function ratio(a: number, b: number, decimals = 2): string {
  if (!b || b === 0) return "-";
  return (a / b).toFixed(decimals);
}

function buildHtml(report: LkutReport, profile?: { full_name: string; company: string }): string {
  const currentRatio = ratio(report.current_assets, report.short_term_liabilities);
  const debtEquity = ratio(report.total_liabilities, report.total_equity);
  const profitMargin = report.sales_value > 0 ? ((report.gross_profit / report.sales_value) * 100).toFixed(1) + "%" : "-";
  const trainedPct = report.total_employees > 0 ? ((report.trained_employees / report.total_employees) * 100).toFixed(1) + "%" : "-";

  return `
<div style="font-family: 'Times New Roman', serif; color: #111; padding: 20px; max-width: 210mm;">
  <!-- Header -->
  <div style="text-align: center; margin-bottom: 24px;">
    <h2 style="margin: 0; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">
      LAPORAN KEGIATAN USAHA TAHUNAN (LKUT)
    </h2>
    <h3 style="margin: 4px 0 0; font-size: 14px; font-weight: normal;">
      Badan Usaha Jasa Konstruksi — Tahun ${report.report_year}
    </h3>
    <p style="margin: 4px 0 0; font-size: 11px; color: #555;">
      Sesuai Peraturan Menteri PUPR No. 7 Tahun 2024
    </p>
  </div>

  <!-- Info Perusahaan -->
  <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px;">
    <tr>
      <td style="padding: 4px 8px; width: 180px; font-weight: bold;">Nama Perusahaan</td>
      <td style="padding: 4px 8px;">: ${profile?.company || "-"}</td>
    </tr>
    <tr>
      <td style="padding: 4px 8px; font-weight: bold;">Penanggung Jawab</td>
      <td style="padding: 4px 8px;">: ${profile?.full_name || "-"}</td>
    </tr>
    <tr>
      <td style="padding: 4px 8px; font-weight: bold;">Nomor SBU</td>
      <td style="padding: 4px 8px;">: ${report.sbu_number || "-"}</td>
    </tr>
    <tr>
      <td style="padding: 4px 8px; font-weight: bold;">Tipe SBU</td>
      <td style="padding: 4px 8px;">: ${report.sbu_type === "perpanjangan" ? "Perpanjangan" : "Baru"}</td>
    </tr>
    <tr>
      <td style="padding: 4px 8px; font-weight: bold;">Berlaku Sampai</td>
      <td style="padding: 4px 8px;">: ${fmtDate(report.sbu_expiry_date)}</td>
    </tr>
    <tr>
      <td style="padding: 4px 8px; font-weight: bold;">Status Laporan</td>
      <td style="padding: 4px 8px;">: ${report.status === "submitted" ? "Terkirim" : report.status === "validated" ? "Tervalidasi" : "Draft"}</td>
    </tr>
  </table>

  <!-- A. KEPATUHAN PERIZINAN -->
  <h3 style="font-size: 13px; border-bottom: 2px solid #1a365d; padding-bottom: 4px; margin: 20px 0 12px; color: #1a365d;">
    A. DATA KEPATUHAN PERIZINAN
  </h3>
  <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
    <thead>
      <tr style="background: #1a365d; color: white;">
        <th style="padding: 6px 8px; text-align: left; width: 30px;">No</th>
        <th style="padding: 6px 8px; text-align: left;">Aspek Kepatuhan</th>
        <th style="padding: 6px 8px; text-align: center; width: 100px;">Status</th>
        <th style="padding: 6px 8px; text-align: left;">Keterangan</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 6px 8px;">1</td>
        <td style="padding: 6px 8px;">Penggantian TKK (PJBU/PJTBU/PJSKBU)</td>
        <td style="padding: 6px 8px; text-align: center;">${yesNo(report.tkk_replacement)}</td>
        <td style="padding: 6px 8px;">${report.tkk_replacement ? `${fmtDate(report.tkk_replacement_date)} — ${report.tkk_replacement_notes || "-"}` : "-"}</td>
      </tr>
      <tr style="border-bottom: 1px solid #ddd; background: #f9fafb;">
        <td style="padding: 6px 8px;">2</td>
        <td style="padding: 6px 8px;">Pemenuhan Komitmen Peralatan Utama</td>
        <td style="padding: 6px 8px; text-align: center;">${yesNo(report.equipment_commitment_fulfilled)}</td>
        <td style="padding: 6px 8px;">${report.equipment_commitment_fulfilled ? fmtDate(report.equipment_fulfillment_date) : "-"}</td>
      </tr>
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 6px 8px;">3</td>
        <td style="padding: 6px 8px;">Pelaksanaan SMAP</td>
        <td style="padding: 6px 8px; text-align: center;">${yesNo(report.smap_fulfilled)}</td>
        <td style="padding: 6px 8px;">${report.smap_fulfilled ? fmtDate(report.smap_report_date) : "-"}</td>
      </tr>
      <tr style="border-bottom: 1px solid #ddd; background: #f9fafb;">
        <td style="padding: 6px 8px;">4</td>
        <td style="padding: 6px 8px;">Pencatatan Pengalaman di SIJKT</td>
        <td style="padding: 6px 8px; text-align: center;">${yesNo(report.experience_records_complete)}</td>
        <td style="padding: 6px 8px;">${!report.experience_records_complete && report.experience_pending_list ? report.experience_pending_list : "-"}</td>
      </tr>
    </tbody>
  </table>

  <!-- B. DATA KEUANGAN -->
  <h3 style="font-size: 13px; border-bottom: 2px solid #1a365d; padding-bottom: 4px; margin: 20px 0 12px; color: #1a365d;">
    B. DATA KEUANGAN PERUSAHAAN
  </h3>
  <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
    <thead>
      <tr style="background: #1a365d; color: white;">
        <th style="padding: 6px 8px; text-align: left; width: 30px;">No</th>
        <th style="padding: 6px 8px; text-align: left;">Uraian</th>
        <th style="padding: 6px 8px; text-align: right; width: 180px;">Nilai (Rp)</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 6px 8px;">1</td>
        <td style="padding: 6px 8px;">Nilai Aset Tahun ${report.report_year}</td>
        <td style="padding: 6px 8px; text-align: right;">${fmt(report.asset_value_current)}</td>
      </tr>
      <tr style="border-bottom: 1px solid #ddd; background: #f9fafb;">
        <td style="padding: 6px 8px;">2</td>
        <td style="padding: 6px 8px;">Nilai Aset Tahun ${report.report_year - 1}</td>
        <td style="padding: 6px 8px; text-align: right;">${fmt(report.asset_value_previous)}</td>
      </tr>
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 6px 8px;">3</td>
        <td style="padding: 6px 8px;">Nilai Penjualan / Total Proyek</td>
        <td style="padding: 6px 8px; text-align: right;">${fmt(report.sales_value)}</td>
      </tr>
      <tr style="border-bottom: 1px solid #ddd; background: #f9fafb;">
        <td style="padding: 6px 8px;">4</td>
        <td style="padding: 6px 8px;">Laba Kotor</td>
        <td style="padding: 6px 8px; text-align: right;">${fmt(report.gross_profit)}</td>
      </tr>
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 6px 8px;">5</td>
        <td style="padding: 6px 8px;">Aset Lancar</td>
        <td style="padding: 6px 8px; text-align: right;">${fmt(report.current_assets)}</td>
      </tr>
      <tr style="border-bottom: 1px solid #ddd; background: #f9fafb;">
        <td style="padding: 6px 8px;">6</td>
        <td style="padding: 6px 8px;">Kewajiban Jangka Pendek</td>
        <td style="padding: 6px 8px; text-align: right;">${fmt(report.short_term_liabilities)}</td>
      </tr>
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 6px 8px;">7</td>
        <td style="padding: 6px 8px;">Total Kewajiban</td>
        <td style="padding: 6px 8px; text-align: right;">${fmt(report.total_liabilities)}</td>
      </tr>
      <tr style="border-bottom: 1px solid #ddd; background: #f9fafb;">
        <td style="padding: 6px 8px;">8</td>
        <td style="padding: 6px 8px;">Total Ekuitas</td>
        <td style="padding: 6px 8px; text-align: right;">${fmt(report.total_equity)}</td>
      </tr>
    </tbody>
  </table>

  <!-- Rasio Keuangan -->
  <div style="margin: 16px 0; padding: 12px; background: #f0f4f8; border-radius: 4px; font-size: 11px;">
    <p style="font-weight: bold; margin: 0 0 8px; font-size: 12px;">Rasio Keuangan:</p>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 3px 0; width: 180px;">Current Ratio</td>
        <td style="padding: 3px 0; font-weight: bold;">: ${currentRatio}</td>
        <td style="padding: 3px 0; width: 180px;">Debt-to-Equity Ratio</td>
        <td style="padding: 3px 0; font-weight: bold;">: ${debtEquity}</td>
      </tr>
      <tr>
        <td style="padding: 3px 0;">Profit Margin</td>
        <td style="padding: 3px 0; font-weight: bold;">: ${profitMargin}</td>
        <td style="padding: 3px 0;">Pertumbuhan Aset</td>
        <td style="padding: 3px 0; font-weight: bold;">: ${report.asset_value_previous > 0 ? (((report.asset_value_current - report.asset_value_previous) / report.asset_value_previous) * 100).toFixed(1) + "%" : "-"}</td>
      </tr>
    </table>
  </div>

  <!-- C. KESEHATAN ORGANISASI -->
  <h3 style="font-size: 13px; border-bottom: 2px solid #1a365d; padding-bottom: 4px; margin: 20px 0 12px; color: #1a365d;">
    C. DATA KESEHATAN ORGANISASI
  </h3>
  <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
    <thead>
      <tr style="background: #1a365d; color: white;">
        <th style="padding: 6px 8px; text-align: left; width: 30px;">No</th>
        <th style="padding: 6px 8px; text-align: left;">Aspek</th>
        <th style="padding: 6px 8px; text-align: center; width: 80px;">Status</th>
        <th style="padding: 6px 8px; text-align: left;">Keterangan</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 6px 8px;">1</td>
        <td style="padding: 6px 8px;">Penerapan GCG</td>
        <td style="padding: 6px 8px; text-align: center;">${yesNo(report.gcg_applied)}</td>
        <td style="padding: 6px 8px;">${report.gcg_applied && report.gcg_first_year ? `Sejak tahun ${report.gcg_first_year}` : "-"}</td>
      </tr>
      <tr style="border-bottom: 1px solid #ddd; background: #f9fafb;">
        <td style="padding: 6px 8px;">2</td>
        <td style="padding: 6px 8px;">Penerapan SMK3</td>
        <td style="padding: 6px 8px; text-align: center;">${yesNo(report.smk3_applied)}</td>
        <td style="padding: 6px 8px;">${report.smk3_applied && report.smk3_first_year ? `Sejak tahun ${report.smk3_first_year}` : "-"}</td>
      </tr>
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 6px 8px;">3</td>
        <td style="padding: 6px 8px;">Sertifikasi</td>
        <td style="padding: 6px 8px; text-align: center;">${report.certifications ? "Ada" : "-"}</td>
        <td style="padding: 6px 8px;">${report.certifications || "-"}</td>
      </tr>
      <tr style="border-bottom: 1px solid #ddd; background: #f9fafb;">
        <td style="padding: 6px 8px;">4</td>
        <td style="padding: 6px 8px;">Penghargaan</td>
        <td style="padding: 6px 8px; text-align: center;">${report.awards ? "Ada" : "-"}</td>
        <td style="padding: 6px 8px;">${report.awards || "-"}</td>
      </tr>
    </tbody>
  </table>

  <!-- D. SDM -->
  <h3 style="font-size: 13px; border-bottom: 2px solid #1a365d; padding-bottom: 4px; margin: 20px 0 12px; color: #1a365d;">
    D. DATA SUMBER DAYA MANUSIA
  </h3>
  <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
    <thead>
      <tr style="background: #1a365d; color: white;">
        <th style="padding: 6px 8px; text-align: left; width: 30px;">No</th>
        <th style="padding: 6px 8px; text-align: left;">Uraian</th>
        <th style="padding: 6px 8px; text-align: right; width: 120px;">Jumlah</th>
      </tr>
    </thead>
    <tbody>
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 6px 8px;">1</td>
        <td style="padding: 6px 8px;">Total Karyawan (Tetap + Kontrak)</td>
        <td style="padding: 6px 8px; text-align: right;">${report.total_employees}</td>
      </tr>
      <tr style="border-bottom: 1px solid #ddd; background: #f9fafb;">
        <td style="padding: 6px 8px;">2</td>
        <td style="padding: 6px 8px;">Karyawan Terlatih (min. 3 hari pelatihan)</td>
        <td style="padding: 6px 8px; text-align: right;">${report.trained_employees} (${trainedPct})</td>
      </tr>
      <tr style="border-bottom: 1px solid #ddd;">
        <td style="padding: 6px 8px;">3</td>
        <td style="padding: 6px 8px;">Tenaga Ahli Tetap</td>
        <td style="padding: 6px 8px; text-align: right;">${report.permanent_experts}</td>
      </tr>
      <tr style="border-bottom: 1px solid #ddd; background: #f9fafb;">
        <td style="padding: 6px 8px;">4</td>
        <td style="padding: 6px 8px;">Tenaga Ahli Kontrak</td>
        <td style="padding: 6px 8px; text-align: right;">${report.contract_experts}</td>
      </tr>
    </tbody>
  </table>

  ${report.notes ? `
  <!-- Catatan -->
  <h3 style="font-size: 13px; border-bottom: 2px solid #1a365d; padding-bottom: 4px; margin: 20px 0 12px; color: #1a365d;">
    E. CATATAN TAMBAHAN
  </h3>
  <p style="font-size: 11px; line-height: 1.6; white-space: pre-wrap;">${report.notes}</p>
  ` : ""}

  <!-- Footer -->
  <div style="margin-top: 40px; font-size: 11px;">
    <div style="float: right; text-align: center; width: 250px;">
      <p style="margin: 0;">........................................, ${fmtDate(report.submitted_at || new Date().toISOString())}</p>
      <p style="margin: 4px 0;">Penanggung Jawab Badan Usaha</p>
      <div style="height: 60px;"></div>
      <p style="margin: 0; font-weight: bold; text-decoration: underline;">${profile?.full_name || "________________________"}</p>
    </div>
    <div style="clear: both;"></div>
  </div>

  <div style="margin-top: 20px; border-top: 1px solid #ccc; padding-top: 8px; font-size: 9px; color: #888; text-align: center;">
    Dokumen ini dibuat secara digital melalui PUB ASPEKINDO · Permen PUPR No. 7/2024
  </div>
</div>`;
}

export async function exportLkutPdf(report: LkutReport, profile?: { full_name: string; company: string }): Promise<void> {
  const html = buildHtml(report, profile);
  
  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);

  try {
    await html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename: `LKUT-${report.report_year}-${report.sbu_number || "draft"}.pdf`,
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
      })
      .from(container)
      .save();
  } finally {
    document.body.removeChild(container);
  }
}
