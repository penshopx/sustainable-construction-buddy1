---
name: Landing lazy-loading boundary
description: Batas aman lazy loading untuk section landing publik dan smoke suite.
---

Section landing publik boleh memakai dynamic import dan Suspense untuk memecah bundle, tetapi harus mulai dimount saat halaman dibuka; jangan menunda mount dengan IntersectionObserver.

**Why:** Section agenda, layanan, dan ekosistem merupakan bagian dari kontrak DOM publik. Penundaan berdasarkan viewport membuat deep section tidak tersedia untuk navigasi aksesibel dan menyebabkan smoke suite menunggu sampai timeout.

**How to apply:** Gunakan Suspense per section dengan placeholder stabil. Pertahankan seluruh section dalam siklus render awal, lalu optimalkan ukuran aset atau chunk tanpa menyembunyikan konten sampai pengguna scroll.