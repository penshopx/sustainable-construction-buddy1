import { useEffect } from "react";
import { ArrowLeft, Calendar, CalendarDays, MapPin, Newspaper } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import PublicInformationHeader from "@/components/PublicInformationHeader";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useProgramGallery, useProgramUpdates, usePrograms } from "@/hooks/usePrograms";

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
  }).format(new Date(`${value.slice(0, 10)}T00:00:00`));
}

export default function PublicProgramDetail() {
  const { id } = useParams<{ id: string }>();
  const { data: programs = [], isLoading: loadingPrograms } = usePrograms({ publicOnly: true });
  const { data: allUpdates = [] } = useProgramUpdates({ publicOnly: true });
  const { data: allGallery = [] } = useProgramGallery({ publicOnly: true });
  const program = programs.find((item) => item.id === id);
  const updates = allUpdates.filter((item) => item.program_id === id);
  const gallery = allGallery.filter((item) => item.program_id === id);

  useEffect(() => {
    document.title = program ? `${program.title} | PUB ASPEKINDO` : "Program PUB | PUB ASPEKINDO";
  }, [program]);

  if (loadingPrograms) {
    return (
      <div className="min-h-screen bg-[hsl(205,45%,97%)]">
        <PublicInformationHeader backToHome />
        <main className="container mx-auto space-y-5 px-6 py-12"><Skeleton className="h-16 bg-white" /><Skeleton className="h-72 bg-white" /></main>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="min-h-screen bg-[hsl(205,45%,97%)]">
        <PublicInformationHeader backToHome />
        <main className="container mx-auto px-6 py-24 text-center">
          <h1 className="text-3xl font-extrabold text-pub-navy">Program tidak ditemukan</h1>
          <p className="mt-3 text-slate-600">Program belum diterbitkan, telah diarsipkan, atau alamatnya tidak sesuai.</p>
          <Button asChild className="mt-6"><Link to="/program-kegiatan"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke program</Link></Button>
        </main>
      </div>
    );
  }

  const config = statusConfig[program.status] ?? statusConfig.upcoming;

  return (
    <div className="min-h-screen bg-[hsl(205,45%,97%)] text-[hsl(207,43%,14%)]">
      <PublicInformationHeader backToHome />
      <main>
        <header className="border-b border-slate-200 bg-[hsl(205,60%,94%)]">
          <div className="container mx-auto px-6 py-12 md:py-16">
            <Link to="/program-kegiatan" className="inline-flex items-center gap-2 text-sm font-semibold text-pub-sky hover:underline"><ArrowLeft className="h-4 w-4" /> Semua program & kegiatan</Link>
            <div className="mt-7 flex flex-wrap gap-2">
              <Badge className={config.className}>{config.label}</Badge>
              <Badge variant="outline" className="capitalize">{categoryLabels[program.category] ?? program.category}</Badge>
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-tight text-pub-navy md:text-6xl">{program.title}</h1>
            {program.description && <p className="mt-5 max-w-3xl text-lg leading-relaxed text-slate-600">{program.description}</p>}
            <div className="mt-7 flex flex-wrap gap-5 text-sm text-slate-600">
              {program.start_date && <span className="flex items-center gap-2"><Calendar className="h-4 w-4 text-pub-sky" /> {formatDate(program.start_date)}{program.end_date && ` — ${formatDate(program.end_date)}`}</span>}
              {program.location && <span className="flex items-center gap-2"><MapPin className="h-4 w-4 text-pub-sky" /> {program.location}</span>}
            </div>
          </div>
        </header>

        <div className="container mx-auto grid gap-10 px-6 py-12 lg:grid-cols-[minmax(0,760px),280px] lg:justify-center">
          <div className="space-y-10">
            {program.image_url && <img src={program.image_url} alt={program.title} className="max-h-[420px] w-full rounded-2xl object-cover shadow-card" />}
            <section aria-labelledby="program-updates-title">
              <div className="flex items-center gap-3"><Newspaper className="h-5 w-5 text-pub-sky" /><h2 id="program-updates-title" className="text-2xl font-bold text-pub-navy">Update kegiatan</h2></div>
              {updates.length === 0 ? <p className="mt-4 text-sm text-slate-600">Belum ada update untuk program ini.</p> : (
                <div className="mt-4 space-y-4">
                  {updates.map((update) => <Card key={update.id} className="bg-white"><CardContent className="p-5"><p className="text-xs font-bold uppercase tracking-wider text-slate-500">{formatDate(update.published_at)}</p><h3 className="mt-2 font-bold text-pub-navy">{update.title}</h3><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">{update.content}</p></CardContent></Card>)}
                </div>
              )}
            </section>
            <section aria-labelledby="program-gallery-title">
              <div className="flex items-center gap-3"><CalendarDays className="h-5 w-5 text-pub-sky" /><h2 id="program-gallery-title" className="text-2xl font-bold text-pub-navy">Dokumentasi kegiatan</h2></div>
              {gallery.length === 0 ? <p className="mt-4 text-sm text-slate-600">Dokumentasi belum tersedia.</p> : <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">{gallery.map((item) => <figure key={item.id} className="overflow-hidden rounded-xl bg-white"><img src={item.image_url} alt={item.caption || program.title} className="aspect-square w-full object-cover" loading="lazy" />{item.caption && <figcaption className="p-3 text-xs text-slate-600">{item.caption}</figcaption>}</figure>)}</div>}
            </section>
          </div>
          <aside className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <CalendarDays className="h-6 w-6 text-pub-sky" />
              <h2 className="mt-3 font-bold text-pub-navy">Ingin mengikuti kegiatan PUB?</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">Pantau agenda publik dan bergabung sebagai anggota untuk mendapatkan akses ke kegiatan serta bukti keikutsertaan.</p>
              <Button asChild className="mt-5 w-full bg-pub-sky text-pub-navy hover:bg-pub-sky/90"><Link to="/agenda-pub">Lihat agenda publik</Link></Button>
            </div>
          </aside>
        </div>
      </main>
      <Footer />
    </div>
  );
}