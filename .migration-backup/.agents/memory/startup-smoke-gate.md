---
name: Startup smoke gate
description: Aturan agar validasi startup benar-benar menguji proses server yang baru diluncurkan.
---

Smoke test startup harus menjalankan server miliknya sebelum preview utama, menolak port yang sudah dipakai, dan mengonfirmasi proses yang diluncurkannya tetap hidup setelah endpoint siap. Pipeline yang dapat berjalan saat preview aktif harus menggunakan pasangan port lokal terisolasi; pemeriksaan bersih tetap dapat memakai port preview utama.

**Why:** Server preview yang telah berjalan dapat menjawab probe pada port yang sama dan menyamarkan kegagalan bind atau crash pada proses yang seharusnya sedang diuji. Port terisolasi memungkinkan validasi otomatis tetap menguji startup miliknya sendiri tanpa menghentikan preview pengguna.

**How to apply:** Pertahankan urutan workflow validasi lalu preview. Gunakan binding ketat, periksa ketersediaan kedua port sebelum spawn, dan gagal dengan detail endpoint bila ada konflik atau proses keluar sesudah readiness. Konfigurasikan command validasi memakai port terisolasi bila ia dapat dipanggil di samping preview.

Validasi browser mandiri harus memasang executable Chromium melalui Playwright dengan `PLAYWRIGHT_BROWSERS_PATH=0` sebelum menjalankan spec; dependency Node saja tidak menjamin browser tersedia.

**Why:** Workspace impor dapat memiliki paket Playwright tanpa cache browser lokal, sehingga command validasi yang langsung memanggil runner gagal sebelum aplikasi sempat diuji.

**How to apply:** Jadikan instalasi browser bagian dari script validasi browser yang memang dapat dipanggil langsung, bukan hanya prasyarat manual di mesin pengembang.