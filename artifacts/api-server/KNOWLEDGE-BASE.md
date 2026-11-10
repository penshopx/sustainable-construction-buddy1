# Referensi bersama Helpdesk PUB

Empat puluh empat PDF dan satu berkas teks pengguna diindeks sebagai sumber **bersama Helpdesk**,
bukan sebagai unggahan pribadi ke tabel `mentor_knowledge_bases`.
Tidak ada perubahan database hosted, bucket, hak akses, atau konfigurasi produksi.

## Draf matriks untuk profil chatbot skema

`src/data/construction-scheme-matrix.json` adalah hasil ekstraksi offline dari
delapan skema KB09–KB16, ruang lingkup subklasifikasi KB19, dan definisi KBLI
2025 KB44. **Digunakan sebagai konteks profil chat skema di server.**
Katalog ringkas tanpa teks dokumen dibuat di frontend untuk pemilihan profil.
Profil skema menggantikan pencarian global dengan kutipan matriks dan hasil
pencarian terbatas dokumen keluarga skema. Peran percakapan tidak memberi hak akses.
Kode tidak dikenal ditolak; seluruh permintaan profil memerlukan sesi anggota.
Pilihan tersimpan pada awalan judul percakapan dan dipulihkan saat riwayat dibuka.
Awalan judul bukan bukti kewenangan dan tetap divalidasi terhadap katalog.
Penyimpanan pada judul memakai tabel riwayat yang sudah ada, tanpa migrasi
database hosted. Mengganti profil memulai percakapan baru; riwayat lama tidak
otomatis dikirim ke model. Profil tersimpan yang tidak didukung ditolak,
bukan diam-diam diubah menjadi chat umum.

Untuk pertanyaan kriteria/persyaratan, konteks profil memprioritaskan bagian
bernomor pada dokumen skema: penjualan 3.1/5.1.2, keuangan 3.2/5.1.3,
tenaga kerja 3.3/5.1.4, peralatan 3.4/5.1.5, administrasi 5.1.1, dan
anti-penyuapan 3.5. Anggaran kutipan memakai ruang tersisa dalam konteks profil
di bawah 16.000 karakter, dengan batas kutipan 12.000 karakter JSON. Bagian
pendek yang muat dikirim utuh; sisa kapasitas dialihkan ke bagian lebih panjang,
bukan membagi anggaran rata dan memotong halaman yang sebenarnya masih muat.
Kutipan menyertakan offset asli pada halaman PDF. `requirementEvidenceCoverage` menandai bagian
yang hilang atau parsial; kutipan parsial tidak membuktikan daftar lengkap.
Kode subklasifikasi tidak boleh mengalahkan topik pertanyaan dan mengarahkan
seluruh bukti ke halaman lampiran penilaian. Pencarian umum di luar profil
tetap menggunakan alur semula.

Paket offline tanpa pemotongan konteks chat dapat dibuat dengan
`pnpm --filter @workspace/api-server exec node scripts/export-scheme-evidence.mjs`.
Hasil HTML mandiri tersimpan di `generated-artifacts/scheme-evidence-audit/`,
berisi teks pada 88 batas bagian dari delapan dokumen skema, dengan pemilih
77 subklasifikasi. Ini ekstraksi teks, bukan pengganti susunan kolom tabel
PDF asli atau validasi hukum. Pembuatan paket tidak memakai model/API
dan tidak mengubah database hosted.

### Bank pertanyaan dan jawaban acuan offline

Jalankan `pnpm --filter @workspace/api-server exec node scripts/build-scheme-answer-bank.mjs`.
HTML mandiri, CSV, dan data JSON dihasilkan di `generated-artifacts/scheme-answer-bank/`.
Bank mencakup acuan pemetaan/ruang lingkup setiap subklasifikasi, panduan
menelusuri enam topik persyaratan setiap keluarga skema, serta kasus batas
sumber, kualifikasi, dan perilaku aplikasi. Setiap kasus memuat jawaban acuan,
poin wajib, klarifikasi jika diperlukan, klaim terlarang, dan bukti sumber.

Bank merupakan draf peninjauan, bukan keluaran AI atau jawaban runtime chatbot.
Jangan menjadikannya penilaian otomatis berdasarkan kecocokan kalimat persis.
Bukti kebijakan aplikasi ditandai terpisah dari kutipan peraturan/dokumen skema.
Kasus perbandingan khusus berhenti jika asumsi sumbernya berubah dan perlu ditinjau.
Pembuatan bank tidak memanggil model, mengakses sesi pengguna, atau mengubah
konfigurasi produksi maupun database hosted.

