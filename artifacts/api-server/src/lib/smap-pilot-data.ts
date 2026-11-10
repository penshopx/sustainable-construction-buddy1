import type { SmapPilotDocument } from "@workspace/api-zod";
import { ChatServiceError, createChatService } from "./chat-service";

export class PilotError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export const unavailable = () => new PilotError(503, "pilot_unavailable", "Pilot belum tersedia. Silakan coba lagi nanti.");
export async function pilotJson(response: Response, maxBytes: number): Promise<unknown> {
  if (!response.body) throw unavailable();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw unavailable();
      chunks.push(value);
    }
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } finally {
    await reader.cancel().catch(() => {});
    reader.releaseLock();
  }
}
const fields = {
  surat_pernyataan: [
    ["company_name", "Nama perusahaan terisi"], ["document_number", "Nomor dokumen terisi"],
    ["signatory_name", "Nama penandatangan terisi"], ["signatory_position", "Jabatan penandatangan terisi"],
    ["sbu_application_type", "Jenis permohonan terisi"],
  ],
  sertifikat_iso: [
    ["company_name", "Nama perusahaan terisi"], ["document_number", "Nomor sertifikat terisi"],
    ["issuing_body", "Lembaga penerbit terisi"], ["certificate_scope", "Ruang lingkup terisi"],
    ["issued_date", "Tanggal penerbitan terisi"], ["expiry_date", "Tanggal akhir terisi"],
  ],
  pendidikan_antikorupsi: [
    ["training_name", "Nama pelatihan terisi"], ["training_provider", "Penyelenggara terisi"],
    ["training_hours", "Durasi lebih dari nol"], ["participant_count", "Jumlah peserta lebih dari nol"],
  ],
} as const;
export const pilotColumns = ["id", "user_id", "doc_type", "file_name", "created_at",
  ...new Set(Object.values(fields).flatMap(list => list.map(([key]) => key)))].join(",");

export function toPilotDocument(row: Record<string, unknown>): SmapPilotDocument {
  const type = row.doc_type;
  if (typeof row.id !== "string" || !/^[a-f\d]{8}(-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(row.id) ||
      typeof type !== "string" || !Object.hasOwn(fields, type)) throw unavailable();
  const present = (key: string) => typeof row[key] === "number"
    ? Number.isFinite(row[key]) && (row[key] as number) > 0
    : typeof row[key] === "string" && !!(row[key] as string).trim();
  return {
    id: row.id, type: type as SmapPilotDocument["type"],
    ...(typeof row.created_at === "string" && Number.isFinite(Date.parse(row.created_at))
      ? { createdAt: new Date(row.created_at) } : {}),
    checks: [
      ...fields[type as keyof typeof fields].map(([key, name]) => ({ name, complete: present(key) })),
      { name: "Nama lampiran tercatat (isi belum diperiksa)", complete: present("file_name") },
    ],
  };
}

export function createPilotData(env: NodeJS.ProcessEnv, fetchImpl: typeof fetch = fetch) {
  const auth = createChatService({ env, fetchImpl });
  async function documents(authorization: string, owner: string, ids?: string[], signal?: AbortSignal) {
    const key = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
    let url: URL;
    try {
      url = new URL(env.SUPABASE_URL || env.VITE_SUPABASE_URL || "");
      if (!key || url.protocol !== "https:" || url.username || url.password ||
          url.pathname !== "/" || url.search || url.hash) throw new Error();
    } catch { throw unavailable(); }
    url.pathname = "/rest/v1/smap_documents";
    url.search = new URLSearchParams({
      select: pilotColumns, user_id: `eq.${owner}`, order: "created_at.desc",
      doc_type: `in.(${Object.keys(fields).join(",")})`, limit: ids ? "5" : "50",
      ...(ids ? { id: `in.(${ids.join(",")})` } : {}),
    }).toString();
    try {
      const response = await fetchImpl(url, {
        headers: { apikey: key!, Authorization: authorization }, redirect: "error",
        signal: AbortSignal.any([AbortSignal.timeout(7000), ...(signal ? [signal] : [])]),
      });
      if (response.status === 401 || response.status === 403) {
        throw new ChatServiceError(401, "session_invalid", "Sesi berakhir. Silakan login kembali.");
      }
      if (!response.ok) throw unavailable();
      const rows = await pilotJson(response, 1024 * 1024);
      if (!Array.isArray(rows) || rows.length > (ids ? 5 : 50)) throw unavailable();
      if (rows.some(row => !row || row.user_id !== owner)) throw unavailable();
      const result = rows.map(row => toPilotDocument(row as Record<string, unknown>));
      if (new Set(result.map(row => row.id)).size !== result.length) throw unavailable();
      if (ids && (result.length !== ids.length || result.some(row => !ids.includes(row.id)))) {
        throw new PilotError(404, "pilot_documents_missing", "Catatan tidak ditemukan atau akses telah berubah. Muat ulang daftar.");
      }
      return ids ? ids.map(id => result.find(row => row.id === id)!) : result;
    } catch (error) {
      if (error instanceof PilotError || error instanceof ChatServiceError) throw error;
      throw unavailable();
    }
  }
  return { requireMember: auth.requireMember, documents };
}
