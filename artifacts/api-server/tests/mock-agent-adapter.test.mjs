import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const compiled = await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/mock-agent-adapter.ts", import.meta.url))],
  bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent", metafile: true,
});
const module = { exports: {} };
new Function("require", "module", "exports", compiled.outputFiles[0].text)(
  createRequire(import.meta.url), module, module.exports);
const { createMockAgentAdapter } = module.exports;
const A = "operator-a", B = "operator-b";
const input = (scenario = "success") => ({ requestId: randomUUID(), operation: "service_health", scenario });
const hasCode = code => error => error.code === code;
function fixture(t, options = {}) {
  const adapter = createMockAgentAdapter({ environment: "test", runMs: 5, timeoutMs: 1000, ...options });
  t.after(() => adapter.dispose());
  return adapter;
}
async function wait(adapter, id, state, actor = A) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const job = adapter.get(actor, id);
    if (job.state === state) return job;
    await new Promise(resolve => setTimeout(resolve, 1));
  }
  assert.fail(`Synthetic job did not reach ${state}`);
}

test("production and invalid resource bounds fail closed", () => {
  assert.throws(() => createMockAgentAdapter({ environment: "production" }), hasCode("preview_only"));
  for (const options of [{ maxJobs: 0 }, { maxConcurrent: 5 }, { timeoutMs: -1 }, { retentionMs: Infinity }, { runMs: 1.5 }]) {
    assert.throws(() => createMockAgentAdapter({ environment: "test", ...options }), hasCode("invalid_input"));
  }
});

test("no provider, member data, gateway or network library is imported", () => {
  const files = Object.keys(compiled.metafile.inputs);
  assert.equal(files.length, 1);
  assert.match(files[0], /mock-agent-adapter\.ts$/);
  for (const file of Object.values(compiled.metafile.inputs)) {
    assert.ok(file.imports.every(value => value.path === "node:crypto" && value.external));
  }
});

test("only synthetic actors and fixed health operation are accepted", t => {
  const adapter = fixture(t);
  assert.throws(() => adapter.submit("real-user", input()), hasCode("forbidden"));
  for (const value of [null, [], { ...input(), operation: "read_documents" }, { ...input(), scenario: "arbitrary" },
    { ...input(), requestId: "bad" }, { ...input(), user_id: randomUUID() },
    { ...input(), endpoint: "https://example.invalid" }, { ...input(), token: "synthetic-token" }]) {
    assert.throws(() => adapter.submit(A, value), hasCode("invalid_input"));
  }
  assert.equal(adapter.stats().executions, 0);
});

test("duplicate requests before, during and after execution reuse exactly one job", async t => {
  const adapter = fixture(t, { runMs: 30 });
  const payload = input(), first = adapter.submit(A, payload);
  assert.equal(first.job.state, "queued");
  const attempts = await Promise.all(Array.from({ length: 20 }, async () => adapter.submit(A, payload)));
  assert.ok(attempts.every(value => value.reused && value.job.id === first.job.id));
  await wait(adapter, first.job.id, "running");
  assert.equal(adapter.submit(A, payload).reused, true);
  await wait(adapter, first.job.id, "completed");
  assert.equal(adapter.submit(A, { ...payload, requestId: payload.requestId.toUpperCase() }).reused, true);
  assert.equal(adapter.stats().executions, 1);
  assert.throws(() => adapter.submit(A, { ...payload, scenario: "failure" }), hasCode("idempotency_conflict"));
});

test("synthetic actor boundaries apply to reads, cancellation and idempotency", t => {
  const adapter = fixture(t), payload = input();
  const a = adapter.submit(A, payload), b = adapter.submit(B, payload);
  assert.notEqual(a.job.id, b.job.id);
  assert.throws(() => adapter.get(B, a.job.id), hasCode("not_found"));
  assert.throws(() => adapter.cancel(B, a.job.id), hasCode("not_found"));
  assert.equal(adapter.get(A, a.job.id).state, "queued");
});

test("queued cancellation never executes and replay does not restart it", async t => {
  const adapter = fixture(t), payload = input(), job = adapter.submit(A, payload).job;
  assert.equal(adapter.cancel(A, job.id).state, "cancelled");
  assert.equal(adapter.submit(A, payload).job.state, "cancelled");
  await new Promise(resolve => setTimeout(resolve, 10));
  assert.equal(adapter.stats().executions, 0);
});

test("running cancellation releases the slot and a late success cannot replace it", async t => {
  const adapter = fixture(t, { runMs: 40 });
  const first = adapter.submit(A, input()).job, next = adapter.submit(A, input()).job;
  await wait(adapter, first.id, "running");
  assert.equal(adapter.get(A, next.id).state, "queued");
  adapter.cancel(A, first.id);
  await wait(adapter, next.id, "completed");
  assert.equal(adapter.get(A, first.id).state, "cancelled");
  assert.equal(adapter.stats().active, 0);
});

test("failure and timeout are terminal, release capacity and never auto-retry", async t => {
  const adapter = fixture(t, { timeoutMs: 15, runMs: 3 });
  const broken = input("failure"), slow = input("hang");
  const failure = adapter.submit(A, broken).job, timeout = adapter.submit(A, slow).job;
  assert.equal((await wait(adapter, failure.id, "failed")).code, "synthetic_failure");
  assert.equal((await wait(adapter, timeout.id, "timed_out")).code, "deadline_exceeded");
  assert.equal(adapter.submit(A, broken).reused, true);
  assert.equal(adapter.submit(A, slow).reused, true);
  assert.equal(adapter.stats().executions, 2);
  assert.equal(adapter.stats().active, 0);
});

test("bounded retention preserves active jobs, rejects overflow and frees terminal entries", async t => {
  let now = 100;
  const adapter = fixture(t, { maxJobs: 1, retentionMs: 10, now: () => now, runMs: 10 });
  const payload = input(), first = adapter.submit(A, payload).job;
  now = 1000;
  assert.throws(() => adapter.submit(A, input()), hasCode("capacity"));
  await wait(adapter, first.id, "completed");
  now += 9;
  assert.equal(adapter.submit(A, payload).reused, true);
  now += 1;
  assert.throws(() => adapter.get(A, first.id), hasCode("not_found"));
  const fresh = adapter.submit(A, payload);
  assert.equal(fresh.reused, false);
  assert.notEqual(fresh.job.id, first.id);
});

test("snapshots cannot mutate internal results; disposal stops and closes the adapter", async t => {
  const adapter = fixture(t);
  const job = adapter.submit(A, input()).job;
  job.state = "completed";
  assert.equal(adapter.get(A, job.id).state, "queued");
  const done = await wait(adapter, job.id, "completed");
  done.result.hermes = "forged";
  assert.equal(adapter.get(A, job.id).result.hermes, "simulated");
  const pending = adapter.submit(A, input("hang")).job;
  adapter.dispose();
  assert.equal(adapter.get(A, pending.id).state, "cancelled");
  assert.equal(adapter.stats().active, 0);
  assert.throws(() => adapter.submit(A, input()), hasCode("closed"));
});
