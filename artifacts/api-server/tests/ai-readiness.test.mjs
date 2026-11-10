import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import { build } from "esbuild";
import express from "express";

const bundle = await build({
  stdin: {
    contents: `
      export { createAiReadiness } from "./src/lib/ai-readiness";
      export { createChatRouter } from "./src/routes/chat";
      export { AskVaultQuestionBody } from "@workspace/api-zod";
    `,
    resolveDir: fileURLToPath(new URL("..", import.meta.url)), loader: "ts",
  },
  bundle: true, platform: "node", format: "cjs", external: ["express"], write: false,
});
const compiled = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(
  createRequire(import.meta.url), compiled, compiled.exports,
);
const { createAiReadiness, createChatRouter, AskVaultQuestionBody } = compiled.exports;
const env = {
  OPENROUTER_API_KEY: "synthetic-ai-key",
  SUPABASE_URL: "https://example.supabase.co",
  SUPABASE_PUBLISHABLE_KEY: "synthetic-gateway-key",
};
const member = "12345678-1234-1234-1234-123456789012";
const authorization = "Bearer synthetic-member-session-token";
const sensitive = "PRIVATE_LABEL_AND_PROVIDER_BODY";
const metadata = (limit_remaining = null, extra = {}) => ({
  data: { label: sensitive, limit_remaining, usage: 987.65, ...extra },
});

test("metadata GET only, no prompt/body, success cached and does not promise funding", async () => {
  let time = 0, calls = 0;
  const readiness = createAiReadiness({
    env, now: () => time,
    fetchImpl: async (url, init) => {
      calls++;
      assert.equal(url, "https://openrouter.ai/api/v1/key");
      assert.equal(init.method, "GET");
      assert.equal(init.redirect, "error");
      assert.equal(init.body, undefined);
      assert.equal(init.headers.Authorization, `Bearer ${env.OPENROUTER_API_KEY}`);
      return Response.json(metadata(0.001));
    },
  });
  const admin = await readiness.get(true);
  assert.equal(admin.state, "configured");
  assert.equal(admin.diagnostics.reason, "metadata_available");
  assert.match(admin.message, /tidak menjamin/);
  const safe = await readiness.get();
  assert.equal(safe.diagnostics, undefined);
  assert.doesNotMatch(JSON.stringify(safe), /PRIVATE|synthetic|987|0\.001|usage|label|limit_remaining/);
  assert.equal(calls, 1);
  time = 60_000;
  await readiness.get();
  assert.equal(calls, 2);
});

for (const status of [402, 429, 401, 403, 500]) {
  test(`metadata HTTP ${status} caches its failure without reading the response body`, async () => {
    let calls = 0, time = 0;
    const readiness = createAiReadiness({ env, now: () => time, fetchImpl: async () => {
      calls++;
      return { status, ok: false, json() { throw new Error("must-not-read"); } };
    } });
    const results = await Promise.all(Array.from({ length: 12 }, () => readiness.get()));
    assert.equal(calls, 1);
    assert.ok(results.every(r => r.state === ([402, 429].includes(status) ? "limit_indicated" : "unknown")));
    await readiness.get(true);
    assert.equal(calls, 1);
    time = 60_000;
    await readiness.get();
    assert.equal(calls, 2);
    assert.doesNotMatch(JSON.stringify(results), /must-not-read|diagnostics|synthetic/);
  });
}

test("timeout and malformed metadata are unknown, cached briefly, then recover", async () => {
  for (const mode of ["timeout", "malformed", "invalid-json"]) {
    let calls = 0, time = 0;
    const readiness = createAiReadiness({ env, now: () => time, timeoutMs: 5, fetchImpl: async (_url, init) => {
      calls++;
      if (calls > 1) return Response.json(metadata());
      if (mode === "malformed") return Response.json({ data: { label: sensitive } });
      if (mode === "invalid-json") return new Response("not JSON " + sensitive);
      await new Promise((resolve, reject) => {
        init.signal.addEventListener("abort", () => reject(new Error(sensitive)), { once: true });
        // Keep the process alive for AbortSignal.timeout's unref'd timer.
        setTimeout(resolve, 20);
      });
      throw new Error("expected abort");
    } });
    const result = await readiness.get();
    assert.equal(result.state, "unknown");
    time = 29_999;
    await readiness.get();
    assert.equal(calls, 1);
    time = 30_000;
    assert.equal((await readiness.get()).state, "configured");
    assert.equal(calls, 2);
    assert.doesNotMatch(JSON.stringify(result), /PRIVATE|synthetic/);
  }
});

