---
name: Supabase Edge deployment bundling
description: Jalur deployment Edge Function saat bundler lokal Replit gagal me-resolve import Deno jarak jauh.
---

Jika bundler Docker Supabase CLI gagal karena DNS saat mengambil import Deno, ulangi deployment dengan bundling server-side melalui opsi `--use-api`.

**Why:** Bundling lokal pernah gagal sebelum upload karena resolver container tidak dapat menemukan `deno.land`, sementara jalur bundling API berhasil mengunggah dan mengaktifkan function yang sama.

**How to apply:** Gunakan jalur standar lebih dulu. Jika kegagalannya spesifik pada resolusi import jarak jauh di tahap graph/bundle, gunakan `supabase functions deploy ... --use-api`, lalu pastikan versi function aktif naik dan jalankan ulang smoke test live.