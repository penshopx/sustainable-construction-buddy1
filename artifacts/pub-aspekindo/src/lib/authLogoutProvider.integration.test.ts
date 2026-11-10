import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { MemoryRouter, useLocation } from "react-router-dom";
import { createServer, type ViteDevServer } from "vite";
import type { AuthContextType } from "../hooks/useAuth";

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((yes) => { resolve = yes; });
  return { promise, resolve };
}

let server: ViteDevServer;
let modules: any;
let root: ReactTestRenderer | undefined;
let observed: AuthContextType;
let path = "";
let fixture: ReturnType<typeof transport>;
const fakeSupabase: any = {};
const renders: { path: string; user: string | null; session: string | null; profile: string | null }[] = [];
const globals = ["IS_REACT_ACT_ENVIRONMENT", "__logoutProviderSupabase", "window", "document", "localStorage", "fetch"];
const originalGlobals = new Map(globals.map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
const originalEnv = { PORT: process.env.PORT, BASE_PATH: process.env.BASE_PATH };
const intervals = new Set<number>();
const listeners = new Map<string, Set<unknown>>();
let timerId = 0;

// Only the service boundary is controlled. Auth, AuthProvider, useAuth,
// createLogoutRequest, draft cleanup, and the router all run their real code.
function transport() {
  const initialSession = { user: { id: "member-a" }, access_token: "fixture-token-a" };
  const newSession = { user: { id: "member-b" }, access_token: "fixture-token-b" };
  const restore = deferred<any>();
  const sdk = deferred<any>();
  let currentSession: any = initialSession;
  let listener: ((event: string, session: any) => Promise<void>) | undefined;
  let deleteMode: "ok" | "service" | "network" = "ok";
  let sdkMode: "success" | "error" | "pending" = "success";
  const deletes: RequestInit[] = [];
  const sdkCalls: string[] = [];
  const loginCalls: string[] = [];
  const events: string[] = [];
  const storage = new Map<string, string>([["pub_assessment_draft_v1:member-a", "private draft"]]);
  const emit = async (event: string, session: any) => {
    currentSession = session;
    events.push(event);
    await listener?.(event, session);
  };
  fakeSupabase.auth = {
    onAuthStateChange(callback: typeof listener) {
      assert.equal(listener, undefined, "only one provider subscription may be active");
      listener = callback;
      return { data: { subscription: { unsubscribe() { listener = undefined; } } } };
    },
    getSession: () => restore.promise.then(() => ({ data: { session: currentSession } })),
    signOut: async () => {
      sdkCalls.push(currentSession?.user.id);
      const result = sdkMode === "pending"
        ? await sdk.promise
        : { error: sdkMode === "error" ? new Error("auth service unavailable") : null };
      if (!result.error) await emit("SIGNED_OUT", null);
      return result;
    },
    signInWithPassword: async () => {
      loginCalls.push("signIn");
      await emit("SIGNED_IN", newSession);
      return { data: { session: newSession }, error: null };
    },
    signUp: async () => {
      loginCalls.push("signUp");
      await emit("SIGNED_IN", newSession);
      return { data: { session: newSession }, error: null };
    },
  };
  fakeSupabase.from = (table: string) => {
    assert.equal(table, "profiles");
    let userId = "";
    const query: any = {
      select: () => query,
      eq: (field: string, value: string) => {
        assert.equal(field, "user_id");
        userId = value;
        return query;
      },
      single: async () => ({ data: { user_id: userId, full_name: `Profile ${userId}` } }),
    };
    return query;
  };
  globalThis.fetch = (async (input: string, init?: RequestInit) => {
    if (input === "/api/ruang-simpan/workspace") {
      assert.equal(init?.method, undefined);
      return Response.json({ profile: { name: "Fixture company" } });
    }
    assert.equal(input, "/api/ruang-simpan/session", "unexpected request must fail, not fall back to live services");
    assert.equal(init?.method, "DELETE");
    assert.equal(init.credentials, "same-origin");
    assert.ok(init.signal instanceof AbortSignal);
    deletes.push(init);
    if (deleteMode === "network") throw new TypeError("Failed to fetch");
    return new Response(null, { status: deleteMode === "service" ? 503 : 204 });
  }) as typeof fetch;
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      get length() { return storage.size; },
      key: (index: number) => [...storage.keys()][index] ?? null,
      getItem: (key: string) => storage.get(key) ?? null,
      removeItem: (key: string) => { storage.delete(key); },
    },
  });
  return {
    initialSession, newSession, restore, sdk, deletes, sdkCalls, loginCalls, events, storage,
    set deleteMode(value: typeof deleteMode) { deleteMode = value; },
    set sdkMode(value: typeof sdkMode) { sdkMode = value; },
  };
}

