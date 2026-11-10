import { motion } from "framer-motion";
import {
  ArrowUpRight,
  BookOpenCheck,
  CheckCircle2,
  ClipboardCheck,
  ExternalLink,
  FileSearch,
  Scale,
  ShieldCheck,
} from "lucide-react";

const qualityHabits = [
  {
    icon: ClipboardCheck,
    title: "Terdokumentasi",
    description: "Langkah kerja, keputusan, dan bukti disusun agar mudah ditelusuri.",
    accent: "border-pub-sky/25 bg-pub-sky/10 text-pub-sky",
  },
  {
    icon: FileSearch,
    title: "Terukur & ditinjau",
    description: "Kinerja dibaca melalui indikator, evaluasi berkala, dan temuan yang nyata.",
    accent: "border-pub-amber/25 bg-pub-amber/10 text-pub-amber",
  },
  {
    icon: CheckCircle2,
    title: "Terus ditingkatkan",
    description: "Perbaikan menjadi kebiasaan, bukan reaksi sesaat ketika audit atau tender tiba.",
    accent: "border-pub-emerald/25 bg-pub-emerald/10 text-pub-emerald",
  },
];

const governanceLinks = [
  {
    href: "https://iso.dokumenproyek.com",
    icon: BookOpenCheck,
    eyebrow: "Standar kualitas",
    title: "Penguatan Standar Berbasis ISO",
    description:
      "Pelajari cara menerjemahkan prinsip ISO menjadi kebiasaan kerja dan sistem manajemen yang lebih konsisten.",
    accent: "border-pub-sky/25 bg-pub-sky/[0.07] text-pub-sky",
    testId: "link-iso-quality-standards",
  },
  {
    href: "https://smap.dokumenproyek.com",
    icon: ShieldCheck,
    eyebrow: "Integritas proses",
    title: "Kepatuhan Anti Penyuapan",
    description:
      "Kenali Sistem Manajemen Anti Penyuapan dan rujukan ISO 37001 untuk memperkuat pengendalian risiko.",
    accent: "border-pub-emerald/25 bg-pub-emerald/[0.07] text-pub-emerald",
    testId: "link-anti-bribery-compliance",
  },
  {
    href: "https://lexcom.dokumenproyek.com/",
    icon: Scale,
    eyebrow: "Kejelasan keputusan",
    title: "Sesi Hukum & Kepatuhan",
    description:
      "Bawa pertanyaan regulasi dan praktik kepatuhan ke ruang belajar yang membantu BUJK bertindak lebih yakin.",
    accent: "border-pub-amber/25 bg-pub-amber/[0.07] text-pub-amber",
    testId: "link-legal-compliance-session",
  },
];

