---
name: 4 SIAP scoring boundaries
description: Prinsip interpretasi dan batas produk untuk peta Legalitas, Sertifikasi, Tender, dan Proyek.
---

Peta 4 SIAP harus menampilkan skor bukti dan cakupan data sebagai dua ukuran terpisah. Data yang belum tersedia berarti belum dapat dinilai, bukan kompetensi bernilai nol. Rekomendasi bersifat panduan dan bukan keputusan sertifikasi, verifikasi legal, atau jaminan kelayakan tender. Setiap kursus LMS native harus memiliki satu atribusi fokus SIAP eksplisit; jangan menebak fokus dari judul atau kategori agenda.

Engine eksternal hanya boleh menjadi mesin internal. Jangan menampilkan nama engine, tautan eksternal, secret, atau klaim integrasi aktif di browser sebelum kontrak server-side tersedia.

Adapter engine tidak boleh mempercayai skor, gap, identitas anggota, atau teks rekomendasi yang dikirim browser. Server harus menurunkan konteks dari JWT dan sumber milik pengguna, lalu membatasi request serta response eksternal dengan katalog sinyal dan aksi internal.

Response rekomendasi anggota dan status kesehatan admin harus diturunkan dari satu outcome server-side yang sama: source, key rekomendasi, dan alasan fallback tidak boleh dihitung pada cabang terpisah. Kegagalan membaca sumber harus mengganti health lama menjadi deterministic/source_unavailable sebelum response 500 dikirim.

Alert fallback hanya dibuka setelah tiga probe gagal berturut-turut atau 15 menit dan ditujukan ke role admin; pemulihan connected harus menutup alert aktif.

Transisi health dan alert harus atomik di PostgreSQL dengan lock global serta incident ID; probe deterministic/none bersifat netral, dan target admin harus mengikuti semantik has_role agar super-admin tercakup.

**Why:** Menggabungkan kekosongan data dengan ketidakmampuan menghasilkan penilaian yang menyesatkan, sedangkan mempublikasikan engine eksternal mengaburkan kepemilikan produk dan batas keamanan. Payload client yang dipercaya juga memungkinkan pemalsuan konteks dan penyalahgunaan kredensial server. Atribusi eksplisit mencegah bukti kursus masuk ke dimensi yang salah ketika nama kursus ambigu. Cabang keputusan terpisah dapat membuat anggota menerima connected sementara admin mencatat fallback, atau sebaliknya.

**How to apply:** Setiap sumber baru harus memiliki atribusi SIAP yang eksplisit, batas kepemilikan anggota, indikator yang dapat dijelaskan, state data parsial, serta adapter server-side berquery read-only bila membutuhkan engine eksternal. Kirim hanya konteks minimum tanpa identitas dan abaikan output yang tidak ada dalam allowlist server. Gunakan satu outcome untuk membentuk response anggota dan row health admin. Progres LMS native dihitung hanya dari data milik pengguna pada kursus yang sudah diberi fokus.