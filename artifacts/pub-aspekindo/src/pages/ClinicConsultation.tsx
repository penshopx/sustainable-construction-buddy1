import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FolderLock, Search, UserRoundCheck } from "lucide-react";
import PublicInformationHeader from "@/components/PublicInformationHeader";
import Footer from "@/components/Footer";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { CLINIC_TOPICS, CLINIC_GROUP_LABEL, type ClinicTopicGroup } from "@/lib/clinicCatalog";
import ClinicFeedbackForm from "@/components/clinic/ClinicFeedbackForm";
import ClinicPrepTools from "@/components/clinic/ClinicPrepTools";
import { DeskNumber, usePageMeta } from "@/components/clinic/clinicUi";

type Filter = "all" | ClinicTopicGroup;

const STEPS = [
  { n: "1", t: "Pilih loket", d: "22 loket topik, dari SBU sampai AJJ nirkertas." },
  { n: "2", t: "Tanya AI pendamping", d: "Setelah Anda menyetujui pengiriman ke AI eksternal. Bila layanan AI gagal, galatnya ditampilkan apa adanya." },
  { n: "3", t: "Minta operator bila perlu", d: "Tulis ringkasan sendiri; hanya teks itu yang dikirim ke admin PUB." },
];

export default function ClinicConsultation() {
  usePageMeta(
    "Klinik Konsultasi | PUB ASPEKINDO",
    "Klinik Konsultasi PUB ASPEKINDO: 22 loket topik SBU, LKUT, tender, SKK, K3, PKB dan lainnya dengan pendamping AI dan permintaan bantuan ke operator PUB.",
  );
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return CLINIC_TOPICS.filter(t => (filter === "all" || t.group === filter) &&
      (!q || `${t.name} ${t.short} ${t.description}`.toLowerCase().includes(q)));
  }, [query, filter]);

  const deskHref = (id: string) => user ? `/klinik-konsultasi/${id}` : `/auth?next=/klinik-konsultasi/${id}`;

  return (
    <div className="min-h-[100dvh] bg-background">
      <PublicInformationHeader backToHome />
      <main>
        <section className="relative overflow-hidden border-b border-border bg-pub-navy text-white">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: "repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px 64px), repeating-linear-gradient(0deg, currentColor 0 1px, transparent 1px 64px)" }} />
          <div className="container relative mx-auto grid gap-10 px-4 py-14 md:py-20 lg:grid-cols-[1.3fr_1fr]">
            <div>
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-pub-amber">PUB ASPEKINDO · Klinik Konsultasi</p>
              <h1 className="mt-4 font-heading text-4xl font-extrabold leading-[1.05] md:text-6xl">Ambil nomor loket.<br /><span className="text-pub-amber">Tanyakan urusan konstruksi Anda.</span></h1>
              <p className="mt-5 max-w-xl text-white/75">Loket topik untuk badan usaha dan tenaga kerja konstruksi. Pendamping AI membantu menyiapkan berkas dan pemahaman; operator PUB menerima permintaan yang Anda tulis sendiri. Bukan lembaga sertifikasi, asesmen, atau perizinan.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-pub-amber text-pub-navy hover:bg-pub-amber-light" data-testid="link-hero-desks">
                  <a href="#loket">Pilih loket <ArrowRight className="ml-1 h-4 w-4" /></a>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10" data-testid="link-hero-ruang-simpan">
                  <a href="/ruang-simpan/">Rapikan dokumen di Ruang Simpan</a>
                </Button>
              </div>
            </div>
            <ol className="space-y-3 self-end">
              {STEPS.map(s => (
                <li key={s.n} className="flex gap-4 rounded-xl border border-white/15 bg-white/5 p-4">
                  <span className="font-mono text-3xl font-bold text-pub-amber tabular-nums">{s.n}</span>
                  <span><span className="block font-semibold">{s.t}</span><span className="text-sm text-white/65">{s.d}</span></span>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="loket" className="container mx-auto scroll-mt-20 px-4 py-14">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="font-heading text-3xl font-bold">Daftar loket</h2>
              <p className="text-sm text-muted-foreground">{CLINIC_TOPICS.filter(t => t.group === "business").length} loket badan usaha, {CLINIC_TOPICS.filter(t => t.group === "professional").length} loket profesi.</p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <label htmlFor="desk-search" className="sr-only">Cari loket</label>
                <Input id="desk-search" data-testid="input-search-desks" value={query} onChange={e => setQuery(e.target.value)} placeholder="Cari: SKK, tender, LKUT..." className="pl-9 sm:w-64" />
              </div>
              <div role="tablist" aria-label="Kategori loket" className="flex rounded-lg border border-border p-1">
                {(["all", "business", "professional"] as Filter[]).map(f => (
                  <button key={f} role="tab" aria-selected={filter === f} data-testid={`button-filter-${f}`} onClick={() => setFilter(f)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${filter === f ? "bg-pub-navy text-white" : "text-muted-foreground hover:text-foreground"}`}>
                    {f === "all" ? "Semua" : f === "business" ? "Badan Usaha" : "Profesi"}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {visible.length === 0 ? (
            <div className="mt-10 rounded-2xl border border-dashed border-border p-10 text-center">
              <p className="font-medium">Tidak ada loket yang cocok dengan "{query}".</p>
              <Button variant="link" onClick={() => { setQuery(""); setFilter("all"); }} data-testid="button-reset-filter">Tampilkan semua loket</Button>
            </div>
          ) : (
            <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {visible.map(t => (
                <li key={t.id}>
                  <Link to={deskHref(t.id)} data-testid={`link-desk-${t.id}`}
                    className="group flex h-full gap-3 rounded-xl border border-border bg-card p-4 transition-all hover:-translate-y-0.5 hover:border-pub-amber/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                    <DeskNumber value={t.number} className="h-fit shrink-0" />
                    <span className="min-w-0">
                      <span className="block text-[10px] uppercase tracking-wider text-muted-foreground">{CLINIC_GROUP_LABEL[t.group]}</span>
                      <span className="block font-heading font-semibold leading-tight">{t.name}</span>
                      <span className="mt-1 block text-xs text-muted-foreground">{t.description}</span>
                      <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary">{user ? "Buka loket" : "Masuk untuk konsultasi"} <ArrowRight className="h-3 w-3 transition-transform group-hover:translate-x-0.5" /></span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="border-y border-border bg-muted/30">
          <div className="container mx-auto grid gap-8 px-4 py-14 md:grid-cols-2">
            <div className="flex gap-4">
              <FolderLock className="h-8 w-8 shrink-0 text-pub-emerald" />
              <div>
                <h2 className="font-heading text-xl font-bold">Ruang Simpan sebagai acuan, hanya bila Anda izinkan</h2>
                <p className="mt-2 text-sm text-muted-foreground">Di setiap loket ada kotak centang terpisah. Bila dicentang, profil perusahaan milik Anda dan potongan teks dokumen yang relevan dikirim ke layanan AI eksternal. Berkas utuh tidak dikirim, dan pilihan ini kembali mati saat berganti loket atau akun.</p>
                <span className="mt-3 flex flex-wrap gap-4"><a href="/ruang-simpan/" className="text-sm font-medium text-primary underline" data-testid="link-ruang-simpan">Buka Ruang Simpan</a><Link to="/brain-project" className="text-sm font-medium text-primary underline" data-testid="link-brain-project">Analisis proyek di Brain Project</Link><Link to="/konsultasi" className="text-sm font-medium text-primary underline" data-testid="link-konsultasi">Konsultasi terpandu</Link></span>
              </div>
            </div>
            <div className="flex gap-4">
              <UserRoundCheck className="h-8 w-8 shrink-0 text-pub-sky" />
              <div>
                <h2 className="font-heading text-xl font-bold">Operator PUB, tanpa transkrip otomatis</h2>
                <p className="mt-2 text-sm text-muted-foreground">Permintaan ke operator berisi ringkasan yang Anda tulis dan kirim sendiri. Status dan balasan tersimpan di akun Anda. Tidak ada janji waktu tanggapan.</p>
              </div>
            </div>
          </div>
        </section>

        <section className="container mx-auto px-4 py-14">
          <h2 className="font-heading text-2xl font-bold">Lanjutkan dengan alat persiapan yang sudah ada</h2>
          <p className="mb-6 text-sm text-muted-foreground">Fitur PUB yang bisa dipakai setelah berkonsultasi.</p>
          <ClinicPrepTools />
        </section>

        <section className="container mx-auto grid gap-8 px-4 pb-16 md:grid-cols-[1fr_1.2fr]">
          <div>
            <h2 className="font-heading text-2xl font-bold">Masukan untuk Klinik</h2>
            <p className="mt-2 text-sm text-muted-foreground">Loket mana yang membantu, mana yang perlu dibenahi. Masukan dibaca oleh admin PUB.</p>
          </div>
          <ClinicFeedbackForm key={user?.id ?? "guest"} />
        </section>
      </main>
      <Footer />
    </div>
  );
}
