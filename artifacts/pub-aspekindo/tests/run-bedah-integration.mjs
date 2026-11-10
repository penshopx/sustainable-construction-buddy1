import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { spawn, execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { once } from "node:events";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const appRoot = path.join(root, "artifacts/pub-aspekindo");

async function main() {
  // No environment fallback: never inherit hosted Supabase, DB or AI credentials.
  const statusFile = process.argv[2];
  assert(statusFile, "Usage: pnpm test:bedah:integration /path/to/local-supabase-status.json");
  const config = JSON.parse(await readFile(statusFile, "utf8"));
  const { localUrl } = await import("../../api-server/tests/helpers/bedah-integration.mjs");
  localUrl(config.API_URL);
  localUrl(config.DB_URL, ["postgresql:", "postgres:"]);
  const directory = await mkdtemp(path.join(root, "generated-artifacts/bedah/run-"));
  try {
    const keyPath = path.join(directory, "tls.key");
    const certPath = path.join(directory, "tls.crt");
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes",
      "-keyout", keyPath, "-out", certPath, "-days", "1", "-subj", "/CN=127.0.0.1",
      "-addext", "subjectAltName=IP:127.0.0.1"], { stdio: "ignore" });
    const isolatedStatus = path.join(directory, "status.json");
    await writeFile(isolatedStatus, JSON.stringify(config), { mode: 0o600 });
    // A clean child process is important: production env must not leak into Vite,
    // the API bundle or the browser. Node trusts only this generated local cert.
    const env = {
      PATH: process.env.PATH, HOME: process.env.HOME, CI: process.env.CI || "",
      LANG: "C.UTF-8", NODE_EXTRA_CA_CERTS: certPath,
      BEDAH_TEST_DIRECTORY: directory, BEDAH_TEST_STATUS: isolatedStatus,
      PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || "",
      BEDAH_CHROMIUM_EXECUTABLE: process.env.BEDAH_CHROMIUM_EXECUTABLE || "",
      BEDAH_SETUP_CHECK: process.argv.includes("--setup-check") ? "1" : "",
      BEDAH_UPLOAD_CHECK: process.argv.includes("--upload-check") ? "1" : "",
    };
    const child = spawn(process.execPath, [fileURLToPath(new URL("./helpers/bedah-server.mjs", import.meta.url))], {
      cwd: appRoot, env, stdio: "inherit",
    });
    const interrupt = () => child.kill("SIGTERM");
    process.once("SIGINT", interrupt);
    process.once("SIGTERM", interrupt);
    const [code] = await once(child, "exit");
    process.removeListener("SIGINT", interrupt);
    process.removeListener("SIGTERM", interrupt);
    assert.equal(code, 0, "Bedah integration did not pass");
  } finally {
    // Includes disposable passwords/session manifests and private files.
    await rm(directory, { recursive: true, force: true });
  }
}
await main();
