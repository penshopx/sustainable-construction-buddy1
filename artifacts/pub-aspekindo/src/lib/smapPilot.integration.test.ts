import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const OWNER = "11111111-1111-4111-8111-111111111111";
const ID = "22222222-2222-4222-8222-222222222222";
const DOC = { id: ID, type: "surat_pernyataan", checks: [{ name: "Nomor dokumen terisi", complete: false }] };
const RESULT = { analysis: "Draf sintetis, bukan keputusan sertifikasi.", model: "anthropic/claude-fixture",
  documentCount: 1, runtime: "hermes", dataScope: "presence-only" };
let vite: ViteDevServer, Panel: any, usePilot: any, hook: any, root: ReactTestRenderer | undefined;
let requests: any[], api: any;

test.before(async () => {
  (globalThis as any).__pilotAuth = { user: { id: OWNER } };
  (globalThis as any).__pilotSupabase = {
    auth: { getSession: async () => ({ data: { session: {
      user: (globalThis as any).__pilotAuth.user, access_token: "synthetic-member-session",
    } }, error: null }) },
    from: () => { throw new Error("Pilot UI must not mutate/read member tables directly"); },
  };
  vite = await createServer({
    cacheDir: "node_modules/.vite-smap-pilot-tests",
    configFile: false, root: fileURLToPath(new URL("../..", import.meta.url)),
    esbuild: { jsx: "automatic" },
    resolve: { alias: { "@": fileURLToPath(new URL("..", import.meta.url)) } },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [{
      name: "smap-pilot-isolated", enforce: "pre",
      resolveId(id) {
        if (id === "@workspace/api-client-react") return "\0pilot-api";
        if (/integrations\/supabase\/client$/.test(id)) return "\0pilot-db";
        if (/hooks\/useAuth$/.test(id)) return "\0pilot-auth";
      },
      load(id) {
        if (id === "\0pilot-api") return `export const listSmapPilotDocuments=(...a)=>globalThis.__pilotApi.list(...a);
          export const analyzeSmapPilot=(...a)=>globalThis.__pilotApi.analyze(...a);`;
        if (id === "\0pilot-db") return "export const supabase = globalThis.__pilotSupabase;";
        if (id === "\0pilot-auth") return "export const useAuth = () => globalThis.__pilotAuth;";
      },
    }], server: { middlewareMode: true }, appType: "custom",
  });
  ({ useSmapPilot: usePilot } = await vite.ssrLoadModule("/src/hooks/useSmapPilot.ts"));
  ({ default: Panel } = await vite.ssrLoadModule("/src/components/smap/SmapPilotPanel.tsx"));
});
test.beforeEach(() => {
  (globalThis as any).__pilotAuth = { user: { id: OWNER } };
  requests = [];
  api = {
    list: async () => ({ documents: [DOC] }),
    analyze: async (body: any, options: any) => { requests.push({ body, options }); return RESULT; },
  };
  (globalThis as any).__pilotApi = api;
});
test.afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; });
test.after(async () => { await vite.close(); });
function Harness() { hook = usePilot(); return null; }
async function mount(Component: any) { await act(async () => { root = create(React.createElement(Component)); }); }
const boxes = () => root!.root.findAllByType("input").filter(input => input.props.type === "checkbox");
const analyzeButton = () => root!.root.findAllByType("button").find(button => button.children.includes("Analisis pilihan dengan Claude"))!;

test("selection and explicit consent gate analysis; result appears and changing selection clears it", async () => {
  await mount(Panel);
  assert.equal(analyzeButton().props.disabled, true);
  await act(async () => { boxes()[0].props.onChange(); });
  assert.equal(analyzeButton().props.disabled, true);
  await act(async () => { boxes().at(-1)!.props.onChange({ target: { checked: true } }); });
  assert.equal(analyzeButton().props.disabled, false);
  await act(async () => { analyzeButton().props.onClick(); });
  assert.deepEqual(requests[0].body, { documentIds: [ID], consent: "smap-presence-v1" });
  assert.match(requests[0].options.headers.Authorization, /^Bearer synthetic/);
  assert.match(JSON.stringify(root!.toJSON()), /Draf sintetis/);
  assert.equal(analyzeButton().props.disabled, true);
  await act(async () => { boxes()[0].props.onChange(); });
  assert.doesNotMatch(JSON.stringify(root!.toJSON()), /Draf sintetis/);
});

test("failed list loading is visible, not displayed as an empty successful list", async () => {
  api.list = async () => { throw { status: 503, detail: "PRIVATE_PROVIDER_DETAIL" }; };
  await mount(Panel);
  assert.match(root!.root.findByProps({ role: "alert" }).children.join(""), /belum tersedia/);
  assert.doesNotMatch(JSON.stringify(root!.toJSON()), /PRIVATE_PROVIDER_DETAIL|Belum ada catatan/);
});

test("a delayed response after cancellation never restores a result or retries", async () => {
  let resolve!: (value: any) => void;
  api.analyze = (body: any, options: any) => {
    requests.push({ body, options }); return new Promise(done => { resolve = done; });
  };
  await mount(Harness);
  let pending: Promise<void>;
  await act(async () => { pending = hook.analyze([ID]); });
  await act(async () => { hook.cancel(); });
  assert.equal(requests[0].options.signal.aborted, true);
  await act(async () => { resolve(RESULT); await pending!; });
  assert.equal(hook.result, null);
  assert.equal(hook.busy, null);
  assert.equal(requests.length, 1);
});

test("account change aborts the old analysis and ignores its late answer", async () => {
  let resolve!: (value: any) => void;
  api.analyze = (_body: any, options: any) => {
    requests.push({ options }); return new Promise(done => { resolve = done; });
  };
  await mount(Harness);
  let pending: Promise<void>;
  await act(async () => { pending = hook.analyze([ID]); });
  await act(async () => {
    (globalThis as any).__pilotAuth = { user: { id: "33333333-3333-4333-8333-333333333333" } };
    root!.update(React.createElement(Harness));
  });
  assert.equal(requests[0].options.signal.aborted, true);
  await act(async () => { resolve(RESULT); await pending!; });
  assert.equal(hook.result, null);
});

test("new mount has no persisted result and shows no automatic analysis", async () => {
  await mount(Harness);
  assert.equal(hook.result, null);
  assert.equal(requests.length, 0);
});
