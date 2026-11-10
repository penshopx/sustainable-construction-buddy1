import { motion } from "framer-motion";
import { ArrowUpRight, Award, UsersRound } from "lucide-react";

const skkLinks = [
  {
    href: "https://asdamkindo.id/anggota/",
    icon: UsersRound,
    eyebrow: "Dukungan keanggotaan",
    title: "Portal Keanggotaan (KTA) ASDAMKINDO",
    description: "Akses portal keanggotaan ASDAMKINDO yang terkait dengan persiapan sesi SKK.",
    className: "border-pub-sky/25 bg-pub-sky/[0.06] hover:border-pub-sky/50",
    iconClassName: "bg-pub-sky/15 text-pub-sky",
  },
  {
    href: "https://lspsdmkonstruksi.com/",
    icon: Award,
    eyebrow: "Sertifikasi kompetensi",
    title: "Sertifikasi Kompetensi Kerja (SKK) LSP SDMKI",
    description: "Lanjutkan ke layanan LSP SDMKI untuk informasi dan proses sertifikasi kompetensi kerja.",
    className: "border-pub-amber/25 bg-pub-amber/[0.06] hover:border-pub-amber/50",
    iconClassName: "bg-pub-amber/15 text-pub-amber",
  },
];

export default function SkkSection() {
  return (
    <section id="sesi-skk" className="relative overflow-hidden bg-muted/30 py-20">
      <div className="pointer-events-none absolute -left-24 top-0 h-64 w-64 rounded-full bg-pub-sky/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 bottom-0 h-72 w-72 rounded-full bg-pub-amber/10 blur-3xl" />

      <div className="container relative mx-auto px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mx-auto mb-10 max-w-3xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-pub-amber/25 bg-pub-amber/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-pub-amber">
            <Award className="h-3.5 w-3.5" aria-hidden="true" />
            Sesi SKK
          </span>
          <h2 className="mt-4 text-3xl font-extrabold leading-tight font-heading text-foreground md:text-5xl">
            Dukungan untuk{" "}
            <span className="text-gradient-hero">kompetensi personil BUJK</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground font-body md:text-lg">
            Temukan akses keanggotaan dan sertifikasi kompetensi yang relevan
            untuk memperkuat kesiapan personil dalam Program PUB ASPEKINDO.
          </p>
        </motion.div>

        <div className="mx-auto grid max-w-5xl gap-5 md:grid-cols-2">
          {skkLinks.map((link, index) => {
            const Icon = link.icon;
            return (
              <motion.a
                key={link.href}
                href={link.href}
                target="_blank"
                rel="noopener noreferrer"
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className={`group flex h-full items-start gap-4 rounded-2xl border p-6 shadow-card transition-all hover:-translate-y-1 hover:shadow-card-hover ${link.className}`}
              >
                <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${link.iconClassName}`}>
                  <Icon className="h-6 w-6" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{link.eyebrow}</p>
                  <h3 className="mt-1 flex items-start gap-2 text-lg font-bold leading-snug font-heading text-foreground">
                    <span>{link.title}</span>
                    <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" aria-hidden="true" />
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{link.description}</p>
                  <p className="mt-4 text-xs text-muted-foreground/80">Akan membuka situs eksternal di tab baru.</p>
                </div>
              </motion.a>
            );
          })}
        </div>
      </div>
    </section>
  );
}