import { expect, test } from "@playwright/test";
import { writeFile } from "node:fs/promises";
import { generateVideo, startNativeMediaServer } from "./helpers/native-media-server.mjs";

let bytes;
let media;
test.beforeAll(() => { bytes = generateVideo(); });
test.beforeEach(async ({ page }) => {
  media = await startNativeMediaServer(bytes);
  page.on("pageerror", (error) => { throw error; });
  page.setDefaultTimeout(15_000);
  // Observe native calls/events, but always delegate to the original load().
  // No property fakes, dispatchEvent, route.fulfill, or accelerated media clock.
  await page.addInitScript(() => {
    window.mediaProbe = { refreshes: 0, loads: [], events: [] };
    const load = HTMLMediaElement.prototype.load;
    HTMLMediaElement.prototype.load = function (...args) {
      const record = { time: this.currentTime, at: performance.now(), wasPaused: this.paused };
      window.mediaProbe.loads.push(record);
      const result = Reflect.apply(load, this, args);
      record.resetTime = this.currentTime;
      record.resetPaused = this.paused;
      return result;
    };
    for (const type of ["error", "pause", "emptied", "loadstart", "loadedmetadata", "playing", "waiting", "stalled", "seeking", "seeked"]) {
      document.addEventListener(type, (event) => {
        if (!(event.target instanceof HTMLVideoElement)) return;
        const video = event.target;
        window.mediaProbe.events.push({
          type, time: video.currentTime, at: performance.now(), trusted: event.isTrusted,
          code: video.error?.code ?? null, readyState: video.readyState,
        });
      }, true);
    }
  });
  await page.goto(media.url);
  await page.getByRole("button", { name: "Putar video", exact: true }).click();
  await expect.poll(() => page.locator("video").evaluate((v) => !v.paused && v.currentTime > 1)).toBe(true);
});
test.afterEach(async ({ page }, info) => {
  const evidence = JSON.stringify({
    server: media.state,
    browser: await page.evaluate(() => window.mediaProbe).catch(() => null),
  }, null, 2);
  const evidencePath = info.outputPath("native-media-evidence.json");
  await writeFile(evidencePath, evidence);
  await info.attach("native-media-evidence", {
    path: evidencePath,
    contentType: "application/json",
  });
  await page.close();
  await media.close();
});

const probe = (page) => page.evaluate(() => window.mediaProbe);
const position = (page) => page.locator("video").evaluate((v) => v.currentTime);

async function seekOutsideBuffer(page, seconds) {
  await page.locator("video").evaluate((v, time) => { v.currentTime = time; }, seconds);
}

