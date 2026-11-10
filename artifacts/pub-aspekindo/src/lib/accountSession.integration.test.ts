import { test } from "node:test";
import assert from "node:assert/strict";
import React, { useState } from "react";
import { create, act, type ReactTestRenderer } from "react-test-renderer";
import { QueryClient, useQueryClient } from "@tanstack/react-query";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";
import { createServer, type ViteDevServer } from "vite";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

let server: ViteDevServer;
let modules: any;
let root: ReactTestRenderer | undefined;
const fakeSupabase: any = {};
const globals = ["IS_REACT_ACT_ENVIRONMENT", "__accountTestSupabase", "window", "document", "localStorage"];
const originalGlobals = new Map(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const originalEnv = { PORT: process.env.PORT, BASE_PATH: process.env.BASE_PATH };
const intervals = new Map<number, () => void>();
const focusListeners = new Set<() => void>();
let nextTimer = 0;
const fakeDocument = { visibilityState: "visible" };

test.before(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as any).__accountTestSupabase = fakeSupabase;
  (globalThis as any).window = {
    addEventListener(type: string, callback: () => void) {
      if (type === "focus") focusListeners.add(callback);
    },
    removeEventListener(type: string, callback: () => void) {
      if (type === "focus") focusListeners.delete(callback);
    },
    // No real recurring timers: tests explicitly trigger the production callback.
    setInterval(callback: () => void) {
      const id = ++nextTimer;
      intervals.set(id, callback);
      return id;
    },
    clearInterval(id: number) { intervals.delete(id); },
  };
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: { length: 0, key: () => null, getItem: () => null, removeItem: () => undefined },
  });
  process.env.PORT ||= "4173";
  process.env.BASE_PATH ||= "/";
  server = await createServer({
    configFile: new URL("../../vite.config.ts", import.meta.url).pathname,
    cacheDir: "node_modules/.vite-account-session-tests",
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [{
      name: "account-tests-fake-supabase",
      enforce: "pre",
      resolveId(id) {
        if (/\/integrations\/supabase\/client(?:\.ts)?$/.test(id)) return "\0account-test-supabase";
        return undefined;
      },
      load(id) {
        return id === "\0account-test-supabase"
          ? "export const supabase = globalThis.__accountTestSupabase;" : undefined;
      },
    }],
    server: { middlewareMode: true }, appType: "custom",
  });
  const [auth, provider, boundary] = await Promise.all([
    server.ssrLoadModule("/src/hooks/useAuth.tsx"),
    server.ssrLoadModule("/src/hooks/auth-provider.tsx"),
    server.ssrLoadModule("/src/components/AccountQueryProvider.tsx"),
  ]);
  modules = { ...auth, ...provider, AccountQueryProvider: boundary.default };
});

// Install after SSR imports: browser-only style injection must not run in Node.
test.beforeEach(() => {
  (globalThis as any).document = fakeDocument;
});

test.afterEach(async () => {
  try {
    if (root) await act(async () => { root!.unmount(); });
    assert.equal(intervals.size, 0, "AuthProvider must clear its refresh timer");
    assert.equal(focusListeners.size, 0, "AuthProvider must remove its focus listener");
  } finally {
    root = undefined;
    intervals.clear();
    focusListeners.clear();
    fakeDocument.visibilityState = "visible";
  }
});

