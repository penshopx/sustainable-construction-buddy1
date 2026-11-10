---
name: Prasyarat navigasi uji Auth
description: Hindari salah menilai hasil uji privasi ketika redirect login atau onboarding belum selesai.
---

Uji privasi dengan akun disposable harus menyelesaikan navigasi pertama akun
melalui UI sebelum memulai request yang hendak diuji. Suffix URL saja bukan
bukti halaman tujuan sudah aktif: nilai parameter redirect dapat cocok dengan
suffix itu, dan efek navigasi onboarding dapat berjalan sesudahnya.

**Why:** Percobaan dengan akun baru pernah tampak berhasil login dan unggah,
tetapi halaman kemudian berpindah karena onboarding. Kegagalan tersebut bukan
bukti kebocoran akun atau kegagalan penyimpanan.

**How to apply:** Periksa origin/path tujuan secara tepat, selesaikan onboarding
asli, lalu pastikan kontrol workspace siap. Pisahkan hasil preflight HTTP,
pengujian browser terbatas, dan kelulusan seluruh skenario; jangan menaikkan
klaim hanya karena setup atau sebuah request berhasil.
