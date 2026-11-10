import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import React from "react";
import { create, act, type ReactTestRenderer } from "react-test-renderer";
import { createServer, type ViteDevServer } from "vite";
import type { HermesBg001ChatResult } from "@workspace/api-client-react";
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let vite: ViteDevServer, Component: any, root: ReactTestRenderer;
const state = () => (globalThis as any).__hermesChatTest;
const control = (id: string) => root.root.findByProps({ "data-testid": id });
const output = () => JSON.stringify(root.toJSON());
const result: HermesBg001ChatResult = { status: "completed", runtime: "hermes", provider: "openrouter-claude",
  schemeCode: "BG001", dataScope: "question-and-public-references", toolCount: 0, externalModelRequests: 1,
  contextVerified: true, model: "anthropic/claude-test", answer: "BG001: 41011. [KB09, halaman PDF 21]",
  insufficientEvidence: false, elapsedMs: 100, sources: [{ id: "KB09", page: 21, title: "Skema", quote: "BG001 41011" }] };
const render = (access = "allowed") => act(async () => root.update(React.createElement(Component, { access })));
async function ask(question = "Jelaskan pemetaan BG001") {
  await act(async () => control("hermes-chat-question").props.onChange({ target: { value: question } }));
  await act(async () => control("hermes-chat-consent").props.onChange({ target: { checked: true } }));
  await act(async () => root.root.findByType("form").props.onSubmit({ preventDefault() {} }));
}
test.before(async () => {
  vite = await createServer({
    cacheDir: "node_modules/.vite-hermes-bg001-chat-tests",
    configFile: false, root: fileURLToPath(new URL("../..", import.meta.url)),
    esbuild: { jsx: "automatic" }, resolve: { alias: { "@": fileURLToPath(new URL("..", import.meta.url)) } },
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true, hmr: false }, appType: "custom",
    plugins: [{ name: "hermes-chat-fixture", enforce: "pre",
      resolveId(id) {
        if (id.includes("/hooks/useAuth")) return "\0chat-auth";
        if (id.includes("/integrations/supabase/client")) return "\0chat-session";
        if (id === "@workspace/api-client-react") return "\0chat-api";
      },
      load(id) {
        if (id === "\0chat-auth") return "export const useAuth=()=>({user:globalThis.__hermesChatTest.user});";
        if (id === "\0chat-session") return "export const supabase={auth:{getSession:async()=>({data:{session:globalThis.__hermesChatTest.session},error:null})}};";
        if (id === "\0chat-api") return "export const runHermesBg001Chat=(body,options)=>{const s=globalThis.__hermesChatTest;s.calls.push({body,options});return new Promise((resolve,reject)=>s.pending.push({resolve,reject}));};";
      },
    }],
  });
  ({ default: Component } = await vite.ssrLoadModule("/src/components/chatbot/HermesBg001Chat.tsx"));
});
test.beforeEach(async () => {
  (globalThis as any).__hermesChatTest = { user: { id: "synthetic-operator" },
    session: { user: { id: "synthetic-operator" }, access_token: "synthetic-session" }, calls: [], pending: [] };
  await act(async () => { root = create(React.createElement(Component, { access: "allowed" })); });
});
test.afterEach(async () => { await act(async () => root.unmount()); });
test.after(async () => { await vite.close(); delete (globalThis as any).__hermesChatTest; });

test("no automatic paid calls; each explicit consent submits only question and displays draft and exact source", async () => {
  assert.equal(state().calls.length, 0); assert.equal(control("hermes-chat-send").props.disabled, true);
  await ask();
  assert.deepEqual(state().calls[0].body, { consent: true, question: "Jelaskan pemetaan BG001" });
  assert.equal(state().calls[0].options.headers.Authorization, "Bearer synthetic-session");
  assert.equal(control("hermes-chat-consent").props.checked, false);
  await act(async () => state().pending[0].resolve(result));
  assert.match(output(), /Draf Claude melalui Hermes/); assert.match(output(), /Sumber yang dikutip/);
  assert.equal(control("hermes-chat-send").props.disabled, true);
  assert.equal(root.root.findAllByType("pre").length, 1);
  await act(async () => control("hermes-chat-question").props.onChange({ target: { value: "Pertanyaan BG001 berikutnya" } }));
  assert.doesNotMatch(output(), /Draf Claude melalui Hermes/);
  assert.equal(state().calls.length, 1);
});
test("invalid questions and mismatched sessions never make a model request", async () => {
  await ask("    "); await ask("x".repeat(1001));
  assert.equal(state().calls.length, 0);
  state().session.user.id = "different-user"; await ask();
  assert.equal(state().calls.length, 0); assert.match(output(), /Sesi berakhir/);
});
test("provider 402, role loss and other errors are visible, sanitized and never retried or mocked as success", async () => {
  for (const status of [402, 403, 503, 429, 504]) {
    await ask(); await act(async () => state().pending.at(-1).reject({ status, message: "PRIVATE_PROVIDER_CANARY" }));
    assert.doesNotMatch(output(), /PRIVATE_PROVIDER_CANARY|Draf Claude melalui Hermes/);
    assert.equal(control("hermes-chat-consent").props.checked, false);
    if (status === 402) assert.match(output(), /status 402/);
  }
  assert.equal(state().calls.length, 5);
});
test("periodic role checks hide without cancelling a paid request; denial clears and aborts", async () => {
  await ask(); await render("checking");
  assert.equal(state().calls[0].options.signal.aborted, false);
  await act(async () => state().pending[0].resolve(result));
  assert.doesNotMatch(output(), /Draf Claude melalui Hermes/);
  await render("allowed"); assert.match(output(), /Draf Claude melalui Hermes/);
  assert.equal(state().calls.length, 1);
  await ask(); await render("denied");
  assert.equal(state().calls[1].options.signal.aborted, true);
  await act(async () => state().pending[1].resolve(result));
  await render("allowed"); assert.doesNotMatch(output(), /Draf Claude melalui Hermes/);
});
test("cancel, account switch and logout abort and suppress late answers without repeating requests", async () => {
  await ask(); await act(async () => control("hermes-chat-cancel").props.onClick());
  assert.equal(state().calls[0].options.signal.aborted, true);
  await act(async () => state().pending[0].resolve(result));
  assert.doesNotMatch(output(), /Draf Claude melalui Hermes/); assert.match(output(), /Biaya provider mungkin tetap/);
  await ask(); state().user = { id: "other-user" }; await render();
  assert.equal(state().calls[1].options.signal.aborted, true);
  await act(async () => state().pending[1].resolve(result));
  assert.doesNotMatch(output(), /Draf Claude melalui Hermes/);
  assert.equal(control("hermes-chat-question").props.value, "");
  state().user = null; await render();
  assert.equal(control("hermes-chat-send").props.disabled, true);
  assert.equal(state().calls.length, 2);
});
test("malformed runtime/model/source responses cannot be shown as successful Claude answers", async () => {
  for (const bad of [{ ...result, runtime: "simulation" }, { ...result, model: "openai/gpt-test" },
    { ...result, sources: [] }, { ...result, sources: [{ ...result.sources[0], page: 22 }] }]) {
    await ask(); await act(async () => state().pending.at(-1).resolve(bad));
    assert.doesNotMatch(output(), /Draf Claude melalui Hermes/);
    assert.match(output(), /belum berhasil/);
  }
  await ask();
  await act(async () => state().pending.at(-1).resolve({ ...result, answer: "Tidak cukup rujukan.", insufficientEvidence: true, sources: [] }));
  assert.match(output(), /Bukti rujukan belum cukup/);
});
