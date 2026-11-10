import assert from "node:assert/strict";
import test, { mock } from "node:test";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createServer, type ViteDevServer } from "vite";

let server: ViteDevServer;
let Player: React.ComponentType<any>;
let refreshes = 0;
let refresh: () => Promise<unknown>;
const material = { storage_path: "lesson.mp4", mime_type: "video/mp4", file_size_bytes: 1024 };

test.before(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as any).HTMLMediaElement = { HAVE_FUTURE_DATA: 3 };
  (globalThis as any).MediaError = { MEDIA_ERR_NETWORK: 2, MEDIA_ERR_DECODE: 3, MEDIA_ERR_SRC_NOT_SUPPORTED: 4 };
  (globalThis as any).__videoFixture = { refetch: () => { refreshes++; return refresh(); } };
  process.env.PORT ||= "4173";
  process.env.BASE_PATH ||= "/";
  server = await createServer({
    configFile: new URL("../../vite.config.ts", import.meta.url).pathname,
    cacheDir: "node_modules/.vite-video-recovery-tests",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true },
    appType: "custom",
    plugins: [{
      name: "video-recovery-fixtures",
      enforce: "pre",
      resolveId(id) {
        if (id.endsWith("/hooks/useAspekindoLms")) return "\0video-hooks";
        if (id.endsWith("/hooks/useAuth")) return "\0video-auth";
        if (id.endsWith("/hooks/use-toast")) return "\0video-toast";
        if (id.includes("/components/ui/")) return "\0video-ui";
      },
      load(id) {
        if (id === "\0video-auth") return "export const useAuth = () => ({});";
        if (id === "\0video-toast") return "export const useToast = () => ({});";
        if (id === "\0video-hooks") return `
          export const useAspekindoLmsVideoUrl = () => globalThis.__videoFixture;
          ${[
            "useAspekindoLmsCatalog", "useAspekindoLmsCompletionRecords", "useAspekindoLmsCourse",
            "useAspekindoLmsMyEnrollments", "useAspekindoLmsMyProgress", "useAspekindoLmsQuizAttempts",
            "useAspekindoLmsQuizQuestions", "useCompleteAspekindoLmsCourse", "useCompleteAspekindoLmsLesson",
            "useEnrollAspekindoLmsCourse", "useSaveAspekindoLmsProgress", "useSubmitAspekindoLmsQuiz",
          ].map((name) => `export const ${name} = () => ({});`).join("\n")}
        `;
        if (id === "\0video-ui") return `
          import React from "react";
          const Box = ({children, ...props}) => React.createElement("div", props, children);
          export const Button = ({children, ...props}) => React.createElement("button", props, children);
          export const Badge = Box, Card = Box, CardContent = Box, CardDescription = Box,
            CardHeader = Box, CardTitle = Box, Input = Box, Progress = Box, MarkdownRenderer = Box;
        `;
      },
      transform(code, id) {
        if (id.endsWith("/pages/AspekindoLmsNative.tsx")) {
          return code.replace("function VideoMaterialPlayer(", "export function VideoMaterialPlayer(");
        }
      },
    }],
  });
  Player = (await server.ssrLoadModule("/src/pages/AspekindoLmsNative.tsx")).VideoMaterialPlayer;
});

test.after(async () => {
  await server?.close();
  delete (globalThis as any).__videoFixture;
  delete (globalThis as any).HTMLMediaElement;
  delete (globalThis as any).MediaError;
});

function text(node: any): string {
  return typeof node === "string" ? node : (node.children ?? []).map(text).join("");
}

async function fixture(stale: boolean | number = false) {
  refreshes = 0;
  const now = Date.now();
  refresh = async () => ({
    data: "https://storage.example/video",
    dataUpdatedAt: now - (typeof stale === "number" ? stale : stale ? 25 * 60 * 1000 + 1 : 0),
    error: null,
  });
  let root!: ReactTestRenderer;
  let loads = 0;
  let plays = 0;
  const video = {
    currentTime: 0, paused: true, ended: false, seeking: false, readyState: 0,
    error: null as { code: number; message?: string } | null,
    load() {
      loads++;
      const wasPaused = this.paused;
      this.currentTime = 0;
      this.readyState = 0;
      this.error = null;
      this.paused = true;
      if (!wasPaused) props().onPause({ currentTarget: video });
      props().onTimeUpdate({ currentTarget: video });
    },
    async play() {
      plays++;
      this.paused = false;
      this.readyState = 4;
      props().onPlaying();
    },
    pause() { this.paused = true; },
  };
  const props = () => root.root.findByType("video").props;
  const click = async (label: string) => {
    await act(async () => {
      await root.root.findAllByType("button").find((b) => text(b).trim() === label)!.props.onClick();
    });
  };
  const event = async (name: string) => {
    await act(async () => { props()[name]({ currentTarget: video }); });
  };
  await act(async () => {
    root = create(React.createElement(Player, { material }), {
      createNodeMock: (element) => element.type === "video" ? video : null,
    });
  });
  await click("Putar video");
  await event("onLoadedMetadata");
  video.currentTime = 42;
  await event("onTimeUpdate");
  mock.timers.enable({ apis: ["setTimeout", "Date"], now });
  return {
    root, video, event, click,
    counts: () => ({ loads, plays, refreshes }),
    tick: async (ms: number) => { await act(async () => { mock.timers.tick(ms); }); },
    fail: async (code = 2) => {
      video.error = { code, message: "Private media failure: https://storage.example/video?token=private-token" };
      video.readyState = 0;
      video.paused = true;
      await event("onPause");
      await event("onError");
    },
    close: async () => { await act(async () => root.unmount()); mock.timers.reset(); },
  };
}

