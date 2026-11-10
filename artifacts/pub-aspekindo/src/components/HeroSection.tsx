import { motion } from "framer-motion";
import { ArrowDown, ArrowRight, AlertTriangle, ExternalLink } from "lucide-react";
import { useNavigate } from "react-router-dom";
import heroImage from "@/assets/hero-construction.jpg";
import logoPub from "@/assets/logo-pub-new.png";
import logoAspekindo from "@/assets/logo-aspekindo.png";
import logoLsbuki from "@/assets/logo-lsbuki.webp";

const challenges = [
  { label: "Standar sertifikasi diperbarui", sub: "KepDirjen 281/2026 menggantikan KepDirjen 37/2025" },
  { label: "Skema SBU perlu disesuaikan", sub: "BUJK dan LSBU perlu menyiapkan persyaratan terbaru" },
  { label: "Proyek makin kompetitif", sub: "Efisiensi anggaran, harga naik, tender berat" },
];

const HeroSection = () => {
  const navigate = useNavigate();

  return (
    <section className="relative min-h-[90vh] flex items-center overflow-hidden">
      <div className="absolute inset-0">
        <img src={heroImage} alt="Proyek konstruksi modern" className="w-full h-full object-cover" loading="eager" />
        <div className="absolute inset-0 bg-gradient-to-b from-[hsl(220,60%,8%)/95%] via-[hsl(220,50%,12%)/90%] to-[hsl(220,40%,15%)/85%]" />
      </div>

      <div className="relative z-10 container mx-auto px-6 py-16 md:py-24">
        {/* Logos */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="flex items-center gap-3 mb-8"
        >
          <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[hsl(0,0%,100%)/12%] backdrop-blur-sm border border-[hsl(0,0%,100%)/10%]">
            <img src={logoPub} alt="Logo PUB ASPEKINDO" className="h-12 w-auto object-contain" />
            <span className="text-[hsl(0,0%,90%)] font-bold font-heading text-sm leading-tight">PUB<br/>ASPEKINDO</span>
            <div className="w-px h-8 bg-[hsl(0,0%,100%)/20%]" />
            <img src={logoAspekindo} alt="Logo ASPEKINDO" className="h-10 w-auto object-contain" />
            <div className="w-px h-8 bg-[hsl(0,0%,100%)/20%]" />
            <img src={logoLsbuki} alt="Logo LSBU KI" className="h-10 w-auto object-contain" />
          </div>
        </motion.div>

        {/* AIDA: Attention — headline */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1 }}
          className="max-w-6xl"
        >
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-destructive/15 border border-destructive/25 text-destructive text-sm font-semibold font-heading mb-5">
            <AlertTriangle className="w-3.5 h-3.5" />
            REGULASI BARU SERTIFIKASI BUJK 2026
          </div>

          <h1 className="text-4xl md:text-5xl lg:text-[3.5rem] font-extrabold font-heading text-white leading-[1.1] mb-6" style={{ textShadow: '2px 2px 8px rgba(0,0,0,0.8)' }}>
            Standar Sertifikasi BUJK Diperbarui.{" "}
            <span className="text-pub-amber" style={{ textShadow: '2px 2px 6px rgba(0,0,0,0.9)' }}>
              Saatnya BUJK Anda Lebih Siap.
            </span>
          </h1>

          <a
            href="#jelajahi-bagian"
            data-testid="link-jelajahi-bagian"
            className="mb-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-pub-amber bg-[hsl(220,65%,11%)] px-5 py-2 text-sm font-bold font-heading text-white shadow-lg transition-colors hover:bg-pub-amber hover:text-pub-navy focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white md:hidden"
          >
            Jelajahi bagian <ArrowDown className="h-4 w-4" aria-hidden="true" />
          </a>

          <p className="text-lg md:text-xl text-[hsl(0,0%,85%)] leading-relaxed mb-10 max-w-3xl font-body" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.8)' }}>
            Permen PUPR No. 7 Tahun 2024 menjadi dasar penyelenggaraan PUB. Kini,
            KepDirjen Bina Konstruksi No. 281/KPTS/DK/2026 menindaklanjuti Permen PU
            No. 6 Tahun 2025 dan menetapkan standar skema sertifikasi BUJK terbaru.
            <strong className="text-[hsl(0,0%,97%)]"> PUB ASPEKINDO mendampingi BUJK </strong>
            untuk meningkatkan kemampuan, menata bukti kegiatan, dan menyiapkan diri
            menghadapi ketentuan sertifikasi yang berlaku.
          </p>

          <div className="flex max-w-6xl flex-wrap gap-4 mb-16">
            <button
              onClick={() => navigate("/auth")}
              className="order-1 inline-flex w-full items-center justify-center gap-2 px-6 py-4 rounded-xl bg-gradient-amber text-accent-foreground font-bold font-heading text-base shadow-amber hover:brightness-110 transition-all duration-200 sm:w-auto sm:px-8 sm:text-lg"
            >
              Bergabung & Jadilah Kontraktor Berdaya Saing
              <ArrowRight className="w-5 h-5" />
            </button>
            <button
              onClick={() => document.getElementById("floating-helpdesk-btn")?.click()}
              className="order-3 inline-flex w-full items-center justify-center gap-2 px-6 py-4 rounded-xl border border-[hsl(0,0%,100%)/35%] text-white font-semibold font-heading hover:bg-[hsl(0,0%,100%)/12%] transition-all duration-200 sm:order-2 sm:w-auto sm:px-8"
            >
              Helpdesk Aplikasi
            </button>
            <div className="order-2 mx-0 grid w-full max-w-[760px] grid-cols-1 gap-3 sm:grid-cols-2">
              <a
                href="https://app.aspekindo.id/"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-white bg-pub-sky px-5 py-3 text-center text-xs font-bold font-heading tracking-tight text-pub-navy shadow-[0_8px_24px_rgba(0,124,248,0.45)] transition-all duration-200 hover:bg-white hover:text-pub-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(220,60%,8%)] sm:whitespace-nowrap sm:text-sm md:text-[15px]"
              >
                Portal Keanggotaan (KTA) ASPEKINDO
                <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
              </a>
              <a
                href="https://lsbukonstruksi.co.id"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-xl border-2 border-pub-amber bg-pub-navy/95 px-5 py-3 text-center text-xs font-bold font-heading tracking-tight text-white shadow-[0_8px_24px_rgba(245,158,11,0.3)] transition-all duration-200 hover:bg-pub-amber hover:text-pub-navy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-amber focus-visible:ring-offset-2 focus-visible:ring-offset-[hsl(220,60%,8%)] sm:whitespace-nowrap sm:text-sm md:text-[15px]"
              >
                Sertifikasi Badan Usaha (SBU) LSBU KI
                <ExternalLink className="w-4 h-4 shrink-0" aria-hidden="true" />
              </a>
            </div>
          </div>
        </motion.div>

        {/* Challenge cards — qualitative */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="grid md:grid-cols-3 gap-6"
        >
          {challenges.map((c, i) => (
            <div
              key={i}
              className="flex items-start gap-4 p-5 rounded-xl bg-[hsl(220,30%,10%)/90%] backdrop-blur-md border border-[hsl(0,0%,100%)/12%]"
            >
              <div className="w-3 h-3 rounded-full bg-pub-amber shrink-0 mt-1.5" />
              <div>
                <p className="text-lg font-bold font-heading text-white" style={{ textShadow: '1px 1px 4px rgba(0,0,0,0.8)' }}>{c.label}</p>
                <p className="text-sm text-[hsl(0,0%,75%)] font-body mt-1">{c.sub}</p>
              </div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default HeroSection;
