import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { ArrowRight, Shield, MessageSquare, Users, CheckCircle } from "lucide-react";

const commitments = [
  "Tingkatkan kompetensi manajerial sesuai standar LPJK & Permen PU",
  "Penuhi persyaratan SBU dengan dokumentasi PUB yang terstruktur",
  "Bergabung dengan komunitas kontraktor profesional ASPEKINDO",
];

const CTASection = () => {
  const navigate = useNavigate();

  return (
    <section className="py-24 bg-gradient-to-br from-[hsl(220,60%,12%)] via-[hsl(220,50%,16%)] to-[hsl(220,40%,20%)]">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center max-w-3xl mx-auto"
        >
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-extrabold font-heading text-[hsl(0,0%,97%)] mb-6 leading-tight">
            Jadilah BUJK yang{" "}
            <span className="text-gradient-hero">Kompeten, Patuh & Berdaya Saing</span>
          </h2>
          <p className="text-lg text-[hsl(0,0%,65%)] font-body mb-8 leading-relaxed">
            ASPEKINDO hadir untuk mendampingi perjalanan transformasi digital BUJK Indonesia — 
            dari kepatuhan regulasi hingga penguasaan kompetensi manajerial yang profesional.
          </p>

          <div className="space-y-3 mb-10 text-left max-w-md mx-auto">
            {commitments.map((point) => (
              <div key={point} className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-pub-amber shrink-0 mt-0.5" />
                <p className="text-sm text-[hsl(0,0%,75%)] font-body">{point}</p>
              </div>
            ))}
          </div>

          {/* Dual CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
            <button
              onClick={() => navigate("/auth")}
              className="inline-flex items-center justify-center gap-2 px-9 py-4 rounded-xl bg-gradient-amber text-accent-foreground font-bold font-heading text-lg shadow-amber hover:brightness-110 transition-all"
            >
              Daftar & Tingkatkan Kompetensi <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => document.getElementById("floating-helpdesk-btn")?.click()}
              className="inline-flex items-center justify-center gap-2 px-9 py-4 rounded-xl border border-[hsl(0,0%,100%)/20%] text-[hsl(0,0%,85%)] font-semibold font-heading hover:bg-[hsl(0,0%,100%)/8%] transition-all"
            >
              <MessageSquare className="w-5 h-5" />
              Buka Helpdesk Aplikasi
            </button>
          </div>

          <p className="text-xs text-[hsl(0,0%,50%)] mb-12 font-body">
            Platform resmi ASPEKINDO untuk personil manajerial BUJK Indonesia.
          </p>

          <div className="flex flex-wrap justify-center gap-8">
            {[
              { icon: Shield, label: "Berbasis Regulasi Resmi" },
              { icon: Users, label: "Komunitas BUJK Nasional" },
              { icon: MessageSquare, label: "AI PUB HelpDesk" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-[hsl(0,0%,45%)] text-sm font-body">
                <item.icon className="w-4 h-4" />
                {item.label}
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
