# Perlindungan akses permanen super-admin

`scripts/test-bootstrap-super-admin-http.py` menguji kontrak migrasi
`supabase/migrations/20260831010000_manage_aspekindo_admin_accounts.sql`
melalui Auth dan PostgREST asli, bukan mock UI atau klaim JWT buatan.

## Menjalankan pada Supabase lokal

Dari `.migration-backup`, gunakan stack sementara yang bersih:

```sh
python3 scripts/test-bootstrap-super-admin-runner.py
python3 scripts/prepare-supabase-test-project.py /tmp/bootstrap-supabase-test
supabase --workdir /tmp/bootstrap-supabase-test start
# Hanya konfigurasi stack lokal; jangan cetak atau simpan key ke repositori.
eval "$(supabase --workdir /tmp/bootstrap-supabase-test status -o json |
  jq -r '@sh "export TEST_SUPABASE_URL=\(.API_URL) TEST_SUPABASE_ANON_KEY=\(.ANON_KEY) TEST_SUPABASE_SERVICE_ROLE_KEY=\(.SERVICE_ROLE_KEY) TEST_DATABASE_URL=\(.DB_URL)"')"
python3 scripts/test-bootstrap-super-admin-http.py
supabase --workdir /tmp/bootstrap-supabase-test stop --no-backup
```

CI `.github/workflows/assessment-concurrency.yml` menjalankan guard offline
sebelum startup, lalu integrasi setelah semua migrasi diterapkan. Timestamp
legacy yang sama digabung hanya di staging oleh helper yang sudah tersedia.

## Bukti wajib

- URL dibatasi ke API `127.0.0.1:54321` dan database `127.0.0.1:54322`;
  tanpa fallback ke `DATABASE_URL`, proxy lingkungan, atau redirect.
- Ledger harus memuat seluruh versi migrasi repositori. RLS dan izin fungsi
  aktif diperiksa sebelum fixture dibuat.
- Bootstrap dibuat melalui Auth dengan identitas yang ditetapkan migrasi.
  Runner menolak akun bootstrap yang sudah ada, bukan mereset kredensialnya.
  Trigger aplikasi sendiri harus membuat baris `super_admin`.
- Login password asli menghasilkan token. Seluruh serangan dan kontrol REST/RPC
  menggunakan **anon API key dan token pengguna**, bukan service role.
- GET dengan token bootstrap membuktikan baris target benar-benar ada dan
  terlihat sebelum pengujian mutasi.
- `revoke_admin_role` terhadap diri sendiri harus menolak dengan HTTP 400,
  kode `P0001`, dan alasan khusus bahwa bootstrap tidak dapat dicabut.
  Penolakan karena pemanggil bukan super-admin tidak dianggap lulus.
- DELETE baris `super_admin`, PATCH ke `admin`/`user`, dan PATCH pemilik baris
  ke admin operasional harus menolak dengan 403/42501 yang relevan atau
  mengembalikan 200 dengan `[]`, bukan baris yang berubah.
- Setelah **setiap** serangan, snapshot dari koneksi SQL berhak harus identik:
  seluruh baris `user_roles` serta hasil `is_super_admin` dan
  `has_role(admin/super_admin)` kedua pengguna. Hak efektif bootstrap tetap
  benar dan `current_user_is_super_admin` dengan token yang sama tetap true.
- Kontrol positif mencabut admin operasional melalui RPC sebelum dan sesudah
  serangan; DELETE REST juga harus benar-benar mengembalikan baris terhapus.
  Hak efektif admin operasional menjadi false, termasuk melalui token
  operasional yang tidak diganti. Peran lain tidak boleh berubah.
- Service role hanya untuk membuat/menghapus pengguna Auth fixture. Koneksi SQL
  berhak hanya membaca keadaan; tidak menambal role, grant, kebijakan, atau trigger.
  Cleanup terdaftar sebelum pembuatan pengguna agar tetap berjalan saat gagal.

Guard offline juga memastikan respons sukses yang memuat baris, kesalahan
autentikasi, endpoint hilang, penolakan dengan alasan salah, dan perubahan
tersembunyi pada snapshot tidak dapat dianggap sebagai bukti perlindungan.
Guard ini bukan pengganti keberhasilan integrasi pada stack lokal lengkap.

## Hasil verifikasi lokal

Integrasi berhasil pada runtime terbatas menggunakan image database Supabase
`17.11.0.006`, GoTrue `v2.197.0`, Storage API `v1.84.19`, dan PostgREST `v16.5`.
Migrasi provider Auth/Storage asli selesai sebelum pemasangan aplikasi.
Seluruh **94 versi migrasi repositori** dipasang sebagai transaksi staging,
ditambah satu transaksi prasyarat enum legacy dari helper staging. Setiap versi
dicatat pada ledger hanya setelah SQL berhasil; tidak ada tabel minimal
pengganti, penonaktifan RLS, atau perubahan grant aplikasi.

Startup CLI standar gagal pada pemeriksaan kesehatan kontainer
(`OCI runtime exec failed`). Layanan provider dijalankan langsung dengan
koneksi loopback ke database lokal yang sama. Penerus HTTP hanya meneruskan
request/response Auth dan PostgREST; **konfigurasi Kong tidak termasuk bukti
verifikasi ini**. Jalur CI tetap memakai startup Supabase CLI standar.

Kontrol mutasi pada database sementara juga berhasil:

- Menghilangkan guard target bootstrap dari fungsi RPC membuat suite gagal
  karena RPC mengembalikan HTTP 204, bukan penolakan HTTP 400 yang diwajibkan.
- Menambahkan kebijakan DELETE yang meloloskan bootstrap membuat suite gagal
  karena REST benar-benar mengembalikan baris permanen yang terhapus.

Definisi fungsi dan kebijakan asli dipulihkan setelah kontrol tersebut.
Cleanup memastikan pengguna Auth kedua fixture tidak tertinggal. Lima
pemeriksaan guard offline juga lulus. Tidak ada database hosted yang diakses.
