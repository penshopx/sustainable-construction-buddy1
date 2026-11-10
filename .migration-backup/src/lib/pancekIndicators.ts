export interface PancekIndicator {
  code: string;
  text: string;
}

export interface PancekPillar {
  id: string;
  label: string;
  icon: string;
  description: string;
  weight: number; // percentage weight (0-100), all pillars sum to 100
  indicators: PancekIndicator[];
}

export const PANCEK_PILLARS: PancekPillar[] = [
  {
    id: "komitmen",
    label: "Komitmen",
    icon: "🤝",
    weight: 25,
    description: "Komitmen tertulis antipenyuapan dari pimpinan korporasi",
    indicators: [
      { code: "K.1.a", text: "Komitmen tertulis antipenyuapan" },
      { code: "K.1.b", text: "Bukti deklarasi komitmen antipenyuapan dan pihak yang menghadiri" },
      { code: "K.1.c", text: "Komunikasi terhadap komitmen tertulis (email, sesi diskusi, dll)" },
      { code: "K.1.d", text: "Bukti komitmen menghasilkan kebijakan antipenyuapan" },
      { code: "K.2.a", text: "Pakta integritas/kontrak kerja (sampel dari level manajer)" },
      { code: "K.2.b", text: "Pakta berisi larangan pemberian uang pelicin/suap" },
      { code: "K.3.a", text: "Kebijakan memiliki definisi korupsi dari berbagai sumber" },
      { code: "K.4.a", text: "Kebijakan antipenyuapan mengacu pada UU Tipikor" },
      { code: "K.5.a", text: "Kebijakan mengandung penjelasan peta rawan korupsi" },
      { code: "K.6.a", text: "Unit/individu menyelenggarakan fungsi kepatuhan" },
      { code: "K.6.b", text: "Surat pengangkatan dan wewenang individu kepatuhan" },
      { code: "K.6.c", text: "SOP unit kepatuhan" },
      { code: "K.6.d", text: "Rasio pegawai kepatuhan vs total pegawai" },
      { code: "K.6.e", text: "Bukti kompetensi individu kepatuhan (sertifikat auditor, CCO, API, SPIP, dll)" },
      { code: "K.7.a", text: "Komitmen tertulis pelaksanaan komunikasi & pelatihan pencegahan korupsi" },
      { code: "K.7.b", text: "Bukti pelaksanaan kegiatan komunikasi & pelatihan (laporan, dokumentasi)" },
      { code: "K.7.c", text: "Bukti evaluasi pelaksanaan kegiatan komunikasi & pelatihan" },
    ],
  },
  {
    id: "perencanaan",
    label: "Perencanaan",
    icon: "📋",
    weight: 10,
    description: "Identifikasi, pemetaan risiko, dan uji tuntas penyuapan",
    indicators: [
      { code: "P.1.a", text: "Fungsi pelaksana identifikasi & pemetaan risiko penyuapan" },
      { code: "P.1.b", text: "Kertas kerja pemetaan risiko (risk register, mitigasi, monev)" },
      { code: "P.1.c", text: "Penentuan tingkat kerawanan risiko" },
      { code: "P.2.a", text: "Penilaian risiko korupsi di semua/beberapa unit" },
      { code: "P.3.a", text: "Penilaian risiko berkala & diperbarui berdasarkan modus korupsi" },
      { code: "P.3.b", text: "Laporan pelaksanaan mitigasi risiko dan risk register yang diperbarui" },
      { code: "P.4.a", text: "Uji tuntas terhadap penilaian risiko korupsi (distributor/vendor/agen)" },
    ],
  },
  {
    id: "pelaksanaan",
    label: "Pelaksanaan",
    icon: "⚙️",
    weight: 25,
    description: "Implementasi kebijakan antipenyuapan pada operasional",
    indicators: [
      { code: "D.1.a", text: "Perjanjian/kontrak antipenyuapan mengikat pihak eksternal" },
      { code: "D.2.a", text: "Perjanjian kerja mencakup pengawasan, sanksi, evaluasi internal" },
      { code: "D.2.b", text: "Klausul antikorupsi pada perjanjian/kontrak pihak eksternal (pengawasan, sanksi, evaluasi)" },
      { code: "D.3.a.1", text: "Pengaturan gratifikasi kepada pegawai negeri" },
      { code: "D.3.a.2", text: "Pengaturan pemberian fasilitas, hadiah, sponsor eksternal" },
      { code: "D.3.a.3", text: "Pengaturan kontribusi dana politik" },
      { code: "D.3.b", text: "Klausul batasan nilai gratifikasi" },
      { code: "D.3.c", text: "Klausul batasan pemberian fasilitas/hadiah eksternal" },
      { code: "D.3.d", text: "Klausul pengaturan kontribusi dana politik" },
      { code: "D.4.a", text: "Kebijakan sistem pencatatan keuangan transparan dan akuntabel" },
      { code: "D.4.b", text: "Pengaturan tentang persetujuan berjenjang dalam transaksi keuangan" },
      { code: "D.5.a", text: "Penetapan pemilik manfaat korporasi kepada instansi berwenang" },
      { code: "D.6.a", text: "Sosialisasi periodik sistem pelaporan & pengaduan" },
      { code: "D.6.b", text: "SOP sistem pelaporan dan pengaduan" },
      { code: "D.6.c", text: "Saluran pelaporan (aplikasi, call centre, SMS, dll)" },
      { code: "D.6.d", text: "Fungsi pelaksana internal/eksternal pengelola pelaporan" },
      { code: "D.6.e", text: "Bukti penanganan berjenjang" },
      { code: "D.6.f", text: "Statistik pelaporan masuk, diselesaikan, dan rekomendasi" },
      { code: "D.6.g", text: "Evaluasi periodik terhadap sistem pelaporan" },
      { code: "D.7.a", text: "Kebijakan program sosialisasi antipenyuapan" },
      { code: "D.7.b", text: "Bukti kegiatan sosialisasi (laporan, dokumentasi)" },
      { code: "D.7.c", text: "Media sosialisasi menjangkau semua pegawai" },
      { code: "D.7.d", text: "Umpan balik pegawai terhadap program antipenyuapan" },
    ],
  },
  {
    id: "evaluasi",
    label: "Evaluasi",
    icon: "📊",
    weight: 15,
    description: "Pemantauan, evaluasi, dan audit peraturan antipenyuapan",
    indicators: [
      { code: "C.1.a", text: "Kebijakan pemantauan & evaluasi peraturan antipenyuapan" },
      { code: "C.1.b", text: "Area evaluasi dan cara pengukuran sudah ditentukan" },
      { code: "C.1.c", text: "Unit pelaksana pemantauan & evaluasi" },
      { code: "C.1.d", text: "Jadwal pemantauan & evaluasi" },
      { code: "C.1.e", text: "Hasil pemantauan dievaluasi bersama dan ada rencana tindak lanjut" },
      { code: "C.2.a", text: "Media komunikasi sistem monev kepada semua pegawai" },
      { code: "C.3.a", text: "Hasil pemantauan disampaikan kepada pimpinan" },
      { code: "C.3.b", text: "Evaluasi efisiensi & efektivitas melalui hasil audit" },
      { code: "C.4.a", text: "Korporasi memiliki piagam audit (audit charter)" },
      { code: "C.4.b", text: "Audit/pemeriksaan internal bersifat independen" },
    ],
  },
  {
    id: "perbaikan",
    label: "Perbaikan",
    icon: "🔧",
    weight: 15,
    description: "Mekanisme sanksi, penghargaan, dan tindak lanjut",
    indicators: [
      { code: "A.1.a", text: "Mekanisme pemberian sanksi pelanggaran antipenyuapan" },
      { code: "A.1.b", text: "Bukti pelaksanaan pemberian sanksi" },
      { code: "A.2.a", text: "Kualifikasi penerima penghargaan bagi pegawai berintegritas" },
      { code: "A.2.b", text: "Mekanisme pemberian penghargaan" },
      { code: "A.2.c", text: "Bukti pelaksanaan pemberian penghargaan" },
      { code: "A.3.a", text: "Perubahan peraturan/SOP berdasarkan evaluasi" },
      { code: "A.3.b", text: "Korporasi telah menentukan sasaran baru pencegahan korupsi" },
    ],
  },
  {
    id: "respon",
    label: "Respon",
    icon: "🚨",
    weight: 10,
    description: "Keanggotaan asosiasi, aksi kolektif, dan pelaporan indikasi tipikor",
    indicators: [
      { code: "R.1.a", text: "Bukti keanggotaan korporasi dalam asosiasi bisnis/perkumpulan profesi" },
      { code: "R.1.b", text: "Asosiasi bisnis/perkumpulan profesi memiliki agenda isu antikorupsi" },
      { code: "R.2.a", text: "Keterlibatan aktif dalam forum komunikasi/kelompok kerja antikorupsi" },
      { code: "R.2.b", text: "Keterlibatan aktif dalam forum lintas sektoral (LSM, akademisi, pemerintah) isu antikorupsi" },
      { code: "R.3.a", text: "SOP pelaporan indikasi tipikor/suap/pemerasan/pungli oleh oknum" },
      { code: "R.3.b", text: "Data statistik pelaporan indikasi tipikor (jika ada)" },
    ],
  },
];

export const TOTAL_INDICATORS = PANCEK_PILLARS.reduce((sum, p) => sum + p.indicators.length, 0);

export function calculatePillarScores(answers: Record<string, boolean>) {
  const scores: Record<string, number> = {};
  for (const pillar of PANCEK_PILLARS) {
    scores[pillar.id] = pillar.indicators.filter(ind => answers[ind.code]).length;
  }
  return scores;
}
