import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeft, ChevronRight, Maximize, Minimize, Home,
  AlertTriangle, TrendingDown, Users, Target, CheckCircle,
  Shield, BarChart3, GraduationCap, Wrench, Bot, Award,
  Building2, ShoppingBag, FileText, Lightbulb, Zap,
  ArrowRight, Globe, Lock, Layers,
} from "lucide-react";
import logoPub from "@/assets/logo-pub-new.png";
import logoAspekindo from "@/assets/logo-aspekindo.png";
import logoLsbuki from "@/assets/logo-lsbuki.webp";
import dashboardMockup from "@/assets/dashboard-mockup.png";

/* ------------------------------------------------------------------ */
/*  Slide data                                                        */
/* ------------------------------------------------------------------ */

interface Slide {
  id: string;
  render: () => React.ReactNode;
}

function CoverSlide() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 bg-gradient-to-br from-[hsl(220,60%,8%)] via-[hsl(220,50%,14%)] to-[hsl(35,90%,20%)]">
      <div className="flex items-center gap-4 mb-10">
        <img src={logoPub} alt="PUB" className="h-16 md:h-20" />
        <div className="w-px h-14 bg-white/20" />
        <img src={logoAspekindo} alt="ASPEKINDO" className="h-14 md:h-16" />
        <div className="w-px h-14 bg-white/20" />
        <img src={logoLsbuki} alt="LSBU KI" className="h-14 md:h-16" />
      </div>
      <h1 className="text-5xl md:text-7xl font-extrabold text-white leading-tight mb-6">
        PUB <span className="text-pub-amber">ASPEKINDO</span>
      </h1>
      <p className="text-xl md:text-2xl text-white/80 max-w-3xl leading-relaxed mb-4">
        Platform Digital Terintegrasi untuk Pengembangan Usaha Berkelanjutan
        <br />Badan Usaha Jasa Konstruksi (BUJK)
      </p>
      <div className="mt-8 px-5 py-2.5 rounded-full bg-pub-amber/20 border border-pub-amber/30 text-pub-amber font-semibold text-sm">
        Pitch Deck 2025
      </div>
    </div>
  );
}

