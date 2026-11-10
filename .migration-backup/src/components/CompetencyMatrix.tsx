import { motion } from "framer-motion";

const matrix = [
  {
    domain: "Manajemen Proyek",
    learning: "E-course Project Mgmt",
    miniApp: "Schedule Tracker",
    generator: "Laporan Proyek",
  },
  {
    domain: "Manajemen Risiko",
    learning: "Modul Risk Management",
    miniApp: "Risk Register",
    generator: "Risk Plan",
  },
  {
    domain: "Keuangan & Cost",
    learning: "E-course Cost Control",
    miniApp: "Budget Tracker",
    generator: "RAB",
  },
  {
    domain: "Pengadaan & Kontrak",
    learning: "Modul Procurement",
    miniApp: "Procurement Planner",
    generator: "Dok Tender / Kontrak",
  },
  {
    domain: "K3 & Compliance",
    learning: "E-course SMK3",
    miniApp: "K3 Checklist",
    generator: "RKK / Laporan K3",
  },
  {
    domain: "Governance",
    learning: "Modul Leadership",
    miniApp: "Audit Tool",
    generator: "SOP Internal",
  },
];

const CompetencyMatrix = () => {
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
            Domain Kompetensi
          </span>
          <h2 className="text-3xl md:text-4xl font-bold font-heading text-foreground mt-2">
            Competency Matrix
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto font-body">
            Setiap domain memiliki jalur learning, mini app praktik, dan generator output yang terhubung.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="overflow-x-auto"
        >
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="bg-primary text-primary-foreground">
                <th className="px-5 py-4 text-left text-sm font-semibold font-heading rounded-tl-xl">Domain</th>
                <th className="px-5 py-4 text-left text-sm font-semibold font-heading">Learning</th>
                <th className="px-5 py-4 text-left text-sm font-semibold font-heading">Mini App</th>
                <th className="px-5 py-4 text-left text-sm font-semibold font-heading rounded-tr-xl">Generator Output</th>
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, i) => (
                <tr
                  key={row.domain}
                  className={`border-b border-border/50 ${
                    i % 2 === 0 ? "bg-card" : "bg-background"
                  } hover:bg-pub-amber/5 transition-colors`}
                >
                  <td className="px-5 py-4 text-sm font-semibold text-foreground font-heading">
                    {row.domain}
                  </td>
                  <td className="px-5 py-4 text-sm text-muted-foreground font-body">{row.learning}</td>
                  <td className="px-5 py-4 text-sm text-muted-foreground font-body">{row.miniApp}</td>
                  <td className="px-5 py-4 text-sm text-muted-foreground font-body">{row.generator}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      </div>
    </section>
  );
};

export default CompetencyMatrix;
