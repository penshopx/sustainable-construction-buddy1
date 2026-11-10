---
name: Lint warning budget
description: Pola menjaga warning lint tetap terlihat dan tidak bertambah diam-diam.
---

Penggunaan `any` di aplikasi harus menjadi error; boundary Supabase memakai tipe tabel/Json, sedangkan data dinamis memakai `unknown` dengan guard runtime. Budget warning hanya boleh mencakup warning legacy yang sudah dihitung dan disengaja.

**Why:** Volume warning legacy dapat menyembunyikan regresi baru. Batas numerik pada script lint membuat penambahan warning gagal di quality gate tanpa perlu mematikan rule.

**How to apply:** Saat warning legacy dihapus, turunkan `--max-warnings` mengikuti jumlah warning tersisa. Pertahankan daftar warning yang disengaja tetap kecil dan terukur, lalu hilangkan budget sepenuhnya bila semua warning sudah bersih.