import html2pdf from "html2pdf.js";
import type { PerformanceGrade } from "@/hooks/usePerformanceGrades";
import type { Json } from "@/integrations/supabase/types";

const pillarMeta = [
  { key: "financial", label: "Keuangan", weight: "30%", emoji: "💰" },
  { key: "project", label: "Kinerja Proyek", weight: "30%", emoji: "📁" },
  { key: "compliance", label: "Kepatuhan & SDM", weight: "20%", emoji: "🛡️" },
  { key: "risk", label: "Risk & K3", weight: "20%", emoji: "⚠️" },
];

function gradeColorHex(grade: string): string {
  if (["AAA", "AA"].includes(grade)) return "#10b981";
  if (["A", "BBB"].includes(grade)) return "#0ea5e9";
  if (["BB", "B"].includes(grade)) return "#f59e0b";
  return "#ef4444";
}

function formatKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
}

function formatValue(v: unknown): string {
  if (typeof v === "boolean") return v ? "✓ Ya" : "✗ Tidak";
  if (v === null || v === undefined) return "-";
  return String(v);
}

function getPillarBreakdown(breakdown: Json, pillar: string): Record<string, Json> {
  if (!breakdown || typeof breakdown !== "object" || Array.isArray(breakdown)) return {};
  const value = breakdown[pillar];
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

export function exportGradingPdf(grade: PerformanceGrade, profileName?: string) {
  const color = gradeColorHex(grade.grade);
  const date = new Date(grade.computed_at).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const pillarRows = pillarMeta
    .map((p) => {
      const score = grade[`${p.key}_score` as keyof PerformanceGrade] as number;
      const breakdown = getPillarBreakdown(grade.breakdown, p.key);
      const detailRows = Object.entries(breakdown)
        .filter(([k]) => !["score", "weight", "reason"].includes(k))
        .map(
          ([k, v]) =>
            `<tr><td style="padding:4px 8px;color:#6b7280;font-size:12px;">${formatKey(k)}</td><td style="padding:4px 8px;font-size:12px;text-align:right;font-weight:500;">${formatValue(v)}</td></tr>`
        )
        .join("");

      const reasonRow = breakdown.reason
        ? `<tr><td colspan="2" style="padding:4px 8px;color:#9ca3af;font-size:11px;font-style:italic;">${breakdown.reason}</td></tr>`
        : "";

      return `
        <div style="margin-bottom:16px;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden;">
          <div style="background:#f9fafb;padding:10px 12px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #e5e7eb;">
            <span style="font-weight:600;font-size:14px;">${p.emoji} ${p.label} <span style="color:#9ca3af;font-weight:400;">(Bobot ${p.weight})</span></span>
            <span style="font-weight:700;font-size:16px;color:${color};">${score}/100</span>
          </div>
          <table style="width:100%;border-collapse:collapse;">
            ${detailRows}
            ${reasonRow}
          </table>
        </div>
      `;
    })
    .join("");

  const html = `
    <div style="font-family:'Segoe UI',Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#1f2937;">
      <!-- Header -->
      <div style="text-align:center;margin-bottom:24px;">
        <h1 style="font-size:20px;font-weight:700;margin:0;">LAPORAN GRADING KINERJA BUJK</h1>
        <p style="color:#6b7280;font-size:13px;margin:4px 0;">PUB ASPEKINDO — Sistem Penilaian Kinerja Otomatis</p>
      </div>

      <!-- Grade Hero -->
      <div style="text-align:center;padding:20px;border:2px solid ${color};border-radius:12px;margin-bottom:20px;background:${color}10;">
        <div style="font-size:56px;font-weight:900;color:${color};line-height:1;">${grade.grade}</div>
        <div style="font-size:24px;font-weight:600;margin-top:4px;">${grade.total_score} / 100</div>
        <div style="color:#6b7280;font-size:13px;margin-top:4px;">Periode ${grade.period} • Dihitung ${date}</div>
        ${grade.company_name ? `<div style="font-weight:600;font-size:14px;margin-top:8px;">${grade.company_name}</div>` : ""}
        ${grade.sbu_number || grade.bujk_qualification ? `<div style="color:#6b7280;font-size:12px;margin-top:2px;">${[grade.sbu_number ? `SBU: ${grade.sbu_number}` : '', grade.nib ? `NIB: ${grade.nib}` : '', grade.bujk_qualification ? `Kualifikasi: ${grade.bujk_qualification}` : ''].filter(Boolean).join(' • ')}</div>` : ""}
        ${profileName ? `<div style="color:#6b7280;font-size:12px;margin-top:2px;">Dihitung oleh: ${profileName}</div>` : ""}
      </div>

      <!-- Pillar Summary Bar -->
      <div style="display:flex;gap:8px;margin-bottom:20px;">
        ${pillarMeta
          .map((p) => {
            const score = grade[`${p.key}_score` as keyof PerformanceGrade] as number;
            return `<div style="flex:1;text-align:center;padding:10px 6px;background:#f3f4f6;border-radius:8px;">
              <div style="font-size:11px;color:#6b7280;">${p.label}</div>
              <div style="font-size:18px;font-weight:700;color:${color};">${score}</div>
            </div>`;
          })
          .join("")}
      </div>

      <!-- Detail Breakdown -->
      <h2 style="font-size:16px;font-weight:600;margin-bottom:12px;border-bottom:2px solid ${color};padding-bottom:6px;">Detail Breakdown per Pilar</h2>
      ${pillarRows}

      <!-- Footer -->
      <div style="text-align:center;margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;">
        <p style="color:#9ca3af;font-size:11px;">Dokumen ini digenerate otomatis oleh sistem PUB ASPEKINDO</p>
        <p style="color:#9ca3af;font-size:11px;">Berdasarkan metodologi 4 pilar: Keuangan (30%), Proyek (30%), Kepatuhan (20%), Risiko (20%)</p>
      </div>
    </div>
  `;

  const container = document.createElement("div");
  container.innerHTML = html;
  document.body.appendChild(container);

  html2pdf()
    .set({
      margin: [10, 10, 10, 10],
      filename: `Grading-BUJK-${grade.period}-${grade.grade}.pdf`,
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
