import { useEffect, useMemo, useRef, useState, type DragEvent, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle, ArrowRight, BookMarked, CheckCircle2, CircleDashed, CircleHelp, Download, FileImage,
  FileText, FolderOpen, Loader2, Lock, MessageSquare, Printer, RefreshCw, ScanText, Search, Send,
  ShieldAlert, Trash2, UploadCloud, XCircle,
} from "lucide-react";
import { toast } from "sonner";
import PublicInformationHeader from "@/components/PublicInformationHeader";
import Footer from "@/components/Footer";
import DashboardLayout from "@/components/DashboardLayout";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useAuth";
import KtkDialog from "@/components/document-analysis/KtkDialog";
import VaultReferencePanel from "@/components/VaultReferencePanel";
import { usePageMeta } from "@/components/clinic/clinicUi";
import {
  useDocumentAnalysis, analysisError, BEDAH_MAX_BYTES, BEDAH_ACCEPT,
  type DocumentAnalysis as Analysis, type VaultDocument,
} from "@/hooks/useDocumentAnalysis";

const OCR_MAX_BYTES = 15 * 1024 * 1024;
const CATEGORIES = ["Dokumen Tender", "SKK/SBU", "Kontrak", "Gambar Teknis"] as const;
const STATUS_LABEL: Record<string, string> = {
  ready: "Teks siap", stored: "Tersimpan, belum ada teks", processing: "Sedang diproses", failed: "Gagal diproses",
};
const SEVERITY: Record<string, { label: string; cls: string }> = {
  tinggi: { label: "Tinggi", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  sedang: { label: "Sedang", cls: "bg-pub-amber/15 text-[hsl(32_80%_32%)] dark:text-pub-amber border-pub-amber/40" },
  rendah: { label: "Rendah", cls: "bg-pub-sky/10 text-pub-sky border-pub-sky/30" },
};
const CHECK: Record<string, { label: string; icon: typeof CheckCircle2; cls: string }> = {
  ada: { label: "Ada", icon: CheckCircle2, cls: "text-pub-emerald" },
  perlu_dicek: { label: "Perlu dicek", icon: CircleHelp, cls: "text-pub-amber" },
  tidak_ditemukan: { label: "Tidak ditemukan", icon: XCircle, cls: "text-destructive" },
};

const formatBytes = (n: number) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(1)} MB`;
const formatDate = (s: string) => { const d = new Date(s); return isNaN(d.getTime()) ? s : d.toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }); };
const isImage = (d: VaultDocument) => /^image\//.test(d.type) || /\.(jpe?g|png)$/i.test(d.name);
const isPdf = (d: VaultDocument) => d.type === "application/pdf" || /\.pdf$/i.test(d.name);
const hasText = (d: VaultDocument) => d.status === "ready" && d.text.trim().length > 0;
const ocrEligible = (d: VaultDocument) => (isImage(d) || isPdf(d)) && !hasText(d) && d.status !== "processing";

const grid = { backgroundImage: "repeating-linear-gradient(90deg, currentColor 0 1px, transparent 1px 48px), repeating-linear-gradient(0deg, currentColor 0 1px, transparent 1px 48px)" };
const partStatus = { pending: "Belum diproses", processing: "Sedang diproses", completed: "Berhasil", failed: "Gagal" };
type EvidenceSource = Analysis["result"]["checklist"][number]["source"];
const sourceLabel = (s: EvidenceSource) => s ? `Bagian ${s.part} · ${s.page ? `halaman fisik ${s.page} · ` : ""}karakter ${s.start + 1}–${s.end}` : "";
function EvidenceLocation({ source }: { source: EvidenceSource }) {
  return source ? <p className="mt-1 font-mono text-[11px] text-muted-foreground">{sourceLabel(source)}</p> : null;
}

/* ------------------------------------------------------------------ report */
function reportMarkdown(a: Analysis) {
  const r = a.result;
  const L: string[] = [
    `# Laporan Bedah Dokumen`, ``, `- Dokumen: ${a.documentName}`, `- Kategori: ${r.category}`,
    `- Dianalisis: ${formatDate(a.createdAt)}`, `- Model: ${a.model}`,
    `- Karakter dianalisis: ${a.analyzedCharacters.toLocaleString("id-ID")} dari ${a.sourceCharacters.toLocaleString("id-ID")}`,
  ];
  if (a.sourceCurrent === false) L.push(``, `> SUMBER BERUBAH: laporan historis ini belum ditelaah ulang terhadap teks terbaru di Ruang Simpan.`);
  if (a.truncated) L.push(``, `> PERHATIAN: Analisis hanya mencakup sebagian teks sumber. Bagian yang tidak terbaca tidak tercermin dalam laporan ini.`);
  if (a.coverageNote) L.push(``, `> Cakupan ekstraksi: ${a.coverageNote}`);
  if (a.parts) {
    L.push("", "## Cakupan per Bagian", "");
    a.parts.forEach(p => L.push(`- Bagian ${p.index + 1}, karakter ${p.start + 1}–${p.end}: ${partStatus[p.status]} (${p.attempts}/3 percobaan)${p.error ? ` — ${p.error}` : ""}`));
    L.push("", "Temuan dan ringkasan digabung dari bagian berhasil. Kategori mengikuti bagian berhasil pertama. Tidak ditemukan pada satu bagian bukan bukti ketiadaan di seluruh file.");
  }
  L.push(``, `## Ringkasan`, ``, r.summary, ``, `## Checklist Kelengkapan`, ``);
  r.checklist.length ? r.checklist.forEach(c => L.push(`- [${CHECK[c.status]?.label ?? c.status}] ${c.item}${c.evidence ? ` — ${c.evidence}` : ""}${c.source ? ` (${sourceLabel(c.source)})` : ""}`)) : L.push(`Tidak ada butir.`);
  L.push(``, `## Risiko`, ``);
  r.risks.length ? r.risks.forEach(k => L.push(`### ${k.title} (${SEVERITY[k.severity]?.label ?? k.severity})`, ``, `Bukti: ${k.evidence || "-"} (${sourceLabel(k.source)})`, ``, `Rekomendasi: ${k.recommendation || "-"}`, ``)) : L.push(`Tidak ada risiko yang dicatat.`);
  L.push(``, `## Regulasi Terkait`, ``);
  r.regulations.length ? r.regulations.forEach(g => L.push(`- **${g.title}**${g.evidence ? ` — ${g.evidence}` : ""}${g.note ? ` (${g.note})` : ""}${g.source ? ` (${sourceLabel(g.source)})` : ""}`)) : L.push(`Tidak ada regulasi yang dicatat.`);
  if (a.messages.length) {
    L.push(``, `## Tanya Jawab`, ``);
    a.messages.forEach(m => {
      L.push(`**${m.role === "user" ? "Pertanyaan" : "Jawaban AI"}** (${formatDate(m.createdAt)})${m.compareRegulations ? " — Perbandingan referensi" : ""}`, ``, m.content, ``);
      m.sources?.forEach((s, i) => L.push(`[${i + 1}] ${s.name}`, "", s.quote, ""));
    });
  }
  L.push(``, `---`, `Dihasilkan AI melalui PUB ASPEKINDO Bedah Dokumen. Wajib diverifikasi terhadap dokumen asli. Bukan sertifikasi resmi maupun nasihat hukum.`);
  return L.join("\n");
}
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
function printReport(a: Analysis) {
  const w = window.open("", "_blank", "noopener=no");
  if (!w) { toast.error("Jendela cetak diblokir browser. Izinkan pop-up lalu coba lagi."); return; }
  const body = esc(reportMarkdown(a));
  w.document.write(`<!doctype html><html lang="id"><head><meta charset="utf-8"><title>Laporan Bedah Dokumen - ${esc(a.documentName)}</title><style>body{font:14px/1.6 Georgia,serif;max-width:780px;margin:40px auto;padding:0 24px;color:#1a2233}pre{white-space:pre-wrap;font:inherit}</style></head><body><pre>${body}</pre></body></html>`);
  w.document.close(); w.focus(); w.print();
}
function downloadMd(a: Analysis) {
  const url = URL.createObjectURL(new Blob([reportMarkdown(a)], { type: "text/markdown;charset=utf-8" }));
  const el = document.createElement("a");
  el.href = url; el.download = `bedah-dokumen-${a.documentName.replace(/\.[^.]+$/, "").replace(/[^\w-]+/g, "-").slice(0, 60)}.md`;
  el.click(); URL.revokeObjectURL(url);
}