function ProblemSlide() {
  const problems = [
    { icon: AlertTriangle, stat: "65%", desc: "BUJK gagal perpanjang SBU karena tidak memenuhi kewajiban PUB", color: "text-red-400" },
    { icon: TrendingDown, stat: "Rp 847 T", desc: "Nilai industri konstruksi 2024 — persaingan semakin ketat", color: "text-amber-400" },
    { icon: Users, stat: "202.000+", desc: "BUJK terdaftar, mayoritas belum punya sistem kompetensi digital", color: "text-blue-400" },
  ];
  return (
    <div className="flex flex-col justify-center h-full px-8 md:px-16 bg-gradient-to-br from-[hsl(220,60%,8%)] to-[hsl(0,40%,12%)]">
      <span className="text-red-400 font-bold text-sm uppercase tracking-widest mb-3">⚠ Masalah Industri</span>
      <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-12">
        Industri Konstruksi Indonesia <br />
        <span className="text-red-400">Sedang Dalam Tekanan</span>
      </h2>
      <div className="grid md:grid-cols-3 gap-8">
        {problems.map((p, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.15 }}
            className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-8"
          >
            <p.icon className={`w-10 h-10 ${p.color} mb-4`} />
            <p className={`text-4xl font-extrabold ${p.color} mb-2`}>{p.stat}</p>
            <p className="text-white/70 leading-relaxed">{p.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function RegulationSlide() {
  const regs = [
    { title: "UU No. 2 Tahun 2017", desc: "Tentang Jasa Konstruksi — mewajibkan pengembangan usaha berkelanjutan" },
    { title: "PP No. 14 Tahun 2021", desc: "Pasal 86–89 mengatur kewajiban PUB bagi seluruh BUJK" },
    { title: "Permen PUPR No. 6/2021", desc: "Tata cara penilaian dan pengawasan kinerja BUJK" },
    { title: "SE LPJK 2023", desc: "Kewajiban pelaporan LKUT sebagai syarat perpanjangan SBU" },
  ];
  return (
    <div className="flex flex-col justify-center h-full px-8 md:px-16 bg-gradient-to-br from-[hsl(220,60%,8%)] to-[hsl(220,50%,15%)]">
      <span className="text-pub-amber font-bold text-sm uppercase tracking-widest mb-3">📜 Landasan Hukum</span>
      <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-12">
        Regulasi yang <span className="text-pub-amber">Tidak Bisa Diabaikan</span>
      </h2>
      <div className="grid md:grid-cols-2 gap-6">
        {regs.map((r, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.1 }}
            className="flex items-start gap-4 bg-white/5 border border-white/10 rounded-xl p-6"
          >
            <Lock className="w-6 h-6 text-pub-amber shrink-0 mt-1" />
            <div>
              <h3 className="text-white font-bold text-lg">{r.title}</h3>
              <p className="text-white/60 mt-1">{r.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function SolutionSlide() {
  return (
    <div className="flex flex-col justify-center h-full px-8 md:px-16 bg-gradient-to-br from-[hsl(220,60%,8%)] to-[hsl(35,60%,12%)]">
      <span className="text-pub-amber font-bold text-sm uppercase tracking-widest mb-3">💡 Solusi</span>
      <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-6">
        Satu Platform, <span className="text-pub-amber">Semua Kebutuhan PUB</span>
      </h2>
      <p className="text-xl text-white/70 max-w-3xl mb-12 leading-relaxed">
        PUB ASPEKINDO mengintegrasikan seluruh kewajiban dan kebutuhan pengembangan usaha berkelanjutan BUJK 
        dalam satu ekosistem digital — dari assessment hingga sertifikasi.
      </p>
      <div className="flex items-center gap-8">
        <div className="flex-1 space-y-4">
          {[
            { icon: Target, label: "Assessment & Pre-test Kompetensi" },
            { icon: GraduationCap, label: "E-Course per Level & Domain" },
            { icon: Wrench, label: "Toolkit Proyek Lengkap" },
            { icon: Shield, label: "SMAP & PANCEK Anti Korupsi" },
            { icon: FileText, label: "LKUT Digital Otomatis" },
            { icon: Bot, label: "AI Mentor & Helpdesk 24/7" },
          ].map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 + i * 0.08 }}
              className="flex items-center gap-3 text-white"
            >
              <div className="w-10 h-10 rounded-lg bg-pub-amber/20 flex items-center justify-center shrink-0">
                <item.icon className="w-5 h-5 text-pub-amber" />
              </div>
              <span className="text-lg">{item.label}</span>
            </motion.div>
          ))}
        </div>
        <div className="hidden lg:block flex-1">
          <img src={dashboardMockup} alt="Dashboard" className="rounded-2xl border border-white/10 shadow-2xl" />
        </div>
      </div>
    </div>
  );
}

function FeaturesSlide() {
  const features = [
    { icon: BarChart3, title: "Kinerja & Grading", desc: "Scoring 4 pilar otomatis grade A–E" },
    { icon: Shield, title: "SMAP & PANCEK", desc: "Anti penyuapan SNI ISO 37001" },
    { icon: FileText, title: "LKUT Digital", desc: "Laporan tahunan untuk SBU" },
    { icon: Building2, title: "Direktori BUJK", desc: "Profil & jaringan se-Indonesia" },
    { icon: ShoppingBag, title: "Marketplace", desc: "Jual beli produk konstruksi" },
    { icon: Award, title: "Sertifikat Digital", desc: "Bukti kompetensi terverifikasi" },
    { icon: Lightbulb, title: "8 Pilar Inovasi", desc: "Green hingga Smart Technology" },
    { icon: CheckCircle, title: "Compliance Tracker", desc: "Monitor kepatuhan real-time" },
  ];
  return (
    <div className="flex flex-col justify-center h-full px-8 md:px-16 bg-gradient-to-br from-[hsl(220,60%,8%)] to-[hsl(260,40%,12%)]">
      <span className="text-purple-400 font-bold text-sm uppercase tracking-widest mb-3">🚀 Fitur Unggulan</span>
      <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-10">
        <span className="text-purple-400">12+</span> Fitur dalam Satu Ekosistem
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {features.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 + i * 0.05 }}
            className="bg-white/5 border border-white/10 rounded-xl p-5 text-center"
          >
            <f.icon className="w-8 h-8 text-purple-400 mx-auto mb-3" />
            <h3 className="text-white font-bold text-sm mb-1">{f.title}</h3>
            <p className="text-white/50 text-xs">{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function TechSlide() {
  const stack = [
    { icon: Zap, title: "AI-Powered", desc: "Mentor AI, document generation, dan analisis otomatis berbasis LLM" },
    { icon: Globe, title: "Cloud-Native PWA", desc: "Installable, offline-ready, akses dari mana saja tanpa download app store" },
    { icon: Layers, title: "Modular Architecture", desc: "12+ modul independen yang terintegrasi dalam satu dashboard" },
    { icon: Lock, title: "Enterprise Security", desc: "Row-level security, enkripsi end-to-end, dan role-based access control" },
  ];
  return (
    <div className="flex flex-col justify-center h-full px-8 md:px-16 bg-gradient-to-br from-[hsl(220,60%,8%)] to-[hsl(200,50%,12%)]">
      <span className="text-cyan-400 font-bold text-sm uppercase tracking-widest mb-3">⚙️ Teknologi</span>
      <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-12">
        Dibangun dengan <span className="text-cyan-400">Teknologi Terdepan</span>
      </h2>
      <div className="grid md:grid-cols-2 gap-8">
        {stack.map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.12 }}
            className="flex items-start gap-5 bg-white/5 border border-white/10 rounded-2xl p-8"
          >
            <div className="w-14 h-14 rounded-xl bg-cyan-400/15 flex items-center justify-center shrink-0">
              <s.icon className="w-7 h-7 text-cyan-400" />
            </div>
            <div>
              <h3 className="text-white font-bold text-xl mb-1">{s.title}</h3>
              <p className="text-white/60 leading-relaxed">{s.desc}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function MarketSlide() {
  return (
    <div className="flex flex-col justify-center h-full px-8 md:px-16 bg-gradient-to-br from-[hsl(220,60%,8%)] to-[hsl(140,40%,10%)]">
      <span className="text-emerald-400 font-bold text-sm uppercase tracking-widest mb-3">📊 Potensi Pasar</span>
      <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-12">
        Pasar yang <span className="text-emerald-400">Sangat Besar</span>
      </h2>
      <div className="grid md:grid-cols-3 gap-8 mb-10">
        {[
          { value: "202.000+", label: "BUJK Terdaftar di Indonesia", sub: "Total Addressable Market" },
          { value: "Rp 847 T", label: "Nilai Industri Konstruksi 2024", sub: "Pasar yang terus bertumbuh" },
          { value: "100%", label: "Wajib PUB per regulasi", sub: "Captive market by regulation" },
        ].map((m, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.15 }}
            className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center"
          >
            <p className="text-4xl md:text-5xl font-extrabold text-emerald-400 mb-2">{m.value}</p>
            <p className="text-white font-semibold text-lg">{m.label}</p>
            <p className="text-white/50 text-sm mt-1">{m.sub}</p>
          </motion.div>
        ))}
      </div>
      <div className="bg-emerald-400/10 border border-emerald-400/20 rounded-xl p-6 max-w-2xl">
        <p className="text-emerald-400 font-semibold">💎 Keunggulan Kompetitif</p>
        <p className="text-white/70 mt-2">Satu-satunya platform yang menggabungkan kewajiban regulasi PUB dengan tools manajemen proyek dan AI — menjadikan kepatuhan sebagai competitive advantage.</p>
      </div>
    </div>
  );
}

function BusinessModelSlide() {
  const tiers = [
    { name: "Starter", price: "Gratis", features: ["Assessment dasar", "1 proyek", "Dashboard"] },
    { name: "Professional", price: "Rp 499K/bln", features: ["Semua fitur", "Unlimited proyek", "AI Mentor", "Sertifikat digital"], highlight: true },
    { name: "Enterprise", price: "Custom", features: ["Multi-user", "Corporate dashboard", "API access", "Dedicated support"] },
  ];
  return (
    <div className="flex flex-col justify-center h-full px-8 md:px-16 bg-gradient-to-br from-[hsl(220,60%,8%)] to-[hsl(270,40%,12%)]">
      <span className="text-violet-400 font-bold text-sm uppercase tracking-widest mb-3">💰 Model Bisnis</span>
      <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-12">
        SaaS <span className="text-violet-400">Subscription Model</span>
      </h2>
      <div className="grid md:grid-cols-3 gap-6">
        {tiers.map((t, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + i * 0.12 }}
            className={`rounded-2xl p-8 border ${t.highlight ? "bg-violet-500/15 border-violet-400/40 ring-2 ring-violet-400/20" : "bg-white/5 border-white/10"}`}
          >
            <h3 className="text-white font-bold text-xl mb-1">{t.name}</h3>
            <p className={`text-3xl font-extrabold mb-6 ${t.highlight ? "text-violet-400" : "text-white/80"}`}>{t.price}</p>
            <ul className="space-y-2">
              {t.features.map((f, j) => (
                <li key={j} className="flex items-center gap-2 text-white/70">
                  <CheckCircle className="w-4 h-4 text-violet-400 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
      <p className="text-white/50 text-sm mt-8">+ Revenue dari marketplace (komisi), sertifikasi, dan corporate licensing</p>
    </div>
  );
}

function TeamSlide() {
  return (
    <div className="flex flex-col justify-center h-full px-8 md:px-16 bg-gradient-to-br from-[hsl(220,60%,8%)] to-[hsl(220,50%,15%)]">
      <span className="text-pub-amber font-bold text-sm uppercase tracking-widest mb-3">👥 Tim</span>
      <h2 className="text-4xl md:text-5xl font-extrabold text-white mb-12">
        Didukung oleh <span className="text-pub-amber">Praktisi Senior</span>
      </h2>
      <div className="grid md:grid-cols-2 gap-8">
        {[
          { name: "Ir. Wuryanto Dewobroto, MT, IPM", role: "Ketua PUB ASPEKINDO", exp: "30+ tahun pengalaman manajemen konstruksi" },
          { name: "Ir. Eduard Argawan M., ST, MT", role: "Wakil Ketua / Teknis", exp: "Ahli manajemen proyek & quality management" },
          { name: "Ir. Tumpal David Parlindungan, MT", role: "Direktur Operasional", exp: "Spesialis risk management & cost engineering" },
          { name: "Ir. Hartony, ST, MT", role: "Direktur Keuangan", exp: "Ahli keuangan proyek & compliance BUJK" },
        ].map((member, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 + i * 0.1 }}
            className="flex items-start gap-4 bg-white/5 border border-white/10 rounded-xl p-6"
          >
            <div className="w-12 h-12 rounded-full bg-pub-amber/20 flex items-center justify-center shrink-0 text-pub-amber font-bold text-lg">
              {member.name.charAt(member.name.indexOf('.') + 2)}
            </div>
            <div>
              <h3 className="text-white font-bold">{member.name}</h3>
              <p className="text-pub-amber text-sm font-semibold">{member.role}</p>
              <p className="text-white/50 text-sm mt-1">{member.exp}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function CTASlideContent() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center px-8 bg-gradient-to-br from-[hsl(220,60%,8%)] via-[hsl(35,60%,12%)] to-[hsl(220,50%,10%)]">
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.5 }}>
        <div className="text-6xl mb-6">🚀</div>
        <h2 className="text-4xl md:text-6xl font-extrabold text-white mb-6">
          Mari Wujudkan <span className="text-pub-amber">Konstruksi Indonesia</span>
          <br />yang Lebih Kompeten
        </h2>
        <p className="text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed">
          Bergabunglah dengan BUJK-BUJK terdepan yang sudah menggunakan PUB ASPEKINDO 
          untuk memenuhi regulasi dan meningkatkan daya saing.
        </p>
        <div className="flex items-center justify-center gap-4">
          <div className="px-8 py-4 rounded-xl bg-pub-amber text-black font-bold text-lg flex items-center gap-2">
            Hubungi Kami <ArrowRight className="w-5 h-5" />
          </div>
          <div className="px-8 py-4 rounded-xl border border-white/20 text-white font-semibold">
            aspekindo-pub.com
          </div>
        </div>
        <div className="flex items-center gap-6 mt-12 justify-center">
          <img src={logoPub} alt="PUB" className="h-10 opacity-60" />
          <img src={logoAspekindo} alt="ASPEKINDO" className="h-8 opacity-60" />
          <img src={logoLsbuki} alt="LSBU KI" className="h-8 opacity-60" />
        </div>
      </motion.div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */

const slides: Slide[] = [
  { id: "cover", render: CoverSlide },
  { id: "problem", render: ProblemSlide },
  { id: "regulation", render: RegulationSlide },
  { id: "solution", render: SolutionSlide },
  { id: "features", render: FeaturesSlide },
  { id: "tech", render: TechSlide },
  { id: "market", render: MarketSlide },
  { id: "business", render: BusinessModelSlide },
  { id: "team", render: TeamSlide },
  { id: "cta", render: CTASlideContent },
];

export default function PitchDeck() {
  const [current, setCurrent] = useState(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const navigate = useNavigate();

  const next = useCallback(() => setCurrent((c) => Math.min(c + 1, slides.length - 1)), []);
  const prev = useCallback(() => setCurrent((c) => Math.max(c - 1, 0)), []);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === " ") { e.preventDefault(); next(); }
      if (e.key === "ArrowLeft") { e.preventDefault(); prev(); }
      if (e.key === "Escape" && document.fullscreenElement) { document.exitFullscreen(); setIsFullscreen(false); }
      if (e.key === "f" || e.key === "F") toggleFullscreen();
    };
    window.addEventListener("keydown", handler);

    const fsHandler = () => { if (!document.fullscreenElement) setIsFullscreen(false); };
    document.addEventListener("fullscreenchange", fsHandler);

    return () => { window.removeEventListener("keydown", handler); document.removeEventListener("fullscreenchange", fsHandler); };
  }, [next, prev, toggleFullscreen]);

  const SlideContent = slides[current].render;

  return (
    <div className="h-screen w-screen bg-black flex flex-col overflow-hidden select-none">
      {/* Slide area */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={slides[current].id}
            initial={{ opacity: 0, x: 60 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -60 }}
            transition={{ duration: 0.35 }}
            className="absolute inset-0"
          >
            <SlideContent />
          </motion.div>
        </AnimatePresence>

        {/* Left / right click zones */}
        <button onClick={prev} className="absolute left-0 top-0 bottom-0 w-1/5 cursor-w-resize opacity-0 z-20" aria-label="Previous" />
        <button onClick={next} className="absolute right-0 top-0 bottom-0 w-1/5 cursor-e-resize opacity-0 z-20" aria-label="Next" />
      </div>

      {/* Bottom bar */}
      <div className="h-14 bg-black/90 border-t border-white/10 flex items-center justify-between px-4 shrink-0 z-30">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/")} className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors">
            <Home className="w-4 h-4" />
          </button>
          <button onClick={prev} disabled={current === 0} className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors disabled:opacity-30">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-white/60 text-sm font-mono min-w-[60px] text-center">
            {current + 1} / {slides.length}
          </span>
          <button onClick={next} disabled={current === slides.length - 1} className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors disabled:opacity-30">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Dots */}
        <div className="hidden md:flex items-center gap-1.5">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrent(i)}
              className={`w-2 h-2 rounded-full transition-all ${i === current ? "bg-pub-amber w-6" : "bg-white/20 hover:bg-white/40"}`}
            />
          ))}
        </div>

        <button onClick={toggleFullscreen} className="p-2 rounded-lg hover:bg-white/10 text-white/60 hover:text-white transition-colors">
          {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}
