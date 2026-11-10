import html2pdf from "html2pdf.js";
import { PANCEK_PILLARS } from "@/lib/pancekIndicators";
import type { PancekAnswers } from "@/lib/pancekAnswerTypes";
import { calculatePillarScoresFromAnswers, calculateWeightedScore, countAnswered } from "@/lib/pancekAnswerTypes";
import type { PancekAssessment } from "@/hooks/usePancekAssessment";

interface VerificationDoc {
  url: string;
  name: string;
  uploaded_at: string;
}

interface LembarVerifikasiData {
  docs: VerificationDoc[];
  verification_date?: string;
  notes?: string;
}

function getVerificationData(answers: PancekAnswers): LembarVerifikasiData | undefined {
  const value: unknown = (answers as Record<string, unknown>).__lembar_verifikasi;
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  if (!Array.isArray(record.docs)) return undefined;
  const docs = record.docs.flatMap((doc) => {
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) return [];
    const entry = doc as Record<string, unknown>;
    return typeof entry.url === "string" && typeof entry.name === "string" && typeof entry.uploaded_at === "string"
      ? [{ url: entry.url, name: entry.name, uploaded_at: entry.uploaded_at }]
      : [];
  });
  return {
    docs,
    ...(typeof record.verification_date === "string" ? { verification_date: record.verification_date } : {}),
    ...(typeof record.notes === "string" ? { notes: record.notes } : {}),
  };
}

function scoreColor(pct: number): string {
  if (pct >= 80) return "#10b981";
  if (pct >= 50) return "#f59e0b";
  return "#ef4444";
}

function readinessLabel(pct: number): { text: string; color: string } {
  if (pct >= 80) return { text: "SIAP — Memenuhi Standar Antikorupsi", color: "#10b981" };
  if (pct >= 50) return { text: "PERLU PENINGKATAN — Sebagian Standar Terpenuhi", color: "#f59e0b" };
  return { text: "BELUM SIAP — Belum Memenuhi Standar", color: "#ef4444" };
}

