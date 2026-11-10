import { motion } from "framer-motion";
import {
  ArrowRight,
  ArrowUpRight,
  BriefcaseBusiness,
  CheckCircle2,
  ExternalLink,
  FolderKanban,
  LockKeyhole,
  Map,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Link } from "react-router-dom";

const readinessTracks = [
  {
    label: "Siap Legalitas",
    description: "Fondasi usaha dan dokumen yang tertata.",
    icon: ShieldCheck,
    tone: "text-pub-sky bg-pub-sky/10 border-pub-sky/20",
  },
  {
    label: "Siap Sertifikasi",
    description: "Kompetensi dan bukti yang semakin kuat.",
    icon: CheckCircle2,
    tone: "text-pub-emerald bg-pub-emerald/10 border-pub-emerald/20",
  },
  {
    label: "Siap Tender",
    description: "Membaca peluang dengan lebih terarah.",
    icon: Map,
    tone: "text-pub-amber bg-pub-amber/10 border-pub-amber/20",
  },
  {
    label: "Siap Proyek",
    description: "Masuk ke pengelolaan dan pelaksanaan.",
    icon: FolderKanban,
    tone: "text-pub-sky bg-pub-sky/10 border-pub-sky/20",
  },
];

const ecosystemLinks = [
  {
    href: "https://sistem-manajemen-proyek-konstruksi.replit.app/",
    title: "Sistem Manajemen Proyek Konstruksi",
    description: "Ruang untuk membantu mengelola pekerjaan proyek secara lebih terstruktur.",
    icon: FolderKanban,
    accent: "border-pub-sky/25 bg-pub-sky/10 text-pub-sky",
    testId: "link-project-management-system",
  },
  {
    href: "https://tukanghub.dokumenproyek.com",
    title: "Kerja Proyek",
    description: "Temukan jalur kerja dan kebutuhan tenaga untuk proyek yang relevan.",
    icon: BriefcaseBusiness,
    accent: "border-pub-emerald/25 bg-pub-emerald/10 text-pub-emerald",
    testId: "link-project-work",
  },
  {
    href: "https://rancang.dokumenproyek.com",
    title: "Rancang Bangun",
    description: "Eksplorasi ruang kolaborasi untuk merancang solusi konstruksi.",
    icon: Sparkles,
    accent: "border-pub-amber/25 bg-pub-amber/10 text-pub-amber",
    testId: "link-design-build",
  },
];

