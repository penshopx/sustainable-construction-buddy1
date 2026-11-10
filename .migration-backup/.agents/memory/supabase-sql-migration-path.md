---
name: Supabase SQL migration path
description: Prinsip memilih jalur migrasi hosted Supabase dan menangani kegagalan izin secara aman.
---

Gunakan metadata resmi project untuk memperoleh endpoint database; jangan menebak host atau cluster dari region. Jalur SQL alternatif tetap membutuhkan identitas yang memiliki privilege database pada project tujuan.

**Why:** Endpoint yang tampak valid dapat tetap menunjuk tenant yang salah, sedangkan kegagalan izin tidak akan pulih lewat retry. PostgreSQL juga melarang penggunaan nilai enum baru dalam transaksi yang sama sebelum nilainya dikomit.

**How to apply:** Verifikasi identitas project dan hak akses sebelum migrasi. Retry hanya kegagalan sementara seperti throttling; untuk penolakan izin, perbaiki role atau gunakan jalur yang dijalankan pemilik project. Pisahkan transaksi penambahan enum dari migrasi yang memakainya. Jangan pernah menyimpan atau mencetak kredensial.

Management Database Query API tidak dapat mengganti password role `postgres` karena role pelaksananya bukan superuser. Gunakan endpoint khusus rotasi password Management API, lalu ambil ulang metadata pooler resmi sebelum menguji koneksi.

**Why:** Menjalankan `ALTER ROLE postgres` melalui query API menghasilkan penolakan izin meskipun token pemilik project sah; jalur rotasi khusus memperbarui database dan cache pooler secara benar.

**How to apply:** Simpan password baru lewat secret manager, kirim nilainya hanya dari runtime ke endpoint rotasi melalui HTTPS, lalu verifikasi dengan `psql` memakai `PGPASSWORD`. Log hanya status, host non-rahasia, dan hasil query read-only.

Pada hosted Supabase, mencabut `EXECUTE` dari `PUBLIC` saja belum tentu menutup akses anonim karena default privilege project dapat memberi role `anon` grant eksplisit.

**Why:** Verifikasi `has_function_privilege` setelah migrasi menunjukkan `PUBLIC` sudah tidak memiliki akses, tetapi `anon` masih dapat mengeksekusi function `SECURITY DEFINER`.

**How to apply:** Untuk RPC sensitif, cabut `EXECUTE` dari `PUBLIC` dan `anon`, grant hanya role yang diperlukan, lalu verifikasi privilege efektif setiap role setelah DDL diterapkan.