test.before(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as any).__logoutProviderSupabase = fakeSupabase;
  (globalThis as any).window = {
    addEventListener(type: string, callback: unknown) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type)!.add(callback);
    },
    removeEventListener(type: string, callback: unknown) { listeners.get(type)?.delete(callback); },
    setInterval() { const id = ++timerId; intervals.add(id); return id; },
    clearInterval(id: number) { intervals.delete(id); },
  };
  process.env.PORT ||= "4173";
  process.env.BASE_PATH ||= "/";
  server = await createServer({
    configFile: new URL("../../vite.config.ts", import.meta.url).pathname,
    cacheDir: "node_modules/.vite-auth-logout-provider-tests",
    define: { "import.meta.env.VITE_SUPABASE_URL": JSON.stringify("https://logout-fixture.supabase.co") },
    optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { noExternal: ["sonner", "framer-motion"] },
    plugins: [{
      name: "logout-provider-controlled-transport",
      enforce: "pre",
      resolveId(id) {
        if (/\/integrations\/supabase\/client(?:\.ts)?$/.test(id)) return "\0logout-provider-supabase";
        if (id === "framer-motion") return "\0logout-provider-motion";
      },
      load(id) {
        if (id === "\0logout-provider-supabase") return "export const supabase = globalThis.__logoutProviderSupabase;";
        // Animation installs browser-wide listeners unrelated to session state.
        if (id === "\0logout-provider-motion") return `
          import React from "react";
          export const motion = { div: ({ initial, animate, transition, ...props }) => React.createElement("div", props) };`;
      },
    }],
    server: { middlewareMode: true, hmr: false },
    appType: "custom",
  });
  modules = {
    ...await server.ssrLoadModule("/src/hooks/useAuth.tsx"),
    ...await server.ssrLoadModule("/src/hooks/auth-provider.tsx"),
    Auth: (await server.ssrLoadModule("/src/pages/Auth.tsx")).default,
  };
});

test.beforeEach(() => {
  // Install only after SSR imports so browser-only UI style injection stays off.
  (globalThis as any).document = { visibilityState: "visible" };
  fixture = transport();
  renders.length = 0;
  path = "";
});

test.afterEach(async () => {
  // Settle even if an assertion failed: no module-wide logout lock may leak
  // into the next scenario, and no pending promise may survive test cleanup.
  await act(async () => {
    fixture.restore.resolve(undefined);
    fixture.sdk.resolve({ error: null });
  });
  if (root) await act(async () => { root!.unmount(); });
  root = undefined;
  assert.equal(intervals.size, 0);
  for (const callbacks of listeners.values()) assert.equal(callbacks.size, 0);
});

