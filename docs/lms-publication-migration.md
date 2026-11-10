# Pengaman penerbitan kuis LMS

## Lokasi dan status penerapan

Skema LMS Supabase dalam repositori ini masih berada di
`.migration-backup/supabase/migrations/`. Meskipun nama foldernya berupa
cadangan, workflow `.github/workflows/assessment-concurrency.yml` menggunakan
folder tersebut melalui `scripts/prepare-supabase-test-project.py` untuk
menyiapkan database pengujian. Migrasi `lib/db/migrations/` bukan skema LMS
Supabase dan tidak menjadi jalur penerapan pengaman ini.

Pemeriksaan hanya-baca pada target hosted yang disetujui pada 1 November 2026
menemukan hanya trigger `update_aspekindo_lms_lessons_updated_at` pada tiga tabel
pelajaran/soal/kunci. Ledger hosted belum memuat
`protect_published_lms_quiz_bank`. Dengan demikian, keberadaan migrasi terdahulu
di repositori **bukan** bukti perlindungan hosted.

Migrasi baru yang harus diterapkan melalui proses rilis database yang disetujui:

```
.migration-backup/supabase/migrations/20261101100000_enforce_lms_lesson_publication.sql
```

Migrasi ini mandiri: memasang pengaman pelajaran, soal, dan kunci tanpa
mengharuskan migrasi pengaman bank soal terdahulu sudah terpasang. Jika migrasi
terdahulu ada, fungsi/trigger diganti secara kompatibel. Tidak ada perubahan
status atau penghapusan pelajaran lama. Data lama tidak diaudit atau diperbaiki
otomatis; setiap penulisan berikutnya yang menyentuh pelajaran wajib terbit
harus menghasilkan keadaan akhir valid atau menjadikan pelajaran draf.

Pekerjaan di fork ini tidak menerapkan migrasi ke database hosted. Menggabungkan
kode saja tidak memasang trigger pada Supabase. Jangan menjalankan seluruh
riwayat arsip terhadap hosted yang ledger-nya berbeda tanpa rekonsiliasi.

## Perilaku

- Pelajaran terbit dengan `passing_score > 0` memerlukan minimal satu soal
  lengkap: pertanyaan tidak kosong, minimal dua opsi string tidak kosong, poin
  positif, dan indeks kunci dalam rentang opsi.
- Draf dan pelajaran dengan `passing_score = 0` boleh tidak memiliki soal.
- Validasi deferred memeriksa keadaan akhir transaksi; penyimpanan atomik
  opsi+kunci tetap boleh. Permintaan PostgREST terpisah tetap transaksi terpisah:
  buat draf, tambah soal+kunci, lalu terbitkan.
- Perubahan bank menulis baris pelajaran yang sama dengan penerbitan. Penulis
  bersamaan diserialisasi; snapshot `REPEATABLE READ` yang tertinggal ditolak
  dengan kesalahan serialisasi, bukan mengesahkan bank yang sudah berubah.
- Pelanggaran kesiapan menghasilkan SQLSTATE `23514` dengan panduan bahasa
  Indonesia; pemeriksaan frontend tetap berguna tetapi bukan batas keamanan.

## Verifikasi lokal

```
bash .migration-backup/scripts/test-lms-published-quiz-bank.sh
```

Runner hanya menggunakan PostgreSQL sementara melalui Unix socket, tidak
membaca koneksi hosted. Ia sengaja memasang migrasi baru tanpa migrasi pengaman
sebelumnya. Pengujian mencakup insert/update langsung, draf, tanpa kuis wajib,
soal dan kunci tidak lengkap, penerbitan valid, edit opsi+kunci atomik, dan dua
transaksi bersamaan dengan urutan penerbitan/penghapusan atau perubahan kunci
dibalik pada `READ COMMITTED` dan `REPEATABLE READ`.

Skema minimal ini bukan pembuktian kebijakan RLS atau seluruh integrasi HTTP
Supabase; pengujian skema lengkap tetap dijalankan oleh workflow CI.
