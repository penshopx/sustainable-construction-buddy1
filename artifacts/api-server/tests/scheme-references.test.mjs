import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import express from "express";
import { build } from "esbuild";
const built = await build({ stdin: { contents: 'export {createSchemeReferenceRouter} from "./src/routes/scheme-references";',
  resolveDir: new URL("..", import.meta.url).pathname, loader: "ts" },
  bundle: true, platform: "node", format: "cjs", write: false });
const module = { exports: {} };
new Function("require", "module", "exports", built.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const auth = { Authorization: "Bearer synthetic-reference-member-token" };

async function harness(t, response = () => Response.json({ id: "11111111-1111-4111-8111-111111111111" })) {
  const calls = [], logs = [];
  const app = express();
  app.use((req, _res, next) => { req.log = { warn: fields => logs.push(fields) }; next(); });
  app.use(module.exports.createSchemeReferenceRouter({ env: {
    SUPABASE_URL: "https://synthetic-supabase.example", VITE_SUPABASE_PUBLISHABLE_KEY: "synthetic-key-not-production",
    // No model key: reading reference material must never depend on AI billing.
  }, fetchImpl: async (url, init) => { calls.push({ url, init }); return response(url, init); } }));
  const server = createServer(app);
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  return { request: (headers = {}, method = "GET") => fetch(`${base}/scheme-references`, { headers, method }), calls, logs };
}
test("reference reads require a real member check and are never anonymously cached", async t => {
  const h = await harness(t);
  const res = await h.request();
  assert.equal(res.status, 401);
  assert.equal(res.headers.get("cache-control"), "no-store");
  assert.match(res.headers.get("vary"), /Authorization/);
  assert.equal(h.calls.length, 0);
});
test("authenticated readers get all draft references without model calls or private database reads", async t => {
  const h = await harness(t);
  for (let i = 0; i < 2; i++) {
    const res = await h.request(auth), body = await res.json();
    assert.equal(res.status, 200);
    assert.equal(body.status, "draft_reference_answers");
    assert.equal(body.usedForAiReplies, false);
    assert.equal(body.profiles.length, 77);
    assert.equal(body.cases.length, 214);
    assert.equal(Object.keys(body.evidence).length, 292);
    assert.equal(body.sourceFingerprints, undefined);
    assert.ok(body.cases.every(item => item.evidenceIds.every(id => body.evidence[id])));
  }
  assert.equal(h.calls.length, 2, "Each read must re-check membership even when bank is cached");
  assert.ok(h.calls.every(call => call.url === "https://synthetic-supabase.example/auth/v1/user"));
});
test("invalid sessions fail closed and provider failures never disclose exception details", async t => {
  const denied = await harness(t, () => Response.json({ message: "private-auth-canary" }, { status: 401 }));
  const res = await denied.request(auth);
  assert.equal(res.status, 401);
  assert.doesNotMatch(await res.text(), /private-auth-canary/);
  const failed = await harness(t, () => { throw new Error("private-network-canary"); });
  const unavailable = await failed.request(auth);
  assert.ok([401, 503].includes(unavailable.status));
  assert.doesNotMatch(await unavailable.text(), /private-network-canary/);
  assert.ok(failed.logs.every(log => Object.keys(log).join(",") === "code"));
});
test("reference endpoint has no write methods", async t => {
  const h = await harness(t);
  for (const method of ["POST", "PATCH", "DELETE"]) assert.equal((await h.request(auth, method)).status, 404);
  assert.equal(h.calls.length, 0);
});
