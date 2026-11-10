---
name: Supabase key rotation diagnostics
description: Cara membedakan gangguan Supabase Auth dari API key proyek yang sudah tidak berlaku.
---

Saat Auth timeout, validasi URL proyek dan API key secara terpisah melalui REST API. Respons domain atau Storage yang sehat tidak membuktikan key masih berlaku. Untuk key JWT lama, bandingkan claim `ref` dengan project ref pada URL sebelum menyimpulkan key invalid. Alur autentikasi di UI harus memiliki batas waktu dan menjelaskan gangguan layanan tanpa membiarkan pengguna menunggu tanpa akhir.

**Why:** Project pernah mengalami `AuthRetryableFetchError` dan endpoint Auth timeout, sementara domain serta Storage tetap merespons. Probe REST kemudian menunjukkan bahwa anon/publishable dan service-role key sama-sama sudah ditolak sebagai key tidak valid, konsisten dengan rotasi API key.

**How to apply:** Saat sign up, login, reset password, atau pemulihan sesi gagal, probe REST dengan key tanpa pernah mencetak nilainya. Jika claim key dan URL berbeda, jangan mengganti backend sampai pengguna menegaskan project yang benar. Setelah dikonfirmasi, selaraskan URL, project ID, dan storage key pengujian. Pertahankan timeout client dan pesan outage. Untuk akses database langsung, host Supabase dapat IPv6-only sementara Replit tidak memiliki rute IPv6; gunakan pooler yang region-nya dipastikan dari dashboard, bukan ditebak.