export default function QualityGovernanceSection() {
  return (
    <section
      id="mutu-tata-kelola"
      className="relative overflow-hidden bg-[hsl(220,65%,11%)] py-20 text-white md:py-24"
      data-testid="section-quality-governance"
    >
      <div className="pointer-events-none absolute -left-40 top-16 h-80 w-80 rounded-full bg-pub-sky/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-36 bottom-0 h-96 w-96 rounded-full bg-pub-emerald/10 blur-3xl" />

      <div className="container relative mx-auto px-6">
        <div className="grid gap-12 lg:grid-cols-[0.82fr,1.18fr] lg:items-start">
          <motion.div
            initial={{ opacity: 0, x: -18 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.55 }}
          >
            <span
              className="inline-flex items-center gap-2 rounded-full border border-pub-sky/30 bg-pub-sky/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-pub-sky"
              data-testid="text-quality-governance-eyebrow"
            >
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              Dari 4 SIAP menuju standar kerja
            </span>
            <h2
              className="mt-5 max-w-xl text-3xl font-extrabold leading-[1.08] font-heading md:text-5xl"
              data-testid="text-quality-governance-heading"
            >
              Kesiapan yang baik
              <span className="mt-2 block text-pub-amber">harus meninggalkan jejak.</span>
            </h2>
            <div
              className="mt-5 max-w-xl space-y-4 text-base leading-relaxed text-white/70 font-body md:text-lg"
              data-testid="text-quality-governance-narrative"
            >
              <p>
                PUB ASPEKINDO berkomitmen mendampingi BUJK membangun mutu, tata kelola, dan
                kepatuhan secara berkelanjutan. Empat SIAP menjadi fondasi; praktik kerja yang
                terdokumentasi, terukur, dapat ditinjau, dan terus ditingkatkan membuat fondasi
                itu benar-benar bekerja setiap hari.
              </p>
              <p className="text-white/55">
                Rujukan ISO membantu memperkuat sistem manajemen dan disiplin perbaikan. ISO bukan
                klaim sertifikasi otomatis, melainkan kerangka untuk menata cara kerja, bukti, dan
                evaluasi sesuai kebutuhan organisasi.
              </p>
            </div>

            <div className="mt-8 grid max-w-xl gap-2 sm:grid-cols-3" data-testid="list-quality-habits">
              {qualityHabits.map((habit, index) => {
                const Icon = habit.icon;
                return (
                  <motion.div
                    key={habit.title}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: index * 0.08 }}
                    className="rounded-xl border border-white/10 bg-white/[0.035] p-3.5"
                    data-testid={`card-quality-habit-${index + 1}`}
                  >
                    <span className={`inline-flex rounded-lg border p-2 ${habit.accent}`}>
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <p className="mt-3 text-sm font-bold font-heading">{habit.title}</p>
                    <p className="mt-1.5 text-xs leading-relaxed text-white/50 font-body">
                      {habit.description}
                    </p>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 18 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ delay: 0.1, duration: 0.55 }}
            className="rounded-2xl border border-white/10 bg-white/[0.045] p-5 shadow-2xl shadow-black/20 md:p-7"
            data-testid="panel-quality-governance-services"
          >
            <div className="mb-6 flex items-start justify-between gap-5">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pub-emerald">
                  Jalur penguatan
                </p>
                <h3 className="mt-2 text-2xl font-bold font-heading md:text-3xl">
                  Jadikan kepatuhan bagian dari cara kerja.
                </h3>
              </div>
              <div className="hidden rounded-xl bg-pub-emerald/15 p-3 text-pub-emerald sm:block">
                <ClipboardCheck className="h-6 w-6" aria-hidden="true" />
              </div>
            </div>

            <div className="space-y-3" data-testid="list-quality-governance-links">
              {governanceLinks.map((item) => {
                const Icon = item.icon;
                return (
                  <a
                    key={item.href}
                    href={item.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.035] p-4 transition-colors hover:border-white/25 hover:bg-white/[0.07] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-sky"
                    data-testid={item.testId}
                    aria-label={`${item.title}, layanan eksternal, buka di tab baru`}
                  >
                    <span className={`shrink-0 rounded-xl border p-3 ${item.accent}`}>
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
                        {item.eyebrow}
                      </span>
                      <span className="mt-1 flex items-center gap-2 font-bold font-heading">
                        {item.title}
                        <ExternalLink className="h-3.5 w-3.5 shrink-0 text-white/40" aria-hidden="true" />
                      </span>
                      <span className="mt-1 block text-sm leading-relaxed text-white/55 font-body">
                        {item.description}
                      </span>
                      <span className="mt-2 block text-xs font-semibold text-white/40" data-testid={`${item.testId}-external-label`}>
                        Layanan eksternal · buka di tab baru
                      </span>
                    </span>
                    <ArrowUpRight
                      className="h-5 w-5 shrink-0 text-white/35 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                      aria-hidden="true"
                    />
                  </a>
                );
              })}
            </div>

            <div
              className="mt-6 border-t border-white/10 pt-5 text-xs leading-relaxed text-white/45 font-body"
              data-testid="text-quality-governance-disclaimer"
            >
              Tautan ini mengarah ke layanan eksternal. PUB ASPEKINDO tidak mengklaim integrasi
              akun, SSO, kemitraan resmi, atau sertifikasi otomatis. Akses, akun, materi, dan
              ketentuan penggunaan mengikuti masing-masing layanan.
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}