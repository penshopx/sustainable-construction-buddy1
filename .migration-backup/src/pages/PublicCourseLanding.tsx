import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Building2,
  CircleAlert,
  GraduationCap,
  Loader2,
  LockKeyhole,
  ShieldCheck,
  Target,
  Users,
} from "lucide-react";
import PublicInformationHeader from "@/components/PublicInformationHeader";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { usePublicAspekindoLmsCourse } from "@/hooks/useAspekindoLms";

const SIAP_LABELS: Record<string, string> = {
  legalitas: "SIAP Legalitas",
  sertifikasi: "SIAP Sertifikasi",
  tender: "SIAP Tender",
  proyek: "SIAP Proyek",
};

function setMeta(name: string, content: string, property = false) {
  const selector = property ? `meta[property="${name}"]` : `meta[name="${name}"]`;
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(property ? "property" : "name", name);
    document.head.appendChild(element);
  }
  element.content = content;
}

export default function PublicCourseLanding() {
  const { slug } = useParams<{ slug: string }>();
  const courseQuery = usePublicAspekindoLmsCourse(slug);
  const course = courseQuery.data;

  useEffect(() => {
    if (!course) return;
    const description = course.description_markdown
      .replace(/[#*_`[\]]/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 155) || `Kursus LMS ASPEKINDO untuk ${course.audience || "anggota BUJK"}.`;
    const canonical = `${window.location.origin}/kursus/${course.slug}`;
    document.title = `${course.title} | LMS ASPEKINDO`;
    setMeta("description", description);
    setMeta("og:title", course.title, true);
    setMeta("og:description", description, true);
    setMeta("og:url", canonical, true);
    setMeta("og:type", "website", true);
    setMeta("twitter:card", "summary_large_image");
    setMeta("twitter:title", course.title);
    setMeta("twitter:description", description);
    let link = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = document.createElement("link");
      link.rel = "canonical";
      document.head.appendChild(link);
    }
    link.href = canonical;
  }, [course]);

  if (courseQuery.isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PublicInformationHeader />
        <div className="flex min-h-[60vh] items-center justify-center gap-3 text-sm font-semibold text-pub-navy">
          <Loader2 className="h-5 w-5 animate-spin text-pub-sky" aria-hidden="true" />
          Memuat informasi kursus...
        </div>
      </div>
    );
  }

  if (courseQuery.isError || !course) {
    return (
      <div className="min-h-screen bg-slate-50">
        <PublicInformationHeader />
        <main className="container mx-auto flex min-h-[65vh] items-center justify-center px-6 py-16">
          <div className="max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-900/5 md:p-12">
            <CircleAlert className="mx-auto h-10 w-10 text-pub-sky" aria-hidden="true" />
            <h1 className="mt-5 text-2xl font-extrabold text-pub-navy">Halaman kursus belum tersedia</h1>
            <p className="mt-3 text-sm leading-relaxed text-slate-600">
              Tautan mungkin tidak valid atau landing publik kursus belum diterbitkan.
            </p>
            <Button asChild className="mt-7 bg-pub-navy text-white hover:bg-pub-navy/90">
              <Link to="/">Kembali ke beranda</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const loginTarget = `/auth?next=${encodeURIComponent(`/aspekindo-lms/kursus/${course.id}`)}`;

  return (
    <div className="min-h-screen bg-[hsl(205,45%,97%)] text-pub-navy">
      <PublicInformationHeader />
      <main>
        <section className="relative overflow-hidden bg-[hsl(220,60%,8%)] text-white">
          <div className="pointer-events-none absolute -right-24 -top-28 h-96 w-96 rounded-full border-[52px] border-pub-sky/10" />
          <div className="pointer-events-none absolute -bottom-20 left-1/3 h-64 w-64 rounded-full bg-pub-amber/10 blur-3xl" />
          <div className="container relative mx-auto grid gap-10 px-6 py-16 lg:grid-cols-[minmax(0,1.3fr)_minmax(280px,0.7fr)] lg:items-end lg:py-24">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">{course.course_code}</Badge>
                <Badge className="bg-pub-sky text-pub-navy hover:bg-pub-sky">{SIAP_LABELS[course.siap_focus] ?? course.siap_focus}</Badge>
              </div>
              <p className="mt-8 text-sm font-extrabold uppercase tracking-[0.18em] text-pub-sky">LMS ASPEKINDO</p>
              <h1 className="mt-3 max-w-4xl text-4xl font-black leading-tight md:text-6xl">{course.title}</h1>
              <p className="mt-5 flex items-center gap-2 text-sm font-semibold text-white/70 md:text-base">
                <Users className="h-4 w-4 text-pub-amber" aria-hidden="true" />
                Untuk {course.audience || "anggota BUJK"}
              </p>
            </div>
            <div className="rounded-3xl border border-white/15 bg-white/10 p-6 backdrop-blur-sm">
              <div className="flex items-start gap-3">
                {course.member_only ? <LockKeyhole className="mt-0.5 h-5 w-5 text-pub-amber" /> : <BookOpen className="mt-0.5 h-5 w-5 text-pub-sky" />}
                <div>
                  <p className="font-bold">{course.member_only ? "Akses anggota ASPEKINDO" : "Kursus terbuka setelah masuk"}</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/65">
                    Materi lengkap, video, kuis, dan progres hanya tersedia di ruang belajar yang dilindungi.
                  </p>
                </div>
              </div>
              <Button asChild size="lg" className="mt-6 w-full bg-pub-amber font-extrabold text-pub-navy hover:bg-amber-300">
                <Link to={loginTarget}>Masuk untuk mendaftar <ArrowRight className="ml-2 h-4 w-4" /></Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="container mx-auto grid gap-8 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_340px] lg:py-20">
          <article className="rounded-3xl border border-slate-200 bg-white p-7 shadow-xl shadow-slate-900/5 md:p-10">
            <div className="flex items-center gap-3">
              <Target className="h-6 w-6 text-pub-sky" aria-hidden="true" />
              <h2 className="text-2xl font-extrabold">Tentang kursus</h2>
            </div>
            <div className="mt-6">
              <MarkdownRenderer className="[&_p]:text-base [&_p]:leading-8">
                {course.description_markdown || "Informasi lengkap kursus akan tersedia setelah Anda masuk ke LMS ASPEKINDO."}
              </MarkdownRenderer>
            </div>
          </article>

          <aside className="space-y-5">
            <div className="rounded-3xl bg-pub-navy p-7 text-white">
              <GraduationCap className="h-7 w-7 text-pub-sky" aria-hidden="true" />
              <h2 className="mt-4 text-xl font-extrabold">Belajar di ruang resmi ASPEKINDO</h2>
              <p className="mt-3 text-sm leading-relaxed text-white/70">
                Ikuti pelajaran secara berurutan, kerjakan kuis jika tersedia, dan simpan catatan penyelesaian untuk review internal.
              </p>
            </div>
            <div className="rounded-3xl border border-pub-sky/25 bg-white p-7">
              <ShieldCheck className="h-6 w-6 text-pub-emerald" aria-hidden="true" />
              <h2 className="mt-4 font-extrabold">Batas penggunaan</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">
                Catatan pembelajaran membantu persiapan kompetensi dan tidak menggantikan sertifikasi atau pengajuan resmi ke LPJK/Kementerian PU.
              </p>
            </div>
          </aside>
        </section>

        <section className="bg-white">
          <div className="container mx-auto flex flex-col gap-6 px-6 py-14 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-pub-sky">Siap mulai belajar?</p>
              <h2 className="mt-2 text-2xl font-extrabold md:text-3xl">Buka kursus di LMS ASPEKINDO.</h2>
            </div>
            <Button asChild size="lg" className="shrink-0 bg-pub-navy text-white hover:bg-pub-navy/90">
              <Link to={loginTarget}><Building2 className="mr-2 h-4 w-4" /> Masuk / daftar akun</Link>
            </Button>
          </div>
        </section>
      </main>
    </div>
  );
}