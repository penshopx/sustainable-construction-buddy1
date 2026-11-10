import { jsPDF } from "jspdf";
import type { DocumentAnalysis } from "@workspace/api-client-react";
import { ktkReadiness, ktkActionPlan, validateKtkAgency } from "./ktkReadiness.ts";

const NAVY = [20, 40, 72] as const;
const COLORS = { green: [27, 122, 73], yellow: [171, 113, 9], red: [183, 44, 44] } as const;
// Built-in PDF fonts support Latin text; normalize common typography, not content.
const plain = (text: string) => text.replace(/[–—]/g, "-").replace(/[“”]/g, '"')
  .replace(/[‘’]/g, "'").replace(/\u2026/g, "...").replace(/\*\*|`/g, "")
  .replace(/\u0000/g, "");

export function buildKtkPdf(analysis: DocumentAnalysis, agencyInput: string, generatedAt = new Date()) {
  const agency = validateKtkAgency(agencyInput);
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4", compress: true });
  pdf.setProperties({ title: `Knowledge Transfer Kit - ${plain(analysis.documentName)}`,
    author: agency, creator: "PUB ASPEKINDO - Bedah Dokumen", subject: "Ringkasan telaah awal dokumen konstruksi" });
  const left = 18, width = 174, bottom = 268;
  let y = 45;
  const space = (height: number) => {
    if (y + height > bottom) { pdf.addPage(); y = 45; }
  };
  const paragraph = (value: string, bold = false, fontSize = 10, indent = 0) => {
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    pdf.setFontSize(fontSize);
    pdf.setTextColor(...NAVY);
    const lines = pdf.splitTextToSize(plain(value), width - indent) as string[];
    for (const line of lines) { space(5.2); pdf.text(line, left + indent, y); y += 5.2; }
    y += 1.8;
  };
  const section = (title: string) => {
    space(22); y += 4;
    paragraph(title, true, 12);
  };
  paragraph("KNOWLEDGE TRANSFER KIT", true, 19);
  paragraph("Ringkasan siap dibagikan kepada klien", false, 11);
  paragraph(`Dokumen: ${analysis.documentName}`);
  paragraph(`Kategori: ${analysis.result.category}`);
  paragraph(`Tanggal analisis: ${new Date(analysis.createdAt).toLocaleString("id-ID")}`);
  paragraph(`Laporan dibuat: ${generatedAt.toLocaleString("id-ID")}`);

  const readiness = ktkReadiness(analysis);
  section("1. Status kesiapan dokumen");
  space(16);
  const levels = ["green", "yellow", "red"] as const;
  levels.forEach((level, index) => {
    const selected = readiness.level === level;
    const color = selected ? COLORS[level] : [218, 223, 230] as const;
    pdf.setFillColor(color[0], color[1], color[2]);
    pdf.circle(left + 3 + index * 10, y + 1, 2.8, "F");
  });
  pdf.setFont("helvetica", "bold"); pdf.setFontSize(11);
  const statusColor = COLORS[readiness.level];
  pdf.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
  pdf.text(readiness.label, left + 34, y + 2);
  y += 12;
  paragraph(readiness.explanation);
  paragraph("Indikator ini berdasarkan temuan AI yang tersimpan, bukan penetapan kelayakan, jaminan tender, atau keputusan sertifikasi.", false, 9);
  if (analysis.truncated) paragraph(`CAKUPAN TERBATAS: hanya ${analysis.analyzedCharacters.toLocaleString("id-ID")} dari ${analysis.sourceCharacters.toLocaleString("id-ID")} karakter teks tersimpan dianalisis. Bagian lain belum tercakup.`, true, 9);
  paragraph("Pembacaan sumber dapat dibatasi saat ekstraksi (maksimal 150 halaman PDF / 100.000 karakter). Selalu cocokkan dengan berkas asli.", false, 9);

  section("2. Ringkasan eksekutif");
  paragraph(analysis.result.summary);

  section("3. Catatan kelengkapan");
  if (!analysis.result.checklist.length) paragraph("Belum ada checklist kelengkapan. Status siap tidak dapat disimpulkan.");
  for (const item of analysis.result.checklist) {
    const label = { ada: "Ada", perlu_dicek: "Perlu dicek", tidak_ditemukan: "Tidak ditemukan" }[item.status];
    space(15); paragraph(`${label}: ${item.item}`, true);
    if (item.evidence) paragraph(`Bukti pada teks: ${item.evidence}`, false, 9, 3);
  }
  section("4. Risiko yang perlu diperhatikan");
  if (!analysis.result.risks.length) paragraph("Tidak ada risiko yang dicatat pada analisis ini. Ini bukan bukti bahwa seluruh dokumen bebas risiko.");
  for (const risk of analysis.result.risks) {
    space(15); paragraph(`${risk.severity.toUpperCase()}: ${risk.title}`, true);
    paragraph(`Bukti: ${risk.evidence}`, false, 9, 3);
    paragraph(`Saran tindak lanjut: ${risk.recommendation || "Tinjau bersama konsultan."}`, false, 10, 3);
  }
  section("5. Regulasi relevan");
  paragraph("Hanya rujukan yang disebut dalam teks sumber. Nomor, kesesuaian, dan status berlaku belum diverifikasi ke sumber resmi.", false, 9);
  if (!analysis.result.regulations.length) paragraph("Tidak ada rujukan regulasi yang tercatat. Minta konsultan memeriksa persyaratan resmi yang berlaku.");
  for (const regulation of analysis.result.regulations) {
    space(15); paragraph(regulation.title, true);
    paragraph(`Bukti: ${regulation.evidence}`, false, 9, 3);
    paragraph(regulation.note, false, 10, 3);
  }
  section("6. Action plan untuk klien");
  ktkActionPlan(analysis).forEach((action, index) => {
    space(14); paragraph(`${index + 1}. ${action}`);
  });
  section("Catatan penggunaan");
  paragraph("Laporan ini adalah bahan telaah awal berbantuan AI. Temuan dapat keliru atau tidak lengkap. Tindak lanjut perlu disepakati bersama konsultan; laporan ini bukan nasihat hukum atau sertifikat resmi. Riwayat percakapan privat tidak disertakan.", false, 9);

  const pages = pdf.getNumberOfPages();
  for (let page = 1; page <= pages; page++) {
    pdf.setPage(page);
    pdf.setFont("helvetica", "bold"); pdf.setFontSize(11); pdf.setTextColor(...NAVY);
    const heading = pdf.splitTextToSize(plain(agency), 128) as string[];
    pdf.text(heading, left, 17);
    pdf.setFontSize(9); pdf.text("KNOWLEDGE\nTRANSFER KIT", 192, 17, { align: "right" });
    pdf.setDrawColor(205, 214, 225); pdf.line(left, 34, 192, 34); pdf.line(left, 278, 192, 278);
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(8);
    pdf.text(pdf.splitTextToSize(plain(agency), 139), left, 284);
    pdf.text(`Halaman ${page} / ${pages}`, 192, 284, { align: "right" });
    pdf.setFontSize(7); pdf.text("PUB ASPEKINDO | Bedah Dokumen | Telaah awal - perlu verifikasi", left, 293);
  }
  return pdf;
}

export async function downloadKtkPdf(analysis: DocumentAnalysis, agency: string) {
  const pdf = buildKtkPdf(analysis, agency);
  const stem = analysis.documentName.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-").slice(0, 65) || "dokumen";
  await pdf.save(`KTK-${stem}.pdf`, { returnPromise: true });
}
