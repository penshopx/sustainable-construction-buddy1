import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const bundled = await build({
  stdin: {
    contents: `
      export { requestVaultAnswer } from "./src/lib/vault-ai";
      export { vaultCitationText } from "../pub-aspekindo/src/lib/vault-citations";
    `,
    resolveDir: fileURLToPath(new URL("..", import.meta.url)), loader: "ts",
  },
  bundle: true, platform: "node", format: "cjs", write: false,
});
const compiled = { exports: {} };
new Function("require", "module", "exports", bundled.outputFiles[0].text)(
  createRequire(import.meta.url), compiled, compiled.exports,
);
const { requestVaultAnswer, vaultCitationText } = compiled.exports;
const MODEL = "anthropic/claude-sonnet-4.5";
const sources = [{ id: "test-doc", name: "Kontrak.txt", quote: "Nilai kontrak Rp 815 juta." }];

test("vault sends selected excerpts, keeps its existing model, and prohibits provider fallback/data collection", async () => {
  let attempts = 0;
  const answer = await requestVaultAnswer("Berapa nilai kontrak?", "Jawab ringkas", sources, {
    apiKey: "test-only-key",
    fetchImpl: async (_url, init) => {
      attempts++;
      const body = JSON.parse(init.body);
      assert.equal(body.model, MODEL);
      assert.equal(body.max_tokens, 1400);
      assert.equal(init.redirect, "error");
      assert.deepEqual(body.provider, { allow_fallbacks: false, data_collection: "deny" });
      assert.equal(JSON.parse(body.messages[1].content).kutipan[0].kutipan, sources[0].quote);
      return Response.json({ model: MODEL, choices: [{ message: { content: " Rp 815 juta [1]. " } }] });
    },
  });
  assert.equal(answer, "Rp 815 juta [1].");
  assert.equal(attempts, 1);
});
for (const status of [402, 429, 500]) {
  test(`vault sanitizes upstream ${status} without reading its body or retrying`, async () => {
    let attempts = 0;
    await assert.rejects(requestVaultAnswer("Uji", "", sources, {
      apiKey: "test-only-key", fetchImpl: async () => {
        attempts++;
        return { ok: false, status, json() { throw new Error("body-must-not-be-read"); } };
      },
    }), error => error.status === 503 && !error.message.includes("body-must-not-be-read") &&
      (status !== 402 || error.message.includes("OpenRouter")));
    assert.equal(attempts, 1);
  });
}
test("network errors do not disclose exception details or retry", async () => {
  let attempts = 0;
  await assert.rejects(requestVaultAnswer("Uji", "", sources, {
    apiKey: "test-only-key", fetchImpl: async () => { attempts++; throw new Error("sensitive-request-details"); },
  }), error => error.status === 503 && !error.message.includes("sensitive-request-details"));
  assert.equal(attempts, 1);
});
for (const payload of [
  { model: "another/model", choices: [{ message: { content: "Wrong model" } }] },
  { model: MODEL, choices: [{ message: { content: "" } }] },
  { model: MODEL, choices: [{ message: { content: { unexpected: "object" } } }] },
]) {
  test("invalid answer/model cannot appear as a valid vault answer", async () => {
    await assert.rejects(requestVaultAnswer("Uji", "", sources, {
      apiKey: "test-only-key", fetchImpl: async () => Response.json(payload),
    }), error => error.status === 502);
  });
}
test("citations show evidence and escape hostile filename and excerpt Markdown", () => {
  const output = vaultCitationText([{
    name: "[Buka](javascript:alert(1)).txt\n# heading",
    quote: "Nilai Rp 815 juta. [tautan](https://example.test)",
  }]);
  assert.match(output, /815 juta/);
  assert.ok(output.includes("\\[Buka\\]\\(javascript\\:alert\\(1\\)\\)"));
  assert.ok(!output.includes("[tautan](https://"));
  assert.ok(!output.includes("\n# heading"));
  assert.match(output, /\[RS1\]/);
});
test("citations are bounded and an empty list adds no fabricated evidence", () => {
  assert.equal(vaultCitationText([]), "");
  const output = vaultCitationText(Array.from({ length: 20 }, () => ({ name: "Uji", quote: "a".repeat(5000) })));
  assert.equal((output.match(/\[RS\d+\]/g) || []).length, 6);
  assert.ok(!output.includes("a".repeat(451)));
  assert.ok(output.includes("…"));
});
