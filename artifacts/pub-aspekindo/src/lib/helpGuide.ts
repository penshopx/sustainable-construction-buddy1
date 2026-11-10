export type HelpSectionId =
  | "mulai"
  | "akun"
  | "dashboard"
  | "assessment"
  | "belajar"
  | "empat-siap"
  | "proyek"
  | "lkut"
  | "smap-pancek"
  | "layanan"
  | "integrasi"
  | "masalah";

export type HelpSection = {
  id: HelpSectionId;
  title: string;
  description: string;
  steps: string[];
  note?: string;
  marker?: "internal" | "ecosystem" | "official" | "roadmap";
};

export const helpSections: HelpSection[] = [
  {
    id: "mulai",
    title: "Mulai menggunakan PUB",
    description: "Jalur singkat untuk anggota yang baru pertama kali menggunakan aplikasi.",
    steps: [
      "Lengkapi Profil Saya dan periksa data perusahaan serta jabatan.",
      "Kerjakan Pre-test Assessment untuk memperoleh gambaran kemampuan awal.",
      "Buka Dashboard dan Peta Kompetensi 4 SIAP untuk memilih satu prioritas.",
      "Selesaikan satu modul sampai tersimpan sebelum beralih ke modul berikutnya.",
    ],
    marker: "internal",
  },
  {
    id: "akun",
    title: "Akun dan Profil Saya",
    description: "Pastikan identitas yang dipakai pada modul-modul PUB sudah benar.",
    steps: [
      "Buka Profil Saya.",
      "Periksa nama dan email, lalu isi perusahaan, kualifikasi BUJK, dan jabatan.",
      "Tekan Simpan Profil dan tunggu pesan berhasil.",
      "Jika lupa kata sandi, gunakan Lupa password? pada halaman masuk.",
    ],
    note: "Jika ada peringatan konflik rangkap jabatan, perbaiki pembagian peran sesuai ketentuan organisasi.",
    marker: "internal",
  },
  {
    id: "dashboard",
    title: "Membaca Dashboard",
    description: "Dashboard merangkum data yang sudah tersimpan. Angka nol dapat berarti data belum diisi.",
    steps: [
      "Periksa level kompetensi, proyek aktif, progres belajar, risiko, anggaran, PANCEK, dan LKUT.",
      "Pilih kartu yang perlu ditindaklanjuti untuk membuka modul sumber.",
      "Lengkapi dan simpan data pada modul sumber, lalu kembali ke Dashboard.",
    ],
    note: "Dashboard adalah alat bantu internal, bukan validator atau keputusan resmi.",
    marker: "internal",
  },
  {
    id: "assessment",
    title: "Pre-test Assessment",
    description: "Assessment memetakan kemampuan awal; hasilnya bukan sertifikasi atau kelulusan profesi.",
    steps: [
      "Tekan Mulai Assessment dan jawab seluruh soal.",
      "Gunakan Sebelumnya dan Selanjutnya untuk memeriksa jawaban.",
      "Buka Review Jawaban, pastikan semua soal terisi, lalu selesaikan.",
      "Periksa skor, level, dan riwayat hasil.",
    ],
    note: "Jika riwayat gagal dimuat, jangan langsung mengulang. Muat ulang halaman dan pastikan hasil terakhir sudah muncul.",
    marker: "internal",
  },
  {
    id: "belajar",
    title: "Pembelajaran, LMS, dan sertifikat",
    description: "Pilih kursus atau kegiatan sesuai kebutuhan dan pastikan progres tersimpan.",
    steps: [
      "Buka Pusat Pembelajaran PUB atau LMS ASPEKINDO.",
      "Pilih kursus, webinar, seminar, FGD, atau kegiatan yang tersedia.",
      "Buka materi berurutan, kerjakan kuis/evaluasi, dan selesaikan kegiatan.",
      "Periksa progres, bukti kegiatan, atau sertifikat pada akun Anda.",
    ],
    note: "Sertifikat PUB mencatat pembelajaran dalam ekosistem. Pengakuan eksternal mengikuti ketentuan pihak yang menilai.",
    marker: "internal",
  },
  {
    id: "empat-siap",
    title: "Peta Kompetensi 4 SIAP",
    description: "Baca kesiapan Legalitas, Sertifikasi, Tender, dan Proyek berdasarkan data yang tersedia.",
    steps: [
      "Bedakan Coverage (kelengkapan data) dan Skor (hasil evaluasi data).",
      "Buka indikator atau sumber bukti untuk melihat data yang kurang.",
      "Ikuti tautan tindakan dan lengkapi data pada modul sumber.",
      "Kembali ke peta lalu tekan Perbarui.",
    ],
    note: "Data tidak diisi langsung di halaman 4 SIAP. Skor adalah petunjuk perbaikan, bukan persetujuan resmi.",
    marker: "internal",
  },
  {
    id: "proyek",
    title: "Proyek, risiko, anggaran, dan K3",
    description: "Gunakan proyek yang sama agar hubungan data operasional mudah dibaca.",
    steps: [
      "Buat proyek di Project Workspace dan lengkapi identitas, nilai, periode, serta status.",
      "Catat risiko, probabilitas, dampak, PIC, dan mitigasi di Risk Register.",
      "Isi nilai rencana dan aktual di Budget Tracker; tindak lanjuti deviasi.",
      "Buat inspeksi K3, jawab checklist, lalu simpan atau submit hasilnya.",
      "Gunakan Brain Project untuk menyiapkan fakta dan menganalisis angka proyek, atau Konsultasi terpandu untuk menyusun rencana tindak bertahap. Periksa jawaban AI sebelum mengambil keputusan.",
    ],
    marker: "internal",
  },
  {
    id: "lkut",
    title: "Data dan kesiapan LKUT",
    description: "Pelihara data LKUT sepanjang tahun dan simpan draft secara berkala.",
    steps: [
      "Buat LKUT untuk tahun yang dipilih; satu tahun hanya memiliki satu laporan.",
      "Lengkapi data SBU, pengalaman, keuangan, SDM, sertifikasi, dan penghargaan.",
      "Periksa kelengkapan dan gunakan ekspor sebagai bahan pemeriksaan internal.",
      "Lakukan pengiriman resmi melalui sistem pemerintah yang ditentukan.",
    ],
    note: "Status submitted di PUB tidak berarti laporan otomatis masuk atau diterima di SIJK/SIJKT.",
    marker: "official",
  },
  {
    id: "smap-pancek",
    title: "SMAP dan PANCEK",
    description: "Lengkapi tata kelola dan bukti pendukung sebelum melakukan submit.",
    steps: [
      "Pada SMAP, pilih bagian yang diperlukan, isi data, unggah bukti, lalu simpan.",
      "Pada PANCEK, mulai dari Simulasi Trial bila belum siap mengisi Form Resmi.",
      "Isi identitas dan indikator enam pilar, lalu Simpan Draft.",
      "Setelah minimal 50% terisi, periksa kembali sebelum submit untuk verifikasi asosiasi.",
    ],
    note: "PANCEK yang sudah disubmit atau diverifikasi menjadi hanya-baca.",
    marker: "internal",
  },
  {
    id: "layanan",
    title: "Informasi, kegiatan, bantuan, dan bisnis",
    description: "Panduan ringkas untuk fitur pendukung anggota.",
    steps: [
      "Periksa sumber dan tanggal artikel pada Pusat Informasi.",
      "Baca persyaratan dan tautan pendaftaran pada Program & Kegiatan.",
      "Berikan konteks yang jelas saat bertanya kepada Pakar Cerdas.",
      "Pada Bedah Dokumen, masuk lalu unggah atau pilih berkas dari Ruang Simpan. Beri persetujuan AI untuk dokumen terpilih sebelum menjalankan analisis atau bertanya, lalu periksa temuan terhadap dokumen asli.",
      "Pada Klinik Konsultasi, pilih loket sesuai topik dan masuk untuk bertanya. Setujui pengiriman ke AI eksternal; penggunaan acuan Ruang Simpan bersifat opsional dan memerlukan persetujuan terpisah.",
      "Pada Marketplace, periksa detail sebelum memesan; kelola penawaran melalui Produk Saya.",
    ],
    note: "Jawaban bantuan adalah panduan awal, bukan keputusan profesional atau regulator.",
    marker: "internal",
  },
  {
    id: "integrasi",
    title: "Tautan eksternal dan integrasi",
    description: "Kenali batas antara fitur PUB, aplikasi satu ekosistem, dan kanal resmi.",
    steps: [
      "Periksa domain saat tautan membuka tab baru.",
      "Jangan menganggap akun PUB otomatis berlaku di layanan tujuan.",
      "Jangan menganggap data atau dokumen sudah berpindah otomatis.",
      "Selesaikan proses pada layanan tujuan, simpan bukti, lalu perbarui PUB bila diperlukan.",
    ],
    note: "SSO dan sinkronisasi lintas aplikasi masih merupakan integrasi bertahap, bukan fitur yang aktif menyeluruh.",
    marker: "roadmap",
  },
  {
    id: "masalah",
    title: "Jika mengalami masalah",
    description: "Lakukan pemeriksaan dasar sebelum mengulang proses atau meminta bantuan.",
    steps: [
      "Pastikan data sudah disimpan, tunggu sejenak, lalu muat ulang halaman.",
      "Catat nama fitur, langkah terakhir, pesan kesalahan, waktu kejadian, dan perangkat.",
      "Ambil tangkapan layar tanpa kata sandi atau data rahasia.",
      "Gunakan Pakar Cerdas atau kanal bantuan ASPEKINDO dengan informasi tersebut.",
    ],
    marker: "internal",
  },
];

