---
name: Drift migrasi Supabase
description: Perbedaan antara riwayat migrasi repositori dan definisi fungsi dalam database hosted.
---

Definisi fungsi aktif di Supabase hosted dapat tertinggal dari migrasi yang sudah ada di repositori, termasuk fungsi yang semestinya idempoten.

**Why:** Pembungkus server untuk batas waktu assessment awalnya memakai fungsi penilaian lama di database, sehingga pengiriman ulang mengubah hasil meskipun versi idempoten sudah ada dalam berkas migrasi.

**How to apply:** Sebelum membuat pembungkus atau bergantung pada perilaku fungsi database yang ada, periksa definisi aktif serta riwayat migrasi di target sebenarnya. Tambahkan migrasi penyelaras bila perlu dan jalankan uji transaksi rollback terhadap database tersebut.