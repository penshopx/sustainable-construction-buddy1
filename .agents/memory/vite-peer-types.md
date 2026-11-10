---
name: Tipe plugin Vite di pnpm
description: Ketidakcocokan tipe plugin Vite ketika pnpm membentuk beberapa instance peer dependency.
---

Dalam monorepo pnpm, versi Vite yang sama bisa terpasang sebagai beberapa instance dengan peer opsional berbeda (misalnya versi `yaml` berbeda). Plugin yang tidak memiliki peer Vite eksplisit dapat mengambil tipe dari instance lain melalui hoisting, lalu gagal ditambahkan ke konfigurasi Vite walaupun runtime keduanya menggunakan rilis Vite yang sama.

**Why:** TypeScript membandingkan tipe rekursif Vite berdasarkan asal modul; dua instance yang tampak setara menghasilkan tipe `Plugin` yang tidak dapat dipertukarkan. Menyatukan semua versi peer workspace hanya untuk memperbaiki diagnostik ini dapat mengubah lockfile lintas artefak tanpa kebutuhan runtime.

**How to apply:** Pastikan dahulu versi runtime Vite dan instance peer yang terlibat; bila hanya beda instance tipe dari plugin eksternal, batasi adaptasi tipe di batas plugin pada konfigurasi artefak, jangan menonaktifkan pemeriksaan tipe seluruh proyek.