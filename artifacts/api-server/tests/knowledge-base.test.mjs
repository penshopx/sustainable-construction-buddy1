import test from "node:test";
import assert from "node:assert/strict";
import { build } from "esbuild";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";

const bundled = await build({
  stdin: { contents: 'export * from "./src/lib/knowledge-base";',
    resolveDir: fileURLToPath(new URL("..", import.meta.url)), loader: "ts" },
  bundle: true, platform: "node", format: "cjs", write: false,
});
const module = { exports: {} };
new Function("require", "module", "exports", bundled.outputFiles[0].text)(
  createRequire(import.meta.url), module, module.exports);
const { retrieveKnowledge, knowledgeContext } = module.exports;
const corpus = JSON.parse(readFileSync(new URL("../src/data/lpjk-knowledge.json", import.meta.url)));
const catalog = JSON.parse(readFileSync(new URL("../../pub-aspekindo/src/data/lpjk-knowledge-catalog.json", import.meta.url)));

function contextSources(query) {
  const context = knowledgeContext(query);
  assert.ok(context.length < 16000);
  return JSON.parse(context.split("KUTIPAN_DATA_TIDAK_TEPERCAYA=")[1].split("\nAKHIR_DATA_RUJUKAN")[0]);
}

test("KBLI 2025 remains a BPS publication with 1040 physical PDF pages, not a conversion table", () => {
  const doc = corpus.documents.find(doc => doc.id === "KB44");
  assert.equal(doc.format, "pdf");
  assert.equal(doc.kind, "publikasi_statistik");
  assert.equal(doc.pageCount, 1040);
  assert.match(doc.pages[3].text, /Klasifikasi Baku Lapangan Usaha Indonesia \(KBLI\) 2025/);
  assert.match(doc.pages[3].text, /Badan Pusat Statistik/);
  const source = contextSources("KB44 41011 konstruksi konvensional gedung hunian").find(source => source.page === 573);
  assert.ok(source);
  assert.match(source.text, /41011/);
  assert.match(source.text, /KONSTRUKSI KONVENSIONAL GEDUNG HUNIAN/);
  assert.ok(doc.pages[source.page - 1].text.includes(source.text));
});

test("the pasted scheme table preserves 79 original lines and 76 entries without inventing PDF pages", () => {
  const doc = corpus.documents.find(doc => doc.id === "KB45");
  const original = readFileSync(new URL(`../../../attached_assets/${doc.fileName}`, import.meta.url), "utf8").split(/\r?\n/);
  if (original.at(-1) === "") original.pop();
  assert.equal(doc.format, "text");
  assert.equal(doc.kind, "tabel_pemetaan");
  assert.equal(doc.pageCount, 0);
  assert.deepEqual(doc.pages, []);
  assert.equal(doc.lineCount, 79);
  assert.equal(doc.entryCount, 76);
  assert.deepEqual(doc.lines.map(row => row.text), original);
  const rows = doc.lines.filter(row => /^[A-Z]{2}\d{3}\s*\d{5}/.test(row.text));
  assert.deepEqual(Object.fromEntries(["BG", "BS", "IN", "KK", "KP", "PA", "PB", "PL"].map(prefix => [
    prefix, rows.filter(row => row.text.startsWith(prefix)).length,
  ])), { BG: 9, BS: 20, IN: 12, KK: 16, KP: 2, PA: 1, PB: 8, PL: 8 });
  assert.match(doc.note, /versi KBLI.*belum tersedia/);
  assert.match(doc.note, /baris yang kosong/);
});

test("text-table retrieval cites original lines, supports line selectors, and never reports PDF pages", () => {
  for (const [query, line] of [["KB45 BG001 41011 hunian", 3], ["KB45 BG002 41012 perkantoran", 4], ["KB45 baris 78", 78]]) {
    const sources = contextSources(query);
    assert.ok(sources.some(source => source.lineStart === line), query);
    for (const source of sources) {
      assert.equal(source.id, "KB45");
      assert.equal(source.page, null);
      assert.equal(source.method, "text_file");
      assert.equal(source.lineStart, source.lineEnd);
      assert.ok(corpus.documents.find(doc => doc.id === "KB45").lines[source.lineStart - 1].text.includes(source.text));
    }
  }
  assert.deepEqual(retrieveKnowledge("KB45 halaman PDF 1"), []);
  assert.deepEqual(retrieveKnowledge("KB45 baris 99999"), []);
  assert.ok(retrieveKnowledge("KB45 baris 3–4").every(source => source.lineStart === 3 || source.lineStart === 4));
  assert.match(knowledgeContext("KB45 BG001"), /\[KB45, baris 3\]/);
  assert.match(knowledgeContext("KB45 BG001"), /bukan tabel konversi SBU/);
  assert.match(knowledgeContext("KB45 BG001"), /tanpa URL, tanggal, penerbit, atau versi KBLI terverifikasi/);
});

