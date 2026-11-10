---
name: Kebijakan bobot nilai kuis LMS
description: Makna points dan aturan pembulatan serta riwayat hasil kuis.
---

Gunakan `points` sebagai bobot nilai soal LMS. Persentase dibulatkan ke bilangan bulat sebelum dibandingkan dengan ambang kelulusan; jumlah jawaban benar tetap merupakan hitungan soal.

**Why:** Admin sudah dapat mengatur poin positif per soal. Memakainya sebagai bobot membuat pengaturan itu memengaruhi penilaian, tanpa mengubah kontrak nilai integer yang sudah ada.

**How to apply:** Perubahan penilaian berlaku pada pengiriman baru. Jangan menghitung ulang hasil historis secara diam-diam karena hasil tersebut dapat menjadi dasar penyelesaian pelajaran.

Rincian poin hasil hanya boleh ditampilkan bila ada snapshot server saat pengiriman. Tanpa snapshot, tampilkan skor dan hitungan soal tersimpan, penjelasan umum bobot, serta pemberitahuan bahwa rincian poin tidak tersedia.

**Why:** Bobot soal dapat diedit setelah kuis dikirim; memakai bank soal terkini untuk merekonstruksi hasil lama akan memberi rincian yang tidak didukung bukti.

**How to apply:** Jangan mengisi ulang snapshot percobaan lama dari bank soal saat ini. Bila menambahkan snapshot untuk pengiriman mendatang, simpan atomik bersama hasil penilaian.

Untuk konsistensi saat admin mengedit, utamakan snapshot MVCC tunggal untuk daftar soal, bobot, dan kunci, bukan penguncian tambahan yang menahan editor.

**Why:** Pengaman mutasi bank soal memakai baris pelajaran sebagai mutex, sementara penyimpanan jawaban juga memerlukan pemeriksaan foreign key soal. Menambah protokol penguncian pembaca berisiko menimbulkan urutan kunci yang bertentangan. Snapshot per pengiriman menjaga perhitungan konsisten tanpa mengharuskan semua penulis mengikuti protokol baru.

**How to apply:** Jika soal snapshot hilang sebelum jawaban tersimpan, biarkan foreign key atau kegagalan serialisasi membatalkan seluruh pengiriman. Jangan menghitung ulang sebagian jawaban terhadap bank terbaru. Snapshot kerja dalam fungsi bukan bukti rincian bobot hasil historis yang persisten.
