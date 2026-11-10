import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, FileSearch, FolderLock, MessagesSquare } from "lucide-react";
import PublicInformationHeader from "@/components/PublicInformationHeader";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { usePageMeta } from "@/components/clinic/clinicUi";
import ProjectFactsForm from "@/components/brain/ProjectFactsForm";
import EvmPanel, { EMPTY_EVM, evaluateEvm, type EvmFields } from "@/components/brain/EvmPanel";
import BrainAiWorkspace from "@/components/brain/BrainAiWorkspace";
import LoginGate from "@/components/advisor/LoginGate";
import { PERSPECTIVES, EMPTY_FACTS, buildBrainPrompt, type ProjectFacts } from "@/lib/brainProject";

const WHEN = [
  { t: "Proyek mulai goyah", items: ["CPI di bawah 1 dua periode berturut-turut", "Deviasi jadwal makin lebar", "Klaim subkon menumpuk"] },
  { t: "Laporan bulanan", items: ["Menyusun narasi progres untuk pemberi kerja", "Menyiapkan bahan rapat koordinasi", "Mencatat celah bukti sebelum diperiksa"] },
  { t: "Sebelum memutuskan", items: ["Percepatan atau perpanjangan waktu", "Tambah regu atau ganti pemasok", "Close-out dan pelajaran proyek"] },
];

