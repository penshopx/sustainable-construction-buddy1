import { useEffect, useMemo, useState } from "react";
import { ArrowRight, CalendarDays, ExternalLink, FileSearch, Loader2, MapPin, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import PublicInformationHeader from "@/components/PublicInformationHeader";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  formatAgendaDate,
  formatInformationDate,
  type InformationAgenda,
  type InformationArticle,
} from "@/lib/informationCenter";

type Channel = "all" | "industry" | "pub";

export default function InformationCenter() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [articles, setArticles] = useState<InformationArticle[]>([]);
  const [agendas, setAgendas] = useState<InformationAgenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channel = (searchParams.get("channel") as Channel | null) ?? "all";
  const topic = searchParams.get("topic") ?? "all";
  const query = searchParams.get("q") ?? "";

  useEffect(() => {
    document.title = "Pusat Informasi Jasa Konstruksi | PUB ASPEKINDO";
    const description = "Pembaruan jasa konstruksi dan kegiatan PUB ASPEKINDO dari sumber resmi untuk BUJK Indonesia.";
    let meta = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.name = "description";
      document.head.appendChild(meta);
    }
    meta.content = description;
  }, []);

  const loadInformation = async () => {
    setLoading(true);
    setError(null);
    const [articleResult, agendaResult] = await Promise.all([
      supabase
        .from("information_articles")
        .select("*, information_sources(name, domain, trust_level)")
        .order("featured", { ascending: false })
        .order("published_at", { ascending: false }),
      supabase
        .from("aspekindo_learning_agendas")
        .select("*")
        .order("start_date", { ascending: true }),
    ]);

    if (articleResult.error || agendaResult.error) {
      setError(articleResult.error?.message ?? agendaResult.error?.message ?? "Data belum dapat dimuat.");
      setArticles([]);
      setAgendas([]);
    } else {
      setArticles(articleResult.data as InformationArticle[]);
      setAgendas(agendaResult.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    void loadInformation();
  }, []);

  const topics = useMemo(
    () => Array.from(new Set(articles.map((article) => article.topic))).sort(),
    [articles],
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredArticles = articles.filter((article) => {
    if (channel !== "all" && article.channel !== channel) return false;
    if (topic !== "all" && article.topic !== topic) return false;
    return !normalizedQuery || `${article.title} ${article.summary} ${article.topic}`.toLowerCase().includes(normalizedQuery);
  });
  const filteredAgendas = agendas.filter((agenda) => {
    if (channel === "industry" || topic !== "all") return false;
    return !normalizedQuery || `${agenda.title} ${agenda.description} ${agenda.category}`.toLowerCase().includes(normalizedQuery);
  });
  const lead = filteredArticles[0];
  const latestUpdate = articles[0]?.published_at ?? agendas[0]?.updated_at ?? null;

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(searchParams);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setSearchParams(next, { replace: true });
  };

  const clearFilters = () => setSearchParams({}, { replace: true });

  return (
    <div className="min-h-screen bg-[hsl(205,45%,97%)] text-[hsl(207,43%,14%)]">
      <PublicInformationHeader />
      <main>
        <section className="relative overflow-hidden bg-[hsl(220,60%,8%)] text-white">
          <div
            className="absolute inset-0 opacity-30"
            style={{ backgroundImage: "radial-gradient(circle at 80% 20%, hsl(200 80% 55% / 0.65), transparent 30%)" }}
          />
          <div className="container relative mx-auto grid gap-10 px-6 py-16 md:grid-cols-[1fr,300px] md:py-20">
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
              <p className="text-sm font-bold tracking-[0.2em] text-pub-sky">PUSAT INFORMASI PUB ASPEKINDO</p>
              <h1 className="mt-4 max-w-3xl text-4xl font-extrabold leading-tight md:text-6xl">
                Yang perlu diketahui BUJK, dalam satu meja.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-white/70 md:text-lg">
                Perkembangan jasa konstruksi dan kegiatan PUB yang dirangkum dari sumber resmi, dengan konteks yang dapat langsung digunakan.
              </p>
            </motion.div>
            <div className="self-end border-l-4 border-pub-sky bg-white/5 p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-pub-sky">Pembaruan terakhir</p>
              <p className="mt-2 text-lg font-semibold">{formatInformationDate(latestUpdate, true)}</p>
              <p className="mt-3 text-sm text-white/60">{articles.length} informasi terbit · {agendas.length} agenda PUB</p>
            </div>
          </div>
        </section>

        <section className="sticky top-0 z-20 border-b border-[hsl(205,25%,84%)] bg-[hsl(205,45%,97%)]/95 shadow-sm backdrop-blur">
          <div className="container mx-auto flex flex-col gap-3 px-6 py-4 lg:flex-row lg:items-center">
            <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
              {(["all", "industry", "pub"] as Channel[]).map((value) => (
                <Button
                  key={value}
                  variant={channel === value ? "default" : "outline"}
                  className={channel === value ? "bg-pub-sky text-pub-navy hover:bg-pub-sky/90" : "bg-white"}
                  onClick={() => setFilter("channel", value)}
                >
                  {value === "all" ? "Semua" : value === "industry" ? "Jasa Konstruksi" : "Kabar PUB"}
                </Button>
              ))}
            </div>
            <select
              aria-label="Filter topik"
              value={topic}
              onChange={(event) => setFilter("topic", event.target.value)}
              className="h-10 rounded-md border bg-white px-3 text-sm"
            >
              <option value="all">Semua topik</option>
              {topics.map((value) => <option key={value} value={value}>{value}</option>)}
            </select>
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                aria-label="Cari informasi"
                value={query}
                onChange={(event) => setFilter("q", event.target.value)}
                className="bg-white pl-9"
                placeholder="Cari regulasi, program, atau topik"
              />
            </div>
          </div>
        </section>

        <div className="container mx-auto space-y-16 px-6 py-12">
          {loading ? (
            <div className="flex min-h-72 items-center justify-center gap-3 text-slate-600">
              <Loader2 className="h-6 w-6 animate-spin text-pub-sky" /> Memuat informasi resmi...
            </div>
          ) : error ? (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-8">
              <h2 className="font-heading text-xl font-bold">Informasi belum dapat dimuat</h2>
              <p className="mt-2 text-sm text-slate-600">{error}</p>
              <Button className="mt-5 gap-2" onClick={() => void loadInformation()}>
                <RefreshCw className="h-4 w-4" /> Coba lagi
              </Button>
            </div>
          ) : filteredArticles.length === 0 && filteredAgendas.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center">
              <FileSearch className="mx-auto h-10 w-10 text-slate-400" />
              <h2 className="mt-4 text-xl font-bold">Belum ada informasi pada pilihan ini.</h2>
              <p className="mt-2 text-sm text-slate-500">Ubah kata pencarian atau hapus filter untuk melihat seluruh informasi.</p>
              <Button variant="outline" className="mt-5" onClick={clearFilters}>Hapus filter</Button>
            </div>
          ) : (
            <>
              {lead && (
                <section aria-labelledby="headline-terbaru" className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_18px_50px_rgba(7,21,34,.1)] md:grid-cols-[12px,1fr]">
                  <div className="bg-pub-sky" />
                  <div className="p-7 md:p-10">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge className="bg-pub-navy text-white">{lead.channel === "pub" ? "KABAR PUB" : "JASA KONSTRUKSI"}</Badge>
                      <Badge variant="outline">{lead.topic}</Badge>
                    </div>
                    <h2 id="headline-terbaru" className="mt-5 max-w-4xl text-3xl font-extrabold leading-tight md:text-5xl">{lead.title}</h2>
                    <p className="mt-5 max-w-3xl text-base leading-relaxed text-slate-600 md:text-lg">{lead.summary}</p>
                    <div className="mt-7 flex flex-col gap-4 border-t pt-5 sm:flex-row sm:items-end sm:justify-between">
                      <div className="text-sm text-slate-600">
                        <p className="font-semibold text-slate-900">Sumber: {lead.information_sources?.name ?? lead.source_title}</p>
                        <p className="mt-1">Tanggal sumber {formatInformationDate(lead.source_published_at)} · Terbit PUB {formatInformationDate(lead.published_at)}</p>
                      </div>
                      <Button asChild className="gap-2 bg-pub-sky text-pub-navy hover:bg-pub-sky/90">
                        <Link to={`/informasi/${lead.slug}`}>Baca ringkasan <ArrowRight className="h-4 w-4" /></Link>
                      </Button>
                    </div>
                  </div>
                </section>
              )}

              {filteredArticles.length > 1 && (
                <section aria-labelledby="informasi-terbaru">
                  <div className="mb-6 flex items-end justify-between border-b border-slate-300 pb-4">
                    <div>
                      <p className="text-xs font-bold tracking-[0.16em] text-pub-sky">
                        {channel === "pub" ? "KABAR PUB ASPEKINDO" : channel === "industry" ? "PERKEMBANGAN JASA KONSTRUKSI" : "PUBLIKASI TERBARU"}
                      </p>
                      <h2 id="informasi-terbaru" className="mt-2 text-2xl font-extrabold md:text-3xl">
                        {channel === "pub" ? "Informasi PUB terbaru" : channel === "industry" ? "Informasi industri terbaru" : "Informasi terbaru"}
                      </h2>
                    </div>
                    <span className="text-sm text-slate-500">{filteredArticles.length} publikasi</span>
                  </div>
                  <div className="grid gap-5 lg:grid-cols-2">
                    {filteredArticles.slice(1).map((article) => (
                      <article key={article.id} className="group grid grid-cols-[6px,1fr] overflow-hidden rounded-xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:shadow-lg">
                        <div className="bg-pub-sky/70 transition group-hover:bg-pub-sky" />
                        <div className="p-6">
                          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                            <span>{article.channel === "pub" ? "Kabar PUB" : "Jasa Konstruksi"}</span><span>·</span><span>{article.topic}</span><span>·</span><span>{formatInformationDate(article.published_at)}</span>
                          </div>
                          <h3 className="mt-3 text-xl font-bold leading-snug"><Link to={`/informasi/${article.slug}`} className="hover:text-pub-sky">{article.title}</Link></h3>
                          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-600">{article.summary}</p>
                          <p className="mt-5 flex items-center gap-1 text-xs font-medium text-slate-500">
                            Sumber: {article.information_sources?.name ?? article.source_title}
                            <ExternalLink className="h-3 w-3" />
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}

              {filteredAgendas.length > 0 && (
                <section aria-labelledby="agenda-pub" className="rounded-2xl bg-[hsl(220,60%,8%)] p-6 text-white md:p-9">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                    <div>
                      <p className="text-xs font-bold tracking-[0.16em] text-pub-sky">KABAR PUB ASPEKINDO</p>
                      <h2 id="agenda-pub" className="mt-2 text-2xl font-extrabold md:text-3xl">Agenda dan kegiatan berikutnya</h2>
                      <p className="mt-2 text-sm text-white/60">Ditampilkan langsung dari agenda resmi, tanpa salinan data.</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button asChild variant="outline" className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                        <Link to="/agenda-pub">Lihat agenda lengkap</Link>
                      </Button>
                      <Button asChild className="bg-pub-sky text-pub-navy hover:bg-pub-sky/90">
                        <Link to="/auth">Bergabung dengan PUB</Link>
                      </Button>
                    </div>
                  </div>
                  <div className="mt-7 grid gap-4 lg:grid-cols-2">
                    {filteredAgendas.map((agenda) => (
                      <article key={agenda.id} className="grid grid-cols-[96px,1fr] overflow-hidden rounded-xl border border-white/10 bg-white/5">
                        <div className="flex flex-col items-center justify-center bg-pub-sky p-4 text-center text-pub-navy">
                          <CalendarDays className="mb-2 h-5 w-5" />
                          <span className="text-sm font-extrabold">{formatAgendaDate(agenda.start_date)}</span>
                        </div>
                        <div className="p-5">
                          <p className="text-xs font-bold uppercase tracking-wider text-pub-sky">{agenda.category}</p>
                          <h3 className="mt-2 font-heading text-lg font-bold">{agenda.title}</h3>
                          <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-white/65">{agenda.description}</p>
                          <p className="mt-4 flex items-center gap-2 text-xs text-white/55">
                            <MapPin className="h-3.5 w-3.5" /> {agenda.location || "Lokasi menyusul"} {agenda.schedule && `· ${agenda.schedule}`}
                          </p>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              )}
            </>
          )}

          <aside className="grid gap-6 border-y border-slate-300 py-9 md:grid-cols-[auto,1fr] md:items-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-pub-sky/15">
              <ShieldCheck className="h-7 w-7 text-pub-sky" />
            </div>
            <div>
              <h2 className="font-heading text-xl font-bold">Transparansi sumber adalah bagian dari publikasi.</h2>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-600">
                Setiap pembaruan industri memiliki tautan rujukan. Tanggal sumber dan tanggal publikasi PUB ditampilkan terpisah agar pembaca dapat menilai kebaruan informasi.
              </p>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}