test("context budgeting preserves each source's best evidence before duplicate-source pages", () => {
  const query = "Apa tujuan PUB untuk badan usaha jasa konstruksi?";
  const retrieved = retrieveKnowledge(query);
  const sources = contextSources(query);
  assert.ok(retrieved.some(source => source.id === "KB18" && source.page === 3 && /bertujuan/.test(source.text)));
  assert.ok(sources.some(source => source.id === "KB18" && source.page === 3 && /bertujuan/.test(source.text)),
    "the substantive PUB clause must survive final context budgeting");
  const firstSources = [...new Map(retrieved.toReversed().map(source => [source.id, source])).values()];
  for (const source of firstSources) {
    assert.ok(sources.some(result => result.id === source.id && result.page === source.page));
  }
  for (const source of sources) {
    assert.ok(retrieved.some(result => JSON.stringify(result) === JSON.stringify(source)),
      "fit whole original excerpts, without cutting text or inventing citations");
  }
  const organizers = contextSources("Siapa yang menyelenggarakan pengembangan usaha berkelanjutan?");
  assert.ok(organizers.some(source => source.id === "KB18" &&
    /Asosiasi\s+Badan\s+Usaha\s+menyelenggarakan|diselenggarakan\s+oleh\s+Asosiasi/iu.test(source.text)),
    "a growing classification corpus must not displace the direct organizer clause");
});

test("greeting-only inputs do not search regulations", () => {
  for (const query of ["Halo, selamat pagi!", "Selamat siang, Pak!", "Hai", "Hello, admin!", "Salam sejahtera", "Terima kasih!"]) {
    assert.deepEqual(retrieveKnowledge(query), [], query);
    assert.deepEqual(contextSources(query), [], query);
  }
});

test("a greeting prefix cannot suppress a substantive question or introduce irrelevant greeting keywords", () => {
  for (const query of [
    "Apa tujuan PUB untuk badan usaha jasa konstruksi?",
    "KB28 I.F.5691",
    "Perpres 46/2025 naskah konsolidasi lengkap",
    "keselamatan kerja konstruksi",
    "hibah pemerintah",
  ]) {
    assert.deepEqual(retrieveKnowledge(`Halo, selamat pagi! ${query}`), retrieveKnowledge(query), query);
  }
  assert.ok(retrieveKnowledge("keselamatan kerja konstruksi").length > 0);
});

test("an exact document ID scopes results and the PUB-purpose question retrieves the substantive clause", () => {
  const query = "Menurut KB18, Permen PUPR Nomor 7 Tahun 2024, apa tujuan Pengembangan Usaha Berkelanjutan bagi BUJK? Jawab singkat berdasarkan kutipan yang tersedia dan cantumkan ID dokumen serta halaman PDF. Jangan menambahkan ketentuan yang tidak ada dalam kutipan.";
  const sources = retrieveKnowledge(query);
  assert.ok(sources.length > 0 && sources.every(source => source.id === "KB18"));
  assert.equal(sources[0].page, 3);
  assert.match(sources[0].text, /Peraturan Menteri ini bertujuan/);
  assert.ok(contextSources(query).some(source => source.id === "KB18" && source.page === 3 && /daya saing BUJK/.test(source.text)));
});

test("document-identity questions retain the actual amendment title page, not a random amended clause", () => {
  const query = "Menurut KB41, Perpres Nomor 46 Tahun 2025 mengubah peraturan apa dan merupakan perubahan keberapa? Apakah PDF KB41 dapat dianggap naskah konsolidasi lengkap seluruh Perpres 16/2018? Jawab singkat, bedakan naskah perubahan dari konsolidasi, dan cantumkan sumber beserta halaman PDF.";
  const sources = contextSources(query);
  assert.equal(sources[0].id, "KB41");
  assert.equal(sources[0].page, 1);
  assert.match(sources[0].text, /PERUBAHAN KEDUA ATAS PERATURAN PRESIDEN NOMOR 16 TAHUN 2018/);
  assert.ok(sources.every(source => source.id === "KB41"));
});

