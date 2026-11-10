export type ClinicTopicGroup = "business" | "professional";

export type ClinicTopicId =
  | "sbu" | "lsbu-abu" | "pub-lkut" | "perizinan" | "tender" | "kontraktor" | "konsultan" | "suplai"
  | "pelaksanaan-proyek" | "brain-project" | "personel-manajerial" | "smap" | "pancek"
  | "uji-kompetensi" | "skk" | "skk-k3" | "bimtek" | "pkb" | "askom" | "lisensi-bnsp" | "akreditasi-kan" | "ajj-nirkertas";

export interface ClinicTopic {
  id: ClinicTopicId;
  number: string;
  name: string;
  short: string;
  group: ClinicTopicGroup;
  description: string;
  starters: string[];
  persona: string;
}

export const CLINIC_GROUP_LABEL: Record<ClinicTopicGroup, string> = {
  business: "Badan Usaha & Perizinan",
  professional: "Profesi & Kompetensi",
};

const GUARD =
  "Jawab dalam Bahasa Indonesia yang ringkas dan terstruktur. Anda adalah pendamping persiapan di Klinik Konsultasi PUB ASPEKINDO, bukan lembaga sertifikasi, asesor, regulator, atau pemberi lisensi. " +
  "Jangan pernah menyatakan kelulusan, penerbitan sertifikat, akreditasi, lisensi, atau keputusan resmi. Bila regulasi bisa berubah, sarankan pengguna memverifikasi ke sumber resmi terbaru. " +
  "Jika informasi pengguna kurang, ajukan pertanyaan klarifikasi. Jangan meminta kata sandi, token, atau data pribadi sensitif.";

function desk(
  id: ClinicTopicId, n: number, name: string, short: string, group: ClinicTopicGroup,
  description: string, focus: string, starters: string[],
): ClinicTopic {
  return {
    id, number: String(n).padStart(2, "0"), name, short, group, description, starters,
    persona: `Peran: pendamping loket "${name}". Fokus: ${focus}. ${GUARD}`,
  };
}

