import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetVaultWorkspace,
  getGetVaultWorkspaceQueryKey,
  useCreateVaultAssistant,
  useDeleteVaultAssistant,
  useAskVaultQuestion,
  useGetVaultAiStatus,
  getGetVaultAiStatusQueryKey,
  type VaultSource,
} from '@workspace/api-client-react';
import { Bot, Plus, Trash2, Send, ShieldAlert, Loader2, Quote } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, LoadError, PageSkeleton } from '@/components/app-shell';
import { errorMessage } from '@/lib/vault';
import { cn } from '@/lib/utils';
import { usePubAuth } from '@/lib/pub-auth';

type Msg = { role: 'user' | 'assistant'; content: string; sources?: VaultSource[]; error?: boolean };

export default function AssistantsPage() {
  const qc = useQueryClient();
  const { session } = usePubAuth();
  const { toast } = useToast();
  const ws = useGetVaultWorkspace();
  const aiStatus = useGetVaultAiStatus(undefined, {
    query: { queryKey: [...getGetVaultAiStatusQueryKey(), session?.user.id], enabled: !!session && !!ws.data, staleTime: 0, gcTime: 0, refetchInterval: 30_000, retry: false },
  });
  const [quotaNow, setQuotaNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => setQuotaNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const invalidate = () => qc.invalidateQueries({ queryKey: getGetVaultWorkspaceQueryKey() });
  const create = useCreateVaultAssistant();
  const remove = useDeleteVaultAssistant();
  const ask = useAskVaultQuestion();

  const [selected, setSelected] = useState<string>('general');
  const [threads, setThreads] = useState<Record<string, Msg[]>>({});
  const [question, setQuestion] = useState('');
  const [consent, setConsent] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', instructions: '', documentIds: [] as string[] });
  const [toDelete, setToDelete] = useState<{ id: string; name: string } | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const msgs = threads[selected] ?? [];
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [msgs.length]);

  if (ws.isLoading) return <PageSkeleton />;
  if (ws.isError || !ws.data) return <LoadError onRetry={() => ws.refetch()} />;
  const { assistants, documents } = ws.data;
  const readyDocs = documents.filter((d) => d.status === 'ready');
  const current = assistants.find((a) => a.id === selected);
  const docName = (id: string) => documents.find((d) => d.id === id)?.name ?? 'Dokumen terhapus';

  function send(e: React.FormEvent) {
    e.preventDefault();
    const q = question.trim();
    if (q.length < 3 || !consent) return;
    const key = selected;
    setThreads((t) => ({ ...t, [key]: [...(t[key] ?? []), { role: 'user', content: q }] }));
    setQuestion('');
    ask.mutate(
      { data: { question: q, consent: true, ...(current ? { assistantId: current.id } : {}) } },
      {
        onSuccess: (ans) => setThreads((t) => ({ ...t, [key]: [...(t[key] ?? []), { role: 'assistant', content: ans.answer, sources: ans.sources }] })),
        onError: (err) => setThreads((t) => ({ ...t, [key]: [...(t[key] ?? []), { role: 'assistant', content: errorMessage(err, 'Pertanyaan tidak dapat diproses saat ini.'), error: true }] })),
        onSettled: () => { void aiStatus.refetch(); },
      },
    );
  }

  const list = [{ id: 'general', name: 'Semua dokumen', instructions: 'Menjawab dari seluruh dokumen berstatus Siap AI.', documentIds: [] as string[] }, ...assistants];

  return (
    <div>
      <PageHeader kicker="Ruang Simpan / Asisten AI" title="Tanya dokumen Anda sendiri.">
        <Button onClick={() => setCreateOpen(true)} data-testid="button-new-assistant"><Plus className="h-4 w-4 mr-2" />Buat asisten</Button>
      </PageHeader>

      <div className="grid lg:grid-cols-[300px_1fr] gap-5">
        <aside className="space-y-2">
          {list.map((a) => (
            <div key={a.id} className={cn('rounded-xl border p-3 transition-colors', selected === a.id ? 'bg-ice border-transparent' : 'border-border bg-card hover:border-primary/50')}>
              <div className="flex items-start gap-2">
                <button type="button" className="flex-1 text-left min-w-0" onClick={() => setSelected(a.id)} data-testid={`button-assistant-${a.id}`}>
                  <p className="font-bold truncate flex items-center gap-2"><Bot className="h-4 w-4 shrink-0" />{a.name}</p>
                  <p className={cn('text-xs mt-1 line-clamp-2', selected === a.id ? 'opacity-75' : 'text-muted-foreground')}>
                    {a.documentIds.length ? `${a.documentIds.length} dokumen terpilih` : 'Semua dokumen Siap AI'}
                  </p>
                </button>
                {a.id !== 'general' && (
                  <button type="button" aria-label="Hapus asisten" data-testid={`button-delete-assistant-${a.id}`} onClick={() => setToDelete({ id: a.id, name: a.name })} className="rounded-md p-1.5 opacity-70 hover:opacity-100 hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {assistants.length === 0 && <p className="text-sm text-muted-foreground px-1 pt-2">Belum ada asisten khusus. Buat satu untuk membatasi jawaban pada dokumen tertentu, misalnya hanya dokumen tender.</p>}
        </aside>

        <section className="rounded-2xl border border-border bg-card flex flex-col min-h-[560px]">
          <header className="border-b border-border p-4">
            <p className="font-bold text-lg">{current?.name ?? 'Semua dokumen'}</p>
            {current?.instructions && <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{current.instructions}</p>}
            {current && current.documentIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">{current.documentIds.slice(0, 6).map((id) => <span key={id} className="text-xs rounded-full bg-secondary px-2 py-0.5 truncate max-w-[220px]">{docName(id)}</span>)}</div>
            )}
          </header>

          <div className="flex-1 overflow-y-auto p-4 space-y-4 max-h-[60dvh]">
            {readyDocs.length === 0 && (
              <div className="rounded-xl bg-amber-400/10 border border-amber-400/30 p-4 text-sm" data-testid="text-no-ready">
                Belum ada dokumen berstatus <b>Siap AI</b>. Unggah PDF, DOCX, XLSX, TXT, MD, atau CSV yang berisi teks agar asisten punya bahan untuk menjawab.
              </div>
            )}
            {msgs.length === 0 ? (
              <div className="h-full grid place-items-center text-center py-10">
                <div className="max-w-sm">
                  <Bot className="h-10 w-10 mx-auto text-primary" />
                  <p className="mt-3 font-bold text-lg">Ajukan pertanyaan pertama.</p>
                  <p className="text-sm text-muted-foreground mt-1">Contoh: “Kapan masa berlaku SBU kami berakhir?” Jawaban disertai kutipan sumber dari dokumen Anda.</p>
                </div>
              </div>
            ) : (
              msgs.map((m, i) => (
                <div key={i} className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')} data-testid={`msg-${m.role}-${i}`}>
                  <div className={cn('max-w-[85%] rounded-2xl px-4 py-3', m.role === 'user' ? 'bg-ice' : m.error ? 'bg-destructive/15 border border-destructive/40' : 'bg-secondary')}>
                    <p className="whitespace-pre-wrap leading-relaxed">{m.content}</p>
                    {m.sources && m.sources.length > 0 && (
                      <div className="mt-3 space-y-2 border-t border-border pt-3">
                        <p className="text-xs font-mono-ui uppercase tracking-widest text-muted-foreground">Sumber konteks yang dikirim ke AI</p>
                        {m.sources.map((s, j) => (
                          <div key={j} className="text-sm rounded-lg bg-background/60 p-2.5">
                            <p className="font-semibold flex items-center gap-1.5"><Quote className="h-3.5 w-3.5 text-primary" />{s.name}</p>
                            <p className="text-foreground/80 mt-1 text-xs leading-relaxed">{s.quote}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
            {ask.isPending && <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Membaca dokumen…</div>}
            <div ref={endRef} />
          </div>

          <form onSubmit={send} className="border-t border-border p-4 space-y-3">
            <div role="status" aria-live="polite" data-testid="ai-readiness" className="rounded-lg border border-border bg-muted/40 p-3 text-sm text-foreground">
              <p className="font-medium">Status layanan AI: {aiStatus.isPending ? "memeriksa…" : aiStatus.isError ? "belum dapat diperiksa" : aiStatus.data?.state === "configured" ? "konfigurasi tersedia" : aiStatus.data?.state === "limit_indicated" ? "batas penggunaan terindikasi" : aiStatus.data?.state === "not_configured" ? "belum dikonfigurasi" : "belum dapat diperiksa"}</p>
              <p>{aiStatus.isError ? "Status AI tidak dapat diperiksa. Pengiriman tetap dapat dicoba, tetapi jawaban belum terjamin." : aiStatus.data?.message ?? "Pemeriksaan hanya membaca metadata layanan, tanpa mengirim percakapan atau dokumen."}</p>
              <div className="mt-2" data-testid="ai-local-quota">
                <p className="font-medium">Kuota aplikasi akun Anda</p>
                {!aiStatus.isError && session && aiStatus.data?.localQuota ? aiStatus.data.localQuota.map(quota => {
                  const seconds = quota.retryAfterSeconds > 0 && quota.resetAt ? Math.max(0, Math.ceil((new Date(quota.resetAt).getTime() - quotaNow) / 1000)) : 0;
                  return <p key={quota.scope}>Pertanyaan dokumen: sisa {quota.remaining}/{quota.limit} dalam satu menit berjalan.
                    {quota.retryAfterSeconds > 0 && (seconds > 0 ? ` Kuota habis. Tunggu ${seconds} detik (hingga ${new Date(quota.resetAt!).toLocaleTimeString('id-ID')}).` : " Waktu tunggu selesai; periksa ulang kuota.")}</p>;
                }) : <p>Kuota pribadi belum dapat diperiksa.</p>}
                <p className="mt-1 text-xs">Batas lokal aplikasi, bukan saldo provider. Status dapat berubah; server tetap memeriksa setiap pengiriman. Model dan panjang jawaban tidak diubah otomatis.</p>
              </div>
              {aiStatus.data && !aiStatus.isError && <p className="mt-1 text-xs">Diperiksa: {new Date(aiStatus.data.checkedAt).toLocaleTimeString('id-ID')}. Status diperbarui berkala.</p>}
              <button type="button" className="mt-1 underline" disabled={aiStatus.isFetching} onClick={() => void aiStatus.refetch()}>Periksa lagi</button>
            </div>
            <label className="flex items-start gap-3 rounded-lg bg-primary/10 border border-primary/30 p-3 text-sm cursor-pointer">
              <Checkbox checked={consent} onCheckedChange={(v) => setConsent(v === true)} className="mt-0.5" data-testid="checkbox-consent" />
              <span><ShieldAlert className="inline h-4 w-4 mr-1 text-primary" /><b>Saya setuju</b> potongan teks dokumen yang relevan dikirim ke layanan AI eksternal untuk menyusun jawaban. File utuh tidak dikirim.</span>
            </label>
            <div className="flex gap-2">
              <Textarea value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={2000} rows={2} placeholder={consent ? 'Tulis pertanyaan tentang dokumen Anda…' : 'Centang persetujuan di atas untuk mulai bertanya'} className="resize-none"
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.currentTarget.form as HTMLFormElement).requestSubmit(); } }} data-testid="input-question" />
              <Button type="submit" className="h-auto px-4" disabled={!consent || question.trim().length < 3 || ask.isPending} data-testid="button-send"><Send className="h-4 w-4" /></Button>
            </div>
          </form>
        </section>
      </div>

      <Dialog open={createOpen} onOpenChange={(o) => { setCreateOpen(o); if (!o) setForm({ name: '', instructions: '', documentIds: [] }); }}>
        <DialogContent className="max-w-xl max-h-[90dvh] overflow-y-auto">
          <DialogHeader><DialogTitle>Buat asisten AI</DialogTitle><DialogDescription>Tidak memilih dokumen berarti asisten memakai semua dokumen berstatus Siap AI.</DialogDescription></DialogHeader>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            if (!form.name.trim()) return;
            create.mutate({ data: { name: form.name.trim(), instructions: form.instructions.trim(), documentIds: form.documentIds } }, {
              onSuccess: (a) => { invalidate(); setCreateOpen(false); setForm({ name: '', instructions: '', documentIds: [] }); setSelected(a.id); toast({ title: `Asisten “${a.name}” siap` }); },
              onError: (err) => toast({ title: 'Gagal membuat asisten', description: errorMessage(err), variant: 'destructive' }),
            });
          }}>
            <div><label className="text-sm font-semibold">Nama</label><Input className="mt-1" maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Contoh: Asisten Tender" data-testid="input-assistant-name" /></div>
            <div><label className="text-sm font-semibold">Instruksi</label><Textarea className="mt-1" maxLength={2000} rows={3} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Contoh: Jawab ringkas, sebutkan nomor dokumen bila ada." data-testid="input-assistant-instructions" /></div>
            <div>
              <p className="text-sm font-semibold">Dokumen sumber <span className="text-muted-foreground font-normal">({form.documentIds.length || 'semua'})</span></p>
              <div className="mt-2 max-h-56 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {readyDocs.length === 0 ? <p className="p-3 text-sm text-muted-foreground">Belum ada dokumen Siap AI.</p> : readyDocs.map((d) => (
                  <label key={d.id} className="flex items-center gap-3 p-2.5 text-sm cursor-pointer hover:bg-accent/40">
                    <Checkbox checked={form.documentIds.includes(d.id)} data-testid={`checkbox-assistant-doc-${d.id}`} onCheckedChange={(v) => setForm((f) => ({ ...f, documentIds: v === true ? [...f.documentIds, d.id] : f.documentIds.filter((x) => x !== d.id) }))} />
                    <span className="truncate">{d.name}</span>
                  </label>
                ))}
              </div>
            </div>
            <DialogFooter><Button type="submit" disabled={!form.name.trim() || create.isPending} data-testid="button-save-assistant">Simpan asisten</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Hapus asisten “{toDelete?.name}”?</AlertDialogTitle><AlertDialogDescription>Dokumen Anda tidak ikut terhapus. Riwayat obrolan di layar ini akan hilang.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" data-testid="button-confirm-delete-assistant" onClick={() => toDelete && remove.mutate({ id: toDelete.id }, {
              onSuccess: () => { invalidate(); if (selected === toDelete.id) setSelected('general'); toast({ title: 'Asisten dihapus' }); },
              onError: (err) => toast({ title: 'Gagal menghapus', description: errorMessage(err), variant: 'destructive' }),
            })}>Hapus</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
