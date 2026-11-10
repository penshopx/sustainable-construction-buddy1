---
name: Uji RPC LMS terisolasi
description: Batas cakupan pengujian fungsi database LMS pada PostgreSQL lokal.
---

Jalankan definisi fungsi migrasi yang sebenarnya pada database PostgreSQL lokal terisolasi untuk menguji penilaian dan transisi status. Jangan menganggap skema minimal ini juga menguji kebijakan RLS, grant, dan seluruh trigger dari migrasi Supabase.

**Why:** Pengujian browser yang memakai fixture tidak pernah menjalankan fungsi SQL. Uji lokal yang menjalankan fungsi asli menemukan pemanggilan fungsi JSONB yang tidak ada di PostgreSQL, tanpa menyentuh data hosted.

**How to apply:** Untuk perubahan skor dan penyelesaian LMS, pertahankan uji fungsi lokal yang cepat; bila perubahan melibatkan hak akses, trigger, atau skema lengkap, tambahkan uji pada database Supabase pengujian dengan semua migrasi terpasang.

Jangan mengganti identitas proyek hosted atau mengganti nama migrasi yang pernah dirilis demi menjalankan CI. Gunakan proyek lokal sementara; bila timestamp migrasi lama bertabrakan, gabungkan isi lengkapnya dalam urutan nama hanya pada salinan pengujian.

**Why:** Ledger Supabase mensyaratkan versi unik, sedangkan riwayat lama repositori dapat memuat beberapa berkas dengan timestamp sama. Mengubah identitas versi aslinya berisiko menimbulkan drift hosted.

**How to apply:** Pastikan staging memasukkan setiap berkas sekali dalam urutan asli, tanpa metadata link hosted; pengujian skema lengkap harus menolak database yang belum menerima seluruh versi migrasi.