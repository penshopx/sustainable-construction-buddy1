import { useEffect, useMemo, useState } from "react";
import { Calendar, CalendarDays, MapPin, Newspaper, Search } from "lucide-react";
import { Link } from "react-router-dom";
import PublicInformationHeader from "@/components/PublicInformationHeader";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useProgramUpdates, usePrograms } from "@/hooks/usePrograms";

const statusConfig: Record<string, { label: string; className: string }> = {
  upcoming: { label: "Akan Datang", className: "bg-pub-amber/15 text-pub-amber" },
  ongoing: { label: "Sedang Berjalan", className: "bg-pub-emerald/15 text-pub-emerald" },
  completed: { label: "Selesai", className: "bg-muted text-muted-foreground" },
};

const categoryLabels: Record<string, string> = {
  program: "Program",
  kegiatan: "Kegiatan",
  pelatihan: "Pelatihan",
  workshop: "Workshop",
  seminar: "Seminar",
  sertifikasi: "Sertifikasi",
};

function formatDate(value: string | null) {
  if (!value) return "Tanggal menyusul";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

export default function PublicPrograms() {
  const { data: programs = [], isLoading: loadingPrograms } = usePrograms({ publicOnly: true });
  const { data: updates = [], isLoading: loadingUpdates } = useProgramUpdates({ publicOnly: true });
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  useEffect(() => {
    document.title = "Program & Kegiatan PUB | PUB ASPEKINDO";
  }, []);

  const filteredPrograms = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return programs.filter((program) => {
      if (status !== "all" && program.status !== status) return false;
      if (!normalizedSearch) return true;
      return `${program.title} ${program.description} ${program.category} ${program.location}`
        .toLowerCase()
        .includes(normalizedSearch);
    });
  }, [programs, search, status]);

  return (
    <div className="min-h-screen bg-[hsl(205,45%,97%)] text-[hsl(207,43%,14%)]">
      <PublicInformationHeader backToHome />
      <main>
        <header className="bg-[hsl(220,60%,8%)] text-white">
          <div className="container mx-auto px-6 py-14 md:py-20">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-pub-sky">Program dan kegiatan PUB</p>
            <div className="mt-5 flex flex-col justify-between gap-8 lg:flex-row lg:items-end">
              <div className="max-w-3xl">
                <h1 className="text-4xl font-extrabold leading-tight md:text-6xl">Ruang kolaborasi untuk BUJK yang terus bertumbuh.</h1>
                <p className="mt-5 max-w-2xl text-lg leading-relaxed text-white/70">
                  Temukan program, pelatihan, workshop, dan dokumentasi kegiatan PUB ASPEKINDO yang dapat diikuti oleh pelaku jasa konstruksi.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button asChild className="bg-pub-sky text-pub-navy hover:bg-pub-sky/90">
                  <Link to="/agenda-pub"><CalendarDays className="mr-2 h-4 w-4" /> Agenda publik</Link>
                </Button>
                <Button asChild variant="outline" className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white">
                  <Link to="/informasi">Pusat informasi</Link>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <section className="container mx-auto px-6 py-10 md:py-14" aria-labelledby="public-programs-title">
          <div className="flex flex-col gap-4 border-b border-slate-300 pb-6 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-pub-sky">Etalase kegiatan</p>
              <h2 id="public-programs-title" className="mt-2 text-3xl font-extrabold text-pub-navy">Program yang sedang dan akan berjalan</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {[
                ["all", "Semua"],
                ["upcoming", "Akan Datang"],
                ["ongoing", "Berjalan"],
                ["completed", "Selesai"],
              ].map(([value, label]) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={status === value ? "default" : "outline"}
                  className={status === value ? "bg-pub-navy text-white hover:bg-pub-navy/90" : "bg-white"}
                  onClick={() => setStatus(value)}
                >
                  {label}
                </Button>
              ))}
            </div>
          </div>

          <div className="relative mt-6 max-w-xl">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari program, pelatihan, atau lokasi..."
              className="h-11 border-slate-300 bg-white pl-10"
            />
          </div>

          {loadingPrograms ? (
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((item) => <Skeleton key={item} className="h-56 bg-white" />)}
            </div>
          ) : filteredPrograms.length === 0 ? (
            <Card className="mt-8 border-dashed bg-white">
              <CardContent className="py-16 text-center">
                <CalendarDays className="mx-auto h-10 w-10 text-slate-400" />
                <h3 className="mt-4 text-lg font-bold text-pub-navy">Belum ada program pada pilihan ini</h3>
                <p className="mt-2 text-sm text-slate-600">Pantau halaman ini untuk pengumuman kegiatan PUB berikutnya.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {filteredPrograms.map((program) => {
                const config = statusConfig[program.status] ?? statusConfig.upcoming;
                return (
                  <Card key={program.id} className="group overflow-hidden border-slate-200 bg-white transition-shadow hover:shadow-lg">
                    {program.image_url && <img src={program.image_url} alt="" className="h-40 w-full object-cover" loading="lazy" />}
                    <CardContent className="space-y-4 p-5">
                      <div className="flex items-start justify-between gap-3">
                        <Badge variant="outline" className="capitalize">{categoryLabels[program.category] ?? program.category}</Badge>
                        <Badge className={config.className}>{config.label}</Badge>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold leading-tight text-pub-navy">
                          <Link to={`/program-kegiatan/${program.id}`} className="hover:text-pub-sky">{program.title}</Link>
                        </h3>
                        {program.description && <p className="mt-3 line-clamp-3 text-sm leading-relaxed text-slate-600">{program.description}</p>}
                      </div>
                      <div className="space-y-2 border-t border-slate-200 pt-4 text-sm text-slate-600">
                        {program.start_date && <p className="flex items-center gap-2"><Calendar className="h-4 w-4 text-pub-sky" /> {formatDate(program.start_date)}</p>}
                        {program.location && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-pub-sky" /> {program.location}</p>}
                      </div>
                      <Link to={`/program-kegiatan/${program.id}`} className="inline-flex items-center gap-2 text-sm font-bold text-pub-sky hover:underline">
                        Lihat detail program <span aria-hidden="true">→</span>
                      </Link>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <section className="border-t border-slate-200 bg-white" aria-labelledby="public-program-updates-title">
          <div className="container mx-auto px-6 py-10 md:py-14">
            <div className="flex items-center gap-3">
              <Newspaper className="h-6 w-6 text-pub-sky" />
              <div>
                <p className="text-sm font-bold uppercase tracking-[0.16em] text-pub-sky">Kabar kegiatan</p>
                <h2 id="public-program-updates-title" className="mt-1 text-2xl font-extrabold text-pub-navy">Update terbaru dari program PUB</h2>
              </div>
            </div>
            {loadingUpdates ? (
              <div className="mt-6 grid gap-4 md:grid-cols-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-32" />)}</div>
            ) : updates.length === 0 ? (
              <p className="mt-6 text-sm text-slate-600">Belum ada update kegiatan yang diterbitkan.</p>
            ) : (
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                {updates.slice(0, 3).map((update) => (
                  <article key={update.id} className="border-l-4 border-pub-sky bg-[hsl(205,45%,97%)] p-5">
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{formatDate(update.published_at.slice(0, 10))}</p>
                    <h3 className="mt-2 font-bold text-pub-navy">{update.title}</h3>
                    <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-slate-600">{update.content}</p>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}