test("zero/negative key or enforced budget indicates a limit; null is not zero", async () => {
  for (const [body, state] of [
    [metadata(0), "limit_indicated"], [metadata(-1), "limit_indicated"],
    [metadata(null), "configured"],
    [metadata(null, { effective_budget: { remaining_usd: 0 } }), "limit_indicated"],
    [metadata(2, { budgets: [{ remaining_usd: -0.1 }] }), "limit_indicated"],
  ]) {
    assert.equal((await createAiReadiness({ env, fetchImpl: async () => Response.json(body) }).get()).state, state);
  }
});

test("missing configuration makes no provider request; key rotation invalidates cache", async () => {
  const mutable = {};
  let calls = 0;
  const readiness = createAiReadiness({ env: mutable, fetchImpl: async () => { calls++; return Response.json(metadata()); } });
  assert.equal((await readiness.get()).state, "not_configured");
  assert.equal(calls, 0);
  mutable.OPENROUTER_API_KEY = "synthetic-one";
  await readiness.get();
  mutable.OPENROUTER_API_KEY = "synthetic-two";
  await readiness.get();
  assert.equal(calls, 2);
});

test("diagnostics require a current server-verified admin, never JWT/user-supplied role claims", async t => {
  let role = "member", authCalls = 0, roleCalls = 0, metadataCalls = 0, failRole = false;
  const app = express();
  app.use(createChatRouter({ env, fetchImpl: async (url, init) => {
    if (url.includes("/auth/v1/user")) {
      authCalls++;
      return Response.json({ id: member, user_metadata: { role: "admin" } });
    }
    if (url.includes("/rest/v1/user_roles")) {
      roleCalls++;
      assert.equal(init.headers.Authorization, authorization);
      assert.ok(url.includes(member));
      return failRole ? new Response(sensitive, { status: 500 }) : Response.json([{ role }]);
    }
    metadataCalls++;
    return Response.json(metadata());
  } }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => server.close());
  const base = `http://127.0.0.1:${server.address().port}/helpdesk/status`;
  assert.equal((await fetch(base + "?diagnostics=true")).status, 401);
  assert.equal((await fetch(base + "?diagnostics=true&role=admin", { headers: { Authorization: authorization } })).status, 403);
  assert.equal(metadataCalls, 0);
  role = "admin";
  let response = await fetch(base + "?diagnostics=true", { headers: { Authorization: authorization } });
  assert.equal(response.status, 200);
  assert.equal((await response.json()).diagnostics.reason, "metadata_available");
  assert.equal(response.headers.get("cache-control"), "no-store");
  // The very next member read must not inherit the admin cache projection.
  response = await fetch(base);
  const safe = await response.json();
  assert.equal(response.status, 200);
  assert.equal(safe.diagnostics, undefined);
  assert.doesNotMatch(JSON.stringify(safe), /PRIVATE|987|synthetic/);
  role = "member";
  assert.equal((await fetch(base + "?diagnostics=true", { headers: { Authorization: authorization } })).status, 403);
  failRole = true;
  response = await fetch(base + "?diagnostics=true", { headers: { Authorization: authorization } });
  assert.equal(response.status, 503);
  assert.doesNotMatch(await response.text(), /PRIVATE/);
  assert.equal(authCalls, 4);
  assert.equal(roleCalls, 4);
  assert.equal(metadataCalls, 1);
});

test("readiness cannot grant consent to send private documents", async () => {
  for (const consent of [undefined, false]) {
    assert.equal(AskVaultQuestionBody.safeParse({ question: "Apa isi dokumen?", consent }).success, false);
  }
  assert.equal(AskVaultQuestionBody.safeParse({ question: "Apa isi dokumen?", consent: true }).success, true);
  const route = await readFile(new URL("../src/routes/vault.ts", import.meta.url), "utf8");
  assert.ok(route.indexOf("vaultRouter.use(vaultPubMiddleware)") < route.indexOf('vaultRouter.get("/ai-status"'));
  const statusHandler = route.split('vaultRouter.get("/ai-status"')[1].split('vaultRouter.post("/company-names"')[0];
  assert.doesNotMatch(statusHandler, /workspace\(|requestVaultAnswer|consent|document/);
  const pub = await readFile(new URL("../../pub-aspekindo/src/pages/HelpdeskAI.tsx", import.meta.url), "utf8");
  const vault = await readFile(new URL("../../ruang-simpan/src/pages/assistants.tsx", import.meta.url), "utf8");
  assert.match(pub, /setUseVaultContext\(false\)/);
  assert.match(vault, /!consent/);
  assert.doesNotMatch(vault, /setConsent\(true\)/);
  for (const source of [pub, vault]) {
    const submitButtons = source.match(/<Button type="submit"[^>]*>/g) ?? [];
    assert.ok(submitButtons.length > 0);
    assert.ok(submitButtons.every(button => !button.includes("aiStatus")));
  }
});
