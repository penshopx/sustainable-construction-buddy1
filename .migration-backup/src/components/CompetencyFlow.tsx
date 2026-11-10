import { motion } from "framer-motion";
import { ClipboardCheck, BookOpen, Wrench, FileCheck, BarChart3, TrendingUp, ChevronRight } from "lucide-react";

const steps = [
  { icon: ClipboardCheck, label: "Assessment", desc: "Pre-test baseline" },
  { icon: BookOpen, label: "Learning", desc: "E-course & modul" },
  { icon: Wrench, label: "Practice", desc: "Mini apps & generator" },
  { icon: FileCheck, label: "Evidence", desc: "Output & log proyek" },
  { icon: BarChart3, label: "Evaluation", desc: "Scoring tahunan" },
  { icon: TrendingUp, label: "Leveling", desc: "Naik level" },
];

const CompetencyFlow = () => {
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
            Alur Kompetensi
          </span>
          <h2 className="text-3xl md:text-4xl font-bold font-heading text-foreground mt-2">
            Competency Flow
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto font-body">
            Dari assessment hingga leveling — setiap tahap terhubung dalam satu alur berkelanjutan.
          </p>
        </motion.div>

        {/* Desktop flow */}
        <div className="hidden lg:flex items-center justify-center gap-2">
          {steps.map((step, i) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center"
            >
              <div className="flex flex-col items-center gap-3 px-4">
                <div className="w-16 h-16 rounded-2xl bg-card border border-border shadow-card flex items-center justify-center group hover:border-pub-amber/30 hover:shadow-card-hover transition-all">
                  <step.icon className="w-7 h-7 text-pub-amber" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold font-heading text-foreground">{step.label}</p>
                  <p className="text-xs text-muted-foreground font-body">{step.desc}</p>
                </div>
              </div>
              {i < steps.length - 1 && (
                <ChevronRight className="w-5 h-5 text-border shrink-0 mx-1" />
              )}
            </motion.div>
          ))}
        </div>

        {/* Mobile flow */}
        <div className="lg:hidden grid grid-cols-2 sm:grid-cols-3 gap-4">
          {steps.map((step, i) => (
            <motion.div
              key={step.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              className="flex flex-col items-center gap-2 p-4 rounded-xl bg-card border border-border shadow-card"
            >
              <div className="w-12 h-12 rounded-xl bg-pub-amber/10 flex items-center justify-center">
                <step.icon className="w-6 h-6 text-pub-amber" />
              </div>
              <p className="text-sm font-semibold font-heading text-foreground">{step.label}</p>
              <p className="text-xs text-muted-foreground font-body text-center">{step.desc}</p>
              {i < steps.length - 1 && (
                <span className="text-xs text-pub-amber font-heading">→ Tahap {i + 2}</span>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default CompetencyFlow;
