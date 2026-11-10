# Uji otoritas nilai kuis

## Perlindungan bank soal pelajaran terbit

Jalankan `bash scripts/test-lms-published-quiz-bank.sh` dari `.migration-backup`.
Runner membuat PostgreSQL sementara dan memasang migrasi pengaman asli.
Uji mencakup penghapusan terakhir melalui akses tabel, perubahan/penghapusan
kunci, opsi rusak, pemindahan soal, penyimpanan opsi+kunci atomik, pengecualian
draf/nilai lulus nol, dan dua penghapusan bersamaan pada READ COMMITTED serta
REPEATABLE READ. Uji berjalan sebagai peran `authenticated`, dengan grant
fixture; ini bukan bukti kebijakan RLS lengkap. Runner tidak memakai koneksi hosted.
CI menjalankan runner ini sebelum pemeriksaan skema Supabase lengkap.

Migrasi `20261101090000_protect_published_lms_quiz_bank.sql` harus diterapkan
melalui proses migrasi Supabase proyek saat perubahan digabung. Menjalankan
frontend baru saja tidak memasang trigger ke database hosted. Migrasi tidak
memperbaiki bank soal lama secara otomatis; pelajaran lama yang sudah rusak
perlu dijadikan draf sebelum perbaikan. Pemeriksaan dipasang sebagai constraint
deferred agar RPC dapat memperbarui opsi dan kunci dalam satu transaksi.

## Otoritas penilaian

Dua mode menjalankan `supabase/tests/aspekindo_lms_quiz_authority.sql`:

- `bash scripts/test-aspekindo-lms-quiz-authority.sh`: PostgreSQL sementara,
  skema minimal, dan definisi RPC asli. Ini uji penilaian cepat, bukan bukti RLS.
- `TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres bash scripts/test-aspekindo-lms-quiz-authority.sh --supabase`:
  Supabase lokal yang sudah menerima semua migrasi. Mode ini menolak alamat
  hosted, parameter pengalih koneksi, dan fallback `DATABASE_URL`.

CI `.github/workflows/assessment-concurrency.yml` menyiapkan proyek lokal
`aspekindo-ci`, menjalankan semua migrasi, lalu menjalankan mode lengkap sebelum
uji assessment. Tidak ada link, push database, kredensial produksi, atau migrasi
ke layanan hosted. Proyek sementara dihentikan meskipun pengujian gagal.

Untuk mereproduksi dari direktori `.migration-backup`:

```sh
python3 scripts/test-lms-quiz-ci.py
python3 scripts/prepare-supabase-test-project.py /tmp/aspekindo-supabase-test
supabase --workdir /tmp/aspekindo-supabase-test start
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres \
  bash scripts/test-aspekindo-lms-quiz-authority.sh --supabase
supabase --workdir /tmp/aspekindo-supabase-test stop --no-backup
```

Gunakan direktori baru pada setiap persiapan. Staging menyertakan setiap berkas
migrasi secara utuh dan dalam urutan nama. Dua migrasi lama memiliki timestamp
yang sama; keduanya digabung hanya dalam salinan sementara agar ledger versi
Supabase yang unik tidak menolak migrasi kedua. Berkas migrasi asli dan
identitas proyek hosted tidak diubah atau disalin.

Mode lengkap memeriksa ledger migrasi, RLS, izin eksekusi, dan trigger aktif.
Seluruh RPC dan pembacaan peserta dijalankan dengan `SET LOCAL ROLE authenticated`
serta identitas JWT pemilik, bukan hanya klaim JWT pada koneksi superuser.
Uji meliputi penilaian berbobot, batas lulus/pembulatan, penolakan penyelesaian
sebelum lulus, kunci jawaban privat, penolakan manipulasi nilai, serta isolasi
hasil antar akun. Semua fixture berada dalam satu transaksi yang di-rollback;
kesalahan SQL menghentikan runner dengan exit non-zero.

Jika bootstrap Supabase gagal di runtime terbatas (misalnya listener Realtime
menolak keluarga alamat dengan `eafnosupport`), mode skema lengkap belum teruji.
Gunakan hasil job CI Ubuntu sebagai bukti integrasi lengkap; PostgreSQL minimal
atau image database Supabase yang belum selesai bootstrap bukan penggantinya.
