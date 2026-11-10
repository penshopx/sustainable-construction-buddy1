# Diagnosis runtime Hermes untuk pilot preview

## Status

Runtime Nix resmi, varian `minimal`, **berhasil dibangun**. Probe versi CLI dan
uji satu putaran `AIAgent` Hermes dengan penyedia tiruan lokal berhasil.
Uji memakai metadata sintetis, satu permintaan, dan daftar alat kosong.

**Runtime belum dihubungkan ke backend/UI SMAP atau Claude sungguhan.**
Tidak ada inferensi AI eksternal, pemakaian API key aplikasi, atau data anggota
dalam pemeriksaan ini. Ini adalah runtime lokal preview, bukan layanan API
Hermes persisten atau bukti bahwa pilot anggota sudah siap digunakan.

## Temuan yang telah diperiksa

- Percobaan paket biasa pada rilis `v0.22.5` berhenti karena konflik pin
  `Pillow==13.0.0` dan dependensi browser yang meminta `Pillow==12.3.0`.
- Rilis `v0.22.4` melewati resolusi dependensi, tetapi upstream sengaja menolak
  pembuatan wheel biasa. `setup.py` menjelaskan bahwa aset runtime mengikuti
  tata letak source checkout atau distribusi Nix. Ini bukan kesalahan API key.
- Python stabil 3.14.7 tersedia dalam Nix store lingkungan yang diperiksa.
  Keberadaan interpreter tersebut belum berarti dependensi Hermes terpasang.
- Flake resmi rilis `v0.22.4`, commit
  `4d04303818b61bf3aa09278af48356315515965b`, berhasil dievaluasi secara offline.
  Katalog paket menyediakan `minimal`, dan evaluasi derivasi varian tersebut
  menghasilkan target `x86_64-linux`. Pemeriksaan menonaktifkan
  import-from-derivation agar tidak membangun paket saat evaluasi.
- Nama paket hasil evaluasi adalah `hermes-agent-0.0.0`. Jangan memakai nama
  paket ini sebagai bukti versi rilis; identitas sumber harus tetap dipatok.

## Batas keamanan yang belum boleh diasumsikan

- `source ./activate` bukan sekadar pengaturan PATH. Skrip itu menyiapkan
  lingkungan dependensi; jangan menjalankannya tanpa pemeriksaan lebih lanjut.
- Import `run_agent` mengaktifkan bootstrap dependensi dan pemuatan konfigurasi.
  Penemuan plugin juga terjadi pada jalur import `model_tools`.
- Kebijakan safe-worker dalam sumber yang diperiksa bersifat internal dan
  secara eksplisit bukan sandbox atau sakelar peluncuran publik.
- Paket `minimal` tidak membuktikan bahwa terminal, filesystem, plugin,
  memori, atau tindakan tulis telah diblokir.
- Jangan mengakali pembatas wheel dengan menyetel `HERMES_NIX_BUILD=1` di
  lingkungan aplikasi. Upstream membatasi flag tersebut untuk derivasi Nix.

## Menjalankan build dan pemeriksaan awal

```sh
node artifacts/api-server/scripts/build-hermes-preview.mjs /path/ke/checkout-hermes
# Hanya setelah build berhasil:
node artifacts/api-server/scripts/probe-hermes-preview.mjs
node artifacts/api-server/scripts/probe-hermes-preview.mjs --fixture
```

Skrip build memeriksa commit yang dipatok dan menolak checkout yang berubah.
Sumber diteruskan ke Nix sebagai URL Git dengan commit eksplisit, bukan sekadar
path, agar metadata revisi runtime tetap tersedia. Pengaturan koneksi Nix
lingkungan dipertahankan, tetapi environment aplikasi tidak diwariskan seluruhnya.
Menghapus semua pengaturan koneksi Nix menyebabkan pemilihan store yang tidak
dapat diakses dalam lingkungan ini.

Build dibatasi sepuluh menit, dua pekerjaan paralel, dan dua core per pekerjaan.
Output dan log berada di `generated-artifacts/hermes/`, yang dikecualikan dari
Git dan deployment. Hasil build tidak ikut dipindahkan lewat commit; jalankan
build kembali jika runtime tidak tersedia di lingkungan tujuan.

