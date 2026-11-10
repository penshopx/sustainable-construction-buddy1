import { useEffect } from "react";
import { ArrowLeft, CircleHelp, FileCheck2, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";
import ReadinessSimulator, { SIMULATOR_CONFIGS, type ReadinessKind } from "@/components/ReadinessSimulator";
import { trackHelpCenterOpened } from "@/lib/helpAnalytics";
import { getHelpHrefForPath } from "@/lib/helpGuide";

export default function ReadinessSimulatorPage({ kind }: { kind: ReadinessKind }) {
  const config = SIMULATOR_CONFIGS[kind];

  useEffect(() => {
    document.title = `${config.eyebrow} | PUB ASPEKINDO`;
  }, [config.eyebrow]);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-white/10 bg-gradient-to-br from-pub-navy via-pub-navy to-pub-navy-light px-6 py-8 text-white md:py-12">
        <div className="container mx-auto max-w-5xl">
          <div className="mb-8 flex items-center justify-between gap-4">
            <Link to="/" className="inline-flex items-center gap-2 text-sm text-white/70 transition-colors hover:text-white">
              <ArrowLeft className="h-4 w-4" /> Kembali ke halaman utama
            </Link>
            <Link
              to={getHelpHrefForPath(`/simulator-${kind}`)}
              onClick={() => trackHelpCenterOpened(`/simulator-${kind}`)}
              className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-white/20 px-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              <CircleHelp className="h-4 w-4 text-pub-amber" />
              <span className="hidden sm:inline">Panduan fitur ini</span>
            </Link>
          </div>
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/10 text-pub-amber">
              {kind === "sbu" ? <ShieldCheck className="h-6 w-6" /> : <FileCheck2 className="h-6 w-6" />}
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-pub-amber">{config.eyebrow}</p>
              <h1 className="mt-2 max-w-3xl text-3xl font-extrabold leading-tight font-heading md:text-5xl">{config.title}</h1>
              <p className="mt-4 max-w-3xl text-base leading-relaxed text-white/70 md:text-lg">
                Persiapan yang lebih terarah melalui Program PUB ASPEKINDO.
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto max-w-5xl px-6 py-10 md:py-14">
        <ReadinessSimulator kind={kind} />
      </main>
    </div>
  );
}