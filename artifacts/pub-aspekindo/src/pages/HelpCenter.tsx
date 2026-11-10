import { useEffect } from "react";
import { BookOpen, CheckCircle2, ExternalLink, Info, LifeBuoy } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { trackHelpTopicSelected } from "@/lib/helpAnalytics";
import { getHelpSectionFromHash, helpSections, type HelpSectionId } from "@/lib/helpGuide";

const markerDetails = {
  internal: { label: "Fitur internal", className: "border-sky-300 bg-sky-100 text-sky-800 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200" },
  ecosystem: { label: "Satu ekosistem", className: "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200" },
  official: { label: "Kanal resmi", className: "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-200" },
  roadmap: { label: "Integrasi bertahap", className: "border-violet-300 bg-violet-100 text-violet-800 dark:border-violet-800 dark:bg-violet-950 dark:text-violet-200" },
} as const;

export default function HelpCenter() {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const section = getHelpSectionFromHash(hash);
    requestAnimationFrame(() => {
      document.getElementById(section)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [hash]);

  const goToSection = (id: HelpSectionId) => `/bantuan#${id}`;

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-16">
      <section className="overflow-hidden rounded-2xl bg-hero p-5 text-white shadow-hero md:p-8">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex items-center gap-2 text-pub-amber">
              <LifeBuoy className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-[0.16em]">Pusat Bantuan Anggota</span>
            </div>
            <h1 className="text-2xl font-extrabold md:text-4xl">Panduan penggunaan PUB ASPEKINDO</h1>
            <p className="mt-3 text-sm leading-6 text-white/75 md:text-base">
              Pilih fitur yang sedang digunakan untuk membuka instruksi ringkas. Panduan ini adalah materi penggunaan, bukan dokumen keputusan resmi.
            </p>
          </div>
          <Link
            to="/helpdesk"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-pub-amber px-4 py-3 text-sm font-bold text-pub-navy transition-transform hover:scale-[1.02]"
          >
            Tanya Pakar Cerdas <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section aria-labelledby="pilih-panduan">
        <h2 id="pilih-panduan" className="mb-3 text-xl font-bold">Pilih panduan fitur</h2>
        <nav className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {helpSections.map((section, index) => (
            <Link
              key={section.id}
              to={goToSection(section.id)}
              onClick={() => trackHelpTopicSelected(section.id)}
              className="rounded-xl border bg-card p-3 text-sm font-semibold text-card-foreground shadow-sm transition-colors hover:border-pub-sky hover:bg-pub-sky/5"
            >
              <span className="mr-2 text-pub-sky">{String(index + 1).padStart(2, "0")}</span>
              {section.title}
            </Link>
          ))}
        </nav>
      </section>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-5">
          {helpSections.map((section) => {
            const marker = markerDetails[section.marker ?? "internal"];
            return (
              <Card id={section.id} key={section.id} className="scroll-mt-4 overflow-hidden shadow-card">
                <CardHeader className="border-b bg-muted/35">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className={marker.className}>{marker.label}</Badge>
                  </div>
                  <CardTitle className="text-xl md:text-2xl">{section.title}</CardTitle>
                  <p className="text-sm leading-6 text-muted-foreground">{section.description}</p>
                </CardHeader>
                <CardContent className="space-y-4 pt-5">
                  <ol className="space-y-3">
                    {section.steps.map((step, index) => (
                      <li key={step} className="flex gap-3 text-sm leading-6">
                        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-pub-sky text-xs font-bold text-white">
                          {index + 1}
                        </span>
                        <span className="pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                  {section.note && (
                    <div className="flex gap-3 rounded-xl border border-pub-amber/35 bg-pub-amber/10 p-4 text-sm leading-6">
                      <Info className="mt-0.5 h-5 w-5 shrink-0 text-pub-amber" />
                      <p>{section.note}</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        <aside className="h-fit space-y-4 lg:sticky lg:top-4">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-4 w-4 text-pub-sky" /> Arti penanda</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              {Object.values(markerDetails).map((marker) => (
                <div key={marker.label} className="flex items-center gap-2">
                  <Badge variant="outline" className={marker.className}>{marker.label}</Badge>
                </div>
              ))}
              <p className="text-xs leading-5 text-muted-foreground">
                Aplikasi satu ekosistem dapat memakai domain atau akun terpisah. Kanal resmi tetap mengikuti lembaga berwenang. Fitur roadmap belum tentu aktif.
              </p>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/30 bg-emerald-500/5">
            <CardContent className="flex gap-3 pt-5 text-sm leading-6">
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-500" />
              <p>Mulai dari data yang paling mudah, simpan teratur, lalu gunakan 4 SIAP sebagai petunjuk perbaikan.</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}