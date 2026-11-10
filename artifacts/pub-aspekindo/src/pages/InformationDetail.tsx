import { useEffect, useState } from "react";
import { ArrowLeft, CalendarDays, ExternalLink, Link2, Loader2, ShieldCheck } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import PublicInformationHeader from "@/components/PublicInformationHeader";
import Footer from "@/components/Footer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner-toast";
import { formatInformationDate, type InformationArticle } from "@/lib/informationCenter";

export default function InformationDetail() {
  const { slug } = useParams();
  const [article, setArticle] = useState<InformationArticle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("information_articles")
        .select("*, information_sources(name, domain, trust_level)")
        .eq("slug", slug ?? "")
        .maybeSingle();
      const nextArticle = data as InformationArticle | null;
      setArticle(nextArticle);
      setLoading(false);
      if (nextArticle) {
        document.title = `${nextArticle.title} | PUB ASPEKINDO`;
      }
    };
    void load();
  }, [slug]);

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href);
    toast.success("Tautan artikel disalin.");
  };

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center bg-[hsl(205,45%,97%)]"><Loader2 className="h-7 w-7 animate-spin text-pub-sky" /></div>;
  }

  if (!article) {
    return (
      <div className="min-h-screen bg-[hsl(205,45%,97%)]">
        <PublicInformationHeader backToHome />
        <main className="container mx-auto px-6 py-24 text-center">
          <h1 className="text-3xl font-extrabold">Informasi tidak ditemukan</h1>
          <p className="mt-3 text-slate-600">Artikel belum terbit, telah diarsipkan, atau alamatnya tidak sesuai.</p>
          <Button asChild className="mt-6"><Link to="/informasi"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali</Link></Button>
        </main>
      </div>
    );
  }

  const sourceName = article.information_sources?.name ?? article.source_title;

  return (
    <div className="min-h-screen bg-[hsl(205,45%,97%)] text-[hsl(207,43%,14%)]">
      <PublicInformationHeader backToHome />
      <main>
        <header className="border-b border-slate-200 bg-[hsl(205,60%,94%)]">
          <div className="container mx-auto px-6 py-12 md:py-16">
            <nav className="text-sm text-slate-500" aria-label="Breadcrumb">
              <Link to="/informasi" className="hover:text-pub-sky">Informasi</Link> / {article.topic}
            </nav>
            <div className="mt-7 flex flex-wrap gap-2">
              <Badge className="bg-pub-navy text-white">{article.channel === "industry" ? "JASA KONSTRUKSI" : "KABAR PUB"}</Badge>
              <Badge variant="outline">{article.topic}</Badge>
            </div>
            <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-tight md:text-6xl">{article.title}</h1>
            <p className="mt-6 max-w-3xl text-lg leading-relaxed text-slate-600 md:text-xl">{article.summary}</p>
            <div className="mt-8 grid max-w-4xl gap-5 border-l-4 border-pub-sky bg-white/75 p-5 sm:grid-cols-3">
              <div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Sumber</p><p className="mt-1 font-semibold">{sourceName}</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Tanggal sumber</p><p className="mt-1 font-semibold">{formatInformationDate(article.source_published_at)}</p></div>
              <div><p className="text-xs font-bold uppercase tracking-wider text-slate-500">Diterbitkan PUB</p><p className="mt-1 font-semibold">{formatInformationDate(article.published_at)}</p></div>
            </div>
          </div>
        </header>

        <div className="container mx-auto grid gap-10 px-6 py-12 lg:grid-cols-[minmax(0,760px),280px] lg:justify-center">
          <article className="prose prose-slate max-w-none prose-headings:font-heading prose-a:text-pub-sky prose-strong:text-slate-900">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{article.body}</ReactMarkdown>
          </article>
          <aside className="space-y-5">
            <div className="rounded-xl border border-slate-200 bg-white p-5">
              <ShieldCheck className="h-6 w-6 text-pub-sky" />
              <h2 className="mt-3 font-heading font-bold">Rujukan terverifikasi</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">Ringkasan PUB tidak menggantikan dokumen atau pengumuman pada sumber asal.</p>
              <Button asChild variant="outline" className="mt-5 w-full gap-2">
                <a href={article.source_url} target="_blank" rel="noopener noreferrer">Buka sumber asli <ExternalLink className="h-4 w-4" /></a>
              </Button>
            </div>
            <div className="rounded-xl bg-[hsl(220,60%,8%)] p-5 text-white">
              <CalendarDays className="h-6 w-6 text-pub-sky" />
              <h2 className="mt-3 font-heading font-bold">Perlu pendampingan?</h2>
              <p className="mt-2 text-sm leading-relaxed text-white/65">Gunakan platform PUB untuk menghubungkan informasi ini dengan kesiapan BUJK Anda.</p>
              <Button asChild className="mt-5 w-full bg-pub-sky text-pub-navy hover:bg-pub-sky/90"><Link to="/auth">Masuk ke platform</Link></Button>
            </div>
          </aside>
        </div>

        <footer className="border-t border-slate-300">
          <div className="container mx-auto flex flex-col gap-4 px-6 py-8 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">Terakhir diperbarui {formatInformationDate(article.updated_at, true)} · Sumber: {sourceName}</p>
            <Button variant="outline" className="gap-2 bg-white" onClick={() => void copyLink()}><Link2 className="h-4 w-4" /> Bagikan tautan</Button>
          </div>
        </footer>
      </main>
      <Footer />
    </div>
  );
}