test("a misleading filename range retrieves the real final printed page with a physical PDF citation", () => {
  const query = "Pada KB28, apakah nama file I.F.5249–11000 membuktikan halaman cetak I.F.11000 tersedia? Periksa batas akhir I.F.5691 dan sebutkan halaman PDF yang mendukungnya. Jelaskan batas cakupan berkas, jangan menebak halaman yang tidak tersedia.";
  const sources = contextSources(query);
  assert.equal(sources[0].id, "KB28");
  assert.equal(sources[0].page, 443);
  assert.match(sources[0].text, /I\.F\.5691/);
  assert.ok(sources.every(source => source.id === "KB28"));
  assert.ok(sources.every(source => source.page === 443), "unrecognized OCR page labels must not be guessed or replaced by unrelated pages");
});

test("legal citation variants select the original regulation without requiring a knowledge ID", () => {
  for (const [id, query] of [
    ["KB18", "Permen PUPR Nomor 7 Tahun 2024 tujuan PUB"],
    ["KB19", "Permen PU 6/2025 pengawasan sanksi"],
    ["KB41", "Perpres 46/2025 perubahan kedua"],
    ["KB42", "Peraturan LKPP Nomor 3 Tahun 2026 penyedia"],
    ["KB43", "Peraturan Menteri Pekerjaan Umum Nomor 1 Tahun 2026 kerja sama"],
    ["KB17", "PP 28 2025 persyaratan"],
  ]) {
    const sources = retrieveKnowledge(query);
    assert.ok(sources.length > 0, query);
    assert.ok(sources.every(source => source.id === id), `${query}: original regulation only`);
  }
});

test("unknown document IDs and unavailable regulations do not silently fall back to related documents", () => {
  for (const query of ["KB99 risiko konstruksi", "Perpres 16/2018 pengadaan", "Permen PU 99/2026 persyaratan"]) {
    assert.deepEqual(retrieveKnowledge(query), [], query);
    assert.deepEqual(contextSources(query), [], query);
  }
  assert.ok(retrieveKnowledge("kb 18 tujuan PUB").every(source => source.id === "KB18"));
});

test("explicit physical and printed page selectors never substitute unrelated or nonexistent pages", () => {
  for (const query of ["KB28 halaman PDF 443", "KB28 I.F.5691"]) {
    const sources = retrieveKnowledge(query);
    assert.ok(sources.length > 0, query);
    assert.ok(sources.every(source => source.id === "KB28" && source.page === 443), query);
  }
  assert.deepEqual(retrieveKnowledge("KB28 halaman PDF 99999"), []);
  assert.deepEqual(retrieveKnowledge("KB28 I.F.11000"), []);
  assert.ok(retrieveKnowledge("KB28 halaman PDF 1 dan I.F.5691").every(source => source.page === 1));
});

test("small explicit document comparisons preserve both sources within the existing excerpt budget", () => {
  const query = "Bandingkan KB18 dan KB41: perubahan?";
  const sources = contextSources(query);
  assert.deepEqual(new Set(sources.map(source => source.id)), new Set(["KB18", "KB41"]));
  assert.ok(sources.length <= 4);
});

test("annex sections select the right part, including combined letter ranges", () => {
  for (const [id, query] of [
    ["KB21", "PP 28/2025 Lampiran III analisis risiko"],
    ["KB26", "PP 28/2025 Lampiran I.H pekerjaan umum"],
    ["KB23", "Lampiran I.K persyaratan"],
  ]) {
    const sources = retrieveKnowledge(query);
    assert.ok(sources.length > 0, query);
    assert.ok(sources.every(source => source.id === id), query);
  }
});

