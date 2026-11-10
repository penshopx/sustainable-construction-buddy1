---
name: React compiler on Replit
description: Catatan kompatibilitas compiler React development untuk proyek Vite ini di Replit.
---

Gunakan `@vitejs/plugin-react` (Babel) untuk development server proyek ini, bukan `@vitejs/plugin-react-swc`, apabila binding native SWC tidak dapat dimuat dengan aman.

**Why:** Binding native `@swc/core` pada lingkungan Replit ini memicu `Bus error` saat Vite memuat plugin, sehingga frontend tidak pernah membuka port preview meski API berjalan.

**How to apply:** Jika mengubah konfigurasi atau dependency React/Vite dan startup gagal sebelum port frontend tersedia, periksa plugin compiler lebih dahulu. Pertahankan plugin Babel kecuali binding SWC telah diverifikasi berfungsi pada runtime target.