import type { HelpdeskInput } from "@workspace/api-client-react";
import catalog from "@/data/construction-scheme-catalog.json";

export type SchemeProfile = Required<Pick<HelpdeskInput, "scheme_code" | "audience" | "explanation_depth">>;
export const SCHEME_CATALOG = catalog.records;
export const SCHEME_AUDIENCES = [
  { value: "bujk", label: "Pelaku usaha / admin BUJK" },
  { value: "peninjau", label: "Peninjau / verifikator" },
  { value: "asesor", label: "Asesor" },
  { value: "lsbu", label: "Petugas LSBU" },
] as const;
export const SCHEME_DEPTHS = [
  { value: "dasar", label: "Panduan dasar" },
  { value: "praktis", label: "Praktis" },
  { value: "rinci", label: "Rinci / rujukan" },
] as const;
export const SCHEME_ACTIONS = [
  "Jelaskan ruang lingkup subklasifikasi ini dan batasnya.",
  "Buat daftar persyaratan berdasarkan skema ini.",
  "Bantu saya memeriksa kelengkapan; tanyakan informasi yang diperlukan.",
  "Tunjukkan dasar ketentuan dan halaman sumber yang relevan.",
];

export function profileTitle(profile?: SchemeProfile) {
  return profile ? `[skema-v1:${profile.scheme_code}:${profile.audience}:${profile.explanation_depth}] ` : "";
}
export function restoreProfile(title: string): SchemeProfile | undefined {
  if (!title.startsWith("[skema-")) return undefined;
  const match = title.match(/^\[skema-v1:([A-Z]{2}\d{3}):([a-z]+):([a-z]+)\] /);
  if (!match || !SCHEME_CATALOG.some(row => row.code === match[1]) ||
    !SCHEME_AUDIENCES.some(row => row.value === match[2]) || !SCHEME_DEPTHS.some(row => row.value === match[3])) {
    throw new Error("Profil riwayat tidak tersedia. Pilih skema dan mulai percakapan baru.");
  }
  return { scheme_code: match[1], audience: match[2] as SchemeProfile["audience"],
    explanation_depth: match[3] as SchemeProfile["explanation_depth"] };
}
export const visibleConversationTitle = (title: string) => title.replace(/^\[skema-v1:[^\]]+\]\s*/, "");