/* ------------------------------------------------------------------ public intro */
function Intro() {
  const steps = [
    ["01", "Unggah atau ambil", "PDF, TXT, JPG, PNG hingga 50 MB. Atau pilih berkas yang sudah ada di Ruang Simpan Anda."],
    ["02", "Setujui, lalu analisis", "Tidak ada yang dikirim ke AI sebelum Anda mencentang persetujuan untuk dokumen yang dipilih."],
    ["03", "Periksa dan tanya", "Ringkasan, checklist, risiko, regulasi terkait, dan tanya jawab tersimpan privat di akun Anda."],
  ];
  return (
    <div className="min-h-[100dvh] bg-background">
      <PublicInformationHeader backToHome />
      <main>
        <section className="relative overflow-hidden bg-pub-navy text-white">
          <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.06]" style={grid} />
          <div className="container relative mx-auto grid gap-12 px-4 py-16 md:py-24 lg:grid-cols-[1.25fr_1fr]">
            <div className="animate-in fade-in slide-in-from-bottom-3 duration-700">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-pub-amber">PUB ASPEKINDO · Bedah Dokumen</p>
              <h1 className="mt-4 font-heading text-4xl font-extrabold leading-[1.04] md:text-6xl">Bentangkan dokumennya.<br /><span className="text-pub-amber">Tandai yang perlu dicek.</span></h1>
              <p className="mt-6 max-w-xl text-white/75">Ruang kerja privat untuk staf perusahaan anggota: membaca dokumen tender, SKK/SBU, kontrak, dan gambar teknis dari berkas Anda sendiri. Hasil AI adalah bahan telaah awal, bukan sertifikasi resmi dan bukan nasihat hukum.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Button asChild size="lg" className="bg-pub-amber text-pub-navy hover:bg-pub-amber-light" data-testid="link-intro-login">
                  <Link to="/auth?next=/bedah-dokumen">Masuk untuk mulai <ArrowRight className="ml-1 h-4 w-4" /></Link>
                </Button>
                <Button asChild size="lg" variant="outline" className="border-white/30 bg-transparent text-white hover:bg-white/10" data-testid="link-intro-ruang-simpan">
                  <a href="/ruang-simpan/">Lihat Ruang Simpan</a>
                </Button>
              </div>
            </div>
            <div className="relative self-end rounded-2xl border border-white/15 bg-white/[0.04] p-5 font-mono text-xs">
              <p className="uppercase tracking-[0.25em] text-white/50">Kategori yang dikenali</p>
              <ul className="mt-4 space-y-2">
                {CATEGORIES.map((c, i) => (
                  <li key={c} className="flex items-center justify-between rounded-lg border border-white/10 px-3 py-2.5 transition-colors hover:border-pub-amber/60">
                    <span className="text-sm font-semibold text-white">{c}</span><span className="text-pub-amber">K-0{i + 1}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-4 text-white/55">Dokumen lain dicatat sebagai Dokumen Proyek.</p>
            </div>
          </div>
        </section>
        <section className="container mx-auto px-4 py-16">
          <h2 className="font-heading text-3xl font-bold">Cara kerja</h2>
          <ol className="mt-8 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
            {steps.map(([n, t, d]) => (
              <li key={n} className="bg-card p-6"><span className="font-mono text-3xl font-bold text-pub-amber">{n}</span><h3 className="mt-3 font-semibold">{t}</h3><p className="mt-1 text-sm text-muted-foreground">{d}</p></li>
            ))}
          </ol>
        </section>
        <section className="border-y border-border bg-muted/40">
          <div className="container mx-auto grid gap-10 px-4 py-14 md:grid-cols-2">
            <div className="flex gap-4"><Lock className="h-7 w-7 shrink-0 text-pub-emerald" /><div><h2 className="font-heading text-xl font-bold">Apa yang dikirim, dan ke mana</h2><p className="mt-2 text-sm text-muted-foreground">Teks hasil ekstraksi dikirim ke Claude Sonnet melalui OpenRouter, tanpa model cadangan otomatis. Analisis bertahap hingga 20 bagian; satu klik mengirim satu bagian dengan maksimal 1.400 token keluaran. Ekstraksi lokal dibatasi 600 halaman PDF/600.000 karakter. Cakupan yang tidak lengkap selalu ditandai.</p></div></div>
            <div className="flex gap-4"><ScanText className="h-7 w-7 shrink-0 text-pub-sky" /><div><h2 className="font-heading text-xl font-bold">Gambar dan PDF hasil pindai</h2><p className="mt-2 text-sm text-muted-foreground">Berkas tanpa teks perlu OCR terlebih dahulu, dengan persetujuan terpisah. OCR memakai Claude melalui OpenRouter, maksimal 15 MiB dan 30 halaman PDF, dan bisa memakan waktu sekitar satu menit.</p></div></div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}

/* ------------------------------------------------------------------ small pieces */
function DocIcon({ d, className = "h-4 w-4" }: { d: VaultDocument; className?: string }) {
  return isImage(d) ? <FileImage className={className} /> : <FileText className={className} />;
}
function StatusPill({ d }: { d: VaultDocument }) {
  const tone = d.status === "ready" ? "bg-pub-emerald/10 text-pub-emerald" : d.status === "failed" ? "bg-destructive/10 text-destructive" : d.status === "processing" ? "bg-pub-sky/10 text-pub-sky" : "bg-muted text-muted-foreground";
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${tone}`} data-testid={`status-document-${d.id}`}>{d.status === "processing" && <Loader2 className="h-2.5 w-2.5 animate-spin" />}{STATUS_LABEL[d.status] ?? d.status}</span>;
}
function ErrorBox({ msg, onRetry, testId }: { msg: string; onRetry: () => void; testId: string }) {
  return (
    <div role="alert" className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
      <p className="font-semibold text-destructive">{msg}</p>
      <Button size="sm" variant="outline" className="mt-3" onClick={onRetry} data-testid={testId}><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Coba lagi</Button>
    </div>
  );
}
function Skel({ className }: { className: string }) { return <div className={`animate-pulse rounded-lg bg-muted ${className}`} />; }

/* ------------------------------------------------------------------ workspace */
function Workspace() {
  const { documents, analyses, upload, analyze, chat, remove, ocr, refresh } = useDocumentAnalysis();
  const [params, setParams] = useSearchParams();
  const docId = params.get("dokumen");
  const analysisParam = params.get("analisis");

  const docs = useMemo(() => [...(documents.data?.documents ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [documents.data]);
  const list = useMemo(() => [...(analyses.data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [analyses.data]);
  const doc = docs.find(d => d.id === docId) ?? null;
  const docAnalyses = list.filter(a => a.documentId === docId);
  const current = docAnalyses.find(a => a.id === analysisParam) ?? docAnalyses[0] ?? null;

  const [aiConsent, setAiConsent] = useState(false);
  const [ocrConsent, setOcrConsent] = useState(false);
  const [autoConsent, setAutoConsent] = useState(false);
  const [question, setQuestion] = useState("");
  const [compareRegulations, setCompareRegulations] = useState(false);
  useEffect(() => { setCompareRegulations(false); }, [docId, current?.id]);
  const [chatError, setChatError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");
  const [toDelete, setToDelete] = useState<Analysis | null>(null);
  const [ktkAnalysis, setKtkAnalysis] = useState<Analysis | null>(null);
  const [tab, setTab] = useState<"ringkasan" | "checklist" | "risiko" | "regulasi">("ringkasan");
  const fileRef = useRef<HTMLInputElement>(null);
  const alive = useRef(true);
  const selectedId = useRef(docId);
  selectedId.current = docId;
  const chatEnd = useRef<HTMLDivElement>(null);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  // Selected-document change clears consents, chat input and errors.
  useEffect(() => { setAiConsent(false); setOcrConsent(false); setAutoConsent(false); setQuestion(""); setChatError(null); setActionError(null); setKtkAnalysis(null); setTab("ringkasan"); }, [docId]);
  useEffect(() => { chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }); }, [current?.messages.length]);
  useEffect(() => {
    if (ktkAnalysis && analyses.data?.some(a => a.id === ktkAnalysis.id && a.sourceCurrent === false)) {
      setKtkAnalysis(null);
    }
  }, [analyses.data, ktkAnalysis]);

  const select = (id: string | null, analysisId?: string) => {
    const next = new URLSearchParams();
    if (id) next.set("dokumen", id);
    if (analysisId) next.set("analisis", analysisId);
    setParams(next, { replace: false });
  };

  const runAnalyze = async (id: string, partIndex = 0) => {
    setActionError(null);
    try { const res = await analyze.mutateAsync({ documentId: id, partIndex }); if (alive.current && selectedId.current === id) { select(res.documentId, res.id); if (res.parts?.some(p => p.status === "failed")) toast.warning("Hasil tersimpan dengan bagian gagal. Periksa cakupan."); else toast.success("Hasil bagian tersimpan."); } }
    catch (e) { if (alive.current && selectedId.current === id) setActionError(analysisError(e)); }
  };
  const runOcr = async (id: string) => {
    setActionError(null);
    try { await ocr.mutateAsync(id); if (alive.current && selectedId.current === id) { setOcrConsent(false); toast.success("OCR dimulai. Status teks akan diperbarui setelah pemrosesan selesai."); } }
    catch (e) { if (alive.current && selectedId.current === id) setActionError(analysisError(e)); }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadError(null);
    if (!/\.(pdf|txt|jpe?g|png)$/i.test(file.name)) { setUploadError("Format tidak didukung. Pilih PDF, TXT, JPG, atau PNG."); return; }
    if (file.size > BEDAH_MAX_BYTES) { setUploadError(`${file.name} berukuran ${formatBytes(file.size)}. Batas unggah 50 MB.`); return; }
    const consentAtUpload = autoConsent;
    try {
      const saved = await upload.mutateAsync(file);
      if (!alive.current) return;
      select(saved.id);
      toast.success(`${saved.name} tersimpan di Ruang Simpan.`);
      if (consentAtUpload && hasText(saved)) await runAnalyze(saved.id);
    } catch (e) { if (alive.current) setUploadError(analysisError(e)); }
    finally { if (fileRef.current) fileRef.current.value = ""; }
  };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDrag(false); void handleFile(e.dataTransfer.files?.[0]); };

  const sendChat = async (e: FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    const sendingDoc = docId;
    if (!current || !aiConsent || !q || chat.isPending) return;
    setChatError(null);
    try { await chat.mutateAsync({ id: current.id, question: q, compareRegulations }); if (alive.current && selectedId.current === sendingDoc) setQuestion(value => value.trim() === q ? "" : value); }
    catch (err) { if (alive.current && selectedId.current === sendingDoc) setChatError(analysisError(err)); }
  };

  const confirmDelete = async () => {
    const a = toDelete; if (!a) return;
    try { await remove.mutateAsync(a.id); toast.success("Analisis dihapus. Berkas sumber tetap di Ruang Simpan."); if (a.id === current?.id) select(a.documentId); }
    catch (e) { toast.error(analysisError(e)); }
    finally { setToDelete(null); }
  };

  const picker = docs.filter(d => d.name.toLowerCase().includes(pickerQuery.trim().toLowerCase()));
  const quota = documents.data;
  const busy = analyze.isPending || ocr.isPending;
  const nextPart = current?.sourceCurrent !== false ? current?.parts?.find(p => p.status === "pending") : undefined;
  const processing = current?.sourceCurrent !== false && current?.parts?.some(p => p.status === "processing");

  return (
    <div className="mx-auto max-w-[1400px] space-y-6 pb-12">
      {/* header */}
      <header className="relative overflow-hidden rounded-2xl bg-pub-navy px-6 py-7 text-white md:px-8">
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-[0.07]" style={grid} />
        <div className="relative flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-pub-amber">Ruang kerja privat</p>
            <h1 className="mt-2 font-heading text-3xl font-extrabold md:text-4xl">Bedah Dokumen</h1>
            <p className="mt-1 max-w-xl text-sm text-white/70">Dokumen tender, SKK/SBU, kontrak, dan gambar teknis dari berkas Anda sendiri. Hasil wajib diverifikasi.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {quota && (
              <div className="min-w-[180px] font-mono text-[11px] text-white/70" data-testid="text-quota">
                <div className="flex justify-between"><span>{formatBytes(quota.usedBytes)}</span><span>{formatBytes(quota.limitBytes)}</span></div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/15"><div className="h-full origin-left bg-pub-amber transition-transform duration-700" style={{ transform: `scaleX(${Math.min(1, quota.usedBytes / Math.max(1, quota.limitBytes))})` }} /></div>
              </div>
            )}
            <Button variant="outline" size="sm" onClick={() => void refresh()} className="border-white/25 bg-transparent text-white hover:bg-white/10" data-testid="button-refresh"><RefreshCw className="mr-1.5 h-3.5 w-3.5" />Muat ulang</Button>
          </div>
        </div>
        <ul className="relative mt-5 flex flex-wrap gap-2" aria-label="Kategori dokumen">
          {CATEGORIES.map(c => {
            const on = current?.result.category === c;
            return <li key={c} data-testid={`indicator-category-${c}`} className={`rounded-full border px-3 py-1 font-mono text-[11px] uppercase tracking-wider transition-all duration-300 ${on ? "border-pub-amber bg-pub-amber text-pub-navy" : "border-white/20 text-white/60"}`}>{c}</li>;
          })}
          {current?.result.category === "Dokumen Proyek" && <li className="rounded-full border border-pub-amber bg-pub-amber px-3 py-1 font-mono text-[11px] uppercase tracking-wider text-pub-navy">Dokumen Proyek</li>}
        </ul>
      </header>

      <VaultReferencePanel />
      {current?.sourceCurrent === false && (
        <div role="alert" className="rounded-xl border border-pub-amber/40 bg-pub-amber/10 p-4 text-sm">
          <strong>Sumber Ruang Simpan telah berubah atau belum siap dibaca.</strong> Hasil di bawah adalah catatan analisis sebelumnya, bukan telaah versi terbaru.
          Jalankan analisis ulang setelah teks siap. Chat menolak sumber yang sudah berubah.
        </div>
      )}
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        {/* left column */}
        <aside className="space-y-6">
          <section aria-labelledby="h-upload" className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <h2 id="h-upload" className="font-heading text-sm font-bold uppercase tracking-wider">Unggah dokumen</h2>
            <label
              onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)} onDrop={onDrop}
              className={`mt-3 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-all duration-200 focus-within:ring-2 focus-within:ring-ring ${drag ? "scale-[1.01] border-pub-amber bg-pub-amber/10" : "border-border hover:border-pub-amber/60 hover:bg-muted/40"}`}
              data-testid="dropzone-upload"
            >
              <input ref={fileRef} type="file" accept={BEDAH_ACCEPT} className="sr-only" onChange={e => void handleFile(e.target.files?.[0])} disabled={upload.isPending} data-testid="input-file" />
              {upload.isPending ? <Loader2 className="h-7 w-7 animate-spin text-pub-amber" /> : <UploadCloud className={`h-7 w-7 transition-transform ${drag ? "-translate-y-1 text-pub-amber" : "text-muted-foreground"}`} />}
              <span className="mt-2 text-sm font-semibold">{upload.isPending ? "Mengunggah ke Ruang Simpan..." : "Seret berkas ke sini atau pilih"}</span>
              <span className="mt-1 font-mono text-[11px] text-muted-foreground">PDF · TXT · JPG · PNG · maks 50 MB</span>
            </label>
            <label className="mt-3 flex items-start gap-2 text-xs text-muted-foreground">
              <Checkbox checked={autoConsent} onCheckedChange={v => setAutoConsent(v === true)} data-testid="checkbox-auto-analyze" className="mt-0.5" />
              <span>Saya setuju bagian pertama teks berkas yang akan saya unggah langsung dikirim ke Claude Sonnet melalui OpenRouter (maksimal 1.400 token keluaran). Bagian berikutnya dijalankan lewat klik terpisah; gambar dan PDF pindaian tetap perlu persetujuan OCR terpisah.</span>
            </label>
            {uploadError && <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive" data-testid="text-upload-error">{uploadError}</p>}
            <Button variant="outline" className="mt-3 w-full" onClick={() => setPickerOpen(true)} disabled={!documents.data} data-testid="button-open-picker"><FolderOpen className="mr-2 h-4 w-4" />Ambil dari Ruang Simpan</Button>
          </section>

          <section aria-labelledby="h-docs" className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between"><h2 id="h-docs" className="font-heading text-sm font-bold uppercase tracking-wider">Dokumen Saya</h2><span className="font-mono text-[11px] text-muted-foreground">{docs.length}</span></div>
            <div className="mt-3">
              {documents.isLoading ? <div className="space-y-2">{[0, 1, 2].map(i => <Skel key={i} className="h-12" />)}</div>
                : documents.isError ? <ErrorBox msg={analysisError(documents.error)} onRetry={() => void documents.refetch()} testId="button-retry-documents" />
                : docs.length === 0 ? <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">Ruang Simpan Anda masih kosong. Unggah berkas pertama di atas.</div>
                : (
                  <ul className="max-h-[360px] space-y-1 overflow-y-auto pr-1">
                    {docs.map(d => {
                      const n = list.filter(a => a.documentId === d.id).length;
                      return (
                        <li key={d.id}>
                          <button type="button" onClick={() => select(d.id)} data-testid={`button-select-document-${d.id}`} aria-current={d.id === docId}
                            className={`group flex w-full items-start gap-3 rounded-lg px-2.5 py-2 text-left transition-all ${d.id === docId ? "bg-pub-navy text-white" : "hover:bg-muted"}`}>
                            <DocIcon d={d} className={`mt-0.5 h-4 w-4 shrink-0 ${d.id === docId ? "text-pub-amber" : "text-muted-foreground"}`} />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium" data-testid={`text-document-name-${d.id}`}>{d.name}</span>
                              <span className="mt-0.5 flex flex-wrap items-center gap-1.5"><span className={`font-mono text-[10px] ${d.id === docId ? "text-white/60" : "text-muted-foreground"}`}>{formatBytes(d.size)}</span><StatusPill d={d} />{n > 0 && <span className="font-mono text-[10px] text-pub-amber">{n} analisis</span>}</span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
            </div>
          </section>

          <section aria-labelledby="h-saved" className="rounded-2xl border border-border bg-card p-4 shadow-card">
            <h2 id="h-saved" className="font-heading text-sm font-bold uppercase tracking-wider">Analisis tersimpan</h2>
            <div className="mt-3">
              {analyses.isLoading ? <div className="space-y-2">{[0, 1].map(i => <Skel key={i} className="h-10" />)}</div>
                : analyses.isError ? <ErrorBox msg={analysisError(analyses.error)} onRetry={() => void analyses.refetch()} testId="button-retry-analyses" />
                : list.length === 0 ? <p className="text-xs text-muted-foreground">Belum ada analisis. Pilih dokumen, beri persetujuan, lalu jalankan analisis.</p>
                : (
                  <ul className="space-y-1">
                    {list.map(a => (
                      <li key={a.id} className="group flex items-center gap-1">
                        <button type="button" onClick={() => select(a.documentId, a.id)} data-testid={`button-open-analysis-${a.id}`}
                          className={`min-w-0 flex-1 rounded-lg px-2.5 py-2 text-left transition-colors ${a.id === current?.id ? "bg-pub-amber/15" : "hover:bg-muted"}`}>
                          <span className="block truncate text-sm font-medium">{a.documentName}</span>
                          <span className="font-mono text-[10px] text-muted-foreground">{a.result.category} · {formatDate(a.createdAt)}{a.truncated ? " · sebagian" : ""}</span>
                        </button>
                        <button type="button" aria-label={`Hapus analisis ${a.documentName}`} onClick={() => setToDelete(a)} data-testid={`button-delete-analysis-${a.id}`}
                          className="rounded-md p-2 text-muted-foreground opacity-60 transition hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"><Trash2 className="h-3.5 w-3.5" /></button>
                      </li>
                    ))}
                  </ul>
                )}
            </div>
          </section>
        </aside>

        {/* right column */}
        <section aria-live="polite" className="min-w-0 space-y-6">
          {!docId ? (
            <div className="relative overflow-hidden rounded-2xl border border-dashed border-border bg-card px-6 py-16 text-center">
              <div aria-hidden className="pointer-events-none absolute inset-0 text-pub-navy opacity-[0.035]" style={grid} />
              <BookMarked className="relative mx-auto h-10 w-10 text-pub-amber" />
              <h2 className="relative mt-4 font-heading text-2xl font-bold">Meja telaah masih kosong</h2>
              <p className="relative mx-auto mt-2 max-w-md text-sm text-muted-foreground">Unggah berkas baru, ambil dari Ruang Simpan, atau buka analisis tersimpan di sebelah kiri.</p>
            </div>
          ) : documents.isLoading ? <Skel className="h-64" />
            : !doc ? (
              <div className="rounded-2xl border border-border bg-card p-6">
                <p className="font-semibold">Dokumen tidak ditemukan di Ruang Simpan Anda.</p>
                <p className="mt-1 text-sm text-muted-foreground">Mungkin sudah dihapus atau tautan ini milik akun lain.</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => select(null)} data-testid="button-clear-selection">Kosongkan pilihan</Button>
              </div>
            ) : (
              <>
                {/* selected document card */}
                <div className="rounded-2xl border border-border bg-card p-5 shadow-card animate-in fade-in duration-300" data-testid="card-selected-document">
                  <div className="flex flex-wrap items-start gap-4">
                    <div className="grid h-12 w-12 place-items-center rounded-xl bg-pub-navy text-pub-amber"><DocIcon d={doc} className="h-5 w-5" /></div>
                    <div className="min-w-0 flex-1">
                      <h2 className="break-words font-heading text-xl font-bold" data-testid="text-selected-name">{doc.name}</h2>
                      <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-xs text-muted-foreground"><span>{formatBytes(doc.size)}</span><span>·</span><span>{formatDate(doc.createdAt)}</span><StatusPill d={doc} />{hasText(doc) && <span>{doc.text.length.toLocaleString("id-ID")} karakter terekstrak</span>}</p>
                    </div>
                  </div>

                  {hasText(doc) ? (
                    <div className="mt-5 rounded-xl border border-pub-amber/30 bg-pub-amber/5 p-4">
                      <label className="flex items-start gap-3 text-sm">
                        <Checkbox checked={aiConsent} onCheckedChange={v => setAiConsent(v === true)} className="mt-0.5" data-testid="checkbox-ai-consent" />
                        <span>Saya setuju teks terekstrak dari <strong>{doc.name}</strong> dikirim ke <strong>Claude Sonnet melalui OpenRouter</strong> (tanpa model cadangan otomatis) untuk analisis dan tanya jawab. Saya paham hasil AI wajib diverifikasi dan bukan sertifikasi resmi atau nasihat hukum.</span>
                      </label>
                      <p className="mt-2 pl-7 text-xs text-muted-foreground">Ekstraksi lokal maksimal 600 halaman PDF/600.000 karakter. Satu klik memproses satu bagian hingga 30.000 karakter, maksimal 1.400 token keluaran berbayar; hingga 20 bagian, tiga percobaan per bagian. Tidak ada pengiriman bagian berikutnya atau pengulangan otomatis. Penggabungan lokal tanpa biaya AI tambahan. Persetujuan hilang saat berganti dokumen atau akun.</p>
                      <p className="mt-2 pl-7 text-xs text-muted-foreground">{doc.extraction?.note ?? "Cakupan ekstraksi lama/OCR belum diketahui. Unggah ulang sumber lama untuk membaca lebih dari batas sebelumnya."}</p>
                      <div className="mt-3 flex flex-wrap gap-2 pl-7">
                        <Button onClick={() => void runAnalyze(doc.id, nextPart?.index ?? 0)} disabled={!aiConsent || busy || !!processing} className="bg-pub-navy text-white hover:bg-pub-navy-light" data-testid="button-analyze">
                          {analyze.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanText className="mr-2 h-4 w-4" />}
                          {nextPart ? `Analisis bagian ${nextPart.index + 1}` : current?.sourceCurrent !== false && current ? "Periksa / buka analisis" : "Analisis bagian pertama"}
                        </Button>
                      </div>
                      {current && <p className="mt-2 pl-7 text-xs text-muted-foreground">Bagian berhasil digunakan kembali tanpa biaya AI baru. Bagian gagal dapat dicoba ulang secara terpisah di daftar cakupan. Laporan lama tanpa daftar bagian: ekspor lalu hapus dan mulai ulang untuk analisis bertahap.</p>}
                    </div>
                  ) : doc.status === "processing" ? (
                    <p className="mt-5 flex items-center gap-2 rounded-xl bg-pub-sky/10 p-4 text-sm text-pub-sky"><Loader2 className="h-4 w-4 animate-spin" />Ruang Simpan sedang memproses berkas ini. Status diperbarui otomatis.</p>
                  ) : ocrEligible(doc) ? (
                    <div className="mt-5 rounded-xl border border-pub-sky/30 bg-pub-sky/5 p-4 text-sm">
                      <p className="font-semibold">Belum ada teks yang bisa dianalisis.</p>
                      <p className="mt-1 text-muted-foreground">{isImage(doc) ? "Gambar ini tersimpan, tetapi isinya belum dibaca." : "PDF ini tampaknya hasil pindai tanpa lapisan teks."} OCR adalah langkah terpisah sebelum analisis.</p>
                      {doc.ocrError && <p className="mt-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive" data-testid="text-ocr-error">OCR sebelumnya gagal: {doc.ocrError}</p>}
                      {doc.size > OCR_MAX_BYTES ? (
                        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-xs" data-testid="text-ocr-too-large">Berkas tetap tersimpan, tetapi ukurannya {formatBytes(doc.size)} melebihi batas OCR 15 MiB. Unggah salinan yang lebih kecil untuk dibaca.</p>
                      ) : (
                        <>
                          <label className="mt-3 flex items-start gap-3">
                            <Checkbox checked={ocrConsent} onCheckedChange={v => setOcrConsent(v === true)} className="mt-0.5" data-testid="checkbox-ocr-consent" />
                            <span>Saya setuju berkas ini dikirim ke <strong>Claude melalui OpenRouter</strong> untuk OCR. Batas 15 MiB, 30 halaman PDF, dan 100.000 karakter teks; proses bisa memakan waktu sekitar 60 detik.</span>
                          </label>
                          <Button className="mt-3" variant="outline" onClick={() => void runOcr(doc.id)} disabled={!ocrConsent || busy} data-testid="button-ocr">
                            {ocr.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanText className="mr-2 h-4 w-4" />}{ocr.isPending ? "Menjalankan OCR..." : "Jalankan OCR"}
                          </Button>
                        </>
                      )}
                    </div>
                  ) : (
                    <p className="mt-5 rounded-xl bg-muted p-4 text-sm text-muted-foreground">Berkas ini belum memiliki teks yang dapat dianalisis{doc.status === "failed" ? " karena pemrosesan gagal" : ""}. Coba unggah ulang dalam format PDF, TXT, JPG, atau PNG.</p>
                  )}
                  {actionError && <p role="alert" className="mt-3 rounded-lg bg-destructive/10 px-3 py-2 text-sm font-medium text-destructive" data-testid="text-action-error">{actionError}</p>}
                </div>

                {analyze.isPending && (
                  <div className="space-y-3 rounded-2xl border border-border bg-card p-5" aria-busy="true">
                    <p className="flex items-center gap-2 text-sm font-medium"><Loader2 className="h-4 w-4 animate-spin text-pub-amber" />Menganalisis satu bagian. Hasil tersimpan di server; muat ulang untuk melihat kemajuan jika koneksi terputus.</p>
                    <Skel className="h-4 w-2/3" /><Skel className="h-4 w-full" /><Skel className="h-4 w-5/6" /><Skel className="h-24 w-full" />
                  </div>
                )}

                {analyses.isLoading ? <Skel className="h-72" /> : analyses.isError ? null : !current ? (
                  !analyze.isPending && <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Belum ada analisis tersimpan untuk dokumen ini.</div>
                ) : (
                  <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-card animate-in fade-in slide-in-from-bottom-2 duration-500" data-testid="card-analysis">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
                      <div>
                        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-pub-amber" data-testid="text-analysis-category">{current.result.category}</p>
                        <p className="mt-0.5 font-mono text-xs text-muted-foreground">{formatDate(current.createdAt)} · {current.model} · {current.analyzedCharacters.toLocaleString("id-ID")} / {current.sourceCharacters.toLocaleString("id-ID")} karakter</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {docAnalyses.length > 1 && (
                          <select aria-label="Pilih versi analisis" value={current.id} onChange={e => select(doc.id, e.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-xs" data-testid="select-analysis-version">
                            {docAnalyses.map(a => <option key={a.id} value={a.id}>{formatDate(a.createdAt)}</option>)}
                          </select>
                        )}
                        <Button size="sm" disabled={current.sourceCurrent === false} onClick={() => setKtkAnalysis(current)} data-testid="button-export-ktk"><Download className="mr-1.5 h-3.5 w-3.5" />Export KTK</Button>
                        <Button size="sm" variant="outline" onClick={() => printReport(current)} data-testid="button-print-report"><Printer className="mr-1.5 h-3.5 w-3.5" />Cetak</Button>
                        <Button size="sm" variant="outline" onClick={() => downloadMd(current)} data-testid="button-download-md"><Download className="mr-1.5 h-3.5 w-3.5" />.md</Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => setToDelete(current)} data-testid="button-delete-current"><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>
                    {current.truncated && (
                      <div role="alert" className="flex gap-3 border-b border-pub-amber/40 bg-pub-amber/15 px-5 py-3 text-sm" data-testid="banner-truncated">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-pub-amber" />
                        <p><strong>Analisis sebagian / cakupan file belum lengkap.</strong> {current.analyzedCharacters.toLocaleString("id-ID")} dari {current.sourceCharacters.toLocaleString("id-ID")} karakter terekstrak berhasil dianalisis. Ini bukan jumlah karakter seluruh file. Bagian gagal, belum diproses, atau tidak terekstrak tidak tercermin dalam temuan.</p>
                      </div>
                    )}
                    <div className="space-y-2 border-b border-border px-5 py-4 text-sm" data-testid="analysis-coverage">
                      <p>{current.coverageNote ?? "Laporan lama; cakupan ekstraksi file belum diketahui."}</p>
                      <p className="text-xs text-muted-foreground">Ringkasan dan temuan digabung dari bagian berhasil tanpa membuang bagian akhir. “Tidak ditemukan” pada satu bagian bukan bukti ketiadaan di seluruh dokumen. Kategori mengikuti bagian berhasil pertama.</p>
                      {current.parts?.map(p => <div key={p.index} className="rounded-lg border border-border p-3" data-testid={`analysis-part-${p.index}`}>
                        <p className="font-medium">Bagian {p.index + 1}: {partStatus[p.status]} · karakter {p.start + 1}–{p.end} · {p.attempts}/3 percobaan</p>
                        {p.error && <p role="alert" className="mt-1 text-xs text-destructive">{p.error}</p>}
                        {p.status === "failed" && p.attempts < 3 && current.sourceCurrent !== false && <Button size="sm" variant="outline" className="mt-2" disabled={!aiConsent || busy || !!processing} onClick={() => void runAnalyze(doc.id, p.index)} data-testid={`retry-part-${p.index}`}>Coba ulang bagian {p.index + 1} (berbayar)</Button>}
                      </div>)}
                    </div>
                    <div role="tablist" aria-label="Bagian analisis" className="flex gap-1 overflow-x-auto border-b border-border px-3">
                      {([["ringkasan", "Ringkasan", null], ["checklist", "Checklist", current.result.checklist.length], ["risiko", "Risiko", current.result.risks.length], ["regulasi", "Regulasi", current.result.regulations.length]] as const).map(([k, l, n]) => (
                        <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} data-testid={`tab-${k}`}
                          className={`relative whitespace-nowrap px-3 py-3 text-sm font-medium transition-colors ${tab === k ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}>
                          {l}{n !== null && <span className="ml-1.5 font-mono text-[10px] text-muted-foreground">{n}</span>}
                          <span className={`absolute inset-x-2 bottom-0 h-0.5 origin-left bg-pub-amber transition-transform duration-300 ${tab === k ? "scale-x-100" : "scale-x-0"}`} />
                        </button>
                      ))}
                    </div>
                    <div className="p-5" role="tabpanel">
                      {tab === "ringkasan" && <p className="whitespace-pre-wrap text-[15px] leading-relaxed" data-testid="text-summary">{current.result.summary}</p>}
                      {tab === "checklist" && (current.result.checklist.length === 0 ? <p className="text-sm text-muted-foreground">Tidak ada butir checklist.</p> : (
                        <ul className="divide-y divide-border">
                          {current.result.checklist.map((c, i) => { const s = CHECK[c.status] ?? CHECK.perlu_dicek; return (
                            <li key={i} className="flex gap-3 py-3" data-testid={`row-checklist-${i}`}><s.icon className={`mt-0.5 h-4 w-4 shrink-0 ${s.cls}`} /><div><p className="text-sm font-medium">{c.item} <span className={`ml-1 font-mono text-[10px] uppercase ${s.cls}`}>{s.label}</span></p>{c.evidence && <p className="mt-1 text-xs text-muted-foreground">{c.evidence}</p>}<EvidenceLocation source={c.source} /></div></li>
                          ); })}
                        </ul>
                      ))}
                      {tab === "risiko" && (current.result.risks.length === 0 ? <p className="text-sm text-muted-foreground">Tidak ada risiko yang dicatat.</p> : (
                        <ul className="space-y-3">
                          {current.result.risks.map((k, i) => { const s = SEVERITY[k.severity] ?? SEVERITY.sedang; return (
                            <li key={i} className="rounded-xl border border-border p-4" data-testid={`row-risk-${i}`}>
                              <div className="flex items-start justify-between gap-3"><p className="flex gap-2 font-semibold"><ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />{k.title}</p><span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${s.cls}`}>{s.label}</span></div>
                              {k.evidence && <p className="mt-2 text-sm text-muted-foreground"><span className="font-mono text-[10px] uppercase">Bukti</span> {k.evidence}</p>}
                              <EvidenceLocation source={k.source} />
                              {k.recommendation && <p className="mt-1.5 text-sm"><span className="font-mono text-[10px] uppercase text-pub-emerald">Rekomendasi</span> {k.recommendation}</p>}
                            </li>
                          ); })}
                        </ul>
                      ))}
                      {tab === "regulasi" && (current.result.regulations.length === 0 ? <p className="text-sm text-muted-foreground">Tidak ada regulasi yang dicatat.</p> : (
                        <ul className="divide-y divide-border">
                          {current.result.regulations.map((g, i) => (
                            <li key={i} className="py-3" data-testid={`row-regulation-${i}`}><p className="text-sm font-semibold">{g.title}</p>{g.evidence && <p className="mt-1 text-xs text-muted-foreground">{g.evidence}</p>}<EvidenceLocation source={g.source} />{g.note && <p className="mt-1 text-xs">{g.note}</p>}</li>
                          ))}
                          <li className="pt-3 text-xs text-muted-foreground">Rujukan regulasi berasal dari AI; cek nomor dan berlakunya pada sumber resmi.</li>
                        </ul>
                      ))}
                    </div>
                  </article>
                )}

                {/* chat */}
                {current && (
                  <section aria-labelledby="h-chat" className="rounded-2xl border border-border bg-card shadow-card">
                    <div className="flex items-center gap-2 border-b border-border px-5 py-3"><MessageSquare className="h-4 w-4 text-pub-amber" /><h2 id="h-chat" className="font-heading text-sm font-bold uppercase tracking-wider">Tanya dokumen</h2></div>
                    <div className="max-h-[460px] space-y-4 overflow-y-auto px-5 py-4">
                      <p className="text-xs text-muted-foreground">Chat hanya menerima 30.000 karakter awal, bukan seluruh analisis bertahap. Untuk bukti bagian akhir, gunakan temuan beserta lokasi sumber di laporan.</p>
                      {current.messages.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada pertanyaan.</p>
                        : current.messages.map(m => (
                          <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`} data-testid={`message-${m.role}-${m.id}`}>
                            <div className={`max-w-[88%] rounded-2xl px-4 py-2.5 text-sm ${m.role === "user" ? "rounded-br-sm bg-pub-navy text-white" : "rounded-bl-sm bg-muted"}`}>
                              {m.compareRegulations && <p className="mb-2 text-xs font-semibold">Perbandingan referensi · bukan keputusan kepatuhan</p>}
                              {m.role === "user" ? <p className="whitespace-pre-wrap">{m.content}</p> : <MarkdownRenderer className="prose prose-sm max-w-none dark:prose-invert">{m.content}</MarkdownRenderer>}
                              {!!m.sources?.length && <details className="mt-3 border-t border-border pt-2">
                                <summary className="cursor-pointer text-xs font-semibold">Lihat kutipan dokumen dan referensi yang dikirim ke AI</summary>
                                <p className="mt-2 text-xs text-muted-foreground">Daftar ini menunjukkan bahan yang diberikan, bukan bukti bahwa setiap kesimpulan AI benar. Periksa kecocokan kutipannya.</p>
                                {m.sources.map((source, i) => <div key={`${source.id}:${i}`} className="mt-3">
                                  <p className="break-words text-xs font-semibold">[{i + 1}] {source.name}</p>
                                  <pre className="mt-1 max-h-48 overflow-y-auto whitespace-pre-wrap break-words font-sans text-xs">{source.quote}</pre>
                                </div>)}
                              </details>}
                              <p className={`mt-1 font-mono text-[10px] ${m.role === "user" ? "text-white/50" : "text-muted-foreground"}`}>{formatDate(m.createdAt)}</p>
                            </div>
                          </div>
                        ))}
                      {chat.isPending && <div className="flex items-center gap-2 text-sm text-muted-foreground"><CircleDashed className="h-4 w-4 animate-spin" />Menyusun jawaban...</div>}
                      <div ref={chatEnd} />
                    </div>
                    <form onSubmit={sendChat} className="border-t border-border p-4">
                      <label className="mb-2 flex items-start gap-2 text-sm">
                        <Checkbox checked={compareRegulations} onCheckedChange={value => setCompareRegulations(value === true)} disabled={chat.isPending} data-testid="checkbox-compare-regulations" />
                        <span>Bandingkan dengan referensi regulasi</span>
                      </label>
                      {compareRegulations && <p className="mb-3 text-xs text-muted-foreground">
                        Sebutkan topik dan sumber, misalnya “Bandingkan ketentuan PUB dalam dokumen dengan KB18 dan KB46”.
                        Kirim hanya jika Anda menyetujui pemrosesan AI di bawah. Kutipan eksternal dipisahkan dari dokumen Anda;
                        korpus bukan jaminan regulasi terkini. Tidak mengubah hasil analisis utama.
                      </p>}
                      {!aiConsent && <p className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Lock className="h-3 w-3" />Centang persetujuan AI pada kartu dokumen di atas untuk bertanya.</p>}
                      {chatError && <p role="alert" className="mb-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive" data-testid="text-chat-error">{chatError}</p>}
                      <div className="flex gap-2">
                        <label htmlFor="chat-q" className="sr-only">Pertanyaan</label>
                        <Textarea id="chat-q" value={question} onChange={e => setQuestion(e.target.value.slice(0, 2000))} disabled={!aiConsent || chat.isPending} rows={2} placeholder="Contoh: apa saja syarat kualifikasi yang disebut?"
                          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} className="min-h-[52px] resize-none" data-testid="input-chat" />
                        <Button type="submit" disabled={!aiConsent || !question.trim() || chat.isPending} className="h-auto bg-pub-amber text-pub-navy hover:bg-pub-amber-light" aria-label="Kirim pertanyaan" data-testid="button-send-chat">
                          {chat.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        </Button>
                      </div>
                      <p className="mt-1.5 text-right font-mono text-[10px] text-muted-foreground">{question.length}/2000</p>
                    </form>
                  </section>
                )}
              </>
            )}
          <p className="text-xs text-muted-foreground">Hasil Bedah Dokumen disusun AI dari teks dokumen Anda, dapat keliru atau tidak lengkap, dan wajib diverifikasi. Bukan sertifikasi resmi, keputusan lembaga, maupun nasihat hukum.</p>
        </section>
      </div>

      <KtkDialog analysis={ktkAnalysis} onClose={() => setKtkAnalysis(null)} />
      <Dialog open={pickerOpen} onOpenChange={o => { setPickerOpen(o); if (!o) setPickerQuery(""); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Ambil dari Ruang Simpan</DialogTitle><DialogDescription>Memilih dokumen tidak mengirim apa pun ke AI.</DialogDescription></DialogHeader>
          <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input value={pickerQuery} onChange={e => setPickerQuery(e.target.value)} placeholder="Cari nama berkas" className="pl-9" aria-label="Cari nama berkas" data-testid="input-picker-search" /></div>
          <ul className="max-h-[50vh] space-y-1 overflow-y-auto">
            {picker.length === 0 ? <li className="py-6 text-center text-sm text-muted-foreground">{docs.length ? "Tidak ada berkas yang cocok." : "Ruang Simpan kosong."}</li> : picker.map(d => (
              <li key={d.id}><button type="button" onClick={() => { select(d.id); setPickerOpen(false); setPickerQuery(""); }} data-testid={`button-pick-${d.id}`} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-muted">
                <DocIcon d={d} className="h-4 w-4 shrink-0 text-muted-foreground" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{d.name}</span><span className="font-mono text-[10px] text-muted-foreground">{formatBytes(d.size)}</span></span><StatusPill d={d} /></button></li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={o => { if (!o) setToDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus analisis ini?</AlertDialogTitle><AlertDialogDescription>Ringkasan, checklist, risiko, regulasi, dan riwayat tanya jawab untuk {toDelete?.documentName} akan dihapus. Berkas sumber tetap tersimpan di Ruang Simpan.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">Batal</AlertDialogCancel>
            <AlertDialogAction onClick={e => { e.preventDefault(); void confirmDelete(); }} disabled={remove.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" data-testid="button-confirm-delete">{remove.isPending ? "Menghapus..." : "Hapus analisis"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default function DocumentAnalysis() {
  const { user, loading } = useAuth();
  usePageMeta("Bedah Dokumen | PUB ASPEKINDO", "Telaah dokumen konstruksi pribadi dari Ruang Simpan: ringkasan, checklist, risiko, regulasi, dan tanya jawab dengan AI setelah persetujuan Anda.");
  if (loading) return <div className="flex min-h-[100dvh] items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-pub-amber" /></div>;
  if (!user) return <Intro />;
  return <DashboardLayout><Workspace key={user.id} /></DashboardLayout>;
}
