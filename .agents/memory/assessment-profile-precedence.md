---
name: Prioritas hasil assessment
description: Aturan bisnis untuk memilih assessment yang menjadi sumber level dan skor profil saat submit berjalan bersamaan.
---

Profil pengguna harus mengikuti assessment berstatus selesai yang `started_at`-nya paling baru. Urutan penyelesaian atau commit transaksi tidak menentukan pemenang. Jika waktu mulai sama persis, gunakan ID assessment sebagai pemutus seri deterministik.

**Why:** Pengguna dapat membuka dua pre-test di tab berbeda. Assessment lama yang kebetulan selesai belakangan tidak boleh menimpa hasil assessment yang dimulai lebih baru.

**How to apply:** Setiap jalur yang memperbarui level atau skor profil dari assessment harus menerapkan urutan ini dan menyelaraskan keputusan antartransaksi untuk pengguna yang sama.