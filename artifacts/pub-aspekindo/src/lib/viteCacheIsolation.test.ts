import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createServer, optimizeDeps, type InlineConfig, type ViteDevServer } from "vite";
import {
  assertIsolatedViteCaches,
  checkIntegrationCachePolicy,
} from "../../tests/helpers/vite-cache-policy.ts";

const suite = (options: string, imported = "createServer", called = "createServer") =>
  `import { ${imported} } from "vite"; await ${called}({ ${options} });`;

test("every current integration Vite server has its own non-preview cache", async () => {
  const result = await checkIntegrationCachePolicy();
  assert.ok(result.servers > 0);
});

test("preflight rejects missing, default, ambiguous and shared cache configurations", () => {
  for (const options of [
    "",
    'cacheDir: "node_modules/.vite"',
    'cacheDir: "node_modules/.vite/../.vite"',
    'cacheDir: testCache',
    'cacheDir: "node_modules/.vite-safe-tests", ...options',
    'cacheDir: "node_modules/.vite-safe-tests", ["cacheDir"]: "node_modules/.vite"',
    'cacheDir: "node_modules/.vite-safe-tests", cacheDir: "node_modules/.vite"',
  ]) {
    assert.throws(() => assertIsolatedViteCaches({ "new.integration.test.ts": suite(options) }),
      /new\.integration\.test\.ts:1:/);
  }
  assert.throws(() => assertIsolatedViteCaches({
    "one.integration.test.ts": suite('cacheDir: "node_modules/.vite-shared-tests"'),
    "two.integration.test.ts": suite('cacheDir: "node_modules/.vite-shared-tests"'),
  }), /already used/);
  assert.throws(() => assertIsolatedViteCaches({
    "alias.integration.test.ts": suite("", "createServer as startVite", "startVite"),
  }), /cacheDir/);
  assert.throws(() => assertIsolatedViteCaches({
    "namespace.integration.test.ts": 'import * as vite from "vite"; vite.createServer({});',
  }), /cacheDir/);
  assert.throws(() => assertIsolatedViteCaches({
    "indirect.integration.test.ts": 'import { createServer } from "vite"; createServer(options);',
  }), /inline config/);
  assert.throws(() => assertIsolatedViteCaches({
    "factory.integration.test.ts": 'import { createServer } from "vite"; const start = createServer; start({});',
  }), /factory directly/);
  assert.throws(() => assertIsolatedViteCaches({
    "dynamic.integration.test.ts": 'const { createServer } = await import("vite"); createServer({});',
  }), /static Vite import/);
  for (const source of [
    'import * as vite from "vite"; const { createServer } = vite; createServer({});',
    'import * as vite from "vite"; const start = vite.createServer; start({});',
    'import * as vite from "vite"; vite["createServer"]({});',
  ]) {
    assert.throws(() => assertIsolatedViteCaches({ "namespace-alias.integration.test.ts": source }),
      /directly/);
  }
});

test("preflight accepts distinct literal test caches, including aliased imports", () => {
  assert.equal(assertIsolatedViteCaches({
    "one.integration.test.ts": suite('cacheDir: "node_modules/.vite-one-tests"'),
    "two.integration.test.ts": suite('cacheDir: "node_modules/.vite-two-tests"',
      "createServer as startVite", "startVite"),
    "three.integration.test.ts": `import * as vite from "vite";
      vite.createServer({ cacheDir: "node_modules/.vite-three-tests" });`,
  }), 3);
});

// Real optimization, but only inside a disposable root. Never load the app's
// Vite config, touch its node_modules cache, or connect to its running preview.
for (const shared of [false, true]) {
  test(`temporary preview ${shared ? "detects shared-cache corruption" : "survives an isolated SSR server"}`,
    { timeout: 30_000 }, async () => {
      const root = await mkdtemp(path.join(os.tmpdir(), "vite-cache-regression-"));
      const servers: ViteDevServer[] = [];
      try {
        const dependency = path.join(root, "node_modules/fixture-dep");
        await mkdir(dependency, { recursive: true });
        await writeFile(path.join(root, "package.json"), '{"type":"module"}');
        await writeFile(path.join(dependency, "package.json"),
          '{"name":"fixture-dep","version":"1.0.0","main":"index.js"}');
        await writeFile(path.join(dependency, "index.js"), "module.exports = { value: 42 };");
        await writeFile(path.join(root, "entry.js"),
          'import dep from "fixture-dep"; export const value = dep.value;');
        await writeFile(path.join(root, "ssr.js"), "export const ready = true;");
        const config: InlineConfig = {
          root, configFile: false, logLevel: "silent",
          cacheDir: path.join(root, "node_modules/.vite"),
          css: { postcss: { plugins: [] } },
          optimizeDeps: { noDiscovery: true, include: ["fixture-dep"] },
          server: { host: "127.0.0.1", port: 0, hmr: false, watch: null },
        };
        const preview = await createServer(config);
        servers.push(preview);
        // Seed the disk cache before the live fixture starts its optimizer.
        await optimizeDeps(preview.config, true);
        await preview.listen();
        const address = preview.httpServer!.address();
        assert.ok(address && typeof address !== "string");
        const origin = `http://127.0.0.1:${address.port}`;
        async function dependencyUrl() {
          const response = await fetch(`${origin}/entry.js`);
          assert.equal(response.status, 200);
          const match = (await response.text()).match(/"(\/node_modules\/\.vite\/deps\/fixture-dep\.js\?v=[^"]+)"/);
          assert.ok(match, "Preview must serve a real optimized dependency URL");
          return match[1];
        }
        const beforeUrl = await dependencyUrl();
        const metadataFile = path.join(config.cacheDir!, "deps/_metadata.json");
        const beforeMetadata = await readFile(metadataFile, "utf8");
        const beforeResponse = await fetch(`${origin}${beforeUrl}`);
        assert.equal(beforeResponse.status, 200);
        const beforeBody = await beforeResponse.text();

        const ssr = await createServer({
          ...config,
          cacheDir: shared ? config.cacheDir : path.join(root, "node_modules/.vite-ssr-tests"),
          optimizeDeps: {
            ...config.optimizeDeps,
            esbuildOptions: { define: { __TEST_SERVER__: "true" } },
          },
          server: { middlewareMode: true, hmr: false, watch: null },
          appType: "custom",
        });
        servers.push(ssr);
        // A different optimizer config reproduces the destructive cache rewrite.
        await optimizeDeps(ssr.config, true);
        assert.equal((await ssr.ssrLoadModule("/ssr.js")).ready, true);
        const afterMetadata = await readFile(metadataFile, "utf8");
        const assertPreviewUnchanged = () => assert.equal(afterMetadata, beforeMetadata,
          "SSR server changed preview optimization metadata");
        if (shared) {
          assert.throws(assertPreviewUnchanged, /changed preview optimization metadata/);
          assert.notEqual(JSON.parse(afterMetadata).browserHash, JSON.parse(beforeMetadata).browserHash);
        } else {
          assertPreviewUnchanged();
          assert.equal(await dependencyUrl(), beforeUrl);
          const response = await fetch(`${origin}${beforeUrl}`);
          assert.equal(response.status, 200);
          assert.equal(await response.text(), beforeBody);
        }
      } finally {
        try {
          await Promise.all(servers.map(server => server.close()));
        } finally {
          await rm(root, { recursive: true, force: true });
        }
      }
    });
}
