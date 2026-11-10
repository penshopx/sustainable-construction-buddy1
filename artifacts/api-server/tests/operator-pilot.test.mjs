import test from "node:test";
import assert from "node:assert/strict";
import express from "express";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

const bundle = await build({
  stdin: { contents: 'export {createOperatorPilotRouter} from "./src/routes/operator-pilot";',
    resolveDir: fileURLToPath(new URL("..", import.meta.url)), loader: "ts" },
  bundle: true, platform: "node", format: "cjs", external: ["express"], write: false,
});
const module = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(
  createRequire(import.meta.url), module, module.exports);
const { createOperatorPilotRouter } = module.exports;
const A = "11111111-1111-4111-8111-111111111111", B = "22222222-2222-4222-8222-222222222222";
const token = actor => `Bearer ${actor.repeat(30)}`;
const ENV = { NODE_ENV: "development", VITE_SUPABASE_URL: "https://fixture.supabase.co",
  VITE_SUPABASE_PUBLISHABLE_KEY: "synthetic-public-key", SUPABASE_SERVICE_ROLE_KEY: "PRIVATE_NEVER_USE" };
async function harness(t, options = {}) {
  const calls = [];
  const control = { role: true, roleStatus: 200, authStatus: 200, roleFailure: false };
  const fetchImpl = async (url, init) => {
    const target = new URL(String(url)); calls.push({ url: target, init });
    if (target.pathname === "/auth/v1/user") {
      return Response.json({ id: init.headers.Authorization === token("b") ? B : A,
        app_metadata: { role: "super_admin" } }, { status: control.authStatus });
    }
    assert.equal(target.pathname, "/rest/v1/rpc/current_user_is_super_admin");
    if (control.roleFailure) throw new Error("PRIVATE_UPSTREAM_SECRET");
    return Response.json(control.role, { status: control.roleStatus });
  };
  const app = express(); app.use(express.json());
  app.use(createOperatorPilotRouter({
    env: { ...ENV, ...options.env }, fetchImpl, adapterOptions: { runMs: 10, timeoutMs: 100 },
  }));
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  t.after(() => new Promise(resolve => { server.close(resolve); server.closeAllConnections(); }));
  const base = `http://127.0.0.1:${server.address().port}/operator/pilot/jobs`;
  const request = (method = "POST", suffix = "", body, authorization = token("a"), extras = {}) => fetch(base + suffix, {
    method, headers: { ...(authorization ? { Authorization: authorization } : {}), ...extras,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { request, control, calls };
}
const input = () => ({ requestId: randomUUID(), operation: "service_health", scenario: "hang" });

test("production, missing login and expired sessions are denied before simulation", async t => {
  const prod = await harness(t, { env: { NODE_ENV: "production" } });
  assert.equal((await prod.request("POST", "", input())).status, 404);
  assert.equal(prod.calls.length, 0);
  const h = await harness(t);
  assert.equal((await h.request("POST", "", input(), "")).status, 401);
  assert.equal(h.calls.length, 0);
  h.control.authStatus = 401;
  assert.equal((await h.request("POST", "", input())).status, 401);
  assert.equal(h.calls.length, 1);
});

test("ordinary members/admins cannot self-claim super-admin through JWT metadata, headers or body", async t => {
  const h = await harness(t); h.control.role = false;
  const response = await h.request("POST", "", { ...input(), role: "super_admin", actor: "operator-a" },
    token("a"), { "X-Role": "super_admin" });
  assert.equal(response.status, 403);
  assert.equal(h.calls.length, 2);
});

test("create/read/cancel reverify the role and propagate only public apikey plus member bearer", async t => {
  const h = await harness(t), payload = input();
  const created = await h.request("POST", "", payload);
  assert.equal(created.status, 200);
  assert.equal(created.headers.get("cache-control"), "no-store");
  const result = await created.json();
  assert.equal(result.job.mode, "synthetic-only");
  const duplicate = await (await h.request("POST", "", payload)).json();
  assert.equal(duplicate.reused, true);
  assert.equal(duplicate.job.id, result.job.id);
  assert.equal((await h.request("GET", `/${result.job.id}`)).status, 200);
  const cancelled = await h.request("POST", `/${result.job.id}/cancel`);
  assert.equal(cancelled.status, 200);
  assert.equal((await cancelled.json()).state, "cancelled");
  assert.equal(h.calls.length, 8);
  for (const { url, init } of h.calls) {
    assert.equal(init.headers.apikey, "synthetic-public-key");
    assert.equal(init.headers.Authorization, token("a"));
    assert.doesNotMatch(String(url), /smap_documents|openrouter|file_url/);
    if (url.pathname.includes("/rpc/")) assert.equal(init.body, "{}");
  }
});

test("role revocation after creation blocks reading, cancellation and further submission", async t => {
  const h = await harness(t);
  const created = await (await h.request("POST", "", input())).json();
  h.control.role = false;
  for (const [method, suffix, body] of [
    ["GET", `/${created.job.id}`], ["POST", `/${created.job.id}/cancel`], ["POST", "", input()],
  ]) assert.equal((await h.request(method, suffix, body)).status, 403);
});

test("RPC errors, missing function and malformed/oversized role responses fail closed without leaking details", async t => {
  for (const variant of ["throw", "status", "string", "object", "huge"]) {
    const h = await harness(t);
    if (variant === "throw") h.control.roleFailure = true;
    if (variant === "status") h.control.roleStatus = 404;
    if (variant === "string") h.control.role = "true";
    if (variant === "object") h.control.role = { allowed: true, secret: "PRIVATE" };
    if (variant === "huge") h.control.role = "PRIVATE".repeat(1000);
    const response = await h.request("POST", "", input());
    assert.equal(response.status, 503);
    assert.doesNotMatch(JSON.stringify(await response.json()), /PRIVATE|stack|fixture\.supabase/);
  }
});

test("a service-role key alone never substitutes for a public key in operator verification", async t => {
  const h = await harness(t, { env: { VITE_SUPABASE_PUBLISHABLE_KEY: undefined } });
  assert.equal((await h.request("POST", "", input())).status, 503);
  assert.equal(h.calls.length, 0);
});

test("two authorized accounts cannot read or cancel each other's jobs, even with the same request ID", async t => {
  const h = await harness(t), payload = input();
  const first = await (await h.request("POST", "", payload)).json();
  const second = await (await h.request("POST", "", payload, token("b"))).json();
  assert.notEqual(first.job.id, second.job.id);
  assert.equal((await h.request("GET", `/${first.job.id}`, undefined, token("b"))).status, 404);
  assert.equal((await h.request("POST", `/${first.job.id}/cancel`, undefined, token("b"))).status, 404);
});

test("untrusted identities, queries and changed idempotent input are rejected", async t => {
  const h = await harness(t), payload = input();
  assert.equal((await h.request("POST", "", { ...payload, actor: A })).status, 400);
  assert.equal((await h.request("POST", "?owner=" + A, payload)).status, 400);
  assert.equal((await h.request("POST", "", payload)).status, 200);
  assert.equal((await h.request("POST", "", { ...payload, scenario: "failure" })).status, 409);
});

test("per-operator submission budget rejects an eleventh request", async t => {
  const h = await harness(t);
  for (let i = 0; i < 10; i++) assert.equal((await h.request("POST", "", input())).status, 200);
  const response = await h.request("POST", "", input());
  assert.equal(response.status, 429);
  assert.ok(Number(response.headers.get("retry-after")) > 0);
});
