import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { Script, createContext } from "node:vm";
import { build } from "esbuild";
import { buildSchemeAnswerBank } from "../scripts/scheme-answer-bank.mjs";
import { renderSchemeAnswerBank } from "../scripts/scheme-answer-bank-report.mjs";

const matrix = JSON.parse(readFileSync(new URL("../src/data/construction-scheme-matrix.json", import.meta.url)));
const corpus = JSON.parse(readFileSync(new URL("../src/data/lpjk-knowledge.json", import.meta.url)));
const built = await build({ stdin: { contents: 'export * from "./src/lib/scheme-chat"; export * from "./src/lib/scheme-requirement-evidence";',
  resolveDir: new URL("..", import.meta.url).pathname, loader: "ts" }, bundle: true, platform: "node", format: "cjs", write: false });
const module = { exports: {} };
new Function("require", "module", "exports", built.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const policyText = module.exports.schemeKnowledgeContext({ scheme_code: "BG001" }, "ruang lingkup").split("DATA_SKEMA_TIDAK_TEPERCAYA=")[0];
const input = { matrix, corpus, policyText, readSection: module.exports.readSchemeRequirementSection };
const bank = buildSchemeAnswerBank(input);

test("214 non-AI reference cases cover all profiles and retain explicit review boundaries", () => {
  assert.equal(bank.cases.length, 214);
  assert.equal(new Set(bank.cases.map(item => item.id)).size, 214);
  assert.equal(bank.runtimeConnected, false);
  assert.equal(bank.apiCalls, 0);
  assert.match(bank.reviewGuidance, /alternatif/);
  const rows = new Map(matrix.records.map(row => [row.code, row]));
  for (const row of matrix.records) {
    const mapping = bank.cases.find(item => item.id === `${row.code}-mapping`);
    const scope = bank.cases.find(item => item.id === `${row.code}-scope`);
    assert.ok(mapping.answer.includes(row.kbliCode));
    assert.ok(scope.answer.includes(row.subclassificationScope.text));
    for (const category of ["Penjualan tahunan", "Kemampuan keuangan", "Tenaga kerja", "Peralatan", "Administrasi", "Anti-penyuapan"]) {
      assert.ok(bank.cases.some(item => item.category === category && item.appliesTo.includes(row.code)), `${row.code}/${category}`);
    }
  }
  for (const item of bank.cases) {
    assert.ok(item.question && item.answer && item.requiredPoints.length && item.forbiddenClaims.length);
    assert.ok(item.evidenceIds.length);
    assert.ok(item.appliesTo.every(code => rows.has(code)));
    for (const id of item.evidenceIds) assert.ok(bank.evidence[id]);
  }
});

test("every quoted PDF, text line and application policy is grounded in its original source", () => {
  for (const item of Object.values(bank.evidence)) {
    if (item.kind === "application_policy") {
      assert.ok(policyText.includes(item.quote));
      assert.equal(item.id, "POLICY-SCHEME");
      assert.match(item.title, /bukan sumber hukum/);
      continue;
    }
    const doc = corpus.documents.find(doc => doc.id === item.id);
    assert.equal(bank.sourceFingerprints[item.id], doc.sha256);
    if (item.kind === "pdf") assert.ok(doc.pages.find(page => page.page === item.page).text.includes(item.quote));
    else assert.equal(item.quote, doc.lines.filter(line => line.line >= item.lineStart && line.line <= item.lineEnd).map(line => line.text).join("\n"));
  }
  assert.equal(bank.cases.filter(item => item.kind === "application_policy").length, 7);
  for (const item of bank.cases.filter(item => item.kind === "application_policy")) {
    assert.ok(item.evidenceIds.every(id => bank.evidence[id].kind === "application_policy"));
  }
  assert.match(bank.cases.find(item => item.id === "boundary-shared-kbli").answer, /Perkerasan Aspal/);
  assert.match(bank.cases.find(item => item.id === "boundary-mapping-disagreement").answer, /42991[\s\S]*42915/);
  assert.match(bank.cases.find(item => item.id === "boundary-missing-copied-row").answer, /33203/);
  assert.throws(() => buildSchemeAnswerBank({ ...input, policyText: "" }), /Missing policy anchor/);
});

test("source changes require review instead of silently retaining an obsolete reference answer", () => {
  const changed = structuredClone(matrix);
  changed.records.find(row => row.code === "BG001").kbli2025.text += " pembongkaran";
  assert.throws(() => buildSchemeAnswerBank({ ...input, matrix: changed }), /Source drift/);
  const changedCopy = structuredClone(corpus);
  changedCopy.documents.find(doc => doc.id === "KB45").lines.push({ line: 80, text: "IN014" });
  assert.throws(() => buildSchemeAnswerBank({ ...input, corpus: changedCopy }), /copied-table omission/);
});

class Element {
  constructor(tag) { this.tag = tag; this.children = []; this.value = ""; this.textContent = ""; this.handlers = {}; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  addEventListener(name, fn) { this.handlers[name] = fn; }
}
test("offline report supports profile/category/search filters, pagination, and an explicit empty result", () => {
  const html = renderSchemeAnswerBank(bank);
  const ids = Object.fromEntries(["bank", "profile", "category", "search", "cases", "count", "page", "previous", "next"].map(id => [id, new Element(id)]));
  ids.bank.textContent = html.match(/<script type="application\/json" id="bank">([\s\S]*?)<\/script>/)[1];
  const document = { getElementById: id => ids[id], createElement: tag => new Element(tag) };
  const script = html.match(/<script>\n([\s\S]*?)<\/script>/)[1];
  new Script(script).runInContext(createContext({ document }));
  assert.equal(ids.profile.children.length, 77);
  assert.equal(ids.cases.children.length, 12);
  assert.match(ids.count.textContent, /214/);
  ids.profile.value = "BG001"; ids.profile.handlers.change();
  assert.equal(ids.next.disabled, false);
  ids.next.handlers.click();
  assert.equal(ids.previous.disabled, false);
  ids.category.value = "Batas perilaku aplikasi"; ids.category.handlers.change();
  assert.equal(ids.cases.children.length, 7);
  ids.profile.value = "IN014"; ids.category.value = ""; ids.profile.handlers.change();
  assert.equal(ids.cases.children.length, 9);
  ids.search.value = "tidak-ada-hasil-unik"; ids.search.handlers.input();
  assert.match(ids.cases.children[0].textContent, /Tidak ada kasus/);
  assert.equal(ids.next.disabled, true);
  assert.equal(/<(?:script|link)[^>]+(?:src|href)\s*=/i.test(html), false);
});

test("uploaded-source markup cannot escape the embedded JSON or become executable HTML", () => {
  const altered = structuredClone(bank);
  const attack = "</script><img src=x onerror=alert(1)>";
  altered.cases[0].answer = attack;
  const html = renderSchemeAnswerBank(altered);
  assert.equal(html.includes(attack), false);
  const parsed = JSON.parse(html.match(/<script type="application\/json" id="bank">([\s\S]*?)<\/script>/)[1]);
  assert.equal(parsed.cases[0].answer, attack);
  assert.equal(html.includes("innerHTML"), false);
});
