---
name: Cakupan advisori SheetJS
description: Mengapa pemindai npm dapat menandai rilis CDN SheetJS yang sudah ditambal.
---

Gunakan rilis resmi SheetJS CE dari CDN vendor, bukan rilis npm `xlsx` lama. Jika pemindai masih menandai rilis CDN, bandingkan versi dengan advisori vendor sebelum menyimpulkan pembaruan gagal. Jangan mematikan aturan pemindai untuk seluruh paket.

**Why:** Paket npm `xlsx` tidak lagi menerima rilis yang ditambal. Advisori npm memakai rentang terbuka tanpa versi perbaikan npm, sehingga pemindai bisa menganggap rilis CDN yang lebih baru tetap rentan. Vendor menyebut perbaikan prototype pollution mulai 0.19.3 dan ReDoS mulai 0.20.2.

**How to apply:** Saat memperbarui atau mengaudit impor Excel, periksa sumber tarball resmi, versi yang benar-benar diimpor, integritas lockfile, dan uji ekspor/impor. Pisahkan dependensi workspace aktif dari lockfile cadangan saat melaporkan temuan.

Rujukan: https://cdn.sheetjs.com/advisories/CVE-2023-30533 dan https://cdn.sheetjs.com/advisories/CVE-2024-22363.
