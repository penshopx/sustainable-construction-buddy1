---
name: Blocked packages & Vite stubs
description: html2pdf.js (via jspdf dep) dan xlsx diblokir oleh Replit security policy. Diatasi dengan Vite alias ke stub lokal.
---

## Rule
Jangan install html2pdf.js atau xlsx — keduanya diblokir (`403 Blocked by Security Policy`).

**Why:** jspdf (dep dari html2pdf.js) dan xlsx terkena CVE security block di Replit package firewall.

**How to apply:**
- Stub ada di `src/lib/stubs/html2pdf.ts` dan `src/lib/stubs/xlsx.ts`
- Alias dikonfigurasi di `vite.config.ts` → `resolve.alias`
- Jika user butuh PDF generation, cari alternatif seperti `@react-pdf/renderer` atau server-side generation
- Jika user butuh Excel, cari `exceljs` atau alternatif lain yang tidak diblokir
