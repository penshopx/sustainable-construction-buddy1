// No member files, database, accounts, or automatic retries. See vault-ocr-synthetic/README.md.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";
import { generateFixtures } from "./vault-ocr-synthetic/fixtures.mjs";
import { evaluate } from "./vault-ocr-synthetic/score.mjs";
import { buildSyntheticWorker, extractSyntheticFixture } from "./vault-ocr-synthetic/worker.mjs";

const live = process.env.RS_OCR_SYNTHETIC_LIVE === "1";
if (live && (process.env.RS_OCR_PAID_APPROVED !== "1" || process.env.RS_OCR_CREDIT_CONFIRMED !== "1")) {
  throw new Error("Paid testing approval AND confirmation of adequate provider credit/limits are required.");
}
if (live && !process.env.OPENROUTER_API_KEY) throw new Error("OCR provider is not configured.");
const dir = new URL("../../../generated-artifacts/vault-ocr-synthetic/", import.meta.url);
await mkdir(dir, { recursive: true });
// Invalidate old success before any preparation/build/provider failure.
const report = { mode: live ? "live-provider" : "offline-fixtures-only", accuracyProven: false, status: "preparing", results: [] };
const save = () => writeFile(new URL("result.json", dir), JSON.stringify(report, null, 2));
await save();
try {
  const fixtures = await generateFixtures(dir);
  if (!live) {
    report.status = "not-run";
    report.reason = "Fixtures prepared only; no OCR accuracy claim and no provider calls.";
  } else {
    const workerPath = new URL("extractor.cjs", dir);
    await buildSyntheticWorker(workerPath);
    const bundle = await build({
      entryPoints: [fileURLToPath(new URL("../src/lib/vault-sources.ts", import.meta.url))],
      bundle: true, platform: "node", format: "cjs", write: false,
    });
    const module = { exports: {} };
    new Function("module", "exports", bundle.outputFiles[0].text)(module, module.exports);
    const reference = JSON.parse(await readFile(new URL("vault-ocr-synthetic/reference.json", import.meta.url)));
    report.status = "running";
    report.model = "anthropic/claude-sonnet-4.5";
    for (const fixture of fixtures) {
      const result = await extractSyntheticFixture(workerPath, fixture, process.env.OPENROUTER_API_KEY);
      const sources = module.exports.vaultSourceWindows({
        id: fixture.id, name: fixture.id, text: result.text, ocrPages: result.pages,
      });
      const scored = evaluate(reference[fixture.reference], result, sources, fixture.id);
      report.results.push({ id: fixture.id, ...scored });
      // Only generated, non-personal text can be written by this fixed fixture runner.
      await writeFile(new URL(`${fixture.id}-observed.json`, dir), JSON.stringify({ ...result, sources }, null, 2));
      await save();
    }
    report.accuracyProven = report.results.every(r => r.pass);
    report.status = report.accuracyProven ? "passed" : "failed";
    if (!report.accuracyProven) process.exitCode = 1;
  }
} catch (error) {
  report.status = "blocked-or-failed";
  // Never expose provider output, credentials, or raw exception messages.
  report.error = /^OCR_[A-Z_]+$/.test(error?.message ?? "") ? error.message : "CHECK_FAILED";
  process.exitCode = 1;
} finally {
  await save();
}
console.log(JSON.stringify(report, null, 2));
