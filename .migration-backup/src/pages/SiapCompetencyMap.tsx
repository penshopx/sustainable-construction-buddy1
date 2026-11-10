import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  CheckCircle2,
  ChevronDown,
  CircleAlert,
  Clock3,
  FileSearch,
  Info,
  Layers3,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Target,
  TriangleAlert,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useSiapCompetencyMap } from "@/hooks/useSiapCompetencyMap";
import type {
  SiapDimensionResult,
  SiapIndicator,
  SiapReadinessStatus,
} from "@/lib/siapCompetencyEngine";

const focusStyles: Record<string, { accent: string; soft: string; icon: typeof ShieldCheck }> = {
  legalitas: { accent: "text-pub-sky", soft: "bg-pub-sky/10 border-pub-sky/20", icon: ShieldCheck },
  sertifikasi: { accent: "text-pub-violet", soft: "bg-pub-violet/10 border-pub-violet/20", icon: Layers3 },
  tender: { accent: "text-pub-amber", soft: "bg-pub-amber/10 border-pub-amber/20", icon: Target },
  proyek: { accent: "text-pub-emerald", soft: "bg-pub-emerald/10 border-pub-emerald/20", icon: FileSearch },
};

const statusMeta: Record<SiapReadinessStatus, { label: string; className: string }> = {
  "belum-ada-data": { label: "Belum ada data", className: "bg-muted text-muted-foreground border-border" },
  "perlu-dilengkapi": { label: "Perlu dilengkapi", className: "bg-destructive/10 text-destructive border-destructive/25" },
  berkembang: { label: "Berkembang", className: "bg-pub-amber/10 text-pub-amber border-pub-amber/25" },
  siap: { label: "Siap ditinjau", className: "bg-pub-emerald/10 text-pub-emerald border-pub-emerald/25" },
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Belum diperbarui";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Belum diperbarui";
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function StatusBadge({ status }: { status: SiapReadinessStatus }) {
  const meta = statusMeta[status];
  return <Badge variant="outline" className={`rounded-full text-[11px] font-semibold ${meta.className}`}>{meta.label}</Badge>;
}

function IndicatorRow({ item, onOpen }: { item: SiapIndicator; onOpen: (href: string) => void }) {
  const progress = item.progress === null ? null : Math.round(item.progress);
  return (
    <div className="group border-t border-border/60 py-4 first:border-t-0 first:pt-0 last:pb-0">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${item.available ? "bg-pub-sky/10 text-pub-sky" : "bg-muted text-muted-foreground"}`}>
          {item.available ? <CheckCircle2 className="h-4 w-4" /> : <CircleAlert className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
            <span className="text-[11px] text-muted-foreground">{item.source}</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.detail}</p>
          <div className="mt-3 flex items-center gap-3">
            <Progress value={progress ?? 0} className="h-1.5 bg-muted" />
            <span className="w-10 text-right text-xs font-semibold text-foreground">{progress === null ? "—" : `${progress}%`}</span>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3">
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Clock3 className="h-3 w-3" /> {formatDate(item.updatedAt)}
            </span>
            <button
              type="button"
              onClick={() => onOpen(item.href)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-pub-sky opacity-80 transition-opacity hover:opacity-100"
            >
              Buka sumber <ArrowUpRight className="h-3 w-3" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DimensionCard({ dimension, onOpen }: { dimension: SiapDimensionResult; onOpen: (href: string) => void }) {
  const [expanded, setExpanded] = useState(true);
  const style = focusStyles[dimension.focus] ?? focusStyles.legalitas;
  const Icon = style.icon;
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="overflow-hidden rounded-2xl border border-border bg-card shadow-card"
    >
      <div className={`border-b px-5 py-5 md:px-6 ${style.soft}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-background/70 ${style.accent}`}>
              <Icon className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-heading text-lg font-bold text-foreground">{dimension.label}</h2>
                <StatusBadge status={dimension.status} />
              </div>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-muted-foreground">{dimension.description}</p>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <p className={`font-heading text-2xl font-bold ${style.accent}`}>{dimension.score === null ? "—" : dimension.score}</p>
            <p className="text-[10px] uppercase tracking-[0.12em] text-muted-foreground">skor</p>
          </div>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <div className="flex-1">
            <div className="mb-1.5 flex justify-between text-[11px] text-muted-foreground">
              <span>Cakupan data</span><span className="font-semibold text-foreground">{dimension.coverage}%</span>
            </div>
            <Progress value={dimension.coverage} className="h-2 bg-background/70" />
          </div>
        </div>
      </div>
      <div className="px-5 py-5 md:px-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">Indikator kesiapan</h3>
          <button type="button" onClick={() => setExpanded((value) => !value)} className="inline-flex items-center gap-1 text-xs font-semibold text-pub-sky">
            {expanded ? "Sembunyikan" : "Tampilkan"} <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
        {expanded && (
          <div className="mt-4">
            {dimension.indicators.length > 0 ? dimension.indicators.map((item) => <IndicatorRow key={item.id} item={item} onOpen={onOpen} />) : (
              <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">Belum ada indikator untuk dimensi ini.</div>
            )}
          </div>
        )}
        <div className="mt-5 rounded-xl bg-muted/50 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Prioritas berikutnya</p>
          {dimension.recommendations.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {dimension.recommendations.map((recommendation) => (
                <li key={`${recommendation.href}-${recommendation.text}`} className="flex flex-col gap-2 rounded-lg border border-border/70 bg-background/60 p-3 text-sm leading-relaxed text-foreground sm:flex-row sm:items-center sm:justify-between">
                  <span className="flex gap-2">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-pub-amber" />
                    {recommendation.text}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpen(recommendation.href)}
                    className="inline-flex shrink-0 items-center gap-1 self-start text-xs font-semibold text-pub-sky sm:self-auto"
                  >
                    {recommendation.label} <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          ) : <p className="mt-2 text-sm text-muted-foreground">Belum ada rekomendasi tambahan.</p>}
        </div>
      </div>
    </motion.article>
  );
}

function LoadingState() {
  return <div className="space-y-5" aria-label="Memuat peta kompetensi"><div className="h-56 animate-pulse rounded-2xl bg-muted" /><div className="grid gap-5 md:grid-cols-2"><div className="h-96 animate-pulse rounded-2xl bg-muted" /><div className="h-96 animate-pulse rounded-2xl bg-muted" /></div></div>;
}

const SiapCompetencyMap = () => {
  const navigate = useNavigate();
  const { data, isLoading, isError, error, refetch, isFetching } = useSiapCompetencyMap();
  const [activeFocus, setActiveFocus] = useState<string>("semua");
  const dimensions = useMemo(() => data?.dimensions ?? [], [data?.dimensions]);
  const visibleDimensions = activeFocus === "semua" ? dimensions : dimensions.filter((item) => item.focus === activeFocus);

  if (isLoading) return <div className="mx-auto max-w-6xl"><LoadingState /></div>;
  if (isError) return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-destructive/30 bg-card p-8 text-center shadow-card">
      <TriangleAlert className="mx-auto h-10 w-10 text-destructive" />
      <h1 className="mt-4 font-heading text-xl font-bold text-foreground">Peta kompetensi belum dapat dimuat</h1>
      <p className="mt-2 text-sm text-muted-foreground">{error instanceof Error ? error.message : "Terjadi kendala saat membaca data kesiapan Anda."}</p>
      <button type="button" onClick={() => void refetch()} className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90"><RefreshCw className="h-4 w-4" /> Coba lagi</button>
    </div>
  );
  if (!data || dimensions.length === 0) return (
    <div className="mx-auto max-w-2xl rounded-2xl border border-dashed border-border bg-card p-8 text-center shadow-card">
      <Info className="mx-auto h-10 w-10 text-pub-sky" />
      <h1 className="mt-4 font-heading text-xl font-bold text-foreground">Belum ada peta kompetensi</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Data aktivitas, dokumen, atau proyek Anda belum cukup untuk membentuk snapshot kesiapan. Lengkapi data di area yang tersedia, lalu muat ulang halaman ini.</p>
      <button type="button" onClick={() => void refetch()} className="mt-6 inline-flex items-center gap-2 rounded-lg border border-border px-4 py-2 text-sm font-semibold text-foreground hover:bg-muted"><RefreshCw className="h-4 w-4" /> Muat ulang data</button>
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl space-y-5 pb-8">
      <section className="relative overflow-hidden rounded-2xl bg-hero px-5 py-7 text-primary-foreground shadow-card md:px-8 md:py-9">
        <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full border-[32px] border-pub-sky/10" />
        <div className="relative max-w-3xl">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-pub-sky"><Sparkles className="h-4 w-4" /> SIAP / Kompetensi</div>
          <div className="mt-4 flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <h1 className="font-heading text-3xl font-bold tracking-tight md:text-4xl">Peta kesiapan usaha</h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-primary-foreground/70 md:text-base">Satu pandangan yang dapat dijelaskan untuk membaca posisi Anda pada Legalitas, Sertifikasi, Tender, dan Proyek.</p>
            </div>
            <div className="flex items-end gap-7">
              <div><p className="text-xs text-primary-foreground/55">Skor keseluruhan</p><p className="mt-1 font-heading text-4xl font-bold text-pub-sky">{data.overallScore === null ? "—" : data.overallScore}</p></div>
              <div><p className="text-xs text-primary-foreground/55">Cakupan data</p><p className="mt-1 font-heading text-2xl font-bold">{data.overallCoverage}%</p></div>
            </div>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <StatusBadge status={data.status} />
            <span className="text-xs text-primary-foreground/55">Snapshot dibuat {formatDate(data.generatedAt)}</span>
            <button type="button" onClick={() => void refetch()} disabled={isFetching} className="ml-auto inline-flex items-center gap-2 rounded-lg border border-primary-foreground/15 px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary-foreground/10 disabled:opacity-60"><RefreshCw className={`h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} /> Perbarui</button>
          </div>
        </div>
      </section>

      <div className="flex items-start gap-3 rounded-xl border border-pub-sky/20 bg-pub-sky/5 px-4 py-3 text-sm text-foreground">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-pub-sky" />
        <p><span className="font-semibold">Catatan penting:</span> peta ini adalah snapshot panduan berbasis data yang tersedia, bukan keputusan sertifikasi resmi, verifikasi legal, atau jaminan kelayakan tender.</p>
      </div>
      {dimensions.length < 4 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-300/25 bg-amber-400/5 px-4 py-3 text-sm text-foreground">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-pub-amber" />
          <p><span className="font-semibold">Snapshot sebagian:</span> baru {dimensions.length} dari 4 dimensi tersedia. Hasil dapat berubah setelah data dimensi lain tersedia.</p>
        </div>
      )}
      {data.insight && data.insight.recommendations.length > 0 && (
        <section className="rounded-2xl border border-pub-violet/20 bg-pub-violet/5 p-5 shadow-card md:p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pub-violet/10 text-pub-violet">
              <Sparkles className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="font-heading text-base font-bold text-foreground">Rekomendasi prioritas</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {data.insight.source === "connected"
                      ? "Dirangkum dari konteks minimum yang tersedia."
                      : "Dirangkum dengan aturan deterministik dari gap yang tersedia."}
                  </p>
                </div>
                <span className="text-[11px] text-muted-foreground">{formatDate(data.insight.generatedAt)}</span>
              </div>
              <div className="mt-4 grid gap-2 md:grid-cols-3">
                {data.insight.recommendations.slice(0, 3).map((recommendation) => (
                  <button
                    key={`${recommendation.href}-${recommendation.text}`}
                    type="button"
                    onClick={() => navigate(recommendation.href)}
                    className="group rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-pub-violet/30"
                  >
                    <p className="text-sm leading-relaxed text-foreground">{recommendation.text}</p>
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-pub-violet">
                      {recommendation.label} <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="font-heading text-xl font-bold text-foreground">Empat dimensi SIAP</h2><p className="mt-1 text-sm text-muted-foreground">Buka sumber indikator untuk melengkapi bukti yang masih kurang.</p></div>
        <div className="flex flex-wrap gap-2 rounded-lg bg-muted p-1">
          {["semua", ...dimensions.map((item) => item.focus)].map((focus) => <button key={focus} type="button" onClick={() => setActiveFocus(focus)} className={`rounded-md px-3 py-1.5 text-xs font-semibold capitalize transition-colors ${activeFocus === focus ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>{focus === "semua" ? "Semua" : focus}</button>)}
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        {visibleDimensions.map((dimension) => <DimensionCard key={dimension.focus} dimension={dimension} onOpen={(href) => navigate(href)} />)}
      </div>
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3.5 w-3.5" /> Data mengikuti pembaruan terakhir dari modul terkait. Periksa kembali sebelum mengambil keputusan.</div>
    </div>
  );
};

export default SiapCompetencyMap;