test("native network error reloads the fresh URL, restores position and makes HTTP Range requests", async ({ page }) => {
  await seekOutsideBuffer(page, 25);
  await expect.poll(() => page.locator("video").evaluate((v) => !v.seeking && !v.paused && v.currentTime > 25)).toBe(true);
  const before = await position(page);
  media.cut();
  await expect.poll(async () => (await probe(page)).events.filter((e) => e.type === "error" && e.code === 2).length, {
    timeout: 20_000, intervals: [25, 50, 100],
  }).toBeGreaterThan(0);
  // Restore the server before the application's first retry, not the element.
  media.state.mode = "stream";
  await expect.poll(async () => (await probe(page)).loads.length, { timeout: 15_000 }).toBe(1);
  await expect.poll(() => page.locator("video").evaluate((v) => !v.error && !v.paused && !v.seeking && v.currentTime > 25), { timeout: 15_000 }).toBe(true);
  const result = await probe(page);
  expect(result.refreshes).toBe(1);
  expect(result.loads[0].time).toBeGreaterThanOrEqual(before - 0.3);
  expect(await position(page)).toBeGreaterThanOrEqual(before - 0.3);
  const error = result.events.find((e) => e.type === "error" && e.code === 2);
  const pause = result.events.find((e) => e.type === "pause" && e.at >= error.at);
  const metadata = result.events.find((e) => e.type === "loadedmetadata" && e.at > result.loads[0].at);
  expect(pause).toBeTruthy();
  expect(metadata.at).toBeGreaterThan(pause.at);
  expect(result.events.some((e) => e.type === "seeked" && e.at > metadata.at && e.time >= before - 0.3)).toBe(true);
  expect(result.events.every((e) => e.trusted)).toBe(true);
  expect(media.state.cuts).toBeGreaterThan(0);
  expect(media.state.requests.some((r) => r.status === 206 && r.start > 0)).toBe(true);
  expect(new Set(media.state.requests.map((r) => r.url)).size).toBe(1);
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("native load resets a buffering element then restores position without cancelling recovery", async ({ page }) => {
  media.state.mode = "hold";
  await seekOutsideBuffer(page, 55);
  await expect(page.getByRole("status")).toBeVisible();
  await expect.poll(async () => (await probe(page)).loads.length, {
    timeout: 8000, intervals: [25, 50, 100],
  }).toBe(1);
  media.state.mode = "stream";
  await expect.poll(() => page.locator("video").evaluate((v) => !v.seeking && !v.paused && v.currentTime > 55), {
    timeout: 15_000,
  }).toBe(true);
  const result = await probe(page);
  const load = result.loads[0];
  const emptied = result.events.find((e) => e.type === "emptied" && e.at >= load.at);
  const metadata = result.events.find((e) => e.type === "loadedmetadata" && e.at > load.at);
  expect(load.wasPaused).toBe(false);
  expect(load.resetPaused).toBe(true);
  expect(load.resetTime).toBe(0);
  // Chromium resets paused without necessarily emitting a pause event here.
  // Assert the real lifecycle, not react-test-renderer's simulated event order.
  expect(emptied).toBeTruthy();
  expect(metadata.at).toBeGreaterThanOrEqual(emptied.at);
  expect(result.refreshes).toBe(1);
  expect(result.loads).toHaveLength(1);
  await expect(page.getByRole("status")).toHaveCount(0);
});

test("native buffering that recovers before retry does not restart or refresh the video", async ({ page }) => {
  media.state.mode = "hold";
  await seekOutsideBuffer(page, 55);
  await expect(page.getByRole("status")).toBeVisible();
  const checkpoint = await probe(page);
  media.state.mode = "stream";
  await expect.poll(() => page.locator("video").evaluate((v) => !v.seeking && !v.paused && v.currentTime > 55)).toBe(true);
  await expect(page.getByRole("status")).toHaveCount(0);
  await page.waitForTimeout(4500);
  const result = await probe(page);
  expect(result.loads).toHaveLength(0);
  expect(result.refreshes).toBe(1);
  expect(result.events.filter((e) => e.type === "loadedmetadata")).toHaveLength(1);
  expect(checkpoint.events.some((e) => e.type === "waiting" || e.type === "stalled")).toBe(true);
  expect(await position(page)).toBeGreaterThan(55);
});

test("a real truncated stream stops automatic recovery after exactly three native loads", async ({ page }) => {
  media.cut();
  await expect(page.getByText(/Pemulihan otomatis berhenti/)).toBeVisible({ timeout: 70_000 });
  const result = await probe(page);
  expect(result.loads).toHaveLength(3);
  expect(result.refreshes).toBe(1);
  expect(result.events.filter((e) => e.type === "error" && e.code === 2).length).toBeGreaterThanOrEqual(4);
  expect(result.events.some((e) => e.type === "pause")).toBe(true);
  expect(media.state.cuts).toBeGreaterThanOrEqual(1);
  expect(media.state.requests.filter((r) => r.status === 503).length).toBeGreaterThanOrEqual(4);
  const requestCount = media.state.requests.length;
  await page.waitForTimeout(7000);
  expect((await probe(page)).loads).toHaveLength(3);
  expect(media.state.requests).toHaveLength(requestCount);
  await expect(page.getByRole("button", { name: "Muat ulang video" })).toBeVisible();
});
