import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "esbuild";
import express from "express";

// Disposable PostgreSQL only. Never read a development/hosted database or credentials.
const directory = mkdtempSync(join(tmpdir(), "vault-summary-"));
const { Pool } = createRequire(import.meta.resolve("@workspace/db"))("pg");
let pool, server, base;
test.after(async () => {
  server?.closeAllConnections();
  if (server) await new Promise(resolve => server.close(resolve));
  await pool?.end();
  try { execFileSync("pg_ctl", ["-D", join(directory, "db"), "-m", "immediate", "stop"], { stdio: "ignore" }); }
  finally { rmSync(directory, { recursive: true, force: true }); delete globalThis.__summaryPool; }
});

test.before(async () => {
  execFileSync("initdb", ["-D", join(directory, "db"), "-A", "trust", "-U", "summary_test", "--no-locale"], { stdio: "ignore" });
  execFileSync("pg_ctl", ["-D", join(directory, "db"), "-l", join(directory, "pg.log"),
    "-o", `-F -h '' -k ${directory}`, "-w", "start"], { stdio: "ignore" });
  pool = new Pool({ host: directory, user: "summary_test", database: "postgres" });
  globalThis.__summaryPool = pool;
  await pool.query("CREATE TABLE rs_workspaces(owner_id text PRIMARY KEY, state jsonb NOT NULL, updated_at timestamptz DEFAULT now())");
  const root = fileURLToPath(new URL("..", import.meta.url));
  const bundle = await build({
    stdin: { contents: 'export { vaultRouter } from "./src/routes/vault";', resolveDir: root, loader: "ts" },
    bundle: true, platform: "node", format: "cjs", write: false,
    plugins: [{
      name: "local-summary-boundaries",
      setup(b) {
        b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "db", namespace: "fixture" }));
        b.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const pool = globalThis.__summaryPool;" }));
        b.onLoad({ filter: /logger\.ts$/ }, () => ({ contents: "export const logger = { warn() {}, info() {}, error() {} };" }));
        // Keep the actual owner middleware and store; only replace the external identity provider.
        b.onLoad({ filter: /chat-service\.ts$/ }, () => ({ contents: `
          export class ChatServiceError extends Error { constructor(status, message) { super(message); this.status = status; } }
          export const createChatService = () => ({
            async requireMember(authorization) {
              if (authorization === "Bearer owner-a") return "owner-a";
              if (authorization === "Bearer owner-b") return "owner-b";
              throw new ChatServiceError(401, "Login required");
            }
          });
        ` }));
      },
    }],
  });
  const compiled = { exports: {} };
  new Function("require", "module", "exports", bundle.outputFiles[0].text)(
    createRequire(import.meta.url), compiled, compiled.exports);
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => { req.log = { warn() {} }; next(); });
  app.use("/api/ruang-simpan", compiled.exports.vaultRouter);
  app.use((err, _req, res, _next) => res.status(err.status || 500).json({ error: "Request failed" }));
  server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}/api/ruang-simpan`;
  for (const owner of ["owner-a", "owner-b"]) {
    await pool.query("INSERT INTO rs_workspaces(owner_id,state) VALUES($1,$2)", [owner, JSON.stringify({
      profile: { name: owner, version: 3, nib: "PRIVATE-NIB", address: "PRIVATE-ADDRESS" },
      documents: [{ status: "ready", text: "PRIVATE-TEXT", objectPath: "PRIVATE-PATH" }, { status: "processing" }],
      connections: [{ tokenHash: "PRIVATE-TOKEN" }], documentAnalyses: [{ answer: "PRIVATE-ANALYSIS" }], activities: [],
    })]);
  }
});

const request = (owner, suffix = "") => fetch(`${base}/workspace/summary${suffix}`, {
  headers: owner ? { Authorization: `Bearer ${owner}` } : {},
});

test("summary verifies owner, has an exact minimal response and never writes the workspace", async () => {
  assert.equal((await request()).status, 401);
  assert.equal((await request("invalid")).status, 401);
  const before = (await pool.query("SELECT * FROM rs_workspaces ORDER BY owner_id")).rows;
  for (const owner of ["owner-a", "owner-b"]) {
    const response = await request(owner, "?owner_id=other&userId=other");
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    const summary = await response.json();
    assert.deepEqual(Object.keys(summary).sort(), ["checkedAt", "documentCount", "profile", "readyDocumentCount"]);
    assert.deepEqual(summary.profile, { name: owner, version: 3 });
    assert.equal(summary.documentCount, 2);
    assert.equal(summary.readyDocumentCount, 1);
    assert.ok(Number.isFinite(Date.parse(summary.checkedAt)));
    assert.ok(!JSON.stringify(summary).includes("PRIVATE-"));
  }
  assert.deepEqual((await pool.query("SELECT * FROM rs_workspaces ORDER BY owner_id")).rows, before);
  const cookie = await fetch(`${base}/workspace/summary`, { headers: { Cookie: "rs_pub_session=owner-b" } });
  assert.equal((await cookie.json()).profile.name, "owner-b");
  const external = await fetch(`${base}/workspace/summary`, { headers: { Authorization: "Bearer scoped-app-token" } });
  assert.equal(external.status, 401);
});

test("profile edits, OCR readiness and deletion appear on the next summary read", async () => {
  const edited = await fetch(`${base}/profile`, {
    method: "PUT", headers: { Authorization: "Bearer owner-a", "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Updated company", nib: "", address: "", version: 3 }),
  });
  assert.equal(edited.status, 200);
  await pool.query(`UPDATE rs_workspaces SET state = jsonb_set(state, '{documents,1,status}', '"ready"') WHERE owner_id = $1`, ["owner-a"]);
  let summary = await (await request("owner-a")).json();
  assert.deepEqual(summary.profile, { name: "Updated company", version: 4 });
  assert.equal(summary.readyDocumentCount, 2);
  await pool.query(`UPDATE rs_workspaces SET state = jsonb_set(state, '{documents}', '[]') WHERE owner_id = $1`, ["owner-a"]);
  summary = await (await request("owner-a")).json();
  assert.equal(summary.documentCount, 0);
  assert.equal(summary.readyDocumentCount, 0);
  const other = await (await request("owner-b")).json();
  assert.equal(other.profile.version, 3);
  assert.equal(other.documentCount, 2);
});
