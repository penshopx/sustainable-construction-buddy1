---
name: Status workflow dan port aktif
description: Bedakan kegagalan start ganda workflow dengan preview yang benar-benar mati.
---

Status workflow `failed` dengan pesan port sudah dipakai tidak selalu berarti aplikasinya mati. Proses layanan yang lebih lama dapat tetap melayani port yang sama dan menjawab melalui proxy. Jangan langsung mengubah konfigurasi port atau membunuh proses yang mendengarkan.

**Why:** Pada pemeriksaan kesiapan rilis, workflow web dan API berstatus gagal akibat percobaan start tambahan, sementara keduanya merespons melalui proxy. Restart melalui workflow terkelola mengembalikan status running tanpa perubahan port.

**How to apply:** Saat menemukan EADDRINUSE, cocokkan pendengar port dengan layanan dan periksa respons melalui proxy terlebih dahulu. Jika layanan yang benar masih berjalan, gunakan restart workflow terkelola untuk menyelaraskan status; jangan membuat workflow pengganti.