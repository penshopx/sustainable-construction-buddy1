---
name: Jaringan offline dan fixture browser
description: Memastikan pengujian offline Playwright tidak menghasilkan sukses palsu dari backend tiruan.
---

Fixture HTTP yang memakai `route.fulfill()` dapat tetap memberi respons ketika konteks browser offline. Pengujian putus–sambung harus membuktikan permintaan benar-benar gagal pada lapisan jaringan browser, bukan hanya memeriksa status UI atau mengirim event online buatan.

**Why:** Respons fixture dapat membuat pengujian penyimpanan offline tampak berhasil tanpa pernah menjalankan jalur kegagalan transport.

**How to apply:** Saat offline, teruskan permintaan hanya ke host uji inert yang diizinkan secara eksplisit agar browser menolaknya; saat online, kembali ke fixture terisolasi. Periksa `requestfailed` dengan penyebab koneksi terputus dan event jaringan tepercaya. Jangan meneruskan permintaan ke host produksi.
