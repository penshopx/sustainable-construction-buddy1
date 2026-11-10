import { motion } from "framer-motion";
import { ArrowRight, BookOpenCheck, ExternalLink, GraduationCap, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

const learningSteps = [
  {
    icon: BookOpenCheck,
    title: "Pahami",
    description: "Kenali tujuan dan ruang lingkup pelaksanaan PUB.",
  },
  {
    icon: GraduationCap,
    title: "Pelajari",
    description: "Ikuti materi pembelajaran yang disusun untuk kebutuhan BUJK.",
  },
  {
    icon: Sparkles,
    title: "Terapkan",
    description: "Gunakan hasil belajar untuk memperkuat praktik dan dokumentasi usaha.",
  },
];

const siapFocuses = [
  {
    title: "Siap Legalitas",
    description: "Fondasi usaha dan dokumen legal.",
    externalHref: "https://lkpm.dokumenproyek.com/",
    externalLabel: "Buka LKPM — Legalitas & Perizinan",
  },
  { title: "Siap Sertifikasi", description: "Kegiatan PUB dan dokumen LKUT disiapkan untuk aplikasi resmi." },
  { title: "Siap Tender", description: "Kesiapan membaca dan mengikuti peluang." },
  { title: "Siap Proyek", description: "Kesiapan menjalankan pekerjaan secara tertib." },
];

export default function SiapPubSection() {
  return (
    <section id="siap-pub" className="relative overflow-hidden bg-[hsl(220,65%,11%)] py-20 text-white">
      <div className="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-pub-sky/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-pub-amber/10 blur-3xl" />

      <div className="container relative mx-auto px-6">
        <div className="grid items-center gap-10 lg:grid-cols-[1.05fr,0.95fr]">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-pub-amber/30 bg-pub-amber/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-pub-amber">
              <GraduationCap className="h-3.5 w-3.5" />
              Sesi Pembelajaran PUB
            </span>
            <h2 className="max-w-2xl text-3xl font-extrabold leading-tight font-heading md:text-5xl">
              SIAP PUB untuk{" "}
              <span className="text-pub-amber">belajar dan bertumbuh</span>
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-white/70 font-body md:text-lg">
              SIAP adalah payung Program PUB ASPEKINDO untuk membantu BUJK bertumbuh melalui
              empat fokus yang saling terhubung. LMS native mencatat pembelajaran dan bukti
              kegiatan; jalur eksternal tetap dibuka pada platform asal tanpa klaim SSO.
            </p>
            <div className="mt-6 grid max-w-2xl gap-2 sm:grid-cols-2">
              {siapFocuses.map((focus) => (
                <div key={focus.title} className="rounded-xl border border-white/10 bg-white/[0.04] p-3.5">
                  <p className="text-sm font-bold text-white">{focus.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-white/55">{focus.description}</p>
                  {focus.externalHref && focus.externalLabel && (
                    <a
                      href={focus.externalHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-pub-sky transition-colors hover:text-pub-amber focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-sky"
                      data-testid="link-lkpm-legalitas"
                      aria-label={`${focus.externalLabel}, layanan eksternal, buka di tab baru`}
                    >
                      {focus.externalLabel}
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                    </a>
                  )}
                </div>
              ))}
            </div>
            <Link
              to="/siap-kompetensi"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-gradient-amber px-6 py-3.5 font-bold text-accent-foreground shadow-amber transition-all hover:brightness-110"
            >
              Lihat Peta Kompetensi 4 SIAP
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="mt-3 text-xs text-white/45 font-body">
              Masuk diperlukan karena peta menggunakan data anggota dan bukti kegiatan Anda.
              Data Siap Sertifikasi hanya membantu persiapan dan tidak menduplikasi formulir
              atau menggantikan proses LKUT resmi Kementerian PU/LPJK.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl md:p-7"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pub-sky">
                  Alur pembelajaran
                </p>
                <h3 className="mt-2 text-xl font-bold font-heading md:text-2xl">
                  Sesi SIAP PUB
                </h3>
              </div>
              <div className="rounded-xl bg-pub-sky/15 p-3 text-pub-sky">
                <BookOpenCheck className="h-6 w-6" />
              </div>
            </div>

            <div className="space-y-3">
              {learningSteps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.title}
                    className="flex items-start gap-3 rounded-xl border border-white/10 bg-white/[0.035] p-4"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pub-amber/15 text-sm font-bold text-pub-amber">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-pub-sky" />
                        <p className="font-bold font-heading">{step.title}</p>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-white/55 font-body">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex items-center gap-2 border-t border-white/10 pt-5 text-xs text-white/50 font-body">
              <span className="h-2 w-2 rounded-full bg-pub-emerald" />
              Dirangkum dari pembelajaran, kegiatan PUB, LKUT, PANCEK, SMAP, dan data proyek
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}