"""Rebuild the shared, page-addressable Helpdesk corpus from the supplied PDFs."""
from pathlib import Path
import hashlib
import json
import re
import pymupdf as fitz

ROOT = Path(__file__).resolve().parents[2]
SOURCES = [
    ("KB01", "TERAS LPJK 12 — Ketentuan dan Usulan Konversi SBU", "paparan_dan_usulan",
     "TERAS_LPJK_#12_Materi_1_-_Ketentuan_dan_Usulan_Konversi_SBU_Pa_1793168963263.pdf"),
    ("KB02", "TERAS LPJK 12 — Kesiapan Sistem Informasi", "paparan",
     "TERAS_LPJK_#12_Materi_2_-_Kesiapan_Sistem_utk_Kepdirjen_281_RE_1793168963260.pdf"),
    ("KB03", "TERAS LPJK 12 — Perspektif Pelaku Usaha", "perspektif_pelaku_usaha",
     "TERAS_LPJK_#12_Materi_3_-_Perspektif_Pelaku_Usaha_Pak_Ruslan_1793168963267.pdf"),
    ("KB04", "Kepdirjen BK Nomor 281/KPTS/DK/2026 dan Surat Penyampaian", "keputusan_dan_surat",
     "KEP_DIRJEN_BK_281_STANDAR_SKEMA_SERTIFIKASI_26_AGUSTUS_2026_SU_1793171765640.pdf"),
    ("KB05", "Format Standar Skema Sertifikasi BUJK", "paparan",
     "3._FORMAT_STANDAR_SKEMA_BERDASAR_PERMEN_6_TH_2026_1793171795857.pdf"),
    ("KB06", "Paparan Kepdirjen BK 281 Tahun 2026", "paparan",
     "2._Paparan_KepDirjen_BK_281_Tahun_2026_tentang_Penetapan_Stand_1793171795858.pdf"),
    ("KB07", "Overview Permen PU Nomor 6 dan Timeline", "paparan",
     "1._Overview_Permen_PU_No_6_dan_Timeline_1793171795860.pdf"),
    ("KB08", "Slide Pendukung Ketua LPJK — Kepdirjen 281/2026", "paparan",
     "0._Slide_Pendukung_Ketua_LPJK_Kepdirjen_281_2026_FINAL_SELARAS_1793171795861.pdf"),
    ("KB09", "Format Standar Skema Sertifikasi BG — Bangunan Gedung", "format_skema",
     "1._Format_Standar_Skema_Sertifikasi_BG_1793172739822.pdf"),
    ("KB10", "Format Standar Skema Sertifikasi BS — Bangunan Sipil", "format_skema",
     "2._Format_Standar_Skema_Sertifikasi_BS_1793172739826.pdf"),
    ("KB11", "Format Standar Skema Sertifikasi IN — Instalasi", "format_skema",
     "3._Format_Standar_Skema_Sertifikasi_IN_1793172739827.pdf"),
    ("KB12", "Format Standar Skema Sertifikasi KK — Konstruksi Khusus", "format_skema",
     "4._Format_Standar_Skema_Sertifikasi_KK_1793172739828.pdf"),
    ("KB13", "Format Standar Skema Sertifikasi KP — Konstruksi Prapabrikasi", "format_skema",
     "5._Format_Standar_Skema_Sertifikasi_KP_1793172739829.pdf"),
    ("KB14", "Format Standar Skema Sertifikasi PA — Penyewaan Peralatan", "format_skema",
     "6._Format_Standar_Skema_Sertifikasi_PA_1793172739830.pdf"),
    ("KB15", "Format Standar Skema Sertifikasi PL — Penyiapan Lahan", "format_skema",
     "7._Format_Standar_Skema_Sertifikasi_PL_1793172739831.pdf"),
    ("KB16", "Format Standar Skema Sertifikasi PB — Penyelesaian Bangunan", "format_skema",
     "8._Format_Standar_Skema_Sertifikasi_PB_1793172739832.pdf"),
    ("KB17", "PP Nomor 28 Tahun 2025 — Penyelenggaraan Perizinan Berusaha Berbasis Risiko", "peraturan_pemerintah",
     "PP_Nomor_28_Tahun_2025_(2)_1793173070133.pdf"),
    ("KB18", "Permen PUPR Nomor 7 Tahun 2024 — Pengembangan Usaha Berkelanjutan", "peraturan_menteri",
     "permen-pupr-no-7-tahun-2024_(4)_1793173145398.pdf"),
    ("KB19", "Permen PU Nomor 6 Tahun 2025 — Standar Kegiatan Usaha dan/atau Standar Produk/Jasa, Pelaksanaan Pengawasan, dan Pengenaan Sanksi pada Penyelenggaraan Perizinan Berusaha Berbasis Risiko Sektor Pekerjaan Umum", "peraturan_menteri",
     "permen-pu-6-2025_1793173478068.pdf"),
    ("KB20", "PP 28/2025 — Lampiran IV: Pedoman Penyusunan Standar Kegiatan Usaha dan/atau Produk/Jasa", "lampiran_peraturan",
     "PP_Nomor_28_Tahun_2025_-_Lampiran_IV_1793173708461.pdf"),
    ("KB21", "PP 28/2025 — Lampiran III: Metode Analisis Risiko", "lampiran_peraturan",
     "PP_Nomor_28_Tahun_2025_-_Lampiran_III_1793173708462.pdf"),
    ("KB22", "PP 28/2025 — Lampiran II: Perizinan Berusaha untuk Menunjang Kegiatan Usaha", "lampiran_peraturan",
     "PP_Nomor_28_Tahun_2025_-_Lampiran_II_1793173708463.pdf"),
    ("KB23", "PP 28/2025 — Lampiran I.J–I.P", "lampiran_peraturan",
     "2.10_Lampiran_I.J_sd._I.P_PP_Nomor_28_Tahun_2025_1793173708464.pdf"),
    ("KB24", "PP 28/2025 — Lampiran I.Q–I.V", "lampiran_peraturan",
     "2.11_Lampiran_I.Q_sd._I.V_PP_Nomor_28_Tahun_2025_1793173708465.pdf"),
    ("KB25", "PP 28/2025 — Lampiran I.I: Transportasi (I.I.1–411)", "lampiran_peraturan",
     "2.9_Lampiran_I.I_PP_Nomor_28_Tahun_2025_(I.I.1-411)_1793173708465.pdf"),
    ("KB26", "PP 28/2025 — Lampiran I.H: Pekerjaan Umum dan Perumahan Rakyat (I.H.1–515)", "lampiran_peraturan",
     "2.8_Lampiran_I.H_PP_Nomor_28_Tahun_2025_(I.H.1-515)_1793173708466.pdf"),
    ("KB27", "PP 28/2025 — Lampiran I.G: Perdagangan dan Metrologi Legal (I.G.1–341)", "lampiran_peraturan",
     "2.7_Lampiran_I.G_PP_Nomor_28_Tahun_2025_(I.G.1-341)_1793173708467.pdf"),
    ("KB28", "PP 28/2025 — Lampiran I.F bagian I.F.5249–5691", "lampiran_peraturan",
     "2.6h_Lampiran_I.F_PP_Nomor_28_Tahun_2025_(I.F.5249-11000)_1793173708468.pdf"),
    ("KB29", "PP 28/2025 — Lampiran I.F bagian I.F.4501–5248", "lampiran_peraturan",
     "2.6g_Lampiran_I.F_PP_Nomor_28_Tahun_2025_(I.F.4501-5248)_1793173708469.pdf"),
    ("KB30", "PP 28/2025 — Lampiran I.F bagian I.F.3681–4500", "lampiran_peraturan",
     "2.6f_Lampiran_I.F_PP_Nomor_28_Tahun_2025_(I.F.3681-4500)_1793173708470.pdf"),
    ("KB31", "PP 28/2025 — Lampiran I.F bagian I.F.2923–3680", "lampiran_peraturan",
     "2.6e._Lampiran_I.F_PP_Nomor_28_Tahun_2025_(I.F.2923-3680)_1793173708470.pdf"),
    ("KB32", "PP 28/2025 — Lampiran I.F bagian I.F.2126–2922", "lampiran_peraturan",
     "2.6d_Lampiran_I.F_PP_Nomor_28_Tahun_2025_(I.F.2126-2922)_1793173708471.pdf"),
    ("KB33", "PP 28/2025 — Lampiran I.F bagian I.F.1401–2125", "lampiran_peraturan",
     "2.6c_Lampiran_I.F_PP_Nomor_28_Tahun_2025_(I.F.1401-2125)_1793173708472.pdf"),
    ("KB34", "PP 28/2025 — Lampiran I.F bagian I.F.701–1400", "lampiran_peraturan",
     "2.6b_Lampiran_I.F_PP_Nomor_28_Tahun_2025_(I.F.701-1400)_1793173829317.pdf"),
    ("KB35", "PP 28/2025 — Lampiran I.F: Perindustrian bagian I.F.1–700", "lampiran_peraturan",
     "2.6a_Lampiran_I.F_PP_Nomor_28_Tahun_2025_(I.F.1-700)_1793173829318.pdf"),
    ("KB36", "PP 28/2025 — Lampiran I.E (I.E.1–189)", "lampiran_peraturan",
     "2.5_Lampiran_I.E_PP_Nomor_28_Tahun_2025_(I.E.1-189)_1793173829319.pdf"),
    ("KB37", "PP 28/2025 — Lampiran I.D: Energi dan Sumber Daya Mineral (I.D.1–1056)", "lampiran_peraturan",
     "2.4_Lampiran_I.D_PP_Nomor_28_Tahun_2025_(I.D.1-1056)_1793173829321.pdf"),
    ("KB38", "PP 28/2025 — Lampiran I.C: Kehutanan (I.C.1–182)", "lampiran_peraturan",
     "2.3_Lampiran_I.C_PP_Nomor_28_Tahun_2025_(I.C.1-182)_1793173829322.pdf"),
    ("KB39", "PP 28/2025 — Lampiran I.B: Pertanian (I.B.1–810)", "lampiran_peraturan",
     "2.2_Lampiran_I.B_PP_Nomor_28_Tahun_2025_(I.B.1-810)_1793173829322.pdf"),
    ("KB40", "PP 28/2025 — Lampiran I.A: Kelautan dan Perikanan (I.A.1–364)", "lampiran_peraturan",
     "2.1_Lampiran_I.A_PP_Nomor_28_Tahun_2025_(I.A.1-364)_1793173829323.pdf"),
    ("KB41", "Perpres Nomor 46 Tahun 2025 — Perubahan Kedua atas Perpres 16/2018 tentang Pengadaan Barang/Jasa Pemerintah", "peraturan_presiden",
     "Peraturan_Presiden_Nomor_46_Tahun_2025_1793174347143.pdf"),
    ("KB42", "Peraturan LKPP Nomor 3 Tahun 2026 — Pedoman Persiapan dan Pelaksanaan Pengadaan Barang/Jasa Pemerintah melalui Penyedia", "peraturan_lembaga",
     "Peraturan_Lembaga_Nomor_3_Tahun_2026_3287_1_1793174492238.pdf"),
    ("KB43", "Permen PU Nomor 1 Tahun 2026 — Tata Cara Pelaksanaan Kerja Sama Pemerintah dan Badan Usaha dalam Penyediaan Infrastruktur Pekerjaan Umum", "peraturan_menteri",
     "PERMEN_PU_Nomor_1_Tahun_2026_1793174653537.pdf"),
    ("KB44", "BPS — Klasifikasi Baku Lapangan Usaha Indonesia (KBLI) 2025", "publikasi_statistik",
     "klasifikasi-baku-lapangan-usaha-indonesia--kbli--2025-_1793176998123.pdf"),
]
VISUAL_SUMMARIES = {
    2: "Ringkasan visual halaman pindai, bukan transkripsi lengkap: Lampiran I surat bertanggal 28 Agustus 2026. Daftar penerima surat meliputi Ketua LPJK, Komite Akreditasi Nasional, dan pimpinan LSBU bidang jasa konstruksi. Rincian daftar penerima harus diperiksa pada PDF asli.",
    3: "Ringkasan visual halaman pindai, bukan transkripsi lengkap: Keputusan Direktur Jenderal Bina Konstruksi Kementerian Pekerjaan Umum Nomor 281/KPTS/DK/2026 tentang Penetapan Standar Skema Sertifikasi Badan Usaha Jasa Konstruksi. Menimbang pelaksanaan Pasal 5 ayat (9) Peraturan Menteri Pekerjaan Umum Nomor 6 Tahun 2025 tentang Standar Kegiatan Usaha dan/atau Standar Produk/Jasa, Pelaksanaan Pengawasan, dan Pengenaan Sanksi pada Penyelenggaraan Perizinan Berusaha Berbasis Risiko Sektor Pekerjaan Umum. Dasar hukum antara lain UU 2/2017 sebagaimana diubah UU 6/2023, PP 22/2020 sebagaimana diubah PP 14/2021, PP 28/2025, dan Perpres 170/2024. Periksa PDF asli untuk kutipan verbatim.",
    5: "Ringkasan visual halaman pindai, bukan transkripsi lengkap: Diktum KEENAM menyatakan Keputusan Direktur Jenderal ini mulai berlaku pada tanggal ditetapkan. Ditetapkan di Jakarta pada tanggal 26 Agustus 2026. Tembusan kepada Menteri Pekerjaan Umum dan Ketua Lembaga Pengembangan Jasa Konstruksi. Periksa PDF asli untuk tanda tangan, stempel, dan kutipan verbatim. Ini tidak boleh disamakan dengan pengumuman kesiapan SIJK atau awal tenggat konversi.",
    186: "Ringkasan visual halaman pindai, bukan transkripsi lengkap; nomor halaman tercetak 177: Lanjutan formulir penilaian SMAP. Kolom mencakup item penilaian, persyaratan, hasil tinjauan permohonan, keputusan asesor, dan hasil penilaian komite teknis/tim pemutus. Terdapat butir pernyataan memenuhi dokumen SMAP paling lambat pada tahun yang diisi sesuai dokumen permohonan; serta sertifikat pelatihan/bimtek manajemen anti penyuapan khusus kualifikasi kecil. Bagian rekomendasi LSBU berisi permohonan diterima/ditolak untuk diterbitkan SBU, alasan, tanggal, dan tanda tangan tiga anggota komite teknis/tim pemutus. Formulir kosong bukan bukti pemenuhan atau keputusan atas suatu BUJK.",
}
documents, manifests, thumbnails = [], [], []
out = ROOT / "generated-artifacts/lpjk-knowledge"
out.mkdir(parents=True, exist_ok=True)
for source_id, title, kind, filename in SOURCES:
    path = ROOT / "attached_assets" / filename
    with fitz.open(path) as pdf:
        pages = [{"page": i + 1, "text": re.sub(r"[ \t]+", " ", page.get_text("text")).strip(),
                  "method": "text_layer"}
                 for i, page in enumerate(pdf)]
        if source_id == "KB04":
            for p in pages:
                if p["page"] in VISUAL_SUMMARIES:
                    p.update(text=VISUAL_SUMMARIES[p["page"]], method="visual_summary")
        if source_id == "KB34":
            # Preserve physical PDF page numbers, but avoid indexing repeated extracted text twice.
            first_page_by_text = {}
            for p in pages:
                if p["text"] and p["text"] in first_page_by_text:
                    p["duplicateOf"] = first_page_by_text[p["text"]]
                elif p["text"]:
                    first_page_by_text[p["text"]] = p["page"]
        empty = [p["page"] for p in pages if not p["text"]]
        meta = dict(id=source_id, title=title, kind=kind, fileName=filename,
                    sha256=hashlib.sha256(path.read_bytes()).hexdigest(),
                    pageCount=len(pages), textPageCount=len(pages) - len(empty),
                    pagesNeedingReview=empty,
                    visualSummaryPages=[p["page"] for p in pages if p["method"] == "visual_summary"],
                    note="Nama file menyebut 2026, sedangkan isi perlu dirujuk sebagai Permen PU 6/2025."
                    if source_id == "KB05" else
                    "Sampul paparan menulis 281/KPTS/M/2026; nomor pada dokumen keputusan adalah 281/KPTS/DK/2026."
                    if source_id == "KB06" else
                    "Format skema LSBU Konstruksi Indonesia, bukan bukti penerbitan SBU atau ketentuan otomatis semua LSBU. Halaman PDF 2 berjudul Penyewaan Peralatan (PA), tetapi header menulis Konstruksi Prapabrikasi (KP); periksa naskah asli."
                    if source_id == "KB14" else
                    "Format skema LSBU Konstruksi Indonesia, bukan bukti penerbitan SBU atau ketentuan otomatis semua LSBU."
                    if kind == "format_skema" else
                    "Lapisan teks bawaan memuat kesalahan pengenalan karakter dan urutan baca. Verifikasi nomor pasal, angka, dan kutipan hukum pada PDF asli; bukan transkripsi terverifikasi atau bukti status regulasi terkini."
                    if source_id == "KB17" else
                    "Mencakup naskah peraturan dan lampiran. Nomor halaman PDF digunakan untuk rujukan; verifikasi detail tabel dan status regulasi terkini pada naskah asli dan otoritas terkait."
                    if source_id in ("KB18", "KB19") else
                    "Naskah perubahan kedua atas Perpres 16/2018, bukan naskah konsolidasi lengkap. Lapisan teks bawaan memiliki gangguan karakter; periksa bunyi pasal, angka, ketentuan peralihan, dan status hukum pada naskah asli."
                    if source_id == "KB41" else
                    "Pedoman pengadaan melalui penyedia beserta lampiran. Jangan menyamakan ruang lingkup ini dengan skema KPBU atau menganggap semua ketentuan lama dicabut hanya berdasarkan tahun terbit."
                    if source_id == "KB42" else
                    "Mengatur tata cara KPBU infrastruktur pekerjaan umum, bukan pengganti otomatis seluruh ketentuan pengadaan melalui penyedia atau standar sertifikasi BUJK. Verifikasi rujukan pasal dan lampiran pada PDF asli."
                    if source_id == "KB43" else
                    "Nama file menyebut I.F.5249–11000, tetapi berkas berisi 443 halaman dan halaman cetak terakhir I.F.5691. Bukan bukti tersedianya I.F.5692–11000. Teks bawaan dapat salah mengenali karakter; tabel bersambung wajib diperiksa pada PDF asli."
                    if source_id == "KB28" else
                    "Berkas berisi 800 halaman PDF untuk rentang cetak I.F.701–1400. Halaman PDF 601–700 memiliki teks identik dengan 501–600 (100 halaman berulang); indeks pencarian hanya memakai kemunculan pertama. Rujukan tetap menggunakan nomor halaman PDF asli, bukan nomor cetak."
                    if source_id == "KB34" else
                    "Bagian lampiran PP 28/2025 yang diunggah, bukan bukti seluruh lampiran tersedia. Lapisan teks bawaan dapat salah mengenali angka/karakter dan urutan kolom; verifikasi baris tabel beserta lanjutan pada PDF asli."
                    if kind == "lampiran_peraturan" else "")
        if source_id == "KB44":
            meta["note"] = ("Publikasi BPS KBLI 2025, bukan tabel konversi otomatis subklasifikasi SBU. "
                            "Kode dan uraian harus dibaca bersama versi KBLI; jangan menganggap tabel salinan KB45 sudah diselaraskan ke 2025. "
                            "Sebagian halaman hanya berisi URL/penanda atau materi visual. Rujukan mengikuti 1.040 halaman PDF fisik, bukan penomoran cetak xiv+1021. "
                            "Ikuti ketentuan reproduksi pada publikasi asli.")
        meta.update(format="pdf", lineCount=0, entryCount=0)
        documents.append({**meta, "pages": pages, "lines": []})
        manifests.append(meta)
        pix = pdf[0].get_pixmap(matrix=fitz.Matrix(0.65, 0.65), alpha=False)
        target = out / f"{source_id}-cover.png"
        pix.save(str(target))
        thumbnails.append((source_id, pix))
        print(json.dumps({**meta, "firstPageSample": pages[0]["text"][:450]}, ensure_ascii=False))

