---
name: Logout di perangkat bersama
description: Keputusan privasi untuk cadangan draf assessment lokal setelah sesi berakhir
---

Saat sesi keluar, semua cadangan draf assessment yang tertinggal di browser harus dibersihkan, termasuk hasil penulisan asinkron yang dimulai sebelum logout. Draf yang telah tersimpan di server tetap dapat dipulihkan setelah masuk kembali; cadangan lokal yang belum terkirim sengaja tidak bertahan melewati logout.

**Why:** Pada perangkat bersama, kehilangan cadangan offline lebih aman daripada meninggalkan soal dan jawaban anggota untuk pengguna berikutnya.

**How to apply:** Saat mengubah mekanisme penyimpanan atau pemulihan draf, pertahankan batas sesi ini dan pastikan respons jaringan yang terlambat tidak menghidupkan kembali cadangan setelah logout.

Sinkronisasi logout tidak boleh bergantung hanya pada BroadcastChannel. Pemberitahuan penghapusan sesi dari tab lain harus membatalkan penulisan draf di tab penerima, bukan hanya menghapus kunci bersama. Jangan mengulang permintaan logout SDK sebagai reaksi terhadap pemberitahuan tersebut.

**Why:** Saluran siaran dapat diblokir browser. Penghapusan localStorage bersama tidak membatalkan operasi asinkron milik tab lain; logout SDK tambahan juga dapat menghapus sesi baru yang masuk sebelum pemberitahuan lama diproses.

**How to apply:** Pastikan token masih tidak ada sebelum menerima pemberitahuan penghapusan, batalkan operasi lokal dan pemulihan sesi lama, serta pertahankan pengujian dua tab dengan siaran tidak tersedia dan gagal dibuat.

Pengujian privasi pergantian akun harus mengamati penulisan lokal sementara, bukan hanya isi penyimpanan di akhir, dan harus mempertahankan operasi akun lama selama login akun baru tanpa memuat ulang halaman.

**Why:** Penyimpanan akhir yang bersih dapat menyembunyikan kebocoran sementara yang kemudian ditimpa, sedangkan reload dapat membatalkan respons lama sehingga perlindungan sesi sebenarnya tidak pernah diuji.

**How to apply:** Tahan respons akun lama sampai akun baru mempunyai draf sendiri; pastikan setiap penulisan sesudah logout hanya milik akun baru, lalu buktikan penyimpanan berikutnya tetap berhasil.

Untuk regresi notifikasi storage yang tertunda, tangkap payload peristiwa asli dari tab lain dan kirim objek `StorageEvent` baru ketika antrean dilepas; jangan mendispatch ulang objek peristiwa yang sudah dihentikan dengan `stopImmediatePropagation`.

**Why:** Dalam browser pengujian, pengiriman ulang objek yang dihentikan tidak mencapai pengamat penerima. Mengantrekan payload menjaga urutan yang diuji tanpa bergantung pada keadaan dispatch internal objek browser.

**How to apply:** Buktikan notifikasi awal berasal dari browser, tahan hanya penghapusan token, tulis sesi baru lewat login, lalu lepaskan payload dengan `storageArea: localStorage` dan pastikan pengamat penerima benar-benar berjalan.