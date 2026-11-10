---
name: Batas penyedia OCR dokumen
description: Alasan penguncian penyedia dan engine PDF pada OCR privat.
---

Persetujuan OCR menyebut penyedia tertentu. Jangan membiarkan pemrosesan PDF
memakai engine bawaan OpenRouter atau perpindahan provider otomatis ketika
mengubah integrasinya.

**Why:** Dokumentasi OpenRouter menyebut default PDF dapat beralih ke
Mistral OCR bila model tidak menerima file secara native. Itu menambahkan
penerima dokumen di luar penyedia yang dijelaskan pada persetujuan.

**How to apply:** Kunci engine dan provider sesuai persetujuan. Jika kombinasi
tersebut tidak tersedia, tampilkan kegagalan; perluas persetujuan terlebih dulu
sebelum menambahkan penerima file atau fallback.

Untuk OCR sebagian PDF, kirim hanya hasil render visual halaman pilihan tanpa
anotasi, bukan salinan objek PDF atau PDF asli dengan instruksi agar model
mengabaikan halaman lain. Nomor halaman kutipan
berasal dari pemetaan halaman yang tervalidasi, bukan angka di teks OCR.

**Why:** Anotasi, lampiran tingkat halaman, dan resource bersama yang tidak
digunakan dapat membawa data di luar rentang walaupun penyalin PDF hanya memilih
halaman tertentu. Instruksi pada model tidak membatasi dokumen yang diterima
penyedia. Pemisahan halaman juga mencegah
kutipan melintasi halaman dan memperoleh nomor sumber yang keliru.

**How to apply:** Pertahankan persiapan lokal yang dibatasi waktu/memori, reset
persetujuan ketika rentang berubah, dan tolak keluaran tanpa daftar halaman lengkap.

Pengukuran akurasi OCR berbayar hanya boleh dijalankan setelah persetujuan
eksplisit pengujian berbayar dan konfirmasi kredit/batas provider memadai,
tanpa data anggota. Respons provider tiruan bukan bukti akurasi.

**Why:** Pengguna menetapkan batas tersebut setelah uji live tertahan HTTP 402.
Keberhasilan mekanisme pengujian offline tidak membuktikan kemampuan OCR nyata.

**How to apply:** Pisahkan hasil pemeriksaan protokol dari pengukuran provider
nyata; gunakan acuan teks dan bukti kutipan independen, dan laporkan uji live
yang belum berjalan sebagai belum diukur, bukan lulus.
