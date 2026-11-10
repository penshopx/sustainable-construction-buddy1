# AI PUB ASPEKINDO — preview

## Jalur yang dipasang

Pakar Cerdas (`/helpdesk`) memakai endpoint API workspace `/api/helpdesk`, bukan
Edge Function `helpdesk-chat` lama. Kunci OpenRouter yang sudah digunakan backend
tetap di server. Tidak ada kunci baru, perubahan database, atau konfigurasi
produksi dalam pekerjaan ini.

Pilihan awal Pakar Cerdas adalah Claude. Model ID berikut tersedia di katalog
publik OpenRouter ketika integrasi dibuat; akses akun, saldo, kuota, dan kebijakan
privasi penyedia tetap dapat membatasi pemakaian:

| Pilihan | Model default | Pengaturan server opsional |
| --- | --- | --- |
| Claude | `anthropic/claude-opus-5.5` | `AI_CLAUDE_MODEL` |
| GPT | `openai/gpt-4o-mini` | `AI_GPT_MODEL` |
| DeepSeek | `deepseek/deepseek-v4.1-flash` | `AI_DEEPSEEK_MODEL` |
| NVIDIA | `nvidia/nemotron-3.5-lightning:free` | `AI_NVIDIA_MODEL` |
| Gemini | `google/gemini-3.5-flash-lite` | `AI_GEMINI_MODEL` |

Claude dapat ditingkatkan, misalnya ke `anthropic/claude-fable-5.1`, melalui
konfigurasi server yang disetujui pemilik akun. Model default bukan klaim bahwa
Opus selalu merupakan model Claude tertinggi. Model yang tersedia dan biayanya
harus diperiksa kembali sebelum mengganti konfigurasi.

NVIDIA di sini adalah model NVIDIA **melalui OpenRouter**, bukan koneksi langsung
ke NVIDIA API Catalog. Label free mengikuti kuota/ketersediaan OpenRouter dan
tidak menjamin gratis tanpa batas. Claude dan model harian lain mengikuti tarif
akun OpenRouter; langganan chat konsumen bukan pengganti akses API.

## Batas akses, konteks, dan biaya

- Permintaan tanpa engine/topik/persona tetap melayani helpdesk publik lama.
  Pilihan engine atau konteks pakar memerlukan bearer token anggota yang
  diverifikasi server melalui Supabase Auth. Public chatbot tetap hanya memakai
  persona server dan tidak menerima pilihan model atau persona dari pemanggil.
- Model dan endpoint hanya dipilih server dari daftar yang diizinkan; browser
  tidak dapat mengirim model ID, API key, endpoint, atau kebijakan fallback.
- Tidak ada retry/fallback model otomatis. Routing upstream menggunakan
  `allow_fallbacks: false` dan `data_collection: deny`. Model yang tidak memenuhi
  kebijakan ini gagal secara eksplisit, bukan diberi izin pengumpulan data secara
  diam-diam. ID model respons juga harus cocok dengan model yang diminta.
- Mengganti model membuat percakapan baru. Riwayat lama tetap bisa dibaca, tetapi
  ketika dibuka kembali, konteks yang dikirim hanya pesan baru setelah pembukaan;
  riwayat lama tidak otomatis diteruskan ke model yang mungkin berbeda.
- Payload dibatasi 10 pesan/20.000 karakter; setiap pesan input maksimal 4.000
  karakter. Jawaban dibatasi 4.096 token untuk Claude atau 2.048 untuk model lain.
- Batas anggota: 20 upaya/jam lintas model, termasuk maksimal 5 Claude/jam.
  Batas IP/global dan maksimal 4 permintaan serentak tetap berlaku.
- **Pembatas masih di memori proses**, bukan anggaran uang atau kuota terdistribusi.
  Restart menghapus hitungan dan beberapa instance memiliki hitungan terpisah.
  Sebelum produksi multi-instance, gunakan penyimpanan kuota bersama dan tetapkan
  batas belanja di akun penyedia. Upaya yang gagal juga dapat memakai kuota.
- Identitas pemilik tetap berasal dari sesi. Kegagalan penyimpanan tidak boleh
  ditampilkan seolah-olah berhasil, dan respons yang terlambat setelah pembatalan
  tidak mengisi percakapan baru.
- AI tidak menjalankan aksi administratif, menetapkan nilai assessment, atau
  membuka data anggota lain. Batas klaim sertifikasi/regulasi tetap diterapkan
  pada seluruh model. Tidak ada integrasi RAG atau akses dokumen otomatis baru.

## Verifikasi dan batas klaim

Pengujian backend menggunakan respons Supabase Auth/OpenRouter tiruan, dan
pengujian hook memakai database/API tiruan. Ini menguji kontrak, pemilihan model,
kontrol sesi/kuota, pemisahan konteks, pembatalan, serta kegagalan penyimpanan.
Tidak memakai token produksi atau menulis ke Supabase hosted. Katalog model
publik diperiksa tanpa kredensial. Keberhasilan respons AI berbayar pada akun
yang terhubung belum dibuktikan oleh tes tersebut.

Perubahan ini mencakup backend chat workspace dan Pakar Cerdas, bukan migrasi
semua generator/Edge Function AI lain dalam aplikasi. Tidak ada publikasi atau
penyetelan `SUPABASE_PROJECT_REF`; konfigurasi tujuan produksi masih menunggu
konfirmasi pemilik rilis.
