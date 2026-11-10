---
name: Imported Node dependency setup
description: Perilaku setup dependency pada proyek Node yang diimpor ke Replit.
---

Proyek Node yang diimpor dapat memiliki `package.json` dan lockfile tetapi belum memiliki `node_modules`, sehingga workflow gagal sebelum proses aplikasi dimulai. Gunakan pengelola paket proyek untuk memasang dependency, lalu periksa diff manifest dan lockfile sebelum menyelesaikan setup.

**Why:** Instalasi dependency dapat menyegarkan versi transitive atau metadata lockfile walaupun dependency langsung tidak berubah; pemeriksaan diff mencegah perubahan setup yang tidak disengaja.

**How to apply:** Pertahankan stack dan versi dependency langsung dari impor, jalankan build, restart workflow setelah instalasi, dan verifikasi preview serta log startup. Jika versi package terlihat benar tetapi binary native atau source JavaScript rusak/terpotong, instalasi incremental dapat mempertahankan file itu; bangun ulang `node_modules` dari lockfile sebelum mendiagnosis kode aplikasi.