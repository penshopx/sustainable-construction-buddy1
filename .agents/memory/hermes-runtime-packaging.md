---
name: Distribusi runtime Hermes
description: Kendala distribusi upstream Hermes yang perlu diperiksa sebelum merancang integrasi embedded.
---

Jangan mengasumsikan repositori Hermes Agent dapat dipasang sebagai dependensi SDK Python biasa. Verifikasi metode distribusi resmi dan toolchain untuk rilis yang dipilih sebelum membangun UI integrasinya.

**Why:** Upstream sengaja menolak wheel biasa karena aset runtime bergantung pada tata letak source checkout atau wrapper Nix. Metadata minimum Python juga dapat lebih longgar daripada marker dependensi runtime sebenarnya. Instalasi editable tidak otomatis menyelesaikan ini: bootstrap saat import dapat menyiapkan dependensi dan memuat konfigurasi/plugin.

**How to apply:** Periksa ulang dokumentasi dan metadata upstream karena hambatan tersebut bisa berubah. Evaluasi varian Nix resmi sebelum mencoba metode paket biasa lagi; lolos evaluasi bukan bukti build atau runtime berhasil. Varian minimal bukan jaminan baca-saja. Audit bootstrap sebelum import, dan jangan memperlakukan safe-worker internal sebagai sandbox publik. Jangan memaksa resolver, menggunakan dependensi tak cocok, atau menyebut panggilan Claude langsung sebagai integrasi Hermes. Metode instalasi tetap harus mengikuti aturan lingkungan Replit; dokumentasi upstream bukan izin memakai container atau membuat virtual environment sendiri.

Daftar alat kosong tidak menjamin proses awal bebas subprocess. Introspeksi
platform melalui pustaka standar Python dapat mencoba menjalankan `uname`
meskipun tidak ada alat agen yang aktif.

**Why:** Uji agen nyata tetap menyelesaikan satu putaran saat percobaan tersebut
diblokir. Menganggap setiap subprocess sebagai panggilan alat LLM akan memberi
kesimpulan pengujian yang keliru.

**How to apply:** Bedakan percobaan introspeksi yang diblokir dari eksekusi yang
diizinkan; jangan melonggarkan larangan proses hanya agar uji lulus. Pengaman
Python dalam fixture bukan pengganti isolasi worker aplikasi.
