import { useEffect, useMemo, useState } from "react";
import {
  Archive,
  Bot,
  CalendarClock,
  CheckCircle2,
  ExternalLink,
  Eye,
  FileCheck2,
  Loader2,
  Newspaper,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  XCircle,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import {
  INFORMATION_STATUS_LABELS,
  INFORMATION_TOPICS,
  formatInformationDate,
  isHttpsUrl,
  makeInformationSlug,
  type InformationArticle,
  type InformationSource,
} from "@/lib/informationCenter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner-toast";

type ArticleInsert = Database["public"]["Tables"]["information_articles"]["Insert"];
type EditorialStatus = "all" | "draft" | "review" | "scheduled" | "published" | "archived" | "rejected";

type ArticleForm = {
  channel: "industry" | "pub";
  title: string;
  slug: string;
  summary: string;
  body: string;
  topic: string;
  source_id: string;
  source_title: string;
  source_url: string;
  source_published_at: string;
  featured: boolean;
};

const EMPTY_FORM: ArticleForm = {
  channel: "industry",
  title: "",
  slug: "",
  summary: "",
  body: "",
  topic: "Regulasi",
  source_id: "",
  source_title: "",
  source_url: "",
  source_published_at: "",
  featured: false,
};

const STATUS_STYLES: Record<string, string> = {
  draft: "border-amber-300 bg-amber-50 text-amber-800",
  review: "border-orange-300 bg-orange-50 text-orange-800",
  scheduled: "border-violet-300 bg-violet-50 text-violet-800",
  published: "border-emerald-300 bg-emerald-50 text-emerald-800",
  archived: "border-slate-300 bg-slate-100 text-slate-700",
  rejected: "border-red-300 bg-red-50 text-red-800",
};

function toDateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

export default function AdminInformationCenter() {
  const [articles, setArticles] = useState<InformationArticle[]>([]);
  const [sources, setSources] = useState<InformationSource[]>([]);
  const [agentRuns, setAgentRuns] = useState<Database["public"]["Tables"]["information_agent_runs"]["Row"][]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<EditorialStatus>("all");
  const [channelFilter, setChannelFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<InformationArticle | null>(null);
  const [form, setForm] = useState<ArticleForm>(EMPTY_FORM);
  const [editorOpen, setEditorOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [scheduleTarget, setScheduleTarget] = useState<InformationArticle | null>(null);
  const [scheduleAt, setScheduleAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    const [articleResult, sourceResult, runResult] = await Promise.all([
      supabase
        .from("information_articles")
        .select("*, information_sources(name, domain, trust_level)")
        .order("updated_at", { ascending: false }),
      supabase.from("information_sources").select("*").order("name"),
      supabase.from("information_agent_runs").select("*").order("started_at", { ascending: false }).limit(12),
    ]);

    if (articleResult.error || sourceResult.error || runResult.error) {
      setLoadError(articleResult.error?.message ?? sourceResult.error?.message ?? runResult.error?.message ?? "Data belum dapat dimuat.");
    } else {
      setArticles(articleResult.data as InformationArticle[]);
      setSources(sourceResult.data);
      setAgentRuns(runResult.data);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return articles.filter((article) => {
      if (statusFilter !== "all" && article.status !== statusFilter) return false;
      if (channelFilter !== "all" && article.channel !== channelFilter) return false;
      return !normalized || `${article.title} ${article.slug} ${article.topic}`.toLowerCase().includes(normalized);
    });
  }, [articles, channelFilter, query, statusFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm(EMPTY_FORM);
    setEditorOpen(true);
  };

  const openEdit = (article: InformationArticle) => {
    if (article.status === "published" || article.status === "scheduled") {
      toast.error("Arsipkan artikel terlebih dahulu sebelum mengubah isi.");
      return;
    }
    setEditing(article);
    setForm({
      channel: article.channel as "industry" | "pub",
      title: article.title,
      slug: article.slug,
      summary: article.summary,
      body: article.body,
      topic: article.topic,
      source_id: article.source_id ?? "",
      source_title: article.source_title,
      source_url: article.source_url,
      source_published_at: toDateInput(article.source_published_at),
      featured: article.featured,
    });
    setEditorOpen(true);
  };

  const updateForm = <K extends keyof ArticleForm>(key: K, value: ArticleForm[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const selectSource = (sourceId: string) => {
    const source = sources.find((item) => item.id === sourceId);
    setForm((current) => ({
      ...current,
      source_id: sourceId,
      source_title: source?.name ?? current.source_title,
      source_url: source?.base_url ?? current.source_url,
    }));
  };

  const validate = () => {
    if (!form.title.trim() || !form.slug.trim() || !form.summary.trim() || !form.body.trim()) {
      toast.error("Judul, slug, ringkasan, dan isi wajib dilengkapi.");
      return false;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(form.slug)) {
      toast.error("Slug hanya boleh berisi huruf kecil, angka, dan tanda hubung.");
      return false;
    }
    if (!form.source_title.trim() || !isHttpsUrl(form.source_url.trim())) {
      toast.error("Nama sumber dan URL HTTPS yang valid wajib diisi.");
      return false;
    }
    if (!form.source_id) {
      toast.error("Pilih sumber aktif yang terdaftar.");
      return false;
    }
    return true;
  };

  const save = async (status: "draft" | "review" = "draft") => {
    if (!validate()) return;
    setSaving(true);
    const payload: ArticleInsert = {
      channel: form.channel,
      title: form.title.trim(),
      slug: form.slug.trim(),
      summary: form.summary.trim(),
      body: form.body.trim(),
      topic: form.topic,
      source_id: form.source_id,
      source_title: form.source_title.trim(),
      source_url: form.source_url.trim(),
      source_published_at: form.source_published_at ? `${form.source_published_at}T00:00:00+07:00` : null,
      featured: form.featured,
      status,
    };

    const result = editing
      ? await supabase.from("information_articles").update(payload).eq("id", editing.id)
      : await supabase.from("information_articles").insert(payload);
    setSaving(false);

    if (result.error) {
      toast.error(`Gagal menyimpan: ${result.error.message}`);
      return;
    }
    toast.success(status === "review" ? "Artikel dikirim ke antrean review." : "Draft artikel tersimpan.");
    setEditorOpen(false);
    await load();
  };

  const publish = async (article: InformationArticle) => {
    if (!window.confirm(`Terbitkan “${article.title}” dengan sumber ${article.information_sources?.name ?? article.source_title}?`)) return;
    setActingId(article.id);
    const { error } = await supabase.rpc("publish_information_article", { p_article_id: article.id });
    setActingId(null);
    if (error) toast.error(error.message);
    else {
      toast.success("Artikel berhasil diterbitkan.");
      await load();
    }
  };

  const archive = async (article: InformationArticle) => {
    setActingId(article.id);
    const { error } = await supabase.rpc("archive_information_article", { p_article_id: article.id });
    setActingId(null);
    if (error) toast.error(error.message);
    else {
      toast.success("Artikel diarsipkan.");
      await load();
    }
  };

  const reject = async (article: InformationArticle) => {
    setActingId(article.id);
    const { error } = await supabase.from("information_articles").update({ status: "rejected" }).eq("id", article.id);
    setActingId(null);
    if (error) toast.error(error.message);
    else {
      toast.success("Artikel ditolak dan tetap tersimpan dalam audit.");
      await load();
    }
  };

  const schedule = async () => {
    if (!scheduleTarget || !scheduleAt) return;
    setActingId(scheduleTarget.id);
    const { error } = await supabase.rpc("schedule_information_article", {
      p_article_id: scheduleTarget.id,
      p_scheduled_at: new Date(scheduleAt).toISOString(),
    });
    setActingId(null);
    if (error) toast.error(error.message);
    else {
      toast.success("Artikel telah dijadwalkan dan menunggu runner publikasi.");
      setScheduleTarget(null);
      setScheduleAt("");
      await load();
    }
  };

  const lastAgentRun = agentRuns[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-pub-sky/15"><Newspaper className="h-5 w-5 text-pub-sky" /></div>
          <div>
            <h1 className="text-2xl font-bold font-heading">Pusat Informasi</h1>
            <p className="text-sm text-muted-foreground">Tulis, periksa sumber, jadwalkan, dan terbitkan informasi publik.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Sinkron agen terakhir: {lastAgentRun ? formatInformationDate(lastAgentRun.started_at, true) : "belum pernah dijalankan"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2" onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Muat ulang</Button>
          <Button className="gap-2" onClick={openCreate}><Plus className="h-4 w-4" /> Tulis informasi</Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {(["published", "draft", "review", "scheduled", "archived"] as const).map((status) => (
          <button key={status} onClick={() => setStatusFilter(status)} className={`rounded-xl border bg-card p-4 text-left shadow-card transition hover:border-pub-sky ${statusFilter === status ? "ring-2 ring-pub-sky" : ""}`}>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{INFORMATION_STATUS_LABELS[status]}</p>
            <p className="mt-1 text-2xl font-bold font-heading">{articles.filter((article) => article.status === status).length}</p>
          </button>
        ))}
      </div>

      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div><CardTitle>Meja editorial</CardTitle><CardDescription>Artikel agen selalu masuk ke antrean review dan tidak dapat terbit tanpa persetujuan admin.</CardDescription></div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input aria-label="Cari artikel" value={query} onChange={(event) => setQuery(event.target.value)} className="pl-9 sm:w-64" placeholder="Cari judul atau topik" /></div>
            <Select value={channelFilter} onValueChange={setChannelFilter}><SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua kanal</SelectItem><SelectItem value="industry">Jasa Konstruksi</SelectItem><SelectItem value="pub">Kabar PUB</SelectItem></SelectContent></Select>
            <Select value={statusFilter} onValueChange={(value) => setStatusFilter(value as EditorialStatus)}><SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Semua status</SelectItem>{Object.entries(INFORMATION_STATUS_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center gap-2 py-16 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Memuat meja editorial...</div>
          ) : loadError ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive"><p className="font-semibold">Data belum dapat dimuat.</p><p className="mt-1">{loadError}</p></div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed p-12 text-center"><FileCheck2 className="mx-auto h-9 w-9 text-muted-foreground" /><p className="mt-3 font-medium">Belum ada artikel pada filter ini.</p></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader><TableRow><TableHead>Artikel</TableHead><TableHead>Kanal</TableHead><TableHead>Sumber</TableHead><TableHead>Tanggal</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
                <TableBody>
                  {filtered.map((article) => (
                    <TableRow key={article.id}>
                      <TableCell className="min-w-[260px]"><p className="font-semibold">{article.title}</p><p className="mt-1 text-xs text-muted-foreground">/{article.slug} · {article.topic}</p></TableCell>
                      <TableCell><Badge variant="outline">{article.channel === "industry" ? "Industri" : "PUB"}</Badge></TableCell>
                      <TableCell className="min-w-[160px]"><a href={article.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm hover:text-pub-sky">{article.information_sources?.name ?? article.source_title}<ExternalLink className="h-3 w-3" /></a></TableCell>
                      <TableCell className="text-xs text-muted-foreground">{formatInformationDate(article.source_published_at)}</TableCell>
                      <TableCell><Badge variant="outline" className={STATUS_STYLES[article.status]}>{INFORMATION_STATUS_LABELS[article.status]}</Badge></TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon" aria-label={`Edit ${article.title}`} onClick={() => openEdit(article)}><Pencil className="h-4 w-4" /></Button>
                          {(article.status === "draft" || article.status === "review" || article.status === "rejected") && (
                            <>
                              <Button variant="ghost" size="icon" aria-label={`Terbitkan ${article.title}`} disabled={actingId === article.id} onClick={() => void publish(article)}>{actingId === article.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}</Button>
                              <Button variant="ghost" size="icon" aria-label={`Jadwalkan ${article.title}`} onClick={() => setScheduleTarget(article)}><CalendarClock className="h-4 w-4 text-violet-600" /></Button>
                              <Button variant="ghost" size="icon" aria-label={`Tolak ${article.title}`} disabled={actingId === article.id} onClick={() => void reject(article)}><XCircle className="h-4 w-4 text-destructive" /></Button>
                            </>
                          )}
                          {(article.status === "published" || article.status === "scheduled") && <Button variant="ghost" size="icon" aria-label={`Arsipkan ${article.title}`} disabled={actingId === article.id} onClick={() => void archive(article)}><Archive className="h-4 w-4" /></Button>}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Bot className="h-5 w-5 text-pub-sky" /> Jejak tim agen</CardTitle><CardDescription>Pemantau, verifikator, editor, kurator, publikasi terjadwal, dan pemantau perubahan dicatat terpisah.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {agentRuns.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada aktivitas agen.</p> : agentRuns.slice(0, 6).map((run) => (
            <div key={run.id} className="rounded-lg border p-4"><div className="flex items-center justify-between"><p className="font-semibold capitalize">{run.agent_name.replace("_", " ")}</p><Badge variant="outline">{run.status}</Badge></div><p className="mt-2 text-xs text-muted-foreground">{formatInformationDate(run.started_at, true)} · {run.items_found} ditemukan · {run.items_created} dibuat</p>{run.error_message && <p className="mt-2 text-xs text-destructive">{run.error_message}</p>}</div>
          ))}
        </CardContent>
      </Card>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit informasi" : "Tulis informasi"}</DialogTitle></DialogHeader>
          <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr),minmax(240px,1fr)]">
            <div className="space-y-4">
              <div className="space-y-2"><Label htmlFor="info-title">Judul *</Label><Input id="info-title" value={form.title} onChange={(event) => { updateForm("title", event.target.value); if (!editing) updateForm("slug", makeInformationSlug(event.target.value)); }} /></div>
              <div className="space-y-2"><div className="flex items-center justify-between"><Label htmlFor="info-slug">Slug *</Label><Button type="button" variant="ghost" size="sm" onClick={() => updateForm("slug", makeInformationSlug(form.title))}>Buat dari judul</Button></div><Input id="info-slug" value={form.slug} onChange={(event) => updateForm("slug", makeInformationSlug(event.target.value))} /><p className="text-xs text-muted-foreground">/informasi/{form.slug || "alamat-artikel"}</p></div>
              <div className="space-y-2"><Label htmlFor="info-summary">Ringkasan *</Label><Textarea id="info-summary" rows={3} value={form.summary} onChange={(event) => updateForm("summary", event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="info-body">Isi (Markdown) *</Label><Textarea id="info-body" rows={13} value={form.body} onChange={(event) => updateForm("body", event.target.value)} placeholder={"## Apa yang berubah\\n\\nTuliskan konteks resmi.\\n\\n## Dampak bagi BUJK\\n\\nTuliskan langkah yang perlu diperhatikan."} /></div>
            </div>
            <aside className="space-y-4 rounded-xl border bg-muted/30 p-4">
              <div className="space-y-2"><Label>Kanal</Label><Select value={form.channel} onValueChange={(value) => updateForm("channel", value as "industry" | "pub")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="industry">Jasa Konstruksi</SelectItem><SelectItem value="pub">Kabar PUB</SelectItem></SelectContent></Select></div>
              <div className="space-y-2"><Label>Topik</Label><Select value={form.topic} onValueChange={(value) => updateForm("topic", value)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{INFORMATION_TOPICS.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label>Sumber terdaftar *</Label><Select value={form.source_id || undefined} onValueChange={selectSource}><SelectTrigger><SelectValue placeholder="Pilih sumber aktif" /></SelectTrigger><SelectContent>{sources.map((source) => <SelectItem key={source.id} value={source.id}>{source.name}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><Label htmlFor="info-source-title">Nama sumber *</Label><Input id="info-source-title" value={form.source_title} onChange={(event) => updateForm("source_title", event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="info-source-url">URL sumber HTTPS *</Label><Input id="info-source-url" type="url" value={form.source_url} onChange={(event) => updateForm("source_url", event.target.value)} /></div>
              <div className="space-y-2"><Label htmlFor="info-source-date">Tanggal sumber</Label><Input id="info-source-date" type="date" value={form.source_published_at} onChange={(event) => updateForm("source_published_at", event.target.value)} /></div>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.featured} onChange={(event) => updateForm("featured", event.target.checked)} /> Jadikan sorotan</label>
              <div className="space-y-2 border-t pt-4 text-xs">
                <p className={form.title && form.body ? "text-emerald-700" : "text-amber-700"}>Judul dan isi lengkap</p>
                <p className={isHttpsUrl(form.source_url) && form.source_title ? "text-emerald-700" : "text-amber-700"}>Sumber dan URL valid</p>
                <p className={form.slug ? "text-emerald-700" : "text-amber-700"}>Slug tersedia</p>
              </div>
            </aside>
          </div>
          <DialogFooter className="gap-2 sm:justify-between">
            <Button variant="outline" className="gap-2" onClick={() => setPreviewOpen(true)}><Eye className="h-4 w-4" /> Pratinjau</Button>
            <div className="flex gap-2"><Button variant="outline" onClick={() => void save("draft")} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Simpan draft</Button><Button className="gap-2" onClick={() => void save("review")} disabled={saving}><Send className="h-4 w-4" /> Kirim ke review</Button></div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
          <div className="rounded-md bg-amber-100 p-2 text-center text-xs font-bold tracking-wider text-amber-900">PRATINJAU — BELUM TERBIT</div>
          <DialogHeader><DialogTitle className="text-3xl leading-tight">{form.title || "Judul belum diisi"}</DialogTitle></DialogHeader>
          <p className="border-l-4 border-pub-sky pl-4 text-lg text-muted-foreground">{form.summary || "Ringkasan belum diisi."}</p>
          <div className="prose prose-slate max-w-none"><ReactMarkdown remarkPlugins={[remarkGfm]}>{form.body || "Isi artikel belum tersedia."}</ReactMarkdown></div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!scheduleTarget} onOpenChange={(open) => !open && setScheduleTarget(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Jadwalkan publikasi</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Persetujuan ini mengizinkan runner publikasi menerbitkan artikel pada waktu yang dipilih.</p>
          <div className="space-y-2"><Label htmlFor="schedule-at">Tanggal dan waktu</Label><Input id="schedule-at" type="datetime-local" min={new Date(Date.now() + 60000).toISOString().slice(0, 16)} value={scheduleAt} onChange={(event) => setScheduleAt(event.target.value)} /></div>
          <DialogFooter><Button variant="outline" onClick={() => setScheduleTarget(null)}>Batal</Button><Button onClick={() => void schedule()} disabled={!scheduleAt || actingId === scheduleTarget?.id}>{actingId === scheduleTarget?.id && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Setujui jadwal</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}