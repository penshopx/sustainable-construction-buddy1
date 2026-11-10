import { motion } from "framer-motion";
import { Star, Award, Crown, Gem } from "lucide-react";

const levels = [
  {
    name: "Pemula",
    icon: Star,
    score: "0–59",
    color: "pub-sky",
    bgClass: "bg-pub-sky/10 border-pub-sky/20",
    iconBg: "bg-pub-sky/20",
    iconColor: "text-pub-sky",
    description: "Memahami dasar manajemen konstruksi, regulasi, dan administrasi proyek.",
    focus: ["Manajemen Dasar", "Struktur BUJK", "Regulasi", "Administrasi"],
  },
  {
    name: "Muda",
    icon: Award,
    score: "≥60",
    color: "pub-emerald",
    bgClass: "bg-pub-emerald/10 border-pub-emerald/20",
    iconBg: "bg-pub-emerald/20",
    iconColor: "text-pub-emerald",
    description: "Mampu mengelola proyek skala kecil–menengah dengan operasional mandiri.",
    focus: ["Manajemen Proyek", "Pengadaan & Logistik", "Cost Control", "K3"],
  },
  {
    name: "Madya",
    icon: Crown,
    score: "≥75",
    color: "pub-amber",
    bgClass: "bg-pub-amber/10 border-pub-amber/20",
    iconBg: "bg-pub-amber/20",
    iconColor: "text-pub-amber",
    description: "Mampu mengelola proyek kompleks dan membangun sistem internal organisasi.",
    focus: ["Manajemen Risiko", "Kontrak & Klaim", "Leadership", "Audit"],
  },
  {
    name: "Utama",
    icon: Gem,
    score: "≥85",
    color: "pub-violet",
    bgClass: "bg-pub-violet/10 border-pub-violet/20",
    iconBg: "bg-pub-violet/20",
    iconColor: "text-pub-violet",
    description: "Arsitek sistem manajerial BUJK — governance, strategi, dan transformasi.",
    focus: ["Governance", "ESG & Sustainability", "Digital Transformation", "Knowledge Management"],
  },
];

const CompetencyLevels = () => {
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-14"
        >
          <span className="text-sm font-semibold text-pub-amber uppercase tracking-wider font-heading">
            Kualifikasi Personil
          </span>
          <h2 className="text-3xl md:text-4xl font-bold font-heading text-foreground mt-2">
            Level Kompetensi Manajerial
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto font-body">
            Setiap personil manajerial dinilai berdasarkan knowledge capacity — bukan senioritas atau modal.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {levels.map((level, i) => (
            <motion.div
              key={level.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative p-6 rounded-xl border ${level.bgClass} shadow-card hover:shadow-card-hover transition-all duration-300 group`}
            >
              <div className={`w-12 h-12 rounded-xl ${level.iconBg} flex items-center justify-center mb-4`}>
                <level.icon className={`w-6 h-6 ${level.iconColor}`} />
              </div>

              <div className="flex items-baseline gap-2 mb-2">
                <h3 className="text-xl font-bold font-heading text-foreground">{level.name}</h3>
                <span className="text-xs font-medium text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  Skor {level.score}
                </span>
              </div>

              <p className="text-sm text-muted-foreground font-body mb-4 leading-relaxed">
                {level.description}
              </p>

              <div className="flex flex-wrap gap-1.5">
                {level.focus.map((item) => (
                  <span
                    key={item}
                    className="text-xs px-2 py-1 rounded-md bg-background/80 text-muted-foreground border border-border/50"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CompetencyLevels;
