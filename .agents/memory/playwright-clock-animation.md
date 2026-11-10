---
name: Jam palsu dan animasi browser
description: Pengujian timer React dengan transisi animasi dan jam Playwright.
---

Untuk uji browser yang mempercepat timer sambil memeriksa layar hasil, jangan selalu memajukan seluruh jam virtual sekaligus. Percepat hanya interval hitung mundur yang relevan dan biarkan frame animasi berjalan dengan waktu normal.

**Why:** Pada alur assessment, jam virtual berhasil mengirim payload saat waktu habis, tetapi tampilan hasil tetap tertahan di layar soal karena transisi AnimatePresence tidak selesai. Memajukan jam lagi atau melanjutkan jam tidak memperbaiki tampilan tersebut.

**How to apply:** Bila uji yang memakai page.clock menunjukkan request berhasil namun layar lama bertahan, periksa animasi transisi sebelum menyimpulkan kode aplikasi gagal. Untuk timer berbasis interval, percepat interval di konteks browser terisolasi dan pertahankan waktu frame serta jaringan biasa.

Untuk timer yang memakai `performance.now()` dan menyegarkan nilai pada `visibilitychange`, perubahan permanen pada `performance.now()` juga dapat menahan transisi Framer Motion walaupun angka timer sudah mencapai nol. Penggantian sementara hanya aman untuk memeriksa angka hitung mundur, bukan pengiriman asinkron.

**Why:** Memulihkan `performance.now()` segera setelah `visibilitychange` membuat efek pengiriman membaca waktu yang belum habis, padahal layar sudah menunjukkan nol. Sebaliknya, mempertahankan offset atau memajukan jam Playwright dapat menahan transisi animasi.

**How to apply:** Untuk menguji pemulihan dan pengiriman saat waktu habis, gunakan deadline singkat yang diterbitkan fixture server serta interval browser asli. Geser waktu server untuk jeda reload, lalu biarkan hitung mundur berjalan nyata hingga habis. Jangan mengubah timer produksi hanya untuk mengatasi keterbatasan jam tiruan.

Saat jam Playwright dijeda, selesainya mutasi fixture belum menjamin pembaruan React Query sudah tampil.

**Why:** Notifikasi React Query dibatch melalui timer. Data server dapat sudah berubah tetapi tombol pelajaran berikutnya masih terlihat terkunci sampai jam browser dijalankan.

**How to apply:** Sebelum memulai interval yang diuji, jalankan jam dalam langkah kecil sambil menunggu kondisi UI yang diperlukan. Jangan memakai selesainya request sebagai satu-satunya bukti bahwa persiapan UI selesai.