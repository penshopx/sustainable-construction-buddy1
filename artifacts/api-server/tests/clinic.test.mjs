import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { build } = require("esbuild");
const bundle = await build({
  stdin: { contents: 'export {createClinicRouter} from "./src/lib/clinic-router";',
    resolveDir: new URL("..", import.meta.url).pathname, loader: "ts" },
  bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
});
const mod = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(require, mod, mod.exports);
const express = require("express");
const input = { topicId: "sbu", kind: "consultation", subject: "Kesiapan dokumen", description: "Mohon tinjau ringkasan kasus ini." };

async function harness(t) {
  const rows = [];
  const history = [];
  let allowed = true;
  let roleUnavailable = false;
  const queries = [];
  const query = async (sql, values = []) => {
    queries.push({ sql, values });
    if (/^(BEGIN|COMMIT|ROLLBACK|SELECT pg_advisory)/.test(sql)) return { rows: [] };
    if (sql.includes("FOR UPDATE")) return { rows: rows.filter(r => r.id === values[0]) };
    if (sql.includes("ON CONFLICT (case_id,revision)")) return { rows: [] };
    if (sql.startsWith("INSERT INTO clinic_case_history")) {
      history.push({ id: randomUUID(), caseId: values[0], revision: values[1], status: values[2], operatorReply: values[3], actorId: values[4], createdAt: new Date().toISOString() });
      return { rows: [] };
    }
    if (sql.includes("FROM clinic_case_history")) return { rows: history.filter(r => r.caseId === values[0]) };
    if (sql.startsWith("SELECT owner_id")) return { rows: rows.filter(r => r.id === values[0]).map(r => ({ ...r, owner_id: r.ownerId })) };
    if (sql.startsWith("SELECT id FROM")) return { rows: rows.filter(r => r.id === values[0]) };
    if (sql.startsWith("SELECT count")) return { rows: [{ count: rows.filter(r => r.ownerId === values[0]).length }] };
    if (sql.startsWith("INSERT")) {
      const row = { id: randomUUID(), ownerId: values[0], topicId: values[1], kind: values[2],
        subject: values[3], description: values[4], rating: values[5], status: "open", operatorReply: "",
        revision: 0, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
      rows.push(row);
      return { rows: [row] };
    }
    if (sql.startsWith("UPDATE")) {
      const row = rows.find(r => r.id === values[0] && r.revision === values[3]);
      if (row) Object.assign(row, { status: values[1], operatorReply: values[2], revision: row.revision + 1 });
      return { rows: row ? [row] : [] };
    }
    return { rows: sql.includes("WHERE owner_id=$1") ? rows.filter(r => r.ownerId === values[0]) : rows };
  };
  const app = express();
  app.use(express.json());
  app.use("/clinic", mod.exports.createClinicRouter({
    pool: { query, connect: async () => ({ query, release() {} }) },
    member: async auth => {
      if (!["Bearer member-a", "Bearer member-b", "Bearer admin", "Bearer admin-two"].includes(auth)) throw Object.assign(new Error("invalid"), { status: 401 });
      return auth.slice(7);
    },
    admin: async owner => { if (roleUnavailable) throw new Error("private provider detail"); return owner.startsWith("admin") && allowed; },
  }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const request = (path, { actor = "member-a", method = "GET", data } = {}) =>
    fetch(`http://127.0.0.1:${server.address().port}/clinic${path}`, {
      method, headers: { ...(actor ? { Authorization: `Bearer ${actor}` } : {}), "Content-Type": "application/json" },
      ...(data ? { body: JSON.stringify(data) } : {}),
    });
  return { rows, history, queries, request, revoke: () => { allowed = false; }, failRole: () => { roleUnavailable = true; } };
}

test("anonymous requests are denied before storage access", async t => {
  const h = await harness(t);
  for (const [path, method] of [["/cases", "GET"], ["/cases", "POST"], ["/operator/cases", "GET"]]) {
    const r = await h.request(path, { actor: "", method, data: method === "POST" ? input : undefined });
    assert.equal(r.status, 401);
    assert.equal(r.headers.get("cache-control"), "no-store");
  }
  assert.equal(h.queries.length, 0);
});
test("owner derives from verified identity, never a supplied ownerId; other members cannot read it", async t => {
  const h = await harness(t);
  const created = await h.request("/cases", { method: "POST", data: { ...input, ownerId: "member-b" } });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).ownerId, "member-a");
  assert.equal((await (await h.request("/cases")).json()).length, 1);
  assert.deepEqual(await (await h.request("/cases", { actor: "member-b" })).json(), []);
});
test("member cannot read the operator queue or answer another member's case", async t => {
  const h = await harness(t);
  const row = await (await h.request("/cases", { method: "POST", data: input })).json();
  assert.equal((await h.request("/operator/cases", { actor: "member-b" })).status, 403);
  assert.equal((await h.request(`/operator/cases/${row.id}`, { actor: "member-b", method: "PATCH", data: { status: "answered", operatorReply: "Tidak boleh." } })).status, 403);
  assert.equal(h.rows[0].operatorReply, "");
});
test("admin answer persists and is returned to its owner, never another member", async t => {
  const h = await harness(t);
  const row = await (await h.request("/cases", { method: "POST", data: input })).json();
  const response = await h.request(`/operator/cases/${row.id}`, { actor: "admin", method: "PATCH", data: { status: "answered", operatorReply: "Siapkan daftar dokumen.", expectedRevision: 0 } });
  assert.equal(response.status, 200);
  const own = await (await h.request("/cases")).json();
  assert.equal(own[0].operatorReply, "Siapkan daftar dokumen.");
  assert.equal(own[0].status, "answered");
  assert.deepEqual(await (await h.request("/cases", { actor: "member-b" })).json(), []);
});
test("revoking admin role closes access on the next request, including updates", async t => {
  const h = await harness(t);
  const row = await (await h.request("/cases", { method: "POST", data: input })).json();
  assert.equal((await h.request("/operator/cases", { actor: "admin" })).status, 200);
  h.revoke();
  assert.equal((await h.request("/operator/cases", { actor: "admin" })).status, 403);
  assert.equal((await h.request(`/operator/cases/${row.id}`, { actor: "admin", method: "PATCH", data: { status: "closed", operatorReply: "" } })).status, 403);
  assert.equal(h.rows[0].status, "open");
});
test("role check failure fails closed and hides provider details", async t => {
  const h = await harness(t); h.failRole();
  const r = await h.request("/operator/cases", { actor: "admin" });
  assert.equal(r.status, 503);
  assert.doesNotMatch(JSON.stringify(await r.json()), /private provider detail/);
  assert.equal(h.queries.length, 0);
});
test("invalid topics, whitespace-only submissions and invalid ratings cannot create requests", async t => {
  const h = await harness(t);
  for (const data of [{ ...input, topicId: "fake-topic" }, { ...input, subject: "   " }, { ...input, description: "          " }, { ...input, rating: 6 }]) {
    assert.equal((await h.request("/cases", { method: "POST", data })).status, 400);
  }
  assert.equal(h.rows.length, 0);
});
test("answered requires real reply, malformed IDs are rejected and missing cases return404", async t => {
  const h = await harness(t);
  for (const [id, reply, status] of [[randomUUID(), "", 400], ["not-uuid", "Jawaban.", 400], [randomUUID(), "Jawaban.", 404]]) {
    assert.equal((await h.request(`/operator/cases/${id}`, { actor: "admin", method: "PATCH", data: { status: "answered", operatorReply: reply, expectedRevision: 0 } })).status, status);
  }
});
test("feedback and rating are persisted only after successful creation", async t => {
  const h = await harness(t);
  const r = await h.request("/cases", { method: "POST", data: { ...input, kind: "feedback", rating: 4 } });
  assert.equal(r.status, 201);
  assert.equal((await r.json()).rating, 4);
  assert.equal(h.rows[0].kind, "feedback");
});
test("per-member submission limit is serialized and rollback leaves existing requests intact", async t => {
  const h = await harness(t);
  for (let i = 0; i < 20; i++) h.rows.push({ ownerId: "member-a" });
  const r = await h.request("/cases", { method: "POST", data: input });
  assert.equal(r.status, 429);
  assert.equal(h.rows.length, 20);
  assert.ok(h.queries.some(q => q.sql.startsWith("SELECT pg_advisory")));
  assert.ok(h.queries.some(q => q.sql === "ROLLBACK"));
});

test("two operators cannot overwrite the same revision; owner reads every snapshot with verified actors only", async t => {
  const h = await harness(t);
  const row = await (await h.request("/cases", { method: "POST", data: input })).json();
  const path = `/operator/cases/${row.id}`;
  const first = await (await h.request("/operator/cases", { actor: "admin" })).json();
  const second = await (await h.request("/operator/cases", { actor: "admin-two" })).json();
  const write = (actor, revision, reply, status = "answered") => h.request(path, {
    actor, method: "PATCH", data: { expectedRevision: revision, operatorReply: reply, status,
      actorId: "forged", ownerId: "forged", context: "SECRET_VAULT_CONTEXT", documents: ["private.pdf"] },
  });
  assert.equal((await write("admin", first[0].revision, "Balasan pertama")).status, 200);
  assert.equal((await write("admin-two", second[0].revision, "Draf kedua")).status, 409);
  assert.equal(h.rows[0].operatorReply, "Balasan pertama");
  assert.equal(h.history.length, 2);
  const latest = await (await h.request(`/cases/${row.id}/history`, { actor: "admin-two" })).json();
  assert.equal(latest.at(-1).revision, 1);
  assert.equal((await write("admin-two", 1, "Draf kedua")).status, 200);
  assert.equal((await write("admin-two", 2, "Draf kedua", "closed")).status, 200);
  const ownerHistory = await (await h.request(`/cases/${row.id}/history`)).json();
  assert.deepEqual(ownerHistory.map(e => e.revision), [0, 1, 2, 3]);
  assert.deepEqual(ownerHistory.map(e => e.actorId), ["member-a", "admin", "admin-two", "admin-two"]);
  assert.deepEqual(ownerHistory.map(e => e.status), ["open", "answered", "answered", "closed"]);
  assert.doesNotMatch(JSON.stringify(ownerHistory), /SECRET_VAULT_CONTEXT|private.pdf|forged/);
  assert.equal((await h.request(`/cases/${row.id}/history`, { actor: "member-b" })).status, 404);
  assert.equal((await h.request(`/cases/${row.id}/history`, { actor: "" })).status, 401);
  h.revoke();
  assert.equal((await write("admin-two", 3, "Ditolak")).status, 403);
  assert.equal((await h.request(`/cases/${row.id}/history`, { actor: "admin" })).status, 404);
  assert.equal(h.history.length, 4);
});

test("updates require an integer expected revision and cannot use a client actor identity", async t => {
  const h = await harness(t);
  const row = await (await h.request("/cases", { method: "POST", data: input })).json();
  for (const expectedRevision of [undefined, -1, 0.5, 2147483647]) {
    assert.equal((await h.request(`/operator/cases/${row.id}`, { actor: "admin", method: "PATCH",
      data: { status: "closed", operatorReply: "", expectedRevision } })).status, 400);
  }
  assert.equal(h.rows[0].revision, 0);
  assert.equal(h.history.length, 1);
});