text_path = ROOT / "attached_assets" / "Pasted-Search-Subklasifikasi-KBLI-Deskripsi-KBLI-Ruang-Lingkup_1793177347001.txt"
text_lines = text_path.read_text(encoding="utf-8").splitlines()
entry_count = sum(bool(re.match(r"^[A-Z]{2}\d{3}\s*\d{5}", line)) for line in text_lines)
text_meta = dict(
    id="KB45", title="Skema klasifikasi dan subklasifikasi usaha jasa konstruksi — tabel salinan pengguna",
    kind="tabel_pemetaan", fileName=text_path.name,
    sha256=hashlib.sha256(text_path.read_bytes()).hexdigest(),
    pageCount=0, textPageCount=0, pagesNeedingReview=[], visualSummaryPages=[],
    format="text", lineCount=len(text_lines), entryCount=entry_count,
    note=("Teks salinan tabel unggahan pengguna; URL, tanggal, versi KBLI, dan penerbit asal belum tersedia. "
          "Bukan peraturan atau tabel konversi resmi ke KBLI 2025, dan bukan bukti penerbitan SBU. "
          "Header TKK/peralatan/penyetaraan tidak membuktikan adanya nilai atau izin merangkap pada baris yang kosong. "
          "Gunakan kutipan baris teks asli, bukan halaman PDF; periksa aturan dan skema yang berlaku sebelum keputusan resmi."),
)
documents.append({**text_meta, "pages": [], "lines": [
    {"line": number, "text": line} for number, line in enumerate(text_lines, 1)
]})
manifests.append(text_meta)
print(json.dumps(text_meta, ensure_ascii=False))

