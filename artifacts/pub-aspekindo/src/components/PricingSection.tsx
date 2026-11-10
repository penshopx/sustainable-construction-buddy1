import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Check, ArrowRight } from "lucide-react";

const plans = [
  {
    name: "Starter",
    desc: "Untuk BUJK yang baru memulai PUB",
    price: "GRATIS",
    features: [
      "Pre-test assessment dasar",
      "3 modul e-course gratis",
      "Profil BUJK di direktori",
      "Helpdesk AI (terbatas)",
      "K3 Checklist dasar",
    ],
    cta: "Mulai Gratis",
    highlight: false,
  },
  {
    name: "Professional",
    desc: "Untuk BUJK yang serius mengembangkan kompetensi",
    price: "Rp 299.000",
    priceUnit: "/bulan",
    badge: "POPULER",
    features: [
      "Semua fitur Starter",
      "Seluruh e-course & modul",
      "Generator dokumen unlimited",
      "Risk Register & Budget Tracker",
      "LKUT & Grading otomatis",
      "Mentor AI 24/7",
      "Sertifikat digital",
      "SMAP & PANCEK lengkap",
      "Marketplace akses penuh",
    ],
    cta: "Berlangganan Pro",
    highlight: true,
  },
  {
    name: "Enterprise",
    desc: "Untuk asosiasi, group BUJK, atau instansi",
    price: "Custom",
    features: [
      "Semua fitur Professional",
      "Multi-user management",
      "Dashboard korporat",
      "White-label branding",
      "API integration",
      "Dedicated support",
      "Training on-site",
    ],
    cta: "Hubungi Kami",
    highlight: false,
  },
];

const PricingSection = () => {
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
            Investasi Kompetensi
          </span>
          <h2 className="text-3xl md:text-4xl font-bold font-heading text-foreground mt-2">
            Pilih Paket yang Sesuai
          </h2>
          <p className="text-muted-foreground mt-3 max-w-2xl mx-auto font-body">
            Mulai gratis untuk anggota ASPEKINDO. Upgrade kapan saja untuk akses fitur premium.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {plans.map((plan, i) => (
            <motion.div
              key={plan.name}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative p-7 rounded-xl border ${
                plan.highlight
                  ? "border-pub-amber/40 bg-card shadow-amber"
                  : "border-border bg-card shadow-card"
              } flex flex-col`}
            >
              {plan.badge && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-pub-amber text-accent-foreground text-xs font-bold font-heading">
                  {plan.badge}
                </span>
              )}
              <h3 className="text-xl font-bold font-heading text-foreground">{plan.name}</h3>
              <p className="text-sm text-muted-foreground font-body mt-1 mb-5">{plan.desc}</p>
              <div className="mb-6">
                <span className="text-3xl font-extrabold font-heading text-foreground">{plan.price}</span>
                {plan.priceUnit && (
                  <span className="text-sm text-muted-foreground font-body">{plan.priceUnit}</span>
                )}
              </div>
              <ul className="space-y-2.5 flex-1 mb-6">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm font-body text-muted-foreground">
                    <Check className="w-4 h-4 text-pub-emerald shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => navigate("/auth")}
                className={`w-full py-2.5 rounded-lg font-semibold font-heading text-sm flex items-center justify-center gap-2 transition-all ${
                  plan.highlight
                    ? "bg-gradient-amber text-accent-foreground shadow-amber hover:brightness-110"
                    : "bg-muted text-foreground hover:bg-muted/80 border border-border"
                }`}
              >
                {plan.cta} <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