export const CLINIC_TOPICS: readonly ClinicTopic[] = [
  desk("sbu", 1, "Loket SBU", "SBU", "business", "Sertifikat Badan Usaha (BUJK): klasifikasi, subklasifikasi, kualifikasi, dan kesiapan berkas.",
    "persyaratan dan kesiapan berkas Sertifikat Badan Usaha jasa konstruksi, klasifikasi/subklasifikasi, kualifikasi kecil-menengah-besar, perpanjangan dan perubahan data",
    ["Apa saja berkas yang biasanya disiapkan untuk perpanjangan SBU kualifikasi kecil?", "Bagaimana memilih subklasifikasi yang sesuai dengan pengalaman pekerjaan kami?", "Apa beda kualifikasi kecil, menengah, dan besar dari sisi persyaratan?"]),
  desk("lsbu-abu", 2, "Loket LSBU / ABU", "LSBU / ABU", "business", "Asesmen badan usaha dan peran Lembaga Sertifikasi Badan Usaha.",
    "alur asesmen badan usaha, peran LSBU, persiapan verifikasi dan klarifikasi dokumen",
    ["Bagaimana alur umum asesmen badan usaha oleh LSBU?", "Dokumen apa yang sering diminta klarifikasi saat asesmen?", "Bagaimana menyiapkan tim untuk verifikasi lapangan?"]),
  desk("pub-lkut", 3, "Loket PUB (LKUT)", "PUB / LKUT", "business", "Pengembangan Usaha Berkelanjutan dan Laporan Kegiatan Usaha Tahunan.",
    "Pengembangan Usaha Berkelanjutan, penyusunan dan kelengkapan LKUT, pemanfaatan data LKUT untuk perbaikan kinerja BUJK",
    ["Apa saja isi pokok LKUT dan data apa yang perlu dikumpulkan sepanjang tahun?", "Bagaimana PUB membantu BUJK naik kualifikasi secara bertahap?", "Kesalahan umum apa yang sering terjadi saat menyusun LKUT?"]),
  desk("perizinan", 4, "Loket Perizinan (OSS)", "Perizinan OSS", "business", "NIB, perizinan berusaha, dan alur OSS berbasis risiko.",
    "NIB, KBLI jasa konstruksi, perizinan berusaha berbasis risiko melalui OSS, keterkaitan izin dengan SBU",
    ["Bagaimana kaitan KBLI di NIB dengan subklasifikasi SBU?", "Apa langkah umum memperbarui data perusahaan di OSS?", "Apa yang perlu dicek bila KBLI tidak sesuai dengan kegiatan usaha?"]),
  desk("tender", 5, "Loket Tender", "Tender", "business", "Syarat kualifikasi, dokumen penawaran, dan strategi mengikuti tender.",
    "persiapan dokumen kualifikasi dan penawaran, membaca dokumen pemilihan, strategi harga dan teknis, sanggahan yang wajar",
    ["Bagaimana membuat daftar periksa dokumen kualifikasi sebelum mengunggah penawaran?", "Apa penyebab umum penawaran gugur di evaluasi administrasi?", "Bagaimana menyusun metode pelaksanaan yang meyakinkan?"]),
  desk("kontraktor", 6, "Loket Kontraktor", "Kontraktor", "business", "Operasional BUJK pelaksana dan intelijen usaha.",
    "operasional BUJK pelaksana konstruksi, manajemen arus kas, kemitraan, pemetaan peluang pasar",
    ["Bagaimana BUJK kecil mengelola arus kas antar termin pembayaran?", "Indikator apa yang perlu dipantau untuk kesehatan usaha kontraktor?", "Bagaimana memetakan peluang pekerjaan di daerah kami?"]),
  desk("konsultan", 7, "Loket Konsultan", "Konsultan", "business", "Perencanaan, pengawasan, dan desain untuk konsultan konstruksi.",
    "jasa konsultansi konstruksi: perencanaan, pengawasan, manajemen konstruksi, penyusunan KAK dan laporan",
    ["Bagaimana menyusun laporan pengawasan mingguan yang baik?", "Apa yang perlu dicermati dalam KAK sebelum menyusun proposal teknis?", "Bagaimana mengelola perubahan desain selama pelaksanaan?"]),
  desk("suplai", 8, "Loket Suplier", "Suplier", "business", "Rantai pasok dan pasokan material konstruksi.",
    "rantai pasok konstruksi, pengadaan material, kontrak pemasok, pengendalian mutu material",
    ["Bagaimana menyusun kriteria evaluasi pemasok material?", "Apa risiko rantai pasok yang paling sering mengganggu jadwal proyek?", "Klausul apa yang penting dalam kontrak pemasokan material?"]),
  desk("pelaksanaan-proyek", 9, "Loket Pelaksanaan Proyek", "Pelaksanaan Proyek", "business", "EVM, K3, laporan harian, klaim, hingga serah terima.",
    "pengendalian pelaksanaan proyek: earned value, laporan harian/mingguan, K3 lapangan, perubahan pekerjaan, klaim, serah terima",
    ["Bagaimana membaca SPI dan CPI dari data progres proyek?", "Apa isi minimal laporan harian proyek?", "Bagaimana menyiapkan dokumen serah terima pertama (PHO)?"]),
  desk("brain-project", 10, "Loket Brain Project", "Brain Project", "business", "Pendamping analisis proyek: LHP, EVM, NCR, K3, dan klaim berbasis kontrak.",
    "analisis mendalam proyek: laporan hasil pemeriksaan, earned value, non-conformance report, K3, klaim berdasarkan klausul kontrak termasuk kerangka FIDIC",
    ["Bantu saya menyusun struktur NCR untuk pekerjaan beton yang tidak sesuai spesifikasi.", "Bagaimana logika menyusun klaim perpanjangan waktu?", "Langkah analisis keterlambatan proyek yang sistematis seperti apa?"]),
  desk("personel-manajerial", 11, "Loket Personel Manajerial (PJBU)", "Personel Manajerial", "business", "PJBU, PJTBU, PJKBU, dan PJSKBU pada BUJK.",
    "persyaratan dan peran personel manajerial BUJK: PJBU, PJTBU, PJKBU, PJSKBU, kesesuaian SKK dengan subklasifikasi",
    ["Apa perbedaan peran PJTBU dan PJSKBU?", "Bagaimana memastikan SKK personel sesuai subklasifikasi SBU?", "Apa yang terjadi bila PJSKBU keluar dari perusahaan?"]),
  desk("smap", 12, "Loket SMAP", "SMAP", "business", "ISO 37001 dan sistem manajemen anti-penyuapan.",
    "Sistem Manajemen Anti Penyuapan ISO 37001: penilaian risiko penyuapan, uji tuntas, kebijakan, audit internal",
    ["Bagaimana memulai penilaian risiko penyuapan di BUJK kecil?", "Dokumen apa saja yang biasanya ada dalam SMAP?", "Bagaimana melakukan uji tuntas terhadap mitra usaha?"]),
  desk("pancek", 13, "Loket PanCEK", "PanCEK", "business", "Integritas dan pencegahan korupsi bagi badan usaha.",
    "Panduan Cegah Korupsi (PanCEK) untuk badan usaha: komitmen pimpinan, kebijakan gratifikasi, benturan kepentingan, saluran pelaporan",
    ["Apa saja elemen penilaian mandiri PanCEK?", "Bagaimana menyusun kebijakan gratifikasi yang praktis?", "Bagaimana membangun saluran pelaporan pelanggaran yang aman?"]),
  desk("uji-kompetensi", 14, "Loket Klinik Uji Kompetensi", "Uji Kompetensi", "professional", "Peta jalan persiapan uji kompetensi dari awal hingga kesiapan.",
    "peta jalan persiapan uji kompetensi kerja konstruksi: memilih skema, memetakan unit kompetensi, menyiapkan portofolio, latihan wawancara",
    ["Bagaimana memetakan kesiapan saya terhadap unit kompetensi suatu skema?", "Portofolio seperti apa yang biasanya relevan sebagai bukti?", "Bagaimana berlatih untuk sesi wawancara asesmen?"]),
  desk("skk", 15, "Loket SKK", "SKK", "professional", "Sertifikat Kompetensi Kerja: jenjang dan bidang jasa konstruksi.",
    "Sertifikat Kompetensi Kerja konstruksi: jenjang KKNI, jabatan kerja, persyaratan pendidikan dan pengalaman, perpanjangan",
    ["Bagaimana menentukan jenjang SKK yang sesuai dengan pengalaman saya?", "Apa beda SKK operator, teknisi, dan ahli?", "Apa yang perlu disiapkan untuk perpanjangan SKK?"]),
  desk("skk-k3", 16, "Loket SKK K3", "SKK K3", "professional", "SKK Ahli K3 Konstruksi, SMK3, dan ISO 45001.",
    "K3 konstruksi: SKK Ahli K3 Konstruksi, SMKK, SMK3, ISO 45001, identifikasi bahaya dan pengendalian risiko",
    ["Apa isi pokok Rencana Keselamatan Konstruksi (RKK)?", "Bagaimana menyusun IBPRP untuk pekerjaan galian?", "Apa hubungan SMKK dengan ISO 45001?"]),
  desk("bimtek", 17, "Loket Bimtek Uji Kompetensi", "Bimtek", "professional", "Latihan dan simulasi persiapan uji kompetensi SKK.",
    "latihan soal dan simulasi persiapan uji kompetensi; berikan soal latihan, umpan balik, dan materi ulang tanpa menjanjikan kelulusan",
    ["Beri saya 5 soal latihan tentang manajemen mutu proyek beserta pembahasannya.", "Simulasikan pertanyaan wawancara asesor untuk jabatan pelaksana lapangan.", "Susun jadwal belajar 2 minggu sebelum uji kompetensi."]),
  desk("pkb", 18, "Loket PKB", "PKB", "professional", "Pengembangan Keprofesian Berkelanjutan bagi tenaga kerja konstruksi.",
    "Pengembangan Keprofesian Berkelanjutan: jenis kegiatan, pencatatan, perencanaan pengembangan diri tenaga ahli",
    ["Kegiatan apa saja yang umumnya diakui sebagai PKB?", "Bagaimana mencatat kegiatan PKB secara rapi?", "Bantu saya menyusun rencana PKB satu tahun."]),
  desk("askom", 19, "Loket ASKOM", "ASKOM", "professional", "Asesor kompetensi dan proses uji kompetensi SKK.",
    "peran asesor kompetensi, prinsip asesmen (valid, reliabel, fleksibel, adil), perangkat asesmen, proses uji",
    ["Apa saja prinsip asesmen yang harus dipegang asesor?", "Bagaimana alur umum menjadi asesor kompetensi?", "Apa isi perangkat asesmen yang baik?"]),
  desk("lisensi-bnsp", 20, "Loket Lisensi BNSP", "Lisensi BNSP", "professional", "Lisensi dan manajemen LSP.",
    "manajemen Lembaga Sertifikasi Profesi, persiapan lisensi, dokumen mutu LSP, surveilan",
    ["Dokumen mutu apa saja yang lazim dimiliki LSP?", "Bagaimana menyiapkan diri untuk surveilan LSP?", "Apa peran Tempat Uji Kompetensi (TUK) dalam LSP?"]),
  desk("akreditasi-kan", 21, "Loket Akreditasi KAN", "Akreditasi KAN", "professional", "Akreditasi lembaga penilaian kesesuaian.",
    "akreditasi lembaga penilaian kesesuaian: standar ISO/IEC 17000-series, sistem mutu, audit internal, tinjauan manajemen",
    ["Apa perbedaan ISO/IEC 17024 dan ISO/IEC 17065?", "Bagaimana menyiapkan audit internal sebelum asesmen akreditasi?", "Apa saja isi tinjauan manajemen yang baik?"]),
  desk("ajj-nirkertas", 22, "Loket AJJ Nirkertas", "AJJ Nirkertas", "professional", "Asesmen jarak jauh dan proses tanpa kertas.",
    "asesmen jarak jauh dan proses nirkertas: kesiapan perangkat, keamanan identitas, rekaman bukti, etika pelaksanaan",
    ["Apa yang perlu disiapkan peserta untuk asesmen jarak jauh?", "Bagaimana menjaga keamanan identitas pada asesmen daring?", "Bukti digital seperti apa yang rapi untuk proses nirkertas?"]),
];

const BY_ID = new Map<string, ClinicTopic>(CLINIC_TOPICS.map(t => [t.id, t]));

export function getClinicTopic(id: string | undefined | null): ClinicTopic | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export const CLINIC_PREP_TOOLS: { label: string; href: string; note: string }[] = [
  { label: "Simulator Kesiapan SBU", href: "/simulator-sbu", note: "Cek kesiapan berkas badan usaha" },
  { label: "Data LKUT", href: "/lkut", note: "Susun laporan kegiatan tahunan" },
  { label: "Compliance Tracker", href: "/compliance", note: "Pantau kewajiban dan tenggat" },
  { label: "LMS ASPEKINDO", href: "/aspekindo-lms", note: "Belajar materi pendukung" },
  { label: "Program & Kegiatan", href: "/program-kegiatan", note: "Ikuti bimtek dan agenda PUB" },
  { label: "Ruang Simpan", href: "/ruang-simpan/", note: "Rapikan dokumen dan profil usaha" },
];