export const contextualHelpRoutes: ReadonlyArray<{
  paths: readonly string[];
  section: HelpSectionId;
}> = [
  { paths: ["/dashboard"], section: "dashboard" },
  { paths: ["/assessment"], section: "assessment" },
  { paths: ["/courses", "/aspekindo-lms", "/aspekindo-aktivitas", "/certificates", "/analytics", "/leaderboard"], section: "belajar" },
  { paths: ["/siap-kompetensi", "/compliance", "/grading", "/simulator-sbu", "/simulator-lkut"], section: "empat-siap" },
  { paths: ["/projects", "/risk-register", "/budget-tracker", "/k3-checklist", "/generator", "/brain-project", "/konsultasi"], section: "proyek" },
  { paths: ["/lkut"], section: "lkut" },
  { paths: ["/smap", "/pancek"], section: "smap-pancek" },
  { paths: ["/profile"], section: "akun" },
  { paths: ["/informasi", "/inovasi", "/program-kegiatan", "/marketplace", "/direktori", "/helpdesk", "/bedah-dokumen", "/klinik-konsultasi", "/pesanan", "/produk-saya", "/notifications", "/mentor"], section: "layanan" },
  { paths: ["/agenda-pub", "/kursus"], section: "belajar" },
];

/**
 * Setiap rute publik di App.tsx harus diklasifikasikan di sini. Rute wajib
 * menyediakan tautan panduan kontekstual; rute bebas adalah halaman utilitas,
 * autentikasi, atau materi presentasi yang tidak menawarkan alur fitur publik.
 */
