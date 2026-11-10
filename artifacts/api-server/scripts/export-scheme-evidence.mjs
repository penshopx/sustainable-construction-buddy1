import { build } from "esbuild";
import { createRequire } from "node:module";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const built = await build({ stdin: {
  contents: 'export { readSchemeRequirementSection } from "./src/lib/scheme-requirement-evidence";',
  resolveDir: root.pathname, loader: "ts",
}, bundle: true, platform: "node", format: "cjs", write: false });
const module = { exports: {} };
new Function("require", "module", "exports", built.outputFiles[0].text)(createRequire(import.meta.url), module, module.exports);
const matrix = JSON.parse(readFileSync(new URL("src/data/construction-scheme-matrix.json", root)));
const sections = matrix.schemes.flatMap(scheme => scheme.requirements.map(ref => {
  const result = module.exports.readSchemeRequirementSection(scheme.id, scheme.requirements, ref.clause);
  if (!result.pieces.length) throw new Error(`Section missing: ${scheme.id}/${ref.clause}`);
  return { id: scheme.id, source: scheme.title, clause: ref.clause, label: ref.label,
    boundaryFound: result.ended, pieces: result.pieces };
}));
const profiles = matrix.records.map(row => ({
  code: row.code, title: row.subclassificationScope.title, source: row.requirementsSourceId, kbli: row.kbliCode,
}));
// Escape '<' so uploaded document text cannot close the embedded JSON script.
const data = JSON.stringify({ profiles, sections }).replace(/</g, "\\u003c");
const html = `<!doctype html>
<html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Kutipan Persyaratan Skema Konstruksi — PUB ASPEKINDO</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#eef4fa;color:#142a43;font:16px/1.6 Arial,sans-serif}
header{background:#0d2342;color:#fff;padding:32px max(20px,calc((100% - 1080px)/2))}
header p{color:#d3e8ff}h1{font-size:clamp(24px,4vw,36px);margin:0}
main{max-width:1120px;margin:auto;padding:24px 20px}label{display:block;font-weight:bold}
.controls{display:grid;grid-template-columns:1fr 1fr;gap:16px;position:sticky;top:0;background:#eef4fa;padding:12px 0}
select{width:100%;padding:12px;border:1px solid #607d9a;border-radius:6px;background:white;color:#142a43;font-size:15px}
article,.note{background:#fff;border:1px solid #b9cddd;border-radius:8px;padding:20px;margin:16px 0}
.warning{border-left:5px solid #bb7200}.meta{color:#334f6b}h2{margin-top:0;font-size:23px}h3{font-size:17px}
pre{white-space:pre-wrap;overflow-wrap:anywhere;font:15px/1.7 Arial,sans-serif;margin:0}
details{border-top:1px solid #cbd9e5;margin-top:16px;padding-top:12px}summary{cursor:pointer;font-weight:bold}
@media(max-width:650px){.controls{grid-template-columns:1fr;position:static}article,.note{padding:16px}}
@media print{.controls{display:none}body{background:white}header{background:white;color:#142a43}header p{color:#334f6b}article{break-inside:avoid}details{display:block}}
</style></head><body>
<header><h1>Kutipan Persyaratan Skema Konstruksi</h1>
<p>77 subklasifikasi · 8 sumber skema · ${sections.length} bagian · berkas offline tanpa API</p></header>
<main><div class="note warning"><strong>Batas penggunaan</strong>
<p>Dokumen ini menampilkan seluruh teks hasil ekstraksi pada batas bagian yang dikenali, tanpa pemotongan oleh anggaran konteks chat.
Ini bukan seluruh dokumen PDF, bukan validasi hukum, dan bukan keputusan sertifikasi. Tabel hasil ekstraksi dapat kehilangan susunan kolom;
periksa PDF asli sebelum memakai baris kualifikasi, nilai ambang, atau persyaratan tenaga kerja/peralatan.</p>
<p>Peran percakapan tidak mengubah persyaratan. Pastikan jenis badan usaha, subkualifikasi/kualifikasi, dan tujuan pengajuan.
Uraian KBLI tidak otomatis sama dengan kewenangan subklasifikasi. Selisih versi sumber tetap perlu ditinjau.</p></div>
<div class="controls"><label>Subklasifikasi<select id="profile"></select></label>
<label>Topik / bagian<select id="topic">
<option value="3.1,5.1.2">Penjualan tahunan</option><option value="3.2,5.1.3">Kemampuan keuangan</option>
<option value="3.3,5.1.4">Tenaga kerja</option><option value="3.4,5.1.5">Peralatan</option>
<option value="5.1.1">Administrasi</option><option value="3.5">Anti-penyuapan</option>
<option value="5.1">Permohonan sertifikasi</option><option value="all">Semua bagian yang terindeks</option>
</select></label></div><p id="selection" class="meta"></p><div id="quotes"></div>
<p class="meta">Halaman adalah nomor halaman fisik PDF. Posisi karakter memakai indeks teks hasil ekstraksi, bukan koordinat visual atau label halaman cetak.</p>
</main><script type="application/json" id="packet">${data}</script>
<script>
const packet=JSON.parse(document.getElementById("packet").textContent);
const profile=document.getElementById("profile"),topic=document.getElementById("topic"),quotes=document.getElementById("quotes");
for(const row of packet.profiles){const option=document.createElement("option");option.value=row.code;option.textContent=row.code+" — "+row.title;profile.append(option)}
function element(tag,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el}
function render(){
 const selected=packet.profiles.find(row=>row.code===profile.value),clauses=topic.value.split(",");
 document.getElementById("selection").textContent=selected.code+" · KBLI "+selected.kbli+" · sumber "+selected.source+" · teks bersama keluarga skema; gunakan hanya baris yang sesuai.";
 quotes.replaceChildren();
 for(const section of packet.sections.filter(row=>row.id===selected.source&&(topic.value==="all"||clauses.includes(row.clause)))){
  const article=element("article");article.append(element("h2",section.clause+" — "+section.label));
  article.append(element("p",section.id+" · "+section.source));
  const status=element("p",section.boundaryFound?"Teks bagian sampai batas bagian berikutnya yang terdeteksi; tidak dipotong oleh batas konteks chat.":"Batas akhir bagian belum terdeteksi: periksa sumber asli sebelum menganggap bagian ini lengkap.");
  status.className="note"+(section.boundaryFound?"":" warning");article.append(status);
  for(const piece of section.pieces){
   const block=element("details");block.open=true;
   block.append(element("summary","["+section.id+", halaman PDF "+piece.page+"] · posisi "+piece.start+"–"+(piece.start+piece.text.length)));
   block.append(element("pre",piece.text));article.append(block);
  }
  quotes.append(article);
 }
}
profile.addEventListener("change",render);topic.addEventListener("change",render);render();
</script></body></html>`;
const dir = new URL("../../generated-artifacts/scheme-evidence-audit/", root);
mkdirSync(dir, { recursive: true });
const file = new URL("paket-kutipan-skema-offline.html", dir);
writeFileSync(file, html);
console.log(JSON.stringify({ file: file.pathname, profiles: profiles.length, sections: sections.length,
  sectionsWithBoundary: sections.filter(section => section.boundaryFound).length, bytes: Buffer.byteLength(html), apiCalls: 0 }));
