import { motion } from "framer-motion";
import {
  ArrowRight,
  BookOpenCheck,
  Compass,
  Gauge,
  LayoutDashboard,
  ListChecks,
  Newspaper,
} from "lucide-react";
import { Link } from "react-router-dom";

const journey = [
  {
    step: "01",
    title: "Temukan",
    description: "Baca informasi dan agenda yang dikelola oleh admin PUB ASPEKINDO.",
    href: "/informasi",
    action: "Buka informasi",
    icon: Newspaper,
    tone: "border-pub-sky/20 bg-pub-sky/[0.06] text-pub-sky",
  },
  {
    step: "02",
    title: "Navigasi",
    description: "Gunakan Helpdesk untuk menerjemahkan kebutuhan awal menjadi jalur tindakan.",
    href: "/helpdesk-standalone",
    action: "Mulai navigasi",
    icon: Compass,
    tone: "border-pub-emerald/20 bg-pub-emerald/[0.06] text-pub-emerald",
  },
  {
    step: "03",
    title: "Lengkapi",
    description: "Catat progres, data kegiatan, dan bukti pendukung pada dashboard anggota.",
    href: "/dashboard",
    action: "Buka dashboard",
    icon: LayoutDashboard,
    tone: "border-pub-amber/20 bg-pub-amber/[0.06] text-pub-amber",
  },
  {
    step: "04",
    title: "Belajar",
    description: "Ikuti pelajaran, kuis, dan kegiatan PUB yang tersedia di LMS ASPEKINDO.",
    href: "/aspekindo-lms",
    action: "Masuk ke LMS",
    icon: BookOpenCheck,
    tone: "border-pub-violet/20 bg-pub-violet/[0.06] text-pub-violet",
  },
  {
    step: "05",
    title: "Ukur",
    description: "Bedakan skor hasil evaluasi dan cakupan data pada Peta Kompetensi 4 SIAP.",
    href: "/siap-kompetensi",
    action: "Lihat peta",
    icon: Gauge,
    tone: "border-pub-sky/20 bg-pub-sky/[0.06] text-pub-sky",
  },
  {
    step: "06",
    title: "Tindak Lanjuti",
    description: "Gunakan hasil pemetaan untuk menata LKUT, proyek, risiko, dan prioritas perbaikan.",
    href: "/lkut",
    action: "Siapkan LKUT",
    icon: ListChecks,
    tone: "border-pub-emerald/20 bg-pub-emerald/[0.06] text-pub-emerald",
  },
];

const EngineCards = () => {
  return (
    <section id="perjalanan-anggota" className="bg-muted/30 py-20">
      <div className="container mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto mb-14 max-w-3xl text-center"
        >
          <span className="text-sm font-semibold uppercase tracking-wider text-pub-amber font-heading">
            Satu Perjalanan Anggota
          </span>
          <h2 className="mt-2 text-3xl font-bold text-foreground font-heading md:text-5xl">
            Dari kebutuhan menuju tindakan
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground font-body md:text-lg">
            PUB ASPEKINDO membantu anggota bergerak melalui enam langkah yang jelas.
            Setiap hasil tetap menjadi alat bantu persiapan; keputusan resmi berada pada
            lembaga yang berwenang.
          </p>
        </motion.div>

        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {journey.map((item, index) => {
            const Icon = item.icon;
            return (
              <motion.div
                key={item.step}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06 }}
              >
                <Link
                  to={item.href}
                  className="group flex h-full flex-col rounded-2xl border border-border bg-card p-6 shadow-card transition-all hover:-translate-y-1 hover:border-pub-sky/30 hover:shadow-card-hover"
                >
                  <div className="flex items-start justify-between gap-4">
                    <span className={`inline-flex rounded-xl border p-3 ${item.tone}`}>
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <span className="text-sm font-black tracking-[0.16em] text-muted-foreground/50 font-heading">
                      {item.step}
                    </span>
                  </div>
                  <h3 className="mt-5 text-xl font-bold text-foreground font-heading">{item.title}</h3>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground font-body">
                    {item.description}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-pub-navy transition-colors group-hover:text-pub-sky dark:text-white">
                    {item.action}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default EngineCards;