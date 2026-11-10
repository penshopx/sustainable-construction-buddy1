import { useState } from "react";
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, ChevronDown, ClipboardCheck, ExternalLink, FileCheck2, LayoutDashboard, LogIn, MessageCircle, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { KEPDIRJEN_281_FAQS, KEPDIRJEN_281_REFERENCES } from "@/data/lkut-281-reference";

const FAQS = [
  {
    question: "Apa itu Program PUB ASPEKINDO?",
    answer: "Program PUB ASPEKINDO adalah platform digital Pengembangan Usaha Berkelanjutan untuk membantu BUJK membangun kompetensi, kepatuhan, dan daya saing melalui ekosistem yang terintegrasi. Prinsipnya adalah Integrity, Innovation, dan Collaboration for Sustainable Construction.",
  },
  {
    question: "Apa dasar rujukan LKUT-PUB-LSBUKI?",
    answer: "Rujukan utamanya adalah Permen PUPR Nomor 7 Tahun 2024 tentang Pengembangan Usaha Berkelanjutan dan Program PUB ASPEKINDO. PP Nomor 28 Tahun 2025 serta Permen PU Nomor 6 Tahun 2025 menjadi rujukan pendukung untuk perizinan berbasis risiko, standar kegiatan usaha, dan pengawasan sektor pekerjaan umum.",
  },
  {
    question: "Apa yang perlu disiapkan dalam LKUT?",
    answer: "LKUT dapat mencakup data kepatuhan perizinan berusaha, kinerja manajemen perusahaan, kinerja proyek, laporan keuangan, serta data keikutsertaan dalam Pengembangan Usaha Berkelanjutan. Kebutuhan isian mengikuti kualifikasi dan ketentuan BUJK.",
  },
  {
    question: "Di mana informasi LSBUKI?",
    answer: "Informasi mengenai Lembaga Sertifikasi Badan Usaha Konstruksi Indonesia (LSBUKI) tersedia melalui situs resmi lsbukonstruksi.co.id pada bagian Rujukan chatbot.",
  },
  {
    question: "Apa saja lapisan ekosistem digital PUB?",
    answer: "Ekosistem PUB dirancang dalam lima lapisan: e-course, modul, asesmen, dan sertifikasi; ebook regulasi dan update kebijakan; digital workflow dan monitoring kinerja; AI chatbot kompetensi dan helpdesk; serta AI document generator untuk membantu kebutuhan dokumen BUJK.",
  },
  {
    question: "Apa fitur unggulan modernisasi PUB?",
    answer: "Fitur unggulannya meliputi chatbot kompetensi untuk akses regulasi dan panduan, generator dokumen berbasis data, mini apps seperti kalkulator, RAB, cashflow, dan project tracker, serta e-course dan ebook digital.",
  },
  {
    question: "Bagaimana tahapan modernisasi digital PUB?",
    answer: "Roadmap implementasi dirancang bertahap: setup dan integrasi, pilot bersama anggota, kemudian peluncuran dan perluasan layanan. Pendekatan ini memungkinkan PUB menguji manfaat, keamanan data, dan kesiapan operasional sebelum diperluas.",
  },
  {
    question: "Apa itu sesi SIAP PUB?",
    answer: "SIAP PUB adalah sesi pembelajaran sebagai bagian dari pelaksanaan Pengembangan Usaha Berkelanjutan. Anggota BUJK dapat memahami materi PUB dan mengarahkan penerapannya melalui pembelajaran digital.",
  },
  {
    question: "Di mana melihat kesiapan 4 SIAP?",
    answer: "Setelah masuk, buka menu Peta Kompetensi 4 SIAP. Peta tersebut merangkum kesiapan Legalitas, Sertifikasi, Tender, dan Proyek dari data internal yang tersedia.",
  },
  ...KEPDIRJEN_281_FAQS,
];