### Penampil referensi di aplikasi

Pakar Cerdas → **Referensi Acuan** menampilkan bank draf tersebut sebagai bahan
baca-saja, bukan sebagai jawaban percakapan. Pencarian, filter subklasifikasi/
kategori dan pergantian halaman tidak memanggil model atau mengubah profil chat.
Kutipan PDF menggunakan nomor halaman fisik; salinan teks menggunakan nomor baris.
Kebijakan aplikasi tetap dibedakan dari sumber hukum.

`GET /api/scheme-references` memeriksa sesi anggota pada setiap permintaan dan
mengirim `Cache-Control: no-store`. Dataset dibangun dari sumber terlacak dengan
pembangun bank yang sama, kemudian diperiksa terhadap kontrak API; tidak
bergantung pada berkas hasil ekspor di `generated-artifacts/`.
Sesi tidak sah, kegagalan autentikasi, dan bank yang tidak valid ditolak secara
eksplisit. Penampil menyediakan pesan gagal/coba lagi, serta membatalkan pembacaan
dan menghapus hasil dari tampilan saat akun berganti atau keluar.

- Ada 77 kode pada sampul dan tabel delapan skema: BG 9, BS 20, IN 13,
  KK 16, KP 2, PA 1, PL 8, PB 8. Jangan memakai jumlah 76 dari tabel salinan
  KB45 sebagai jumlah profil yang otomatis dianggap lengkap.
- IN014 ada pada skema tetapi tidak ada pada KB45; 16 pemetaan KBLI berbeda.
  Selisih dicatat tanpa menimpa sumber atau menyimpulkan pencabutan kode.
- Ruang lingkup subklasifikasi dan uraian KBLI disajikan terpisah, lengkap
  dengan kutipan asli dan nomor halaman PDF fisik. Satu KBLI dapat dipakai
  beberapa subklasifikasi; cakupan KBLI bukan perluasan kewenangan tiap kode.
- Rujukan persyaratan menunjuk awal 11 bagian umum masing-masing skema;
  belum menormalisasi semua ambang nilai atau membuat aturan kelulusan.
- Status seluruh baris adalah draf rujukan, bukan keputusan sertifikasi.

Bangun ulang dari root dengan `python3 .agents/scripts/build_scheme_matrix.py`.
Periksa dengan `python3 .agents/scripts/test_scheme_matrix.py -v`.
CSV dan laporan HTML mandiri dibuat di `generated-artifacts/scheme-matrix/`
yang diabaikan Git. Tidak ada panggilan model atau layanan hosted.

## Isi dan penyimpanan

- Corpus teks berhalaman berada di `src/data/lpjk-knowledge.json` dan dibundel
  bersama API; bukan berkas sementara yang harus ditemukan saat runtime.
- Katalog metadata kecil berada di frontend dan tampil di tab chat Helpdesk.
- File PDF asal tidak disalin ulang ke aset publik atau Git. Nama file dan
  SHA-256 disimpan untuk keterlacakan, bukan sebagai tautan unduhan.
- Total: 45 dokumen, 15.643 halaman PDF fisik dan 79 baris teks (76 entri tabel).
  Baris teks tidak dihitung sebagai halaman PDF. Halaman 2, 3, 5, dan 186 pada KB04 adalah
  ringkasan visual pindai yang diberi label, bukan ekstraksi/verbatim lengkap.
- Dokumen sumber memakai nomor halaman PDF 1-based; nomor cetak bisa berbeda.
- KB44 adalah publikasi BPS KBLI 2025 (1.040 halaman PDF fisik), bukan tabel
  konversi SBU. Beberapa halaman hanya memuat URL/penanda atau materi visual.
- KB45 adalah salinan tabel skema konstruksi: 76 entri BG/BS/IN/KK/KP/PA/PB/PL
  pada 79 baris asli. URL, penerbit, tanggal, dan versi KBLI belum tersedia.
  Kode subklasifikasi seperti BG001 tidak disamakan dengan kode KBLI seperti 41011;
  jangan menganggap tabel ini sudah dikonversi ke versi 2025. Header TKK/peralatan
  tidak membuktikan kolom kosong berisi aturan merangkap atau penyetaraan.
  Kutipan memakai `[KB45, baris 3]`, bukan halaman PDF. Teks lengkap hanya di server.
