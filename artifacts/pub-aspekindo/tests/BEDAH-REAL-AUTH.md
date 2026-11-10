# Bedah Dokumen: integrasi dengan Auth asli

Jalankan dari root, **bukan** dengan kredensial hosted:

```sh
python3 .migration-backup/scripts/prepare-supabase-test-project.py /tmp/bedah-supabase
supabase --workdir /tmp/bedah-supabase start
umask 077
supabase --workdir /tmp/bedah-supabase status -o json > /tmp/bedah-local-status.json
mkdir -p generated-artifacts/bedah
pnpm --filter @workspace/pub-aspekindo test:bedah:integration /tmp/bedah-local-status.json
supabase --workdir /tmp/bedah-supabase stop --no-backup
rm -f /tmp/bedah-local-status.json
```

Prasyarat: Node 24, pnpm, OpenSSL, Docker/Supabase lokal, browser Chromium
Playwright beserta dependensi native. Runner menolak URL non-loopback sebelum
menjalankan SQL atau membuat akun. Tidak ada fallback ke konfigurasi workspace.
Startup gagal atau Auth/PostgREST tidak siap adalah kegagalan setup, bukan tes
privasi yang lulus. CI menjalankan suite ini pada stack dengan seluruh migrasi PUB.

## Yang benar-benar digunakan

- Aplikasi PUB lengkap, `AuthProvider` dan SDK Supabase asli. Login pertama melalui
  formulir PUB; pergantian akun memakai SDK asli di halaman yang sama, tanpa reload
  agar respons request lama masih dapat kembali ke komponen yang sudah dilepas.
- Akun owner, anggota lain, dan admin disposable di GoTrue lokal. Hak admin
  dibuktikan lewat pembacaan `user_roles` dengan sesi admin tersebut.
- Middleware `vault-pub-auth`, router Ruang Simpan/Bedah Dokumen, validasi,
  ekstraksi TXT, kepemilikan, dan transaksi PostgreSQL asli. Database metadata
  API dibuat terpisah dengan nama acak dan dihapus sesudahnya.
- Gerbang HTTPS lokal meneruskan Auth/PostgREST tanpa mengganti respons atau
  membuat token. Sertifikat sementara dipercaya hanya oleh proses uji.
- Browser memakai build produksi di direktori sementara, cache Vite terpisah,
  dan port acak. Preview pengguna tidak dibangun ulang, direstart, atau dipakai
  sebagai target. Tidak ada HMR/penemuan dependensi saat request sedang diuji.
- Modul khusus build uji mengekspos instance SDK Supabase yang sama dengan
  `AuthProvider` untuk tindakan pergantian akun. Tidak membuat klien kedua,
  mengganti context Auth, atau menyisipkan sesi. Modul ini tidak ikut build biasa.

## Batas sintetis yang sengaja dipertahankan

- Adapter `@google-cloud/storage` test-only menyimpan byte sintetis pada direktori
  privat lokal (direktori 0700/file 0600), bukan App Storage hosted. Fungsi unggah,
  download, metadata, dan penghapusan aplikasi tetap asli. Ini **bukan** bukti
  kebijakan IAM App Storage produksi.
- Transport OpenRouter dalam bundle uji diarahkan ke provider HTTP deterministik
  lokal, dengan model dan larangan fallback diperiksa. Parsing respons, kutipan,
  penyimpanan analisis dan chat tetap asli. Ini **bukan** smoke provider berbayar,
  pengukuran mutu Claude, atau bukti kredit OpenRouter tersedia.
- Tabel metadata API memakai skema Ruang Simpan saat ini, bukan seluruh migrasi
  database API. Skema Supabase PUB penuh disiapkan oleh CLI di CI.

Tidak ada `route.fulfill`, Auth fixture, JWT buatan, ataupun penyisipan sesi ke
localStorage. Routing browser hanya memblokir koneksi nonlokal. Uji HTTP sintetis
lama dan smoke UI fixture tetap berguna tetapi tidak menggantikan suite ini.

## Bukti yang diperiksa

1. Unggah TXT privat, analisis dengan persetujuan, chat, reload dan pemulihan hasil.
2. Akun lain serta admin tidak memperoleh dokumen/analisis, download, chat,
   analisis ulang, atau penghapusan milik owner, termasuk lewat tautan langsung.
3. Request chat dan analisis ditahan setelah provider menerima request owner;
   ganti akun sungguhan; lepaskan respons lama; pastikan hasil, input, tombol
   ekspor dan navigasi tidak terbawa ke akun baru.
4. Owner tetap dapat membuka hasil dan chat terlambatnya sendiri.
5. Penghapusan kedua sumber meniadakan analisis/chat/download, baik HTTP,
   tampilan setelah reload, metadata SQL, maupun byte file lokal.

Tidak ada trace, video, storageState atau upload artefak CI karena dapat memuat
sesi akun disposable. Manifest, password, sertifikat, file privat dan database
dihapus dalam cleanup; CI juga selalu mematikan stack lokal. Jika proses dihentikan
dengan SIGKILL, hentikan stack lokal dan hapus direktori run sebelum mengulang.

`--setup-check` hanya menjalankan preflight HTTP asli (langsung serta lewat proxy
dengan Origin browser), pembuatan build, dan cleanup—**bukan** hasil uji browser.
`--upload-check` membatasi browser pada login/unggah/pembaruan daftar dan cleanup;
**bukan** kelulusan skenario pergantian akun. CI tidak memakai kedua flag tersebut.

## Batas hasil verifikasi workspace

Preflight HTTP asli (termasuk cookie, prioritas bearer, origin, chat tertunda,
isolasi owner/admin, persistensi dan penghapusan), build terisolasi, serta
pemeriksaan tipe telah lulus pada layanan lokal asli. Startup CLI standar di
workspace gagal saat bootstrap; layanan GoTrue/PostgREST/Storage asli dijalankan
langsung dengan database Supabase lokal, dan seluruh migrasi staging dipasang
transaksional beserta ledger. Ini bukan verifikasi Kong atau Realtime.

Percobaan browser menemukan setup logger/proxy, sinkronisasi login, lalu navigasi
onboarding akun baru yang dapat memindahkan halaman di tengah unggah. Setup telah
diperbaiki; suite kini melewati onboarding lewat tombol UI asli. **Belum ada
kelulusan browser seluruh skenario setelah perbaikan onboarding terakhir.**
Jangan menyebut preflight atau targeted upload sebagai E2E penuh yang lulus.
Workflow CI menyediakan jalur untuk menjalankan seluruh suite pada Ubuntu.
