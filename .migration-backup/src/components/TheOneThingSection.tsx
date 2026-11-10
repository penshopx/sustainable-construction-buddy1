import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ArrowRight, CheckCircle, ClipboardCheck, GraduationCap, Wrench,
  BarChart3, Shield, FileText, Building2, ShoppingBag, Bot,
  Award, Lightbulb, BookCheck, Zap,
} from "lucide-react";

const pillars = [
  { icon: ClipboardCheck, title: "Assessment & Pre-test", desc: "Tentukan level kompetensi personil secara digital & objektif" },
  { icon: GraduationCap, title: "Pusat Pembelajaran PUB", desc: "Pembelajaran terstruktur per level dari Pemula hingga Utama" },
  { icon: Wrench, title: "Mini Apps & Generator", desc: "Risk Register, Budget Tracker, K3 Checklist, dan tools lainnya" },
  { icon: BarChart3, title: "Kinerja & Grading", desc: "Scoring otomatis empat pilar kinerja dengan grade terverifikasi" },
  { icon: Shield, title: "SMAP, PANCEK, & K3", desc: "Sistem Anti Penyuapan, Panduan Cegah Korupsi, dan manajemen K3" },
  { icon: FileText, title: "Persiapan LKUT", desc: "Siapkan dokumen dan data untuk aplikasi LKUT resmi" },
  { icon: Building2, title: "Direktori BUJK", desc: "Profil perusahaan & jaringan antar BUJK se-Indonesia" },
  { icon: Bot, title: "AI Mentor", desc: "Konsultan AI untuk manajemen konstruksi kapan saja" },
  { icon: Award, title: "Sertifikat Digital", desc: "Bukti kompetensi terverifikasi untuk portofolio profesional" },
  { icon: Lightbulb, title: "Inovasi PUB", desc: "Dari tender intelligence hingga ESG — semua dalam satu roadmap" },
  { icon: ShoppingBag, title: "Marketplace", desc: "Jual beli template, tools, dan produk digital konstruksi" },
  { icon: BookCheck, title: "Compliance Tracker", desc: "Monitor kepatuhan regulasi dan sertifikasi real-time" },
];

const pubPrograms = [
  "Peningkatan kualitas manajemen BUJK secara terstruktur",
  "Penyiapan dokumen dan data LKUT sebelum batas pelaporan",
  "Penilaian PANCEK dan penerapan SMAP terintegrasi",
  "Workshop, webinar, dan belajar mandiri berbasis modul",
  "Sesi SIAP PUB yang terhubung dengan platform pembelajaran Konstruksi AI",
  "Kegiatan kolaborasi antar anggota ASPEKINDO",
  "Dokumentasi bukti PUB untuk perpanjangan SBU",
];

const TheOneThingSection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-24 bg-muted/30">
      <div className="container mx-auto px-6">
        {/* AIDA: Desire — positioning */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 mb-5">
            <div className="w-14 h-14 rounded-xl bg-pub-amber/15 flex items-center justify-center">
              <Zap className="w-7 h-7 text-pub-amber" />
            </div>
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold font-heading text-foreground leading-tight">
            Satu Platform.{" "}
            <span className="text-gradient-hero">Semua Solusi.</span>
          </h2>
          <p className="text-lg text-muted-foreground mt-4 max-w-3xl mx-auto font-body leading-relaxed">
            PUB ASPEKINDO mengintegrasikan assessment, pembelajaran, toolkit, grading, compliance, dan inovasi
            dalam satu ekosistem digital — dirancang khusus untuk BUJK Indonesia.
          </p>
        </motion.div>

        {/* Before vs After */}
        <div className="grid md:grid-cols-2 gap-6 mb-16 max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="p-6 rounded-xl bg-destructive/5 border border-destructive/15"
          >
            <h3 className="text-lg font-bold font-heading text-destructive mb-4">❌ Tanpa PUB ASPEKINDO</h3>
            <ul className="space-y-3 text-sm text-muted-foreground font-body">
              {[
                "Dokumen berserakan, tidak terorganisir",
                "Tidak ada bukti PUB untuk perpanjangan SBU",
                "Kompetensi personil tidak terukur",
                "Grading kinerja manual & subjektif",
                "Sulit bersaing di tender, rentan gagal audit",
                "Biaya operasional tinggi tanpa efisiensi sistem",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="text-destructive mt-0.5">✗</span>
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="p-6 rounded-xl bg-pub-emerald/5 border border-pub-emerald/15"
          >
            <h3 className="text-lg font-bold font-heading text-pub-emerald mb-4">✅ Dengan PUB ASPEKINDO</h3>
            <ul className="space-y-3 text-sm text-muted-foreground font-body">
              {[
                "Semua dokumen terpusat di satu dashboard",
                "Bukti PUB otomatis terdokumentasi",
                "Level kompetensi terukur dan terverifikasi",
                "Grading kinerja otomatis dan objektif",
                "Siap audit, kompetitif di tender",
                "Operasional lebih efisien dan profesional",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <CheckCircle className="w-4 h-4 text-pub-emerald shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </motion.div>
        </div>

        {/* Feature grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-16">
          {pillars.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              className="p-4 rounded-xl bg-card border border-border shadow-card hover:shadow-card-hover transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-pub-amber/10 flex items-center justify-center mb-3 group-hover:bg-pub-amber/20 transition-colors">
                <f.icon className="w-5 h-5 text-pub-amber" />
              </div>
              <h3 className="text-sm font-bold font-heading text-foreground mb-1">{f.title}</h3>
              <p className="text-xs text-muted-foreground font-body leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        {/* Program PUB */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-16 p-8 rounded-2xl bg-gradient-to-br from-pub-amber/10 to-pub-amber/5 border border-pub-amber/20"
        >
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <span className="inline-block px-3 py-1 rounded-full bg-pub-amber/15 text-pub-amber text-xs font-semibold font-heading uppercase tracking-wider mb-3">
                Program PUB ASPEKINDO
              </span>
              <h3 className="text-2xl md:text-3xl font-bold font-heading text-foreground mb-3">
                Membangun BUJK yang Lebih Berkualitas
              </h3>
              <p className="text-muted-foreground font-body leading-relaxed">
                Program PUB dirancang untuk membantu BUJK memenuhi seluruh kewajiban regulasi sekaligus 
                meningkatkan kapasitas manajerial secara berkelanjutan melalui berbagai kegiatan terstruktur.
              </p>
            </div>
            <ul className="space-y-3">
              {pubPrograms.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-foreground font-body">
                  <CheckCircle className="w-4 h-4 text-pub-amber shrink-0 mt-0.5" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>

        {/* CTA */}
        <div className="text-center">
          <button
            onClick={() => navigate("/auth")}
            className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl bg-gradient-amber text-accent-foreground font-bold font-heading shadow-amber hover:brightness-110 transition-all"
          >
            Bergabung & Jadilah Kontraktor Berdaya Saing <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-xs text-muted-foreground mt-3 font-body">Platform resmi ASPEKINDO untuk personil manajerial BUJK Indonesia.</p>
        </div>
      </div>
    </section>
  );
};

export default TheOneThingSection;