const REFERENCES = [
  {
    title: "Permen PUPR No. 7 Tahun 2024",
    detail: "Pengembangan Usaha Berkelanjutan",
  },
  {
    title: "Program PUB ASPEKINDO",
    detail: "Platform digital Pengembangan Usaha Berkelanjutan",
  },
  {
    title: "PP No. 28 Tahun 2025",
    detail: "Penyelenggaraan Perizinan Berusaha Berbasis Risiko",
  },
  {
    title: "Permen PU No. 6 Tahun 2025",
    detail: "Standar kegiatan usaha dan pengawasan sektor pekerjaan umum",
  },
  {
    title: "Blueprint & Transformasi Digital PUB",
    detail: "Integrity · Innovation · Collaboration for Sustainable Construction",
  },
  {
    title: "Modernisasi Digital PUB ASPEKINDO",
    detail: "Ekosistem kompetensi digital · White-label partnership",
  },
  {
    title: "Peta Kompetensi 4 SIAP",
    detail: "Snapshot internal Legalitas, Sertifikasi, Tender, dan Proyek",
    href: "/siap-kompetensi",
  },
  {
    title: "LSBUKI Konstruksi",
    detail: "lsbukonstruksi.co.id",
    href: "https://lsbukonstruksi.co.id",
  },
  ...KEPDIRJEN_281_REFERENCES,
];

type LkutMode = "navigator" | "guided" | "result" | "info" | "workspace";
type GuidedAnswers = {
  focus?: "legalitas" | "proyek" | "pub";
  status?: "baru" | "data" | "cek";
};

const GUIDED_STEPS: Array<{
  key: keyof GuidedAnswers;
  eyebrow: string;
  title: string;
  options: Array<{ value: string; label: string; detail: string }>;
}> = [
  {
    key: "focus" as const,
    eyebrow: "Langkah 1 dari 2",
    title: "Bagian mana yang ingin Anda siapkan?",
    options: [
      { value: "legalitas" as const, label: "Data LKUT & legalitas", detail: "Data usaha, kepatuhan, sertifikasi, dan laporan tahunan." },
      { value: "proyek" as const, label: "Data proyek & kinerja", detail: "Pengalaman, progres, risiko, dan bukti kegiatan proyek." },
      { value: "pub" as const, label: "Pembelajaran PUB", detail: "Materi, aktivitas, dan bukti pengembangan usaha berkelanjutan." },
    ],
  },
  {
    key: "status" as const,
    eyebrow: "Langkah 2 dari 2",
    title: "Posisi Anda saat ini bagaimana?",
    options: [
      { value: "baru" as const, label: "Baru mulai", detail: "Saya ingin diarahkan dari langkah pertama." },
      { value: "data" as const, label: "Sudah punya data", detail: "Saya ingin memasukkan dan mengelola data di aplikasi." },
      { value: "cek" as const, label: "Ingin cek kelengkapan", detail: "Saya ingin melihat bagian yang masih perlu dilengkapi." },
    ],
  },
];

const WORKSPACE_LINKS = [
  { label: "Data & laporan LKUT", detail: "Kelola draft dan dokumen pendukung", path: "/lkut", icon: FileCheck2 },
  { label: "Peta Kompetensi 4 SIAP", detail: "Lihat ringkasan kesiapan internal", path: "/siap-kompetensi", icon: ClipboardCheck },
  { label: "Pembelajaran PUB", detail: "Lanjutkan modul dan aktivitas", path: "/aspekindo-lms", icon: BookOpen },
  { label: "Pusat bantuan aplikasi", detail: "Tanya dan pahami fitur platform", path: "/helpdesk", icon: MessageCircle },
];

