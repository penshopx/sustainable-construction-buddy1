import html2pdf from "html2pdf.js";
import { PANCEK_PILLARS } from "@/lib/pancekIndicators";
import type { PancekAnswers } from "@/lib/pancekAnswerTypes";
import { calculatePillarScoresFromAnswers, calculateWeightedScore, countAnswered } from "@/lib/pancekAnswerTypes";
import type { PancekAssessment } from "@/hooks/usePancekAssessment";

interface VerificationDocument {
  name: string;
  uploaded_at: string;
}

interface VerificationSheet {
  docs: VerificationDocument[];
  verification_date?: string;
  notes?: string;
}

function getVerificationSheet(answers: PancekAssessment["answers"]): VerificationSheet | null {
  if (!answers || typeof answers !== "object" || Array.isArray(answers)) return null;
  const value = (answers as Record<string, unknown>).__lembar_verifikasi;
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (!Array.isArray(candidate.docs)) return null;

  const docs = candidate.docs.flatMap((doc): VerificationDocument[] => {
    if (!doc || typeof doc !== "object" || Array.isArray(doc)) return [];
    const record = doc as Record<string, unknown>;
    return typeof record.name === "string" && typeof record.uploaded_at === "string"
      ? [{ name: record.name, uploaded_at: record.uploaded_at }]
      : [];
  });

  return {
    docs,
    ...(typeof candidate.verification_date === "string" ? { verification_date: candidate.verification_date } : {}),
    ...(typeof candidate.notes === "string" ? { notes: candidate.notes } : {}),
  };
}

function scoreColor(pct: number): string {
  if (pct >= 80) return "#10b981";
  if (pct >= 50) return "#f59e0b";
  return "#ef4444";
}

function statusLabel(s: string): string {
  if (s === "ya") return "✓ Ya";
  if (s === "sebagian") return "◐ Sebagian";
  if (s === "tidak") return "✗ Tidak";
  return "—";
}

function statusColor(s: string): string {
  if (s === "ya") return "#10b981";
  if (s === "sebagian") return "#f59e0b";
  if (s === "tidak") return "#ef4444";
  return "#9ca3af";
}

