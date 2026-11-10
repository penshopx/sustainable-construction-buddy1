# Pilot chat Hermes + Claude — BG001

## Penggunaan

Preview saja, khusus Super Admin. Buka **Pakar Cerdas → Hermes BG001**.
Isi pertanyaan mengenai pemetaan KBLI/ruang lingkup BG001, lalu setujui satu
permintaan yang dapat berbiaya. Persetujuan dihapus saat dikirim atau pertanyaan
diubah. Membuka halaman, memilih tab, dan memuat ulang tidak memanggil model.

Ini jalur model nyata, berbeda dari **Admin → Akses → Uji Hermes Lokal**.
Pengerjaan dan tes hanya memakai model tiruan; ketersediaan/kredit Claude belum
dibuktikan kembali. Tidak ada pemasangan OpenClaw atau publikasi.

## Kontrak dan data

`POST /api/operator/hermes/bg001-chat` menerima tepat:

```json
{ "consent": true, "question": "Jelaskan pemetaan BG001" }
```

Pertanyaan 5–1000 karakter setelah dipangkas. Peran, model, URL provider, konteks,
riwayat, dan dokumen tidak dapat ditentukan klien. Identitas serta peran Super
Admin diperiksa server sebelum dan sesudah pekerjaan.

Konteks berasal dari kutipan asli tiga rujukan yang sudah diunggah:

- KB09 halaman PDF 21: pemetaan BG001 → KBLI 41011.
- KB19 halaman PDF 17: ruang lingkup subklasifikasi.
- KB44 halaman PDF 573: uraian KBLI BPS 2025.

Tidak mengambil lampiran anggota, profil, maupun percakapan sebelumnya.
Pengguna diperingatkan agar tidak memasukkan data pribadi, kunci API, atau
isi dokumen anggota ke pertanyaan. Jawaban dan draf hanya berada dalam memori
halaman; pindah tab, logout, pergantian akun, atau reload dapat menghapusnya.

## Runtime dan batas kepercayaan

Hermes nyata berjalan tanpa alat, memori, atau kredensial provider di worker.
Broker memeriksa kecocokan pertanyaan dan konteks pada pesan SDK. Hanya paket
server itu yang dikirim ke Claude; sistem prompt/history internal SDK, JWT,
ID operator, dan kunci lain tidak diteruskan.

Claude dipilih oleh konfigurasi server yang sudah ada (`AI_CLAUDE_MODEL`),
menggunakan OpenRouter. Tidak ada pemilihan model oleh klien, fallback ke model
lain, respons acuan palsu saat gagal, atau pengiriman ulang model otomatis.

Model diminta mengembalikan JSON `answer`, `insufficientEvidence`, `evidence`.
Pasangan ID sumber/halaman harus cocok dengan rujukan dan kutipan di jawaban.
Respons berformat rusak, rujukan palsu, sumber tak terdaftar, serta keluaran
terpotong ditolak. Jika bukti tidak cukup, jawaban boleh tidak memakai sumber.
Pemeriksaan ini bukan pembuktian kebenaran seluruh klaim AI atau keputusan SBU.

## Biaya, pembatalan, dan kegagalan

- Satu panggilan model maksimum per permintaan; batas tiga percobaan per operator
  per jam digabung dengan kedua mode uji lokal. Satu proses bersamaan per server.
- Anggaran bersifat dalam proses preview dan kembali kosong ketika server
  dimulai ulang; bukan pengendalian biaya terdistribusi untuk produksi.
- Ada pembatalan saat pengguna menekan Batalkan, kehilangan akses, berpindah
  akun, atau meninggalkan komponen. Batas waktu runtime dan HTTP tetap berlaku.
- Pemeriksaan peran berkala menyembunyikan UI sementara tanpa membatalkan
  pekerjaan berbayar yang masih sah; penolakan definitif menghapus dan membatalkan.
- Provider 402 ditampilkan dengan pesan tetap untuk memeriksa saldo/anggaran.
  Detail error mentah provider tidak diteruskan atau dicatat.
- Jika provider telah menerima permintaan, kegagalan/pembatalan tidak menjamin
  biaya dibatalkan. Pengiriman berikutnya selalu memerlukan persetujuan baru.

## Pemeriksaan lokal tanpa provider nyata

```sh
pnpm --filter @workspace/api-server exec node --test tests/hermes-local-check.test.mjs tests/smap-pilot.test.mjs
pnpm --filter @workspace/pub-aspekindo exec node --experimental-strip-types --test src/lib/hermesBg001Chat.integration.test.ts src/lib/hermesLocalCheck.integration.test.ts
```

Tes menjalankan worker Hermes nyata dengan fetch provider tiruan untuk jalur
berhasil dan penolakan 402. Tidak menguji kualitas jawaban Claude nyata.
