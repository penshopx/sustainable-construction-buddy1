---
name: Kebijakan impor tautan Ruang Simpan
description: Alasan memakai nama file eksplisit dan tidak menyimpan URL sumber impor.
---

Impor tautan hanya menyimpan salinan file privat dan nama yang dikonfirmasi pengguna, bukan URL sumber atau riwayat pengalihannya. Saran nama otomatis bukan persetujuan untuk menyimpan sumber tautan.

**Why:** URL unduhan dapat membawa token atau tanda tangan sementara; menyimpannya dalam metadata, aktivitas, atau pesan kesalahan akan memperluas akses kredensial di luar tujuan pengambilan file.

**How to apply:** Jika kelak menambahkan deteksi nama file otomatis atau riwayat sumber, ambil hanya nama aman, bukan query URL atau kredensial. Jangan memasukkan URL mentah atau exception jaringan ke log/pesan pengguna.

Saat mem-pin satu IP pada lookup HTTPS Node, tetapkan keluarga IP secara eksplisit agar lookup tidak masuk mode pemilihan keluarga otomatis.

**Why:** Node dapat meminta hasil lookup berbentuk array melalui `all: true`. Callback yang mengembalikan satu alamat saja ditolak dengan `ERR_INVALID_IP_ADDRESS`, meskipun alamat valid dan pemeriksaan bertipe/mock lulus.

**How to apply:** Jangan mengubah opsi koneksi tersebut tanpa menguji perilaku transport Node sesungguhnya; mock lookup saja tidak cukup membuktikan file publik bisa diambil.

Harness TLS lokal boleh memetakan pin publik sintetis ke loopback hanya di batas jaringan pengujian, tanpa mengubah kebijakan alamat produksi atau bentuk callback lookup.

**Why:** Normalisasi callback oleh harness dapat menyembunyikan regresi `all: true`, sedangkan membuka akses loopback di produksi melemahkan perlindungan SSRF.

**How to apply:** Biarkan Node mengonsumsi callback dan memvalidasi TLS sendiri. Jika OS tidak mendukung IPv6 loopback, laporkan cakupan itu sebagai dilewati, bukan sebagai bukti IPv6 lulus; wajibkan IPv6 pada runner dual-stack.