export const publicHelpRoutePolicy = {
  required: [
    "/informasi",
    "/informasi/:slug",
    "/agenda-pub",
    "/kursus/:slug",
    "/simulator-sbu",
    "/simulator-lkut",
    "/program-kegiatan",
    "/program-kegiatan/:id",
    "/bedah-dokumen",
    "/brain-project",
    "/konsultasi",
    "/klinik-konsultasi",
  ],
  exempt: [
    "/",
    "/auth",
    "/reset-password",
    "/onboarding",
    "/ai-helpdesk",
    "/my-products",
    "/install",
    "/pitch-deck",
    "/video-pub-aspekindo",
    "/helpdesk-standalone",
    "/chatbot/:token",
  ],
} as const;

export function getHelpSectionForPath(pathname: string): HelpSectionId {
  return contextualHelpRoutes.find(({ paths }) =>
    paths.some((path) => pathname === path || pathname.startsWith(`${path}/`)),
  )?.section ?? "mulai";
}

export function getHelpLocationForPath(pathname: string): string {
  const matchedPath = contextualHelpRoutes
    .flatMap(({ paths }) => paths)
    .find((path) => pathname === path || pathname.startsWith(`${path}/`));

  return matchedPath?.slice(1).replaceAll("-", "_") || "other";
}

export function isHelpSectionId(value: string): value is HelpSectionId {
  return helpSections.some(({ id }) => id === value);
}

export function getHelpHrefForPath(pathname: string): string {
  return `/bantuan#${getHelpSectionForPath(pathname)}`;
}

export function getHelpSectionFromHash(hash: string): HelpSectionId {
  const candidate = hash.replace(/^#/, "");
  return isHelpSectionId(candidate) ? candidate : "mulai";
}