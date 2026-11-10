# Pencabutan akses sertifikat lewat HTTP lokal

Uji ini memakai Supabase lokal dengan **seluruh migrasi**, sesi password Auth
asli, dan PostgREST. Tidak ada koneksi ke hosted. Kebijakan SELECT yang diuji
berasal dari
`supabase/migrations/20260227150501_7b7638d4-d65b-4604-8ce8-7e051d25c092.sql`.
Tidak diperlukan perubahan kebijakan untuk skenario ini.

Runner menolak URL API/database nonlokal. Koneksi SQL berhak hanya menyiapkan
fixture dan memeriksa keadaan tersimpan. Service-role key hanya membuat pengguna
Auth; setiap pembacaan HTTP menggunakan anon API key dan token pengguna.

## Menjalankan

Dari direktori `.migration-backup`, siapkan direktori sementara yang baru:

```sh
python3 scripts/prepare-supabase-test-project.py /tmp/certificate-supabase-test
supabase --workdir /tmp/certificate-supabase-test start
# Ambil konfigurasi lokal tanpa menampilkan key atau menyimpannya di repositori.
eval "$(supabase --workdir /tmp/certificate-supabase-test status -o json |
  jq -r '@sh "export TEST_SUPABASE_URL=\(.API_URL) TEST_SUPABASE_ANON_KEY=\(.ANON_KEY) TEST_SUPABASE_SERVICE_ROLE_KEY=\(.SERVICE_ROLE_KEY) TEST_DATABASE_URL=\(.DB_URL)"')"
bash scripts/test-submit-assessment-concurrency.sh --admin-certificate-revocation
supabase --workdir /tmp/certificate-supabase-test stop --no-backup
```

Mode khusus tersebut tidak menunggu skenario assessment lama. Uji juga
disertakan dalam mode default dan job CI
`.github/workflows/assessment-concurrency.yml`.

## Bukti yang diwajibkan

- Ledger memuat setiap versi migrasi repositori.
- Fixture membuat sertifikat anggota dan admin, lalu memberi peran admin.
- Token Auth admin membaca dua baris lengkap sebelum pencabutan.
- Koneksi SQL berhak mencabut peran dalam transaksi dengan `COMMIT`, lalu
  memastikan `has_role(admin)` sudah false.
- **Token yang sama**, tanpa login ulang atau refresh, menerima HTTP 200 dengan
  `[]` untuk sertifikat anggota tetapi tetap menerima baris lengkap miliknya.
  Pembacaan gabungan serta tanpa filter juga harus cocok persis dengan baris
  yang diizinkan.
- Snapshot SQL memastikan kedua sertifikat tidak dihapus atau berubah.
- Cleanup menghapus sertifikat secara eksplisit: tabel ini tidak memiliki
  foreign key yang menghapus sertifikat saat pengguna Auth fixture dihapus.

HTTP 401/403, tabel hilang, atau kebijakan yang menolak semua baris tidak
dianggap berhasil. Jika bootstrap lokal tidak tersedia, hasil pemeriksaan
sintaks bukan bukti keberhasilan integrasi; jalankan job CI Supabase lokal.

## Verifikasi pada runtime terbatas

Uji berhasil dijalankan dengan image database Supabase, migrasi Auth/Storage
asli, dan seluruh SQL aplikasi dari staging yang sama. Setiap berkas staging
diterapkan dalam transaksi bersama pencatatan ledger menggunakan pemilik
migrasi berhak. Auth dan PostgREST asli dihubungkan melalui penerus HTTP lokal
yang meneruskan header, badan, dan respons; konfigurasi Kong tidak ikut diuji.
Startup CLI standar gagal pada health-check kontainer di lingkungan ini.

Kontrol negatif pada database sementara juga lulus: menambahkan kebijakan
SELECT yang membuka semua sertifikat membuat uji gagal tepat pada pembacaan
anggota setelah pencabutan. Kebijakan restrictive yang menolak semua baris
membuat uji gagal pada kontrol positif sebelum pencabutan. Kedua kebijakan
sementara dihapus setelah pemeriksaan; tidak ada migrasi aplikasi yang diubah.
