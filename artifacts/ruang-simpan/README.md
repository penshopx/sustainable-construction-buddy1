# Ruang Simpan

Ruang Simpan di `/ruang-simpan/` diarahkan menjadi sumber kebenaran utama
bagi PUB ASPEKINDO, bukan produk terpisah dari PUB. Gustafta hanya referensi
fitur dan tampilan: tidak ada integrasi atau pertukaran data dengannya.

Akses mengikuti sesi Supabase PUB yang sama, bukan akun Clerk kedua.
Metadata ruang kerja diidentifikasi oleh ID anggota PUB; file tetap privat
di App Storage. Data lama milik identitas Clerk tidak dihapus dan tidak
dipindahkan otomatis ke akun PUB.

Profil perusahaan ditulis di Ruang Simpan dan dibaca PUB melalui AuthProvider.
Nama perusahaan lama PUB hanya diimpor sekali ketika ruang kerja pertama
dibuka, bukan disinkronkan dua arah. AI PUB dapat memakai profil dan potongan
dokumen dengan persetujuan eksplisit; chatbot publik tidak mendapat konteks privat.
Nilai assessment dan progres pelajaran tetap dikelola PUB, di luar cakupan ini.

## Fitur aktif

- Login PUB; setiap ruang kerja dimiliki oleh satu identitas anggota Supabase.
- Unggah privat ke App Storage; folder, bintang, ganti nama, pindah, unduh, hapus.
- Pencarian nama dan teks yang berhasil diekstrak; PDF, DOCX, XLSX, TXT, MD, CSV.
- JPG/PNG disimpan tanpa OCR. PDF scan dapat berstatus tersimpan, bukan siap AI.
- Asisten dengan pilihan dokumen; persetujuan diperlukan sebelum potongan teks
  dikirim ke Claude melalui OpenRouter. File biner utuh tidak dikirim ke AI.
- Profil perusahaan dengan pemeriksaan versi untuk mencegah pembaruan tertimpa.
- Token aplikasi 90 hari, ditampilkan sekali, disimpan server sebagai hash.
  Izin profil dan dokumen terpisah, dapat dicabut, serta dibatasi per file/folder.
- Aktivitas terbaru (100 entri).

## Batas versi awal

Kuota 15 MiB, maksimum 100 dokumen dan 50 folder per akun. Parser mengindeks
maksimum 100.000 karakter, 150 halaman PDF, atau 20 lembar XLSX/2.000 baris per lembar.
Pekerja ekstraksi dibatasi waktu 15 detik, dua pekerja aktif dan heap 128 MiB.
Ekstraksi gagal tidak menghilangkan file: dokumen tetap dapat diunduh/dihapus.
Belum ada OCR, impor tautan, paket berbayar, atau integrasi otomatis dengan produk lain.

## API aplikasi eksternal

Kirim token hanya dari server aplikasi tepercaya:
`Authorization: Bearer <token>`. Jangan menaruh token di URL atau kode browser.

- `GET /api/ruang-simpan/external/profile` — `profile:read`
- `PUT /api/ruang-simpan/external/profile` — `profile:write`; JSON berisi
  `name`, `nib`, `address`, dan `version` saat ini. Versi lama menghasilkan 409.
- `GET /api/ruang-simpan/external/documents` — `documents:read`; metadata file terpilih saja.
- `GET /api/ruang-simpan/external/documents/{id}/download` — `documents:read`
- `POST /api/ruang-simpan/external/documents?name=...&folderId=...` —
  `documents:upload`, isi biner `application/octet-stream`, folder harus diizinkan.

Pemberian izin mengunggah ke folder tidak otomatis memberikan hak membaca
seluruh isi folder. Mencabut token menghentikan permintaan berikutnya.

## Menjalankan

Gunakan workflow terkelola `artifacts/ruang-simpan: web` dan API Server.
Metadata development baru ditambahkan melalui Drizzle; bukan DDL saat startup.
`pnpm run typecheck` memeriksa seluruh workspace.
