import assert from "node:assert/strict";
import test from "node:test";
import { createServer, type ViteDevServer } from "vite";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

let server: ViteDevServer;

async function withAppProviders(element: React.ReactElement) {
  const { AuthContext } = await server.ssrLoadModule("/src/hooks/useAuth.tsx");
  const auth = {
    user: { id: "user-nullable-response" },
    session: null,
    loading: false,
    profile: null,
    signUp: async () => ({ error: null, session: null }),
    signIn: async () => ({ error: null, session: null }),
    signOut: async () => undefined,
    refreshProfile: async () => undefined,
  };

  return React.createElement(
    AuthContext.Provider,
    { value: auth },
    React.createElement(
      QueryClientProvider,
      { client: new QueryClient() },
      React.createElement(MemoryRouter, null, element),
    ),
  );
}

test.before(async () => {
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: () => null,
      setItem: () => undefined,
      removeItem: () => undefined,
    },
  });
  process.env.PORT ||= "4173";
  process.env.BASE_PATH ||= "/";
  server = await createServer({
    cacheDir: "node_modules/.vite-competency-pages-tests",
    configFile: new URL("../../vite.config.ts", import.meta.url).pathname,
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true },
    appType: "custom",
  });
});

test.after(async () => {
  await server.close();
});

test("Analytics merender fallback untuk respons pre_tests nullable", async () => {
  const { default: Analytics } = await server.ssrLoadModule("/src/pages/Analytics.tsx");
  const html = renderToStaticMarkup(
    await withAppProviders(
      React.createElement(Analytics, {
        initialAssessmentRows: [{
          score: 72,
          determined_level: null,
          completed_at: null,
        }],
      }),
    ),
  );

  assert.match(html, />Pemula</);
  assert.match(html, /Tanggal belum tersedia/);
});

test("Assessment merender fallback untuk respons pre_tests nullable", async () => {
  const { default: Assessment } = await server.ssrLoadModule("/src/pages/Assessment.tsx");
  const html = renderToStaticMarkup(
    await withAppProviders(
      React.createElement(Assessment, {
        initialPastTests: [{
          id: "pre-test-nullable",
          score: 72,
          determined_level: null,
          completed_at: null,
        }],
      }),
    ),
  );

  assert.match(html, /Belum ditentukan/);
  assert.match(html, /Tanggal belum tersedia/);
});