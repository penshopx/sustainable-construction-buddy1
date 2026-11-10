# API PUB ASPEKINDO

## Chatbot publik

API ini melayani `POST /api/helpdesk`, `GET /api/public-chatbots/:token`, dan
`POST /api/public-chatbots/:token/chat`. Kontrak ada di `lib/api-spec/openapi.yaml`;
jalankan `pnpm --filter @workspace/api-spec run codegen` setelah mengubah kontrak.

Konfigurasi server yang diperlukan:

- `OPENROUTER_API_KEY`: rahasia penyedia AI yang sudah digunakan proyek.
- `OPENROUTER_MODEL`: opsional; default model lama `openai/gpt-4o-mini`.
- `SUPABASE_URL` atau `VITE_SUPABASE_URL`: URL HTTPS proyek Supabase yang terhubung.
- `SUPABASE_SERVICE_ROLE_KEY`: rahasia server untuk lookup bot melalui token.

Jangan memberi awalan `VITE_` pada kredensial rahasia. Jangan mencatat kredensial,
token berbagi, isi percakapan, persona, atau respons kesalahan mentah penyedia.
Konfigurasi ini **tidak** menggantikan konfirmasi tujuan rilis `SUPABASE_PROJECT_REF`.

Helpdesk sengaja tersedia tanpa login karena dipakai pada landing page. Ia tidak
membaca data pengguna. Token berbagi adalah izin untuk satu chatbot; `is_public`
hanya mengatur katalog. Bot tanpa token yang cocok tidak dapat dibaca atau diajak
bercakap. Token dibaca ulang pada setiap pesan; pencabutan/rotasi mengakhiri akses
permintaan berikutnya. Persona dipakai di server saja. Knowledge base, data proyek,
profil pemilik, dan riwayat privat tidak diambil. Pencarian web langsung tidak
tersedia: jawaban tidak boleh mengaku telah memverifikasi regulasi terbaru.

## Batas operasional

- Maksimal 10 pesan, 4.000 karakter per pesan, total 20.000 karakter; pesan terakhir
  harus berasal dari pengguna. Tidak menerima role system/developer/tool.
- Maksimal 20 permintaan pesan per 5 menit per alamat jaringan, 60 lookup per menit,
  200 permintaan pesan per jam per proses, dan 4 permintaan upstream bersamaan.
- Tidak mempercayai `X-Forwarded-For` dari klien. Jika proxy menyamarkan alamat
  pengunjung, kuota alamat jaringan dibagi para pengunjung tersebut. Ubah kebijakan
  trust proxy hanya setelah jalur proxy diverifikasi.
- Pembatas masih **in-memory per proses**, bukan anggaran terdistribusi yang tahan
  restart/autoscaling. Sebelum menaikkan skala trafik publik, gunakan pembatas
  bersama yang persisten dan batas biaya di penyedia.
- Lookup Supabase maksimal 7 detik; AI 25 detik. Redirect upstream ditolak.
- Kesalahan konfigurasi/penyedia mengembalikan JSON 503, timeout 504, kuota 429
  beserta `Retry-After`; tidak menyamarkan kegagalan sebagai jawaban AI sukses.

## Pemeriksaan

`pnpm --filter @workspace/api-server test` menjalankan pengujian HTTP dengan
Supabase dan AI tiruan; tidak menggunakan kredensial, data produksi, atau biaya AI.
`pnpm run typecheck` memeriksa seluruh workspace.