Skrip probe memakai home sementara tanpa kredensial aplikasi. Mode default hanya
menjalankan `--version`, dengan batas waktu 20 detik. Mode `--fixture` menjalankan
Hermes sebenarnya dengan penyedia OpenAI-compatible tiruan pada loopback, data
sintetis, serta batas waktu 45 detik. Fixture menolak koneksi selain ke penyedia
lokalnya dan melarang subprocess sebelum import Hermes. Ini pengaman pengujian
Python, **bukan sandbox produksi**.

Fixture mendeteksi satu percobaan `uname` dari introspeksi `platform` Python.
Percobaan tersebut tetap diblokir; satu putaran agen tetap selesai. Fixture
menolak percobaan subprocess lain, alat apa pun pada permintaan model, serta
percobaan jaringan di luar penyedia lokal.

**Lolos kedua probe tidak membuktikan keamanan worker produksi, koneksi Claude,
otorisasi dokumen anggota, atau persetujuan pengiriman data pada UI.**

## Pilot aplikasi di preview

Tab **SMAP → Pilot AI baca-saja** hanya muncul pada build development.
Endpoint `/api/smap/pilot/documents` dan `/api/smap/pilot/analyze` menolak
permintaan di luar `NODE_ENV=development`. Jangan mengaktifkan mode development
di produksi untuk membuka pilot.

Daftar mengambil hingga 50 catatan terbaru dengan sesi anggota, filter pemilik
eksplisit, dan RLS Supabase. Tidak memakai service-role bearer. Pemilihan 1–5 ID
divalidasi ulang sebelum analisis, termasuk kepemilikan semua catatan. UI
memerlukan persetujuan baru untuk pengiriman indikator keterisian melalui
OpenRouter ke model Claude yang dikonfigurasi di server.

Worker menerima jenis dokumen, nomor urut sementara, dan indikator Ya/Tidak
saja. Nama, nomor dokumen asli, tanggal, ID akun/dokumen, isi berkas, URL berkas,
catatan bebas, jawaban assessment, JWT anggota, serta API key provider/Supabase
tidak diteruskan ke Hermes. Tanggal pembuatan dan ID hanya membantu daftar UI;
keduanya dibuang dari payload agen.

SDK Hermes asli memulai satu permintaan ke perantara loopback dengan capability
acak sekali pakai. Hanya server yang memanggil provider: prompt sistem milik
server dan indikator terpilih menggantikan konteks/prompt otomatis SDK. Tidak
ada proxy URL/model bebas atau penerusan prompt SDK ke provider. Respons
ditolak bila model berbeda, teks kosong/terlalu panjang, atau `finish_reason`
bukan `stop`. Tidak ada fallback model maupun pengiriman ulang provider.

Worker memakai interpreter Nix yang diverifikasi, environment allowlist, home/
cwd sementara per pekerjaan, tanpa alat, memori, background review, context
files atau checkpoint. Python menolak subprocess dan koneksi selain satu port
loopback. **Ini pembatas pilot, bukan sandbox OS yang menjamin isolasi produksi.**
Timeout 85 detik dan pembatalan klien menghentikan pekerjaan; home sementara
dibersihkan. API tidak menulis hasil ke database; UI tidak menyimpan hasil ke
browser storage.

Batas biaya berbasis jumlah permintaan: 3 analisis per anggota/jam, 10 total/jam,
dan satu worker serentak **per proses**. Bukan batas tagihan dolar atau kuota
terdistribusi; restart proses mereset penghitung. Tidak ada deduplikasi lintas
permintaan: pengiriman manual baru setelah koneksi putus dapat menimbulkan
panggilan baru. Persetujuan UI direset setelah pengiriman dan perubahan pilihan.

Tes integrasi menjalankan worker Hermes nyata dengan respons provider tiruan
dan metadata sintetis. Ini membuktikan jalur orkestrasi dan penyaringan, **bukan**
ketersediaan model Claude, saldo/izin provider, atau keberhasilan panggilan AI
berbayar. Pengujian live hanya setelah persetujuan anggota melalui UI. Sebelum
produksi diperlukan isolasi OS yang memadai, kuota terdistribusi, deduplikasi
permintaan, serta peninjauan kebijakan data penyedia; pilot ini bukan izin rilis.

Hasil pilot harus berlabel rekomendasi/draf, bukan keputusan sertifikasi.
Panggilan Claude langsung tidak boleh diberi label sebagai integrasi Hermes.

## Rujukan upstream

- https://github.com/NousResearch/hermes-agent/tree/v0.22.4
- https://hermes-agent.nousresearch.com/docs/getting-started/installation
