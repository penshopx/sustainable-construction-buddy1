# Klinik Konsultasi PUB

Klinik adalah bagian PUB ASPEKINDO dan memakai akun Supabase PUB yang sama.
Gustafta hanya referensi alur, bukan integrasi, operator, atau sumber kewenangan.

## Penyimpanan dan akses

- Percakapan memakai tabel helpdesk Supabase yang sudah ada dan kebijakan RLS pemilik.
  Prefix judul `[Klinik/<loket>]` memisahkan riwayat setiap loket, bukan batas otorisasi.
- Dokumen dan profil bisnis tetap di Ruang Simpan. Persetujuan konteks eksternal
  default nonaktif; memasuki loket tidak otomatis mengirim dokumen.
- Permintaan operator dan masukan disimpan dalam `clinic_cases` pada PostgreSQL
  Replit yang sudah dipakai Ruang Simpan. Identitas selalu dari JWT PUB terverifikasi.
- Operator hanya admin dengan peran yang diperiksa ulang memakai JWT pemanggil
  di Supabase pada setiap request. Gagal memeriksa peran menutup akses.
- Permintaan operator hanya berisi judul/ringkasan yang anggota pilih untuk kirim.
  Tidak ada pengiriman otomatis seluruh percakapan, dokumen, atau profil.
- Maksimal 20 permintaan/masukan per anggota per 24 jam. Tidak ada janji SLA manusia.

## Migrasi

Definisi Drizzle: `lib/db/src/schema/clinic.ts`.
Migrasi aditif: `lib/db/migrations/clinic-cases.sql`.
Terapkan SQL tersebut pada database Replit target saat menyiapkan lingkungan baru,
melalui koneksi aplikasi yang sudah dikonfigurasi. Jangan menerapkannya ke Supabase
dan jangan memakai `push-force` untuk mengatasi drift skema yang tidak terkait.
Database pengembangan sudah disiapkan selama implementasi; publikasi terpisah.

## Batas

Claude Sonnet dan batas biaya yang ada tetap berlaku. Kegagalan provider harus
ditampilkan, bukan diganti jawaban rekaan atau model pengganti otomatis.
Konsultasi AI membantu persiapan, bukan menerbitkan sertifikat, lisensi, nilai ujian
resmi, atau verifikasi dokumen yang berwenang. Peran loket tidak memberikan hak akses
tambahan. Alat persiapan yang ditautkan adalah fitur PUB yang memang sudah ada;
tidak ada klaim bahwa Workroom Gustafta tersedia di PUB.
