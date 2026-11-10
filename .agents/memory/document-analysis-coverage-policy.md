---
name: Cakupan analisis dokumen panjang
description: Alasan penggabungan lokal, persetujuan biaya per bagian, dan batas klaim cakupan sumber.
---

Utamakan retensi temuan dan bukti dari semua bagian berhasil, bukan ringkasan global yang lebih lancar tetapi dapat membuang klausul akhir. Penggabungan lokal yang deterministik adalah pilihan sengaja; sintesis AI tambahan membutuhkan peninjauan anggaran dan risiko kehilangan bukti.

**Why:** Analisis awalan teks saja pernah mengabaikan bagian akhir dokumen panjang. Pemrosesan banyak bagian menambah biaya; karena itu tiap pengiriman bagian atau percobaan ulang memerlukan tindakan eksplisit, tanpa kelanjutan berbayar otomatis.

**How to apply:** Saat mengubah orkestrasi, pertahankan hasil per bagian, lokasi bukti dari sumber asli, pemulihan setelah muat ulang, dan penanda bagian gagal. Jangan menyamakan seluruh teks terekstrak sudah diproses dengan seluruh file sudah terbaca: PDF campuran, rentang OCR, dan ekstraksi lama dapat tetap parsial.

Pengujian analisis dokumen panjang memakai dokumen sintetis lokal, bukan dokumen hosted pengguna.

**Why:** Pengguna menetapkan batas data pengujian tersebut. Fixture penyedia menguji protokol dan retensi bukti, bukan akurasi model nyata.

**How to apply:** Pisahkan bukti ekstraksi parser asli, pengujian kontrak dengan penyedia tiruan, dan pengukuran model berbayar. Yang terakhir membutuhkan persetujuan biaya tersendiri.

Perbandingan dengan knowledge base adalah pilihan eksplisit, terpisah dari telaah isi dokumen. Bahan eksternal tidak boleh dianggap sebagai klausul dokumen pengguna atau mengubah temuan analisis utama secara diam-diam.

**Why:** Pengguna menyetujui penambahan perbandingan dengan kutipan dokumen dan referensi yang dipisahkan; materi implementasi hanya salah satu rujukan, bukan keputusan kepatuhan.

**How to apply:** Pertahankan mode dokumen-saja sebagai bawaan dan simpan bahan perbandingan sebagai snapshot privat agar kutipan historis tidak berubah saat korpus diperbarui. Daftar bahan yang dikirim bukan bukti ketepatan kesimpulan model.
