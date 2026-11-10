import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createServer, type ViteDevServer } from "vite";
import { fileURLToPath } from "node:url";
import type { HermesLocalCheckResult, HermesSchemeLocalCheckResult } from "@workspace/api-client-react";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let vite: ViteDevServer, Component: any, root: ReactTestRenderer | undefined;
const result: HermesLocalCheckResult = { status: "completed", runtime: "hermes", provider: "local-mock",
  dataScope: "synthetic-only", toolCount: 0, localProviderRequests: 1, externalModelRequests: 0,
  documentCount: 1, elapsedMs: 1000, fixtureReply: "Contoh sintetis, bukan analisis Claude." };
const bgResult: HermesSchemeLocalCheckResult = { ...result, dataScope: "uploaded-reference-only", documentCount: 3,
  schemeCode: "BG001", contextVerified: true, citationsVerified: true, question: "Pemetaan dan ruang lingkup BG001?",
  sources: [
    { id: "KB09", title: "Skema", page: 21, quote: "41011 BG001" },
    { id: "KB19", title: "Ruang lingkup", page: 17, quote: "pembongkaran" },
    { id: "KB44", title: "BPS 2025", page: 573, quote: "KONSTRUKSI KONVENSIONAL GEDUNG HUNIAN" },
  ] };
