import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { validateProbeTarget } from "../scripts/insight-probe-target.mjs";

const projectRef = "abcdefghijklmnopqrst";
const otherRef = "zyxwvutsrqponmlkjihg";
const origin = `https://${projectRef}.supabase.co`;
const script = fileURLToPath(new URL("../scripts/verify-competency-insight.mjs", import.meta.url));
const serviceKey = "synthetic-service-secret";
const publicKey = "synthetic-publishable-secret";
const credentialUrl = `https://private-user:private-password@${projectRef}.supabase.co?token=private-token`;

// No inherited environment, no real fetch: exercise the executable with a
// deterministic contract, including creation and deletion of a synthetic user.
async function runProbe(t, { url = origin, ref = projectRef } = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), "verify-insight-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const tracePath = path.join(directory, "requests.jsonl");
  const preloadPath = path.join(directory, "fetch.mjs");
  await writeFile(preloadPath, `
import assert from "node:assert/strict";
import { appendFileSync } from "node:fs";
globalThis.fetch = async (url, init) => {
  appendFileSync(${JSON.stringify(tracePath)}, JSON.stringify({url, method: init.method}) + "\\n");
  assert.ok(url.startsWith(${JSON.stringify(`${origin}/`)}));
  const index = globalThis.probeRequestIndex = (globalThis.probeRequestIndex ?? 0) + 1;
  const replies = [
    [401, {error: "Unauthorized"}],
    [401, {error: "Unauthorized"}],
    [200, {id: "synthetic-user-id"}],
    [200, {access_token: "synthetic-access-token"}],
    [200, {source: "deterministic", generatedAt: "2026-01-01T00:00:00Z",
      recommendations: [{href: "/assessment", label: "Assessment", text: "Start assessment"}]}],
    [403, {error: "Forbidden"}],
    [201, {}],
    [200, {health: {status: "deterministic", failureReason: "not_configured",
      lastProbeAt: "2026-01-01T00:00:00Z"}}],
    [204, null],
  ];
  const [status, body] = replies[index - 1];
  return {status, text: async () => JSON.stringify(body)};
};
`);
  const result = await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--import", preloadPath, script], {
      env: {
        ...(url === null ? {} : { SUPABASE_URL: url }),
        ...(ref === null ? {} : { SUPABASE_PROJECT_REF: ref }),
        SUPABASE_SERVICE_ROLE_KEY: serviceKey,
        VITE_SUPABASE_PUBLISHABLE_KEY: publicKey,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [], stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (status, signal) => resolve({
      status, signal,
      stdout: Buffer.concat(stdout).toString("utf8"),
      stderr: Buffer.concat(stderr).toString("utf8"),
    }));
  });
  return { ...result, tracePath };
}

test("matching synthetic URL/ref completes the probe with a canonical origin", async (t) => {
  for (const url of [origin, `${origin}/`]) {
    assert.equal(validateProbeTarget(url, projectRef), origin);
    const result = await runProbe(t, { url });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.signal, null);
    assert.equal(result.stderr, "");
    assert.equal(JSON.parse(result.stdout).adminHealthStatus, 200);
    const requests = (await readFile(result.tracePath, "utf8")).trim().split("\n").map(JSON.parse);
    assert.equal(requests.length, 9);
    assert.ok(requests.every(({ url }) => url.startsWith(`${origin}/`) && !url.startsWith(`${origin}//`)));
    assert.deepEqual(requests.at(-1), {
      url: `${origin}/auth/v1/admin/users/synthetic-user-id`, method: "DELETE",
    });
  }
});

test("wrong, missing, malformed, or ambiguous destinations fail before all network requests", async (t) => {
  const cases = [
    { url: `https://${otherRef}.supabase.co` },
    { url: null }, { url: "" }, { url: "not a URL private-token" },
    { ref: null }, { ref: "" }, { ref: "private-token" },
    { url: credentialUrl },
    { url: origin, ref: credentialUrl },
    { url: origin.replace("https:", "http:") },
    { url: `${origin}.attacker.test` },
    { url: `${origin}@attacker.test` },
    { url: `${origin}:443` },
    { url: `${origin}/rest/v1` },
    { url: `${origin}/../` },
    { url: `${origin}//` },
    { url: `${origin}?token=private-token` },
    { url: `${origin}#private-token` },
    { url: ` ${origin}` },
    { url: `${origin}\n` },
    { url: `https://%61bcdefghijklmnopqrst.supabase.co` },
  ];
  for (const config of cases) {
    const result = await runProbe(t, config);
    assert.equal(result.status, 1);
    assert.equal(result.signal, null);
    assert.equal(result.stdout, "");
    assert.deepEqual(JSON.parse(result.stderr), {
      status: "failed",
      reason: "competency_insight_probe_configuration",
    });
    for (const value of [
      serviceKey, publicKey, credentialUrl, "private-user", "private-password",
      "private-token", projectRef, otherRef, origin,
    ]) {
      assert.equal(result.stderr.includes(value), false, "diagnostics must not expose inputs");
    }
    await assert.rejects(readFile(result.tracePath), { code: "ENOENT" });
    assert.throws(
      () => validateProbeTarget(config.url === undefined ? origin : config.url,
        config.ref === undefined ? projectRef : config.ref),
      (error) => {
        assert.doesNotMatch(error.message, /private-token|private-password|private-user|https:\/\//);
        return true;
      },
    );
  }
});
