---
name: Tooling dokumen offline
description: Menjaga dependensi konversi Python terpisah dari runtime aplikasi Node.
---

Konversi dokumen offline tidak menjadikan aplikasi Node sebagai aplikasi Python.
Pertahankan pemisahan tooling dan runtime: hasil teks terstruktur boleh dibundel
ke aplikasi, sedangkan renderer PDF dan hasil gambar pemeriksaan tidak diperlukan
oleh server produksi.

**Why:** Pemasang paket Python dapat sekaligus membuat scaffolding proyek Python
dan menambahkan pustaka build native ke konfigurasi workspace Node. Perubahan
samping itu tidak selalu diperlukan untuk menjalankan aplikasi.

**How to apply:** Periksa perubahan konfigurasi dan berkas bootstrap setelah
memasang alat dokumen. Simpan hanya dependensi yang benar-benar dibutuhkan,
hindari aset PDF/gambar duplikat, dan bedakan teks ekstraksi dari ringkasan visual.