test("forty-seven sources retain 15874 physical PDF pages and separate original text lines", () => {
  assert.equal(corpus.documents.length, 47);
  assert.equal(new Set(corpus.documents.map(doc => doc.sha256)).size, 47);
  assert.equal(corpus.documents.reduce((sum, doc) => sum + doc.pageCount, 0), 15874);
  for (const doc of corpus.documents) {
    assert.match(doc.sha256, /^[a-f0-9]{64}$/);
    assert.equal(doc.pages.length, doc.pageCount);
    assert.deepEqual(doc.pages.map(page => page.page), Array.from({ length: doc.pageCount }, (_, index) => index + 1));
    assert.ok(doc.pages.every(page => page.text.length > 0 || doc.pagesNeedingReview.includes(page.page)));
    const { pages, lines, ...metadata } = doc;
    assert.deepEqual(catalog.documents.find(item => item.id === doc.id), metadata);
  }
});

test("Permendagri amendment preserves its identity, pages and actual BMD clauses", () => {
  const doc = corpus.documents.find(doc => doc.id === "KB47");
  assert.equal(doc.pageCount, 140);
  assert.equal(doc.textPageCount, 140);
  assert.match(doc.note, /bukan konsolidasi lengkap/);
  assert.match(doc.note, /bukan OCR atau verifikasi baru/);
  const cover = contextSources("KB47 halaman PDF 1").find(s => s.page === 1);
  assert.match(cover.text, /MENTERI DALAM NEGERI/);
  assert.match(cover.text, /PEDOMAN PENGELOLAAN/);
  const clause = contextSources("KB47 halaman PDF 46 peminjaman dokumen asli kepemilikan").find(s => /Pasal 297F/.test(s.text));
  assert.ok(clause, "the actual BMD clause must survive final context budgeting");
  assert.match(clause.text, /Peminjaman dokumen bukti kepemilikan/);
  assert.equal(clause.page, 46);
  assert.ok(contextSources("KB47 halaman PDF 140").some(s => s.page === 140 && /Petunjuk Pengisian/.test(s.text)));
  assert.deepEqual(retrieveKnowledge("KB47 halaman PDF 141"), []);
});

test("ministry names distinguish Permendagri 7/2024 from Permen PUPR 7/2024", () => {
  for (const query of [
    "Permendagri No. 7 Tahun 2024 pengelolaan barang milik daerah",
    "Peraturan Menteri Dalam Negeri Republik Indonesia Nomor 7 Tahun 2024",
    "Permen Dalam Negeri 7/2024 Pasal 297F",
  ]) {
    const sources = contextSources(query);
    assert.ok(sources.length > 0, query);
    assert.ok(sources.every(s => s.id === "KB47"), query);
  }
  const pub = contextSources("Permen PUPR 7/2024 tujuan PUB");
  assert.ok(pub.some(s => s.id === "KB18" && /bertujuan/.test(s.text)));
  assert.ok(pub.every(s => s.id === "KB18"));
  assert.deepEqual(retrieveKnowledge("Permendagri 19/2016 barang milik daerah"), [],
    "the amendment is not the unavailable original regulation");
  assert.deepEqual(retrieveKnowledge("Permendagri 6/2025"), [],
    "an explicit other ministry must not fall back to Permen PU 6/2025");
  assert.match(knowledgeContext("Permen 7/2024"), /minta penjelasan kementerian/);
});

test("implementation discussion slides retain OCR, provenance and physical page citations", () => {
  const doc = corpus.documents.find(doc => doc.id === "KB46");
  assert.equal(doc.kind, "paparan");
  assert.equal(doc.pageCount, 91);
  assert.match(doc.note, /bukan naskah peraturan/);
  assert.match(doc.pages[0].text, /2025/);
  assert.ok(doc.pages.every(page => page.method === "local_ocr_and_text_layer"));
  const cover = contextSources("KB46 halaman PDF 1 implementasi Permen PU").find(source => source.id === "KB46" && source.page === 1);
  assert.ok(cover);
  assert.match(cover.text, /IMPLEMENTASI/i);
  const ending = contextSources("KB46 halaman PDF 91").find(source => source.id === "KB46" && source.page === 91);
  assert.ok(ending);
  assert.match(ending.text, /Terima\s*kasih/i);
  assert.deepEqual(retrieveKnowledge("KB46 halaman PDF 92"), []);
  const financial = contextSources("KB46 halaman PDF 60 kemampuan keuangan").find(source => source.id === "KB46" && source.page === 60);
  assert.ok(financial);
  assert.match(financial.text, /Tanah\s*&\s*Bangunan/i);
  const discussion = retrieveKnowledge("materi diskusi implementasi Permen PU 6 Tahun 2025 kemampuan keuangan");
  assert.ok(discussion.some(source => source.id === "KB46"));
  assert.ok(discussion.every(source => source.kind === "paparan"));
});

