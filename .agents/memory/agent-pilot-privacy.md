---
name: Privasi pilot agen
description: Batas izin pilot agen dan pemisahan orkestrasi SDK dari akses provider.
---

Pilot agen diizinkan untuk preview baca-saja dan indikator keterisian metadata,
bukan isi berkas, jawaban assessment, data mentah pribadi, atau akses tulis.
Adapter tiruan lokal yang diizinkan juga tetap tanpa data anggota maupun
panggilan AI berbayar; izin ini bukan izin memasang OpenClaw.
Pemeriksaan akses operator boleh memverifikasi sesi dan peran yang sudah ada,
tetapi tidak memperluas izin menjadi pembacaan dokumen anggota.
PDF regulasi yang diberikan langsung untuk knowledge base boleh diolah sebagai
rujukan bersama; izin unggahan itu bukan izin mengambil dokumen pribadi anggota
atau seluruh knowledge base Mentor.

**Why:** Pengguna memilih pilot baca-saja, runtime khusus preview, adapter
tiruan tanpa pemasangan OpenClaw, dan kemudian pemeriksaan akses operator; izin tersebut
bukan persetujuan untuk mengirim seluruh dokumen atau membuka akses produksi.
Pengguna kemudian memberikan PDF regulasi secara langsung untuk knowledge base;
persetujuan tersebut terbatas pada bahan yang diberikan, bukan data akun lain.

**How to apply:** Jangan memperluas cakupan data atau tindakan hanya karena
pengguna mengatakan “lanjut”. Minta izin baru untuk isi dokumen, kemampuan tulis,
atau penerapan produksi.

Orkestrasi SDK tidak mengharuskan worker menerima kunci provider atau menentukan
konteks yang dikirim ke model. Pertahankan keputusan data dan kebijakan model
di batas server yang terpisah dari prompt otomatis SDK.

**Why:** Bootstrap dan prompt SDK dapat berubah tanpa perubahan kebijakan aplikasi.
Mewariskan konteks tersebut dapat mengirim data yang tidak disetujui anggota.

**How to apply:** Saat mengganti SDK atau menambah model/alat, periksa kembali
batas perantara provider; jangan menganggap daftar alat kosong sebagai sandbox OS.

OpenClaw Gateway bukan batas isolasi tenant untuk pengguna yang tidak saling
percaya. Session key adalah penentu routing, bukan bukti otorisasi anggota.

**Why:** Dokumentasi resmi menjelaskan satu trust boundary per gateway dan
menyatakan gateway bersama tidak mendukung isolasi pengguna adversarial.
Sumber: https://docs.openclaw.ai/gateway/security/trust-model

**How to apply:** Dalam rancangan integrasi PUB, jangan menjadikan session
OpenClaw pengganti pemeriksaan pemilik dan persetujuan di backend. Rancangan
awal menempatkan OpenClaw di jalur operator tanpa data pribadi anggota.
Ini rekomendasi rancangan, bukan bukti integrasi sudah terpasang atau izin
untuk memasang gateway. Perlu evaluasi isolasi terpisah sebelum memperluas akses.

Bedakan uji Hermes lokal dari simulasi adapter dan analisis model nyata.
Uji lokal boleh memakai runtime Hermes nyata dengan penyedia model tiruan
dan data sintetis, serta rujukan regulasi unggahan BG001 untuk pilot skema
lokal yang disetujui. Izin itu tidak mencakup dokumen anggota atau semua skema.
Mode chat Hermes + Claude khusus BG001 kemudian disetujui untuk preview:
pertanyaan yang dimasukkan sendiri dan kutipan regulasi boleh diteruskan
setelah persetujuan biaya sekali kirim. Izin membangun fitur ini bukan izin
menjalankan permintaan model berbayar selama pengerjaan.
Uji tidak boleh diam-diam memakai data anggota, provider
nyata, atau menyatakan hasilnya sebagai jawaban Claude.

**Why:** Pengguna memilih penggunaan Hermes melalui uji lokal tanpa API berbayar,
kemudian menyetujui integrasi lokal khusus BG001 dari rujukan yang sudah ada
dan mode chat BG001 dengan persetujuan setiap pengiriman ke Claude.
Keberhasilan orkestrasi runtime tidak membuktikan kualitas model atau hasil
analisis dokumen.

**How to apply:** Pertahankan label yang membedakan runtime nyata dan respons
tiruan. Jika runtime gagal, tampilkan kegagalan, bukan menggantinya dengan
simulasi sukses; perlu izin terpisah untuk beralih ke analisis model nyata.
