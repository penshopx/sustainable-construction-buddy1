# Harness AI baca-saja

Harness adalah lapisan orkestrasi aplikasi, bukan nama lain untuk Hermes.
Implementasi bersama digunakan oleh:

- Chat biasa/shared bot melalui adapter provider langsung, termasuk seluruh
  profil skema yang sudah tersedia. Pilihan model dan kewajiban login yang
  sudah ada tetap berlaku; tidak ada provider atau kredensial baru.
- Pilot chat BG001 melalui adapter runtime Hermes dan Claude. Batas preview,
  Super Admin, persetujuan biaya sekali kirim, serta tiga rujukan tetap berlaku.

## Alur

1. **Persiapan:** adapter memilih model dari konfigurasi server dan menyiapkan
   konteks sesuai skema. Peran chat hanya mengubah penyajian, bukan izin akses.
2. **Panggilan model:** harness memberi kapabilitas sekali pakai kepada adapter.
   Percobaan kedua ditolak, termasuk ketika error percobaan itu ditelan adapter.
3. **Pemeriksaan:** adapter memeriksa identitas model, isi respons dan kutipan
   sesuai bentuk responsnya. Hasil tidak dapat sukses tanpa panggilan model
   yang selesai. Tidak ada respons tiruan atau fallback tersembunyi saat gagal.
4. **Pembersihan:** kapabilitas ditutup dan sinyal internal dibatalkan agar tidak
   dapat dipakai lagi setelah pipeline selesai.

Pembatasan akun/IP dan pemeriksaan hak akses tetap di endpoint yang sudah ada.
Harness tidak memperluas izin data, membaca seluruh database, atau menyimpan
prompt/riwayat/log baru. Ini kebijakan kode aplikasi dengan adapter server
tepercaya, bukan sandbox untuk menjalankan kode yang tidak dipercaya.

## Kutipan

Pada chat skema biasa, daftar pasangan ID/halaman diambil dari pemetaan dan
kutipan yang benar-benar dimasukkan dalam konteks. Daftar awal bagian tanpa isi
kutipan tidak dianggap bukti. Kutipan yang tidak terdaftar atau formatnya salah
ditolak sebelum jawaban dikembalikan. Tanpa kutipan, jawaban diberi catatan
aplikasi yang terlihat dan ikut tersimpan bersama jawaban.
Kontrak respons menyediakan ruang tambahan untuk catatan aplikasi tersebut;
batas keluaran model mentah tidak dinaikkan dan teks model tidak dipotong.

Pada Hermes BG001, pemeriksaan JSON dan daftar sumber eksplisit yang sudah ada
tetap digunakan. Kedua adapter tetap membedakan **pemeriksaan tautan kutipan**
dari pembuktian kebenaran seluruh klaim AI atau keputusan sertifikasi.

## Pembatalan dan batas

Maksimum satu panggilan model per permintaan API, bukan deduplikasi lintas
permintaan atau pengendalian biaya terdistribusi. Tidak ada retry otomatis,
pergantian model saat gagal, atau alat untuk menulis/menghapus data.

Chat biasa meneruskan putusnya koneksi HTTP ke harness dan request provider.
Pilot Hermes mempertahankan pembatalan dan batas waktu runtime yang sudah ada.
Jika provider sudah menerima permintaan, pembatalan tidak menjamin biaya batal.

Pengujian menggunakan fetch provider tiruan, termasuk saat menjalankan runtime
Hermes nyata. Ketersediaan model/kredit nyata dan kualitas jawaban langsung
belum diuji ulang. Tidak ada publikasi atau perubahan konfigurasi produksi.

## Uji cakupan seluruh skema tanpa API

Jalankan dari root workspace:

```sh
pnpm --filter @workspace/api-server exec node --test tests/harness-schemes.test.mjs
```

Suite membaca seluruh profil dari katalog server, bukan hanya BG001. Cakupan:
lima topik persyaratan, kutipan sumber/halaman yang tersedia, sumber keluarga
lain, halaman salah, jawaban tanpa kutipan, kombinasi peran penyajian dan tingkat
penjelasan, percobaan menyisipkan ID sumber lain dalam pertanyaan, serta seluruh
pilihan model yang sudah ada. Keluaran juga diperiksa terhadap kontrak respons.

Semua request model menggunakan fetch tiruan dan kredensial sintetis.
Pemanggilan global fetch dilarang dan dihitung sebagai kegagalan pengujian.
Keberhasilan suite membuktikan alur kode dan batas rujukan, bukan kualitas
jawaban model nyata, izin akun di database, atau keputusan resmi sertifikasi.

Audit katalog 29 Oktober 2026 mencakup 77 profil dalam delapan keluarga,
385 kombinasi skema/topik, 924 kombinasi peran penyajian/tingkat penjelasan,
dan lima pilihan model. Suite menjalankan 2.926 request model tiruan tanpa
percobaan fetch eksternal. Jumlah terbaru selalu ditampilkan oleh suite
berdasarkan katalog yang dibaca pada saat pengujian.

Regresi metadata: judul bagian yang memiliki ID, halaman dan teks tetap bukan
cuplikan bukti. Pengumpul kutipan dibatasi ke bidang rujukan yang ditetapkan;
uji independen memeriksa daftar yang diharapkan dari paket konteks.
