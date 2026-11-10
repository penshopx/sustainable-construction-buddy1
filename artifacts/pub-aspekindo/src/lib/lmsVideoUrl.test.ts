import assert from "node:assert/strict";
import test, { mock } from "node:test";
import {
  getPlayableVideoUrl,
  isVideoUrlFresh,
  issueVideoSignedUrl,
  shouldRecoverStalledVideo,
  VIDEO_URL_FRESH_MS,
  VIDEO_URL_LIFETIME_SECONDS,
} from "./lmsVideoUrl.ts";

test("tautan yang masih baru dipakai, tautan mendekati kedaluwarsa diganti sebelum pemutaran", async () => {
  mock.timers.enable({ apis: ["Date"], now: new Date("2026-01-01T00:00:00Z") });
  try {
    const calls: Array<{ path: string; expiresIn: number }> = [];
    const storage = async (path: string, expiresIn: number) => {
      calls.push({ path, expiresIn });
      return { data: { signedUrl: `https://storage.example/video?version=${calls.length}` }, error: null };
    };
    const issuedAt = Date.now();
    const firstUrl = await issueVideoSignedUrl("course/lesson.mp4", storage);
    const first = { url: firstUrl, issuedAt };

    mock.timers.setTime(issuedAt + VIDEO_URL_FRESH_MS - 1);
    assert.equal(isVideoUrlFresh(issuedAt), true);
    assert.equal(await getPlayableVideoUrl(first, async () => {
      throw new Error("Tidak perlu meminta ulang");
    }), first);
    mock.timers.setTime(issuedAt + VIDEO_URL_FRESH_MS);
    assert.equal(isVideoUrlFresh(issuedAt), false);
    const refreshed = await getPlayableVideoUrl(first, async () => ({
      url: await issueVideoSignedUrl("course/lesson.mp4", storage),
      issuedAt: Date.now(),
    }));
    assert.notEqual(refreshed.url, firstUrl);
    mock.timers.setTime(issuedAt + VIDEO_URL_LIFETIME_SECONDS * 1000 + 1);
    assert.equal(isVideoUrlFresh(issuedAt), false);
    assert.equal(isVideoUrlFresh(refreshed.issuedAt), true);
    assert.deepEqual(calls, [
      { path: "course/lesson.mp4", expiresIn: 1800 },
      { path: "course/lesson.mp4", expiresIn: 1800 },
    ]);
  } finally {
    mock.timers.reset();
  }
});

test("video yang masih lancar tidak diganti; kemacetan yang melewati batas segar dipulihkan", () => {
  const issuedAt = 1000;
  const staleAt = issuedAt + VIDEO_URL_FRESH_MS;
  assert.equal(shouldRecoverStalledVideo(issuedAt, 42, 42, false, false, false, staleAt - 1), false);
  assert.equal(shouldRecoverStalledVideo(issuedAt, 42, 42, false, false, false, staleAt), true);
  assert.equal(shouldRecoverStalledVideo(issuedAt, 42, 42.2, false, false, false, staleAt), false);
  assert.equal(shouldRecoverStalledVideo(issuedAt, 42, 42, true, false, false, staleAt), false);
  assert.equal(shouldRecoverStalledVideo(issuedAt, 42, 42, false, true, false, staleAt), false);
  assert.equal(shouldRecoverStalledVideo(issuedAt, 42, 42, false, false, true, staleAt), false);
});

test("storage gagal tidak mengembalikan tautan lama atau kosong", async () => {
  await assert.rejects(
    getPlayableVideoUrl({ url: "https://storage.example/expired", issuedAt: 1 }, async () => {
      throw new Error("access denied");
    }, VIDEO_URL_FRESH_MS + 1),
    /access denied/,
  );
  await assert.rejects(
    issueVideoSignedUrl("course/lesson.mp4", async () => ({
      data: null,
      error: { message: "access denied" },
    })),
    { message: "access denied" },
  );
  await assert.rejects(
    issueVideoSignedUrl("course/lesson.mp4", async () => ({
      data: { signedUrl: "" },
      error: null,
    })),
    /Tautan video tidak tersedia/,
  );
});