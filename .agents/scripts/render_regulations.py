import fitz, os
files = [
 'attached_assets/2._Paparan_KepDirjen_BK_281_Tahun_2026_tentang_Penetapan_Stand_1789013947950.pdf',
 'attached_assets/KEP_DIRJEN_BK_281_STANDAR_SKEMA_SERTIFIKASI_26_AGUSTUS_2026_SU_1789014000180.pdf',
 'attached_assets/permen-pupr-no-7-tahun-2024_(1)_1789014052486.pdf',
]
os.makedirs('.agents/outputs/regulations', exist_ok=True)
for path in files:
    doc = fitz.open(path)
    print(path, 'pages=', doc.page_count, 'meta=', doc.metadata)
    for i in range(min(2, doc.page_count)):
        pix = doc[i].get_pixmap(matrix=fitz.Matrix(1.5, 1.5), alpha=False)
        out = '.agents/outputs/regulations/' + os.path.basename(path)[:40] + f'-p{i+1}.png'
        pix.save(out)
        print('rendered', out)
