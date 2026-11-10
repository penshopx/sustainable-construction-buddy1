# PUB ASPEKINDO — Pengembangan Usaha Berkelanjutan

## Overview

Platform ekosistem kompetensi digital untuk Personil Manajerial BUJK (Badan Usaha Jasa Konstruksi) Indonesia. Dibangun dengan React + Vite + TypeScript + Tailwind CSS, backend Supabase (auth, database PostgreSQL, Edge Functions, Storage).

## Architecture

- **Frontend**: React 18, Vite 5, TypeScript, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (hosted) — Auth, PostgreSQL, Edge Functions, Storage
- **Routing**: React Router v6
- **State**: TanStack React Query + React Context (AuthProvider)
- **AI**: Supabase Edge Functions → `ai.gateway.lovable.dev` (LOVABLE_API_KEY disimpan di Supabase Edge Function secrets)

## Key Features

- Pre-test / assessment kompetensi
- E-course modul dengan kuis dan sertifikat
- Project management toolkit (Risk Register, Budget Tracker, K3 Checklist)
- LKUT, PANCEK, SMAP
- AI Mentor chatbot (3 mode: learning, expert, project)
- Helpdesk AI chatbot
- Marketplace template konstruksi
- Direktori BUJK
- Leaderboard dan performance grading
- Innovation Hub
- Program management
- Admin dashboard

## Running the App

```bash
npm run dev
```

Workflow Replit **Start application** menjalankan perintah ini untuk frontend Vite dan API Express secara bersamaan:

- Frontend preview: port `5000`
- API lokal: port `3001`
- Health check API: `GET /api/health`

Preview Replit memakai port 5000. API frontend Supabase tetap menggunakan project Supabase hosted yang dikonfigurasi di environment.

## Environment Variables (Replit Secrets & Env Vars)

| Variable | Lokasi | Keterangan |
|---|---|---|
| `VITE_SUPABASE_URL` | Replit Env Var | URL project Supabase |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Replit Env Var | Supabase anon/public key |
| `SUPABASE_URL` | Replit Env Var | Sama dengan VITE_SUPABASE_URL |
| `SUPABASE_ANON_KEY` | Replit Secret | Supabase anon key |
| `SUPABASE_ACCESS_TOKEN` | Replit Secret | Personal Access Token `sbp_...` untuk konfigurasi Auth |
| `SUPABASE_DB_PASSWORD` | Replit Secret | Password database hosted untuk pemeliharaan melalui `psql` atau Supabase CLI |
| `SUPABASE_SERVICE_ROLE_KEY` | Replit Secret | Service-role key untuk probe Auth Admin |
| `LOVABLE_API_KEY` | Supabase Edge Function Secrets | Untuk fitur AI chat |
| `OPENROUTER_API_KEY` | Replit Secret (opsional) | Fallback AI untuk endpoint `/api/helpdesk` |
| `OPENAI_API_KEY` | Replit Secret (opsional) | Fallback AI alternatif untuk endpoint `/api/helpdesk` |
| `DEEPSEEK_API_KEY` | Replit Secret (opsional) | Fallback AI alternatif untuk endpoint `/api/helpdesk` |

> AI features (mentor chat, helpdesk) memanggil Supabase Edge Functions yang memproxy ke AI gateway — API key tidak terekspos ke browser.
>
> Endpoint `/api/helpdesk` pada API lokal membutuhkan salah satu variable AI fallback di atas jika digunakan; tanpa variable tersebut preview dan fitur non-AI tetap dapat dijalankan.

## Supabase Project

- Project ID: `yidlglstzvizsszrpobi`
- Semua migrasi ada di `supabase/migrations/`
- Edge Functions: `supabase/functions/` (deploy ke Supabase, bukan ke Replit)

Setelah origin preview berubah, jalankan `npm run configure:auth-redirects`. Perintah ini sengaja dijalankan manual karena memakai kredensial istimewa: Site URL akan diarahkan ke origin Replit aktif, URL lama tetap dipertahankan di allowlist, lalu link konfirmasi dan recovery nyata dihasilkan untuk memastikan path tidak diganti ke localhost. Akun probe langsung dihapus dan bukti non-secret disimpan di `supabase/auth-redirect-verification.json`.

### Pemeliharaan database langsung

- Ambil `db_host`, `db_port`, `db_user`, dan `db_name` dari metadata resmi `GET /v1/projects/{ref}/config/database/pooler`; jangan menebak host pooler dari region.
- Gunakan `SUPABASE_DB_PASSWORD` hanya dari Replit Secret, misalnya melalui `PGPASSWORD="$SUPABASE_DB_PASSWORD" psql ...`. Jangan menaruh password atau connection string lengkap di command, log, atau repository.
- Riwayat migrasi hosted dapat diperiksa melalui pooler dengan query read-only ke `supabase_migrations.schema_migrations`.

## Blocked Packages (Replit Security Policy)

Dua package diblokir oleh Replit dan digantikan dengan stub lokal:
- `html2pdf.js` → `src/lib/stubs/html2pdf.ts` (export/download PDF non-fungsional — butuh alternatif)
- `xlsx` → `src/lib/stubs/xlsx.ts` (import/export Excel non-fungsional — butuh alternatif)

Untuk mengaktifkan fitur PDF/Excel, cari paket alternatif yang tidak diblokir, atau implementasikan server-side generation.

## Project Structure

```
src/
  App.tsx              — Root router dengan semua route
  main.tsx             — Entry point React
  pages/               — Halaman (satu per route)
  components/          — Komponen UI reusable
  hooks/               — Custom hooks (useAuth, dll)
  integrations/
    supabase/
      client.ts        — Supabase client
      types.ts         — Database types (auto-generated)
  lib/
    stubs/             — Stub untuk paket yang diblokir
supabase/
  functions/           — Edge Functions (Deno)
  migrations/          — SQL migrations
```

## User Preferences

- Bahasa komunikasi: Indonesia (Bahasa Indonesia)
