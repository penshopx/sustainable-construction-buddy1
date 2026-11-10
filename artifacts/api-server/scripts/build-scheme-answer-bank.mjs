import { build } from "esbuild";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { buildSchemeAnswerBank } from "./scheme-answer-bank.mjs";
import { renderSchemeAnswerBank } from "./scheme-answer-bank-report.mjs";

const root = new URL("../", import.meta.url);
const output = await build({ stdin: { contents: 'export * from "./src/lib/scheme-chat"; export * from "./src/lib/scheme-requirement-evidence";',
  resolveDir: root.pathname, loader: "ts" }, bundle: true, platform: "node", format: "cjs", write: false });
const module = { exports: {} };
new Function("require", "module", "exports", output.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const matrix = JSON.parse(readFileSync(new URL("src/data/construction-scheme-matrix.json", root)));
const corpus = JSON.parse(readFileSync(new URL("src/data/lpjk-knowledge.json", root)));
const policyText = module.exports.schemeKnowledgeContext({ scheme_code: "BG001" }, "ruang lingkup").split("DATA_SKEMA_TIDAK_TEPERCAYA=")[0];
const bank = buildSchemeAnswerBank({ matrix, corpus, policyText, readSection: module.exports.readSchemeRequirementSection });
const dir = new URL("../../generated-artifacts/scheme-answer-bank/", root);
mkdirSync(dir, { recursive: true });
writeFileSync(new URL("bank-jawaban-acuan.json", dir), JSON.stringify(bank, null, 2) + "\n");
writeFileSync(new URL("bank-jawaban-acuan.html", dir), renderSchemeAnswerBank(bank));
const cell = value => {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return `"${text.replace(/"/g, '""')}"`;
};
const csv = [
  ["ID", "Kategori", "Berlaku untuk", "Pertanyaan", "Jawaban acuan", "Poin wajib", "Klarifikasi", "Klaim terlarang", "Bukti"],
  ...bank.cases.map(item => [item.id, item.category, item.appliesTo.join("; "), item.question, item.answer,
    item.requiredPoints.join("; "), item.clarificationQuestions.join("; "), item.forbiddenClaims.join("; "),
    item.evidenceIds.map(id => {
      const source = bank.evidence[id];
      return source.kind === "pdf" ? `${source.id} halaman PDF ${source.page}`
        : source.kind === "text" ? `${source.id} baris ${source.lineStart}-${source.lineEnd}` : source.title;
    }).join("; ")]),
].map(row => row.map(cell).join(",")).join("\r\n");
writeFileSync(new URL("bank-jawaban-acuan.csv", dir), "\uFEFF" + csv + "\r\n");
console.log(JSON.stringify({ ...bank.counts, apiCalls: bank.apiCalls, runtimeConnected: bank.runtimeConnected, directory: dir.pathname }));