test("error jaringan dengan URL segar reload URL sama dan pulihkan posisi, tanpa refresh", async () => {
  const f = await fixture();
  try {
    await f.fail();
    await f.tick(1000);
    assert.deepEqual(f.counts(), { loads: 1, plays: 1, refreshes: 1 });
    await f.event("onLoadedMetadata");
    assert.equal(f.video.currentTime, 42);
    assert.equal(f.video.paused, false);
    await f.tick(60_000);
    assert.deepEqual(f.counts(), { loads: 1, plays: 2, refreshes: 1 });
  } finally { await f.close(); }
});

test("pulih sendiri sebelum backoff tidak me-restart video", async () => {
  const f = await fixture();
  try {
    await f.fail();
    f.video.error = null;
    f.video.readyState = 4;
    f.video.paused = false;
    await f.tick(1000);
    assert.equal(f.counts().loads, 0);
    assert.equal(f.root.root.findAllByProps({ role: "status" }).length, 0);
  } finally { await f.close(); }
});

test("jeda pemulihan membatalkan retry dan tidak autoplay saat metadata datang", async () => {
  const f = await fixture();
  try {
    await f.fail();
    await f.tick(1000);
    await f.click("Jeda pemulihan");
    await f.event("onLoadedMetadata");
    await f.tick(60_000);
    assert.equal(f.video.currentTime, 42);
    assert.equal(f.counts().plays, 1);
    assert.equal(f.counts().loads, 1);
  } finally { await f.close(); }
});

test("error berulang berhenti setelah tiga reload dan menyediakan coba ulang manual", async () => {
  const f = await fixture();
  try {
    await f.fail();
    for (const delay of [1000, 3000, 6000]) {
      await f.tick(delay);
      await f.fail();
    }
    await f.tick(6000);
    assert.equal(f.counts().loads, 3);
    assert.match(text(f.root.toJSON()), /Pemulihan otomatis berhenti/);
    await f.tick(60_000);
    assert.equal(f.counts().loads, 3);
    await f.click("Muat ulang video");
    assert.equal(f.counts().refreshes, 2);
    await f.event("onLoadedMetadata");
    assert.equal(f.video.currentTime, 42);
  } finally { await f.close(); }
});

for (const stale of [false, true]) {
  for (const code of [3, 4]) {
    test(`error ${code === 3 ? "decode" : "format"} dengan URL ${stale ? "lama" : "segar"} menjelaskan solusi tanpa retry`, async () => {
      const f = await fixture(stale);
      try {
        await f.fail(code);
        const message = text(f.root.toJSON());
        assert.match(message, code === 3 ? /Video tidak dapat didekode/ : /Format video tidak didukung browser ini/);
        assert.match(message, code === 3 ? /File mungkin rusak atau codec tidak kompatibel/ : /Format atau codec video tidak didukung/);
        assert.match(message, /browser.*terbaru/i);
        assert.match(message, /hubungi admin/);
        assert.doesNotMatch(message, /Periksa koneksi|https?:|storage\.example|private-token/);
        assert.equal(f.root.root.findAllByType("button").length, 0);
        assert.equal(f.root.root.findAllByType("source").length, 0);
        assert.equal(f.root.root.findAllByProps({ role: "status" }).length, 0);
        await f.tick(60_000);
        assert.deepEqual(f.counts(), { loads: 0, plays: 1, refreshes: 1 });
        assert.equal(text(f.root.toJSON()), message);
      } finally { await f.close(); }
    });
  }
}

test("format tidak didukung membatalkan retry jaringan yang sudah dijadwalkan", async () => {
  const f = await fixture();
  try {
    await f.fail();
    await f.fail(4);
    await f.tick(60_000);
    assert.match(text(f.root.toJSON()), /Format video tidak didukung browser ini/);
    assert.deepEqual(f.counts(), { loads: 0, plays: 1, refreshes: 1 });
  } finally { await f.close(); }
});

test("error decode tidak ditimpa hasil refresh jaringan yang terlambat", async () => {
  const f = await fixture(true);
  try {
    let finish!: (value: unknown) => void;
    refresh = () => new Promise((resolve) => { finish = resolve; });
    await f.fail();
    await f.tick(1000);
    await f.fail(3);
    await act(async () => {
      finish({ data: "https://storage.example/new-video?token=private-token", dataUpdatedAt: Date.now(), error: null });
    });
    await f.tick(60_000);
    assert.match(text(f.root.toJSON()), /Video tidak dapat didekode/);
    assert.doesNotMatch(text(f.root.toJSON()), /https?:|private-token/);
    assert.equal(f.root.root.findAllByType("source").length, 0);
    assert.deepEqual(f.counts(), { loads: 0, plays: 1, refreshes: 2 });
  } finally { await f.close(); }
});

