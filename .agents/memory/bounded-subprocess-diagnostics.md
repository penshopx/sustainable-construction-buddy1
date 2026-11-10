---
name: Diagnostik subproses terbatas
description: Keamanan output kegagalan subproses saat log dibatasi ukurannya.
---

Saat menampilkan output subproses yang gagal, samarkan nilai rahasia dari lingkungan termasuk variabel bernama `*_KEY`, lalu batasi panjang hasilnya. Jika hanya menyimpan bagian akhir output, pertahankan overlap sepanjang nilai sensitif terpanjang saat menangkap output. Buang overlap mentah dan token awal yang tidak lengkap sebelum menyamarkan sisa output. Kredensial yang hanya muncul di URL subproses mungkin tidak ada di lingkungan, sehingga nilai lengkapnya tidak dapat dicocokkan setelah batas tangkapan memotong awal URL.

**Why:** Memotong output mentah tanpa overlap bisa membuang awal kredensial, menyisakan akhiran yang tidak lagi cocok. Membuang baris awal seluruhnya bisa menghilangkan pesan kesalahan yang masih berguna pada baris yang sama; membuang token awal sampai batas spasi lebih aman untuk URL tanpa menghilangkan pesan berikutnya. Nama kredensial berakhiran `KEY` tidak selalu memuat kata `SECRET` atau `TOKEN`.

**How to apply:** Berlaku untuk skrip validasi atau publikasi yang menampilkan stdout/stderr subproses pada log CI.

Perlakukan representasi JSON ber-escape sebagai URL saat menyamarkan diagnostik; jangan bergantung pada kredensial yang terdaftar di lingkungan. Batasi normalisasi pada delimiter URL, bukan seluruh pesan JSON.

**Why:** Subproses bisa menghasilkan tautan bertanda tangan dengan kredensial baru. Pemisah parameter ber-escape juga dapat membuat penyamaran generik menelan parameter aman atau rincian kesalahan berikutnya.

**How to apply:** Pertahankan pesan kesalahan dan parameter aman dalam uji keluaran pendek maupun terpotong, dengan nilai sintetis yang tidak terdaftar sebagai rahasia lingkungan.

Pembongkaran persen untuk URL tujuan harus terbatas dan gagal tertutup: samarkan nilai yang rusak atau terlalu dalam, bukan meneruskannya tanpa pemeriksaan. Kodekan kembali hasil penyamaran pada jumlah lapisan semula; jangan membongkar seluruh pesan diagnostik.

**Why:** Tujuan bertanda tangan dapat tersembunyi dalam parameter URL lain. Pembongkaran menyeluruh dapat mengubah batas parameter, memasukkan karakter kontrol atau kutipan ke JSON, dan membuat pekerjaan berulang tanpa batas.

**How to apply:** Saat menangani URL bersarang pada log, pertahankan struktur dan parameter aman untuk nilai yang masih dalam batas; uji juga batas pembongkaran dan pembuangan token parsial pada output terpotong.

Periksa nilai parameter yang sudah dibongkar sebagai satu tujuan lengkap, bukan potongan teks yang dicari menggunakan batas kutipan log.

**Why:** Apostrof sah dalam path URL dan dibiarkan literal oleh `encodeURIComponent`; bila pencocokan URL luar maupun tujuan berhenti di apostrof, parameter tanda tangan setelahnya tidak diperiksa. Pembongkaran persen juga dapat memunculkan spasi atau kutipan yang semula aman di dalam nilai terenkode.

**How to apply:** Pisahkan aturan batas teks log dari aturan nilai tujuan lengkap. Kodekan kembali karakter pembatas sebelum mengembalikan nilai ke URL dan JSON luar. Uji hasil `encodeURIComponent` apa adanya serta apostrof `%27`, dengan pembungkus log berkutip tunggal maupun ganda.