import { motion } from "framer-motion";
import { PlayCircle } from "lucide-react";

const ProjectVideoSection = () => {
  return (
    <section id="video-pub" className="relative overflow-hidden bg-[hsl(220,65%,9%)] py-20 text-white">
      <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-pub-sky/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-pub-amber/10 blur-3xl" />

      <div className="container relative mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto mb-10 max-w-2xl text-center"
        >
          <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-pub-amber/30 bg-pub-amber/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-pub-amber">
            <PlayCircle className="h-3.5 w-3.5" />
            30 Detik Memahami PUB
          </span>
          <h2 className="text-3xl font-extrabold leading-tight font-heading md:text-5xl">
            Regulasi, Teknologi, dan Tren Bisnis{" "}
            <span className="text-pub-amber">Terus Bergerak</span>
          </h2>
          <p className="mt-5 text-base leading-relaxed text-white/70 font-body md:text-lg">
            Tonton bagaimana PUB ASPEKINDO menyiapkan BUJK menghadapi perubahan lewat kerangka 4 Siap — Legalitas, Sertifikasi, Tender, dan Proyek.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="mx-auto aspect-video w-full max-w-4xl overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50 ring-1 ring-white/5"
        >
          <iframe
            src="/video-pub-aspekindo"
            title="Video PUB ASPEKINDO — 4 Siap menghadapi perubahan industri konstruksi"
            className="h-full w-full border-0"
            loading="lazy"
          />
        </motion.div>
      </div>
    </section>
  );
};

export default ProjectVideoSection;
