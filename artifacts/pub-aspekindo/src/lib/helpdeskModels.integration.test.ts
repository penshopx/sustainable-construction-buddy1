import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { createServer, type ViteDevServer } from "vite";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const MEMBER = { id: "11111111-1111-4111-8111-111111111111" };
let server: ViteDevServer;
let useChat: (...args: any[]) => any;
let root: ReactTestRenderer | undefined;
let chat: any;
let dbCalls: any[] = [];
let requests: any[] = [];
let notices: any[] = [];
let history: any[] = [];
let saveFailure = "";
let responder: (body: any) => Promise<Response>;
const originalFetch = globalThis.fetch;

function table(name: string) {
  let action = "select";
  let value: any;
  const filters: any[] = [];
  const query: any = {
    select: () => query,
    insert: (row: any) => { action = "insert"; value = row; return query; },
    update: (row: any) => { action = "update"; value = row; return query; },
    delete: () => { action = "delete"; return query; },
    eq: (key: string, expected: string) => { filters.push([key, expected]); return query; },
    order: () => query,
    single: () => query,
    then: (resolve: any, reject: any) => {
      dbCalls.push({ name, action, value, filters });
      const error = name === "helpdesk_messages" && action === "insert" && value?.role === saveFailure
        ? { message: "PRIVATE_DATABASE_DETAIL" } : null;
      const data = action === "insert" && name === "helpdesk_conversations"
        ? { id: "fixture-conversation" }
        : action === "select" ? name === "helpdesk_messages" ? history : [] : null;
      return Promise.resolve({ data, error }).then(resolve, reject);
    },
  };
  return query;
}

test.before(async () => {
  (globalThis as any).__modelsAuth = { user: MEMBER };
  (globalThis as any).__modelsSupabase = {
    from: table,
    auth: { getSession: async () => ({ data: { session: {
      user: MEMBER, access_token: "synthetic-member-token-not-a-real-key",
    } }, error: null }) },
  };
  (globalThis as any).__modelsNotify = (notice: any) => notices.push(notice);
  server = await createServer({
    cacheDir: "node_modules/.vite-helpdesk-models-tests",
    configFile: false,
    root: fileURLToPath(new URL("../..", import.meta.url)),
    resolve: { alias: { "@": fileURLToPath(new URL("..", import.meta.url)) } },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [{
      name: "isolated-helpdesk-models",
      enforce: "pre",
      resolveId(id) {
        if (/(?:integrations\/supabase\/client)$/.test(id)) return "\0models-supabase";
        if (/(?:hooks\/useAuth)$/.test(id)) return "\0models-auth";
        if (/(?:hooks\/use-toast)$/.test(id)) return "\0models-toast";
        return undefined;
      },
      load(id) {
        if (id === "\0models-supabase") return "export const supabase = globalThis.__modelsSupabase;";
        if (id === "\0models-auth") return "export const useAuth = () => globalThis.__modelsAuth;";
        if (id === "\0models-toast") return "export const toast = value => globalThis.__modelsNotify(value);";
        return undefined;
      },
    }],
    server: { middlewareMode: true }, appType: "custom",
  });
  ({ useHelpdeskChat: useChat } = await server.ssrLoadModule("/src/hooks/useHelpdeskChat.ts"));
});

test.beforeEach(() => {
  dbCalls = []; requests = []; notices = []; history = []; saveFailure = "";
  responder = async body => Response.json({ reply: "Jawaban uji", engine: body.engine, model: `fixture/${body.engine}` });
  globalThis.fetch = (async (url: any, init: any) => {
    assert.equal(String(url), "/api/helpdesk");
    const body = JSON.parse(init.body);
    requests.push({ body, init });
    return responder(body);
  }) as typeof fetch;
});

test.afterEach(async () => {
  if (root) await act(async () => root!.unmount());
  root = undefined;
  globalThis.fetch = originalFetch;
});

test.after(async () => {
  await server.close();
  delete (globalThis as any).__modelsAuth;
  delete (globalThis as any).__modelsSupabase;
  delete (globalThis as any).__modelsNotify;
});

function Probe({ engine = "claude" }: { engine?: string }) {
  chat = useChat("proyek", undefined, undefined, engine);
  return React.createElement("span", null, chat.messages.map((message: any) => message.content).join("|"));
}

async function mount(engine = "claude") {
  await act(async () => { root = create(React.createElement(Probe, { engine })); });
}

