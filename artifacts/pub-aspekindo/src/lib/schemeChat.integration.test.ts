import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createServer, type ViteDevServer } from "vite";
import { fileURLToPath } from "node:url";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let vite: ViteDevServer, Controls: any, helpers: any, root: ReactTestRenderer | undefined;
test.before(async () => {
  vite = await createServer({ configFile: false, root: fileURLToPath(new URL("../..", import.meta.url)),
    cacheDir: "node_modules/.vite-scheme-chat-tests",
    esbuild: { jsx: "automatic" }, resolve: { alias: { "@": fileURLToPath(new URL("..", import.meta.url)) } },
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: "custom" });
  ({ default: Controls } = await vite.ssrLoadModule("/src/components/chatbot/SchemeChatControls.tsx"));
  helpers = await vite.ssrLoadModule("/src/lib/schemeChat.ts");
});
test.afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; });
test.after(async () => { await vite.close(); });

test("77 profiles, independent role/depth and four shortcuts are controlled and show citations", async () => {
  const changes: any[] = [], asked: string[] = [];
  function Harness() {
    const [value, set] = React.useState<any>();
    return React.createElement(Controls, { value, disabled: false,
      onChange: (next: any) => { changes.push(next); set(next); }, onAsk: (text: string) => asked.push(text) });
  }
  await act(async () => { root = create(React.createElement(Harness)); });
  assert.equal(root!.root.findAllByType("optgroup").length, 8);
  assert.equal(root!.root.findAllByType("option").filter(o => /^[A-Z]{2}\d{3}$/.test(o.props.value)).length, 77);
  assert.equal(root!.root.findAllByType("select")[1].props.disabled, true);
  await act(async () => root!.root.findAllByType("select")[0].props.onChange({ target: { value: "BG001" } }));
  assert.deepEqual(changes.at(-1), { scheme_code: "BG001", audience: "bujk", explanation_depth: "praktis" });
  await act(async () => root!.root.findAllByType("select")[1].props.onChange({ target: { value: "asesor" } }));
  await act(async () => root!.root.findAllByType("select")[2].props.onChange({ target: { value: "dasar" } }));
  assert.deepEqual(changes.at(-1), { scheme_code: "BG001", audience: "asesor", explanation_depth: "dasar" });
  assert.match(JSON.stringify(root!.toJSON()), /KB09, halaman PDF 21/);
  assert.match(JSON.stringify(root!.toJSON()), /bukan hak akses/);
  assert.equal(root!.root.findAllByType("button").length, 4);
  await act(async () => root!.root.findAllByType("button")[0].props.onClick());
  assert.equal(asked[0], helpers.SCHEME_ACTIONS[0]);
  await act(async () => root!.root.findAllByType("select")[0].props.onChange({ target: { value: "" } }));
  assert.equal(changes.at(-1), undefined);
  assert.equal(root!.root.findAllByType("button").length, 0);
});

test("pending requests disable every profile control and shortcut", async () => {
  await act(async () => { root = create(React.createElement(Controls, {
    value: { scheme_code: "IN014", audience: "lsbu", explanation_depth: "rinci" }, disabled: true,
    onChange: () => {}, onAsk: () => {},
  })); });
  assert.ok(root!.root.findAllByType("select").every(select => select.props.disabled));
  assert.ok(root!.root.findAllByType("button").every(button => button.props.disabled));
  assert.match(JSON.stringify(root!.toJSON()), /tidak terdapat dalam tabel salinan/);
});

test("profiles round-trip through persisted conversation titles and reject unsupported history", () => {
  for (const row of helpers.SCHEME_CATALOG) {
    const profile = { scheme_code: row.code, audience: "peninjau", explanation_depth: "rinci" };
    const title = helpers.profileTitle(profile) + "[claude] Pertanyaan";
    assert.deepEqual(helpers.restoreProfile(title), profile);
    assert.equal(helpers.visibleConversationTitle(title), "[claude] Pertanyaan");
  }
  assert.equal(helpers.restoreProfile("[gpt] Percakapan lama"), undefined);
  for (const title of ["[skema-v1:ZZ999:bujk:praktis] x", "[skema-v1:BG001:admin:rinci] x", "[skema-v2:BG001:bujk:praktis] x"]) {
    assert.throws(() => helpers.restoreProfile(title), /Profil riwayat tidak tersedia/);
  }
});