export default function ProjectEcosystemSection() {
  return (
    <section
      id="ekosistem-proyek"
      className="relative overflow-hidden bg-[hsl(220,65%,11%)] py-20 text-white md:py-24"
      data-testid="section-project-ecosystem"
    >
      <div className="pointer-events-none absolute -left-32 top-12 h-80 w-80 rounded-full bg-pub-sky/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-96 w-96 rounded-full bg-pub-amber/10 blur-3xl" />

      <div className="container relative mx-auto px-6">
        <div className="grid gap-12 lg:grid-cols-[0.9fr,1.1fr] lg:items-start">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
          >
            <span
              className="mb-4 inline-flex items-center gap-2 rounded-full border border-pub-emerald/30 bg-pub-emerald/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-pub-emerald"
              data-testid="text-project-ecosystem-eyebrow"
            >
              <BriefcaseBusiness className="h-3.5 w-3.5" aria-hidden="true" />
              Dari siap menjadi berdaya
            </span>
            <h2
              className="max-w-xl text-3xl font-extrabold leading-[1.08] font-heading md:text-5xl"
              data-testid="text-project-ecosystem-heading"
            >
              4 SIAP bukan garis akhir.
              <span className="mt-2 block text-pub-sky">Ini pintu masuk ke proyek nyata.</span>
            </h2>
            <p
              className="mt-5 max-w-xl text-base leading-relaxed text-white/70 font-body md:text-lg"
              data-testid="text-project-ecosystem-description"
            >
              PUB ASPEKINDO menghubungkan kesiapan Legalitas, Sertifikasi, Tender, dan Proyek
              dengan pembelajaran serta jalur kerja yang relevan. Saat BUJK semakin siap,
              langkah berikutnya adalah mengelola pekerjaan dengan rapi dan menemukan peluang
              konstruksi yang sesuai.
            </p>

            <div className="mt-8 grid max-w-xl grid-cols-1 gap-2 sm:grid-cols-2" data-testid="list-readiness-tracks">
              {readinessTracks.map((track, index) => {
                const Icon = track.icon;
                return (
                  <motion.div
                    key={track.label}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.06 }}
                    className="rounded-xl border border-white/10 bg-white/[0.035] p-3.5"
                    data-testid={`card-readiness-track-${index + 1}`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span className={`rounded-lg border p-2 ${track.tone}`}>
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <p className="text-sm font-bold font-heading">{track.label}</p>
                    </div>
                    <p className="mt-2 pl-11 text-xs leading-relaxed text-white/50 font-body">
                      {track.description}
                    </p>
                  </motion.div>
                );
              })}
            </div>

          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: 0.1 }}
            className="rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20 md:p-7"
            data-testid="panel-project-opportunities"
          >
            <div className="mb-6 flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pub-sky">
                  Jalur setelah kesiapan
                </p>
                <h3 className="mt-2 text-2xl font-bold font-heading md:text-3xl">
                  Kelola. Hubungkan. Kerjakan.
                </h3>
              </div>
              <div className="hidden rounded-xl bg-pub-sky/15 p-3 text-pub-sky sm:block">
                <FolderKanban className="h-6 w-6" aria-hidden="true" />
              </div>
            </div>

            <div className="space-y-3" data-testid="list-project-ecosystem-links">
              {ecosystemLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.title}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.035] p-4 transition-colors hover:border-white/25 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-sky"
                    data-testid={item.testId}
                    aria-label={`${item.title}, buka di tab baru`}
                  >
                    <span className={`shrink-0 rounded-xl border p-3 ${item.accent}`}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-bold font-heading">
                        {item.title}
                        <ExternalLink className="h-3.5 w-3.5 text-white/40" aria-hidden="true" />
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-white/55 font-body">
                        {item.description}
                      </span>
                    </span>
                    <ArrowUpRight className="h-5 w-5 shrink-0 text-white/35 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
                  </a>
                );
              })}
              <Link
                to="/siap-kompetensi"
                className="group flex items-center gap-4 rounded-xl border border-pub-amber/25 bg-pub-amber/10 p-4 transition-colors hover:border-pub-amber/45 hover:bg-pub-amber/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-amber"
                data-testid="link-tender-readiness-map"
              >
                <span className="shrink-0 rounded-xl border border-pub-amber/25 bg-pub-amber/10 p-3 text-pub-amber">
                  <Map className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="font-bold font-heading">Informasi Tender</span>
                  <span className="mt-1 block text-sm leading-relaxed text-white/55 font-body">
                    Buka peta kesiapan Tender dan indikator pendukung yang tersedia di dashboard PUB.
                  </span>
                  <span
                    className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-pub-amber"
                    data-testid="text-tender-login-required"
                  >
                    <LockKeyhole className="h-3.5 w-3.5" aria-hidden="true" />
                    Layanan internal · masuk diperlukan
                  </span>
                </span>
                <ArrowRight className="h-5 w-5 shrink-0 text-pub-amber transition-transform group-hover:translate-x-1" aria-hidden="true" />
              </Link>
            </div>

            <div
              className="mt-6 border-t border-white/10 pt-5 text-xs leading-relaxed text-white/45 font-body"
              data-testid="text-external-services-disclaimer"
            >
              Tautan di atas membawa Anda ke layanan eksternal. Ketersediaan, akun, dan ketentuan
              penggunaannya mengikuti masing-masing layanan; PUB ASPEKINDO tidak mengklaim
              integrasi akun, SSO, atau kemitraan resmi.
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}