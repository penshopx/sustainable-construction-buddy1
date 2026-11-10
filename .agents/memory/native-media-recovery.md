---
name: Perilaku media native
description: Perbedaan media Chromium asli dari simulasi saat menguji gangguan jaringan dan pemulihan.
---

Gangguan harus menghentikan kelanjutan unduhan juga, bukan sekadar memutus satu respons.

**Why:** Chromium dapat otomatis menyambung respons terpotong melalui HTTP Range; bila setiap sambungan baru masih mengirim data, video dapat terus maju tanpa menghasilkan MediaError.

**How to apply:** Gunakan server lokal yang memutus socket dan menolak continuation Range selama gangguan. Pisahkan skenario ini dari buffering sementara yang menahan lalu melanjutkan aliran.

Jangan memaksakan urutan event media dari objek simulasi ke browser asli.

**Why:** Chromium dapat mengubah `paused` menjadi true dan posisi menjadi nol saat `load()` tanpa mengirim `pause`; kegagalan stream sendiri menghasilkan `error` lalu `pause`. Promise `play()` juga dapat ditolak karena kegagalan Range, bukan hanya kebijakan autoplay.

**How to apply:** Catat event native, perubahan state setelah pemanggilan asli, dan permintaan HTTP. Bedakan penolakan jaringan dari penolakan autoplay sebelum membatalkan retry.
