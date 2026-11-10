---
name: Urutan validasi referensi TypeScript
description: Pemeriksaan paket mandiri dapat membaca deklarasi library yang tertinggal dari sumbernya.
---

Jika typecheck satu artefak melaporkan ekspor library tidak ditemukan padahal sumber library sudah mengekspornya, bangun referensi TypeScript workspace sebelum mengubah kode aplikasi.

**Why:** Pemeriksaan paket mandiri pernah gagal pada ekspor klien API yang sebenarnya tersedia. Pemeriksaan workspace membangun ulang deklarasi referensi; setelah itu pemeriksaan paket yang sama lulus tanpa perubahan sumber.

**How to apply:** Bedakan deklarasi hasil build yang tertinggal dari ekspor sumber yang benar-benar hilang. Jalankan pemeriksaan workspace yang membangun referensi, lalu ulangi pemeriksaan paket yang gagal. Jangan menambahkan ekspor duplikat atau menghapus pemakaian API hanya untuk memperbaiki hasil build lama.
