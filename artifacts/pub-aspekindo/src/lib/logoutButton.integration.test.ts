import { test } from "node:test";
import assert from "node:assert/strict";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createServer, type ViteDevServer } from "vite";

let server: ViteDevServer;
let modules: any;
const errors: any[] = [];
const dismissed: string[] = [];

test.before(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as any).__logoutToast = {
    error: (message: string, options: any) => errors.push({ message, ...options }),
    dismiss: (id: string) => dismissed.push(id),
  };
  process.env.PORT ||= "4173";
  process.env.BASE_PATH ||= "/";
  server = await createServer({
    configFile: new URL("../../vite.config.ts", import.meta.url).pathname,
    cacheDir: "node_modules/.vite-logout-button-tests",
    optimizeDeps: { noDiscovery: true, include: [] },
    ssr: { noExternal: ["sonner"] },
    plugins: [{
      name: "logout-ui-test",
      enforce: "pre",
      resolveId(id) {
        if (id === "sonner") return "\0logout-toast";
        if (/\/components\/ui\/sidebar(?:\.tsx)?$/.test(id)) return "\0logout-sidebar";
      },
      load(id) {
        if (id === "\0logout-toast") return "export const toast = globalThis.__logoutToast;";
        if (id === "\0logout-sidebar") return `import React from "react";
          export function SidebarMenuButton(props) { return React.createElement("button", props); }`;
      },
    }],
    server: { middlewareMode: true },
    appType: "custom",
  });
  modules = {
    ...await server.ssrLoadModule("/src/hooks/useAuth.tsx"),
    ...await server.ssrLoadModule("/src/components/LogoutButton.tsx"),
    ...await server.ssrLoadModule("/src/lib/logoutRequest.ts"),
  };
});

test.after(async () => {
  await server.close();
  delete (globalThis as any).__logoutToast;
});

test("tombol Keluar menahan klik ganda, memperingatkan kegagalan, dan mengulang tanpa klaim sukses palsu", async () => {
  for (const collapsed of [false, true]) {
    errors.length = 0;
    dismissed.length = 0;
    let calls = 0;
    let reject!: (error: Error) => void;
    let resolve!: () => void;
    const signOut = () => {
      calls += 1;
      return new Promise<void>((yes, no) => { resolve = yes; reject = no; });
    };
    let root!: ReactTestRenderer;
    await act(async () => {
      root = create(React.createElement(modules.AuthContext.Provider, { value: { signOut } },
        React.createElement(modules.LogoutButton, { collapsed })));
    });
    const button = () => root.root.findByType("button");
    await act(async () => {
      button().props.onClick();
      button().props.onClick();
    });
    assert.equal(calls, 1);
    assert.equal(button().props.disabled, true);
    assert.equal(button().props["aria-label"], "Sedang keluar…");
    await act(async () => { reject(new Error("network failed")); });
    assert.equal(button().props.disabled, false);
    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /Sesi mungkin masih aktif/);
    assert.equal(errors[0].duration, Infinity);
    assert.equal(errors[0].action.label, "Coba lagi");
    await act(async () => { errors[0].action.onClick(); });
    assert.equal(calls, 2);
    assert.equal(button().props.disabled, true);
    assert.equal(dismissed.at(-1), errors[0].id);
    await act(async () => { reject(new Error("still offline")); });
    assert.equal(errors.length, 2);
    assert.equal(errors[1].id, errors[0].id);
    await act(async () => { errors[1].action.onClick(); });
    await act(async () => { resolve(); });
    assert.equal(calls, 3);
    assert.equal(button().props.disabled, false);
    assert.equal(button().props["aria-label"], "Keluar");
    assert.equal(errors.length, 2);
    await act(async () => { root.unmount(); });
  }
});

test("timeout mengaktifkan kembali tombol; retry menunggu SDK yang sama dan unmount mengabaikan hasil terlambat", async (t) => {
  errors.length = 0;
  let finish!: () => void;
  let calls = 0;
  const request = modules.createLogoutRequest(async () => {}, async () => {
    calls++;
    await new Promise<void>((resolve) => { finish = resolve; });
  });
  let root!: ReactTestRenderer;
  await act(async () => {
    root = create(React.createElement(modules.AuthContext.Provider, { value: { signOut: () => request.run() } },
      React.createElement(modules.LogoutButton, { collapsed: false })));
  });
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const button = () => root.root.findByType("button");
  await act(async () => { button().props.onClick(); });
  await act(async () => { t.mock.timers.tick(10_000); });
  assert.equal(button().props.disabled, false);
  assert.match(errors[0].message, /Status sesi belum dapat dipastikan/);
  assert.equal(errors[0].duration, Infinity);
  await act(async () => {
    errors[0].action.onClick();
    errors[0].action.onClick();
  });
  assert.equal(calls, 1);
  assert.equal(button().props.disabled, true);
  await act(async () => { root.unmount(); });
  await act(async () => { t.mock.timers.tick(10_000); });
  assert.equal(errors.length, 1, "unmounted UI must not show a stale failure toast");
  await act(async () => { errors[0].action.onClick(); finish(); });
  assert.equal(calls, 1, "stale toast actions must not restart logout");
});
