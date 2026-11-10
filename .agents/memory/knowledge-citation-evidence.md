---
name: Ketepatan bukti kutipan knowledge base
description: Mengapa pengujian knowledge base harus membuktikan relevansi halaman, bukan sekadar ID dokumen.
---

Keberadaan ID sumber dalam hasil pencarian belum membuktikan kutipan relevan. Uji pertanyaan acuan harus memeriksa halaman fisik dan teks bukti yang mendukung jawaban, termasuk setelah pemangkasan anggaran konteks.

Untuk pertanyaan umum, pasal alternatif yang benar-benar mendukung jawaban juga sah; jangan menganggap satu nomor halaman acuan sebagai satu-satunya bukti yang valid.

**Why:** Judul/nomor peraturan yang berulang pada setiap potongan pernah membuat dokumen yang benar terpilih tetapi halaman substantifnya tidak ikut terkirim. Pemangkasan konteks juga dapat membuang bukti yang semula ditemukan. Sebaliknya, pertanyaan tentang penyelenggara PUB dapat didukung beberapa pasal; memaksa satu halaman saja menghasilkan temuan gagal yang keliru.

**How to apply:** Saat mengubah pencarian atau menambah sumber, sertakan pertanyaan substansi, identitas naskah, dan batas halaman. Saat konteks terbatas, utamakan bukti terbaik dari masing-masing sumber sebelum halaman tambahan sumber yang sama, agar duplikasi tidak menghilangkan seluruh bukti sumber lain. Jangan menebak label cetak yang rusak oleh OCR atau mengganti halaman tak tersedia dengan kutipan lain. Bedakan keberhasilan pencarian lokal dari kualitas jawaban model langsung.

Keberadaan atribut teks yang tidak kosong juga belum membuktikan bahwa sebuah
objek adalah cuplikan bukti; metadata judul bagian dapat memiliki ID, halaman,
dan teks seperti kutipan asli.

**Why:** Penelusuran seluruh objek konteks secara rekursif pernah memasukkan
halaman judul bagian ke daftar kutipan yang dianggap memiliki bukti isi.

**How to apply:** Ambil bukti dari bidang konteks yang memang ditetapkan sebagai
rujukan atau cuplikan, bukan berdasarkan kemiripan atribut saja. Uji ekspektasi
sumber secara independen dari fungsi pengumpul kutipan, termasuk metadata yang
berisi teks tetapi tidak berisi kriteria substantif.

Penambahan korpus klasifikasi yang besar dapat menggeser relevansi pertanyaan PUB lama, meskipun dokumen asal tidak berubah. Ekspansi akronim untuk mengenali topik tidak boleh ikut mendominasi penilaian isi klausul.

**Why:** Frekuensi kata berubah bersama korpus; istilah usaha/konstruksi yang umum dan nama panjang topik dapat mengalahkan pertanyaan substantif seperti tujuan atau penyelenggara.

**How to apply:** Uji ulang pertanyaan alami acuan setelah pertumbuhan korpus. Pisahkan pengenalan identitas/topik dari pencocokan isi, hormati pilihan ID/versi eksplisit, dan jangan membatasi pertanyaan perbandingan ke satu peraturan.

Jangan mengganti ruang lingkup khusus subklasifikasi dengan seluruh uraian kode KBLI, atau menyatukan uraian dari versi sumber berbeda menjadi satu ketentuan baru.

**Why:** Satu KBLI dapat dipakai beberapa subklasifikasi yang pekerjaannya berbeda; skema, peraturan, dan publikasi KBLI juga dapat memakai pemetaan atau uraian yang berbeda. Kesamaan kode bukan bukti kesamaan kewenangan.

**How to apply:** Tampilkan ruang lingkup subklasifikasi dan uraian KBLI sebagai lapisan terpisah dengan asal/versi serta kutipannya. Selisih pemetaan perlu dicatat untuk peninjauan, bukan dipilih diam-diam atau dianggap sebagai keputusan hukum.

Pertanyaan kriteria skema sebaiknya ditautkan ke batas klausul sumber yang diketahui, bukan hanya dicari dengan tambahan kode subklasifikasi.

**Why:** Kode subklasifikasi berulang dalam formulir penilaian dan dapat mengalahkan bagian kriteria utama pada pencarian leksikal. Nomor dokumen yang benar saja tidak menjamin bukti persyaratan yang tepat.

**How to apply:** Prioritaskan isi klausul kriteria dan data pendukungnya dari keluarga skema terpilih. Pertahankan halaman/offset asli serta penanda bagian hilang atau terpotong; jangan menyebut kutipan parsial sebagai daftar lengkap. Uji isi substantif dengan variasi bentuk naskah, bukan memaksakan satu istilah dokumen pada semua skema.

Anggaran kutipan perlu menghitung JSON yang diserialkan dan memakai kapasitas tersisa, bukan membagi rata per bagian atau per halaman.

**Why:** Pembagian tetap pernah memotong halaman meskipun gabungan bagian terkait sebenarnya masih muat. Sebaliknya, tabel lintas banyak halaman memang bisa melebihi konteks chat; menambah kapasitas tidak membuktikan semua kutipan sudah lengkap.

**How to apply:** Utamakan bagian utuh yang muat, alihkan sisa kapasitas ke bagian panjang, dan tetap tandai pemotongan sebenarnya. Sediakan ekstraksi offline tanpa batas konteks chat untuk pembacaan lanjutan; jangan menghapus peringatan parsial untuk menyamakan status chat dengan berkas offline.

Bank jawaban acuan offline adalah bahan peninjauan, bukan bukti ketepatan model atau kunci kecocokan kalimat persis. Pisahkan kebijakan aplikasi dari sumber hukum.

**Why:** Teks acuan dapat terbukti berasal dari sumber tanpa membuktikan kesimpulan hukum atau kualitas jawaban model langsung. Jawaban alternatif yang sah tidak harus memakai kata-kata acuan; aturan perilaku chat juga bukan ketentuan peraturan.

**How to apply:** Nilai fakta, kutipan, ruang lingkup dan kebutuhan klarifikasi. Tandai acuan sebagai draf; bila isi sumber berubah, tinjau ulang kasus perbandingan daripada mempertahankan kesimpulan lama secara otomatis.
