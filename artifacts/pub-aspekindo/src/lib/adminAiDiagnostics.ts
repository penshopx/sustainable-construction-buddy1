import type { AiReadiness } from "@workspace/api-client-react";

export const diagnosticGuides = {
  key_missing: {
    title: "Konfigurasi belum tersedia",
    action: "Minta pengelola server melengkapi konfigurasi penyedia AI di penyimpanan rahasia, lalu periksa kembali. Jangan menyalin kredensial ke percakapan atau laporan.",
  },
  metadata_rejected: {
    title: "Pemeriksaan metadata ditolak",
    action: "Minta pengelola server memeriksa keabsahan konfigurasi dan izin akses metadata penyedia. Jangan membagikan kredensial atau respons mentah.",
  },
  metadata_invalid: {
    title: "Metadata tidak dapat dibaca",
    action: "Minta pengelola memeriksa kecocokan integrasi dengan kontrak metadata penyedia. Periksa kembali nanti; jangan menganggap layanan siap.",
  },
  provider_credit_limit: {
    title: "Batas penggunaan penyedia terindikasi",
    action: "Minta penanggung jawab memeriksa batas penggunaan pada akun penyedia. Pemeriksaan ini tidak menampilkan atau memastikan saldo; model dan panjang jawaban tidak diubah otomatis.",
  },
  provider_rate_limit: {
    title: "Terlalu banyak permintaan",
    action: "Kurangi permintaan bersamaan dan tunggu sebelum mencoba kembali. Jika berulang, minta pengelola meninjau batas laju penyedia.",
  },
  key_budget_exhausted: {
    title: "Batas penggunaan konfigurasi tercapai",
    action: "Minta penanggung jawab meninjau batas penggunaan konfigurasi pada penyedia. Jangan mengganti model atau memendekkan jawaban secara otomatis.",
  },
  metadata_unreachable: {
    title: "Gangguan koneksi atau waktu tunggu",
    action: "Coba kembali setelah masa cache berakhir. Jika berulang, minta pengelola memeriksa koneksi keluar server dan ketersediaan penyedia.",
  },
  metadata_available: {
    title: "Metadata berhasil diperiksa",
    action: "Tidak ada tindakan konfigurasi saat ini. Hasil ini bukan uji pengiriman pesan dan tidak menjamin biaya prompt atau batas token mencukupi.",
  },
} as const;

export type DiagnosticCode = keyof typeof diagnosticGuides;
export type SafeDiagnostic = {
  code: DiagnosticCode | "unknown";
  checkedAt: string;
  recheckAt: string;
};

// Only keep explicitly safe fields. Never render provider messages, bodies or
// arbitrary future diagnostic codes, even if a server sends extra properties.
export function projectDiagnostic(value: AiReadiness): SafeDiagnostic {
  if (!value.diagnostics || typeof value.diagnostics.reason !== "string" ||
      !Number.isFinite(Date.parse(value.checkedAt)) || !Number.isFinite(Date.parse(value.recheckAt))) {
    throw new Error("Invalid diagnostic contract");
  }
  const reason = value.diagnostics.reason;
  return {
    code: Object.hasOwn(diagnosticGuides, reason) ? reason as DiagnosticCode : "unknown",
    checkedAt: value.checkedAt,
    recheckAt: value.recheckAt,
  };
}

export function diagnosticGuide(code: SafeDiagnostic["code"]) {
  return code === "unknown" ? {
    title: "Status belum dikenali",
    action: "Minta pengelola memeriksa kecocokan versi aplikasi dan API. Jangan menganggap layanan siap sampai pemeriksaan berhasil.",
  } : diagnosticGuides[code];
}
