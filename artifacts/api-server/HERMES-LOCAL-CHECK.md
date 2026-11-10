# Uji Hermes Lokal

Di preview, Super Admin dapat membuka **Admin → Akses → Uji Hermes Lokal**.
Centang persetujuan data contoh, lalu tekan **Uji Hermes Lokal**. Tidak ada
eksekusi saat halaman dibuka atau pengiriman ulang otomatis saat gagal.

## Mode BG001 — rujukan regulasi unggahan

Pilihan **Mode uji → BG001 — rujukan regulasi unggahan** mengaktifkan tombol
**Uji Hermes BG001**. Mengubah mode menghapus hasil dan persetujuan sebelumnya;
pengguna harus menyetujui penggunaan kutipan BG001 secara eksplisit.

`POST /api/operator/hermes/bg001-check` juga hanya menerima `{ "consent": true }`.
Pertanyaan dan konteks dimiliki server, bukan dikirim pengguna. Rujukannya:

- KB09, halaman PDF 21: pemetaan skema BG001 → KBLI 41011.
- KB19, halaman PDF 17: ruang lingkup subklasifikasi.
- KB44, halaman PDF 573: uraian KBLI 2025.

Respons ditetapkan dari bank jawaban acuan dan diberi label tiruan lokal.
Perbedaan teks antarversi tetap dipisahkan, bukan diputuskan menjadi kewenangan
atau konversi resmi. Server memeriksa kecocokan ID sumber/halaman dan memastikan
pesan pengguna yang diterima Hermes berisi konteks serta pertanyaan persis
seperti yang disiapkan. Ini bukti transport konteks, bukan kualitas penalaran AI.

Jalur ini tidak menerima kunci provider atau menggunakan `fetch` model eksternal,
bahkan bila kunci nyata tersedia pada host. Konteks dibatasi ukurannya sebelum
worker dijalankan. Respons yang kehilangan konteks atau pasangan kutipan yang
sesuai ditolak; runtime tidak diganti dengan simulasi saat gagal.

Chat utama Pakar Cerdas dan pilihan profil anggota tidak berubah. Pilot ini
belum memperluas Hermes ke semua skema atau mengaktifkan analisis Claude.

## Apa yang dijalankan pada mode Runtime (sintetis)

- Worker Hermes nyata yang sudah disiapkan dalam runtime Nix preview.
- Satu catatan sintetis, tanpa pengambilan dokumen anggota.
- Satu respons penyedia model tiruan di jalur server lokal.
- Tidak ada panggilan model eksternal atau kunci provider sungguhan.
- Alat agen dinonaktifkan; hasil hanya membuktikan putaran runtime selesai,
  bukan ketepatan Claude, kepatuhan dokumen, atau kesiapan produksi.

Tombol ini berbeda dari simulasi OpenClaw–Hermes pada panel operator.
OpenClaw tidak dipasang atau dijalankan. Runtime yang hilang/gagal menghasilkan
kesalahan, bukan penggantian runtime dengan hasil simulasi yang dinyatakan sukses.
Tombol tidak memasang runtime atau mengaktifkan provider.

## Batas akses dan eksekusi

`POST /api/operator/hermes/local-check` menerima hanya `{ "consent": true }`.
Endpoint hanya tersedia saat `NODE_ENV=development`, memeriksa sesi dan peran
Super Admin dari server sebelum serta setelah worker berjalan. Pemeriksaan ini
tetap membutuhkan layanan autentikasi yang tersedia; mode lokal bukan bypass login.
Hanya public key dan bearer anggota digunakan untuk pemeriksaan akses.

Maksimum tiga percobaan gabungan kedua mode dan chat Hermes BG001 per operator per jam dan satu proses bersamaan per
proses server. Percobaan yang gagal setelah worker mulai tetap memakai kuota.
Kuota berada dalam memori dan kembali awal ketika server restart.
Putus koneksi atau pembatalan meneruskan sinyal berhenti ke worker. Worker memiliki
batas waktu; endpoint dibatasi 90 detik dan client berhenti menunggu setelah
100 detik. Hasil tidak disimpan, hilang saat reload, dan dibersihkan saat akun
berganti/keluar. Pemeriksaan ini bukan sandbox OS untuk menjalankan kode pengguna.

## Pemeriksaan lokal

```sh
pnpm --filter @workspace/api-server exec node --test tests/hermes-local-check.test.mjs
pnpm --filter @workspace/pub-aspekindo exec node --experimental-strip-types --test src/lib/hermesLocalCheck.integration.test.ts
```

Kasus worker nyata berjalan bila runtime sudah tersedia. Pengujian tersebut
memblokir global `fetch` agar panggilan model eksternal yang tidak disengaja gagal.