test("buffering URL segar menunggu empat detik sebelum pemulihan", async () => {
  const f = await fixture();
  try {
    f.video.readyState = 2;
    await f.event("onWaiting");
    await f.event("onStalled");
    await f.tick(3999);
    assert.equal(f.counts().loads, 0);
    await f.tick(1);
    assert.equal(f.counts().loads, 1);
    assert.equal(f.counts().refreshes, 1);
  } finally { await f.close(); }
});

test("backoff tidak melewati batas kesegaran URL setelah reload tautan yang masih segar", async () => {
  const f = await fixture(25 * 60 * 1000 - 10_000);
  try {
    refresh = async () => ({ data: "https://storage.example/new-video", dataUpdatedAt: Date.now(), error: null });
    f.video.readyState = 2;
    await f.event("onWaiting");
    await f.tick(4000);
    assert.deepEqual(f.counts(), { loads: 1, plays: 1, refreshes: 1 });
    await f.tick(3000);
    assert.equal(f.counts().loads, 2);
    await f.tick(2999);
    assert.equal(f.counts().refreshes, 1);
    assert.equal(f.root.root.findByType("source").props.src, "https://storage.example/video");
    await f.tick(1);
    assert.equal(f.counts().refreshes, 2);
    assert.equal(f.root.root.findByType("source").props.src, "https://storage.example/new-video");
  } finally { await f.close(); }
});

test("tautan lama diperbarui dan posisi tetap dipertahankan", async () => {
  const f = await fixture(true);
  try {
    refresh = async () => ({ data: "https://storage.example/new-video", dataUpdatedAt: Date.now(), error: null });
    await f.fail();
    await f.tick(1000);
    assert.equal(f.counts().refreshes, 2);
    assert.equal(f.root.root.findByType("source").props.src, "https://storage.example/new-video");
    await f.event("onLoadedMetadata");
    assert.equal(f.video.currentTime, 42);
    assert.equal(f.video.paused, false);
  } finally { await f.close(); }
});

test("refresh lambat tidak mengganti stream yang sudah kembali lancar", async () => {
  const f = await fixture(true);
  try {
    let finish!: (value: unknown) => void;
    refresh = () => new Promise((resolve) => { finish = resolve; });
    await f.fail();
    await f.tick(1000);
    f.video.error = null;
    f.video.readyState = 4;
    f.video.paused = false;
    await f.event("onPlaying");
    await act(async () => {
      finish({ data: "https://storage.example/new-video", dataUpdatedAt: Date.now(), error: null });
    });
    assert.equal(f.root.root.findByType("source").props.src, "https://storage.example/video");
    assert.equal(f.counts().loads, 0);
    assert.equal(f.counts().plays, 1);
    assert.equal(f.root.root.findAllByProps({ role: "status" }).length, 0);
  } finally { await f.close(); }
});

test("error baru setelah pulih singkat saat refresh lambat tetap dijadwalkan", async () => {
  const f = await fixture(true);
  try {
    let finish!: (value: unknown) => void;
    refresh = () => new Promise((resolve) => { finish = resolve; });
    await f.fail();
    await f.tick(1000);
    f.video.error = null;
    f.video.readyState = 4;
    f.video.paused = false;
    await f.event("onPlaying");
    await f.fail();
    await act(async () => {
      finish({ data: null, error: new Error("offline") });
    });
    refresh = async () => ({ data: "https://storage.example/recovered", dataUpdatedAt: Date.now(), error: null });
    await f.tick(2999);
    assert.equal(f.counts().refreshes, 2);
    await f.tick(1);
    assert.equal(f.counts().refreshes, 3);
    assert.equal(f.root.root.findByType("source").props.src, "https://storage.example/recovered");
  } finally { await f.close(); }
});

test("jeda native sebelum metadata reload tiba tidak diabaikan", async () => {
  const f = await fixture();
  try {
    await f.fail();
    await f.tick(1000);
    // The user briefly presses play, then pause via the native controls while
    // metadata is still loading. This pause is not load()'s synthetic pause.
    f.video.paused = true;
    await f.event("onPause");
    await f.event("onLoadedMetadata");
    await f.tick(60_000);
    assert.equal(f.video.currentTime, 42);
    assert.equal(f.counts().plays, 1);
    assert.equal(f.counts().loads, 1);
  } finally { await f.close(); }
});

test("pause bawaan load diabaikan sekali, pause native selanjutnya dihormati", async () => {
  const f = await fixture();
  try {
    f.video.readyState = 2;
    await f.event("onWaiting");
    await f.tick(4000);
    // load() interrupted a playing element and emitted its automatic pause.
    assert.equal(f.root.root.findAllByProps({ role: "status" }).length, 1);
    await f.event("onPause");
    await f.event("onLoadedMetadata");
    await f.tick(60_000);
    assert.equal(f.counts().plays, 1);
    assert.equal(f.counts().loads, 1);
  } finally { await f.close(); }
});
