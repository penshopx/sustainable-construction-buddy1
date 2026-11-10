---
name: Uji proyek lama di luar workspace
description: Dependensi pengujian skrip migrasi pada proyek lama yang tidak ikut instalasi workspace.
---

Proyek lama yang disimpan di direktori cadangan tidak ikut daftar paket workspace pnpm. Pengujian Node di sana dapat gagal saat mengimpor dependensi sebelum mencapai logika yang diuji, meski paket itu tercantum dalam manifest proyek lama.

**Why:** Instalasi workspace utama tidak membuat node_modules untuk proyek cadangan. Pemasang paket yang berjalan dari root juga dapat menolak penambahan paket root. Bahkan jika paket disiapkan di root, fixture yang menautkan dependensi dari proyek cadangan ke direktori sementara masih gagal bila proyek cadangan sendiri belum bisa melihatnya. Kegagalan impor bukan bukti regresi kode.

**How to apply:** Saat menguji skrip lama, periksa dulu ketersediaan dependensinya di lingkungan proyek lama. Siapkan dependensi pengujian secara terisolasi bila perlu, tanpa mengubah manifest atau lockfile workspace utama hanya demi pengujian.