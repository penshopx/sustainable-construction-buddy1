---
name: Supabase lokal pada runtime terbatas
description: Batas verifikasi HTTP Supabase lokal ketika proses kontainer tidak dapat menjalankan pemeriksaan kesehatan.
---

Tersedianya perintah Docker dan PostgreSQL yang menerima koneksi belum membuktikan stack Supabase lokal dapat digunakan. Runtime dapat menolak eksekusi proses pemeriksaan kesehatan dengan `OCI runtime exec failed`, sehingga Auth dan gateway belum tersedia.

**Why:** Penyiapan Supabase lokal dapat berhenti pada database berstatus unhealthy, termasuk saat opsi mengabaikan pemeriksaan kesehatan dipakai. Ini kegagalan lingkungan sebelum pengujian HTTP berjalan, bukan bukti RPC gagal.

**How to apply:** Bedakan hasil pemeriksaan sintaks dari hasil pengujian HTTP sesungguhnya. Jika stack tidak siap, nyatakan keterbatasan verifikasi dan gunakan CI Supabase lokal; jangan mengganti target dengan database hosted atau mengklaim uji SQL sebagai uji gateway.

Menjalankan `supabase start --ignore-health-check` setelah startup parsial dapat keluar sukses hanya dengan database yang sudah hidup, sementara Auth dan PostgREST tetap berhenti.

**Why:** Kode keluar nol pada startup ulang bukan bukti seluruh stack telah diinisialisasi.

**How to apply:** Wajib periksa ketersediaan Auth/PostgREST dan ledger seluruh migrasi sebelum menyebut pengujian skema lengkap berhasil.

Inisialisasi Realtime juga dapat gagal dengan `eafnosupport` pada listener ketika keluarga alamat jaringan tidak didukung runtime. Mengecualikan layanan Realtime dari `start` belum tentu melewati langkah inisialisasi skemanya.

**Why:** CLI dapat menjalankan kontainer inisialisasi sebelum memilih layanan yang dinyalakan. Menonaktifkan layanan saja tidak menjamin bootstrap database selesai.

**How to apply:** Jika database sehat tetapi `Initialising schema` berhenti, periksa error kontainer bootstrap. Database image Supabase tanpa bootstrap lengkap juga belum setara stack termigrasi: skema Storage awal dapat belum memiliki kolom yang dibutuhkan migrasi aplikasi.

Kegagalan `docker exec` tidak selalu menghalangi `docker run`. Bila CLI tidak dapat melewati health-check, layanan GoTrue, Storage API, dan PostgREST asli dapat dijalankan langsung pada database Supabase lokal yang sama untuk memverifikasi batas API/database.

**Why:** Runtime pernah berhasil menjalankan proses utama kontainer tetapi menolak proses health-check tambahan. Layanan asli masih bisa menerapkan migrasi provider dan memvalidasi JWT/RLS; ini berbeda dari mengganti skema dengan tabel minimal.

**How to apply:** Pastikan migrasi Auth/Storage asli selesai sebelum seluruh migrasi aplikasi dipasang dengan CLI dan ledger diperiksa. Bila memakai penerus HTTP lokal, teruskan request tanpa mengubah header/badan/respons dan nyatakan bahwa konfigurasi Kong tidak ikut diuji. Jangan menyebut startup CLI gagal sebagai stack resmi yang sehat.

Koneksi antarkontainer melalui jaringan bridge dapat macet meskipun proses layanan hidup dan PostgreSQL menerima koneksi dari host; jaringan host dengan koneksi loopback dapat bekerja pada runtime yang sama.

**Why:** Layanan asli pernah berhenti pada log awal tanpa menyelesaikan migrasi provider melalui bridge, bahkan dengan alamat IP langsung; pada jaringan host migrasi dan permintaan Auth/PostgREST berhasil.

**How to apply:** Bedakan proses hidup dari layanan siap. Jika koneksi bridge macet, verifikasi alternatif jaringan lokal tanpa mengganti skema atau memakai layanan hosted; tetap periksa migrasi provider dan ledger aplikasi sebelum menjalankan uji HTTP.

Pada image database Supabase, nama role `postgres` tidak menjamin hak superuser atau kepemilikan skema Auth/Storage. Migrasi provider dapat gagal dengan izin skema meskipun koneksi database berhasil.

