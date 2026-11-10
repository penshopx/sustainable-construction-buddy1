# Catatan perbaikan keamanan

## Cakupan

Perubahan ini berlaku pada kode preview/workspace. Tidak menerapkan migrasi,
menghapus objek penyimpanan, mengganti kredensial, mengubah tujuan produksi,
atau melakukan publikasi.

### Impor Excel

`xlsx` menggunakan rilis resmi SheetJS CE 0.20.3 dari CDN vendor dengan integritas
tarball di lockfile. Versi ini melewati perbaikan prototype pollution (0.19.3)
dan ReDoS (0.20.2). Uji mencakup versi runtime, ekspor/impor XLSX dan impor CSV.

Advisori npm tetap dapat menandai paket ini karena rilis npm lama tidak memiliki
versi perbaikan dan rentang advisori terbuka. Itu bukan alasan menonaktifkan
pemindai atau mengganti paket kembali ke rilis npm yang rentan.

Rujukan:
- https://cdn.sheetjs.com/advisories/CVE-2023-30533
- https://cdn.sheetjs.com/advisories/CVE-2024-22363

### Pemisahan sesi

Setiap identitas akun mendapat QueryClient baru. Pergantian identitas mereset
query, mutation, dan state halaman, sedangkan pembaruan token untuk akun yang
sama mempertahankan pekerjaan yang belum disimpan. Query lama dibatalkan dan
cache lama dibersihkan. Router berada di luar batas reset agar penyelesaian
login yang asinkron masih dapat menavigasi dengan benar.

Respons pemulihan sesi dan profil yang terlambat tidak boleh menimpa akun baru.
Pemisahan cache adalah perlindungan browser, **bukan pengganti RLS Supabase**.

### Berkas SMAP

Unggahan baru menyimpan path objek di `file_url`, bukan signed URL. Akses berkas
membuat signed URL baru selama 300 detik menggunakan sesi aktif. URL lama di
database hanya dipakai untuk memulihkan path bucket/proyek/akun/dokumen yang
sesuai, bukan dipakai ulang sebagai izin akses. Kegagalan signing tidak boleh
memakai URL lama sebagai fallback.

Objek unggahan memakai nama unik agar penggantian berkas tidak mengubah konten
yang dapat diakses melalui tautan lama. Tidak ada penghapusan objek otomatis.

**Batas penting:** signed URL setahun yang sudah diterbitkan tetap dapat berlaku
sampai kedaluwarsa atau dicabut melalui tindakan penyimpanan yang sesuai.
Perbaikan kode tidak mencabutnya secara retroaktif. Inventarisasi dan pencabutan
tautan/objek lama perlu persetujuan terpisah karena dapat memutus akses dokumen.

## Hasil dan batas audit

Audit dependensi **produksi workspace aktif** setelah pembaruan melaporkan nol
temuan. Express/proxy-addr/qs dan DOMPurify diperbarui melalui rantai dependensinya.
Ini bukan klaim bahwa aplikasi bebas seluruh risiko keamanan.

Audit workspace **termasuk dependensi pengembangan** masih melaporkan 17 high,
11 moderate, dan 3 low (tanpa critical). Di antaranya dependensi alat build,
code generation, dan artefak presentasi seperti js-yaml, fast-uri, markdown-it,
source-map-js, prosemirror-view, dan Vite. Sebagian pustaka yang dibundel frontend
dideklarasikan sebagai devDependencies, sehingga hasil `--prod` saja tidak cukup
untuk menyatakan seluruh hasil build aman. Pembaruan lintas-artefak ini belum
diselesaikan dalam perbaikan tiga risiko utama aplikasi anggota.

Pemindaian seluruh repositori juga mencakup cadangan proyek dan dependensi
pengembangan/tooling. Temuan di sana tidak boleh disamakan dengan paket yang
dijalankan oleh aplikasi aktif. Pemindai statis masih menandai nilai menyerupai
kredensial pada `.migration-backup/.replit`; catatan ini tidak menyatakan nilai
tersebut service-role yang valid, dan tidak mereproduksi nilainya. Peninjauan
klasifikasi serta rotasi bila diperlukan belum dilakukan.

Pemindai aliran data tidak melaporkan temuan. Hasil pemindai adalah pemeriksaan
tambahan, bukan pengganti pengujian kontrol akses/RLS dan tinjauan operasional.

## Verifikasi

- Pemeriksaan tipe workspace dan build frontend lulus.
- 39 tes aplikasi (termasuk pemisahan sesi, respons terlambat, path/signing SMAP,
  serta kompatibilitas spreadsheet) dan 23 tes backend lulus.
- Pemeriksaan browser mengonfirmasi pergantian A → logout → B, data anggaran
  terpisah setelah reload, tombol berkas ketiga tipe SMAP, TTL 300 detik,
  kegagalan signing tanpa fallback, dan penyimpanan path setelah unggahan tiruan.
- **Verifikasi browser bersifat parsial:** sebelum isolasi jaringan terpasang
  penuh, tiga GET informasi/agenda dan satu GET popup dengan token uji mencapai
  layanan terhubung; GET popup ditolak sebagai token tidak valid. Tidak ada
  penulisan ke layanan hosted yang teramati. Karena itu, hasil ini tidak disebut
  sebagai pengujian E2E yang sepenuhnya terisolasi.