export function exportLembarVerifikasiPdf(assessment: PancekAssessment) {
  const answers = assessment.answers as PancekAnswers;
  const pillarScores = calculatePillarScoresFromAnswers(answers, PANCEK_PILLARS);
  const weightedScore = calculateWeightedScore(answers, PANCEK_PILLARS);
  const totalAnswered = countAnswered(answers);
  const totalIndicators = PANCEK_PILLARS.reduce((s, p) => s + p.indicators.length, 0);
  const completionPct = Math.round((totalAnswered / totalIndicators) * 100);
  const heroColor = scoreColor(weightedScore);
  const readiness = readinessLabel(weightedScore);

  const lv = getVerificationData(answers);

  const date = new Date(assessment.updated_at).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  });

  const verificationDate = lv?.verification_date
    ? new Date(lv.verification_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
    : "-";

  // Pillar summary rows
  const pillarRows = PANCEK_PILLARS.map(p => {
    const score = pillarScores[p.id] || 0;
    const total = p.indicators.length;
    const pct = Math.round((score / total) * 100);
    const weightedContrib = Math.round((score / total) * p.weight * 100) / 100;
    return `<tr>
      <td style="padding:8px 10px;font-size:12px;border-bottom:1px solid #e5e7eb;">${p.icon} ${p.label}</td>
      <td style="padding:8px 10px;font-size:12px;text-align:center;border-bottom:1px solid #e5e7eb;">${p.weight}%</td>
      <td style="padding:8px 10px;font-size:12px;text-align:center;border-bottom:1px solid #e5e7eb;">${score}/${total}</td>
      <td style="padding:8px 10px;font-size:12px;text-align:center;border-bottom:1px solid #e5e7eb;font-weight:600;color:${scoreColor(pct)};">${pct}%</td>
      <td style="padding:8px 10px;font-size:12px;text-align:center;border-bottom:1px solid #e5e7eb;font-weight:600;">${weightedContrib}</td>
    </tr>`;
  }).join("");

  // Docs list
  const docsHtml = lv?.docs?.length
    ? lv.docs.map((d, i) =>
        `<tr>
          <td style="padding:6px 10px;font-size:11px;border-bottom:1px solid #f3f4f6;">${i + 1}</td>
          <td style="padding:6px 10px;font-size:11px;border-bottom:1px solid #f3f4f6;">📎 ${d.name}</td>
          <td style="padding:6px 10px;font-size:11px;border-bottom:1px solid #f3f4f6;color:#6b7280;">${new Date(d.uploaded_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</td>
        </tr>`
      ).join("")
    : `<tr><td colspan="3" style="padding:10px;font-size:11px;color:#9ca3af;text-align:center;">Belum ada dokumen terupload</td></tr>`;

  // Verification status
  let verStatusHtml = "";
  if (assessment.status === "verified") {
    verStatusHtml = `
      <div style="margin-top:16px;padding:14px;border:2px solid #10b981;border-radius:10px;background:#ecfdf5;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:20px;">✅</span>
          <div>
            <div style="font-weight:700;font-size:14px;color:#10b981;">TERVERIFIKASI OLEH ASOSIASI</div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px;">
              Verifikator: ${assessment.verified_by || "-"} 
              ${assessment.verified_at ? `• Tanggal: ${new Date(assessment.verified_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}` : ""}
            </div>
            ${assessment.verification_notes ? `<div style="font-size:11px;color:#6b7280;margin-top:4px;font-style:italic;">"${assessment.verification_notes}"</div>` : ""}
          </div>
        </div>
      </div>
    `;
  } else if (assessment.status === "submitted") {
    verStatusHtml = `
      <div style="margin-top:16px;padding:14px;border:2px solid #3b82f6;border-radius:10px;background:#eff6ff;">
        <div style="display:flex;align-items:center;gap:8px;">
          <span style="font-size:20px;">🕐</span>
          <div>
            <div style="font-weight:700;font-size:14px;color:#3b82f6;">MENUNGGU VERIFIKASI ASOSIASI</div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px;">Asesmen telah disubmit dan sedang menunggu verifikasi</div>
          </div>
        </div>
      </div>
    `;
  }

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:620px;margin:0 auto;padding:24px;color:#1f2937;">
      <!-- Official Header -->
      <div style="text-align:center;margin-bottom:8px;padding-bottom:12px;border-bottom:3px double #1f2937;">
        <p style="font-size:10px;color:#6b7280;margin:0 0 4px;">DOKUMEN RESMI — LAMPIRAN PERPANJANGAN SBU</p>
        <h1 style="font-size:18px;font-weight:800;margin:0;letter-spacing:0.5px;">LEMBAR VERIFIKASI</h1>
        <h2 style="font-size:14px;font-weight:600;margin:4px 0 0;color:#374151;">PENILAIAN PANCEK KPK</h2>
        <p style="font-size:11px;color:#6b7280;margin:4px 0 0;">Panduan Cegah Korupsi — Self-Assessment Antikorupsi Badan Usaha</p>
        <p style="font-size:10px;color:#9ca3af;margin:2px 0 0;">Berdasarkan Platform Jaga.id — Komisi Pemberantasan Korupsi</p>
      </div>

      <!-- Company Info Box -->
      <div style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <div style="background:#f9fafb;padding:8px 12px;border-bottom:1px solid #e5e7eb;">
          <span style="font-weight:600;font-size:12px;">IDENTITAS BADAN USAHA</span>
        </div>
        <div style="padding:12px;">
          <table style="width:100%;border-collapse:collapse;">
            <tr>
              <td style="font-size:11px;color:#6b7280;padding:3px 0;width:140px;">Nama Badan Usaha</td>
              <td style="font-size:12px;font-weight:600;padding:3px 0;">: ${assessment.company_name || "-"}</td>
            </tr>
            <tr>
              <td style="font-size:11px;color:#6b7280;padding:3px 0;">NPWP</td>
              <td style="font-size:12px;padding:3px 0;">: ${assessment.npwp || "-"}</td>
            </tr>
            <tr>
              <td style="font-size:11px;color:#6b7280;padding:3px 0;">NIB</td>
              <td style="font-size:12px;padding:3px 0;">: ${assessment.nib || "-"}</td>
            </tr>
            <tr>
              <td style="font-size:11px;color:#6b7280;padding:3px 0;">Periode Penilaian</td>
              <td style="font-size:12px;font-weight:600;padding:3px 0;">: Tahun ${assessment.period_year}</td>
            </tr>
            <tr>
              <td style="font-size:11px;color:#6b7280;padding:3px 0;">Tanggal Verifikasi Jaga.id</td>
              <td style="font-size:12px;padding:3px 0;">: ${verificationDate}</td>
            </tr>
            <tr>
              <td style="font-size:11px;color:#6b7280;padding:3px 0;">Terakhir Diperbarui</td>
              <td style="font-size:12px;padding:3px 0;">: ${date}</td>
            </tr>
          </table>
        </div>
      </div>

      <!-- Score Summary -->
      <div style="text-align:center;padding:20px;border:2px solid ${heroColor};border-radius:12px;margin-bottom:16px;background:${heroColor}10;">
        <div style="font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Skor Tertimbang Keseluruhan</div>
        <div style="font-size:52px;font-weight:900;color:${heroColor};line-height:1.1;">${weightedScore}</div>
        <div style="font-size:14px;color:#6b7280;">/ 100</div>
        <div style="margin-top:8px;padding:6px 16px;border-radius:20px;display:inline-block;background:${readiness.color}15;border:1px solid ${readiness.color}40;">
          <span style="font-size:11px;font-weight:700;color:${readiness.color};">${readiness.text}</span>
        </div>
        <div style="margin-top:8px;font-size:10px;color:#9ca3af;">${totalAnswered}/${totalIndicators} indikator terjawab (${completionPct}%)</div>
      </div>

      <!-- Pillar Breakdown Table -->
      <div style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <div style="background:#f9fafb;padding:8px 12px;border-bottom:1px solid #e5e7eb;">
          <span style="font-weight:600;font-size:12px;">RINCIAN SKOR PER PILAR</span>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:8px 10px;font-size:10px;color:#6b7280;text-align:left;border-bottom:1px solid #e5e7eb;">Pilar</th>
              <th style="padding:8px 10px;font-size:10px;color:#6b7280;text-align:center;border-bottom:1px solid #e5e7eb;">Bobot</th>
              <th style="padding:8px 10px;font-size:10px;color:#6b7280;text-align:center;border-bottom:1px solid #e5e7eb;">Skor</th>
              <th style="padding:8px 10px;font-size:10px;color:#6b7280;text-align:center;border-bottom:1px solid #e5e7eb;">Persentase</th>
              <th style="padding:8px 10px;font-size:10px;color:#6b7280;text-align:center;border-bottom:1px solid #e5e7eb;">Kontribusi</th>
            </tr>
          </thead>
          <tbody>
            ${pillarRows}
            <tr style="background:#f9fafb;">
              <td colspan="4" style="padding:8px 10px;font-size:12px;font-weight:700;text-align:right;">TOTAL SKOR TERTIMBANG</td>
              <td style="padding:8px 10px;font-size:14px;font-weight:800;text-align:center;color:${heroColor};">${weightedScore}</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${verStatusHtml}

      ${lv?.notes ? `
      <div style="margin-top:16px;padding:12px;border:1px solid #e5e7eb;border-radius:8px;background:#f9fafb;">
        <div style="font-size:11px;color:#6b7280;margin-bottom:4px;font-weight:600;">Catatan Verifikasi:</div>
        <div style="font-size:12px;color:#1f2937;font-style:italic;">"${lv.notes}"</div>
      </div>
      ` : ""}

      <!-- Documents Table -->
      <div style="margin-top:16px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
        <div style="background:#f0f9ff;padding:8px 12px;border-bottom:1px solid #e5e7eb;">
          <span style="font-weight:600;font-size:12px;">🛡️ DOKUMEN PENDUKUNG DARI JAGA.ID</span>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f9fafb;">
              <th style="padding:6px 10px;font-size:10px;color:#6b7280;text-align:left;width:30px;border-bottom:1px solid #e5e7eb;">No</th>
              <th style="padding:6px 10px;font-size:10px;color:#6b7280;text-align:left;border-bottom:1px solid #e5e7eb;">Nama Dokumen</th>
              <th style="padding:6px 10px;font-size:10px;color:#6b7280;text-align:left;border-bottom:1px solid #e5e7eb;">Tanggal Upload</th>
            </tr>
          </thead>
          <tbody>${docsHtml}</tbody>
        </table>
      </div>

      <!-- Signature Area -->
      <div style="margin-top:32px;display:flex;justify-content:space-between;">
        <div style="text-align:center;width:45%;">
          <p style="font-size:11px;color:#6b7280;margin:0;">Pimpinan Badan Usaha,</p>
          <div style="height:60px;"></div>
          <div style="border-top:1px solid #1f2937;padding-top:4px;">
            <p style="font-size:11px;font-weight:600;margin:0;">(................................................)</p>
            <p style="font-size:10px;color:#6b7280;margin:2px 0 0;">Nama & Jabatan</p>
          </div>
        </div>
        <div style="text-align:center;width:45%;">
          <p style="font-size:11px;color:#6b7280;margin:0;">Verifikator Asosiasi,</p>
          <div style="height:60px;"></div>
          <div style="border-top:1px solid #1f2937;padding-top:4px;">
            <p style="font-size:11px;font-weight:600;margin:0;">${assessment.verified_by ? assessment.verified_by : "(................................................)"}</p>
            <p style="font-size:10px;color:#6b7280;margin:2px 0 0;">Nama & Jabatan</p>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="text-align:center;margin-top:24px;padding-top:12px;border-top:1px solid #e5e7eb;">
        <p style="color:#9ca3af;font-size:9px;">Dokumen ini digenerate otomatis oleh sistem PUB ASPEKINDO</p>
        <p style="color:#9ca3af;font-size:9px;">Berdasarkan instrumen PANCEK KPK — 6 Pilar, 70 Indikator</p>
        <p style="color:#9ca3af;font-size:9px;">Bobot: Komitmen 25% • Perencanaan 10% • Pelaksanaan 25% • Evaluasi 15% • Perbaikan 15% • Respon 10%</p>
        <p style="color:#9ca3af;font-size:9px;">Dokumen ini sah sebagai lampiran perpanjangan SBU apabila telah diverifikasi oleh Asosiasi</p>
      </div>
    </div>
  `;

  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);

  html2pdf()
    .set({
      margin: [10, 8, 10, 8],
      filename: `Lembar-Verifikasi-PANCEK-${assessment.company_name || "BUJK"}-${assessment.period_year}.pdf`,
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
