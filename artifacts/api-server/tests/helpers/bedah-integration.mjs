// Test-only I/O boundaries. Auth, routers, extraction, ownership checks and SQL
// transactions are production code; only paid AI and App Storage are local.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { build } from "esbuild";
import { readFile, writeFile, mkdir, rm, access } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import { createServer as createHttpsServer } from "node:https";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import path from "node:path";

const require = createRequire(import.meta.url);
const { Pool } = createRequire(new URL("../../../../lib/db/package.json", import.meta.url))("pg");
const express = require("express");
export function localUrl(value, protocols = ["http:", "https:"]) {
  const url = new URL(value);
  assert(protocols.includes(url.protocol) && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname),
    "Bedah integration refuses non-loopback services");
  assert(!url.search && !url.hash, "Unexpected URL options");
  return url;
}
async function listen(server) {
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return server.address().port;
}
async function close(server) {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
}

export async function startBedahIntegration({ config, directory, key, cert }) {
  const upstream = localUrl(config.API_URL);
  const database = localUrl(config.DB_URL, ["postgres:", "postgresql:"]);
  assert(config.ANON_KEY && config.SERVICE_ROLE_KEY, "Local Supabase status is incomplete");
  const cleanup = [];
  const poolName = `bedah_${randomUUID().replaceAll("-", "")}`;
  const control = new Pool({ connectionString: database.href });
  let pool;
  const users = [];
  const stop = async () => {
    const errors = [];
    for (const fn of cleanup.reverse()) {
      try { await fn(); } catch { errors.push("local resource cleanup failed"); }
    }
    for (const id of users) {
      try {
        const response = await fetch(new URL(`/auth/v1/admin/users/${id}`, upstream), {
          method: "DELETE", headers: { apikey: config.SERVICE_ROLE_KEY, Authorization: `Bearer ${config.SERVICE_ROLE_KEY}` },
        });
        assert(response.ok);
      } catch { errors.push("disposable Auth user cleanup failed"); }
    }
    if (pool) await pool.end();
    try { await control.query(`DROP DATABASE IF EXISTS ${poolName} WITH (FORCE)`); }
    catch { errors.push("disposable database cleanup failed"); }
    await control.end();
    await rm(path.join(directory, "private"), { recursive: true, force: true });
    assert.equal(errors.length, 0, errors.join("; "));
  };
  try {
    // Keep application metadata in its own database, not the user's workspace DB.
    await control.query(`CREATE DATABASE ${poolName}`);
    database.pathname = `/${poolName}`;
    pool = new Pool({ connectionString: database.href });
    // The only API table used here; same metadata schema as Drizzle, no hosted DB.
    await pool.query(`CREATE TABLE rs_workspaces (
      owner_id text PRIMARY KEY, state jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now())`);

    // HTTPS is intentional: real requireMember rejects plain HTTP Auth origins.
    // Forward Auth/PostgREST unchanged, not fixtures or minted tokens.
    const gateway = createHttpsServer({ key, cert }, async (req, res) => {
      try {
        assert(/^\/(auth|rest)\/v1\//.test(req.url), "Unexpected Supabase path");
        const body = [];
        for await (const chunk of req) body.push(chunk);
        const headers = { ...req.headers };
        delete headers.host;
        delete headers.connection;
        const response = await fetch(new URL(req.url, upstream), {
          method: req.method, headers, redirect: "manual",
          ...(!["GET", "HEAD"].includes(req.method) ? { body: Buffer.concat(body) } : {}),
        });
        res.statusCode = response.status;
        for (const [name, value] of response.headers) {
          if (!["content-encoding", "content-length", "transfer-encoding", "connection"].includes(name)) res.setHeader(name, value);
        }
        res.setHeader("Access-Control-Allow-Origin", "*");
        res.end(Buffer.from(await response.arrayBuffer()));
      } catch { res.writeHead(502).end(); }
    });
    const authUrl = `https://127.0.0.1:${await listen(gateway)}`;
    cleanup.push(() => close(gateway));
    process.env.SUPABASE_URL = authUrl;
    process.env.SUPABASE_PUBLISHABLE_KEY = config.ANON_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = config.SERVICE_ROLE_KEY;
    process.env.PRIVATE_OBJECT_DIR = "/bedah-private";
    process.env.OPENROUTER_API_KEY = "disposable-provider-not-a-real-key";

    // Delay after the provider actually receives a request, never with sleeps.
    let gate, started = false, calls = 0;
    const provider = createServer(async (req, res) => {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const input = JSON.parse(Buffer.concat(chunks).toString());
      assert.equal(input.model, "anthropic/claude-sonnet-4.5");
      assert.equal(input.provider.allow_fallbacks, false);
      calls++;
      if (gate) { started = true; await gate.promise; }
      const payload = JSON.parse(input.messages[1].content);
      const isAnalysis = payload.pertanyaan.includes("JSON");
      const content = isAnalysis ? JSON.stringify({
        category: "Kontrak", summary: "BEDAH-PRIVATE-SUMMARY: Masa pelaksanaan 90 hari.",
        checklist: [{ item: "Masa pelaksanaan", status: "ada", evidence: "Masa pelaksanaan 90 hari." }],
        risks: [], regulations: [],
      }) : "BEDAH-PRIVATE-ANSWER: Masa pelaksanaan 90 hari. [1]";
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ model: input.model, choices: [{ message: { content } }] }));
    });
    const providerUrl = `http://127.0.0.1:${await listen(provider)}`;
    cleanup.push(async () => { gate?.resolve(); await close(provider); });
    const privateRoot = path.join(directory, "private");
    await mkdir(privateRoot, { recursive: true, mode: 0o700 });
    const diskFile = object => {
      assert(object.startsWith("bedah-private/ruang-simpan/") && !object.includes(".."));
      const file = path.join(privateRoot, object);
      return {
        async save(bytes) { await mkdir(path.dirname(file), { recursive: true, mode: 0o700 }); await writeFile(file, bytes, { mode: 0o600 }); },
        async exists() { return [await access(file).then(() => true, () => false)]; },
        async delete() { await rm(file, { force: true }); },
        createReadStream() { return createReadStream(file); },
      };
    };
    // Globals exist only in this throwaway server process.
    globalThis.__bedahDiskFile = diskFile;
    globalThis.__bedahPool = pool;
    const bundle = await build({
      stdin: { contents: 'export { vaultRouter } from "./src/routes/vault";', resolveDir: new URL("../..", import.meta.url).pathname },
      bundle: true, platform: "node", format: "cjs", write: false,
      packages: "external",
      plugins: [{
        name: "bedah-local-io-only",
        setup(b) {
          b.onResolve({ filter: /^@workspace\/db$/ }, () => ({ path: "db", namespace: "bedah" }));
          b.onResolve({ filter: /^@google-cloud\/storage$/ }, () => ({ path: "storage", namespace: "bedah" }));
          b.onLoad({ filter: /.*/, namespace: "bedah" }, ({ path: name }) => ({
            contents: name === "db" ? "export const pool=globalThis.__bedahPool;"
              : "export class Storage { bucket(name){return {file: key=>globalThis.__bedahDiskFile(name+'/'+key)}} }",
          }));
          b.onLoad({ filter: /\/vault-ai\.ts$/ }, async ({ path: file }) => ({
            contents: (await readFile(file, "utf8")).replace('"https://openrouter.ai/api/v1/chat/completions"', JSON.stringify(providerUrl)),
            loader: "ts",
          }));
          // Workspace schemas must still bundle, rather than resolve via CJS.
          b.onResolve({ filter: /^@workspace\/api-zod$/ }, () => ({
            path: new URL("../../../../lib/api-zod/src/index.ts", import.meta.url).pathname,
          }));
        },
      }],
    });
    const mod = { exports: {} };
    new Function("require", "module", "exports", bundle.outputFiles[0].text)(require, mod, mod.exports);
    const app = express();
    // Vault's production error handler calls req.log. Use the same middleware,
    // without request logging (test bearer tokens must never reach artifacts).
    app.use(require("pino-http")({ logger: require("pino")({ level: "silent" }) }));
    app.use(express.json());
    app.use("/api/ruang-simpan", mod.exports.vaultRouter);
    // Controls are reachable only on this loopback-only disposable test server.
    app.post("/__test/gate", (_req, res) => {
      assert(!gate);
      let resolve;
      gate = { promise: new Promise(r => { resolve = r; }), resolve: () => resolve() };
      started = false; res.sendStatus(204);
    });
    app.get("/__test/gate", (_req, res) => res.json({ started, calls }));
    app.post("/__test/release", (_req, res) => { gate?.resolve(); gate = undefined; res.sendStatus(204); });
    app.use((error, _req, res, _next) => res.status(error.status || (error.issues ? 400 : 500)).json({ error: error.message }));
    const api = app.listen(0, "127.0.0.1");
    await once(api, "listening");
    cleanup.push(() => close(api));
    const apiUrl = `http://127.0.0.1:${api.address().port}`;
    const accounts = {};
    for (const role of ["owner", "stranger", "admin"]) {
      const email = `bedah-${role}-${randomUUID()}@example.test`;
      const password = `Bedah-${randomUUID()}!`;
      const created = await fetch(new URL("/auth/v1/admin/users", upstream), {
        method: "POST", headers: { apikey: config.SERVICE_ROLE_KEY, Authorization: `Bearer ${config.SERVICE_ROLE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, email_confirm: true, user_metadata: { full_name: `Bedah disposable ${role}` } }),
      });
      assert.equal(created.status, 200, "Disposable Auth account creation failed");
      const user = await created.json();
      users.push(user.id);
      if (role === "admin") {
        const granted = await fetch(new URL("/rest/v1/user_roles", upstream), {
          method: "POST", headers: { apikey: config.SERVICE_ROLE_KEY, Authorization: `Bearer ${config.SERVICE_ROLE_KEY}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates" },
          body: JSON.stringify({ user_id: user.id, role: "admin" }),
        });
        assert(granted.ok, "Disposable admin role grant failed");
      }
      accounts[role] = { email, password, id: user.id };
    }
    return { authUrl, apiUrl, accounts, anonKey: config.ANON_KEY, stop, pool, privateRoot };
  } catch (error) {
    await stop();
    throw error;
  }
}
