import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";

const require = createRequire(import.meta.url);
const dbRequire = createRequire(new URL("../../../lib/db/package.json", import.meta.url));
const { Pool } = dbRequire("pg");
const { build } = require("esbuild");
const built = await build({
  stdin: { contents: 'export {createClinicRouter} from "./src/lib/clinic-router";',
    resolveDir: new URL("..", import.meta.url).pathname, loader: "ts" },
  bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
});
const mod = { exports: {} };
new Function("require", "module", "exports", built.outputFiles[0].text)(require, mod, mod.exports);

test("PostgreSQL: migration snapshots legacy replies, concurrent CAS has one winner, failed history rolls back", {
  skip: !process.env.DATABASE_URL,
}, async t => {
  const schema = `clinic_test_${randomUUID().replaceAll("-", "")}`;
  const control = new Pool({ connectionString: process.env.DATABASE_URL });
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, options: `-c search_path=${schema},public` });
  t.after(async () => {
    await pool.end();
    await control.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
    await control.end();
  });
  await control.query(`CREATE SCHEMA ${schema}`);
  await pool.query(await readFile(new URL("../../../lib/db/migrations/clinic-cases.sql", import.meta.url), "utf8"));
  const legacy = await pool.query(`INSERT INTO clinic_cases(owner_id,topic_id,kind,subject,description,status,operator_reply)
    VALUES('owner','sbu','consultation','Legacy','Legacy description','answered','Legacy reply') RETURNING id`);
  const migration = await readFile(new URL("../../../lib/db/migrations/clinic-case-history.sql", import.meta.url), "utf8");
  await pool.query(migration);
  await pool.query(migration);
  const baseline = await pool.query("SELECT * FROM clinic_case_history");
  assert.equal(baseline.rowCount, 1);
  assert.equal(baseline.rows[0].operator_reply, "Legacy reply");
  assert.equal(baseline.rows[0].actor_id, null);
  const express = require("express");
  const app = express();
  app.use(express.json());
  let allowed = true;
  app.use("/clinic", mod.exports.createClinicRouter({
    pool,
    member: async auth => {
      if (!["Bearer owner", "Bearer admin-a", "Bearer admin-b", "Bearer stranger"].includes(auth)) {
        throw Object.assign(new Error("unauthorized"), { status: 401 });
      }
      return auth.slice(7);
    },
    admin: async actor => allowed && actor.startsWith("admin-"),
  }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => { server.closeAllConnections(); server.close(); });
  const request = (path, actor, data) => fetch(`http://127.0.0.1:${server.address().port}/clinic${path}`, {
    method: data ? "PATCH" : "GET",
    headers: { Authorization: `Bearer ${actor}`, "Content-Type": "application/json" },
    ...(data ? { body: JSON.stringify(data) } : {}),
  });
  const id = legacy.rows[0].id;
  const path = `/operator/cases/${id}`;
  // Schema-only rollouts do not copy migration data into the target database.
  await pool.query("DELETE FROM clinic_case_history");
  const virtualBaseline = await (await request(`/cases/${id}/history`, "owner")).json();
  assert.equal(virtualBaseline.length, 1);
  assert.equal(virtualBaseline[0].operatorReply, "Legacy reply");
  assert.equal(virtualBaseline[0].actorId, null);
  assert.equal((await pool.query("SELECT * FROM clinic_case_history")).rowCount, 0);
  const versions = await Promise.all(["admin-a", "admin-b"].map(async actor =>
    (await (await request("/operator/cases", actor)).json())[0].revision));
  assert.deepEqual(versions, [0, 0]);
  const responses = await Promise.all(["admin-a", "admin-b"].map((actor, index) =>
    request(path, actor, { status: "answered", operatorReply: actor, expectedRevision: versions[index] })));
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  const stored = await pool.query("SELECT * FROM clinic_cases WHERE id=$1", [id]);
  assert.equal(stored.rows[0].revision, 1);
  const snapshots = await (await request(`/cases/${id}/history`, "owner")).json();
  assert.equal(snapshots.length, 2);
  assert.equal(snapshots[1].actorId, stored.rows[0].operator_reply);
  assert.equal((await request(`/cases/${id}/history`, "stranger")).status, 404);
  await pool.query(`CREATE FUNCTION reject_history() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.operator_reply='TRIGGER_FAILURE' THEN RAISE EXCEPTION 'history unavailable'; END IF; RETURN NEW; END $$;
    CREATE TRIGGER reject_history BEFORE INSERT ON clinic_case_history FOR EACH ROW EXECUTE FUNCTION reject_history()`);
  assert.equal((await request(path, "admin-b", { status: "closed", operatorReply: "TRIGGER_FAILURE", expectedRevision: 1 })).status, 503);
  const afterFailure = await pool.query("SELECT revision,status,operator_reply FROM clinic_cases WHERE id=$1", [id]);
  assert.equal(afterFailure.rows[0].revision, 1);
  assert.equal(afterFailure.rows[0].status, "answered");
  assert.equal(afterFailure.rows[0].operator_reply, stored.rows[0].operator_reply);
  assert.equal((await pool.query("SELECT * FROM clinic_case_history")).rowCount, 2);
  assert.equal((await request(path, "admin-b", { status: "closed", operatorReply: "Retry succeeds", expectedRevision: 1 })).status, 200);
  allowed = false;
  assert.equal((await request(path, "admin-b", { status: "open", operatorReply: "revoked", expectedRevision: 2 })).status, 403);
  assert.equal((await (await request(`/cases/${id}/history`, "owner")).json()).length, 3);
  await pool.query(`CREATE OR REPLACE FUNCTION reject_history() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'history unavailable'; END $$`);
  const created = await fetch(`http://127.0.0.1:${server.address().port}/clinic/cases`, {
    method: "POST", headers: { Authorization: "Bearer owner", "Content-Type": "application/json" },
    body: JSON.stringify({ topicId: "sbu", kind: "consultation", subject: "New case", description: "Should fully roll back" }),
  });
  assert.equal(created.status, 503);
  assert.equal((await pool.query("SELECT * FROM clinic_cases")).rowCount, 1, "failed creation history must not leave a case behind");
});
