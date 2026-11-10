# Adapter tiruan OpenClaw–Hermes

## Lapisan akses operator di preview

Wrapper HTTP tersedia hanya pada `NODE_ENV=development`, melalui:

- `POST /api/operator/pilot/jobs`
- `GET /api/operator/pilot/jobs/:jobId`
- `POST /api/operator/pilot/jobs/:jobId/cancel` (tanpa body)

Panel preview berada di **Admin → Akses** (`/admin/akses`), di dalam guard
Super Admin yang sudah ada. Panel ini tidak muncul dalam build produksi.
Setiap tindakan di backend memverifikasi bearer session ke Supabase Auth,
lalu memanggil RPC `current_user_is_super_admin` memakai JWT anggota dan
publishable key, bukan service-role. Hanya hasil boolean `true` diterima;
role biasa `admin` tidak otomatis diizinkan. Tidak ada pembuatan role atau
perubahan hak akses database.

Hasil role tidak di-cache. Revokasi, fungsi RPC hilang, respons tidak valid,
atau gangguan verifikasi menutup akses. Caller tidak dapat memilih actor,
owner, peran, endpoint, atau payload bebas. Setiap UUID terverifikasi memakai
instance fixture privat; job akun lain tidak dapat dilihat atau dibatalkan.
Label `operator-a` di dalam fixture tidak pernah diterima dari HTTP.

Kapasitas wrapper: maksimal 32 instance operator, masing-masing 20 job;
10 pengiriman/operator/menit dan 60 permintaan/alamat IP/menit per proses.
Instance kosong yang tidak aktif lebih dari 10 menit dibersihkan ketika ada
permintaan berikutnya. Batas dan deduplikasi tetap in-memory, bukan durable.

Panel tidak mengirim pekerjaan otomatis. Polling status berjalan hanya saat
job aktif, dan berhenti serta menyembunyikan status lama bila verifikasi gagal.
Pengiriman manual setelah kegagalan menggunakan request ID yang sama;
pergantian akun membatalkan penantian dan membuang state lama. Tidak ada
API key atau token sesi yang diberikan ke fixture.

### Pengujian pembatalan dan timeout dengan satu klik

Tombol **Uji pembatalan & timeout** hanya berjalan setelah diklik operator.
Alur membuat dua job `hang` dengan request ID berbeda, langsung membatalkan
yang pertama, lalu membaca status yang kedua hingga terminal (maksimal 8 GET).
Semua permintaan memakai sesi operator saat ini dan tetap diperiksa backend.
Kontrol manual dinonaktifkan selama pengujian agar kedua alur tidak bertabrakan.

`Lulus` hanya ditampilkan untuk respons `cancelled` pada uji pembatalan dan
`timed_out` pada uji timeout. Jika server lebih dahulu melakukan timeout,
pembatalan ditandai belum lulus. Batas pemeriksaan klien 20 detik atau habisnya
jumlah GET tidak boleh dianggap sebagai timeout server. Hasil serta ID tampil
langsung di panel; operator tidak perlu mengisi formulir hasil terpisah.

Tidak ada pengiriman ulang POST otomatis. Setelah kegagalan yang belum jelas,
percobaan manual mempertahankan pasangan request ID dalam sesi komponen yang
sama, dengan keterbatasan deduplikasi in-memory yang sudah dijelaskan di atas.
Pergantian akun/unmount membatalkan penantian, menghapus hasil dan pasangan ID;
kegagalan verifikasi menyembunyikan hasil parsial. Tes komponen dan logika
memakai respons sintetis, bukan bukti bahwa kedua skenario telah dijalankan
dengan sesi operator nyata.

Tes wrapper memakai respons Supabase sintetis untuk menguji penolakan akses
dan revokasi. Tes tersebut bukan bukti login operator live atau migrasi pada
Supabase hosted telah terverifikasi. Tidak ada pembacaan dokumen anggota,
panggilan AI, atau instalasi OpenClaw dalam alur ini.

## Cakupan

Core adapter adalah fixture pengembangan lokal, **bukan integrasi OpenClaw atau Hermes nyata**.
Core itu sendiri tidak mendaftarkan endpoint HTTP/UI, memanggil SDK AI atau
jaringan, mengakses database/API key, maupun membaca data anggota.
Wrapper akses operator di atas hanya memeriksa sesi dan peran.
Output kesehatan layanan selalu berlabel
`synthetic-only`; status `simulated` bukan hasil pemeriksaan layanan sebenarnya.

Jalankan dari root workspace:

```sh
node artifacts/api-server/scripts/probe-agent-adapter-preview.mjs
pnpm --filter @workspace/api-server exec node --test tests/mock-agent-adapter.test.mjs
```

Probe berjalan seluruhnya di memori dan tidak memanggil model AI. Tidak diperlukan
instalasi OpenClaw, runtime Hermes, saldo provider, atau perubahan environment.

## Kontrak lokal

- Buat instance dengan `createMockAgentAdapter`, hanya untuk `development`/`test`.
- `submit(actor, {requestId, operation: "service_health", scenario})`.
- Actor hanya fixture `operator-a` atau `operator-b`, **bukan login/peran operator asli**.
- Scenario terbatas pada `success`, `failure`, `hang`; tidak menerima prompt,
  endpoint, token, ID anggota atau payload tambahan.
- `get(actor, jobId)` dan `cancel(actor, jobId)` memeriksa pemilik fixture.
- `stats()` adalah penghitung fixture lokal, bukan endpoint pemantauan publik.
- `dispose()` membatalkan pekerjaan aktif/antrean dan menolak pengiriman baru.

Alur status:

```text
queued → running → completed / failed / timed_out
   └────────────→ cancelled ←──────────┘
```

Pembatalan hanya berlaku saat queued/running; status terminal tidak dapat
diubah oleh pembatalan terlambat atau penyelesaian yang terlambat.

## Deduplikasi dan batas

Request ID UUID v4 yang sama milik actor yang sama mengembalikan job yang sama,
termasuk setelah gagal, timeout, atau dibatalkan. Perubahan scenario pada ID
yang sama ditolak. Actor berbeda memiliki ruang deduplikasi berbeda.

Default: satu eksekusi serentak, maksimal 100 job tersimpan, timeout eksekusi
2 detik, retensi terminal 5 menit. Waktu antre tidak termasuk timeout eksekusi.
Status terminal kedaluwarsa dibersihkan ketika adapter diakses. Pekerjaan aktif
tidak dihapus karena retensi. Setelah retensi habis, ID lama boleh membuat job
baru. Overflow ditolak secara eksplisit.

Semua batas dan deduplikasi bersifat **in-memory, per instance**. Restart
menghapus riwayat; ini bukan jaminan exactly-once terdistribusi.

## Yang belum dibuktikan

Tes fixture tidak membuktikan autentikasi operator, isolasi tenant/gateway
OpenClaw, kompatibilitas ACP Hermes, pembatalan worker eksternal, pengiriman
hasil antarlayanan, atau koneksi Claude berbayar.

Sebelum membuat adapter OpenClaw nyata: buktikan autentikasi operator live dan scope,
transport internal yang diautentikasi, antrean/deduplikasi durable,
pengikatan actor dari sesi tepercaya (bukan input model), kebijakan log/retensi,
serta batas izin alat. Jangan mengekspos fixture ini sebagai layanan produksi.