test("scanned decision pages are honestly labelled visual summaries and presentation discrepancies remain visible", () => {
  const decision = corpus.documents.find(doc => doc.id === "KB04");
  assert.deepEqual(decision.visualSummaryPages, [2, 3, 5, 186]);
  assert.equal(decision.pages.filter(page => page.method === "visual_summary").length, 4);
  assert.match(decision.pages[4].text, /bukan transkripsi lengkap/);
  assert.match(corpus.documents.find(doc => doc.id === "KB05").note, /6\/2025/);
  assert.match(corpus.documents.find(doc => doc.id === "KB06").note, /KPTS\/M\/2026/);
});

test("implementation reference complements the PU rules, implementing decision and PUB without inventing legal hierarchy", () => {
  const context = knowledgeContext("Bandingkan KB46 KB19 KB04 KB18 terkait implementasi, standar sertifikasi dan PUB");
  assert.match(context, /bukan rujukan tunggal atau pengganti naskah resmi/);
  assert.match(context, /Permen PUPR 7\/2024 \(KB18\)/);
  assert.match(context, /Jangan menyebut Permen PUPR 7\/2024 sebagai turunan/);
  assert.match(context, /didukung kutipan substantif masing-masing sumber/);
  // Compare each legal source with the discussion separately: four full excerpts
  // plus the catalog can exceed the bounded chat context.
  for (const id of ["KB19", "KB04", "KB18"]) {
    const sources = contextSources(`Bandingkan KB46 ${id} terkait implementasi, standar sertifikasi dan PUB`);
    assert.deepEqual(new Set(sources.map(source => source.id)), new Set(["KB46", id]));
    assert.ok(sources.every(source => source.text.length > 0 && source.page > 0));
  }
});

test("retrieval returns bounded original page excerpts, never nonexistent pages or synthetic summaries", () => {
  const results = retrieveKnowledge("kapan konversi SBU enam bulan surat pemberlakuan penyesuaian skema LSBU");
  assert.ok(results.length > 0 && results.length <= 6);
  const perDocument = new Map();
  for (const source of results) {
    const doc = corpus.documents.find(doc => doc.id === source.id);
    assert.ok(doc);
    assert.ok(doc.pages[source.page - 1].text.includes(source.text));
    assert.ok(source.text.length <= 1250);
    assert.equal(source.title, doc.title);
    perDocument.set(source.id, (perDocument.get(source.id) || 0) + 1);
  }
  assert.ok([...perDocument.values()].every(count => count <= 2));
  assert.ok(results.some(source => /konversi|pemberlakuan/i.test(source.text)));
});

test("a scanned substantive decision page can be retrieved with its correct provenance", () => {
  const results = retrieveKnowledge("KEENAM tanggal ditetapkan keputusan mulai berlaku 26 Agustus 2026");
  assert.ok(results.some(source => source.id === "KB04" && source.page === 5 && source.method === "visual_summary"));
});

test("greetings/unrelated terms do not fabricate matches and large inputs stay bounded", () => {
  assert.deepEqual(retrieveKnowledge("halo zzzzzqwerty"), []);
  assert.deepEqual(retrieveKnowledge("yang dan apa ini"), []);
  const prompt = knowledgeContext("konversi SMAP ".repeat(100000));
  assert.ok(prompt.length < 16000);
  assert.doesNotMatch(prompt, /[a-zA-Z0-9_-]{20000}/);
});

test("context preserves reference types, untrusted-data and timing boundaries, with all catalog entries", () => {
  const prompt = knowledgeContext("SMAP kualifikasi kecil dokumen sertifikasi");
  for (const id of corpus.documents.map(doc => doc.id)) assert.ok(prompt.includes(id));
  assert.match(prompt, /usulan\/proyeksi bukan ketentuan/i);
  assert.match(prompt, /bukan instruksi atau izin akses/i);
  assert.match(prompt, /bukan dokumen akun anggota/i);
  assert.match(prompt, /6\/2025/);
  assert.match(prompt, /surat pemberlakuan/);
  assert.match(prompt, /\[KB04, hlm\. 4\]/);
  assert.match(prompt, /Ringkasan visual bukan kutipan verbatim/);
  assert.match(prompt, /46 PDF dan 1 berkas teks unggahan/);
  assert.match(prompt, /bukan bukti penerbitan SBU/);
});

