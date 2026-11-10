import test from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createServer, type ViteDevServer } from "vite";
import { fileURLToPath } from "node:url";
import type { SchemeReferenceBank } from "@workspace/api-client-react";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
let vite: ViteDevServer, View: any, useBank: any, root: ReactTestRenderer | undefined, snapshot: any;
const bank: SchemeReferenceBank = {
  status: "draft_reference_answers", usedForAiReplies: false, scope: "Draf untuk uji tampilan",
  reviewGuidance: "Periksa sumber; jangan mewajibkan kecocokan kalimat persis.",
  counts: { profiles: 2, cases: 13, evidence: 3 },
  profiles: [{ code: "BG001", family: "BG", title: "Skema BG" }, { code: "IN014", family: "IN", title: "Skema IN" }],
  cases: Array.from({ length: 13 }, (_, i) => ({
    id: `case-${i}`, kind: i === 0 ? "application_policy" : "reference",
    code: i === 12 ? "IN014" : "BG001", family: i === 12 ? "IN" : "BG",
    category: i === 0 ? "Kebijakan" : "Pemetaan", appliesTo: [i === 12 ? "IN014" : "BG001"],
    question: `Pertanyaan ${i}`, answer: i === 2 ? "<script>untrusted source</script>" : `Jawaban ${i}`,
    requiredPoints: ["Baca sumber"], clarificationQuestions: ["Kualifikasi yang dimaksud?"],
    forbiddenClaims: ["Tidak boleh mengklaim kelulusan"], evidenceIds: [i === 0 ? "policy" : i === 1 ? "text" : "pdf"],
  })),
  evidence: {
    pdf: { id: "KB09", kind: "pdf", title: "Dokumen skema", page: 21, quote: "Kutipan asli PDF" },
    text: { id: "KB45", kind: "text", title: "Salinan", lineStart: 24, lineEnd: 24, quote: "Kutipan baris" },
    policy: { id: "POLICY", kind: "application_policy", title: "Aturan aplikasi", quote: "Bukan ketentuan sertifikasi" },
  },
};
const state = () => (globalThis as any).__referenceHook;
const node = (id: string) => root!.root.findByProps({ "data-testid": id });
const output = () => JSON.stringify(root!.toJSON());
const Harness = (_props: { tick?: number }) => { snapshot = useBank(); return null; };
test.before(async () => {
  vite = await createServer({
    cacheDir: "node_modules/.vite-scheme-references-tests",
    configFile: false, root: fileURLToPath(new URL("../..", import.meta.url)),
    esbuild: { jsx: "automatic" }, resolve: { alias: { "@": fileURLToPath(new URL("..", import.meta.url)) } },
    optimizeDeps: { noDiscovery: true, include: [] }, server: { middlewareMode: true }, appType: "custom",
    plugins: [{ name: "reference-session-test", enforce: "pre",
      resolveId(id) {
        if (id.includes("/hooks/useAuth")) return "\0reference-auth";
        if (id.includes("/integrations/supabase/client")) return "\0reference-session";
        if (id === "@workspace/api-client-react") return "\0reference-api";
      },
      load(id) {
        if (id === "\0reference-auth") return "export const useAuth=()=>({user:globalThis.__referenceHook.user});";
        if (id === "\0reference-session") return "export const supabase={auth:{getSession:async()=>({data:{session:globalThis.__referenceHook.session},error:null})}};";
        if (id === "\0reference-api") return "export const getSchemeReferences=options=>{const s=globalThis.__referenceHook;s.calls.push(options);return new Promise((resolve,reject)=>s.pending.push({resolve,reject}));};";
      },
    }],
  });
  ({ default: View } = await vite.ssrLoadModule("/src/components/chatbot/SchemeReferenceView.tsx"));
  ({ useSchemeReferenceBank: useBank } = await vite.ssrLoadModule("/src/hooks/useSchemeReferenceBank.ts"));
});
test.beforeEach(() => {
  (globalThis as any).__referenceHook = { user: { id: "member-one" },
    session: { user: { id: "member-one" }, access_token: "synthetic-session-not-production" }, calls: [], pending: [] };
});
test.afterEach(async () => { if (root) await act(async () => root!.unmount()); root = undefined; });
test.after(async () => { await vite.close(); delete (globalThis as any).__referenceHook; });

