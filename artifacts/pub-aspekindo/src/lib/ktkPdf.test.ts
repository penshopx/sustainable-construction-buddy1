import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import type { DocumentAnalysis } from "@workspace/api-client-react";
import { ktkReadiness, ktkActionPlan, validateKtkAgency } from "./ktkReadiness.ts";
import { buildKtkPdf } from "./ktkPdf.ts";

const require = createRequire(new URL("../../../api-server/package.json", import.meta.url));
const parsePdf = require("pdf-parse/lib/pdf-parse.js");
const fixture = (): DocumentAnalysis => ({
  id: "00000000-0000-4000-8000-000000000001",
  documentId: "00000000-0000-4000-8000-000000000002",
  documentName: "Kontrak uji.pdf", createdAt: "2026-10-31T12:00:00Z",
  model: "anthropic/claude-sonnet-4.5", sourceCharacters: 100, analyzedCharacters: 100,
  truncated: false,
  result: {
    category: "Kontrak", summary: "Pekerjaan renovasi berlangsung 90 hari.",
    checklist: [{ item: "Masa pelaksanaan", status: "ada", evidence: "90 hari" }],
    risks: [], regulations: [],
  },
  messages: [{ id: "00000000-0000-4000-8000-000000000003", role: "user",
    content: "CHAT-PRIVAT-JANGAN-DIEKSPOR", createdAt: "2026-10-31T12:00:00Z" }],
});

test("traffic-light status is conservative for missing evidence, risks and partial analysis", () => {
  const a = fixture();
  assert.equal(ktkReadiness(a).level, "green");
  a.truncated = true;
  assert.equal(ktkReadiness(a).level, "yellow");
  a.truncated = false;
  a.result.checklist = [];
  assert.equal(ktkReadiness(a).level, "yellow");
  a.result.checklist = [{ item: "Bukti", status: "perlu_dicek", evidence: "" }];
  assert.equal(ktkReadiness(a).level, "yellow");
  a.result.checklist[0].status = "tidak_ditemukan";
  assert.equal(ktkReadiness(a).level, "red");
  a.result.checklist[0].status = "ada";
  a.result.risks = [{ title: "Denda", severity: "rendah", evidence: "denda", recommendation: "Periksa" }];
  assert.equal(ktkReadiness(a).level, "yellow");
  a.result.risks[0].severity = "tinggi";
  assert.equal(ktkReadiness(a).level, "red");
});

test("action plan uses recorded findings, prioritizes high risks, and covers limitations", () => {
  const a = fixture();
  a.truncated = true;
  a.result.checklist = [{ item: "Lampiran SKK", status: "tidak_ditemukan", evidence: "" },
    { item: "Tanggal akhir", status: "perlu_dicek", evidence: "" }];
  a.result.risks = [
    { title: "Risiko rendah", severity: "rendah", evidence: "kutipan", recommendation: "Tinjau" },
    { title: "Klausul sepihak", severity: "tinggi", evidence: "kutipan", recommendation: "Klarifikasi klausul" },
  ];
  a.result.regulations = [{ title: "UU 2 Tahun 2017", evidence: "kutipan", note: "Periksa sumber resmi." }];
  const plan = ktkActionPlan(a);
  assert.match(plan[0], /Prioritas utama.*Klausul sepihak/);
  assert.ok(plan.some(s => s.includes("Lampiran SKK")));
  assert.ok(plan.some(s => s.includes("Tanggal akhir")));
  assert.ok(plan.some(s => s.includes("belum tercakup")));
  assert.ok(plan.some(s => s.includes("UU 2 Tahun 2017")));
});

test("agency is required, bounded and normalized", () => {
  assert.equal(validateKtkAgency("  CV Maju   Konsultan  "), "CV Maju Konsultan");
  assert.throws(() => validateKtkAgency(" \n "));
  assert.throws(() => validateKtkAgency("a".repeat(121)));
  assert.throws(() => validateKtkAgency("Biro\0Contoh"));
});

test("actual PDF contains agency, traffic-light label, executive summary and plan, not private chat", async () => {
  const a = fixture();
  const pdf = buildKtkPdf(a, "CV Maju Konsultan Konstruksi", new Date("2026-10-31T12:10:00Z"));
  const bytes = Buffer.from(pdf.output("arraybuffer"));
  assert.equal(bytes.subarray(0, 5).toString(), "%PDF-");
  const parsed = await parsePdf(new Uint8Array(bytes));
  for (const required of ["KNOWLEDGE TRANSFER KIT", "CV Maju Konsultan Konstruksi",
    "Hijau - siap ditinjau", "Ringkasan eksekutif", "90 hari", "Risiko",
    "Regulasi relevan", "Action plan untuk klien", "bukan nasihat hukum"]) {
    assert.ok(parsed.text.includes(required), `Missing PDF text: ${required}`);
  }
  assert.ok(!parsed.text.includes("CHAT-PRIVAT-JANGAN-DIEKSPOR"));
  assert.ok(parsed.numpages >= 1);
});

test("long reports paginate with the full agency in every header/footer and keep the final action", async () => {
  const a = fixture();
  a.truncated = true;
  a.result.summary = "Ringkasan panjang yang tetap perlu diverifikasi. ".repeat(100);
  a.result.checklist = Array.from({ length: 20 }, (_, i) => ({
    item: `Persyaratan ${i + 1} ${"dokumen pendukung ".repeat(10)}`,
    status: "perlu_dicek" as const, evidence: "Bukti dokumen belum terkonfirmasi.",
  }));
  a.result.risks = Array.from({ length: 15 }, (_, i) => ({
    title: `Risiko ${i + 1}`, severity: "sedang" as const, evidence: "Klausul dokumen uji.",
    recommendation: "Klarifikasi risiko dengan pihak terkait. ".repeat(10),
  }));
  a.result.regulations = [{ title: "UU 2 Tahun 2017", evidence: "UU 2 Tahun 2017", note: "Periksa sumber resmi." }];
  const pdf = buildKtkPdf(a, "CV Maju Konsultan Konstruksi");
  const pages: string[] = [];
  const parsed = await parsePdf(new Uint8Array(pdf.output("arraybuffer")), {
    pagerender: async (page: { getTextContent: () => Promise<{ items: { str: string }[] }> }) => {
      const text = (await page.getTextContent()).items.map(item => item.str).join("\n");
      pages.push(text);
      return text;
    },
  });
  assert.ok(parsed.numpages > 3);
  for (const [index, page] of pages.entries()) {
    assert.ok((page.match(/CV Maju Konsultan Konstruksi/g) || []).length >= 2, `Missing agency on page ${index + 1}`);
    assert.ok(page.includes(`Halaman ${index + 1} / ${pages.length}`));
  }
  assert.match(parsed.text, /CAKUPAN TERBATAS/);
  assert.match(parsed.text, /sebelum pengajuan, penandatanganan/);
  assert.match(pages.at(-1)!, /Catatan penggunaan/);
});