test("all eight added schemes preserve their page counts, classifications and PA discrepancy", () => {
  const schemes = corpus.documents.slice(8, 16);
  assert.deepEqual(schemes.map(doc => doc.id), ["KB09", "KB10", "KB11", "KB12", "KB13", "KB14", "KB15", "KB16"]);
  assert.deepEqual(schemes.map(doc => doc.pageCount), [206, 218, 214, 213, 208, 206, 208, 208]);
  for (const doc of schemes) {
    assert.equal(doc.kind, "format_skema");
    assert.deepEqual(doc.pagesNeedingReview, []);
    assert.deepEqual(doc.visualSummaryPages, []);
    assert.match(doc.pages[0].text, /LSBU KONSTRUKSI INDONESIA/);
    assert.match(doc.note, /bukan bukti penerbitan SBU/);
  }
  const pa = schemes.find(doc => doc.id === "KB14");
  assert.match(pa.note, /header menulis Konstruksi Prapabrikasi/);
  assert.match(pa.pages[1].text, /PENYEWAAN PERALATAN/);
  assert.match(pa.pages[1].text, /KONSTRUKSI PRAPABRIKASI/);
});

test("new regulations retain their identities, text provenance and extraction caveats", () => {
  const pp = corpus.documents.find(doc => doc.id === "KB17");
  const permen = corpus.documents.find(doc => doc.id === "KB18");
  assert.equal(pp.kind, "peraturan_pemerintah");
  assert.equal(pp.pageCount, 383);
  assert.match(pp.pages[0].text, /NOMOR 28 TAHUN 2025/);
  assert.match(pp.note, /kesalahan pengenalan karakter/);
  assert.equal(permen.kind, "peraturan_menteri");
  assert.equal(permen.pageCount, 169);
  assert.match(permen.pages[0].text, /NOMOR 7 TAHUN 2024/);
  assert.match(permen.pages[0].text, /PENGEMBANGAN USAHA BERKELANJUTAN/);
  for (const doc of [pp, permen]) {
    assert.deepEqual(doc.pagesNeedingReview, []);
    assert.ok(doc.pages.every(page => page.method === "text_layer"));
  }
  const prompt = knowledgeContext("PP 28 2025 dan Permen PUPR 7 2024");
  assert.match(prompt, /jangan otomatis menganggap dokumen lebih baru mencabut dokumen lain/);
  assert.match(prompt, /Jangan menyamakan keduanya/);
});

test("both new regulations can be retrieved with original page references", () => {
  for (const [id, query] of [
    ["KB17", "PP 28 2025 Penyelenggaraan Perizinan Berusaha Berbasis Risiko"],
    ["KB18", "Permen PUPR 7 2024 Pengembangan Usaha Berkelanjutan"],
  ]) {
    const match = retrieveKnowledge(query).find(source => source.id === id);
    assert.ok(match, `${id} must be retrievable`);
    const doc = corpus.documents.find(source => source.id === id);
    assert.ok(doc.pages[match.page - 1].text.includes(match.text));
  }
});

test("Permen PU 6/2025 is a distinct regulation with 393 original page references, not a presentation", () => {
  const doc = corpus.documents.find(source => source.id === "KB19");
  assert.equal(doc.kind, "peraturan_menteri");
  assert.equal(doc.pageCount, 393);
  assert.equal(doc.textPageCount, 393);
  assert.deepEqual(doc.pagesNeedingReview, []);
  assert.deepEqual(doc.visualSummaryPages, []);
  assert.match(doc.pages[0].text, /NOMOR 6 TAHUN 2025/);
  assert.match(doc.pages[0].text, /STANDAR PRODUK\/JASA/);
  assert.match(doc.pages[392].text, /SPAM/);
  const query = "Permen PU 6 2025 Standar Kegiatan Usaha pengawasan pengenaan sanksi";
  const results = retrieveKnowledge(query);
  const match = results.find(source => source.id === "KB19");
  assert.ok(match, "original regulation must be retrievable");
  assert.equal(match.method, "text_layer");
  assert.ok(doc.pages[match.page - 1].text.includes(match.text));
  assert.match(knowledgeContext(query), /utamakan naskah ini dibanding paparan KB05/);
});

