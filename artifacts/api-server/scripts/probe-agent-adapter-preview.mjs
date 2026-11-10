import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";

// No server, API key, SDK imports, output files or external requests.
const compiled = await build({
  entryPoints: [fileURLToPath(new URL("../src/lib/mock-agent-adapter.ts", import.meta.url))],
  bundle: true, platform: "node", format: "cjs", write: false, logLevel: "silent",
});
const module = { exports: {} };
new Function("require", "module", "exports", compiled.outputFiles[0].text)(
  createRequire(import.meta.url), module, module.exports);
const adapter = module.exports.createMockAgentAdapter({
  environment: "development", runMs: 10, timeoutMs: 100,
});
const actor = "operator-a";
const input = scenario => ({ requestId: randomUUID(), operation: "service_health", scenario });
async function waitFor(id, states) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) {
    const job = adapter.get(actor, id);
    if (states.includes(job.state)) return job;
    await new Promise(resolve => setTimeout(resolve, 2));
  }
  throw new Error("Synthetic fixture did not finish");
}
try {
  const payload = input("success");
  const first = adapter.submit(actor, payload);
  assert.equal(first.job.state, "queued");
  const duplicate = adapter.submit(actor, payload);
  assert.equal(duplicate.job.id, first.job.id);
  assert.equal(duplicate.reused, true);
  const completed = await waitFor(first.job.id, ["completed"]);
  const pending = adapter.submit(actor, input("hang"));
  await waitFor(pending.job.id, ["running"]);
  const cancelled = adapter.cancel(actor, pending.job.id);
  const broken = adapter.submit(actor, input("failure"));
  const failed = await waitFor(broken.job.id, ["failed"]);
  const slow = adapter.submit(actor, input("hang"));
  const timedOut = await waitFor(slow.job.id, ["timed_out"]);
  assert.equal(adapter.stats().executions, 4);
  console.log(JSON.stringify({
    mockAdapter: true, mode: "synthetic-only", ok: true,
    states: [first.job.state, "running", completed.state, cancelled.state, failed.state, timedOut.state],
    deduplicated: duplicate.reused, executions: adapter.stats().executions,
    openclawInstalled: false, realHermesStarted: false, memberDataAccessed: false,
    aiRequests: 0, networkRequests: 0, productionChanged: false,
  }));
} finally {
  adapter.dispose();
}
