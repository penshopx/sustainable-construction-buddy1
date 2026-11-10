export function renderSchemeAnswerBank(bank) {
  const data = JSON.stringify(bank).replace(/</g, "\\u003c");
  return `<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Bank Jawaban Acuan — PUB ASPEKINDO</title>
<style>
*{box-sizing:border-box}body{margin:0;background:#eef4fa;color:#132b46;font:16px/1.6 Arial,sans-serif}
header{background:#0c2241;color:white;padding:30px max(20px,calc((100% - 1100px)/2))}header p{color:#d4eaff}
h1{font-size:clamp(25px,4vw,38px);margin:0}main{max-width:1140px;margin:auto;padding:20px}
article,.note{background:white;border:1px solid #b9cadb;border-radius:8px;padding:20px;margin:16px 0}
.note{border-left:5px solid #227bb9}.controls{display:grid;grid-template-columns:1fr 1fr 2fr;gap:12px}
label{display:block;font-weight:bold}input,select{width:100%;padding:12px;border:1px solid #617e99;border-radius:6px;background:white;color:#132b46;font:15px Arial}
h2{font-size:21px;margin-top:0}h3{font-size:16px;margin-bottom:6px}.meta{color:#3d5872}.answer{white-space:pre-wrap}
details{margin-top:16px;border-top:1px solid #cbd9e7;padding-top:12px}summary{font-weight:bold;cursor:pointer}
pre{font:14px/1.7 Arial;white-space:pre-wrap;overflow-wrap:anywhere;padding:12px;background:#f2f6fa}
button{padding:10px 18px;border:0;border-radius:6px;background:#125da4;color:white;font-weight:bold;cursor:pointer}
button:disabled{opacity:.45;cursor:default}.pager{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:20px 0}
@media(max-width:700px){.controls{grid-template-columns:1fr}article,.note{padding:16px}}
@media print{.controls,.pager{display:none}body{background:white}header{background:white;color:#132b46}header p{color:#3d5872}}
</style></head><body><header><h1>Bank Pertanyaan dan Jawaban Acuan</h1>
<p>${bank.counts.cases} kasus · ${bank.counts.profiles} subklasifikasi · tanpa API AI</p></header><main>
<div class="note"><strong>Draf untuk peninjauan, bukan keputusan sertifikasi</strong>
<p>Jawaban disusun dari referensi unggahan dan batas perilaku aplikasi, bukan dihasilkan oleh AI. Belum merupakan penilaian pakar atau validasi hukum.
Jawaban alternatif yang didukung bukti dapat diterima; jangan mewajibkan kecocokan kalimat persis.</p>
<p>Acuan ini tidak otomatis digunakan oleh chatbot. Untuk tabel tenaga kerja, alat, angka, dan kualifikasi, periksa susunan kolom PDF asli.
Kutipan kebijakan aplikasi dipisahkan dari sumber hukum. Halaman menunjukkan halaman fisik PDF.</p></div>
<div class="controls"><label>Subklasifikasi<select id="profile"><option value="">Semua subklasifikasi</option></select></label>
<label>Kategori<select id="category"><option value="">Semua kategori</option></select></label>
<label>Pencarian<input id="search" type="search" placeholder="Kode, pertanyaan, atau isi jawaban"></label></div>
<p id="count" class="meta" aria-live="polite"></p><div id="cases"></div>
<div class="pager"><button id="previous" type="button">Sebelumnya</button><span id="page"></span><button id="next" type="button">Berikutnya</button></div>
</main><script type="application/json" id="bank">${data}</script><script>
const bank=JSON.parse(document.getElementById("bank").textContent),byId=id=>document.getElementById(id);
const profile=byId("profile"),category=byId("category"),search=byId("search");
let currentPage=0;const pageSize=12;
function node(tag,text){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;return el}
for(const item of bank.profiles){const option=node("option",item.code+" — "+item.title);option.value=item.code;profile.append(option)}
for(const value of Object.keys(bank.counts.categories)){const option=node("option",value);option.value=value;category.append(option)}
function list(parent,title,values){if(!values||!values.length)return;parent.append(node("h3",title));const ul=node("ul");for(const value of values)ul.append(node("li",value));parent.append(ul)}
function render(){
 const needle=search.value.trim().toLocaleLowerCase("id");
 const selected=bank.cases.filter(item=>(!profile.value||item.appliesTo.includes(profile.value))&&(!category.value||item.category===category.value)&&(!needle||(item.id+" "+item.question+" "+item.answer).toLocaleLowerCase("id").includes(needle)));
 currentPage=Math.min(currentPage,Math.max(0,Math.ceil(selected.length/pageSize)-1));
 byId("count").textContent=selected.length+" kasus sesuai filter dari "+bank.cases.length+" kasus.";
 byId("cases").replaceChildren();
 if(!selected.length)byId("cases").append(node("p","Tidak ada kasus yang cocok. Ubah pencarian atau filter."));
 for(const item of selected.slice(currentPage*pageSize,(currentPage+1)*pageSize)){
  const card=node("article");card.append(node("p",item.id+" · "+item.category));card.append(node("h2",item.question));
  if(item.kind==="application_policy")card.append(node("p","Acuan kebijakan aplikasi — bukan ketentuan hukum."));
  const answer=node("p",item.answer);answer.className="answer";card.append(node("h3","Jawaban acuan"),answer);
  list(card,"Poin yang harus dijaga",item.requiredPoints);list(card,"Informasi yang perlu ditanyakan",item.clarificationQuestions);list(card,"Klaim yang tidak boleh dibuat",item.forbiddenClaims);
  if(item.openingExcerpts){const opening=node("details");opening.append(node("summary","Cuplikan pembuka — bukan seluruh ketentuan"));for(const part of item.openingExcerpts)opening.append(node("pre",part.clause+"\\n"+part.text+(part.excerptOnly?"\\n[Cuplikan; lihat bukti teks di bawah.]":"")));card.append(opening)}
  const proof=node("details");proof.append(node("summary","Bukti sumber dan kutipan ("+item.evidenceIds.length+")"));
  for(const id of item.evidenceIds){const item=bank.evidence[id],location=item.kind==="pdf"?"halaman PDF "+item.page:item.kind==="text"?"baris "+item.lineStart+"–"+item.lineEnd:"kebijakan aplikasi, bukan sumber hukum";proof.append(node("h3",item.id+" · "+location),node("p",item.title),node("pre",item.quote))}
  card.append(proof);byId("cases").append(card);
 }
 byId("page").textContent="Halaman "+(selected.length?currentPage+1:0)+" / "+Math.ceil(selected.length/pageSize);
 byId("previous").disabled=currentPage===0;byId("next").disabled=(currentPage+1)*pageSize>=selected.length;
}
for(const control of [profile,category])control.addEventListener("change",()=>{currentPage=0;render()});
search.addEventListener("input",()=>{currentPage=0;render()});
byId("previous").addEventListener("click",()=>{currentPage--;render()});byId("next").addEventListener("click",()=>{currentPage++;render()});render();
</script></body></html>`;
}
