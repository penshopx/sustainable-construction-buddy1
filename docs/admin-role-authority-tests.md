# Uji batas hak admin aktif

Uji ini menggunakan sesi password Auth asli, anon API key, dan PostgREST pada
Supabase lokal dengan **seluruh migrasi** di `.migration-backup/supabase/migrations`.
Tidak memakai database hosted, JWT buatan, atau mock UI.

## Menjalankan

Ikuti penyiapan stack sementara di `.github/workflows/assessment-concurrency.yml`:
siapkan salinan migrasi memakai `prepare-supabase-test-project.py`, nyalakan
Supabase lokal, lalu berikan `TEST_DATABASE_URL`, `TEST_SUPABASE_URL`,
`TEST_SUPABASE_ANON_KEY`, dan `TEST_SUPABASE_SERVICE_ROLE_KEY` dari stack lokal
tersebut. Jangan memakai kunci proyek hosted.

```sh
cd .migration-backup
bash scripts/test-submit-assessment-concurrency.sh --admin-role-escalation
```

Runner menolak alamat API/database non-loopback serta opsi URL yang dapat
mengalihkan koneksi. Gunakan stack lokal sementara yang bersih: fixture membuat
akun bootstrap dengan identitas yang ditentukan migrasi, bukan akun pengguna
yang sudah ada. Trap runner menghapus akun fixture beserta role-nya saat selesai
atau gagal. Jangan menjalankan runner ini bersamaan pada stack yang sama.

## Bukti yang diperiksa

- Super-admin bootstrap memberikan `admin` lewat RPC sebelum serangan.
- Admin operasional tetap memiliki `admin`, tetapi bukan `super_admin`.
- Dengan token admin yang sama, INSERT dan UPDATE mencoba memperoleh
  `super_admin` untuk dirinya dan memberikan `admin` kepada anggota lain.
- Kedua target UPDATE benar-benar ada dan terbaca oleh token admin.
- RPC `grant_admin_role` ditolak baik untuk dirinya maupun anggota lain.
- Setelah setiap serangan, snapshot berhak memastikan seluruh baris
  `user_roles` tidak berubah dan hak efektif admin, anggota, serta bootstrap
  tetap sesuai.
- Penolakan harus berasal dari otorisasi: INSERT menerima 403/42501; UPDATE
  menerima 403/42501 atau 200 dengan `[]` karena tidak ada baris yang lolos RLS;
  RPC menerima pesan penolakan bootstrap yang tepat. Error endpoint, JWT,
  constraint, atau payload bukan hasil lulus.
- Kontrol positif bootstrap pada INSERT dan RPC benar-benar menyimpan dan
  memberikan hak `admin` kepada anggota target yang sama. Pencabutan lewat RPC
  mengembalikan snapshot awal di antara kedua kontrol.

Tidak ada kontrol UPDATE yang diharapkan berhasil: migrasi memang tidak
memberikan kebijakan UPDATE pada `user_roles`, termasuk untuk bootstrap.

Workflow CI menjalankan mode ini secara terpisah dari
`--admin-role-revocation`. Runner tanpa argumen mencakup kedua skenario.
`python3 scripts/test-lms-quiz-ci.py` memeriksa pengaman runner dan assertion
snapshot secara offline; hasilnya bukan pengganti uji Auth/PostgREST.

## Verifikasi di lingkungan pengembangan

Mode aktif dan pencabutan keduanya lulus melalui GoTrue v2.171.0 dan PostgREST
v12.2.12 pada image database Supabase 15.8.1.069. Migrasi Auth dan Storage asli
selesai sebelum seluruh migrasi aplikasi dipasang secara transaksional beserta
ledger-nya (95 versi staging, termasuk prasyarat enum khusus pengujian).
Pemeriksaan akhir menemukan nol akun fixture tersisa.

Startup CLI standar berhenti pada inisialisasi Realtime dengan `eafnosupport`,
termasuk ketika layanan Realtime dikecualikan. Karena itu verifikasi lokal ini
menjalankan layanan provider asli secara langsung dan penerus HTTP loopback
tanpa mengubah header, identitas, payload, atau respons. Ini menguji sesi Auth,
PostgREST, RLS, grant dan fungsi migrasi lengkap, **bukan** konfigurasi Kong atau
kesehatan stack CLI standar. CI tetap memakai startup Supabase standar.
