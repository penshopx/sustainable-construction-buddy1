---
name: Batas kuota AI anggota
description: Pemisahan kuota aplikasi pribadi dari status dan saldo provider AI.
---

Kuota AI anggota hanya boleh dibaca pemilik sesi dan harus ditampilkan sebagai batas aplikasi, bukan perkiraan saldo provider. Server tetap menjadi otoritas; jangan mengganti model atau mengurangi panjang jawaban secara otomatis saat kuota habis.

**Why:** Pengguna meminta waktu tunggu pribadi tanpa membuka penggunaan anggota lain atau membuat klaim saldo provider.

**How to apply:** Terapkan pada status kesiapan, penolakan permintaan, dan tampilan Helpdesk maupun asisten dokumen. Jangan gabungkan kuota pribadi ke cache metadata provider yang dipakai bersama.
