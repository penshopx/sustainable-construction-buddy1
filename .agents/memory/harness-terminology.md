---
name: Harness bukan Hermes
description: Klarifikasi istilah pengguna untuk lapisan penghubung AI, berbeda dari runtime Hermes.
---

Pengguna mengklarifikasi bahwa “Harnes” yang dimaksud sebagai “colokan atau
penghubung” adalah harness, bukan nama lain untuk Hermes AI.

**Why:** Sebelumnya pembahasan dan implementasi diarahkan ke Hermes; pengguna
kemudian mengoreksi maksud istilahnya.

**How to apply:** Bedakan lapisan harness penghubung/orkestrasi dari model
Claude dan runtime agen seperti Hermes. Jangan menganggap permintaan harness
sebagai izin memperluas integrasi Hermes atau menjalankan model berbayar.

Mulai dari harness baca-saja bersama, bukan agen yang otomatis mengubah data.
Setiap adapter tetap mengikuti batas akses dan izin data yang sudah disetujui.

**Why:** Pengguna menyetujui arah alur pertanyaan → referensi skema → model →
pemeriksaan jawaban, tanpa memberi kewenangan tindakan otomatis.

**How to apply:** Jangan menjadikan sentralisasi harness sebagai alasan
meneruskan dokumen anggota ke runtime pilot atau membuka izin baru.

Sisihkan ruang di kontrak respons untuk catatan aplikasi setelah validasi,
tanpa ikut menaikkan batas keluaran model atau memotong teks diam-diam.

**Why:** Menambahkan peringatan setelah keluaran model tervalidasi dapat
membuat jawaban yang semula sah melewati batas respons akhir.

**How to apply:** Bedakan anggaran teks model dari anggaran respons yang
mencakup anotasi aplikasi; uji batas maksimum keduanya.
