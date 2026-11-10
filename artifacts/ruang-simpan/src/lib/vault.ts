import type { VaultDocument } from '@workspace/api-client-react';

export const MAX_FILE_BYTES = 50 * 1024 * 1024;
export const ALLOWED_EXT = ['pdf', 'docx', 'xlsx', 'txt', 'md', 'csv', 'jpg', 'jpeg', 'png'];
export const ACCEPT_ATTR = ALLOWED_EXT.map((e) => '.' + e).join(',');

export function extOf(name: string) {
  const i = name.lastIndexOf('.');
  return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

const fmt = new Intl.DateTimeFormat('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
const fmtTime = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' });
export function formatDate(s: string) {
  const d = new Date(s);
  return isNaN(d.getTime()) ? s : fmt.format(d);
}
export function formatTime(s: string) {
  const d = new Date(s);
  return isNaN(d.getTime()) ? '' : fmtTime.format(d);
}

export function errorStatus(e: unknown): number | undefined {
  return (e as { status?: number } | null)?.status;
}
export function errorMessage(e: unknown, fallback = 'Terjadi kesalahan. Coba lagi.') {
  const data = (e as { data?: { error?: string; message?: string } } | null)?.data;
  return data?.error || data?.message || (e instanceof Error && e.message) || fallback;
}

export const STATUS_META: Record<VaultDocument['status'], { label: string; hint: string; cls: string }> = {
  ready: { label: 'Siap AI', hint: 'Teks terbaca dan terindeks. Bisa dicari isinya dan dipakai sebagai konteks AI.', cls: 'bg-sky-400/15 text-sky-200 border-sky-400/40' },
  stored: { label: 'Tersimpan', hint: 'File tersimpan, tetapi belum ada teks terbaca. Foto/PDF scan memerlukan persetujuan OCR.', cls: 'bg-slate-400/10 text-slate-200 border-slate-400/30' },
  failed: { label: 'Ekstraksi gagal', hint: 'File tetap tersimpan, tetapi pembacaan teks gagal.', cls: 'bg-amber-400/10 text-amber-200 border-amber-400/40' },
  processing: { label: 'Memproses OCR', hint: 'File sedang dibaca. Belum siap AI sampai teks berhasil disimpan.', cls: 'bg-sky-400/10 text-sky-200 border-sky-400/30' },
};

export async function uploadDocument(file: File, folderId: string): Promise<VaultDocument> {
  const qs = new URLSearchParams({ name: file.name, folderId });
  const res = await fetch(`/api/ruang-simpan/documents?${qs.toString()}`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/octet-stream' },
    body: file,
  });
  if (!res.ok) {
    let msg = '';
    try {
      const j = await res.json();
      msg = j?.error || j?.message || '';
    } catch {
      /* ignore */
    }
    throw new Error(msg || `Unggah gagal (HTTP ${res.status})`);
  }
  return res.json();
}

export const downloadUrl = (id: string) => `/api/ruang-simpan/documents/${encodeURIComponent(id)}/download`;
