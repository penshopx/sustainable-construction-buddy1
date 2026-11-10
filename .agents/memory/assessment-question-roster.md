---
name: Daftar soal assessment yang disahkan
description: Kebijakan otoritas daftar soal dan kompatibilitas assessment lama
---

Daftar soal harus disahkan saat mulai, unik, cocok dengan bank soal, dan memenuhi kuota empat soal per bidang (atau semua soal bila bidang memiliki kurang dari empat). Setelah itu, daftar tersebut tidak boleh ditetapkan ulang dari payload submit atau draf yang berubah.

**Why:** Menghitung jumlah atau identitas soal dari payload memungkinkan pengulangan soal benar, pengurangan penyebut, atau penggantian soal untuk memalsukan skor. Sekadar memvalidasi ID di awal tidak cukup: satu soal benar yang dipilih klien tetap dapat menghasilkan skor penuh bila komposisi assessment tidak diperiksa secara independen oleh server.

**How to apply:** Pertahankan daftar tetap terpisah dari snapshot jawaban. Migrasi assessment lama hanya boleh mengambil daftar dari draf server yang valid; assessment tanpa bukti daftar yang sah harus dimulai ulang, bukan menerima daftar dari browser. Pengiriman ulang assessment selesai tetap mengembalikan hasil aslinya.
