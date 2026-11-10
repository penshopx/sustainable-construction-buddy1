---
name: Batas riwayat Klinik Konsultasi
description: Privasi riwayat operator dan perlakuan jujur terhadap balasan sebelum pencatatan riwayat.
---

Riwayat klinik hanya mencatat balasan/status dan identitas pengubah dari JWT terverifikasi; jangan menambahkan dokumen atau konteks Ruang Simpan ke catatan audit.

**Why:** Pengguna secara eksplisit membatasi isi riwayat dan aksesnya ke pemilik permintaan serta admin yang masih berwenang.

**How to apply:** Pertahankan batas ini saat memperluas data audit, ekspor, atau tampilan riwayat. Periksa peran admin yang berlaku saat permintaan, bukan hanya klaim UI.

Balasan lama hanya dapat dipertahankan sebagai snapshot awal dengan pengubah tidak diketahui; jangan mengarang identitas operator atau balasan terdahulu yang tidak pernah dicatat.

**Why:** Klinik sebelumnya hanya menyimpan balasan terbaru. Perubahan skema saja juga tidak menyalin data backfill ke lingkungan tujuan.

**How to apply:** Sajikan snapshot lama dengan label jujur, dan pertahankan snapshot itu secara atomik sebelum perubahan pertama. Jangan bergantung pada backfill development untuk keselamatan data di lingkungan lain.