test("Claude default mengirim token pengguna, menerima metadata, dan menyimpan jawaban", async () => {
  await mount();
  await act(async () => { await chat.sendMessage("Analisis proyek uji"); });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.engine, "claude");
  assert.equal(requests[0].body.mode, "proyek");
  assert.equal(new Headers(requests[0].init.headers).get("authorization"), "Bearer synthetic-member-token-not-a-real-key");
  assert.equal(chat.lastModel, "fixture/claude");
  assert.equal(chat.messages.at(-1).content, "Jawaban uji");
  assert.equal(chat.isLoading, false);
  const writes = dbCalls.filter(call => call.action === "insert" && call.name === "helpdesk_messages");
  assert.deepEqual(writes.map(call => call.value.role), ["user", "assistant"]);
  assert.ok(writes.every(call => call.value.user_id === MEMBER.id));
});

test("kegagalan kuota tampil dan tidak memicu retry, fallback, atau penyimpanan jawaban palsu", async () => {
  responder = async () => Response.json({ error: "Kuota AI akun tercapai." }, { status: 429 });
  await mount("nvidia");
  await act(async () => { await chat.sendMessage("Pertanyaan uji"); });
  assert.equal(requests.length, 1);
  assert.equal(requests[0].body.engine, "nvidia");
  assert.equal(chat.isLoading, false);
  assert.match(notices.at(-1).description, /Kuota AI/);
  assert.ok(!dbCalls.some(call => call.value?.role === "assistant"));
});

test("riwayat lama dapat dibaca tetapi tidak otomatis dikirim ke model terpilih", async () => {
  history = [{ role: "user", content: "PRIVATE_OLD_CONTEXT" }, { role: "assistant", content: "PRIVATE_OLD_REPLY" }];
  await mount("gemini");
  await act(async () => { await chat.selectConversation("previous-conversation"); });
  assert.equal(chat.messages.length, 2);
  await act(async () => { await chat.sendMessage("Pertanyaan baru"); });
  assert.deepEqual(requests[0].body.messages, [{ role: "user", content: "Pertanyaan baru" }]);
  assert.doesNotMatch(JSON.stringify(requests[0].body), /PRIVATE_OLD/);
});

test("percakapan baru saat ganti model tidak membawa konteks model sebelumnya", async () => {
  await mount("claude");
  await act(async () => { await chat.sendMessage("Konteks khusus Claude"); });
  await act(async () => {
    chat.startNewConversation();
    root!.update(React.createElement(Probe, { engine: "deepseek" }));
  });
  assert.equal(chat.messages.length, 0);
  await act(async () => { await chat.sendMessage("Pesan DeepSeek baru"); });
  assert.equal(requests[1].body.engine, "deepseek");
  assert.deepEqual(requests[1].body.messages, [{ role: "user", content: "Pesan DeepSeek baru" }]);
});

test("jawaban terlambat setelah percakapan dibatalkan tidak mengisi sesi baru", async () => {
  let resolve!: (response: Response) => void;
  responder = () => new Promise<Response>(done => { resolve = done; });
  await mount();
  let pending!: Promise<void>;
  await act(async () => { pending = chat.sendMessage("Permintaan tertunda"); });
  assert.equal(requests.length, 1);
  await act(async () => { chat.startNewConversation(); });
  assert.equal(requests[0].init.signal.aborted, true);
  await act(async () => { resolve(Response.json({ reply: "Jawaban lama", engine: "claude" })); await pending; });
  assert.deepEqual(chat.messages, []);
  assert.ok(!dbCalls.some(call => call.value?.role === "assistant"));
});

test("gagal menyimpan jawaban tetap mempertahankan jawaban dan memberi peringatan", async () => {
  saveFailure = "assistant";
  await mount();
  await act(async () => { await chat.sendMessage("Pertanyaan uji"); });
  assert.equal(chat.messages.at(-1).content, "Jawaban uji");
  assert.match(notices.at(-1).description, /belum tersimpan/);
  assert.doesNotMatch(JSON.stringify(notices), /PRIVATE_DATABASE_DETAIL/);
});

test("gagal menyimpan pesan pengguna menghentikan permintaan AI", async () => {
  saveFailure = "user";
  await mount();
  await act(async () => { await chat.sendMessage("Pertanyaan uji"); });
  assert.equal(requests.length, 0);
  assert.match(notices.at(-1).description, /Jawaban AI belum diminta/);
});
