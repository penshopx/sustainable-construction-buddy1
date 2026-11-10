---
name: Test runner availability
description: Batasan keamanan package registry untuk runner test frontend proyek ini.
---

Gunakan Playwright untuk test browser frontend; runner dan Chromium dapat dipasang dari registry serta CDN yang tersedia pada Replit.

**Why:** Versi Vitest yang kompatibel dengan Vite 5 pernah ditolak package firewall karena CVE. Runner browser juga membutuhkan Chromium dan library sistemnya; runner yang hanya tercatat tanpa provisioning browser akan gagal pada instalasi bersih.

**How to apply:** Simpan dependency dan lockfile runner, provisioning Chromium harus menjadi bagian dari perintah test, dan pastikan library sistem browser tersedia. Jalankan test terhadap server yang diluncurkan runner sendiri, bukan preview aktif.