export default function FloatingLkut() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [mode, setMode] = useState<LkutMode>("navigator");
  const [guidedStep, setGuidedStep] = useState(0);
  const [guidedAnswers, setGuidedAnswers] = useState<GuidedAnswers>({});

  const openWorkspace = (path = "/lkut") => {
    setIsOpen(false);
    navigate(user ? path : "/auth");
  };

  const startGuidedIntake = () => {
    setMode("guided");
    setGuidedStep(0);
    setGuidedAnswers({});
  };

  const chooseGuidedAnswer = (value: string) => {
    const step = GUIDED_STEPS[guidedStep];
    const nextAnswers = { ...guidedAnswers, [step.key]: value } as GuidedAnswers;
    setGuidedAnswers(nextAnswers);
    if (guidedStep < GUIDED_STEPS.length - 1) {
      setGuidedStep((current) => current + 1);
    } else {
      setMode("result");
    }
  };

  const resetPanel = () => {
    setIsOpen(false);
    setMode("navigator");
    setGuidedStep(0);
    setGuidedAnswers({});
    setOpenFaq(null);
  };

  return (
    <>
      <AnimatePresence mode="wait">
        {!isOpen && (
          <motion.div
            key="lkut-btn"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            {!hasInteracted && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 5 }}
                className="absolute bottom-16 right-0 w-60 rounded-xl border border-pub-amber/25 bg-[hsl(220,60%,14%)] p-3 shadow-xl pointer-events-none"
              >
                <div className="mb-1 flex items-center gap-2">
                  <FileCheck2 className="h-4 w-4 text-pub-amber" />
                   <p className="text-xs font-bold font-heading text-white">Chatbot LKUT-PUB-LSBUKI</p>
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <p className="text-xs font-body leading-relaxed text-[hsl(0,0%,65%)]">
                  Produk asli ASPEKINDO untuk kesiapan data dan dokumen LKUT BUJK.
                </p>
                <div className="absolute bottom-[-6px] right-6 h-3 w-3 rotate-45 border-b border-r border-pub-amber/25 bg-[hsl(220,60%,14%)]" />
              </motion.div>
            )}

            <button
              onClick={() => {
                setIsOpen(true);
                setHasInteracted(true);
              }}
               title="Chatbot LKUT-PUB-LSBUKI"
              className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-pub-amber/30 bg-gradient-to-br from-pub-amber to-orange-500 text-[hsl(220,60%,14%)] shadow-xl transition-all hover:brightness-110"
            >
              <FileCheck2 className="h-6 w-6" />
              {!hasInteracted && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pub-amber opacity-75" />
                  <span className="relative inline-flex h-4 w-4 rounded-full bg-pub-amber" />
                </span>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">
        {isOpen && (
          <motion.div
            key="lkut-panel"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-50 flex h-[520px] w-[360px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-2xl border border-pub-amber/25 bg-card shadow-2xl"
          >
            <div className="flex items-center gap-3 bg-gradient-to-r from-[hsl(220,60%,14%)] to-[hsl(225,55%,22%)] px-4 py-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pub-amber/20">
                <FileCheck2 className="h-4 w-4 text-pub-amber" />
              </div>
              <div className="min-w-0 flex-1">
                 <p className="text-sm font-bold font-heading leading-none text-white">Chatbot LKUT-PUB-LSBUKI</p>
                 <p className="mt-0.5 text-xs font-body text-[hsl(0,0%,60%)]">Panduan dan rujukan LKUT-PUB-LSBUKI</p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-lg text-white/60 hover:bg-white/10 hover:text-white"
                onClick={resetPanel}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {mode !== "navigator" && (
                <button
                  onClick={() => setMode("navigator")}
                  className="mb-3 flex items-center gap-1 text-xs font-semibold font-heading text-muted-foreground transition-colors hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" /> Kembali ke pilihan
                </button>
              )}

              {mode === "navigator" && (
                <>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pub-amber/15">
                      <Sparkles className="h-5 w-5 text-pub-amber" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold font-heading text-foreground">Mulai dari kebutuhan Anda</p>
                      <p className="mt-1 text-xs font-body leading-relaxed text-muted-foreground">
                        Saya bantu menentukan langkah awal. Proses, data, dan penyimpanan tetap dilakukan di aplikasi PUB.
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <button onClick={startGuidedIntake} className="flex w-full items-center gap-3 rounded-xl border border-pub-amber/35 bg-pub-amber/10 p-3 text-left transition-colors hover:bg-pub-amber/15">
                      <ClipboardCheck className="h-5 w-5 shrink-0 text-pub-amber" />
                      <span className="flex-1">
                        <span className="block text-xs font-bold font-heading text-foreground">Cek kesiapan saya</span>
                        <span className="mt-0.5 block text-[11px] font-body text-muted-foreground">Jawab 2 pertanyaan untuk mendapat jalur awal.</span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-pub-amber" />
                    </button>
                    <button onClick={() => setMode("workspace")} className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-muted/50">
                      <LayoutDashboard className="h-5 w-5 shrink-0 text-pub-emerald" />
                      <span className="flex-1">
                        <span className="block text-xs font-bold font-heading text-foreground">Lihat jalur di aplikasi</span>
                        <span className="mt-0.5 block text-[11px] font-body text-muted-foreground">Pilih fitur PUB, LKUT, atau kompetensi.</span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-pub-emerald" />
                    </button>
                    <button onClick={() => setMode("info")} className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-muted/50">
                      <BookOpen className="h-5 w-5 shrink-0 text-pub-sky" />
                      <span className="flex-1">
                        <span className="block text-xs font-bold font-heading text-foreground">Pahami rujukan</span>
                        <span className="mt-0.5 block text-[11px] font-body text-muted-foreground">Baca FAQ dan sumber rujukan sebelum memulai.</span>
                      </span>
                      <ArrowRight className="h-4 w-4 shrink-0 text-pub-sky" />
                    </button>
                  </div>

                  <div className="mt-4">
                    <p className="px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">Akses cepat ke aplikasi</p>
                    <div className="mt-2 space-y-2">
                      <button
                        data-testid="lkut-app-link"
                        aria-label="LKUT — Login ke dashboard"
                        onClick={() => openWorkspace("/lkut")}
                        className="flex w-full items-center gap-3 rounded-xl border border-pub-amber/30 bg-pub-amber/5 p-3 text-left transition-colors hover:bg-pub-amber/10"
                      >
                        {user ? <LayoutDashboard className="h-5 w-5 shrink-0 text-pub-amber" /> : <LogIn className="h-5 w-5 shrink-0 text-pub-amber" />}
                        <span className="flex-1">
                          <span className="block text-xs font-bold font-heading text-foreground">LKUT</span>
                          <span className="mt-0.5 block text-[11px] font-body text-muted-foreground">{user ? "Buka dashboard LKUT." : "Login ke dashboard LKUT."}</span>
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-pub-amber" />
                      </button>
                      <a
                        data-testid="pub-app-link"
                        href="https://lms.dokumenproyek.com"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-xl border border-pub-sky/30 bg-pub-sky/5 p-3 text-left transition-colors hover:bg-pub-sky/10"
                      >
                        <BookOpen className="h-5 w-5 shrink-0 text-pub-sky" />
                        <span className="flex-1">
                          <span className="block text-xs font-bold font-heading text-foreground">PUB</span>
                          <span className="mt-0.5 block text-[11px] font-body text-muted-foreground">Login ke dashboard LMS.</span>
                        </span>
                        <ExternalLink className="h-4 w-4 shrink-0 text-pub-sky" />
                      </a>
                      <a
                        data-testid="lsbuki-app-link"
                        href="https://lsbukonstruksi.co.id"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-3 rounded-xl border border-pub-emerald/30 bg-pub-emerald/5 p-3 text-left transition-colors hover:bg-pub-emerald/10"
                      >
                        <ExternalLink className="h-5 w-5 shrink-0 text-pub-emerald" />
                        <span className="flex-1">
                          <span className="block text-xs font-bold font-heading text-foreground">LSBUKI</span>
                          <span className="mt-0.5 block text-[11px] font-body text-muted-foreground">Informasi LSBU Konstruksi Indonesia.</span>
                        </span>
                        <ExternalLink className="h-4 w-4 shrink-0 text-pub-emerald" />
                      </a>
                    </div>
                  </div>

                  <div className="mt-4 flex items-start gap-2 rounded-xl border border-border bg-muted/40 p-3">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-pub-emerald" />
                    <p className="text-[11px] font-body leading-relaxed text-muted-foreground">
                      Chat ini hanya memberi panduan awal. Untuk data pribadi, checklist, dokumen, dan progres, lanjutkan di web aplikasi.
                    </p>
                  </div>
                </>
              )}

              {mode === "guided" && (
                <>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-pub-amber">{GUIDED_STEPS[guidedStep].eyebrow}</p>
                  <h3 className="mt-2 text-base font-bold font-heading text-foreground">{GUIDED_STEPS[guidedStep].title}</h3>
                  <div className="mt-4 space-y-2">
                    {GUIDED_STEPS[guidedStep].options.map((option) => (
                      <button
                        key={option.value}
                        onClick={() => chooseGuidedAnswer(option.value)}
                        className="flex w-full items-start gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:border-pub-amber/40 hover:bg-pub-amber/5"
                      >
                        <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-pub-amber/50 text-[10px] font-bold text-pub-amber">
                          {GUIDED_STEPS[guidedStep].options.indexOf(option) + 1}
                        </span>
                        <span>
                          <span className="block text-xs font-bold font-heading text-foreground">{option.label}</span>
                          <span className="mt-0.5 block text-[11px] font-body leading-relaxed text-muted-foreground">{option.detail}</span>
                        </span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {mode === "result" && (
                <>
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pub-emerald/15">
                    <CheckCircle2 className="h-6 w-6 text-pub-emerald" />
                  </div>
                  <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-pub-emerald">Jalur awal Anda</p>
                  <h3 className="mt-2 text-base font-bold font-heading text-foreground">
                    {guidedAnswers.focus === "proyek" ? "Mulai dari data proyek dan kinerja" : guidedAnswers.focus === "pub" ? "Mulai dari pembelajaran PUB" : "Mulai dari data LKUT dan legalitas"}
                  </h3>
                  <p className="mt-2 text-xs font-body leading-relaxed text-muted-foreground">
                    {guidedAnswers.status === "baru"
                      ? "Gunakan aplikasi untuk membuat dasar data dan mengikuti checklist secara bertahap."
                      : guidedAnswers.status === "cek"
                      ? "Gunakan aplikasi untuk melihat data yang sudah tersedia dan bagian yang masih perlu dilengkapi."
                      : "Masuk ke workspace untuk mengelola data, bukti, dan progres Anda secara tersimpan."}
                  </p>
                  <div className="mt-4 rounded-xl border border-pub-amber/25 bg-pub-amber/10 p-3">
                    <p className="text-xs font-semibold font-heading text-pub-amber">Ringkasan aman</p>
                    <p className="mt-1 text-[11px] font-body leading-relaxed text-muted-foreground">
                      Ini adalah panduan awal, bukan penilaian resmi atau pengajuan ke lembaga berwenang.
                    </p>
                  </div>
                </>
              )}

              {mode === "workspace" && (
                <>
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-pub-emerald/15">
                      <LayoutDashboard className="h-5 w-5 text-pub-emerald" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold font-heading text-foreground">Workspace Assistant</p>
                      <p className="mt-1 text-xs font-body leading-relaxed text-muted-foreground">
                        {user ? "Pilih ruang kerja untuk melanjutkan proses Anda." : "Masuk terlebih dahulu agar data dan progres dapat tersimpan."}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {WORKSPACE_LINKS.map((link) => {
                      const Icon = link.icon;
                      return (
                        <button key={link.path} onClick={() => openWorkspace(link.path)} className="flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-muted/50">
                          <Icon className="h-4 w-4 shrink-0 text-pub-sky" />
                          <span className="flex-1">
                            <span className="block text-xs font-bold font-heading text-foreground">{link.label}</span>
                            <span className="mt-0.5 block text-[11px] font-body text-muted-foreground">{link.detail}</span>
                          </span>
                          <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      );
                    })}
                  </div>
                </>
              )}

              {mode === "info" && (
                <>
                  <div className="flex items-start gap-3">
                    <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-pub-amber" />
                    <div>
                      <p className="text-sm font-semibold font-heading text-foreground">Rujukan & pertanyaan cepat</p>
                      <p className="mt-1 text-xs font-body leading-relaxed text-muted-foreground">Informasi ini bersifat edukatif. Periksa ketentuan terbaru pada sumber resmi.</p>
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    {FAQS.map((faq, index) => (
                      <div key={faq.question} className="overflow-hidden rounded-xl border border-border">
                        <button onClick={() => setOpenFaq(openFaq === index ? null : index)} className="flex w-full items-center gap-2 p-3 text-left transition-colors hover:bg-muted/50">
                          <ChevronDown className={`h-4 w-4 shrink-0 text-pub-amber transition-transform ${openFaq === index ? "rotate-180" : ""}`} />
                          <span className="flex-1 text-xs font-semibold font-heading text-foreground">{faq.question}</span>
                        </button>
                        {openFaq === index && <p className="border-t border-border px-3 pb-3 pt-2 text-xs font-body leading-relaxed text-muted-foreground">{faq.answer}</p>}
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 space-y-2">
                    <div className="flex items-center gap-2 px-1">
                      <BookOpen className="h-3.5 w-3.5 text-pub-amber" />
                      <p className="text-xs font-semibold font-heading text-muted-foreground">Rujukan chatbot</p>
                    </div>
                    {REFERENCES.map((reference) => {
                      const isExternal = Boolean(reference.href?.startsWith("http"));
                      const content = (
                        <>
                          <span className="flex-1">
                            <span className="block text-xs font-semibold font-heading text-foreground">{reference.title}</span>
                            <span className="mt-0.5 block text-[11px] font-body text-muted-foreground">{reference.detail}</span>
                          </span>
                          {reference.href && (isExternal ? <ExternalLink className="h-3.5 w-3.5 shrink-0 text-pub-sky" /> : <ArrowRight className="h-3.5 w-3.5 shrink-0 text-pub-sky" />)}
                        </>
                      );
                      return reference.href ? (
                        <a key={reference.title} href={reference.href} target={isExternal ? "_blank" : undefined} rel={isExternal ? "noopener noreferrer" : undefined} className="flex items-center gap-2 rounded-xl border border-border p-3 transition-colors hover:bg-muted/50">
                          {content}
                        </a>
                      ) : (
                        <div key={reference.title} className="flex items-center gap-2 rounded-xl border border-border p-3">{content}</div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>

            <div className="space-y-2 border-t border-border p-3">
              {mode === "result" && (
                <button
                  onClick={() => openWorkspace(guidedAnswers.focus === "proyek" ? "/projects" : guidedAnswers.focus === "pub" ? "/aspekindo-lms" : "/lkut")}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-amber px-4 py-2.5 text-sm font-bold font-heading text-accent-foreground shadow-amber transition-all hover:brightness-110"
                >
                  {user ? "Buka jalur di aplikasi" : "Masuk dan mulai di aplikasi"} <ArrowRight className="h-4 w-4" />
                </button>
              )}
              {(mode === "navigator" || mode === "workspace" || mode === "info") && (
                <button
                  onClick={() => openWorkspace("/lkut")}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-amber px-4 py-2.5 text-sm font-bold font-heading text-accent-foreground shadow-amber transition-all hover:brightness-110"
                >
                  {user ? "Buka workspace LKUT" : "Masuk dan mulai di aplikasi"} <ArrowRight className="h-4 w-4" />
                </button>
              )}
              {mode !== "navigator" && (
                <button onClick={() => setMode("navigator")} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-xs font-semibold font-heading text-foreground transition-colors hover:bg-muted">
                  <ArrowLeft className="h-3.5 w-3.5" /> Pilih kebutuhan lain
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}