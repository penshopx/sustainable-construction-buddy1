import { motion } from "framer-motion";
import {
  ClipboardCheck,
  GraduationCap,
  Wrench,
  BarChart3,
  ArrowRight,
} from "lucide-react";

const engines = [
  {
    title: "Assessment Engine",
    subtitle: "Pre-test & Evaluasi",
    icon: ClipboardCheck,
    description:
      "Baseline assessment melalui tes knowledge, mapping pengalaman, dan portfolio review untuk menentukan level awal.",
    features: ["Pre-test Digital", "Experience Mapping", "Portfolio Review", "Adaptive Assessment"],
    gradient: "from-pub-sky/10 to-pub-sky/5",
    iconBg: "bg-pub-sky/15",
    iconColor: "text-pub-sky",
    borderColor: "border-pub-sky/15",
  },
  {
    title: "Learning Engine",
    subtitle: "Pusat Pembelajaran PUB",
    icon: GraduationCap,
    description:
      "Kurikulum terstruktur per level dengan e-course, modul e-book, dan chatbot mentor digital.",
    features: ["E-Course Terstruktur", "Modul & E-Book", "Chatbot Mentor", "Learning Path"],
    gradient: "from-pub-emerald/10 to-pub-emerald/5",
    iconBg: "bg-pub-emerald/15",
    iconColor: "text-pub-emerald",
    borderColor: "border-pub-emerald/15",
  },
  {
    title: "Implementation Engine",
    subtitle: "Generator & Mini Apps",
    icon: Wrench,
    description:
      "Toolkit praktis: generator dokumen (SOP, RAB, RKK) dan mini apps (Risk Register, Budget Tracker, K3 Checklist).",
    features: ["Generator Dokumen", "Risk Register", "Budget Tracker", "K3 Checklist"],
    gradient: "from-pub-amber/10 to-pub-amber/5",
    iconBg: "bg-pub-amber/15",
    iconColor: "text-pub-amber",
    borderColor: "border-pub-amber/15",
  },
  {
    title: "Analytics Engine",
    subtitle: "Scoring & Leveling",
    icon: BarChart3,
    description:
      "Competency analytics berbasis data aktivitas nyata — scoring otomatis, gap analysis, dan rekomendasi peningkatan.",
    features: ["Scoring Real-time", "Gap Analysis", "Level Progression", "Knowledge Heatmap"],
    gradient: "from-pub-violet/10 to-pub-violet/5",
    iconBg: "bg-pub-violet/15",
    iconColor: "text-pub-violet",
    borderColor: "border-pub-violet/15",
  },
];

const EngineCards = () => {
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
            Arsitektur Sistem
          </span>
          <h2 className="text-3xl md:text-4xl font-bold font-heading text-foreground mt-2">
            4 Engine Utama
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto font-body">
            Ekosistem yang menghubungkan assessment, learning, implementasi, dan analytics dalam satu platform.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {engines.map((engine, i) => (
            <motion.div
              key={engine.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative p-7 rounded-xl border ${engine.borderColor} bg-gradient-to-br ${engine.gradient} backdrop-blur shadow-card hover:shadow-card-hover transition-all duration-300 group cursor-pointer`}
            >
              <div className="flex items-start gap-4">
                <div className={`w-14 h-14 rounded-xl ${engine.iconBg} flex items-center justify-center shrink-0`}>
                  <engine.icon className={`w-7 h-7 ${engine.iconColor}`} />
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1 font-heading">
                    {engine.subtitle}
                  </p>
                  <h3 className="text-xl font-bold font-heading text-foreground mb-2">
                    {engine.title}
                  </h3>
                  <p className="text-sm text-muted-foreground font-body leading-relaxed mb-4">
                    {engine.description}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {engine.features.map((f) => (
                      <span
                        key={f}
                        className="text-xs px-2.5 py-1 rounded-full bg-card border border-border text-foreground/70 font-medium"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="absolute top-7 right-7 opacity-0 group-hover:opacity-100 transition-opacity">
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default EngineCards;
