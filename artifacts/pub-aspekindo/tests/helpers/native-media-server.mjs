import { createServer as createHttpServer } from "node:http";
import { readFileSync, mkdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createServer as createViteServer } from "vite";
import react from "@vitejs/plugin-react";

const root = fileURLToPath(new URL("../../", import.meta.url));
const output = fileURLToPath(new URL("../../../../generated-artifacts/native-media/", import.meta.url));

// Generated locally, deterministic, and never checked in. Frequent keyframes
// make seeks observable without fetching a remote asset or using codec mocks.
export function generateVideo() {
  mkdirSync(output, { recursive: true });
  const filename = `${output}/lesson.webm`;
  execFileSync("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "testsrc2=size=320x180:rate=24",
    "-t", "90", "-an", "-c:v", "libvpx", "-b:v", "800k",
    "-g", "24", "-deadline", "realtime", filename,
  ]);
  return readFileSync(filename);
}

export async function startNativeMediaServer(bytes) {
  const state = { mode: "stream", requests: [], cuts: 0 };
  const streams = new Set();
  const hooks = [
    "useAspekindoLmsCatalog", "useAspekindoLmsCompletionRecords", "useAspekindoLmsCourse",
    "useAspekindoLmsMyEnrollments", "useAspekindoLmsMyProgress", "useAspekindoLmsQuizAttempts",
    "useAspekindoLmsQuizQuestions", "useCompleteAspekindoLmsCourse", "useCompleteAspekindoLmsLesson",
    "useEnrollAspekindoLmsCourse", "useSaveAspekindoLmsProgress", "useSubmitAspekindoLmsQuiz",
  ];
  const vite = await createViteServer({
    configFile: false,
    root,
    cacheDir: `${root}/node_modules/.vite-native-media`,
    resolve: { alias: { "@": `${root}/src` }, dedupe: ["react", "react-dom"] },
    server: { middlewareMode: true },
    appType: "custom",
    plugins: [
      {
        name: "native-media-fixture",
        enforce: "pre",
        resolveId(id) {
          if (id === "/native-entry.jsx") return "\0native-entry.jsx";
          if (id.endsWith("/hooks/useAspekindoLms")) return "\0native-hooks";
          if (id.endsWith("/hooks/useAuth")) return "\0native-auth";
        },
        load(id) {
          if (id === "\0native-auth") return "export const useAuth = () => ({});";
          if (id === "\0native-hooks") return `
            export const useAspekindoLmsVideoUrl = () => ({
              refetch: async () => {
                window.mediaProbe.refreshes++;
                return { data: "/lesson.webm?fresh=local", dataUpdatedAt: Date.now(), error: null };
              }
            });
            ${hooks.map((name) => `export const ${name} = () => ({});`).join("\n")}
          `;
          if (id === "\0native-entry.jsx") return `
            import React from "react";
            import { createRoot } from "react-dom/client";
            import { VideoMaterialPlayer } from "/src/pages/AspekindoLmsNative.tsx";
            createRoot(document.getElementById("root")).render(
              React.createElement(VideoMaterialPlayer, {material: {storage_path:"lesson.webm", mime_type:"video/webm", file_size_bytes:${bytes.length}}})
            );
          `;
        },
        transform(code, id) {
          if (id.endsWith("/pages/AspekindoLmsNative.tsx")) {
            return code.replace("function VideoMaterialPlayer(", "export function VideoMaterialPlayer(");
          }
        },
      },
      react(),
    ],
  });
  const server = createHttpServer(async (req, res) => {
    if (req.url?.startsWith("/lesson.webm")) {
      const range = req.headers.range;
      const match = /^bytes=(\d+)-(\d*)$/.exec(range ?? "");
      const start = match ? Number(match[1]) : 0;
      const end = match?.[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1;
      if (start > end || start >= bytes.length) {
        res.writeHead(416, { "Content-Range": `bytes */${bytes.length}` }).end();
        return;
      }
      const record = { range, start, end, status: match ? 206 : 200, sent: 0, cut: false, url: req.url };
      state.requests.push(record);
      // Chromium transparently resumes a truncated response with another Range.
      // Refuse that continuation rather than letting each retry fetch more data.
      if (state.mode === "cut" && start > 0) {
        record.status = 503;
        res.writeHead(503, { "Cache-Control": "no-store" }).end();
        return;
      }
      res.writeHead(record.status, {
        "Content-Type": "video/webm",
        "Accept-Ranges": "bytes",
        "Content-Length": end - start + 1,
        "Cache-Control": "no-store",
        ...(match ? { "Content-Range": `bytes ${start}-${end}/${bytes.length}` } : {}),
      });
      res.flushHeaders();
      let offset = start;
      const stream = { res, record };
      streams.add(stream);
      const timer = setInterval(() => {
        if (state.mode === "hold") return;
        // Give reloads real metadata first; then truncate the declared response.
        if (state.mode === "cut" && record.sent >= 64 * 1024) {
          record.cut = true;
          state.cuts++;
          res.destroy();
          return;
        }
        const next = Math.min(offset + 8192, end + 1);
        res.write(bytes.subarray(offset, next));
        record.sent += next - offset;
        offset = next;
        if (offset > end) res.end();
      }, 40);
      res.on("close", () => { clearInterval(timer); streams.delete(stream); });
      return;
    }
    if (req.url === "/") {
      const html = await vite.transformIndexHtml("/", `
        <html><body><div id="root"></div><script type="module" src="/native-entry.jsx"></script></body></html>
      `);
      res.writeHead(200, { "Content-Type": "text/html" }).end(html);
      return;
    }
    vite.middlewares(req, res, () => res.writeHead(404).end());
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return {
    url: `http://127.0.0.1:${server.address().port}`,
    state,
    cut() {
      state.mode = "cut";
      for (const { res, record } of streams) {
        record.cut = true;
        state.cuts++;
        res.destroy();
      }
    },
    async close() {
      for (const { res } of streams) res.destroy();
      await vite.close();
      server.closeAllConnections();
      await new Promise((resolve) => server.close(resolve));
    },
  };
}
