# Kontrak Insight Kompetensi PUB–Gustafta

Dokumen ini mencatat kontrak integrasi yang diterapkan pada deployment produksi Gustafta dan dipakai oleh Supabase Edge Function `competency-insight`.

## Endpoint dan autentikasi

- Method: `POST`
- Endpoint produksi: `https://gustafta.my.id/api/v1/ai/assist`
- Header: `Authorization: Bearer <API_KEY>`
- Content type: `application/json`
- Secret pada Gustafta: `GAIA_SIAP_API_KEY`
- Duplikat secret server-side pada Supabase: `GUSTAFTA_ENGINE_API_KEY`

Nilai kedua secret API key harus sama. Secret hanya berada di environment server dan tidak pernah dikirim ke browser.

## Request

```json
{
  "schemaVersion": "pub-siap-v1",
  "availableRecommendationKeys": [
    "legalitas-pancek",
    "sertifikasi-lms",
    "tender-risk"
  ]
}
```

Tidak ada identitas anggota, email, user ID, skor mentah, atau data profil pada payload.

## Response

```json
{
  "recommendationKeys": [
    "legalitas-pancek",
    "sertifikasi-lms",
    "tender-risk"
  ]
}
```

Jaminan provider:

- Maksimum tiga key.
- Duplikat dihapus.
- Urutan input dipertahankan.
- Output hanya berasal dari `availableRecommendationKeys`.
- Field tambahan pada request, termasuk identitas anggota, ditolak dengan HTTP 400.

Adapter PUB tetap menerapkan allowlist katalog internal, deduplikasi, dan batas maksimum tiga hasil. Respons kosong, invalid, timeout, atau error HTTP memakai fallback deterministik.

## Verifikasi

```bash
npm run validate:insight
npm run test:insight:live
npm run publish:insight
```

Validator standar menjalankan tes kontrak lokal dan tes publication gate dalam satu langkah. Tes kontrak lokal mencakup success, timeout, output invalid, deduplikasi, dan allowlist. Probe live memverifikasi bahwa request tanpa sesi ditolak, health hanya dapat dibaca admin, dan request dengan sesi anggota sementara menghasilkan respons aman dengan `source: connected` atau `source: deterministic` serta maksimal tiga rekomendasi. Probe tidak mencetak payload, token, identitas, atau URL provider, dan akun sementara selalu dihapus agar dapat dijalankan ulang.

Gunakan `npm run publish:insight` untuk mempublikasikan `competency-insight` melalui Supabase CLI, menunggu deployment selesai, lalu menjalankan probe live secara otomatis. Perintah ini gagal jika deployment atau salah satu pemeriksaan kontrak dan cleanup akun probe gagal. Outputnya hanya memuat status langkah dan ringkasan non-sensitif.

## Gate release

Deployment aplikasi memakai `npm run release`, bukan `npm run build` langsung.
Perintah tersebut menjalankan validator standar, build aplikasi, lalu memanggil
`npm run publish:insight`, sehingga deployment tidak dapat dianggap berhasil
sebelum Edge Function aktif dan kontrak live lulus. Exit code publisher
diteruskan ke proses release; ringkasan kegagalan JSON yang tersanitasi tetap
ditulis ke stderr agar tersedia di log release.

Untuk release manual, gunakan urutan berikut:

```bash
npm run release
```

Jangan menjalankan `supabase functions deploy competency-insight` secara
langsung karena jalur tersebut melewati gate probe live.