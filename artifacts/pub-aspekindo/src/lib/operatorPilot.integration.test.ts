import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createServer, type ViteDevServer } from "vite";
import { fileURLToPath } from "node:url";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const OWNER = "11111111-1111-4111-8111-111111111111";
const JOB = { id: "22222222-2222-4222-8222-222222222222",
  requestId: "33333333-3333-4333-8333-333333333333", operation: "service_health",
  state: "completed", mode: "synthetic-only", createdAt: 100,
  result: { mode: "synthetic-only", openclaw: "simulated", hermes: "simulated" } };
let vite: ViteDevServer, Panel: any, root: ReactTestRenderer | undefined, api: any;
let calls: any[];
test.before(async () => {
  (globalThis as any).__operatorSession = { auth: { getSession: async () => ({
    data: { session: { user: (globalThis as any).__operatorAuth.user, access_token: "synthetic-session-only" } }, error: null,
  }) } };
  vite = await createServer({
    cacheDir: "node_modules/.vite-operator-pilot-tests",
    configFile: false, root: fileURLToPath(new URL("../..", import.meta.url)), esbuild: { jsx: "automatic" },
    resolve: { alias: { "@": fileURLToPath(new URL("..", import.meta.url)) } },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [{
      name: "isolated-operator-pilot", enforce: "pre",
      resolveId(id) {
        if (id === "@workspace/api-client-react") return "\0operator-api";
        if (/hooks\/useAuth$/.test(id)) return "\0operator-auth";
        if (/integrations\/supabase\/client$/.test(id)) return "\0operator-session";
      },
      load(id) {
        if (id === "\0operator-auth") return "export const useAuth=()=>globalThis.__operatorAuth;";
        if (id === "\0operator-session") return "export const supabase=globalThis.__operatorSession;";
        if (id === "\0operator-api") return `
          export const createOperatorPilotJob=(...a)=>globalThis.__operatorApi.create(...a);
          export const getOperatorPilotJob=(...a)=>globalThis.__operatorApi.get(...a);
          export const cancelOperatorPilotJob=(...a)=>globalThis.__operatorApi.cancel(...a);`;
      },
    }], server: { middlewareMode: true }, appType: "custom",
  });
  ({ default: Panel } = await vite.ssrLoadModule("/src/components/admin/OperatorPilotPanel.tsx"));
});
test.beforeEach(() => {
  (globalThis as any).__operatorAuth = { user: { id: OWNER } };
  calls = [];
  api = {
    create: async (body: any, options: any) => { calls.push({ kind: "create", body, options }); return { job: JOB, reused: false }; },
    get: async (id: any, options: any) => { calls.push({ kind: "get", id, options }); return JOB; },
    cancel: async (id: any, options: any) => { calls.push({ kind: "cancel", id, options }); return { ...JOB, state: "cancelled", result: undefined }; },
  };
  (globalThis as any).__operatorApi = api;
});
test.afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; });
test.after(async () => { await vite.close(); });
const button = (text: string) => root!.root.findAllByType("button").find(value => value.children.includes(text))!;
async function mount() { await act(async () => { root = create(React.createElement(Panel)); }); }

test("simulation starts only on click and sends a member bearer, not a caller-supplied identity", async () => {
  await mount();
  assert.equal(calls.length, 0);
  await act(async () => { button("Mulai simulasi").props.onClick(); });
  assert.equal(calls.length, 1);
  assert.deepEqual(Object.keys(calls[0].body).sort(), ["operation", "requestId", "scenario"]);
  assert.equal(calls[0].body.operation, "service_health");
  assert.equal(calls[0].options.headers.Authorization, "Bearer synthetic-session-only");
  assert.match(JSON.stringify(root!.toJSON()), /Status: |Selesai/);
  assert.match(JSON.stringify(root!.toJSON()), /Bukan hasil layanan nyata/);
});

test("ambiguous creation failure offers manual reuse of the same request ID, never automatic resubmission", async () => {
  api.create = async (body: any) => { calls.push({ body }); throw { status: 503, secret: "PRIVATE" }; };
  await mount();
  await act(async () => { button("Mulai simulasi").props.onClick(); });
  assert.equal(calls.length, 1);
  const original = calls[0].body.requestId;
  assert.match(root!.root.findByProps({ role: "alert" }).children.join(""), /Akses ditutup/);
  assert.doesNotMatch(JSON.stringify(root!.toJSON()), /PRIVATE/);
  assert.equal(root!.root.findByType("select").props.disabled, true);
  api.create = async (body: any) => { calls.push({ body }); return { job: JOB, reused: true }; };
  await act(async () => { button("Kirim ulang ID yang sama").props.onClick(); });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].body.requestId, original);
});

test("a failed fresh role check hides the prior job and stops polling", async () => {
  api.create = async () => ({ job: { ...JOB, state: "running", result: undefined }, reused: false });
  api.get = async () => { calls.push({ kind: "get" }); throw { status: 403 }; };
  await mount();
  await act(async () => { button("Mulai simulasi").props.onClick(); });
  assert.match(JSON.stringify(root!.toJSON()), /Berjalan/);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 800)); });
  assert.match(root!.root.findByProps({ role: "alert" }).children.join(""), /khusus Super Admin/);
  assert.equal(root!.root.findAllByProps({ role: "status" }).length, 0);
  assert.equal(calls.filter(value => value.kind === "get").length, 1);
});

