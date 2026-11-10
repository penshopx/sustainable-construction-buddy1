import { motion } from "framer-motion";
import { FileWarning, TrendingDown, Globe, CheckCircle, Users, Building2 } from "lucide-react";

const problems = [
  {
    icon: FileWarning,
    title: "Perubahan Regulasi yang Terus Bergulir",
    detail: "Regulasi jasa konstruksi terus diperbarui — mulai dari UU Jasa Konstruksi, PP 14/2021, hingga Permen PU terbaru. BUJK dituntut selalu mengikuti perubahan, memperbarui dokumen, dan menyesuaikan sistem manajemen secara berkala. Tanpa pendampingan, kepatuhan regulasi menjadi beban yang melelahkan.",
    solutions: [
      "Pantau update regulasi secara terstruktur",
      "Gunakan Compliance Tracker digital",
      "Ikuti webinar & workshop regulasi ASPEKINDO",
    ],
  },
  {
    icon: TrendingDown,
    title: "Pemenuhan Persyaratan SBU yang Semakin Berat",
    detail: "Perpanjangan Sertifikat Badan Usaha (SBU) kini mensyaratkan bukti pelaksanaan PUB, laporan LKUT, penilaian PANCEK, penerapan SMAP, dan kinerja K3 yang terdokumentasi. Banyak BUJK kesulitan memenuhi semua syarat ini karena tidak ada sistem yang mengintegrasikannya secara menyeluruh.",
    solutions: [
      "Lengkapi LKUT digital secara sistematis",
      "Jalani PANCEK & SMAP dengan panduan platform",
      "Dokumentasikan bukti PUB secara otomatis",
    ],
  },
  {
    icon: Globe,
    title: "Proyek Makin Sulit Didapatkan",
    detail: "Program efisiensi anggaran pemerintah, ketidakpastian geopolitik global, kenaikan harga material bangunan, dan persyaratan tender yang semakin ketat membuat BUJK harus bekerja lebih cerdas. BUJK yang tidak memiliki rekam jejak kompetensi terukur akan semakin tersisih dari persaingan.",
    solutions: [
      "Bangun profil kompetensi BUJK yang terverifikasi",
      "Tingkatkan grading kinerja untuk unggul di tender",
      "Jalin kolaborasi sesama anggota ASPEKINDO",
    ],
  },
];

const roles = [
  {
    icon: Users,
    title: "Peran Asosiasi",
    desc: "ASPEKINDO hadir mendampingi anggota secara langsung — mulai dari advokasi regulasi, fasilitasi pelatihan, hingga penghubung antar BUJK se-Indonesia.",
  },
  {
    icon: Building2,
    title: "Solusi Mandiri BUJK",
    desc: "Dengan tools digital PUB ASPEKINDO, setiap BUJK dapat mengelola kepatuhan, kompetensi, dan dokumentasi secara mandiri — kapan saja, di mana saja.",
  },
];

const IndustryProblemSection = () => {
  return (
    <section id="masalah-industri" className="py-20 bg-background">
      <div className="container mx-auto px-6">
        {/* AIDA: Interest — section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold font-heading mb-3">
            TANTANGAN UTAMA BUJK
          </span>
          <h2 className="text-3xl md:text-4xl font-bold font-heading text-foreground mt-2">
            Tiga Tekanan Besar yang Dihadapi{" "}
            <span className="text-destructive">BUJK Hari Ini</span>
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto font-body">
            Memahami akar masalah adalah langkah pertama menuju solusi yang tepat.
          </p>
        </motion.div>

        {/* Problem cards */}
        <div className="space-y-6 mb-20">
          {problems.map((p, i) => (
            <motion.div
              key={p.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-6 rounded-xl bg-card border border-border shadow-card"
            >
              <div className="grid md:grid-cols-2 gap-6">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 rounded-xl bg-destructive/10 flex items-center justify-center shrink-0">
                    <p.icon className="w-7 h-7 text-destructive" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold font-heading text-foreground mb-2">{p.title}</h3>
                    <p className="text-sm text-muted-foreground font-body leading-relaxed">{p.detail}</p>
                  </div>
                </div>
                <div className="md:border-l md:border-border md:pl-6">
                  <p className="text-xs font-semibold text-pub-amber uppercase tracking-wider mb-3 font-heading">Langkah Mandiri yang Bisa Dilakukan</p>
                  <ul className="space-y-2">
                    {p.solutions.map((s) => (
                      <li key={s} className="flex items-start gap-2 text-sm text-foreground font-body">
                        <CheckCircle className="w-4 h-4 text-pub-amber shrink-0 mt-0.5" />
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Peran Asosiasi & Mandiri */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-8"
        >
          <h3 className="text-2xl md:text-3xl font-bold font-heading text-foreground">
            Tidak Harus Berjuang Sendiri
          </h3>
          <p className="text-muted-foreground mt-2 max-w-xl mx-auto font-body">
            ASPEKINDO dan platform PUB hadir sebagai ekosistem pendukung yang lengkap.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {roles.map((r, i) => (
            <motion.div
              key={r.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-6 rounded-xl bg-pub-amber/5 border border-pub-amber/20 text-center"
            >
              <div className="w-12 h-12 rounded-xl bg-pub-amber/15 flex items-center justify-center mx-auto mb-4">
                <r.icon className="w-6 h-6 text-pub-amber" />
              </div>
              <h4 className="text-lg font-bold font-heading text-foreground mb-2">{r.title}</h4>
              <p className="text-sm text-muted-foreground font-body leading-relaxed">{r.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default IndustryProblemSection;
