import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import logoPub from "@/assets/logo-pub-new.png";
import dashboardMockup from "@/assets/dashboard-mockup.png";
import heroConstruction from "@/assets/hero-construction.jpg";
import "./PubAspekindoVideo.css";

const SCENES = [
  { duration: 5200, eyebrow: "PUB ASPEKINDO / 2024—25", title: "Industri konstruksi\nberubah cepat.", sub: "Apakah BUJK Anda siap?" },
  { duration: 4800, eyebrow: "THE NEW REALITY", title: "Regulasi berubah.\nTeknologi melaju.", sub: "Yang lambat beradaptasi, tertinggal di tender." },
  { duration: 5400, eyebrow: "A STRATEGIC PARTNER", title: "Satu platform.\nEmpat kesiapan.", sub: "PUB menyatukan keputusan penting BUJK Anda." },
  { duration: 6200, eyebrow: "01—02 / FOUNDATIONS", title: "Siap Legalitas.\nSiap Sertifikasi.", sub: "Dari perijinan hingga kompetensi personil — terpantau, terarah." },
  { duration: 6200, eyebrow: "03—04 / MOMENTUM", title: "Siap Tender.\nSiap Proyek.", sub: "Temukan peluang. Kelola risiko. Bangun reputasi." },
  { duration: 6000, eyebrow: "PUB ASPEKINDO", title: "Tumbuh dengan\nlebih siap.", sub: "Karena masa depan konstruksi tidak menunggu." },
] as const;

const ease = [0.16, 1, 0.3, 1] as const;

export default function PubAspekindoVideo() {
  const [scene, setScene] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = window.setTimeout(() => setScene((current) => (current + 1) % SCENES.length), SCENES[scene].duration);
    return () => window.clearTimeout(id);
  }, [scene]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((value) => value + 1), 50);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    setTick(0);
  }, [scene]);

  const progress = useMemo(() => {
    const elapsed = tick * 50;
    return Math.min(elapsed / SCENES[scene].duration, 1);
  }, [scene, tick]);

  const active = SCENES[scene];
  const readiness = [
    { no: "01", label: "LEGALITAS", detail: "Perijinan & SBU", tone: "gold" },
    { no: "02", label: "SERTIFIKASI", detail: "Kompetensi & LKUT", tone: "blue" },
    { no: "03", label: "TENDER", detail: "Marketplace & insight", tone: "gold" },
    { no: "04", label: "PROYEK", detail: "Risiko, budget & K3", tone: "blue" },
  ];

  return (
    <main className="pub-video" aria-label="PUB ASPEKINDO motion graphic">
      <div className="pub-video__grain" />
      <div className="pub-video__backdrop" style={{ backgroundImage: `url(${heroConstruction})` }} />
      <motion.div className="pub-video__wash" animate={{ x: scene % 2 ? "8%" : "-4%", opacity: scene === 0 ? 0.55 : 0.2 }} transition={{ duration: 1.3, ease }} />
      <motion.div className="pub-video__orb pub-video__orb--one" animate={{ x: [0, 38, 0], y: [0, -22, 0], scale: scene === 2 ? 1.4 : 1 }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} />
      <motion.div className="pub-video__orb pub-video__orb--two" animate={{ x: scene > 3 ? "-12vw" : "4vw", rotate: scene * 11 }} transition={{ duration: 1.1, ease }} />

      <header className="pub-video__header">
        <div className="pub-video__brand">
          <img src={logoPub} alt="PUB ASPEKINDO" />
          <span>ASPEKINDO</span>
        </div>
        <div className="pub-video__counter">
          <span>BUJK / READY INDEX</span>
          <strong>0{scene + 1}<i>/06</i></strong>
        </div>
      </header>

      <div className="pub-video__rail">
        <div className="pub-video__rail-line"><motion.span animate={{ height: `${progress * 100}%` }} transition={{ duration: 0.12 }} /></div>
        <div className="pub-video__rail-label">SIAP<br />UNTUK<br />BERUBAH</div>
      </div>

      <section className={`pub-video__stage scene-${scene}`}>
        <AnimatePresence mode="sync">
          <motion.div key={scene} className="pub-video__copy" initial={{ opacity: 0, y: 54, clipPath: "inset(0 0 100% 0)" }} animate={{ opacity: 1, y: 0, clipPath: "inset(0 0 0% 0)" }} exit={{ opacity: 0, y: -38, clipPath: "inset(0 0 100% 0)" }} transition={{ duration: 0.82, ease }}>
            <p className="pub-video__eyebrow"><span />{active.eyebrow}</p>
            <h1>{active.title.split("\n").map((line) => <span key={line}>{line}</span>)}</h1>
            <p className="pub-video__sub">{active.sub}</p>
          </motion.div>
        </AnimatePresence>

        <motion.div className="pub-video__asset" animate={{ x: scene === 0 ? "5vw" : scene === 1 ? "1vw" : scene > 3 ? "-2vw" : "3vw", y: scene === 2 ? "-2vh" : "0vh", rotate: scene === 4 ? -4 : 0 }} transition={{ duration: 1.1, ease }}>
          <div className="pub-video__asset-ring" />
          <img src={dashboardMockup} alt="" />
          <div className="pub-video__asset-caption"><span>LIVE / PUB OS</span><b>BUJK CONTROL CENTER</b></div>
        </motion.div>

        <motion.div className="pub-video__readiness" animate={{ opacity: scene >= 2 ? 1 : 0, y: scene >= 2 ? 0 : 24 }} transition={{ duration: 0.7, delay: 0.3, ease }}>
          {readiness.map((item, index) => (
            <motion.div className={`readiness readiness--${item.tone}`} key={item.no} animate={{ opacity: scene >= 2 ? 1 : 0.3, scale: scene === index + 3 ? 1.04 : 1 }} transition={{ duration: 0.45, delay: index * 0.08 }}>
              <span className="readiness__no">{item.no}</span><span><b>{item.label}</b><small>{item.detail}</small></span><i>↗</i>
            </motion.div>
          ))}
        </motion.div>

        <motion.div className="pub-video__stamp" animate={{ rotate: scene % 2 ? 8 : -8, scale: scene === 5 ? 1.12 : 1 }} transition={{ duration: 0.8, ease }}>
          <span>ASPEKINDO</span><strong>4<br /><em>SIAP</em></strong>
        </motion.div>
      </section>

      <footer className="pub-video__footer">
        <span>GROW / COMPLY / COMPETE</span>
        <span className="pub-video__progress"><i style={{ width: `${((scene + progress) / SCENES.length) * 100}%` }} /></span>
        <span>© PUB ASPEKINDO</span>
      </footer>
    </main>
  );
}