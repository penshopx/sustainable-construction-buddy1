---
name: Batas tunggu logout
description: Bedakan batas tunggu UI dari akhir operasi autentikasi yang tidak dapat dibatalkan.
---

Batas tunggu logout bukan bukti operasi autentikasi berhenti. Jika SDK belum selesai, percobaan ulang harus menunggu operasi yang sama dan login/registrasi baru harus ditahan, termasuk setelah provider dipasang ulang. Jangan mengklaim sesi pasti aktif atau pasti berakhir hanya berdasarkan timeout.

**Why:** Logout SDK tidak menyediakan pembatalan. Melepas kunci saat UI timeout memungkinkan logout lama menghapus sesi akun baru. Menahan akses masuk sementara lebih aman daripada menerima sesi baru dengan logout lama masih berjalan.

**How to apply:** Pertahankan pengunci sampai operasi dasarnya selesai, bukan sampai penantian UI berakhir. DELETE yang sudah dibatalkan tidak boleh melanjutkan ke tahap SDK ketika responsnya tiba terlambat. Perubahan profil harus mengikuti kejadian autentikasi, bukan penyelesaian callback UI lama.