- Paparan KB05 memiliki tahun yang berbeda pada nama file dan isi. Sampul
  paparan KB06 juga memiliki perbedaan penulisan nomor keputusan. Catatan
  tersebut ditampilkan tanpa mengubah teks sumber.
- KB09–KB16 menambahkan delapan format skema LSBU Konstruksi Indonesia:
  BG (206 halaman), BS (218), IN (214), KK (213), KP (208), PA (206),
  PL (208), dan PB (208); tambahan total 1.681 halaman.
  Semuanya memiliki lapisan teks; tidak dibuat ringkasan visual pengganti.
  Format lembaga ini tidak otomatis menjadi ketentuan semua LSBU ataupun bukti
  suatu BUJK telah memperoleh SBU.
- Header halaman PDF 2 pada KB14 (PA) menulis Konstruksi Prapabrikasi (KP),
  sedangkan judul dan kode dokumen menyebut Penyewaan Peralatan (PA).
  Perbedaan ini ditandai dalam katalog dan konteks tanpa mengubah teks sumber.
- KB17: PP 28/2025 tentang Penyelenggaraan Perizinan Berusaha Berbasis Risiko
  (383 halaman); KB18: Permen PUPR 7/2024 tentang Pengembangan Usaha
  Berkelanjutan (169 halaman, termasuk lampiran). Tambahan total 552 halaman.
  Semua halaman memiliki lapisan teks bawaan, bukan hasil OCR baru.
  Teks KB17 memiliki salah pengenalan karakter dan urutan baca; kutipan
  hukum, nomor pasal, dan angka perlu diperiksa pada PDF asli.
  Tahun/nomor Permen PUPR 7/2024 tidak disamakan dengan Permen PU 6/2025
  yang dirujuk materi skema. Tidak disimpulkan pencabutan atau status hukum
  terkini hanya berdasarkan tahun terbit.
- KB19: naskah Permen PU 6/2025 beserta lampiran (393 halaman),
  tentang standar kegiatan usaha dan/atau standar produk/jasa, pelaksanaan
  pengawasan, dan pengenaan sanksi pada penyelenggaraan perizinan berusaha
  berbasis risiko sektor pekerjaan umum. Semua halaman memiliki lapisan teks.
  Sumber ini dipisahkan dari materi paparan KB05; naskah peraturan diutamakan
  saat kutipannya tersedia, bukan dianggap sama dengan Permen PUPR 7/2024.
- KB20–KB33: 14 berkas lampiran PP 28/2025, total 7.107 halaman:
  IV (8), III (18), II (746), I.J–I.P (500), I.Q–I.V (277),
  I.I (411), I.H (515), I.G (341), dan enam potongan I.F
  (443, 748, 820, 758, 797, 725 halaman). Semua memiliki lapisan teks
  bawaan; pengenalan angka/karakter dan urutan kolom tidak dijamin akurat.
  Nama file KB28 menyebut I.F.5249–11000, tetapi berkas berisi 443 halaman
  dan berakhir pada nomor cetak I.F.5691 (diperiksa visual).
  Jangan mengklaim seluruh lampiran lengkap atau halaman setelah I.F.5691
  tersedia hanya karena nama file.
- KB34–KB40: tujuh berkas berikutnya menambahkan 4.101 halaman PDF:
  I.F.701–1400 (800 halaman fisik), I.F.1–700 (700), I.E (189),
  I.D (1.056), I.C (182), I.B (810), dan I.A (364).
  Catatan sebelumnya mengenai belum tersedianya I.A–I.E dan I.F.1–1400
  tidak lagi berlaku. Cakupan unggahan bukan audit kelengkapan setiap baris
  lampiran resmi.
- KB34 memuat 100 halaman berteks identik: PDF 601–700 mengulang
  PDF 501–600 (rentang cetak I.F.1201–1300). Seluruh halaman fisik
  tetap disimpan agar rujukan akurat; `duplicateOf` menunjuk kemunculan
  pertama dan halaman berulang dilewati saat membangun indeks.
  Total halaman corpus adalah hitungan halaman fisik, termasuk pengulangan ini;
  pengenalan teks bawaan tetap bukan transkripsi hukum terverifikasi.
- KB41–KB43 menambahkan 469 halaman: Perpres 46/2025 (80 halaman),
  Peraturan LKPP 3/2026 (318), dan Permen PU 1/2026 (71).
  Semua memiliki lapisan teks. Perpres 46/2025 adalah naskah perubahan
  kedua Perpres 16/2018, bukan konsolidasi seluruh pasal.
  Pedoman pengadaan melalui penyedia dan tata cara KPBU infrastruktur PU
  dibedakan cakupannya; tahun terbit saja bukan dasar menyimpulkan pencabutan.