export default function BrainProject() {
  usePageMeta("Brain Project | PUB ASPEKINDO", "Analisis proyek konstruksi dengan data Anda sendiri: fakta proyek, Earned Value, dan satu analisis AI dengan enam sudut pandang.");
  const { user } = useAuth();
  const [facts, setFacts] = useState<ProjectFacts>(EMPTY_FACTS);
  const [evm, setEvm] = useState<EvmFields>(EMPTY_EVM);
  const evmResult = useMemo(() => evaluateEvm(evm), [evm]);
  const prompt = useMemo(() => buildBrainPrompt(facts, evmResult.status === "ok" ? evmResult : null), [facts, evmResult]);
  const hasFacts = Boolean(facts.issues.trim() || facts.question.trim()) && evmResult.status !== "invalid";

  return (
    <div className="min-h-[100dvh] bg-background">
      <PublicInformationHeader backToHome />
      <main>
        <section className="relative overflow-hidden border-b-4 border-pub-amber bg-pub-navy text-white">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "repeating-linear-gradient(0deg, currentColor 0 1px, transparent 1px 32px)" }} />
          <div className="container relative mx-auto grid gap-10 px-4 py-14 md:py-20 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-pub-amber">PUB ASPEKINDO · Brain Project</p>
              <h1 className="mt-4 font-heading text-4xl font-extrabold leading-[1.05] md:text-6xl">Tanda bahaya proyek<br /><span className="text-pub-amber">ada di angka Anda sendiri.</span></h1>
              <p className="mt-5 max-w-xl text-lg text-white/90">Tulis fakta proyek, isi Earned Value bila ada, lalu minta satu analisis AI yang membaca situasi dari enam sudut pandang. Setiap klaim harus bisa ditunjuk buktinya.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-pub-amber text-pub-navy hover:bg-pub-amber-light" data-testid="link-hero-workspace"><a href="#ruang-analisis">Mulai analisis <ArrowRight className="ml-1 h-4 w-4" /></a></Button>
                <Button asChild size="lg" variant="outline" className="border-white/60 bg-transparent text-white hover:bg-white/10" data-testid="link-hero-konsultasi"><Link to="/konsultasi">Konsultasi terpandu</Link></Button>
              </div>
            </div>
            <ol className="space-y-3 self-end font-mono text-sm">
              {["Data Anda di Ruang Simpan", "Fakta + EVM yang Anda isi", "Satu analisis, enam sudut pandang", "Rencana tindak dengan bukti"].map((s, i) => (
                <li key={s} className="flex items-center gap-3 border-l-4 border-pub-amber bg-white/5 px-4 py-3"><span className="font-bold text-pub-amber">{String(i + 1).padStart(2, "0")}</span>{s}</li>
              ))}
            </ol>
          </div>
        </section>

        <section className="container mx-auto px-4 py-14">
          <h2 className="max-w-2xl font-heading text-3xl font-extrabold">Bukan kekurangan data. Kekurangan waktu untuk membacanya.</h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">Laporan harian, kurva S, dan termin sudah ada. Brain Project merangkai yang Anda tulis menjadi bahan keputusan. Kami tidak menampilkan statistik industri yang tidak bisa Anda verifikasi.</p>
          <h3 className="mt-10 font-mono text-xs font-bold uppercase tracking-[0.25em] text-primary">Enam sudut pandang dalam satu analisis</h3>
          <ol className="mt-4 grid gap-px overflow-hidden rounded-xl border-2 border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
            {PERSPECTIVES.map((p, i) => (
              <li key={p.id} className="bg-card p-5">
                <span className="font-mono text-sm font-bold text-pub-amber">{String(i + 1).padStart(2, "0")}</span>
                <p className="mt-1 font-heading text-lg font-bold">{p.name}</p>
                <p className="mt-1 text-sm text-muted-foreground">{p.desc}</p>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm text-muted-foreground">Keenamnya disusun oleh satu permintaan AI, bukan agen terpisah yang bekerja paralel, dan tidak memantau proyek secara otomatis.</p>
        </section>

        <section className="border-y-2 border-border bg-muted/40">
          <div className="container mx-auto grid gap-6 px-4 py-14 md:grid-cols-3">
            {WHEN.map(w => (
              <div key={w.t}>
                <h3 className="font-heading text-lg font-bold">{w.t}</h3>
                <ul className="mt-2 space-y-1.5 text-sm">{w.items.map(it => <li key={it} className="border-l-2 border-primary pl-3">{it}</li>)}</ul>
              </div>
            ))}
          </div>
        </section>

        <section id="ruang-analisis" className="container mx-auto scroll-mt-20 space-y-5 px-4 py-14">
          <div>
            <p className="font-mono text-xs font-bold uppercase tracking-[0.25em] text-primary">Ruang analisis</p>
            <h2 className="mt-2 font-heading text-3xl font-extrabold">Isi fakta, hitung EVM, lalu minta analisis.</h2>
            <p className="mt-2 max-w-2xl text-muted-foreground">Formulir dan kalkulator EVM bisa dipakai tanpa masuk. Analisis AI membutuhkan akun PUB dan persetujuan per sesi.</p>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <ProjectFactsForm value={facts} onChange={setFacts} />
            <EvmPanel value={evm} onChange={setEvm} result={evmResult} />
          </div>
          {user ? <BrainAiWorkspace key={user.id} prompt={prompt} hasFacts={hasFacts} /> : <LoginGate next="/brain-project#ruang-analisis" what="menjalankan analisis AI" />}
        </section>

        <section className="border-t-2 border-border bg-muted/40">
          <div className="container mx-auto grid gap-6 px-4 py-12 md:grid-cols-3">
            {[
              { icon: FolderLock, t: "Ruang Simpan", d: "Rapikan profil dan dokumen perusahaan sebagai acuan opsional.", href: "/ruang-simpan/", ext: true },
              { icon: FileSearch, t: "Bedah Dokumen", d: "Periksa isi dokumen tender atau kontrak sebelum dianalisis.", href: "/bedah-dokumen" },
              { icon: MessagesSquare, t: "Klinik Konsultasi", d: "Loket topik dan permintaan ke operator PUB.", href: "/klinik-konsultasi" },
            ].map(c => {
              const body = <><c.icon className="h-6 w-6 text-primary" aria-hidden /><span className="mt-2 block font-heading font-bold">{c.t}</span><span className="text-sm text-muted-foreground">{c.d}</span></>;
              const cls = "block rounded-xl border-2 border-border bg-card p-5 hover:border-primary focus-visible:outline focus-visible:outline-2";
              return c.ext ? <a key={c.t} href={c.href} className={cls}>{body}</a> : <Link key={c.t} to={c.href} className={cls}>{body}</Link>;
            })}
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
