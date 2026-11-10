import type { Database } from "@/integrations/supabase/types";

export type InformationArticle = Database["public"]["Tables"]["information_articles"]["Row"] & {
  information_sources: Pick<
    Database["public"]["Tables"]["information_sources"]["Row"],
    "name" | "domain" | "trust_level"
  > | null;
};

export type InformationSource = Database["public"]["Tables"]["information_sources"]["Row"];
export type InformationAgenda = Database["public"]["Tables"]["aspekindo_learning_agendas"]["Row"];

export const INFORMATION_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  review: "Perlu diperiksa",
  scheduled: "Terjadwal",
  published: "Terbit",
  archived: "Diarsipkan",
  rejected: "Ditolak",
};

export const INFORMATION_TOPICS = [
  "Regulasi",
  "Tender",
  "Sertifikasi",
  "K3",
  "Kebijakan",
  "Teknologi",
  "Kegiatan PUB",
  "Umum",
] as const;

export function formatInformationDate(value: string | null, withTime = false) {
  if (!value) return "Belum ditentukan";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit", timeZoneName: "short" } : {}),
  }).format(new Date(value));
}

export function formatAgendaDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export function makeInformationSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

export function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}