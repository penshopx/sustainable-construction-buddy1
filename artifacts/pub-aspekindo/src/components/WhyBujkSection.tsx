import { motion } from "framer-motion";
import { AlertTriangle, FileWarning, TrendingDown, ShieldAlert, Building2, Users, Award, Layers } from "lucide-react";

const warnings = [
  {
    tag: "WAJIB",
    tagColor: "bg-destructive/15 text-destructive border-destructive/30",
    title: "Kewajiban Regulasi PP 14/2021",
    description: "Setiap BUJK wajib melaksanakan Pengembangan Usaha Berkelanjutan. Tidak patuh = sanksi administratif hingga pencabutan SBU.",
    icon: AlertTriangle,
  },
  {
    tag: "KRITIS",
    tagColor: "bg-pub-amber/15 text-pub-amber border-pub-amber/30",
    title: "Perpanjangan SBU Terhambat",
    description: "Tanpa bukti pelaksanaan PUB, proses perpanjangan SBU dapat ditolak oleh LSBU KI.",
    icon: FileWarning,
  },
  {
    tag: "DAMPAK",
    tagColor: "bg-pub-sky/15 text-pub-sky border-pub-sky/30",
    title: "Kalah Saing dalam Tender",
    description: "BUJK tanpa kompetensi terukur & grade kinerja sulit bersaing di proyek pemerintah maupun swasta.",
    icon: TrendingDown,
  },
  {
    tag: "RISIKO",
    tagColor: "bg-pub-violet/15 text-pub-violet border-pub-violet/30",
    title: "Risiko K3 & Audit Gagal",
    description: "Tanpa sistem manajemen risiko, K3, dan SMAP yang terdokumentasi, BUJK rentan gagal audit kepatuhan.",
    icon: ShieldAlert,
  },
];

const stats = [
  { value: "1.000+", label: "BUJK Terdaftar", sub: "Target", icon: Building2 },
  { value: "5.000+", label: "Personil Manajerial", sub: "Target", icon: Users },
  { value: "4", label: "Level Kompetensi", sub: "Terstruktur", icon: Award },
  { value: "6", label: "Domain Keahlian", sub: "Komprehensif", icon: Layers },
];

const WhyBujkSection = () => {
  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-destructive/10 border border-destructive/20 text-destructive text-sm font-semibold font-heading mb-3">
            <AlertTriangle className="w-3.5 h-3.5" />
            PERHATIAN BUJK
          </span>
          <h2 className="text-3xl md:text-4xl font-bold font-heading text-foreground mt-2">
            Mengapa BUJK Harus{" "}
            <span className="text-destructive">Bertindak Sekarang?</span>
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto font-body">
            Regulasi konstruksi semakin ketat. Tanpa sistem PUB yang terstruktur, badan usaha Anda berisiko tertinggal.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5 mb-16">
          {warnings.map((item, i) => (
            <motion.div
              key={item.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="p-6 rounded-xl bg-card border border-border shadow-card hover:shadow-card-hover transition-all"
            >
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${item.tagColor} mb-4`}>
                {item.tag}
              </span>
              <h3 className="text-lg font-bold font-heading text-foreground mb-2">{item.title}</h3>
              <p className="text-sm text-muted-foreground font-body leading-relaxed">{item.description}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="text-center"
            >
              <p className="text-3xl md:text-4xl font-extrabold font-heading text-pub-navy dark:text-primary-foreground">{stat.value}</p>
              <p className="text-sm font-semibold text-foreground mt-1 font-heading">{stat.label}</p>
              <p className="text-xs text-muted-foreground font-body">{stat.sub}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default WhyBujkSection;