corpus = {"schemaVersion": 2, "scope": "shared-helpdesk-reference",
          "source": "user-supplied-reference-files", "documents": documents}
for target, content in [
    (ROOT / "artifacts/api-server/src/data/lpjk-knowledge.json", corpus),
    (ROOT / "artifacts/pub-aspekindo/src/data/lpjk-knowledge-catalog.json",
     {"scope": corpus["scope"], "documents": manifests}),
]:
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(content, ensure_ascii=False, indent=2) + "\n")

# Contact sheets for visual review, eight covers per image.
for offset in range(0, len(thumbnails), 8):
    sheet = fitz.open()
    page = sheet.new_page(width=1000, height=1120)
    for index, (source_id, pix) in enumerate(thumbnails[offset:offset + 8]):
        x, y = (index % 2) * 500, (index // 2) * 280
        page.insert_text((x + 10, y + 16), source_id)
        page.insert_image(fitz.Rect(x + 5, y + 23, x + 495, y + 275), pixmap=pix, keep_proportion=True)
    name = "covers.png" if offset == 0 else f"covers-{offset // 8 + 1}.png"
    page.get_pixmap().save(str(out / name))
    sheet.close()

# Keep the image-heavy implementation slides when rebuilding the shared corpus.
# This separate importer uses local Tesseract rather than a paid OCR provider.
import runpy
runpy.run_path(str(ROOT / ".agents/scripts/ingest_implementation_discussion.py"), run_name="__main__")
runpy.run_path(str(ROOT / ".agents/scripts/ingest_permendagri_reference.py"), run_name="__main__")
