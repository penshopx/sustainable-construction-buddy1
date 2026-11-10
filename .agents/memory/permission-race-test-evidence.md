---
name: Bukti uji balapan izin
description: Hindari hasil lulus semu ketika halaman terlindungi sudah dilepas setelah pengalihan.
---

Uji respons izin lama setelah pengalihan harus turut mengamati konsumen izin yang tetap terpasang, bukan hanya konten halaman yang sudah dilepas.

**Why:** Pembatalan saat unmount dapat menjaga halaman lama tetap tersembunyi meski pengaman urutan respons rusak. Menu yang bertahan setelah navigasi dapat memperlihatkan pemulihan izin yang salah.

**How to apply:** Tahan respons per permintaan, biarkan pemeriksaan baru menolak, lalu buktikan respons lama benar-benar selesai. Periksa menu terbatas serta tujuan navigasi. Pengamat DOM harus menargetkan heading, sel, atau tautan terbatas; nama anggota pada sapaan dashboard bukan bukti bocornya tabel terlindungi.