test("each new classification is retrievable with a valid original page citation", () => {
  const queries = [
    ["KB09", "BG Bangunan Gedung BG001"], ["KB10", "BS Bangunan Sipil BS001"],
    ["KB11", "IN Instalasi IN001"], ["KB12", "KK Konstruksi Khusus KK001"],
    ["KB13", "KP Konstruksi Prapabrikasi KP001"], ["KB14", "PA Penyewaan Peralatan PA001"],
    ["KB15", "PL Penyiapan Lahan PL001"], ["KB16", "PB Penyelesaian Bangunan PB001"],
  ];
  for (const [id, query] of queries) {
    const results = retrieveKnowledge(query);
    const match = results.find(source => source.id === id);
    assert.ok(match, `${id} must be retrievable`);
    const original = corpus.documents.find(doc => doc.id === id).pages[match.page - 1];
    assert.ok(original.text.includes(match.text));
    assert.equal(match.method, "text_layer");
  }
});

test("all fourteen annex uploads preserve exact lengths and original text, without implying missing pages exist", () => {
  const annexes = corpus.documents.slice(19, 33);
  assert.deepEqual(annexes.map(doc => doc.pageCount), [8, 18, 746, 500, 277, 411, 515, 341, 443, 748, 820, 758, 797, 725]);
  assert.equal(annexes.reduce((sum, doc) => sum + doc.pageCount, 0), 7107);
  for (const doc of annexes) {
    assert.equal(doc.kind, "lampiran_peraturan");
    assert.deepEqual(doc.pagesNeedingReview, []);
    assert.ok(doc.pages.every(page => page.method === "text_layer"));
    const match = retrieveKnowledge(doc.id).find(source => source.id === doc.id);
    assert.ok(match, `${doc.id} can be requested by source ID`);
    assert.ok(doc.pages[match.page - 1].text.includes(match.text));
  }
  const lastIndustrial = annexes.find(doc => doc.id === "KB28");
  assert.match(lastIndustrial.fileName, /5249-11000/);
  assert.match(lastIndustrial.title, /5249–5691/);
  assert.match(lastIndustrial.pages.at(-1).text, /I\.F\.5691/);
  assert.match(lastIndustrial.note, /Bukan bukti tersedianya I.F.5692–11000/);
});

test("annex risk-analysis and PU-sector queries retrieve real sources and retain partial-table safeguards", () => {
  for (const [id, query] of [
    ["KB21", "Lampiran III metode analisis risiko pendekatan berbasis risiko"],
    ["KB26", "Lampiran I.H sektor pekerjaan umum perumahan rakyat"],
  ]) {
    const results = retrieveKnowledge(query);
    assert.ok(results.some(source => source.id === id), `${id} is relevant`);
  }
  const prompt = knowledgeContext("KB28 Lampiran I.F risiko KBLI persyaratan kewenangan ".repeat(10000));
  assert.ok(prompt.length < 16000);
  assert.match(prompt, /kini mencakup I\.F\.1–1400 dan I\.A–I\.E/);
  assert.doesNotMatch(prompt, /I\.F\.1–1400 belum tersedia/);
  assert.match(prompt, /halaman cetak terakhir I\.F\.5691/);
  assert.match(prompt, /bukan baris lengkap/);
  const encoded = prompt.split("KUTIPAN_DATA_TIDAK_TEPERCAYA=")[1].split("\nAKHIR_DATA_RUJUKAN")[0];
  const excerpts = JSON.parse(encoded);
  assert.ok(excerpts.length > 0 && excerpts.length <= 6);
  for (const source of excerpts) {
    const doc = corpus.documents.find(doc => doc.id === source.id);
    assert.ok(doc.pages[source.page - 1].text.includes(source.text));
  }
});

