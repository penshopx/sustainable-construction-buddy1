import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { Worker } from "node:worker_threads";
import { build } from "esbuild";

// Shared by the live runner and offline PDF smoke test. Dynamic ESM imports
// resolve relative to the generated bundle, NOT the overridden CJS require.
export async function buildSyntheticWorker(outfile, testPlugins = []) {
  const packagePath = fileURLToPath(new URL("../../package.json", import.meta.url));
  const requireApi = createRequire(packagePath);
  await build({
    entryPoints: [fileURLToPath(new URL("../../src/lib/vault-extractor.ts", import.meta.url))],
    outfile: fileURLToPath(outfile), bundle: true, platform: "node", format: "cjs",
    external: ["pdf-parse", "mammoth", "xlsx", "pdfjs-dist", "@napi-rs/canvas"],
    banner: { js: `require = require("node:module").createRequire(${JSON.stringify(packagePath)});` },
    plugins: [{
      name: "api-worker-dynamic-dependencies",
      setup(b) {
        b.onResolve({ filter: /^(pdfjs-dist\/legacy\/build\/pdf\.mjs|@napi-rs\/canvas)$/ }, args => ({
          path: requireApi.resolve(args.path), external: true,
        }));
      },
    }, ...testPlugins],
  });
}

export async function extractSyntheticFixture(workerPath, fixture, apiKey) {
  const bytes = await readFile(fixture.path);
  return new Promise((resolve, reject) => {
    const worker = new Worker(workerPath, {
      workerData: { bytes, type: fixture.type, pageRange: fixture.pageRange, apiKey },
      env: {}, resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16 },
    });
    let settled = false;
    const finish = (error, value) => {
      if (settled) return;
      settled = true; clearTimeout(timer);
      void worker.terminate().finally(() => error ? reject(error) : resolve(value));
    };
    const timer = setTimeout(() => finish(new Error("OCR_TIMEOUT")), 90_000);
    worker.on("message", value => {
      if (value.prepared) return;
      finish(value.error ? new Error(value.code ?? "OCR_FAILED") : undefined, value);
    });
    worker.once("error", () => finish(new Error("OCR_WORKER_FAILED")));
    worker.once("exit", () => finish(new Error("OCR_WORKER_EXITED")));
  });
}
