---
name: Pusat Informasi boundaries
description: Batas sumber kanonik antara agenda PUB dan artikel industri hasil agen.
---

Agenda dan kegiatan PUB harus selalu diproyeksikan langsung dari penyimpanan agenda ASPEKINDO yang kanonik. Agen pemantau hanya menghasilkan artikel dari sumber industri eksternal dan tidak merayapi ASPEKINDO untuk membuat salinan kegiatan. Halaman agenda publik hanya boleh memberi CTA umum menuju LMS; metadata kursus anggota tetap dibaca setelah autentikasi.

**Why:** Menyalin agenda ke tabel artikel menciptakan dua versi jadwal, lokasi, dan pendaftaran yang dapat berbeda atau kedaluwarsa. Kursus native dapat dibatasi untuk anggota, sehingga memproyeksikan metadata kursus ke pengunjung anonim akan melewati batas akses LMS.

**How to apply:** Saat menambah kanal, crawler, atau tampilan informasi, gunakan referensi/proyeksi agenda kanonik untuk kegiatan PUB. Jangan membuat artikel otomatis dari URL agenda atau kegiatan ASPEKINDO. Hubungkan agenda ke kursus melalui relasi internal, tetapi tampilkan detail kursus hanya di konteks LMS terautentikasi.