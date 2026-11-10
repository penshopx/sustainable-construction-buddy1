import { useEffect, useState } from "react";
import {
  ArrowRight,
  CalendarDays,
  Clock3,
  ExternalLink,
  Loader2,
  MapPin,
  Newspaper,
  Sparkles,
  UsersRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  formatAgendaDate,
  formatInformationDate,
  isHttpsUrl,
  type InformationAgenda,
  type InformationArticle,
} from "@/lib/informationCenter";

function getTodayInJakarta() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatAgendaRange(agenda: InformationAgenda) {
  if (!agenda.end_date || agenda.end_date === agenda.start_date) {
    return formatAgendaDate(agenda.start_date);
  }
  return `${formatAgendaDate(agenda.start_date)} – ${formatAgendaDate(agenda.end_date)}`;
}

function formatAgendaDay(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${value}T00:00:00+07:00`));
}

function formatAgendaMonth(value: string) {
  return new Intl.DateTimeFormat("id-ID", {
    month: "short",
    year: "numeric",
    timeZone: "Asia/Jakarta",
  }).format(new Date(`${value}T00:00:00+07:00`));
}

function RegistrationLink({ agenda, compact = false }: { agenda: InformationAgenda; compact?: boolean }) {
  const canRegister = isHttpsUrl(agenda.registration_url);

  if (!canRegister) {
    return (
      <Link
        to="/agenda-pub"
        className={compact
          ? "inline-flex items-center gap-1.5 text-sm font-bold text-pub-sky hover:underline"
          : "inline-flex min-h-11 items-center gap-2 rounded-xl bg-pub-amber px-5 py-3 text-sm font-extrabold text-pub-navy transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-amber focus-visible:ring-offset-2 focus-visible:ring-offset-pub-navy"}
      >
        Lihat detail agenda
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    );
  }

  return (
    <a
      href={agenda.registration_url}
      target="_blank"
      rel="noopener noreferrer"
      className={compact
        ? "inline-flex items-center gap-1.5 text-sm font-bold text-pub-sky hover:underline"
        : "inline-flex min-h-11 items-center gap-2 rounded-xl bg-pub-amber px-5 py-3 text-sm font-extrabold text-pub-navy transition hover:bg-amber-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-pub-amber focus-visible:ring-offset-2 focus-visible:ring-offset-pub-navy"}
      aria-label={`Daftar ${agenda.title}`}
    >
      Daftar sekarang
      <ExternalLink className="h-4 w-4" aria-hidden="true" />
    </a>
  );
}

function AgendaMeta({ agenda, dark = false }: { agenda: InformationAgenda; dark?: boolean }) {
  const textClass = dark ? "text-white/75" : "text-slate-600";
  const iconClass = dark ? "text-pub-amber" : "text-pub-sky";

  return (
    <div className={`flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold ${textClass}`}>
      <span className="flex items-center gap-1.5">
        <CalendarDays className={`h-3.5 w-3.5 ${iconClass}`} aria-hidden="true" />
        {formatAgendaRange(agenda)}
      </span>
      {agenda.schedule && (
        <span className="flex items-center gap-1.5">
          <Clock3 className={`h-3.5 w-3.5 ${iconClass}`} aria-hidden="true" />
          {agenda.schedule}
        </span>
      )}
      {agenda.location && (
        <span className="flex items-center gap-1.5">
          <MapPin className={`h-3.5 w-3.5 ${iconClass}`} aria-hidden="true" />
          {agenda.location}
        </span>
      )}
    </div>
  );
}

export default function InformationLandingSection() {
  const [articles, setArticles] = useState<InformationArticle[]>([]);
  const [agendas, setAgendas] = useState<InformationAgenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      const today = getTodayInJakarta();
      const [articleResult, agendaResult] = await Promise.all([
        supabase
          .from("information_articles")
          .select("*, information_sources(name, domain, trust_level)")
          .eq("status", "published")
          .order("published_at", { ascending: false })
          .limit(3),
        supabase
          .from("aspekindo_learning_agendas")
          .select("*")
          .eq("status", "published")
          .gte("start_date", today)
          .order("start_date", { ascending: true })
          .limit(3),
      ]);

      if (!mounted) return;

      const error = articleResult.error ?? agendaResult.error;
      setLoadError(error?.message ?? null);
      setArticles((articleResult.data ?? []) as InformationArticle[]);
      setAgendas(
        (agendaResult.data ?? []).filter(
          (agenda) => agenda.status === "published" && agenda.start_date >= today,
        ).slice(0, 3),
      );
      setLoading(false);
    };

    void load();
    return () => {
      mounted = false;
    };
  }, []);

  if (loading) {
    return (
      <section className="bg-[hsl(205,45%,97%)] py-20" aria-label="Memuat pusat informasi">
        <div className="container mx-auto px-6">
          <div className="flex items-center gap-3 text-sm font-semibold text-pub-sky">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Memuat agenda dan informasi terbaru...
          </div>
          <div className="mt-7 grid gap-5 lg:grid-cols-[1.35fr,0.65fr]">
            <div className="h-72 animate-pulse rounded-3xl bg-pub-navy/10" />
            <div className="space-y-5">
              <div className="h-32 animate-pulse rounded-2xl bg-white" />
              <div className="h-32 animate-pulse rounded-2xl bg-white" />
            </div>
          </div>
        </div>
      </section>
    );
  }

  const featuredAgenda = agendas[0];
  const followingAgendas = agendas.slice(1);

  return (
    <section className="relative overflow-hidden bg-[hsl(205,45%,97%)] py-20" aria-labelledby="landing-information-title">
      <div className="pointer-events-none absolute -left-32 top-20 h-72 w-72 rounded-full bg-pub-sky/10 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-0 h-80 w-80 rounded-full bg-pub-amber/10 blur-3xl" />

      <div className="container relative mx-auto px-6">
        <div className="flex flex-col gap-6 border-b border-slate-300 pb-7 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-bold tracking-[0.18em] text-pub-sky">PUSAT INFORMASI PUB</p>
            <h2 id="landing-information-title" className="mt-3 max-w-3xl text-3xl font-extrabold leading-tight text-pub-navy md:text-5xl">
              {featuredAgenda ? "Kegiatan berikutnya untuk BUJK yang terus bergerak." : "Pembaruan yang membantu BUJK mengambil langkah berikutnya."}
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-600 md:text-lg">
              {featuredAgenda
                ? "Pilih sesi pembelajaran dan forum ASPEKINDO yang paling relevan untuk memperkuat kesiapan usaha Anda."
                : "Ikuti kabar terbaru jasa konstruksi dan kegiatan resmi PUB ASPEKINDO."}
            </p>
          </div>
          <Button asChild className="shrink-0 gap-2 bg-pub-sky text-pub-navy hover:bg-pub-sky/90">
            <Link to={featuredAgenda ? "/agenda-pub" : "/informasi"}>
              {featuredAgenda ? "Lihat semua agenda" : "Lihat semua informasi"}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </Button>
        </div>

        {loadError && (
          <div role="alert" className="mt-7 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Informasi terbaru belum dapat dimuat sepenuhnya. Silakan coba lagi beberapa saat nanti.
          </div>
        )}

        {!featuredAgenda && (
          <div className="mt-9 flex flex-col gap-5 rounded-3xl border border-dashed border-pub-sky/35 bg-white/80 p-7 shadow-sm sm:flex-row sm:items-center sm:justify-between md:p-9">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-pub-sky/10 p-3 text-pub-sky">
                <CalendarDays className="h-6 w-6" aria-hidden="true" />
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-pub-navy">Agenda berikutnya sedang disiapkan.</h3>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
                  Pantau jadwal publik untuk pengumuman kegiatan pembelajaran dan forum resmi ASPEKINDO.
                </p>
              </div>
            </div>
            <Link
              to="/agenda-pub"
              className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl bg-pub-navy px-5 py-3 text-sm font-bold text-white transition hover:bg-pub-navy/90"
            >
              Buka halaman agenda <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
        )}

        {featuredAgenda && (
          <div className="mt-9 grid gap-5 lg:grid-cols-[1.35fr,0.65fr]">
            <article className="relative overflow-hidden rounded-3xl bg-pub-navy p-6 text-white shadow-2xl shadow-pub-navy/15 md:p-8">
              <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border-[28px] border-pub-sky/15" />
              <div className="pointer-events-none absolute bottom-0 right-12 h-24 w-24 rounded-full bg-pub-amber/20 blur-2xl" />
              <div className="relative">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-pub-amber px-3 py-1.5 text-xs font-extrabold uppercase tracking-[0.14em] text-pub-navy">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    Agenda unggulan
                  </span>
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-white/60">
                    {featuredAgenda.category}
                  </span>
                </div>

                <div className="mt-8 grid gap-6 sm:grid-cols-[auto,1fr] sm:items-start">
                  <div className="flex h-24 w-24 shrink-0 flex-col items-center justify-center rounded-2xl bg-white text-pub-navy shadow-lg">
                    <span className="text-3xl font-black leading-none">{formatAgendaDay(featuredAgenda.start_date)}</span>
                    <span className="mt-1 text-xs font-extrabold uppercase tracking-wider text-pub-sky">
                      {formatAgendaMonth(featuredAgenda.start_date)}
                    </span>
                  </div>
                  <div>
                    <h3 className="max-w-2xl text-2xl font-extrabold leading-tight md:text-4xl">
                      {featuredAgenda.title}
                    </h3>
                    <p className="mt-4 max-w-2xl line-clamp-3 text-sm leading-relaxed text-white/75 md:text-base">
                      {featuredAgenda.description}
                    </p>
                    <div className="mt-5">
                      <AgendaMeta agenda={featuredAgenda} dark />
                    </div>
                    {featuredAgenda.audience && (
                      <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-white/65">
                        <UsersRound className="h-3.5 w-3.5 text-pub-amber" aria-hidden="true" />
                        Untuk {featuredAgenda.audience}
                      </p>
                    )}
                  </div>
                </div>

                <div className="relative mt-7 flex flex-wrap items-center gap-4 border-t border-white/15 pt-5">
                  <RegistrationLink agenda={featuredAgenda} />
                  <Link
                    to="/agenda-pub"
                    className="inline-flex items-center gap-1.5 text-sm font-bold text-white/80 transition hover:text-white"
                  >
                    Detail semua kegiatan <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </Link>
                </div>
              </div>
            </article>

            <div className="space-y-5">
              {followingAgendas.length > 0 ? (
                followingAgendas.map((agenda) => (
                  <article key={agenda.id} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-lg shadow-slate-900/5 transition duration-200 hover:-translate-y-0.5 hover:border-pub-sky/40 hover:shadow-xl">
                    <div className="flex gap-4">
                      <div className="flex h-16 w-16 shrink-0 flex-col items-center justify-center rounded-xl bg-pub-sky/10 text-pub-navy">
                        <span className="text-xl font-black leading-none">{formatAgendaDay(agenda.start_date)}</span>
                        <span className="mt-1 text-[10px] font-extrabold uppercase tracking-wider text-pub-sky">
                          {formatAgendaMonth(agenda.start_date)}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-[11px] font-extrabold uppercase tracking-[0.13em] text-pub-sky">{agenda.category}</p>
                        <h3 className="mt-1 line-clamp-2 text-lg font-bold leading-snug text-pub-navy">{agenda.title}</h3>
                        <div className="mt-3">
                          <AgendaMeta agenda={agenda} />
                        </div>
                        <div className="mt-3">
                          <RegistrationLink agenda={agenda} compact />
                        </div>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <div className="flex min-h-40 items-center rounded-2xl border border-dashed border-pub-sky/30 bg-white/70 p-6">
                  <div>
                    <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-pub-sky">Berikutnya</p>
                    <p className="mt-2 text-lg font-bold text-pub-navy">Agenda lain sedang disiapkan.</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-600">Pantau halaman agenda untuk pengumuman kegiatan terbaru.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {articles.length > 0 && (
          <div className={`${featuredAgenda ? "mt-14 border-t border-slate-300 pt-12" : "mt-9"}`}>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-pub-sky">Perkembangan jasa konstruksi</p>
                <h3 className="mt-2 text-2xl font-extrabold text-pub-navy md:text-3xl">Informasi terbaru untuk keputusan yang lebih siap.</h3>
              </div>
              {featuredAgenda && (
                <Link to="/informasi" className="inline-flex items-center gap-1.5 text-sm font-bold text-pub-sky hover:underline">
                  Baca semua berita <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              )}
            </div>
            <div className="mt-6 grid gap-5 lg:grid-cols-3">
              {articles.map((article) => (
                <article key={article.id} className="border-l-4 border-pub-sky bg-white p-6 shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover">
                  <Newspaper className="h-5 w-5 text-pub-sky" aria-hidden="true" />
                  <p className="mt-4 text-xs font-bold uppercase tracking-wider text-slate-500">
                    {article.topic} · {formatInformationDate(article.published_at)}
                  </p>
                  <h3 className="mt-3 text-xl font-bold leading-snug text-pub-navy">
                    <Link to={`/informasi/${article.slug}`} className="hover:text-pub-sky">{article.title}</Link>
                  </h3>
                  <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">{article.summary}</p>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}