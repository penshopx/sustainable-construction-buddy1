# OCR privat Ruang Simpan

- Unggah biasa hanya membaca teks lokal; tidak menyiratkan persetujuan mengirim
  file ke AI. Pemilik memilih **Baca teks dengan OCR**, membaca penjelasan,
  mencentang persetujuan, lalu mengirimnya untuk **satu percobaan**.
- OCR menerima PNG/JPG dan PDF scan. Seluruh file dikirim sebagai data inline,
  bukan tautan publik, ke OpenRouter dan Anthropic Sonnet 4.5. Provider dikunci
  ke Anthropic dan PDF ke engine `native`; jangan membiarkan pemilihan engine
  bawaan menambahkan penyedia lain tanpa perubahan persetujuan.
- Tidak ada retry otomatis, model cadangan, atau jaminan retensi dari aplikasi.
  `data_collection: deny` adalah permintaan kebijakan penyedia, bukan klaim
  penyimpanan nol. Kredit/batas OpenRouter yang tidak cukup tampil sebagai gagal.
- Kuota asli 15 MiB tidak berubah. OCR berbagi dua slot per proses API dengan
  parser lokal; worker dibatasi heap 128/16 MiB, waktu 60 detik, respons 1 MiB,
  hasil 100.000 karakter dan 12.000 token keluaran. PDF maksimal 30 halaman.
  Respons terpotong ditolak, bukan ditandai siap. File panjang mungkin perlu
  dipecah walaupun belum mencapai batas halaman.
- Metadata pekerjaan disimpan sebelum I/O. Tidak ada transaksi database yang
  menunggu layanan OCR. Pengiriman gagal tidak menandai siap; penyimpanan hasil
  gagal dipulihkan menjadi gagal saat lease 120 detik habis. Membuka workspace
  memeriksa lease, dan tampilan polling mengikuti proses.
- Audit menyimpan persetujuan berversi serta hasil proses, bukan file/base64/
  kunci/respons mentah penyedia. Penghapusan dokumen mencegah hasil lama
  menghidupkannya lagi. Percobaan ulang memerlukan persetujuan baru dan jeda.
- Hanya pemilik terautentikasi yang dapat memulai OCR. Koneksi aplikasi eksternal
  tidak mendapat izin OCR. Autentikasi PUB yang sudah berlaku dipertahankan;
  pekerjaan ini tidak membuat migrasi kembali ke akun Clerk terpisah.
- Teks tersimpan menjadi sumber pencarian dan cuplikan chat yang sama seperti
  dokumen biasa. OCR dapat salah; periksa kutipan terhadap file asli.

## Pemeriksaan

```sh
cd artifacts/api-server
node --test tests/vault-ocr.test.mjs tests/vault-worker-limits.test.mjs tests/vault-ai.test.mjs
```

Suite memakai dua identitas owner sintetis pada batas autentikasi, database dan
blob terisolasi, serta respons provider tiruan. Ia tidak membuktikan sesi login
nyata ataupun akurasi OCR nyata.

Pemeriksaan berbayar, opsional, hanya membuat foto bertulisan dan PDF image-only
sintetis. Memerlukan ImageMagick, build API, serta konfigurasi OpenRouter yang
memadai; tidak mengambil file anggota. Hasil berada di direktori yang diabaikan
Git/deploy:

```sh
pnpm --filter @workspace/api-server build
RS_OCR_SYNTHETIC_LIVE=1 node artifacts/api-server/scripts/check-vault-ocr-synthetic.mjs
```

Pada pemeriksaan lingkungan kerja, provider menolak dengan HTTP 402, termasuk
permintaan keluaran kecil. Karena itu akurasi OCR live belum terverifikasi.