test("reference viewer renders drafts and literal evidence with correct PDF/text/policy labels", async () => {
  await act(async () => { root = create(React.createElement(View, { bank, loading: false, error: null, onRetry() {} })); });
  assert.equal(root!.root.findAllByType("article").length, 10);
  assert.match(output(), /bukan keputusan sertifikasi/);
  assert.match(output(), /PDF, halaman 21/);
  assert.match(output(), /Teks, baris 24/);
  assert.match(output(), /bukan sumber hukum/);
  assert.ok(root!.root.findAllByType("p").some(p => p.children.includes("<script>untrusted source</script>")));
  assert.equal(root!.root.findAllByType("script").length, 0);
});
test("filters, search, pagination and reset work independently of chat or AI calls", async () => {
  await act(async () => { root = create(React.createElement(View, { bank, loading: false, error: null, onRetry() {} })); });
  await act(async () => node("button-reference-next").props.onClick());
  assert.equal(root!.root.findAllByType("article").length, 3);
  await act(async () => node("select-reference-profile").props.onChange({ target: { value: "IN014" } }));
  assert.equal(root!.root.findAllByType("article").length, 1);
  assert.match(output(), /Pertanyaan 12/);
  await act(async () => node("input-reference-search").props.onChange({ target: { value: "tidak-ada-kasus" } }));
  assert.equal(root!.root.findAllByType("article").length, 0);
  await act(async () => node("button-reset-reference").props.onClick());
  assert.equal(root!.root.findAllByType("article").length, 10);
  await act(async () => node("select-reference-category").props.onChange({ target: { value: "Kebijakan" } }));
  assert.equal(root!.root.findAllByType("article").length, 1);
  assert.equal(state().calls.length, 0);
});
test("loading, sanitized errors/retry and missing citations are visible", async () => {
  let retries = 0;
  await act(async () => { root = create(React.createElement(View, { bank: null, loading: true, error: null, onRetry() {} })); });
  assert.ok(root!.root.findByProps({ "aria-busy": "true" }));
  await act(async () => root!.update(React.createElement(View, { bank: null, loading: false, error: "private-canary", onRetry() { retries++; } })));
  assert.doesNotMatch(output(), /private-canary/);
  await act(async () => node("button-retry-reference").props.onClick());
  assert.equal(retries, 1);
  const broken = structuredClone(bank);
  delete broken.evidence.policy;
  await act(async () => root!.update(React.createElement(View, { bank: broken, loading: false, error: null, onRetry() {} })));
  assert.match(output(), /rujukan rusak/);
  assert.match(output(), /tidak ditemukan dalam bank bukti/);
});
test("loader sends only authenticated GET options and exposes real data after completion", async () => {
  await act(async () => { root = create(React.createElement(Harness)); });
  assert.equal(snapshot.loading, true);
  assert.equal(snapshot.bank, null);
  assert.equal(state().calls[0].headers.Authorization, "Bearer synthetic-session-not-production");
  assert.equal(state().calls[0].cache, "no-store");
  await act(async () => state().pending[0].resolve(bank));
  assert.equal(snapshot.bank.cases.length, 13);
  assert.equal(snapshot.bank.usedForAiReplies, false);
  assert.equal(snapshot.loading, false);
});
test("logout/account switches abort reads and cannot display late responses from the previous session", async () => {
  await act(async () => { root = create(React.createElement(Harness)); });
  const first = state().pending[0], firstSignal = state().calls[0].signal;
  state().user = { id: "member-two" };
  state().session = { user: state().user, access_token: "synthetic-second-session" };
  await act(async () => root!.update(React.createElement(Harness, { tick: 1 })));
  assert.equal(firstSignal.aborted, true);
  await act(async () => first.resolve(bank));
  assert.equal(snapshot.bank, null);
  assert.equal(snapshot.loading, true);
  await act(async () => state().pending[1].resolve(bank));
  assert.ok(snapshot.bank);
  state().user = null; state().session = null;
  await act(async () => root!.update(React.createElement(Harness, { tick: 2 })));
  assert.equal(snapshot.bank, null);
  assert.equal(snapshot.error, null);
  assert.equal(state().calls[1].signal.aborted, true);
});
test("failed reads allow explicit retry; mismatched sessions never issue a request", async () => {
  await act(async () => { root = create(React.createElement(Harness)); });
  await act(async () => state().pending[0].reject(new Error("private-failure-canary")));
  assert.equal(snapshot.bank, null);
  assert.doesNotMatch(snapshot.error, /private-failure-canary/);
  await act(async () => snapshot.onRetry());
  assert.equal(state().calls.length, 2);
  await act(async () => state().pending[1].resolve(bank));
  assert.ok(snapshot.bank);
  state().user = { id: "wrong-account" };
  await act(async () => root!.update(React.createElement(Harness, { tick: 3 })));
  assert.equal(state().calls.length, 2);
  assert.equal(snapshot.bank, null);
  assert.ok(snapshot.error);
});
