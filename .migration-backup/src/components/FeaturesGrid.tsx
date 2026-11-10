import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ClipboardCheck, GraduationCap, Wrench, BarChart3,
  Shield, FileText, Building2, ShoppingBag, Bot,
  Award, Lightbulb, CheckCircle, ArrowRight,
} from "lucide-react";

const features = [
  { icon: ClipboardCheck, title: "Assessment & Pre-test", desc: "Tentukan level kompetensi personil manajerial secara digital" },
  { icon: GraduationCap, title: "Pusat Pembelajaran PUB", desc: "Pembelajaran terstruktur per level dan domain keahlian" },
  { icon: Wrench, title: "Toolkit Proyek", desc: "Risk Register, Budget Tracker, K3 Checklist, Generator Dokumen" },
  { icon: BarChart3, title: "Kinerja & Grading", desc: "Scoring otomatis 4 pilar dengan grade A–E terverifikasi" },
  { icon: Shield, title: "SMAP & PANCEK", desc: "Sistem Manajemen Anti Penyuapan dan Panduan Cegah Korupsi BUJK" },
  { icon: FileText, title: "LKUT Digital", desc: "Laporan Kegiatan Usaha Tahunan untuk perpanjangan SBU" },
  { icon: Building2, title: "Direktori & Profil BUJK", desc: "Promosi perusahaan dan jaringan antar BUJK se-Indonesia" },
  { icon: ShoppingBag, title: "Marketplace", desc: "Jual beli template, tools, dan produk digital konstruksi" },
  { icon: Bot, title: "AI Mentor & Helpdesk", desc: "Konsultan AI 24/7 untuk manajemen konstruksi" },
  { icon: Award, title: "Sertifikat Digital", desc: "Bukti kompetensi terverifikasi untuk portofolio profesional" },
  { icon: Lightbulb, title: "Inovasi PUB", desc: "8 pilar inovasi dari Green Construction hingga Smart Technology" },
  { icon: CheckCircle, title: "Compliance Tracker", desc: "Monitor kepatuhan regulasi dan sertifikasi secara real-time" },
];

const FeaturesGrid = () => {
  const navigate = useNavigate();

  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="text-sm font-semibold text-pub-amber uppercase tracking-wider font-heading">
            Solusi Lengkap
          </span>
          <h2 className="text-3xl md:text-4xl font-bold font-heading text-foreground mt-2">
            Satu Platform, Semua Kebutuhan BUJK
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto font-body">
            PUB ASPEKINDO mengintegrasikan 12+ fitur dalam satu ekosistem digital untuk memenuhi kewajiban PUB dan meningkatkan daya saing.
          </p>
        </motion.div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
          {features.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="p-5 rounded-xl bg-card border border-border shadow-card hover:shadow-card-hover transition-all group"
            >
              <div className="w-10 h-10 rounded-lg bg-pub-amber/10 flex items-center justify-center mb-3">
                <f.icon className="w-5 h-5 text-pub-amber" />
              </div>
              <h3 className="text-base font-bold font-heading text-foreground mb-1">{f.title}</h3>
              <p className="text-sm text-muted-foreground font-body">{f.desc}</p>
            </motion.div>
          ))}
        </div>

        <div className="text-center">
          <button
            onClick={() => navigate("/auth")}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-gradient-amber text-accent-foreground font-semibold font-heading shadow-amber hover:brightness-110 transition-all"
          >
            Bergabung & Jadilah Kontraktor Berdaya Saing <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </section>
  );
};

export default FeaturesGrid;
