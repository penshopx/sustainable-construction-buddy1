---
name: Supabase single responses
description: Bentuk response yang diperlukan mock Supabase untuk caller yang memakai .single().
---

Mock Supabase untuk caller yang memakai `.single()` harus mengembalikan objek JSON tunggal, baik pada pembacaan profil maupun response representasi setelah mutation.

**Why:** Decoder PostgREST `.single()` mengharapkan satu objek. Array satu elemen dapat membuat state context tetap kosong atau menghasilkan response yang tidak sesuai walau request mutation berhasil.

**How to apply:** Saat menulis route mock browser untuk endpoint Supabase, bedakan endpoint `.single()` dari query koleksi dan kembalikan objek tunggal dengan status response yang sukses.