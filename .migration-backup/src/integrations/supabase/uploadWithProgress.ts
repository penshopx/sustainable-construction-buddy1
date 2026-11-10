import { supabase } from "./client";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;

export type UploadProgress = {
  loaded: number;
  total: number;
  percent: number;
};

type UploadResult = {
  error: Error | null;
};

function getErrorMessage(responseText: string, status: number) {
  try {
    const parsed = JSON.parse(responseText) as { message?: string; error?: string };
    return parsed.message || parsed.error || `Upload video gagal (HTTP ${status}).`;
  } catch {
    return responseText || `Upload video gagal (HTTP ${status}).`;
  }
}

export async function uploadSupabaseObjectWithProgress({
  bucket,
  path,
  file,
  onProgress,
}: {
  bucket: string;
  path: string;
  file: File;
  onProgress: (progress: UploadProgress) => void;
}): Promise<UploadResult> {
  if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
    return { error: new Error("Konfigurasi Supabase belum tersedia.") };
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session?.access_token) {
    return { error: sessionError ?? new Error("Sesi login tidak tersedia.") };
  }

  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const requestUrl = `${SUPABASE_URL}/storage/v1/object/${encodeURIComponent(bucket)}/${encodedPath}`;

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", requestUrl);
    xhr.timeout = 10 * 60 * 1000;
    xhr.setRequestHeader("Authorization", `Bearer ${sessionData.session.access_token}`);
    xhr.setRequestHeader("apikey", SUPABASE_PUBLISHABLE_KEY);
    xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.addEventListener("progress", (event) => {
      const total = event.lengthComputable && event.total > 0 ? event.total : file.size;
      const loaded = Math.min(event.loaded, total);
      onProgress({
        loaded,
        total,
        percent: total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0,
      });
    });
    xhr.addEventListener("load", () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress({ loaded: file.size, total: file.size, percent: 100 });
        resolve({ error: null });
        return;
      }
      resolve({ error: new Error(getErrorMessage(xhr.responseText, xhr.status)) });
    });
    xhr.addEventListener("error", () => resolve({ error: new Error("Koneksi upload video terputus.") }));
    xhr.addEventListener("timeout", () => resolve({ error: new Error("Upload video melewati batas waktu.") }));
    xhr.addEventListener("abort", () => resolve({ error: new Error("Upload video dibatalkan.") }));
    xhr.send(file);
  });
}