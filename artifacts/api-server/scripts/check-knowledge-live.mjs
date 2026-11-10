/**
 * Explicit, paid opt-in smoke check of the real Helpdesk service.
 * No auth mocking, member data, database reads, retries, or provider fallback.
 * This exercises the service/model, not a signed-in browser journey.
 */
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const apiDir = fileURLToPath(new URL("..", import.meta.url));
const reportDir = path.resolve(apiDir, "../../generated-artifacts/knowledge-live-check");
const reportPath = path.join(reportDir, "results.json");
const execute = process.argv.includes("--run-three");
if (execute && existsSync(reportPath)) {
  console.error("A live-check report already exists; refusing additional paid calls.");
  process.exit(1);
}

const bundle = await build({
  stdin: {
    contents: `export { createChatService } from "./src/lib/chat-service";
      export { knowledgeContext } from "./src/lib/knowledge-base";
      export { chatModel } from "./src/lib/chat-engines";`,
    resolveDir: apiDir,
    loader: "ts",
  },
  bundle: true, platform: "node", format: "cjs", write: false,
});
const module = { exports: {} };
new Function("require", "module", "exports", bundle.outputFiles[0].text)(
  createRequire(import.meta.url), module, module.exports,
);
const { createChatService, knowledgeContext, chatModel } = module.exports;
const engine = "claude";
const model = chatModel(engine, process.env);
const scenarios = [
  {
    id: "pub-purpose", source: "KB18",
    question: "Menurut KB18, Permen PUPR Nomor 7 Tahun 2024, apa tujuan Pengembangan Usaha Berkelanjutan bagi BUJK? Jawab singkat berdasarkan kutipan yang tersedia dan cantumkan ID dokumen serta halaman PDF. Jangan menambahkan ketentuan yang tidak ada dalam kutipan.",
  },
  {
    id: "amendment-not-consolidation", source: "KB41",
    question: "Menurut KB41, Perpres Nomor 46 Tahun 2025 mengubah peraturan apa dan merupakan perubahan keberapa? Apakah PDF KB41 dapat dianggap naskah konsolidasi lengkap seluruh Perpres 16/2018? Jawab singkat, bedakan naskah perubahan dari konsolidasi, dan cantumkan sumber beserta halaman PDF.",
  },
  {
    id: "annex-file-range", source: "KB28",
    question: "Pada KB28, apakah nama file I.F.5249–11000 membuktikan halaman cetak I.F.11000 tersedia? Periksa batas akhir I.F.5691 dan sebutkan halaman PDF yang mendukungnya. Jelaskan batas cakupan berkas, jangan menebak halaman yang tidak tersedia.",
  },
];
for (const scenario of scenarios) {
  const context = knowledgeContext(scenario.question);
  const excerpts = JSON.parse(context.split("KUTIPAN_DATA_TIDAK_TEPERCAYA=")[1].split("\nAKHIR_DATA_RUJUKAN")[0]);
  scenario.excerpts = excerpts;
  scenario.contextCharacters = context.length;
  if (!excerpts.some(source => source.id === scenario.source) || context.length >= 16000) {
    throw new Error(`Preflight failed for ${scenario.id}; no live requests made.`);
  }
}
console.log(JSON.stringify({
  mode: execute ? "live" : "preflight-only", engine, requestedModel: model,
  scope: "real service and provider, not authenticated browser or production release",
  scenarios: scenarios.map(({ id, question, excerpts, contextCharacters }) => ({
    id, question, contextCharacters,
    sources: excerpts.map(({ id, page }) => ({ id, page })),
  })),
}, null, 2));
if (!execute) process.exit(0);
if (!process.env.OPENROUTER_API_KEY) throw new Error("AI credential not configured; no live requests made.");

mkdirSync(reportDir, { recursive: true });
const report = {
  startedAt: new Date().toISOString(), engine, requestedModel: model,
  scope: "synthetic service/provider checks; not member authentication, browser UI, or all models",
  requestLimit: 3, requests: 0, results: [],
};
// Reserve the report before sending, so an interruption cannot silently allow a duplicate run.
const save = () => writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n");
save();
let upstream;
const service = createChatService({
  fetchImpl: async (url, init) => {
    if (String(url) !== "https://openrouter.ai/api/v1/chat/completions" || report.requests >= 3) {
      throw new Error("Unexpected request blocked.");
    }
    report.requests++;
    save();
    const response = await fetch(url, init);
    upstream = { httpStatus: response.status };
    if (response.ok) {
      const data = await response.clone().json();
      upstream.actualModel = typeof data.model === "string" && /^[a-zA-Z0-9/_.:-]{1,120}$/.test(data.model) ? data.model : null;
      upstream.finishReason = typeof data.choices?.[0]?.finish_reason === "string" ? data.choices[0].finish_reason : null;
      upstream.usage = Object.fromEntries(
        ["prompt_tokens", "completion_tokens", "total_tokens", "cost"]
          .filter(key => typeof data.usage?.[key] === "number" && Number.isFinite(data.usage[key]))
          .map(key => [key, data.usage[key]]),
      );
    }
    // Never read or log non-success provider bodies, headers, or credentials.
    return response;
  },
});
for (const scenario of scenarios) {
  const started = Date.now();
  upstream = undefined;
  try {
    const answer = await service.reply([{ role: "user", content: scenario.question }], undefined, { engine });
    const citations = [...answer.matchAll(/\[(KB\d{2}),\s*hlm\.\s*(\d+)\]/g)]
      .map(match => ({ id: match[1], page: Number(match[2]) }));
    const citationsInContext = citations.length > 0 &&
      citations.every(citation => scenario.excerpts.some(source => source.id === citation.id && source.page === citation.page));
    const result = {
      id: scenario.id, question: scenario.question, answer,
      contextCharacters: scenario.contextCharacters,
      suppliedExcerpts: scenario.excerpts, citations, citationsInContext,
      elapsedMs: Date.now() - started, upstream, status: "answer-received-needs-content-review",
    };
    report.results.push(result);
    save();
    console.log(JSON.stringify({ ...result, suppliedExcerpts: result.suppliedExcerpts.map(({ id, page }) => ({ id, page })) }, null, 2));
  } catch (error) {
    report.results.push({
      id: scenario.id, status: "failed", elapsedMs: Date.now() - started, upstream,
      errorCode: typeof error?.code === "string" && /^[a-z_]{1,80}$/.test(error.code) ? error.code : "request_failed",
    });
    save();
    console.error(`Live check stopped at ${scenario.id}; no automatic retry or model substitution.`);
    process.exitCode = 1;
    break;
  }
}
report.finishedAt = new Date().toISOString();
save();
console.log(`Saved synthetic evidence to ${path.relative(process.cwd(), reportPath)}.`);
