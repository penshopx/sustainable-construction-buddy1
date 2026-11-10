export const SMAP_SIGNED_URL_TTL = 300;
const PREFIX = "/storage/v1/object/sign/smap-documents/";

/** Recover only the object path from a legacy URL. Its embedded token is never reused. */
export function smapStoragePath(value: string, projectUrl: string, userId: string, documentId: string): string {
  let path = value;
  try {
    if (/^[a-z][a-z0-9+.-]*:/i.test(value)) {
      const url = new URL(value);
      const project = new URL(projectUrl);
      if (url.protocol !== "https:" || url.origin !== project.origin ||
          url.username || url.password || !url.pathname.startsWith(PREFIX)) throw new Error();
      path = decodeURIComponent(url.pathname.slice(PREFIX.length));
    }
    const segments = path.split("/");
    if (!userId || !documentId || segments.length < 3 ||
        segments[0] !== userId || segments[1] !== documentId ||
        segments.some((part) => !part || part === "." || part === "..") ||
        /[\\\u0000-\u001f?#]/.test(path)) throw new Error();
  } catch {
    // Never echo the stored URL (including any old signing token) in errors.
    throw new Error("Lokasi berkas SMAP tidak valid atau bukan milik akun ini.");
  }
  return path;
}

type Signer = (path: string, expiresIn: number) => Promise<{
  data: { signedUrl: string } | null;
  error: unknown;
}>;

export async function freshSmapFileUrl(
  storedValue: string, projectUrl: string, userId: string, documentId: string, sign: Signer,
): Promise<string> {
  const path = smapStoragePath(storedValue, projectUrl, userId, documentId);
  const { data, error } = await sign(path, SMAP_SIGNED_URL_TTL);
  if (error || !data?.signedUrl) throw new Error("Berkas belum dapat dibuka. Silakan coba lagi.");
  // Reject malformed or mismatched upstream results; never fall back to the old URL.
  if (!data.signedUrl.startsWith("https://") ||
      smapStoragePath(data.signedUrl, projectUrl, userId, documentId) !== path) {
    throw new Error("Berkas belum dapat dibuka. Silakan coba lagi.");
  }
  return data.signedUrl;
}
