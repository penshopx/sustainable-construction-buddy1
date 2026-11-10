---
name: Supabase kept on Replit migration
description: App ini tetap menggunakan Supabase (tidak diganti Replit Postgres/Auth) karena terlalu kompleks untuk full migration.
---

## Rule
Jangan coba replace Supabase dengan Replit Postgres untuk app ini tanpa diskusi eksplisit dengan user.

**Why:** App punya 30+ tabel, RLS policies, DB triggers, storage buckets, 7 Edge Functions (Deno), dan auth flow yang semuanya bergantung Supabase. Full migration = rebuild berbulan-bulan.

**How to apply:**
- URL dan key Supabase harus dibaca dari environment runtime aktif; jangan mengandalkan nilai yang tersimpan di catatan lama.
- Anon key ada di Replit env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`)
- AI features (mentor chat, helpdesk) butuh `LOVABLE_API_KEY` di **Supabase Edge Function secrets** (bukan Replit)
- vitest juga diblokir Replit — sudah dihapus dari package.json
- Nilai environment runtime harus dikelola lewat Replit Env Vars/Secrets; jangan menaruh access token di `.replit`.
