---
name: Pengujian pilot dengan sesi operator
description: Cara membuktikan hasil pilot tanpa formulir manual atau berbagi sesi login.
---

Utamakan pengujian langsung di sesi operator yang sudah login, dengan hasil
berdasarkan respons API. Jangan mengharuskan operator berulang kali menyalin
status dan ID ke formulir terpisah, dan jangan meminta token sesi untuk
memungkinkan pemeriksaan.

**Why:** Pengumpulan status dan ID secara manual membingungkan pengguna saat
pilot; sesi login pengguna juga tidak otomatis tersedia di browser pemeriksaan.
Laporan pengguna dan HTTP 200 saja tidak membuktikan status terminal tertentu.

**How to apply:** Sediakan tindakan eksplisit yang menjalankan simulasi terbatas
dan menampilkan hasilnya di aplikasi. Bedakan timeout server dari batas waktu
pemeriksaan klien, serta timeout yang terjadi sebelum pembatalan dari pembatalan
yang berhasil. Tetap pisahkan bukti pengujian sintetis dari hasil sesi nyata.