test.after(async () => {
  try {
    await server?.close();
  } finally {
    for (const [key, descriptor] of originalGlobals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test("pergantian akun mengganti cache/state halaman, membatalkan query lama, dan mempertahankan router", async () => {
  const seen: { client?: QueryClient; draft?: string; path?: string; setDraft?: (value: string) => void; navigate?: (path: string) => void } = {};
  function Probe() {
    seen.client = useQueryClient();
    const [draft, setDraft] = useState("");
    seen.draft = draft;
    seen.setDraft = setDraft;
    seen.path = useLocation().pathname;
    seen.navigate = useNavigate();
    return React.createElement("span", null, draft);
  }
  function tree(id: string | null) {
    return React.createElement(modules.AuthContext.Provider, { value: { user: id ? { id } : null } },
      React.createElement(MemoryRouter, null,
        React.createElement(modules.AccountQueryProvider, null, React.createElement(Probe))));
  }
  await act(async () => { root = create(tree("member-a")); });
  const clientA = seen.client!;
  const oldNavigate = seen.navigate!;
  clientA.setQueryData(["unscoped-private-data"], { owner: "member-a" });
  const pending = deferred<{ owner: string }>();
  const oldQuery = clientA.fetchQuery({ queryKey: ["late-query"], queryFn: () => pending.promise }).catch(() => undefined);
  await act(async () => { seen.setDraft!("draft akun A"); });
  await act(async () => { root!.update(tree("member-b")); });
  const clientB = seen.client!;
  assert.notEqual(clientA, clientB);
  assert.equal(clientB.getQueryData(["unscoped-private-data"]), undefined);
  assert.equal(seen.draft, "");
  assert.equal(clientA.getQueryCache().getAll().length, 0);
  pending.resolve({ owner: "member-a" });
  await act(async () => { await oldQuery; });
  assert.equal(clientB.getQueryData(["late-query"]), undefined);
  assert.equal(clientA.getQueryData(["late-query"]), undefined);
  await act(async () => { oldNavigate("/profile"); });
  assert.equal(seen.path, "/profile");
  await act(async () => { root!.update(tree(null)); });
  assert.notEqual(seen.client, clientB);
  assert.equal(seen.client!.getQueryCache().getAll().length, 0);
});

test("pembaruan token dengan identitas sama tidak menghapus cache atau draf yang sedang dikerjakan", async () => {
  let client!: QueryClient;
  let setDraft!: (value: string) => void;
  let draft = "";
  function Probe() {
    client = useQueryClient();
    [draft, setDraft] = useState("");
    return null;
  }
  const tree = () => React.createElement(modules.AuthContext.Provider, { value: { user: { id: "member-a" } } },
    React.createElement(modules.AccountQueryProvider, null, React.createElement(Probe)));
  await act(async () => { root = create(tree()); });
  const original = client;
  client.setQueryData(["private"], "akun A");
  await act(async () => { setDraft("belum disimpan"); root!.update(tree()); });
  assert.equal(client, original);
  assert.equal(client.getQueryData(["private"]), "akun A");
  assert.equal(draft, "belum disimpan");
});

test("profil dan sesi awal yang terlambat tidak menimpa akun yang baru masuk", async () => {
  const restore = deferred<any>();
  const profiles = new Map<string, ReturnType<typeof deferred<any>>>();
  let listener!: (event: string, session: any) => Promise<void>;
  fakeSupabase.auth = {
    onAuthStateChange(callback: typeof listener) {
      listener = callback;
      return { data: { subscription: { unsubscribe() {} } } };
    },
    getSession: () => restore.promise,
  };
  fakeSupabase.from = () => {
    let id = "";
    const query: any = {
      select: () => query,
      eq: (_field: string, value: string) => { id = value; return query; },
      single: () => {
        const result = deferred<any>();
        profiles.set(id, result);
        return result.promise;
      },
    };
    return query;
  };
  let observed: any;
  function Probe() { observed = modules.useAuth(); return null; }
  await act(async () => { root = create(React.createElement(modules.AuthProvider, null, React.createElement(Probe))); });
  const session = (id: string) => ({ user: { id } });
  const tick = () => new Promise((resolve) => setTimeout(resolve, 0));
  await act(async () => { await listener("SIGNED_IN", session("member-a")); await tick(); });
  await act(async () => { await listener("SIGNED_IN", session("member-b")); await tick(); });
  assert.ok(profiles.has("member-a"));
  assert.ok(profiles.has("member-b"));
  await act(async () => { profiles.get("member-b")!.resolve({ data: { full_name: "Profil B" } }); });
  await act(async () => {
    profiles.get("member-a")!.resolve({ data: { full_name: "Profil A" } });
    restore.resolve({ data: { session: session("member-a") } });
  });
  assert.equal(observed.user.id, "member-b");
  assert.equal(observed.profile.full_name, "Profil B");
  await act(async () => { await listener("SIGNED_OUT", null); });
  assert.equal(observed.user, null);
  assert.equal(observed.profile, null);
  // A queued profile request must not start after logout.
  profiles.clear();
  await act(async () => {
    await listener("SIGNED_IN", session("member-a"));
    await listener("SIGNED_OUT", null);
    await tick();
  });
  assert.equal(profiles.size, 0);
});

test("logout gagal mempertahankan sesi dan bisa diulang setelah error layanan maupun jaringan", async () => {
  const session = { user: { id: "member-logout" } };
  let listener!: (event: string, session: any) => Promise<void>;
  let authError: Error | null = new Error("logout unavailable");
  let signOutCalls = 0;
  fakeSupabase.auth = {
    onAuthStateChange(callback: typeof listener) {
      listener = callback;
      return { data: { subscription: { unsubscribe() {} } } };
    },
    getSession: async () => ({ data: { session } }),
    signOut: async () => {
      signOutCalls += 1;
      if (!authError) await listener("SIGNED_OUT", null);
      return { error: authError };
    },
  };
  fakeSupabase.from = () => {
    const query: any = { select: () => query, eq: () => query, single: async () => ({ data: null }) };
    return query;
  };
  const originalFetch = globalThis.fetch;
  let response: "ok" | "error" | "network" = "ok";
  globalThis.fetch = (async () => {
    if (response === "network") throw new TypeError("Failed to fetch");
    return { ok: response === "ok" };
  }) as typeof fetch;
  let observed: any;
  function Probe() { observed = modules.useAuth(); return null; }
  try {
    await act(async () => { root = create(React.createElement(modules.AuthProvider, null, React.createElement(Probe))); });
    await act(async () => { await assert.rejects(observed.signOut(), /logout unavailable/); });
    assert.equal(observed.session, session);
    assert.equal(observed.user.id, "member-logout");
    response = "error";
    await act(async () => { await assert.rejects(observed.signOut(), /belum dapat ditutup/); });
    response = "network";
    await act(async () => { await assert.rejects(observed.signOut(), /Failed to fetch/); });
    assert.equal(observed.session, session);
    assert.equal(signOutCalls, 1);
    response = "ok";
    authError = null;
    await act(async () => { await observed.signOut(); });
    assert.equal(observed.user, null);
    assert.equal(observed.session, null);
    assert.equal(observed.profile, null);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("refresh profil memakai timer dan fokus hanya saat dokumen terlihat, lalu dibersihkan saat unmount", async () => {
  let profileRequests = 0;
  fakeSupabase.auth = {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    getSession: async () => ({ data: { session: { user: { id: "member-refresh" } } } }),
  };
  fakeSupabase.from = () => {
    const query: any = {
      select: () => query,
      eq: () => query,
      single: async () => { profileRequests += 1; return { data: null }; },
    };
    return query;
  };
  await act(async () => { root = create(React.createElement(modules.AuthProvider, null, null)); });
  assert.equal(profileRequests, 1);
  assert.equal(intervals.size, 1);
  assert.equal(focusListeners.size, 1);
  const refreshTimer = [...intervals.values()][0];
  const focus = [...focusListeners][0];
  fakeDocument.visibilityState = "hidden";
  await act(async () => { refreshTimer(); focus(); });
  assert.equal(profileRequests, 1);
  fakeDocument.visibilityState = "visible";
  await act(async () => { refreshTimer(); });
  await act(async () => { focus(); });
  assert.equal(profileRequests, 3);
});

test("timeout SDK menahan login baru lintas remount hingga permintaan lama selesai", async (t) => {
  const sdk = deferred<any>();
  let calls = 0;
  let loginCalls = 0;
  fakeSupabase.auth = {
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    getSession: async () => ({ data: { session: null } }),
    signOut: () => { calls++; return sdk.promise; },
    signInWithPassword: async () => { loginCalls++; return { data: { session: null }, error: null }; },
    signUp: async () => { loginCalls++; return { data: { session: null }, error: null }; },
  };
  const originalFetch = globalThis.fetch;
  let deletes = 0;
  globalThis.fetch = (async () => { deletes++; return { ok: true }; }) as typeof fetch;
  let observed: any;
  function Probe() { observed = modules.useAuth(); return null; }
  try {
    await act(async () => { root = create(React.createElement(modules.AuthProvider, null, React.createElement(Probe))); });
    t.mock.timers.enable({ apis: ["setTimeout"] });
    const first = assert.rejects(observed.signOut(), /Status sesi belum dapat dipastikan/);
    await act(async () => { await Promise.resolve(); });
    assert.equal(calls, 1, "SDK must have started before its deadline is advanced");
    await act(async () => { t.mock.timers.tick(10_000); await first; });
    await act(async () => { root!.unmount(); });
    await act(async () => { root = create(React.createElement(modules.AuthProvider, null, React.createElement(Probe))); });
    assert.match((await observed.signIn("a@example.test", "password")).error.message, /sebelumnya belum selesai/);
    assert.match((await observed.signUp("a@example.test", "password", "A")).error.message, /sebelumnya belum selesai/);
    assert.equal(loginCalls, 0);
    const retry = observed.signOut();
    await act(async () => { sdk.resolve({ error: null }); await retry; });
    assert.equal(calls, 1);
    assert.equal(deletes, 1);
    assert.equal((await observed.signIn("a@example.test", "password")).error, null);
    assert.equal(loginCalls, 1);
  } finally {
    sdk.resolve({ error: null });
    globalThis.fetch = originalFetch;
  }
});
