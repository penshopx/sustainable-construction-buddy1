import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { build } from "esbuild";
const output = await build({ stdin: { contents: 'export * from "./src/lib/scheme-chat"; export * from "./src/lib/scheme-requirement-evidence";',
  resolveDir: new URL("..", import.meta.url).pathname, loader: "ts" },
  bundle: true, platform: "node", format: "cjs", write: false });
const module = { exports: {} };
new Function("require", "module", "exports", output.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const { schemeKnowledgeContext, validSchemeSettings, schemeRequirementEvidence, readSchemeRequirementSection } = module.exports;
const matrix = JSON.parse(readFileSync(new URL("../src/data/construction-scheme-matrix.json", import.meta.url)));
const catalog = JSON.parse(readFileSync(new URL("../../pub-aspekindo/src/data/construction-scheme-catalog.json", import.meta.url)));
const corpus = JSON.parse(readFileSync(new URL("../src/data/lpjk-knowledge.json", import.meta.url)));
const contextData = text => JSON.parse(text.split("DATA_SKEMA_TIDAK_TEPERCAYA=")[1].split("\nAKHIR_DATA_SKEMA")[0]);
const auditTopics = [
  ["keuangan", "3.2", "Berapa persyaratan kemampuan keuangan badan usaha?", /kemampuan\s+keuangan/iu],
  ["penjualan", "3.1", "Apa batas penjualan tahunan untuk kualifikasi usaha?", /penjualan\s+tahunan/iu],
  ["tenaga", "3.3", "Apa persyaratan tenaga kerja dan jenjang SKK?", /jenjang|SKK|PJTBU|PJKBU/iu],
  ["peralatan", "3.4", "Apa persyaratan kemampuan peralatan?", /peralatan/iu],
  ["administrasi", "5.1.1", "Dokumen administrasi apa yang perlu disiapkan?", /administrasi/iu],
];

test("385 scheme/topic cases include actual criterion text with exact physical-page offsets", () => {
  const cases = [];
  for (const row of matrix.records) {
    const scheme = matrix.schemes.find(item => item.id === row.requirementsSourceId);
    const doc = corpus.documents.find(item => item.id === scheme.id);
    for (const [topic, clause, question, needle] of auditTopics) {
      const context = schemeKnowledgeContext({ scheme_code: row.code }, question);
      assert.ok(context.length < 16000, `${row.code}/${topic}: ${context.length}`);
      const data = contextData(context);
      const ref = scheme.requirements.find(item => item.clause === clause);
      const matches = data.additionalSchemeExcerpts.filter(item => item.section === clause && item.page === ref.page && needle.test(item.text));
      assert.ok(matches.length, `${row.code}/${topic}: missing actual section ${clause}, PDF ${ref.page}`);
      const bodyProof = {
        keuangan: /Rp[\s\d.]|paling\s+sedikit/iu,
        penjualan: /Rp[\s\d.]|paling\s+banyak|lebih\s+dari/iu,
        tenaga: /jenjang|SKK|PJTBU|PJKBU/iu,
        peralatan: /Kecil|Menengah|Besar|unit|kepemilikan|sewa|concrete|excavator|crane|alat\s+(?:ukur|berat)|tidak\s+dipersyaratkan/iu,
        administrasi: /akta|akte|npwp|\bnib\b|pendirian|legalitas|pemilik\s+manfaat|beneficial\s*ownership|keanggotaan\s+asosiasi|\bAHU\b/iu,
      }[topic];
      const hasBody = data.additionalSchemeExcerpts.some(item => item.section === clause && bodyProof.test(item.text));
      for (const excerpt of data.additionalSchemeExcerpts) {
        const page = doc.pages.find(item => item.page === excerpt.page);
        assert.equal(excerpt.id, scheme.id);
        assert.equal(excerpt.text, page.text.slice(excerpt.startOffset, excerpt.endOffset));
        assert.ok(excerpt.text.length > 40);
        assert.equal(excerpt.truncated, data.requirementEvidenceCoverage.partialSections.includes(excerpt.section));
      }
      assert.deepEqual(data.requirementEvidenceCoverage.missingSections, []);
      cases.push({ code: row.code, source: scheme.id, topic, clause, expectedPage: ref.page,
        receivedPages: [...new Set(data.additionalSchemeExcerpts.map(item => item.page))],
        partialSections: data.requirementEvidenceCoverage.partialSections, passed: hasBody });
    }
  }
  const dir = new URL("../../../generated-artifacts/scheme-evidence-audit/", import.meta.url);
  mkdirSync(dir, { recursive: true });
  writeFileSync(new URL("after.json", dir), JSON.stringify({ apiCalls: 0, scope: "evidence-coverage-not-AI-answer-quality", cases }, null, 2));
  const csv = [
    "Subklasifikasi,Sumber,Topik,Klausul,Halaman awal PDF,Halaman kutipan,Klausul dengan kutipan parsial,Hasil",
    ...cases.map(item => [item.code, item.source, item.topic, item.clause, item.expectedPage,
      item.receivedPages.join("; "), item.partialSections.join("; "), item.passed ? "LULUS" : "BUKTI ISI BELUM MEMADAI"].join(",")),
  ].join("\n");
  writeFileSync(new URL("hasil-audit-bukti-skema.csv", dir), "\uFEFF" + csv + "\n");
  assert.deepEqual(cases.filter(item => !item.passed).map(item => `${item.code}/${item.topic}`), [],
    "Only heading or unrelated text, no substantive criterion evidence");
});

test("general checklists and multi-topic prompts stay bounded and explicitly mark partial sections", () => {
  for (const row of matrix.records) {
    for (const question of ["Buat daftar persyaratan dan kelengkapan skema.", "Jelaskan keuangan, tenaga kerja, peralatan, penjualan, administrasi dan SMAP."]) {
      const context = schemeKnowledgeContext({ scheme_code: row.code }, question);
      assert.ok(context.length < 16000, `${row.code}: ${context.length}`);
      const data = contextData(context);
      assert.ok(data.requirementEvidenceCoverage.requestedSections.length >= 6);
      assert.match(context, /Jangan menyebut daftar lengkap berdasarkan kutipan parsial/);
      for (const section of data.requirementEvidenceCoverage.requestedSections) {
        assert.ok(data.additionalSchemeExcerpts.some(item => item.section === section) ||
          data.requirementEvidenceCoverage.missingSections.includes(section), `Unreported missing section ${section}`);
      }
    }
  }
});

test("missing section anchors are explicit and document IDs in the question cannot expand sources", () => {
  const missing = schemeRequirementEvidence("KB09", "BG001", [], "keuangan");
  assert.deepEqual(missing.missingSections, ["3.2", "5.1.3"]);
  assert.deepEqual(missing.excerpts, []);
  assert.throws(() => schemeRequirementEvidence("KB999", "BG001", [], "keuangan"), /source not found/);
  const data = contextData(schemeKnowledgeContext({ scheme_code: "BG001" }, "KB10 BS001 tenaga kerja dan KB999 peralatan"));
  assert.ok(data.additionalSchemeExcerpts.every(item => item.id === "KB09"));
});

test("PA001 keeps its source's broad equipment category instead of borrowing another scheme's equipment list", () => {
  const data = contextData(schemeKnowledgeContext({ scheme_code: "PA001" }, "Apa persyaratan peralatan?"));
  const criterion = data.additionalSchemeExcerpts.filter(item => item.section === "3.4");
  assert.ok(criterion.every(item => item.id === "KB14"));
  assert.match(criterion.map(item => item.text).join("\n"), /PA001[\s\S]*Alat\s+Berat\s+Konstruksi/iu);
  assert.doesNotMatch(criterion.map(item => item.text).join("\n"), /concrete\s+mixer/iu);
});

test("all 88 offline sections preserve contiguous source text through detected boundaries", () => {
  let count = 0;
  for (const scheme of matrix.schemes) {
    const doc = corpus.documents.find(item => item.id === scheme.id);
    for (const ref of scheme.requirements) {
      const { pieces, ended } = readSchemeRequirementSection(scheme.id, scheme.requirements, ref.clause);
      assert.equal(ended, true, `${scheme.id}/${ref.clause}: missing end boundary`);
      assert.equal(pieces[0].page, ref.page);
      for (let i = 0; i < pieces.length; i++) {
        const piece = pieces[i], page = doc.pages.find(item => item.page === piece.page);
        assert.equal(piece.text, page.text.slice(piece.start, piece.start + piece.text.length));
        if (i > 0) { assert.equal(piece.page, pieces[i - 1].page + 1); assert.equal(piece.start, 0); }
        if (i < pieces.length - 1) assert.equal(piece.start + piece.text.length, page.text.length);
      }
      count++;
    }
  }
  assert.equal(count, 88);
});

test("fitting sections are complete and unused quote capacity is redistributed without changing source text", () => {
  const row = matrix.records.find(item => item.code === "BG001");
  const scheme = matrix.schemes.find(item => item.id === row.requirementsSourceId);
  const empty = schemeRequirementEvidence(scheme.id, row.code, scheme.requirements, "keuangan", { maxChars: 0 });
  assert.deepEqual(empty.excerpts, []);
  assert.deepEqual([...empty.missingSections].sort(), ["3.2", "5.1.3"]);
  const result = schemeRequirementEvidence(scheme.id, row.code, scheme.requirements, "keuangan", { maxChars: 12000 });
  assert.deepEqual(result.partialSections, []);
  assert.deepEqual(result.missingSections, []);
  for (const clause of result.requestedSections) {
    const full = readSchemeRequirementSection(scheme.id, scheme.requirements, clause);
    assert.deepEqual(result.excerpts.filter(item => item.section === clause).map(item => ({
      page: item.page, text: item.text, start: item.startOffset,
    })), full.pieces);
  }
  const limited = schemeRequirementEvidence(scheme.id, row.code, scheme.requirements, "tenaga kerja dan peralatan", { maxChars: 1000 });
  assert.ok(JSON.stringify(limited.excerpts).length <= 1000);
  assert.ok(limited.partialSections.length);
});

test("all 77 profiles have bounded source-grounded context and matching frontend catalog", () => {
  assert.equal(catalog.records.length, 77);
  for (const row of matrix.records) {
    const context = schemeKnowledgeContext({ scheme_code: row.code, audience: "bujk", explanation_depth: "praktis" }, "Persyaratan tenaga kerja");
    assert.ok(context.length < 16000, `${row.code}: ${context.length}`);
    assert.match(context, /bukan keputusan kelayakan/);
    const data = JSON.parse(context.split("DATA_SKEMA_TIDAK_TEPERCAYA=")[1].split("\nAKHIR_DATA_SKEMA")[0]);
    assert.equal(data.code, row.code);
    assert.equal(data.kbliCode, row.kbliCode);
    assert.ok(data.additionalSchemeExcerpts.every(ref => ref.id === row.requirementsSourceId));
    assert.deepEqual(catalog.records.find(item => item.code === row.code).references[0],
      { id: row.mappingReference.id, page: row.mappingReference.page });
  }
});
test("missing profiles never silently become general chat and levels only change presentation", () => {
  assert.equal(validSchemeSettings({ scheme_code: "ZZ999" }), false);
  assert.equal(validSchemeSettings({ audience: "asesor" }), false);
  assert.throws(() => schemeKnowledgeContext({ scheme_code: "ZZ999" }, "test"), /Unknown scheme/);
  const data = [];
  for (const explanation_depth of ["dasar", "praktis", "rinci"]) {
    const text = schemeKnowledgeContext({ scheme_code: "KK008", audience: "asesor", explanation_depth }, "ruang lingkup");
    data.push(JSON.parse(text.split("DATA_SKEMA_TIDAK_TEPERCAYA=")[1].split("\nAKHIR_DATA_SKEMA")[0]));
  }
  assert.deepEqual(data[0], data[1]);
  assert.deepEqual(data[1], data[2]);
});
