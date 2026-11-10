---
name: Post-merge hook
description: Konfigurasi setup otomatis setelah task di-merge pada proyek impor.
---

Proyek impor tidak selalu memiliki konfigurasi post-merge. Hook harus didaftarkan dengan path script dan timeout yang eksplisit, lalu script perlu aman dijalankan berulang kali, non-interaktif, cepat, dan gagal dengan jelas.

**Why:** Tanpa path hook di konfigurasi Replit, proses pasca-merge berhenti sebelum dependency, build, dan rekonsiliasi workflow dijalankan.

**How to apply:** Untuk proyek Node dengan lockfile, gunakan instalasi reproducible tanpa prompt lalu build produksi; uji hook secara langsung setelah mendaftarkannya dan periksa hasil workflow reconciliation.