---
name: Perubahan kuis pada pelajaran terbit
description: Batas pengaman editor dan alasan perubahan soal/kunci harus atomik.
---

Perubahan opsi dan kunci jawaban harus dinilai dan disimpan sebagai satu kesatuan, bukan ditolak hanya karena kunci lama tidak cocok dengan opsi baru pada keadaan sementara.

**Why:** Memendekkan opsi sambil memilih kunci baru dapat menjadi perubahan valid, tetapi penyimpanan dua langkah berisiko meninggalkan soal terakhir tidak dapat dinilai bila langkah kedua gagal.

**How to apply:** Gunakan transaksi soal+kunci untuk edit dalam pelajaran yang sama. Pemeriksaan editor memakai status pelajaran dan bank soal terbaru, tetapi bukan pengganti pengaman transaksi database terhadap akses langsung atau penghapusan bersamaan.

Validasi database harus memeriksa keadaan akhir transaksi, dengan mutasi bank soal diserialisasi per pelajaran. Kunci baris saja tidak cukup untuk snapshot REPEATABLE READ yang sudah tertinggal; penulisan pada baris pengunci memastikan transaksi lama gagal dengan aman.

**Why:** Dua pemeriksaan editor yang sama-sama membaca bank berisi dua soal dapat membolehkan dua penghapusan, meninggalkan nol soal valid. Pemeriksaan langsung pada perubahan opsi juga dapat salah menolak perubahan yang kuncinya diperbaiki dalam transaksi yang sama.

**How to apply:** Pertahankan pemeriksaan deferred untuk soal dan kunci, termasuk perubahan pelajaran sumber. Uji dua transaksi berbeda, bukan dua panggilan berurutan, dan jangan menyamakan kelulusan skema minimal dengan pengujian RLS Supabase lengkap.
