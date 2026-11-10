import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { build } from "esbuild";
import express from "express";

const memory = new Map(), blobs = new Map(), calls = [];
let networkHandler, pending = Promise.resolve();
const root = fileURLToPath(new URL("..", import.meta.url));
const lookup = async host => host === "private.example" ? [{ address: "10.0.0.1", family: 4 }] :
  host === "mixed.example" ? [{ address: "8.8.8.8", family: 4 }, { address: "::1", family: 6 }] :
  [{ address: "8.8.8.8", family: 4 }];
const request = (url, options, callback) => {
  calls.push(url.href);
  assert.equal(options.agent, false);
  assert.equal(options.family, 4);
  assert.equal(options.headers.Authorization, undefined);
  assert.equal(options.headers.Cookie, undefined);
  // Prove the transport receives a pinned public address, not another DNS lookup.
  options.lookup(url.hostname, {}, (err, ip, family) => {
    assert.equal(err, null); assert.equal(ip, "8.8.8.8"); assert.equal(family, 4);
  });
  const req = new EventEmitter();
  req.end = () => queueMicrotask(async () => {
    if (options.signal.aborted) { req.emit("error", new Error("aborted")); return; }
    const fixture = await networkHandler(url);
    if (fixture.hang) {
      options.signal.addEventListener("abort", () => req.emit("error", new Error("aborted")), { once: true });
      return;
    }
    const res = new PassThrough();
    res.statusCode = fixture.status ?? 200;
    res.headers = fixture.headers ?? { "content-type": "text/plain" };
    callback(res);
    if (res.destroyed) return;
    const chunks = fixture.chunks ?? [Buffer.from(fixture.body ?? "Dokumen publik sintetis")];
    for (const chunk of chunks) { if (res.destroyed) return; res.write(chunk); }
    res.end();
  });
  return req;
};
globalThis.__vaultLinkTest = {
  memory, blobs, lookup, request,
  async connect() {
    let unlock;
    return {
      async query(sql, args) {
        if (sql === "BEGIN") {
          const previous = pending;
          pending = new Promise(resolve => { unlock = resolve; });
          await previous;
        }
        if (sql.startsWith("INSERT") && !memory.has(args[0])) memory.set(args[0], JSON.parse(args[1]));
        if (sql.startsWith("SELECT state")) return { rows: [{ state: structuredClone(memory.get(args[0])) }] };
        if (sql.startsWith("UPDATE")) memory.set(args[0], JSON.parse(args[1]));
        if (sql === "COMMIT" || sql === "ROLLBACK") { unlock?.(); unlock = undefined; }
        return { rows: [] };
      },
      release() { unlock?.(); },
    };
  },
};
const bundle = await build({
  stdin: { contents: `
    export { vaultRouter } from "./src/routes/vault";
    export { publicAddress, linkUrl, fetchPublicFile, LINK_MAX_BYTES } from "./src/lib/vault-link";
    export { importFilename } from "../ruang-simpan/src/lib/import-filename";
    export { initialWorkspace, QUOTA } from "./src/lib/vault-store";
  `, resolveDir: root, loader: "ts" },
  bundle: true, platform: "node", format: "cjs", write: false,
  plugins: [{
    name: "offline-vault-link-boundaries",
    setup(b) {
      for (const [name, contents] of [
        ["@workspace/db", "export const pool = { connect: () => globalThis.__vaultLinkTest.connect() };"],
        ["node:dns/promises", "export const lookup = (...args) => globalThis.__vaultLinkTest.lookup(...args);"],
        ["node:https", "export const request = (...args) => globalThis.__vaultLinkTest.request(...args);"],
      ]) {
        b.onResolve({ filter: new RegExp("^" + name + "$") }, () => ({ path: name, namespace: "fake" }));
        b.onLoad({ filter: new RegExp("^" + name + "$"), namespace: "fake" }, () => ({ contents }));
      }
      b.onLoad({ filter: /vault-pub-auth\.ts$/ }, () => ({ contents: `
        export function vaultPubMiddleware(req, res, next) {
          const token = req.get("authorization");
          if (!["Bearer A", "Bearer B"].includes(token)) { res.sendStatus(401); return; }
          res.locals.vaultOwner = token.slice(7); next();
        }
        export const pubAuthorization = req => req.get("authorization");
        export const openPubSession = (_req, res) => res.sendStatus(401);
        export const closePubSession = (_req, res) => res.sendStatus(204);
      ` }));
      b.onLoad({ filter: /vault-company-names\.ts$/ }, () => ({ contents: "export async function visibleCompanyNames() { return {}; }" }));
      b.onLoad({ filter: /logger\.ts$/ }, () => ({ contents: "export const logger = { warn() {} };" }));
      b.onLoad({ filter: /vault-files\.ts$/ }, async () => {
        const original = await readFile(`${root}/src/lib/vault-files.ts`, "utf8");
        return { contents: `
          import { randomUUID } from "node:crypto";
          import { Readable } from "node:stream";
          import { fail } from "./vault-errors";
          ${original.slice(original.indexOf("const formats:"), original.indexOf("let extractionCount"))}
          export const extractText = async bytes => bytes.toString("utf8").slice(0, 100000);
          export const reserveExtractionWorker = () => () => {};
          export const runExtractionWorker = async () => "";
          export const objectPath = owner => "/private/" + owner + "/" + randomUUID();
          export function privateFile(path) {
            const blobs = globalThis.__vaultLinkTest.blobs;
            return {
              async save(bytes) { blobs.set(path, bytes); },
              async delete() { blobs.delete(path); },
              async exists() { return [blobs.has(path)]; },
              createReadStream() { return Readable.from([blobs.get(path)]); },
            };
          }
        `, loader: "ts", resolveDir: `${root}/src/lib` };
      });
    },
  }],
});
const compiled = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(createRequire(import.meta.url), compiled, compiled.exports);
const { vaultRouter, publicAddress, linkUrl, fetchPublicFile, LINK_MAX_BYTES, initialWorkspace, QUOTA } = compiled.exports;
const { importFilename } = compiled.exports;
const warnings = [];
const app = express();
app.use(express.json());
app.use((req, _res, next) => { req.log = { warn: (...args) => warnings.push(args) }; next(); });
app.use("/api/ruang-simpan", vaultRouter);
const server = app.listen(0, "127.0.0.1");
await new Promise(resolve => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}/api/ruang-simpan`;
test.after(() => { server.close(); delete globalThis.__vaultLinkTest; });
const api = (path, body, who = "A", method = body ? "POST" : "GET") => fetch(base + path, {
  method, headers: { Authorization: `Bearer ${who}`, "Content-Type": "application/json" },
  ...(body ? { body: JSON.stringify(body) } : {}),
});
const input = { url: "https://public.example/file?token=synthetic-secret", name: "dokumen.txt", folderId: "default-0" };
test.beforeEach(() => {
  memory.clear(); blobs.clear(); calls.length = 0; warnings.length = 0;
  memory.set("A", initialWorkspace()); memory.set("B", initialWorkspace());
  networkHandler = () => ({});
});

test("only public HTTPS addresses; normalized IPs and metadata services are rejected", () => {
  for (const ip of ["127.0.0.1", "10.0.0.1", "169.254.169.254", "168.63.129.16", "100.100.100.200",
    "0.0.0.0", "172.31.1.1", "192.168.1.1", "224.0.0.1", "::1", "::", "fc00::1",
    "fe80::1", "::ffff:127.0.0.1", "::ffff:8.8.8.8", "2002:7f00:1::", "2001:db8::1", "3fff::1"])
    assert.equal(publicAddress(ip), false, ip);
  for (const ip of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"]) assert.equal(publicAddress(ip), true, ip);
  for (const url of ["http://public.example/file", "https://localhost/a", "https://a.local/a",
    "https://metadata.google.internal/a", "https://127.1/a", "https://2130706433/a",
    "https://0x7f000001/a", "https://[::1]/", "https://user:pass@public.example/a", "https://public.example:444/a"])
    assert.throws(() => linkUrl(url), e => e.status === 400);
});

test("filename suggestion uses only the decoded last pathname segment, never signed query or fragment", () => {
  const cases = [
    ["https://public.example/private/folder/Laporan%20Proyek.PDF?token=synthetic-secret#secret", "Laporan Proyek.PDF"],
    ["https://public.example/folder/ringkasan.csv?filename=secret.txt", "ringkasan.csv"],
    ["https://public.example/folder/catatan%20%C3%A9.md", "catatan é.md"],
    ["https://public.example/download?filename=secret.pdf&signature=secret", ""],
    ["https://public.example/folder/?token=secret", ""],
    ["https://public.example/no-extension", ""],
    ["https://public.example/archive.zip", ""],
    ["https://public.example/%2Ehidden.txt", ""],
    ["https://public.example/dir%2Fsecret.txt", ""],
    ["https://public.example/dir%5Csecret.txt", ""],
    ["https://public.example/file%3Ftoken%3Dsecret.txt", ""],
    ["https://public.example/file%23secret.txt", ""],
    ["https://public.example/file%252Fsecret.txt", ""],
    ["https://public.example/file%00.txt", ""],
    ["https://public.example/file%0D%0A.txt", ""],
    ["https://public.example/file%C2%85.txt", ""],
    ["https://public.example/file%E2%80%AE.txt", ""],
    ["https://public.example/file%ZZ.txt", ""],
    ["https://public.example/file\n.txt", ""],
    ["https://public.example/" + "x".repeat(197) + ".txt", ""],
    ["https://user:secret@public.example/file.txt", ""],
    ["http://public.example/file.txt", ""],
    ["not a URL", ""],
  ];
  for (const [url, name] of cases) assert.equal(importFilename(url), name);
});

test("suggested or edited filenames use upload validation and never persist source metadata", async () => {
  const url = "https://public.example/directory/Laporan%20Proyek.txt?token=synthetic-secret#private";
  const name = importFilename(url);
  networkHandler = () => ({ headers: {
    "content-type": "text/plain",
    // Untrusted remote names cannot override the user's confirmed name.
    "content-disposition": 'attachment; filename="https://secret.example/?token=header-secret.txt"',
  } });
  const suggested = await api("/documents/import", { ...input, url, name });
  assert.equal(suggested.status, 200);
  assert.equal((await suggested.json()).name, "Laporan Proyek.txt");
  const edited = await api("/documents/import", { ...input, url, name: "  Nama pilihan saya.txt  " });
  assert.equal(edited.status, 200);
  assert.equal((await edited.json()).name, "Nama pilihan saya.txt");
  const state = JSON.stringify([...memory]);
  for (const secret of ["public.example", "directory", "synthetic-secret", "private", "secret.example", "header-secret"])
    assert.ok(!JSON.stringify(memory.get("A").activities).includes(secret));
  assert.ok(!state.includes("synthetic-secret"));
  assert.ok(!state.includes("header-secret"));
  networkHandler = () => ({ body: "not a PNG" });
  const mismatch = await api("/documents/import", { ...input, name: "gambar.png" });
  assert.equal(mismatch.status, 400);
  assert.equal(memory.get("A").documents.length, 2);
});

test("edited unsafe filenames are rejected before fetching, without metadata or activity leaks", async () => {
  for (const name of [
    "../dokumen.txt", "folder/dokumen.txt", "folder\\dokumen.txt",
    "https://public.example/file?token=synthetic-secret.txt",
    "file?token=synthetic-secret.txt", "token=synthetic-secret.txt",
    "file%3Ftoken%3Dsynthetic-secret.txt", "file#synthetic-secret.txt",
    "file\u0000.txt", "file\r\n.txt", "file\u0085.txt", "file\u202e.txt",
  ]) {
    const response = await api("/documents/import", { ...input, name });
    assert.equal(response.status, 400);
    assert.ok(!(await response.text()).includes("synthetic-secret"));
  }
  assert.equal(calls.length, 0);
  assert.equal(memory.get("A").documents.length, 0);
  assert.equal(blobs.size, 0);
  assert.ok(!JSON.stringify([...memory]).includes("synthetic-secret"));
  assert.ok(!JSON.stringify(warnings).includes("synthetic-secret"));
});

test("public file persists through real upload flow; URL absent and other owners cannot access or mutate it", async () => {
  const response = await api("/documents/import", { ...input, owner: "B" });
  assert.equal(response.status, 200);
  const doc = await response.json();
  assert.equal(doc.name, input.name); assert.equal(doc.text, "Dokumen publik sintetis");
  assert.equal(doc.objectPath, undefined);
  const saved = memory.get("A").documents[0];
  assert.ok(saved.objectPath.startsWith("/private/A/")); assert.ok(blobs.has(saved.objectPath));
  assert.equal(memory.get("B").documents.length, 0);
  assert.ok(!JSON.stringify([...memory]).includes("synthetic-secret"));
  assert.equal((await api(`/documents/${doc.id}/download`, undefined, "B")).status, 404);
  assert.equal((await api(`/documents/${doc.id}`, { starred: true }, "B", "PATCH")).status, 404);
  assert.equal((await api(`/documents/${doc.id}`, undefined, "B", "DELETE")).status, 404);
  assert.equal(await (await api(`/documents/${doc.id}/download`)).text(), "Dokumen publik sintetis");
  assert.equal((await (await api("/workspace")).json()).usedBytes, saved.size);
  memory.get("A").folders.push({ id: "A-only", name: "Privat", count: 0 });
  calls.length = 0;
  assert.equal((await api("/documents/import", { ...input, folderId: "A-only" }, "B")).status, 400);
  assert.equal(calls.length, 0);
  assert.equal((await api("/documents/import", input, "anonymous")).status, 401);
});

test("redirects recheck DNS including mixed answers; private destinations are never requested", async () => {
  for (const target of ["https://127.0.0.1/file", "https://169.254.169.254/latest",
    "https://private.example/file", "https://mixed.example/file", "http://public.example/file"]) {
    calls.length = 0;
    networkHandler = () => ({ status: 302, headers: { location: target } });
    assert.equal((await api("/documents/import", input)).status, 400, target);
    assert.equal(calls.length, 1);
    assert.equal(blobs.size, 0);
  }
  networkHandler = url => url.pathname === "/file" ? { status: 307, headers: { location: "/final" } } : {};
  assert.equal((await api("/documents/import", input)).status, 200);
  networkHandler = () => ({ status: 302, headers: { location: "/loop" } });
  calls.length = 0;
  assert.equal((await api("/documents/import", input)).status, 400);
  assert.equal(calls.length, 4);
});

test("oversize headers, streaming overflow, login, HTML, compressed and invalid files save nothing", async () => {
  for (const [fixture, status] of [
    [{ headers: { "content-length": String(LINK_MAX_BYTES + 1) } }, 413],
    [{ chunks: [Buffer.alloc(LINK_MAX_BYTES), Buffer.from("x")] }, 413],
    [{ status: 401 }, 400], [{ status: 403 }, 400],
    [{ headers: { "content-type": "text/html" } }, 400],
    [{ body: "<!-- login --> <html><form>login</form></html>" }, 400],
    [{ headers: { "content-encoding": "gzip" } }, 400],
    [{ body: "" }, 400], [{ status: 404 }, 502],
  ]) {
    networkHandler = () => fixture;
    assert.equal((await api("/documents/import", input)).status, status);
    assert.equal(blobs.size, 0); assert.equal(memory.get("A").documents.length, 0);
  }
  networkHandler = () => ({ body: "not a pdf" });
  assert.equal((await api("/documents/import", { ...input, name: "bad.pdf" })).status, 400);
  assert.equal(blobs.size, 0);
  assert.ok(!JSON.stringify(warnings).includes("synthetic-secret"));
});

test("atomic quota check prevents concurrent upload and import exceeding the active workspace quota", async () => {
  memory.get("A").documents.push({
    id: "existing-fixture", name: "existing.txt", size: QUOTA - 12 * 1024 * 1024,
    text: "", status: "stored", folderId: "default-0", type: "TXT",
    objectPath: "fixture-only", createdAt: new Date().toISOString(), starred: false,
  });
  networkHandler = () => ({ body: "x".repeat(8 * 1024 * 1024) });
  const [imported, uploaded] = await Promise.all([
    api("/documents/import", input),
    fetch(base + "/documents?name=upload.txt&folderId=default-0", {
      method: "POST", headers: { Authorization: "Bearer A", "Content-Type": "application/octet-stream" },
      body: Buffer.alloc(8 * 1024 * 1024, "y"),
    }),
  ]);
  assert.deepEqual([imported.status, uploaded.status].sort(), [200, 413]);
  assert.equal(memory.get("A").documents.length, 2); assert.equal(blobs.size, 1);
});

test("deadline includes DNS and network stalls, and raw upstream errors never expose tokens", async () => {
  networkHandler = () => ({ hang: true });
  await assert.rejects(fetchPublicFile(input.url, { lookup, request }, 20), e => e.status === 504);
  await assert.rejects(fetchPublicFile(input.url, { lookup: () => new Promise(() => {}), request }, 20), e => e.status === 504);
  await assert.rejects(fetchPublicFile(input.url, {
    lookup: async () => { throw new Error(input.url); }, request,
  }), e => e.status === 502 && !e.message.includes("synthetic-secret"));
});

test("one pending import per owner; a failed import releases its slot for retry", async () => {
  let release, entered;
  const started = new Promise(resolve => { entered = resolve; });
  networkHandler = () => {
    entered();
    return new Promise(resolve => { release = resolve; });
  };
  const first = api("/documents/import", input);
  await started;
  assert.equal((await api("/documents/import", input)).status, 429);
  release({ status: 403 });
  assert.equal((await first).status, 400);
  networkHandler = () => ({});
  assert.equal((await api("/documents/import", input)).status, 200);
});

test("opt-in: real Node HTTPS transport against isolated TLS fixtures", {
  skip: process.env.VAULT_LINK_REAL_TLS !== "1" && "Set VAULT_LINK_REAL_TLS=1 (requires OpenSSL; IPv6 checked when available)",
  timeout: 45_000,
}, async t => {
  const { stdout } = await promisify(execFile)(process.execPath, [
    "--test", fileURLToPath(new URL("./helpers/vault-link-tls.mjs", import.meta.url)),
    ...(process.env.VAULT_LINK_TLS_REQUIRE_IPV6 === "1" ? ["--require-ipv6"] : []),
  ], {
    // No application credentials, NODE_OPTIONS, custom CA, or TLS-disable flags.
    env: { PATH: process.env.PATH },
    timeout: 40_000,
    maxBuffer: 1024 * 1024,
  });
  t.diagnostic(stdout);
});
