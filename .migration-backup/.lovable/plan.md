
## Perbaikan Landing Page Hero Section

### Masalah
1. Sisi kanan hero section kosong -- semua konten menumpuk di kiri (`max-w-3xl`)
2. Tidak ada logo PUB, ASPEKINDO, dan LSBUKI di atas judul

### Rencana Perubahan

**File: `src/components/HeroSection.tsx`**

1. **Tambahkan 3 logo sejajar di atas judul "Pengembangan Usaha Berkelanjutan"**
   - Import `logo-pub.png`, `logo-aspekindo.jpg`, `logo-lsbuki.webp` dari `src/assets`
   - Tampilkan ketiganya dalam satu baris (flex row) dengan ukuran seragam (sekitar h-14), diberi background putih/semi-transparan dan rounded agar terlihat rapi di atas background gelap
   - Gantikan badge "ASPEKINDO -- Bidang Konstruksi" dengan deretan logo ini

2. **Ubah layout menjadi 2 kolom (kiri: teks, kanan: visual)**
   - Ubah container dari `max-w-3xl` menjadi grid 2 kolom (`grid md:grid-cols-2`)
   - Kolom kiri: tetap berisi logo, judul, deskripsi, tombol, dan stats
   - Kolom kanan: tambahkan mockup/screenshot aplikasi dashboard sebagai visual. Akan menggunakan image generation untuk membuat mockup visual yang menunjukkan tampilan dashboard/assessment aplikasi, lalu ditampilkan dengan efek floating/shadow agar terlihat profesional

3. **Responsive**: Di mobile, layout tetap 1 kolom (gambar kanan tersembunyi atau di bawah teks)

### Detail Teknis

- Logo di-import sebagai ES6 module dari `@/assets/`
- Gambar sisi kanan akan di-generate menggunakan AI image generation (mockup dashboard) dan disimpan ke `src/assets/`
- Animasi framer-motion ditambahkan untuk gambar kanan (fade-in dari kanan)
- Badge "ASPEKINDO -- Bidang Konstruksi" tetap dipertahankan, dipindah ke bawah deretan logo