**Why:** Menjalankan layanan provider dengan role aplikasi `postgres` pernah menolak migrasi skema bawaan; role pemilik provider menjalankan migrasi aslinya tanpa melonggarkan grant.

**How to apply:** Saat menyiapkan kontainer lokal langsung, gunakan role pemilik Auth/Storage masing-masing untuk migrasi provider. Jangan mengatasi kegagalan bootstrap dengan grant luas atau skema pengganti minimal.

Pada image database yang dijalankan langsung, pengaturan password database utama
belum tentu mengatur password role pemilik Auth/Storage atau `authenticator`.

**Why:** Provider pernah gagal dengan autentikasi password meski koneksi
`supabase_admin` berhasil; ini berbeda dari kegagalan hak skema.

**How to apply:** Untuk stack lokal sementara buatan sendiri, konfigurasikan
kredensial role provider secara eksplisit sebelum menyalakan layanan. Jangan
mengganti koneksi provider menjadi superuser atau melonggarkan grant aplikasi.

Fixture SQL yang membuat trigger audit juga harus memakai koneksi pemilik migrasi aplikasi, bukan sekadar role bernama `postgres`. Bootstrap manual dengan `supabase_admin` dapat menghasilkan kepemilikan tabel berbeda dari startup CLI biasa.

**Why:** Pembacaan dan penskoran dapat berhasil sementara pembuatan trigger fixture gagal dengan `must be owner of relation`. Kegagalan cleanup yang berhenti pada DDL itu juga dapat meninggalkan pengguna Auth uji sehingga email fixture tidak dapat dipakai pada percobaan berikutnya.

**How to apply:** Samakan koneksi fixture dengan pemilik yang menerapkan migrasi pada database lokal sementara. Pertahankan pemeriksaan akses melalui sesi Auth asli atau `SET ROLE authenticated`; jangan memberi grant baru pada tabel aplikasi untuk menyamakan bootstrap manual dengan CLI.

Pada bootstrap Auth manual, login sukses belum membuktikan sesi dapat dipakai oleh PostgREST. Token bertanda tangan valid dapat membawa role kosong bila konfigurasi grup bawaan Auth tidak sesuai versi layanan.

**Why:** Auth pernah menerbitkan sesi HTTP 200, tetapi PostgREST menolak role kosong dengan HTTP 401. Ini masalah konfigurasi fixture, bukan bukti pencabutan izin berhasil.

**How to apply:** Pertahankan kontrol positif memakai token yang sama untuk operasi yang memang diizinkan. Jika kontrol itu gagal, periksa kode kesalahan PostgREST dan hanya metadata role/algoritma token, tanpa mencetak token atau mengubah kebijakan aplikasi.

Bootstrap image database Supabase dapat memakai port socket `5432` secara
eksplisit dalam skrip migrasi bawaan, walaupun `PGPORT` diubah. Mengubah port
server sejak inisialisasi pertama dapat menggagalkan migrasi provider.

**Why:** Pada bootstrap jaringan host, server sementara berhasil hidup pada
port baru tetapi skrip bawaan tetap mencari socket port `5432`.

**How to apply:** Pertahankan port bawaan selama inisialisasi image, atau
selesaikan inisialisasi dahulu sebelum mengubah port. Untuk CLI yang memasang
migrasi melalui URL loopback tanpa TLS, tambahkan `sslmode=disable` pada URL
khusus perintah itu; jangan melonggarkan koneksi hosted atau pengaman URL runner.

CLI pemasang migrasi dapat beralih ke role `postgres` walaupun URL koneksi
memakai `supabase_admin`. Pada bootstrap manual, kepemilikan provider belum
tentu mendukung jalur ini.

**Why:** Migrasi tabel aplikasi dibuat atas nama `postgres`, lalu pembuatan
kebijakan pada tabel Storage milik provider ditolak meskipun session user
adalah superuser.

**How to apply:** Jangan mengubah grant aplikasi demi meloloskan setup uji.
Alternatif lokal adalah menerapkan seluruh SQL staging sebagai pemilik migrasi
berhak, tiap berkas dalam transaksi bersama pencatatan ledger setelah SQL-nya
berhasil. Laporkan bahwa pemasangan ini manual, bukan startup CLI standar.
