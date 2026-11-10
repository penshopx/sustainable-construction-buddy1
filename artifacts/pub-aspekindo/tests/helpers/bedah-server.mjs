import { readFile, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "vite";
import { startBedahIntegration } from "../../../api-server/tests/helpers/bedah-integration.mjs";
import { checkBedahBackend } from "../../../api-server/tests/helpers/bedah-backend-check.mjs";

const directory = process.env.BEDAH_TEST_DIRECTORY;
const appRoot = fileURLToPath(new URL("../../", import.meta.url));
const config = JSON.parse(await readFile(process.env.BEDAH_TEST_STATUS, "utf8"));
const fixture = await startBedahIntegration({
  config, directory,
  key: await readFile(path.join(directory, "tls.key")),
  cert: await readFile(path.join(directory, "tls.crt")),
});
let server, child;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  child?.kill("SIGTERM");
  if (server) { server.closeAllConnections(); await new Promise(r => server.close(r)); }
  await fixture.stop();
}
process.once("SIGTERM", () => { void stop().then(() => process.exit(143)); });
process.once("SIGINT", () => { void stop().then(() => process.exit(130)); });
try {
  await checkBedahBackend(fixture);
  console.log("PASS: real-Auth HTTP preflight (upload, analysis, chat, owner/admin isolation, deletion).");
  process.env.VITE_SUPABASE_URL = fixture.authUrl;
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY = fixture.anonKey;
  process.env.PORT = "4198"; // Required by config; build never listens on it.
  process.env.BASE_PATH = "/";
  const output = path.join(directory, "public");
  await build({
    root: appRoot, configFile: path.join(appRoot, "vite.config.ts"),
    cacheDir: path.join(directory, "vite-cache"),
    build: { outDir: output, emptyOutDir: true },
    plugins: [{
      name: "bedah-real-sdk-handle",
      // Test build only: expose the SAME real SDK instance used by AuthProvider,
      // without a second client, synthetic events, injected sessions or fixtures.
      transformIndexHtml: {
        order: "pre",
        handler: () => [{ tag: "script", attrs: { type: "module", src: "/__bedah-sdk.ts" }, injectTo: "head" }],
      },
      resolveId(id) { if (id === "/__bedah-sdk.ts") return "\0bedah-sdk"; },
      load(id) {
        if (id === "\0bedah-sdk") return `import {supabase} from ${JSON.stringify(path.join(appRoot, "src/integrations/supabase/client.ts"))}; window.__bedahSdk=supabase;`;
      },
    }],
  });
  server = createServer(async (req, res) => {
    if (req.url.startsWith("/api/")) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const headers = { ...req.headers };
      // Preserve browser Host/Origin so the real origin guard executes.
      delete headers.connection;
      headers["x-forwarded-host"] = req.headers.host;
      try {
        const response = await fetch(`${fixture.apiUrl}${req.url}`, {
          method: req.method, headers, redirect: "manual",
          ...(!["GET", "HEAD"].includes(req.method) ? { body: Buffer.concat(chunks) } : {}),
        });
        res.statusCode = response.status;
        for (const [name, value] of response.headers) {
          if (!["content-length", "content-encoding", "connection", "transfer-encoding"].includes(name)) res.setHeader(name, value);
        }
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch { res.writeHead(502).end(); }
    } else {
      const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
      const file = path.resolve(output, `.${pathname === "/" ? "/index.html" : pathname}`);
      if (!file.startsWith(`${output}/`)) { res.writeHead(404).end(); return; }
      const types = { ".html": "text/html", ".js": "application/javascript", ".css": "text/css",
        ".json": "application/json", ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon",
        ".woff": "font/woff", ".woff2": "font/woff2", ".webp": "image/webp", ".jpg": "image/jpeg" };
      try {
        res.setHeader("Content-Type", types[path.extname(file)] || "application/octet-stream");
        res.end(await readFile(file));
      } catch {
        if (path.extname(pathname)) { res.writeHead(404).end(); return; }
        res.setHeader("Content-Type", "text/html");
        res.end(await readFile(path.join(output, "index.html")));
      }
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  await checkBedahBackend({ ...fixture, apiUrl: baseUrl, controlUrl: fixture.apiUrl, origin: baseUrl });
  console.log("PASS: browser-origin HTTP proxy preflight.");
  const manifest = path.join(directory, "browser.json");
  await writeFile(manifest, JSON.stringify({
    baseUrl, authUrl: fixture.authUrl, apiUrl: fixture.apiUrl,
    anonKey: fixture.anonKey, accounts: fixture.accounts,
  }), { mode: 0o600 });
  if (process.env.BEDAH_SETUP_CHECK === "1") {
    console.log("Disposable Bedah environment is ready.");
  } else {
  // Verify the actual table/blob state as well as the visible UI and HTTP.
  const before = await fixture.pool.query("SELECT count(*)::int AS n FROM rs_workspaces");
  if (before.rows[0].n !== 0) throw new Error("Disposable API database was not empty");
  child = spawn("pnpm", ["exec", "playwright", "test", "--config", "playwright.bedah.config.mjs"], {
    cwd: appRoot, env: { ...process.env, BEDAH_BROWSER_MANIFEST: manifest }, stdio: "inherit",
  });
  const [code] = await once(child, "exit");
  if (code !== 0) throw new Error("Real-Auth Bedah browser integration failed");
  const { rows } = await fixture.pool.query("SELECT state FROM rs_workspaces WHERE owner_id=$1", [fixture.accounts.owner.id]);
  if (rows[0]?.state.documents.length || rows[0]?.state.documentAnalyses.length) throw new Error("Source deletion left private analysis metadata behind");
  const { readdir } = await import("node:fs/promises");
  const files = await readdir(fixture.privateRoot, { recursive: true, withFileTypes: true });
  if (files.some(f => f.isFile())) throw new Error("Source deletion left a private blob behind");
  console.log("PASS: real Auth + PUB middleware + SQL + private file cleanup. AI is deterministic; not a paid-provider smoke.");
  }
} finally {
  await stop();
}
