---
name: Playwright di Nix
description: Perbedaan dependensi native browser Playwright pada workspace Nix dan GitHub Actions Ubuntu.
---

Instalasi browser Playwright yang sukses belum memastikan browser dapat diluncurkan di workspace Nix. Bila semua tes gagal sebelum halaman dibuat, periksa pesan pustaka bersama yang hilang, bukan mengubah tes aplikasi. Dalam satu pengujian lokal, pustaka GLib dan kemudian GBM diperlukan; pemasangan dependensi Nix untuk keduanya memungkinkan browser berjalan.

**Why:** Perintah pemasangan Chromium hanya mengunduh browser; lingkungan Nix tidak otomatis menyediakan semua pustaka bersama seperti runner GitHub Actions Ubuntu.

**How to apply:** Bila browser lokal gagal diluncurkan, periksa pustaka yang hilang dan apakah pustaka tersebut sudah tersedia di Nix store. Browser unduhan dapat tidak menemukan pustaka yang sebenarnya sudah terpasang; jalur library sementara untuk proses tes dapat mencukupi tanpa mengubah workflow. Bila memang belum tersedia, pasang lewat fasilitas package-management. Jangan simpulkan kegagalan CI dari kegagalan pustaka lokal; verifikasi CI memakai runner dan langkah instalasi dependensinya sendiri.