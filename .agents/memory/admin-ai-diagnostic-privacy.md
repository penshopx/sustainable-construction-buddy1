---
name: Privasi diagnostik AI admin
description: Batas informasi dan pemisahan cache metadata dari pembuktian izin admin.
---

Diagnostik admin boleh menerjemahkan kode aman menjadi panduan tindakan dan menampilkan waktu pemeriksaan/cache, tetapi tidak boleh menampilkan key, label key, saldo rinci, atau respons mentah penyedia. Masa cache metadata bukan masa berlaku izin admin.

**Why:** Pengguna meminta diagnostik untuk tindak lanjut operasional tanpa memperluas paparan informasi penyedia, termasuk ketika izin admin dicabut.

**How to apply:** Periksa ulang sesi/peran pada setiap pengambilan diagnostik. Jangan memakai hasil UI sebelumnya sebagai bukti izin; sembunyikan hasil selama verifikasi ulang dan setelah verifikasi gagal. Kode baru yang belum dikenal mendapat panduan umum, bukan ditampilkan sebagai teks bebas dari provider.