test("account changes abort old requests and suppress late results", async () => {
  let release!: (value: any) => void;
  api.create = (body: any, options: any) => {
    calls.push({ body, options }); return new Promise(resolve => { release = resolve; });
  };
  await mount();
  await act(async () => { button("Mulai simulasi").props.onClick(); });
  await act(async () => {
    (globalThis as any).__operatorAuth = { user: { id: "44444444-4444-4444-8444-444444444444" } };
    root!.update(React.createElement(Panel));
  });
  assert.equal(calls[0].options.signal.aborted, true);
  await act(async () => { release({ job: JOB, reused: false }); });
  assert.equal(root!.root.findAllByProps({ role: "status" }).length, 0);
  assert.equal(button("Mulai simulasi").props.disabled, false);
});

test("cancel uses the job endpoint and exposes the returned terminal status", async () => {
  api.create = async () => ({ job: { ...JOB, state: "running", result: undefined }, reused: false });
  await mount();
  await act(async () => { button("Mulai simulasi").props.onClick(); });
  await act(async () => { button("Batalkan simulasi").props.onClick(); });
  assert.equal(calls[0].kind, "cancel");
  assert.equal(calls[0].id, JOB.id);
  assert.match(JSON.stringify(root!.toJSON()), /Dibatalkan/);
});

test("one diagnostic click displays cancellation and timeout results without a form or raw tokens", async () => {
  const jobs = new Map<string, any>();
  api.create = async (body: any, options: any) => {
    calls.push({ kind: "create", body, options });
    const id = jobs.size === 0 ? JOB.id : "55555555-5555-4555-8555-555555555555";
    const job = { ...JOB, id, requestId: body.requestId, state: "running", result: undefined };
    jobs.set(id, job); return { job, reused: false };
  };
  api.cancel = async (id: string, options: any) => {
    calls.push({ kind: "cancel", id, options }); return { ...jobs.get(id), state: "cancelled" };
  };
  api.get = async (id: string, options: any) => {
    calls.push({ kind: "get", id, options }); return { ...jobs.get(id), state: "timed_out" };
  };
  await mount();
  assert.equal(calls.length, 0);
  await act(async () => { button("Uji pembatalan & timeout").props.onClick(); });
  assert.deepEqual(calls.map(value => value.kind), ["create", "cancel", "create", "get"]);
  assert.equal(calls.every(value => value.options.headers.Authorization === "Bearer synthetic-session-only"), true);
  const output = JSON.stringify(root!.toJSON());
  assert.match(output, /Pembatalan.*Lulus.*Dibatalkan/);
  assert.match(output, /Timeout.*Lulus.*Batas waktu habis/);
  assert.doesNotMatch(output, /synthetic-session-only/);
  assert.equal(button("Mulai simulasi").props.disabled, false);
});

test("diagnostic errors clear partial results and manual recovery reuses the same request ID", async () => {
  api.create = async (body: any, options: any) => {
    calls.push({ kind: "create", body, options }); throw { status: 503, secret: "PRIVATE" };
  };
  await mount();
  await act(async () => { button("Uji pembatalan & timeout").props.onClick(); });
  const requestId = calls[0].body.requestId;
  assert.equal(calls.length, 1);
  assert.doesNotMatch(JSON.stringify(root!.toJSON()), /PRIVATE/);
  assert.equal(root!.root.findAllByProps({ "aria-label": "Hasil pengujian pembatalan dan timeout" }).length, 0);
  await act(async () => { button("Ulangi ID pengujian yang sama").props.onClick(); });
  assert.equal(calls.length, 2);
  assert.equal(calls[1].body.requestId, requestId);
});

test("diagnostics stop on role loss after the first result and hide partial results", async () => {
  api.create = async (body: any, options: any) => {
    calls.push({ kind: "create", body, options });
    if (calls.filter(value => value.kind === "create").length > 1) throw { status: 403 };
    return { job: { ...JOB, requestId: body.requestId, state: "running" }, reused: false };
  };
  api.cancel = async () => ({
    ...JOB, requestId: calls[0].body.requestId, state: "cancelled",
  });
  await mount();
  await act(async () => { button("Uji pembatalan & timeout").props.onClick(); });
  assert.match(root!.root.findByProps({ role: "alert" }).children.join(""), /khusus Super Admin/);
  assert.equal(root!.root.findAllByProps({ "aria-label": "Hasil pengujian pembatalan dan timeout" }).length, 0);
  assert.equal(calls.length, 2);
});

test("account change aborts diagnostics, unlocks manual controls and ignores old results", async () => {
  let release!: (value: any) => void;
  api.create = (body: any, options: any) => {
    calls.push({ body, options }); return new Promise(resolve => { release = resolve; });
  };
  await mount();
  await act(async () => { button("Uji pembatalan & timeout").props.onClick(); });
  assert.equal(button("Mulai simulasi").props.disabled, true);
  await act(async () => {
    (globalThis as any).__operatorAuth = { user: { id: "44444444-4444-4444-8444-444444444444" } };
    root!.update(React.createElement(Panel));
  });
  assert.equal(calls[0].options.signal.aborted, true);
  await act(async () => { release({ job: { ...JOB, requestId: calls[0].body.requestId }, reused: false }); });
  assert.equal(root!.root.findAllByProps({ "aria-label": "Hasil pengujian pembatalan dan timeout" }).length, 0);
  assert.equal(button("Mulai simulasi").props.disabled, false);
  assert.equal(calls.length, 1);
});
