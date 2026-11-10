"""Self-contained review report, generated from the same draft as the CSV."""
from html import escape as esc


def render_report(matrix):
    def refs(items):
        return " · ".join(f"[{esc(r['id'])}, halaman PDF {r['page']}]" for r in items)

    rows = []
    schemes = {s["id"]: s for s in matrix["schemes"]}
    for row in matrix["records"]:
        legal, kbli = row["subclassificationScope"], row["kbli2025"]
        requirement_html = "".join(
            f"<li>{esc(r['clause'])} — {esc(r['label'])}: {refs([r])}</li>"
            for r in schemes[row["requirementsSourceId"]]["requirements"])
        scope_html = "".join(
            f"<h4>{label}</h4><p>{esc(scope['text'])}</p><small>{refs(scope['references'])}</small>"
            if scope else f"<h4>{label}</h4><p class='warning'>Belum terpetakan; perlu pemeriksaan sumber.</p>"
            for label, scope in [
                ("Ruang lingkup subklasifikasi — Permen PU 6/2025 (KB19)", legal),
                ("Uraian kegiatan KBLI 2025 — BPS (KB44), bukan perluasan otomatis kewenangan subklasifikasi", kbli)])
        notes = "".join(f"<li>{esc(note)}</li>" for note in row["reviewNotes"])
        siblings = ", ".join(row["otherSubclassesWithSameKbli"])
        if siblings:
            notes += f"<li>KBLI juga dipakai oleh {esc(siblings)}. Jangan menyamakan seluruh ruang lingkup subklasifikasi tersebut.</li>"
        rows.append(f"""<tr data-group="{esc(row['classification'])}"><td><strong>{esc(row['code'])}</strong><br>
{esc(legal['title'] if legal else 'Nama subklasifikasi belum terpetakan')}</td>
<td>{esc(row['kbliCode'])}<br>{esc(row['schemeKbliTitle'])}</td>
<td>{esc(row['businessNature'])}<br><small>{esc(row['qualificationText'])}</small></td>
<td>{refs([row['mappingReference']])}<details><summary>Lihat ruang lingkup dan persyaratan</summary>
{scope_html}<h4>Awal bagian persyaratan umum skema — bukan daftar lengkap aturan per kode</h4>
<ul>{requirement_html}</ul><p>{esc(schemes[row['requirementsSourceId']]['note'])}</p>
{f'<h4>Catatan peninjauan</h4><ul>{notes}</ul>' if notes else ''}
</details></td></tr>""")
    delta = matrix["comparisonWithCopiedTable"]
    summary = " · ".join(f"{esc(key)}: {value}" for key, value in matrix["counts"].items())
    boundaries = "".join(f"<li>{esc(text)}</li>" for text in matrix["boundaries"])
    options = "".join(f"<option>{esc(key)}</option>" for key in matrix["counts"])
    return f"""<!doctype html><html lang="id"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Matriks Skema PUB ASPEKINDO</title>
<style>
*{{box-sizing:border-box}}body{{margin:0;background:#0c1424;color:#eef5ff;font:15px/1.6 system-ui,sans-serif}}
main{{max-width:1400px;margin:auto;padding:32px 24px}}h1{{font-size:30px;margin-bottom:8px}}h2{{font-size:21px}}
p,li{{max-width:1100px}}small{{color:#c2d1e4}}.badge{{color:#9ed4ff;letter-spacing:.08em;font-weight:700}}
.panel{{padding:18px;background:#15243a;border:1px solid #36506c;border-radius:10px;margin:20px 0}}
.warning{{color:#ffe2a6}}label{{display:inline-block;margin-right:14px}}input,select{{font:inherit;padding:9px;border:1px solid #6a8bae;border-radius:6px;background:#f2f7ff;color:#14243b}}
.scroll{{overflow-x:auto}}table{{width:100%;border-collapse:collapse;background:#111f32}}th,td{{text-align:left;vertical-align:top;padding:16px;border-bottom:1px solid #36506c}}th{{background:#213b5a}}td:first-child{{min-width:230px}}td:nth-child(2){{min-width:210px}}td:last-child{{min-width:300px}}
summary{{cursor:pointer;color:#a7d8ff;font-weight:600;margin-top:12px}}details p{{white-space:normal}}h4{{margin-bottom:6px}}[hidden]{{display:none!important}}
</style></head><body><main><div class="badge">PUB ASPEKINDO · DRAF RUJUKAN</div>
<h1>Matriks skema, ruang lingkup, dan rujukan persyaratan</h1>
<p><strong>{len(matrix['records'])} subklasifikasi</strong> dari delapan dokumen skema yang telah diunggah. {'Terhubung sebagai rujukan profil chat di preview' if matrix['runtimeConnected'] else 'Belum terhubung ke chatbot aktif'}; belum merupakan validasi hukum.</p>
<p>{summary}</p>
<section class="panel"><h2>Batas penggunaan</h2><ul>{boundaries}</ul></section>
<section class="panel"><h2>Perbedaan dengan tabel salinan KB45</h2>
<p>Ada di skema, tidak ada di salinan: <strong>{esc(', '.join(delta['schemeOnly']) or 'Tidak ada')}</strong>.<br>
Ada di salinan, tidak tercantum dalam daftar delapan skema: <strong>{esc(', '.join(delta['copiedTableOnly']) or 'Tidak ada')}</strong>.<br>
Kode KBLI berbeda untuk subklasifikasi yang sama: <strong>{esc(', '.join(delta['differentKbli']) or 'Tidak ada')}</strong>.</p>
<p>Selisih ini bukan bukti pencabutan atau penerbitan kode secara hukum. Periksa versi, dokumen skema, dan ketentuan yang berlaku.</p></section>
<label>Cari kode atau nama <input id="query" type="search" placeholder="BG001, 41011, instalasi…"></label>
<label>Klasifikasi <select id="group"><option value="">Semua</option>{options}</select></label>
<p id="count" aria-live="polite">{len(rows)} baris ditampilkan</p>
<div class="scroll"><table><thead><tr><th>Subklasifikasi / nama dalam KB19</th><th>KBLI menurut skema</th><th>Sifat / kualifikasi dalam skema</th><th>Rujukan dan rincian</th></tr></thead>
<tbody>{''.join(rows)}</tbody></table></div>
<footer><p>Nomor halaman adalah urutan halaman PDF fisik, bukan nomor cetak. Kutipan berasal dari lapisan teks PDF; periksa tabel pada dokumen asli sebelum keputusan resmi. Tidak ada referensi teknis tambahan, data pribadi, atau jawaban AI yang digunakan.</p></footer>
</main><script>
const query=document.getElementById('query'),group=document.getElementById('group'),rows=[...document.querySelectorAll('tbody tr')];
function filter(){{const q=query.value.toLocaleLowerCase('id').trim();let n=0;for(const row of rows){{row.hidden=!!((group.value&&row.dataset.group!==group.value)||(q&&!row.textContent.toLocaleLowerCase('id').includes(q)));if(!row.hidden)n++}}document.getElementById('count').textContent=n+' baris ditampilkan'}}
query.addEventListener('input',filter);group.addEventListener('change',filter);
</script></body></html>"""
