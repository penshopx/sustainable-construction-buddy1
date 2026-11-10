import { useMemo, useState } from "react";
import type { SchemeReferenceBank, SchemeReferenceCase, SchemeReferenceEvidence } from "@workspace/api-client-react";
import { AlertTriangle, BookOpen, ChevronLeft, ChevronRight, FileText, RefreshCw, Scale, Search, ShieldAlert } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

const PAGE_SIZE = 10;
const KIND_LABEL: Record<string, string> = { reference: "Acuan", boundary: "Batas kewenangan", application_policy: "Kebijakan aplikasi" };

function sourceLabel(ev: SchemeReferenceEvidence) {
  if (ev.kind === "pdf") return ev.page ? `PDF, halaman ${ev.page}` : "PDF, halaman tidak tercatat";
  if (ev.kind === "text") {
    if (ev.lineStart && ev.lineEnd && ev.lineEnd !== ev.lineStart) return `Teks, baris ${ev.lineStart}–${ev.lineEnd}`;
    if (ev.lineStart) return `Teks, baris ${ev.lineStart}`;
    return "Teks, baris tidak tercatat";
  }
  return "Kebijakan aplikasi — bukan sumber hukum";
}

function List({ title, items, tone }: { title: string; items: string[]; tone?: "warn" }) {
  if (!items.length) return null;
  return <div>
    <h4 className={`text-xs font-semibold uppercase tracking-wide mb-1 ${tone === "warn" ? "text-destructive" : "text-muted-foreground"}`}>{title}</h4>
    <ul className="list-disc pl-5 space-y-0.5 text-sm">{items.map((t, i) => <li key={i}>{t}</li>)}</ul>
  </div>;
}

function CaseCard({ c, bank, title }: { c: SchemeReferenceCase; bank: SchemeReferenceBank; title?: string }) {
  const missing = c.evidenceIds.filter(id => !bank.evidence[id]);
  return <article data-testid={`card-reference-${c.id}`} className="rounded-xl border border-border bg-card p-4 space-y-3">
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded bg-primary/10 px-2 py-0.5 font-mono font-semibold text-primary">{c.code}</span>
      {title && <span className="text-muted-foreground">{title}</span>}
      <span className="rounded border border-border px-2 py-0.5">{c.category}</span>
      <span className={`rounded px-2 py-0.5 ${c.kind === "application_policy" ? "bg-pub-amber/15 text-pub-amber" : c.kind === "boundary" ? "bg-destructive/10 text-destructive" : "bg-muted"}`}>{KIND_LABEL[c.kind] ?? c.kind}</span>
      <span className="ml-auto rounded border border-pub-amber/40 px-2 py-0.5 text-pub-amber">Draf</span>
    </div>
    <h3 className="font-semibold text-foreground leading-snug">{c.question}</h3>
    <p className="text-sm whitespace-pre-wrap text-foreground/90">{c.answer}</p>
    {c.appliesTo.length > 0 && <p className="text-xs text-muted-foreground">Berlaku untuk: {c.appliesTo.join(", ")}</p>}
    <div className="grid gap-3 md:grid-cols-2">
      <List title="Poin wajib" items={c.requiredPoints} />
      <List title="Pertanyaan klarifikasi" items={c.clarificationQuestions} />
      <List title="Klaim yang dilarang" items={c.forbiddenClaims} tone="warn" />
    </div>
    <details className="rounded-lg border border-border bg-muted/30 text-sm">
      <summary data-testid={`toggle-sources-${c.id}`} className="cursor-pointer px-3 py-2 font-medium">
        Sumber ({c.evidenceIds.length}){missing.length > 0 && <span className="text-destructive"> · {missing.length} rujukan rusak</span>}
      </summary>
      <div className="space-y-2 p-3 pt-0">
        {c.evidenceIds.length === 0 && <p className="text-destructive text-xs">Kasus ini tidak memiliki rujukan bukti. Perlu ditinjau.</p>}
        {c.evidenceIds.map(id => {
          const ev = bank.evidence[id];
          if (!ev) return <div key={id} role="alert" className="rounded border border-destructive/40 bg-destructive/5 p-2 text-xs text-destructive">
            <AlertTriangle className="inline w-3 h-3 mr-1" />Rujukan <span className="font-mono">{id}</span> tidak ditemukan dalam bank bukti. Jangan gunakan klaim terkait sampai diperbaiki.
          </div>;
          const policy = ev.kind === "application_policy";
          return <div key={id} className={`rounded border p-2 ${policy ? "border-pub-amber/40 bg-pub-amber/5" : "border-border bg-background"}`}>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              {policy ? <ShieldAlert className="w-3.5 h-3.5 text-pub-amber" /> : ev.kind === "pdf" ? <FileText className="w-3.5 h-3.5 text-primary" /> : <Scale className="w-3.5 h-3.5 text-primary" />}
              <span className="font-medium">{ev.title}</span>
              <span className={policy ? "text-pub-amber" : "text-muted-foreground"}>· {sourceLabel(ev)}</span>
              <span className="font-mono text-muted-foreground">[{ev.id}]</span>
            </div>
            <blockquote className="mt-1 border-l-2 border-border pl-2 text-xs whitespace-pre-wrap text-foreground/80">{ev.quote}</blockquote>
          </div>;
        })}
      </div>
    </details>
  </article>;
}

