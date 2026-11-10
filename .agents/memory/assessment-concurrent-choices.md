---
name: Pilihan assessment lintas perangkat
description: Kebijakan konflik untuk jawaban berbeda saat assessment yang sama dibuka bersamaan
---

Gabungkan jawaban pada soal berbeda secara otomatis, tetapi minta pilihan anggota ketika dua perangkat mengubah soal yang sama ke jawaban berbeda. Jangan diam-diam mengutamakan perangkat terakhir atau jawaban server.

**Why:** Tujuan perlindungan lintas perangkat adalah menjaga pilihan sah anggota, bukan sekadar membuat penyimpanan berhasil. Memilih pemenang secara otomatis menyembunyikan hilangnya pilihan lain.

**How to apply:** Pertahankan kedua alternatif sampai anggota memilih; jangan kirim sebelum resolusi dan sinkronisasi selesai. Batas waktu server tetap berlaku, termasuk finalisasi berdasarkan snapshot server bila waktu habis.

Saat menyelesaikan assessment yang mempunyai draf server, penilaian harus memakai draf terbaru di dalam kunci transaksi yang sama dengan penyimpanan, bahkan sebelum batas waktu habis.

**Why:** Sinkronisasi browser lalu pengiriman dalam dua request tetap menyisakan celah: perangkat lain bisa menyimpan jawaban di antara keduanya. Payload browser yang lama tidak boleh menghapus jawaban yang sudah diterima server.

**How to apply:** Uji urutan save-versus-submit dengan dua koneksi database, bukan hanya dua save atau urutan request tanpa transaksi yang bertumpang tindih.
