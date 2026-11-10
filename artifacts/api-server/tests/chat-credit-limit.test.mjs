import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const bundled = await build({
  stdin: {
    contents: 'export { createChatService } from "./src/lib/chat-service";',
    resolveDir: fileURLToPath(new URL("..", import.meta.url)), loader: "ts",
  },
  bundle: true, platform: "node", format: "cjs", write: false,
});
const compiled = { exports: {} };
new Function("require", "module", "exports", bundled.outputFiles[0].text)(
  createRequire(import.meta.url), compiled, compiled.exports,
);
test("OpenRouter credit rejection is explicit, sanitized, and never falls back", async () => {
  let attempts = 0;
  const service = compiled.exports.createChatService({
    env: { OPENROUTER_API_KEY: "test-only-not-a-real-key" },
    fetchImpl: async () => {
      attempts++;
      return new Response(JSON.stringify({ error: { message: "private-provider-details" } }), { status: 402 });
    },
  });
  await assert.rejects(
    service.reply([{ role: "user", content: "Pertanyaan uji" }], undefined, { engine: "claude" }),
    error => error.status === 503 && error.code === "ai_credit_limit" &&
      error.message.includes("OpenRouter") && !error.message.includes("private-provider-details"),
  );
  assert.equal(attempts, 1);
});