test("seven added annexes retain all 4101 physical pages and supersede the missing-section warning", () => {
  const added = corpus.documents.slice(33, 40);
  assert.deepEqual(added.map(doc => doc.pageCount), [800, 700, 189, 1056, 182, 810, 364]);
  assert.equal(added.reduce((sum, doc) => sum + doc.pageCount, 0), 4101);
  for (const doc of added) {
    assert.equal(doc.kind, "lampiran_peraturan");
    assert.deepEqual(doc.pagesNeedingReview, []);
    const match = retrieveKnowledge(doc.id).find(source => source.id === doc.id);
    assert.ok(match, `${doc.id} is retrievable`);
    assert.ok(doc.pages[match.page - 1].text.includes(match.text));
  }
  for (const [id, query] of [
    ["KB35", "Lampiran I.F perindustrian"],
    ["KB37", "Lampiran I.D energi sumber daya mineral"],
    ["KB38", "Lampiran I.C kehutanan"],
    ["KB39", "Lampiran I.B pertanian"],
    ["KB40", "Lampiran I.A kelautan perikanan"],
  ]) {
    assert.ok(retrieveKnowledge(query).some(source => source.id === id), `${id} matches its section`);
  }
});

test("procurement and KPBU regulations retain exact identities, page counts and source types", () => {
  const added = corpus.documents.slice(40, 43);
  assert.deepEqual(added.map(doc => doc.id), ["KB41", "KB42", "KB43"]);
  assert.deepEqual(added.map(doc => doc.pageCount), [80, 318, 71]);
  assert.deepEqual(added.map(doc => doc.kind), ["peraturan_presiden", "peraturan_lembaga", "peraturan_menteri"]);
  assert.equal(added.reduce((sum, doc) => sum + doc.pageCount, 0), 469);
  for (const doc of added) {
    assert.deepEqual(doc.pagesNeedingReview, []);
    assert.ok(doc.pages.every(page => page.method === "text_layer"));
  }
  assert.match(added[0].pages[0].text, /NOMOR 46 TAHUN 2025/);
  assert.match(added[0].note, /bukan naskah konsolidasi lengkap/);
  assert.match(added[1].pages[0].text, /NOMOR 3 TAHUN 2026/);
  assert.match(added[2].pages[0].text, /NOMOR 1 TAHUN 2026/);
});

test("procurement and KPBU queries retrieve the correct new sources with scope safeguards", () => {
  for (const [id, query] of [
    ["KB41", "Perpres 46 2025 perubahan kedua Perpres 16 2018 pengadaan barang jasa pemerintah"],
    ["KB42", "Peraturan LKPP 3 2026 pedoman persiapan pelaksanaan pengadaan melalui penyedia"],
    ["KB43", "Permen PU 1 2026 KPBU kerja sama pemerintah badan usaha penyediaan infrastruktur"],
  ]) {
    const match = retrieveKnowledge(query).find(source => source.id === id);
    assert.ok(match, `${id} is relevant`);
    const doc = corpus.documents.find(doc => doc.id === id);
    assert.ok(doc.pages[match.page - 1].text.includes(match.text));
    const context = knowledgeContext(query);
    assert.ok(context.length < 16000);
    assert.match(context, /bukan konsolidasi lengkap/);
    assert.match(context, /jangan menyamakan KPBU/);
    const encoded = context.split("KUTIPAN_DATA_TIDAK_TEPERCAYA=")[1].split("\nAKHIR_DATA_RUJUKAN")[0];
    assert.ok(JSON.parse(encoded).some(source => source.id === id), "relevant source survives context budget");
  }
});

test("100 repeated-text pages remain citable but are not indexed as independent evidence", () => {
  const doc = corpus.documents.find(source => source.id === "KB34");
  const repeated = doc.pages.filter(page => page.duplicateOf);
  assert.equal(repeated.length, 100);
  assert.deepEqual(repeated.map(page => page.page), Array.from({ length: 100 }, (_, index) => index + 601));
  for (const page of repeated) {
    assert.equal(page.duplicateOf, page.page - 100);
    assert.equal(page.text, doc.pages[page.duplicateOf - 1].text);
  }
  assert.match(doc.pages[700].text, /I\.F\.1301/);
  assert.match(doc.pages[799].text, /I\.F\.1400/);
  assert.match(doc.note, /100 halaman berulang/);
  for (const query of ["KB34", "KB34 I.F.1201", doc.pages[600].text.slice(0, 300)]) {
    for (const result of retrieveKnowledge(query).filter(source => source.id === "KB34")) {
      assert.ok(!(result.page >= 601 && result.page <= 700), "duplicate PDF pages excluded from retrieval");
    }
  }
});