test.after(async () => {
  try { await server?.close(); }
  finally {
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

function Probe() {
  observed = modules.useAuth();
  const location = useLocation();
  path = location.pathname + location.search;
  // Keep every render, including transient states during the redirect.
  renders.push({
    path, user: observed.user?.id ?? null,
    session: observed.session?.user.id ?? null,
    profile: observed.profile?.user_id ?? null,
  });
  return null;
}

async function mount() {
  await act(async () => {
    root = create(React.createElement(modules.AuthProvider, null,
      React.createElement(MemoryRouter, { initialEntries: ["/auth?logout=1&next=/dashboard"] },
        React.createElement(Probe), React.createElement(modules.Auth))));
  });
  assert.equal(observed.loading, true);
  assert.equal(fixture.deletes.length, 0, "logout waits for provider restoration");
  assert.equal(root!.root.findAllByType("form").length, 0);
  await act(async () => { fixture.restore.resolve(undefined); });
}

function assertSessionRetained() {
  assert.equal(observed.user, fixture.initialSession.user);
  assert.equal(observed.session, fixture.initialSession);
  assert.equal(observed.profile?.user_id, "member-a");
  assert.equal(observed.loading, false);
  assert.equal(path, "/auth?logout=1&next=/dashboard");
  assert.equal(root!.root.findAllByType("form").length, 0);
  assert.equal(fixture.storage.size, 0, "failed logout must still purge private local drafts");
}

async function retry() {
  const button = root!.root.findByType("button");
  assert.equal(button.props.children, "Coba lagi keluar");
  assert.equal(button.props.disabled, false);
  await act(async () => { button.props.onClick(); button.props.onClick(); });
}

function assertLoggedOutBeforeForm() {
  assert.equal(path, "/auth");
  assert.equal(observed.user, null);
  assert.equal(observed.session, null);
  assert.equal(observed.profile, null);
  assert.equal(root!.root.findAllByType("form").length, 1);
  const formRenders = renders.filter(render => render.path === "/auth");
  assert.ok(formRenders.length > 0, "the real router must render the login destination");
  assert.ok(formRenders.every(render => render.user === null && render.session === null && render.profile === null),
    "provider must already be cleared on every render that can expose the login form");
}

for (const failure of ["service", "network", "sdk"] as const) {
  test(`${failure}: kegagalan mempertahankan sesi provider; retry memperbarui provider sebelum formulir masuk`, async () => {
    if (failure === "sdk") fixture.sdkMode = "error";
    else fixture.deleteMode = failure;
    await mount();
    assertSessionRetained();
    assert.match(JSON.stringify(root!.toJSON()), /Logout belum terkonfirmasi.*Sesi mungkin masih aktif/);
    assert.equal(fixture.deletes.length, 1, "failure must not start an automatic retry");
    assert.equal(fixture.sdkCalls.length, failure === "sdk" ? 1 : 0, "failed DELETE must not call the SDK");
    assert.deepEqual(fixture.events, []);

    fixture.deleteMode = "ok";
    fixture.sdkMode = "pending";
    await retry();
    assertSessionRetained();
    assert.equal(root!.root.findAllByType("button").length, 0, "retry is unavailable while waiting");
    assert.equal(fixture.deletes.length, 2, "double click must send only one additional DELETE");
    assert.equal(fixture.sdkCalls.length, failure === "sdk" ? 2 : 1);
    await act(async () => { fixture.sdk.resolve({ error: null }); });
    assertLoggedOutBeforeForm();
    assert.deepEqual(fixture.events, ["SIGNED_OUT"], "provider clearing must follow the actual auth event");
  });
}

test("retry setelah timeout SDK bergabung; login ditahan lalu sesi baru tidak dihapus oleh penyelesaian lama", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  fixture.sdkMode = "pending";
  await mount();
  assertSessionRetained();
  assert.equal(fixture.sdkCalls.length, 1, "SDK must be pending before advancing the deadline");
  await act(async () => { t.mock.timers.tick(10_000); });
  assertSessionRetained();
  assert.match(JSON.stringify(root!.toJSON()), /Status sesi belum dapat dipastikan/);

  await act(async () => {
    const login = await observed.signIn("fixture@example.test", "password");
    const registration = await observed.signUp("fixture@example.test", "password", "Fixture");
    assert.match(login.error!.message, /sebelumnya belum selesai/);
    assert.match(registration.error!.message, /sebelumnya belum selesai/);
  });
  assert.deepEqual(fixture.loginCalls, [], "pending SDK logout must block new auth requests");

  await retry();
  assert.equal(fixture.deletes.length, 1);
  assert.equal(fixture.sdkCalls.length, 1);
  assert.equal(root!.root.findAllByType("form").length, 0);
  await act(async () => { t.mock.timers.tick(10_000); });
  assertSessionRetained();
  assert.match(JSON.stringify(root!.toJSON()), /Status sesi belum dapat dipastikan/);
  await retry();
  assert.equal(fixture.deletes.length, 1, "even repeated timeout retries reuse the original DELETE");
  assert.equal(fixture.sdkCalls.length, 1, "even repeated timeout retries reuse the original SDK operation");
  await act(async () => { fixture.sdk.resolve({ error: null }); });
  assertLoggedOutBeforeForm();

  // Login through the actual page/provider after the old operation settles.
  await act(async () => {
    root!.root.findByProps({ type: "email" }).props.onChange({ target: { value: "fixture@example.test" } });
    root!.root.findByProps({ autoComplete: "current-password" }).props.onChange({ target: { value: "password" } });
  });
  await act(async () => { await root!.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
  assert.deepEqual(fixture.loginCalls, ["signIn"]);
  assert.equal(observed.session, fixture.newSession);
  assert.equal(observed.user?.id, "member-b");
  assert.equal(path, "/dashboard");
  await act(async () => { t.mock.timers.tick(30_000); });
  assert.equal(observed.session, fixture.newSession, "no old timeout or completion may clear the new session");
  assert.equal(observed.user?.id, "member-b");
  assert.equal(observed.profile?.user_id, "member-b");
  assert.deepEqual(fixture.events, ["SIGNED_OUT", "SIGNED_IN"]);
  assert.equal(fixture.deletes.length, 1);
  assert.equal(fixture.sdkCalls.length, 1);
});
