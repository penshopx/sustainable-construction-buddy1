---
name: Benturan ekspor badan inline Orval
description: Skema bernama mencegah nama tipe request bertabrakan dengan ekspor validator Zod.
---

Gunakan skema komponen bernama untuk badan request objek OpenAPI, lalu referensikan dengan $ref.

**Why:** Objek badan inline dapat menghasilkan tipe dan validator Zod dengan nama OperationBody yang sama, sehingga barrel yang mengekspor keduanya gagal dengan TS2308.

**How to apply:** Jika codegen berhasil tetapi pemeriksaan pustaka gagal karena ekspor ganda, pindahkan skema input inline ke components/schemas dan jalankan codegen ulang; jangan mengedit hasil generator.