const state = () => (globalThis as any).__hermesLocalTest;
const control = (id: string) => root!.root.findByProps({ "data-testid": id });
const output = () => JSON.stringify(root!.toJSON());
async function start() {
  await act(async () => control("hermes-local-consent").props.onChange({ target: { checked: true } }));
  await act(async () => control("hermes-local-start").props.onClick());
}
test.before(async () => {
  vite = await createServer({
    cacheDir: "node_modules/.vite-hermes-local-check-tests",
    configFile: false, root: fileURLToPath(new URL("../..", import.meta.url)),
    esbuild: { jsx: "automatic" }, resolve: { alias: { "@": fileURLToPath(new URL("..", import.meta.url)) } },
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: "custom",
    plugins: [{ name: "hermes-local-fixture", enforce: "pre",
      resolveId(id) {
        if (id.includes("/hooks/useAuth")) return "\0hermes-auth";
        if (id.includes("/integrations/supabase/client")) return "\0hermes-session";
        if (id === "@workspace/api-client-react") return "\0hermes-api";
      },
      load(id) {
        if (id === "\0hermes-auth") return "export const useAuth=()=>({user:globalThis.__hermesLocalTest.user});";
        if (id === "\0hermes-session") return "export const supabase={auth:{getSession:async()=>({data:{session:globalThis.__hermesLocalTest.session},error:null})}};";
        if (id === "\0hermes-api") return "const run=(mode,body,options)=>{const s=globalThis.__hermesLocalTest;s.calls.push({mode,body,options});return new Promise((resolve,reject)=>s.pending.push({resolve,reject}));}; export const runHermesLocalCheck=(body,options)=>run('runtime',body,options); export const runHermesBg001Check=(body,options)=>run('bg001',body,options);";
      },
    }],
  });
  ({ default: Component } = await vite.ssrLoadModule("/src/components/admin/HermesLocalCheck.tsx"));
});
test.beforeEach(async () => {
  (globalThis as any).__hermesLocalTest = { user: { id: "operator-one" },
    session: { user: { id: "operator-one" }, access_token: "synthetic-session-not-production" }, calls: [], pending: [] };
  await act(async () => { root = create(React.createElement(Component)); });
});
test.afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; });
test.after(async () => { await vite.close(); delete (globalThis as any).__hermesLocalTest; });
test("starts only after explicit consent and click, with no documents/model/identity in the body", async () => {
  assert.equal(state().calls.length, 0);
  assert.equal(control("hermes-local-start").props.disabled, true);
  await start();
  assert.equal(state().calls.length, 1);
  assert.deepEqual(state().calls[0].body, { consent: true });
  assert.equal(state().calls[0].options.headers.Authorization, "Bearer synthetic-session-not-production");
  assert.equal(control("hermes-local-start").props.disabled, true);
  await act(async () => state().pending[0].resolve(result));
  assert.match(output(), /runtime Hermes nyata, jawaban model tiruan/);
  assert.match(output(), /Panggilan model eksternal/);
  assert.match(output(), /bukan analisis Claude/);
});
test("role loss hides prior results, uses sanitized errors, and never retries automatically", async () => {
  await start(); await act(async () => state().pending[0].resolve(result));
  await start();
  assert.doesNotMatch(output(), /Selesai —/);
  await act(async () => state().pending[1].reject({ status: 403, message: "PRIVATE_ERROR_CANARY" }));
  assert.match(output(), /Akses ditutup/); assert.doesNotMatch(output(), /PRIVATE_ERROR_CANARY|Selesai —/);
  assert.equal(state().calls.length, 2);
});
test("manual cancellation aborts and ignores late completions without a retry", async () => {
  await start();
  await act(async () => control("hermes-local-cancel").props.onClick());
  assert.equal(state().calls[0].options.signal.aborted, true);
  assert.match(output(), /Uji dibatalkan/);
  await act(async () => state().pending[0].resolve(result));
  assert.doesNotMatch(output(), /Selesai —/);
  assert.equal(control("hermes-local-start").props.disabled, false);
  assert.equal(state().calls.length, 1);
});
test("account switch and logout abort pending requests, clear consent and suppress stale results", async () => {
  await start();
  state().user = { id: "operator-two" };
  state().session = { user: state().user, access_token: "synthetic-second-session" };
  await act(async () => root!.update(React.createElement(Component)));
  assert.equal(state().calls[0].options.signal.aborted, true);
  assert.equal(control("hermes-local-consent").props.checked, false);
  await act(async () => state().pending[0].resolve(result));
  assert.doesNotMatch(output(), /Selesai —/);
  await start(); await act(async () => state().pending[1].resolve(result));
  state().user = null; state().session = null;
  await act(async () => root!.update(React.createElement(Component)));
  assert.doesNotMatch(output(), /Selesai —/);
  assert.equal(control("hermes-local-start").props.disabled, true);
});
test("mismatched sessions and malformed runtime replies cannot claim success", async () => {
  state().session.user.id = "different-operator";
  await start(); assert.equal(state().calls.length, 0); assert.match(output(), /Sesi berakhir/);
  state().session.user.id = "operator-one";
  await start();
  await act(async () => state().pending[0].resolve({ ...result, runtime: "simulated" }));
  assert.doesNotMatch(output(), /Selesai —/); assert.match(output(), /Uji atau pemeriksaan akses gagal/);
});
test("budget, preview-only and timeout failures are visible and do not rerun", async () => {
  for (const [status, text] of [[429, /batas tiga uji/], [404, /hanya tersedia di preview/], [504, /Batas waktu uji/]] as const) {
    await start();
    await act(async () => state().pending.at(-1).reject({ status }));
    assert.match(output(), text); assert.doesNotMatch(output(), /Selesai —/);
  }
  assert.equal(state().calls.length, 3);
});
test("selecting BG001 clears the old result and consent, sends only consent, and displays all cited sources", async () => {
  await start(); await act(async () => state().pending[0].resolve(result));
  await act(async () => control("hermes-local-mode").props.onChange({ target: { value: "bg001" } }));
  assert.equal(control("hermes-local-consent").props.checked, false);
  assert.doesNotMatch(output(), /Selesai —/);
  assert.equal(state().calls.length, 1);
  await start();
  assert.equal(state().calls[1].mode, "bg001");
  assert.deepEqual(state().calls[1].body, { consent: true });
  await act(async () => state().pending[1].resolve(bgResult));
  assert.match(output(), /Konteks diterima Hermes/);
  assert.match(output(), /Pemetaan dan ruang lingkup BG001/);
  assert.equal(root!.root.findAllByType("pre").length, 3);
  assert.match(output(), /573/); assert.match(output(), /pembongkaran/);
});
test("BG001 cannot show success with missing or mismatched source/context evidence", async () => {
  await act(async () => control("hermes-local-mode").props.onChange({ target: { value: "bg001" } }));
  for (const malformed of [{ ...bgResult, contextVerified: false }, { ...bgResult, citationsVerified: false },
    { ...bgResult, sources: bgResult.sources.slice(1) }, { ...bgResult, schemeCode: "BS019" }, result]) {
    await start();
    await act(async () => state().pending.at(-1).resolve(malformed));
    assert.doesNotMatch(output(), /Selesai —/);
    assert.match(output(), /Uji atau pemeriksaan akses gagal/);
  }
});
test("BG001 mode is locked during execution and account switch clears mode, consent and late results", async () => {
  await act(async () => control("hermes-local-mode").props.onChange({ target: { value: "bg001" } }));
  await start(); assert.equal(control("hermes-local-mode").props.disabled, true);
  state().user = { id: "another-operator" };
  await act(async () => root!.update(React.createElement(Component)));
  assert.equal(state().calls[0].options.signal.aborted, true);
  assert.equal(control("hermes-local-mode").props.value, "runtime");
  assert.equal(control("hermes-local-consent").props.checked, false);
  await act(async () => state().pending[0].resolve(bgResult));
  assert.doesNotMatch(output(), /Selesai —/);
});
