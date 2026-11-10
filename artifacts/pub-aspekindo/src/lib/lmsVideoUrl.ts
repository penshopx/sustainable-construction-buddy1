export const VIDEO_URL_LIFETIME_SECONDS = 30 * 60;
// Allow time for the browser to request the video after the URL is issued.
export const VIDEO_URL_FRESH_MS = 25 * 60 * 1000;

export function isVideoUrlFresh(issuedAt: number, now = Date.now()) {
  return issuedAt > 0 && now >= issuedAt && now - issuedAt < VIDEO_URL_FRESH_MS;
}

export function shouldRecoverStalledVideo(
  issuedAt: number,
  stalledAt: number,
  currentTime: number,
  paused: boolean,
  ended: boolean,
  hasFutureData: boolean,
  now = Date.now(),
) {
  return !isVideoUrlFresh(issuedAt, now) && !paused && !ended &&
    currentTime <= stalledAt + 0.1 && !hasFutureData;
}

export type PlayableVideoUrl = { url: string; issuedAt: number };

export async function getPlayableVideoUrl(
  current: PlayableVideoUrl | null,
  refresh: () => Promise<PlayableVideoUrl>,
  now = Date.now(),
): Promise<PlayableVideoUrl> {
  if (current && isVideoUrlFresh(current.issuedAt, now)) return current;
  // A rejected refresh must never fall back to an expired signed URL.
  return refresh();
}

export async function issueVideoSignedUrl(
  storagePath: string,
  createSignedUrl: (path: string, expiresIn: number) => Promise<{
    data: { signedUrl: string } | null;
    error: { message: string } | null;
  }>,
) {
  const { data, error } = await createSignedUrl(storagePath, VIDEO_URL_LIFETIME_SECONDS);
  if (error) throw error;
  if (!data?.signedUrl) throw new Error("Tautan video tidak tersedia.");
  return data.signedUrl;
}