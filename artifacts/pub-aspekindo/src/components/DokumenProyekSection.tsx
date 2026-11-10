import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowRight, ArrowUpRight, FileText, FolderCheck, ListChecks } from "lucide-react";

const DOKUMEN_PROYEK_URL = "https://dokumenproyek.com";

const steps = [
  {
    icon: ListChecks,
    title: "Susun",
    description: "Petakan kebutuhan dokumen sesuai tahap proyek yang sedang berjalan.",
  },
  {
    icon: FolderCheck,
    title: "Kelola",
    description: "Simpan dan rapikan dokumen proyek dalam satu tempat yang tertib.",
  },
  {
    icon: FileText,
    title: "Siap Pakai",
    description: "Dokumen selalu siap ditindaklanjuti saat dibutuhkan tim proyek.",
  },
];

export default function DokumenProyekSection() {
  return (
    <section className="py-20 bg-muted/30">
      <div className="container mx-auto px-6">
        <div className="grid items-center gap-10 lg:grid-cols-[0.95fr,1.05fr]">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="order-2 lg:order-1 rounded-2xl border border-border bg-card p-5 shadow-card md:p-7"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pub-sky">
                  Alur administrasi
                </p>
                <h3 className="mt-2 text-xl font-bold font-heading text-foreground md:text-2xl">
                  DokumenProyek
                </h3>
              </div>
              <div className="rounded-xl bg-pub-sky/15 p-3 text-pub-sky">
                <FileText className="h-6 w-6" />
              </div>
            </div>

            <div className="space-y-3">
              {steps.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.title}
                    className="flex items-start gap-3 rounded-xl border border-border bg-muted/40 p-4"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-pub-sky/15 text-sm font-bold text-pub-sky">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-pub-sky" />
                        <p className="font-bold font-heading text-foreground">{step.title}</p>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground font-body">
                        {step.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-5 flex items-center gap-2 border-t border-border pt-5 text-xs text-muted-foreground font-body">
              <span className="h-2 w-2 rounded-full bg-pub-emerald" />
              Layanan pihak ketiga · dokumenproyek.com
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="order-1 lg:order-2"
          >
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-pub-sky/30 bg-pub-sky/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-pub-sky">
              <FolderCheck className="h-3.5 w-3.5" />
              Siap Proyek
            </span>
            <h2 className="max-w-2xl text-3xl font-extrabold leading-tight font-heading text-foreground md:text-5xl">
              DokumenProyek untuk{" "}
              <span className="text-pub-sky">administrasi proyek lebih tertib</span>
            </h2>
            <p className="mt-5 max-w-xl text-base leading-relaxed text-muted-foreground font-body md:text-lg">
              Sebagai bagian dari kesiapan menjalankan proyek (Siap Proyek), DokumenProyek membantu
              BUJK menyusun dan mengelola dokumen administrasi proyek konstruksi. Ini adalah layanan
              pihak ketiga untuk kebutuhan administrasi — bukan bagian dari persyaratan LKUT, PANCEK,
              atau SMAP.
            </p>
            <a
              href={DOKUMEN_PROYEK_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-7 inline-flex items-center gap-2 rounded-xl bg-pub-sky px-6 py-3.5 font-bold text-white shadow-card transition-all hover:brightness-110"
            >
              Buka DokumenProyek
              <ArrowUpRight className="h-4 w-4" />
            </a>
            <p className="mt-3 text-xs text-muted-foreground font-body">
              Anda akan melanjutkan ke dokumenproyek.com di tab baru.
            </p>
            <Link
              to="/bedah-dokumen"
              data-testid="link-home-bedah-dokumen"
              className="group mt-6 flex max-w-xl items-center justify-between gap-4 rounded-xl border border-pub-amber/40 bg-pub-amber/5 px-5 py-4 transition-all hover:-translate-y-0.5 hover:border-pub-amber"
            >
              <span>
                <span className="block font-heading font-bold text-foreground">Bedah Dokumen</span>
                <span className="block text-sm text-muted-foreground">Telaah dokumen tender, SKK/SBU, kontrak, dan gambar teknis dari Ruang Simpan Anda dengan bantuan AI.</span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-pub-amber transition-transform group-hover:translate-x-1" />
            </Link>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