export default function SchemeReferenceView({ bank, loading, error, onRetry }: {
  bank: SchemeReferenceBank | null; loading: boolean; error: string | null; onRetry: () => void;
}) {
  const [query, setQuery] = useState("");
  const [profile, setProfile] = useState("");
  const [category, setCategory] = useState("");
  const [page, setPage] = useState(1);

  const titles = useMemo(() => new Map((bank?.profiles ?? []).map(p => [p.code, p.title])), [bank]);
  const families = useMemo(() => {
    const m = new Map<string, SchemeReferenceBank["profiles"]>();
    (bank?.profiles ?? []).forEach(p => m.set(p.family, [...(m.get(p.family) ?? []), p]));
    return [...m.entries()];
  }, [bank]);
  const categories = useMemo(() => [...new Set((bank?.cases ?? []).map(c => c.category))].sort(), [bank]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (bank?.cases ?? []).filter(c => (!profile || c.code === profile) && (!category || c.category === category) &&
      (!q || [c.code, c.question, c.answer, c.category, ...c.requiredPoints, ...c.appliesTo].join(" ").toLowerCase().includes(q)));
  }, [bank, query, profile, category]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const shown = filtered.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE);
  const field = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground";

  const notice = <div role="note" className="rounded-xl border border-pub-amber/40 bg-pub-amber/5 p-3 text-sm flex gap-2">
    <AlertTriangle className="w-4 h-4 text-pub-amber shrink-0 mt-0.5" />
    <p><strong>Draf acuan untuk ditinjau.</strong> Ini bukan jawaban AI dan bukan keputusan sertifikasi. Isi tidak dipakai untuk balasan chat dan belum disetujui peninjau.</p>
  </div>;

  if (loading) return <section aria-busy="true" aria-label="Memuat referensi acuan" className="space-y-3">
    {notice}
    {[0, 1, 2].map(i => <div key={i} className="h-36 rounded-xl border border-border bg-muted/40 animate-pulse" />)}
  </section>;

  if (error || !bank) return <section className="space-y-3">{notice}
    <div role="alert" className="rounded-xl border border-destructive/40 bg-card p-6 text-center space-y-3">
      <p className="font-medium">Referensi acuan gagal dimuat.</p>
      <p className="text-sm text-muted-foreground">Periksa koneksi lalu coba lagi.</p>
      <Button data-testid="button-retry-reference" variant="outline" size="sm" onClick={onRetry}><RefreshCw className="w-4 h-4 mr-1" />Coba lagi</Button>
    </div>
  </section>;

  return <section aria-label="Referensi Acuan" className="space-y-4">
    {notice}
    <div className="rounded-xl border border-border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /><h2 className="font-semibold">Bank acuan skema</h2></div>
      <p className="text-xs text-muted-foreground">{bank.counts.cases} kasus · {bank.counts.profiles} subklasifikasi · {bank.counts.evidence} bukti</p>
      <p className="text-sm whitespace-pre-wrap">{bank.scope}</p>
      <details className="text-sm"><summary className="cursor-pointer font-medium">Panduan tinjauan</summary>
        <p className="mt-2 whitespace-pre-wrap text-muted-foreground">{bank.reviewGuidance}</p></details>
    </div>
    <div className="grid gap-3 md:grid-cols-3">
      <label className="text-sm space-y-1 relative"><span>Cari</span>
        <Search className="absolute left-2.5 bottom-2.5 w-4 h-4 text-muted-foreground" />
        <Input data-testid="input-reference-search" value={query} className="pl-8" placeholder="Kode, pertanyaan, poin..."
          onChange={e => { setQuery(e.target.value); setPage(1); }} />
      </label>
      <label className="text-sm space-y-1"><span>Subklasifikasi</span>
        <select data-testid="select-reference-profile" className={field} value={profile} onChange={e => { setProfile(e.target.value); setPage(1); }}>
          <option value="">Semua subklasifikasi</option>
          {families.map(([fam, rows]) => <optgroup key={fam} label={fam}>
            {rows.map(p => <option key={p.code} value={p.code}>{p.code} — {p.title}</option>)}</optgroup>)}
        </select>
      </label>
      <label className="text-sm space-y-1"><span>Kategori</span>
        <select data-testid="select-reference-category" className={field} value={category} onChange={e => { setCategory(e.target.value); setPage(1); }}>
          <option value="">Semua kategori</option>
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </label>
    </div>
    <p aria-live="polite" className="text-xs text-muted-foreground">{filtered.length} kasus cocok. Filter ini tidak mengubah profil chat.</p>
    {shown.length === 0 ? <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground space-y-2">
      <p>Tidak ada kasus acuan yang cocok.</p>
      <Button variant="ghost" size="sm" data-testid="button-reset-reference" onClick={() => { setQuery(""); setProfile(""); setCategory(""); setPage(1); }}>Atur ulang filter</Button>
    </div> : <div className="space-y-3">{shown.map(c => <CaseCard key={c.id} c={c} bank={bank} title={titles.get(c.code)} />)}</div>}
    {pages > 1 && <nav aria-label="Halaman" className="flex items-center justify-center gap-3">
      <Button data-testid="button-reference-prev" variant="outline" size="sm" disabled={current <= 1} onClick={() => setPage(current - 1)}><ChevronLeft className="w-4 h-4" />Sebelumnya</Button>
      <span className="text-sm">Halaman {current} / {pages}</span>
      <Button data-testid="button-reference-next" variant="outline" size="sm" disabled={current >= pages} onClick={() => setPage(current + 1)}>Berikutnya<ChevronRight className="w-4 h-4" /></Button>
    </nav>}
  </section>;
}
