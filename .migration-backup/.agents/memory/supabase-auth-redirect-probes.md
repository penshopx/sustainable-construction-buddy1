---
name: Supabase Auth redirects
description: Kriteria verifikasi live agar Supabase tidak mengganti redirect email dengan Site URL fallback.
---

Perubahan URL Auth belum dianggap selesai hanya karena Site URL dan allowlist tampak benar. Allowlist lama harus dipertahankan, dan link konfirmasi serta recovery yang benar-benar dihasilkan harus membawa `redirect_to` lengkap—termasuk path dan query—persis seperti yang diminta.

**Why:** Supabase dapat diam-diam mengganti redirect yang tidak diizinkan dengan Site URL, sehingga pemeriksaan konfigurasi saja tidak membuktikan email nyata akan kembali ke route aplikasi yang benar.

**How to apply:** Setelah origin berubah, gabungkan origin dan kedua route Auth ke allowlist, lalu jalankan probe generate-link terisolasi. Jangan mencetak action link, OTP, token, atau service-role key, dan selalu hapus akun uji.