## Alur jawaban

`knowledge-base.ts` memilih maksimal 6 kutipan (maksimal 2 halaman per dokumen)
dengan indeks terbalik leksikal lokal, berdasarkan pertanyaan pengguna terakhir.
Indeks menyimpan frekuensi per potongan agar tidak memindai ulang semua kata
di seluruh halaman untuk setiap pertanyaan. ID sumber juga dapat dicari.
ID eksplisit (misalnya KB18) dan identitas peraturan membatasi dokumen yang dicari;
identitas peraturan yang tidak tersedia tidak diganti diam-diam dengan paparan
atau naskah perubahan yang kebetulan menyebutnya. Nomor/nama peraturan dipakai
untuk memilih sumber, bukan diulang sebagai bobot isi pada setiap potongan.
Pertanyaan substansi dinilai berdasarkan teks halaman; pertanyaan identitas
menyertakan halaman judul. Perbandingan eksplisit kecil mempertahankan masing-masing
sumber dalam batas kutipan yang sama.

Pemilih halaman membedakan `halaman PDF 443` dari label cetak `I.F.5691`.
Label cetak diambil hanya dari teks yang dikenali, bukan ditebak dari nama berkas
atau diperbaiki otomatis dari OCR. Permintaan halaman spesifik yang tidak ditemukan
tidak diganti dengan halaman lain. Klaim batas akhir berkas memakai halaman akhir
PDF yang benar-benar tersedia, bukan angka terakhir pada nama file.

Potongan teks memiliki overlap dan panjang terbatas. Tidak ada embedding,
OCR pihak ketiga, atau panggilan AI ketika mengindeks/mencari.
Konteks knowledge base dibatasi di bawah 16.000 karakter: katalog dan kebijakan
tetap utuh. Kutipan terbaik dari masing-masing sumber diprioritaskan sebelum
halaman tambahan dari sumber yang sama; kutipan yang tidak muat dilewati, bukan
dipotong di tengah teks hukum. Sapaan murni tidak mencari regulasi; sapaan di awal
pertanyaan dihapus dari kata pencarian tanpa menghapus pertanyaan substansinya.
Tabel yang bersambung antarhalaman/berkas tidak boleh dianggap baris utuh;
hasil retrieval bukan penetapan otomatis risiko, izin, atau persyaratan KBLI.

`chat-service.ts` menyertakan katalog dan kutipan pada panggilan Helpdesk yang
sudah ada, untuk semua pilihan model dan bot berbagi yang memakai layanan ini.
Jawaban diminta menyertakan ID dokumen dan halaman. Kutipan di dalam jawaban
AI tetap perlu diverifikasi; sistem tidak mengklaim setiap jawaban model pasti
patuh atau seluruh tabel/gambar dapat dipahami dari potongan teks.

Isi dokumen diperlakukan sebagai data tidak tepercaya, bukan instruksi atau
izin akses. Bedakan sumber keputusan/surat, paparan, usulan, dan perspektif.
Pisahkan tanggal penetapan, penyesuaian skema LSBU, dan awal tenggat konversi
yang memerlukan surat pemberlakuan. Jangan menyimpulkan status implementasi
terkini hanya dari unggahan ini.

Backend Mentor berbasis Supabase Edge Function masih terpisah: penambahan ini
tidak menyebarkan fungsi, memindahkan knowledge base pribadi, atau mengubah
data pengguna. Berkas asli yang diperlukan untuk pengunduhan/pengelolaan
dinamis harus kelak menggunakan penyimpanan persisten, bukan URL file lokal.

## Rebuild

Dengan Python dan PyMuPDF tersedia, jalankan dari root:

```
python3 .agents/scripts/ingest_lpjk_knowledge.py
```

Skrip menghasilkan corpus, katalog, dan gambar pemeriksaan di
`generated-artifacts/lpjk-knowledge/` (gambar diabaikan Git/deploy).
Ringkasan empat halaman pindai disusun dari pemeriksaan visual; jangan
menganggapnya sebagai OCR otomatis atau kutipan verbatim.

Tes retrieval, integritas corpus, dan integrasi prompt memakai respons AI
tiruan. Pengindeksan dan validasi tidak memerlukan permintaan AI berbayar.