export function exportPancekPdf(assessment: PancekAssessment) {
  const answers = assessment.answers as PancekAnswers;
  const pillarScores = calculatePillarScoresFromAnswers(answers, PANCEK_PILLARS);
  const weightedScore = calculateWeightedScore(answers, PANCEK_PILLARS);
  const totalAnswered = countAnswered(answers);
  const totalIndicators = PANCEK_PILLARS.reduce((s, p) => s + p.indicators.length, 0);
  const completionPct = Math.round((totalAnswered / totalIndicators) * 100);
  const heroColor = scoreColor(weightedScore);

  const date = new Date(assessment.updated_at).toLocaleDateString("id-ID", {
    day: "numeric", month: "long", year: "numeric",
  });

  // Pillar summary cards
  const pillarSummaryCards = PANCEK_PILLARS.map(p => {
    const score = pillarScores[p.id] || 0;
    const total = p.indicators.length;
    const pct = Math.round((score / total) * 100);
    return `<div style="flex:1;text-align:center;padding:10px 4px;background:#f9fafb;border-radius:8px;min-width:80px;">
      <div style="font-size:16px;">${p.icon}</div>
      <div style="font-size:10px;color:#6b7280;margin-top:2px;">${p.label}</div>
      <div style="font-size:9px;color:#9ca3af;">Bobot: ${p.weight}%</div>
      <div style="font-size:16px;font-weight:700;color:${scoreColor(pct)};">${score}/${total}</div>
    </div>`;
  }).join("");

  // Detailed pillar sections with indicators
  const pillarDetails = PANCEK_PILLARS.map(p => {
    const indicatorRows = p.indicators.map((ind, i) => {
      const ans = answers[ind.code];
      const status = ans?.status || "";
      const notes = ans?.notes || "";
      const evidenceFiles = ans?.evidence_files || [];
      const singleEvidence = ans?.evidence_name || "";

      let evidenceHtml = "";
      if (evidenceFiles.length > 0) {
        evidenceHtml = evidenceFiles.map(f =>
          `<span style="font-size:10px;color:#0ea5e9;">📎 ${f.name}</span>`
        ).join(", ");
      } else if (singleEvidence) {
        evidenceHtml = `<span style="font-size:10px;color:#0ea5e9;">📎 ${singleEvidence}</span>`;
      }

      return `<tr style="border-bottom:1px solid #f3f4f6;">
        <td style="padding:6px 8px;font-size:11px;color:#6b7280;width:50px;vertical-align:top;">${ind.code}</td>
        <td style="padding:6px 8px;font-size:11px;color:#1f2937;vertical-align:top;">${ind.text}${notes ? `<br/><span style="font-size:10px;color:#9ca3af;font-style:italic;">📝 ${notes}</span>` : ""}${evidenceHtml ? `<br/>${evidenceHtml}` : ""}</td>
        <td style="padding:6px 8px;font-size:11px;font-weight:600;color:${statusColor(status)};text-align:center;vertical-align:top;width:70px;">${statusLabel(status)}</td>
        <td style="padding:6px 8px;font-size:11px;text-align:center;vertical-align:top;width:40px;">${ans?.score ?? "—"}</td>
      </tr>`;
    }).join("");

    const score = pillarScores[p.id] || 0;
    const total = p.indicators.length;
    const pct = Math.round((score / total) * 100);

    return `
      <div style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;page-break-inside:avoid;">
        <div style="background:#f9fafb;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e5e7eb;">
          <span style="font-weight:600;font-size:13px;">${p.icon} ${p.label} <span style="color:#9ca3af;font-weight:400;font-size:11px;">(Bobot ${p.weight}%)</span></span>
          <span style="font-weight:700;font-size:15px;color:${scoreColor(pct)};">${score}/${total} (${pct}%)</span>
        </div>
        <table style="width:100%;border-collapse:collapse;">
          <thead>
            <tr style="background:#f9fafb;border-bottom:1px solid #e5e7eb;">
              <th style="padding:4px 8px;font-size:10px;color:#6b7280;text-align:left;">Kode</th>
              <th style="padding:4px 8px;font-size:10px;color:#6b7280;text-align:left;">Indikator</th>
              <th style="padding:4px 8px;font-size:10px;color:#6b7280;text-align:center;">Status</th>
              <th style="padding:4px 8px;font-size:10px;color:#6b7280;text-align:center;">Skor</th>
            </tr>
          </thead>
          <tbody>${indicatorRows}</tbody>
        </table>
      </div>
    `;
  }).join("");

  // Lembar verifikasi info
  const lv = getVerificationSheet(assessment.answers);
  let lvHtml = "";
  if (lv?.docs?.length) {
    const docsHtml = lv.docs.map((d, i) =>
      `<li style="font-size:11px;color:#1f2937;">📎 ${d.name} <span style="color:#9ca3af;font-size:10px;">(${new Date(d.uploaded_at).toLocaleDateString("id-ID")})</span></li>`
    ).join("");
    lvHtml = `
      <div style="margin-bottom:16px;border:1px solid #0ea5e9;border-radius:8px;overflow:hidden;padding:12px;background:#f0f9ff;">
        <div style="font-weight:600;font-size:13px;margin-bottom:6px;">🛡️ Lembar Verifikasi Jaga.id</div>
        ${lv.verification_date ? `<p style="font-size:11px;color:#6b7280;">📅 Tanggal Verifikasi: ${new Date(lv.verification_date).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}</p>` : ""}
        ${lv.notes ? `<p style="font-size:11px;color:#6b7280;font-style:italic;">📝 ${lv.notes}</p>` : ""}
        <ul style="margin:6px 0 0 16px;padding:0;">${docsHtml}</ul>
      </div>
    `;
  }

  // Verification status
  let verificationHtml = "";
  if (assessment.status === "verified") {
    verificationHtml = `
      <div style="margin-bottom:16px;border:1px solid #10b981;border-radius:8px;padding:12px;background:#ecfdf5;">
        <div style="font-weight:600;font-size:13px;color:#10b981;">✅ Terverifikasi oleh Asosiasi</div>
        <p style="font-size:11px;color:#6b7280;margin:4px 0 0;">Verifikator: ${assessment.verified_by || "-"}${assessment.verified_at ? ` • ${new Date(assessment.verified_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}` : ""}</p>
        ${assessment.verification_notes ? `<p style="font-size:11px;color:#6b7280;font-style:italic;margin-top:2px;">${assessment.verification_notes}</p>` : ""}
      </div>
    `;
  }

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:620px;margin:0 auto;padding:24px;color:#1f2937;">
      <!-- Header -->
      <div style="text-align:center;margin-bottom:20px;">
        <h1 style="font-size:18px;font-weight:700;margin:0;">LAPORAN PENILAIAN PANCEK KPK</h1>
        <p style="color:#6b7280;font-size:12px;margin:4px 0;">Panduan Cegah Korupsi — Self-Assessment Antikorupsi Badan Usaha</p>
        <p style="color:#9ca3af;font-size:11px;margin:2px 0;">PUB ASPEKINDO • Sistem Penilaian Otomatis</p>
      </div>

      <!-- Company Info -->
      <div style="display:flex;gap:16px;margin-bottom:16px;padding:12px;background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;">
        <div style="flex:1;">
          <div style="font-size:10px;color:#9ca3af;">Nama Badan Usaha</div>
          <div style="font-size:13px;font-weight:600;">${assessment.company_name || "-"}</div>
        </div>
        <div>
          <div style="font-size:10px;color:#9ca3af;">NPWP</div>
          <div style="font-size:12px;">${assessment.npwp || "-"}</div>
        </div>
        <div>
          <div style="font-size:10px;color:#9ca3af;">NIB</div>
          <div style="font-size:12px;">${assessment.nib || "-"}</div>
        </div>
        <div>
          <div style="font-size:10px;color:#9ca3af;">Periode</div>
          <div style="font-size:12px;font-weight:600;">${assessment.period_year}</div>
        </div>
      </div>

      <!-- Weighted Score Hero -->
      <div style="text-align:center;padding:20px;border:2px solid ${heroColor};border-radius:12px;margin-bottom:16px;background:${heroColor}10;">
        <div style="font-size:11px;color:#6b7280;">Skor Tertimbang (Weighted Score)</div>
        <div style="font-size:48px;font-weight:900;color:${heroColor};line-height:1.1;">${weightedScore}</div>
        <div style="font-size:14px;color:#6b7280;">/ 100</div>
        <div style="margin-top:8px;font-size:11px;color:#9ca3af;">${totalAnswered}/${totalIndicators} indikator dijawab (${completionPct}%) • Diperbarui ${date}</div>
      </div>

      <!-- Pillar Summary -->
      <div style="display:flex;gap:6px;margin-bottom:20px;flex-wrap:wrap;">
        ${pillarSummaryCards}
      </div>

      ${verificationHtml}
      ${lvHtml}

      <!-- Detail per Pilar -->
      <h2 style="font-size:15px;font-weight:600;margin-bottom:12px;border-bottom:2px solid ${heroColor};padding-bottom:6px;">Detail Indikator per Pilar</h2>
      ${pillarDetails}

      <!-- Footer -->
      <div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;">
        <p style="color:#9ca3af;font-size:10px;">Dokumen ini digenerate otomatis oleh sistem PUB ASPEKINDO</p>
        <p style="color:#9ca3af;font-size:10px;">Berdasarkan instrumen PANCEK KPK — 6 Pilar, 70 Indikator</p>
        <p style="color:#9ca3af;font-size:10px;">Bobot: Komitmen 25% • Perencanaan 10% • Pelaksanaan 25% • Evaluasi 15% • Perbaikan 15% • Respon 10%</p>
      </div>
    </div>
  `;

  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);

  html2pdf()
    .set({
      margin: [8, 8, 8, 8],
      filename: `PANCEK-${assessment.company_name || "Assessment"}-${assessment.period_year}.pdf`,
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
