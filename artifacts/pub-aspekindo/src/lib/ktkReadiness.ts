import type { DocumentAnalysis } from "@workspace/api-client-react";

export type KtkReadiness = {
  level: "green" | "yellow" | "red";
  label: string;
  explanation: string;
};

/** Conservative indicators of recorded findings, never official approval. */
export function ktkReadiness(analysis: DocumentAnalysis): KtkReadiness {
  const { checklist, risks } = analysis.result;
  if (risks.some(r => r.severity === "tinggi") || checklist.some(c => c.status === "tidak_ditemukan")) {
    return { level: "red", label: "Merah - perlu perbaikan",
      explanation: "Ada risiko tinggi atau persyaratan yang tidak ditemukan dalam teks. Lengkapi bukti dan tinjau temuan sebelum melanjutkan." };
  }
  if (analysis.truncated || checklist.length === 0 || checklist.some(c => c.status !== "ada") || risks.length > 0) {
    return { level: "yellow", label: "Kuning - perlu klarifikasi",
      explanation: "Masih ada bagian yang perlu dicek, catatan risiko, atau cakupan analisis terbatas. Belum cukup bukti untuk menyatakan dokumen siap." };
  }
  return { level: "green", label: "Hijau - siap ditinjau",
    explanation: "Seluruh butir checklist yang dianalisis tercatat ada dan tidak ada risiko yang dicatat. Tetap periksa dokumen asli dan persyaratan resmi." };
}

export function ktkActionPlan(analysis: DocumentAnalysis): string[] {
  const actions: string[] = [];
  const orderedRisks = [...analysis.result.risks].sort((a, b) =>
    ({ tinggi: 0, sedang: 1, rendah: 2 }[a.severity] - { tinggi: 0, sedang: 1, rendah: 2 }[b.severity]));
  for (const risk of orderedRisks) {
    actions.push(`${risk.severity === "tinggi" ? "Prioritas utama" : "Tindak lanjut risiko"}: ${risk.title}. ${risk.recommendation.trim() || "Diskusikan temuan ini dengan konsultan dan periksa klausul pada dokumen asli."}`);
  }
  for (const item of analysis.result.checklist) {
    if (item.status === "tidak_ditemukan") actions.push(`Lengkapi atau tunjukkan bukti untuk: ${item.item}. Pastikan bagian atau lampiran pendukung tersedia sebelum dikirim.`);
    if (item.status === "perlu_dicek") actions.push(`Konfirmasikan kepada pihak terkait: ${item.item}. Cocokkan dengan dokumen asli dan catat hasil pemeriksaannya.`);
  }
  if (analysis.truncated) actions.push("Telaah bagian dokumen yang belum tercakup analisis ini. Jangan menggunakan ringkasan parsial sebagai pengganti pemeriksaan seluruh dokumen.");
  if (!analysis.result.checklist.length) actions.push("Susun daftar persyaratan bersama konsultan, lalu periksa kelengkapan satu per satu. Analisis ini belum menghasilkan checklist.");
  for (const regulation of analysis.result.regulations) {
    actions.push(`Verifikasi ${regulation.title} melalui sumber resmi: cek nomor, status berlaku, dan kesesuaiannya dengan kasus Anda. ${regulation.note}`);
  }
  actions.push("Minta konsultan meninjau dokumen asli dan bukti pelengkap sebelum pengajuan, penandatanganan, atau keputusan berikutnya.");
  return [...new Set(actions)];
}

export function validateKtkAgency(value: string): string {
  const name = value.replace(/\s+/g, " ").trim();
  if (!name || name.length > 120 || /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(name)) {
    throw new Error("Isi nama biro jasa/konsultan, maksimal 120 karakter.");
  }
  return name;
}
