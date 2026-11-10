import { useState } from "react";
import { Inbox, Loader2, RefreshCw, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { ClinicTopic } from "@/lib/clinicCatalog";
import { useCreateClinicCase, useMyClinicCases, clinicErrorMessage } from "@/hooks/useClinicCases";
import { CaseStatusBadge, formatClinicDate } from "./clinicUi";
import ClinicCaseHistory from "./ClinicCaseHistory";

export default function ClinicOperatorRequest({ topic, lastQuestion }: { topic: ClinicTopic; lastQuestion?: string }) {
  const cases = useMyClinicCases();
  const create = useCreateClinicCase();
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  const mine = (cases.data ?? []).filter(c => c.topicId === topic.id && c.kind === "consultation");
  const valid = subject.trim().length >= 3 && subject.trim().length <= 180 && description.trim().length >= 10 && description.trim().length <= 4000;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || create.isPending) return;
    setResult(null);
    create.mutate({ topicId: topic.id, kind: "consultation", subject: subject.trim(), description: description.trim() }, {
      onSuccess: () => { setResult({ ok: true, text: "Permintaan tersimpan. Status dan balasan operator tampil di bawah." }); setSubject(""); setDescription(""); setOpen(false); },
      onError: err => setResult({ ok: false, text: clinicErrorMessage(err, "Permintaan belum terkirim. Silakan coba lagi.") }),
    });
  };

  return (
    <section aria-labelledby="op-title" className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between gap-2 border-b border-border p-3">
        <h2 id="op-title" className="flex items-center gap-2 text-sm font-semibold"><Inbox className="h-4 w-4 text-pub-amber" /> Minta bantuan operator</h2>
        <Button size="icon" variant="ghost" className="h-7 w-7" aria-label="Muat ulang permintaan" data-testid="button-refresh-cases" onClick={() => cases.refetch()}>
          <RefreshCw className={`h-3.5 w-3.5 ${cases.isFetching ? "animate-spin" : ""}`} />
        </Button>
      </div>
      <div className="space-y-3 p-3">
        {!open ? (
          <>
            <p className="text-xs text-muted-foreground">Hanya ringkasan yang Anda tulis yang dikirim ke admin PUB. Transkrip chat dan berkas tidak ikut terkirim. Belum ada jaminan waktu tanggapan.</p>
            <Button variant="outline" size="sm" className="w-full" data-testid="button-open-operator-request" onClick={() => setOpen(true)}>Tulis permintaan</Button>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-2">
            <label htmlFor="op-subject" className="text-xs font-medium">Judul</label>
            <Input id="op-subject" data-testid="input-case-subject" value={subject} maxLength={180} onChange={e => setSubject(e.target.value)} placeholder={`Pertanyaan ${topic.short}`} />
            <div className="flex items-center justify-between">
              <label htmlFor="op-desc" className="text-xs font-medium">Ringkasan untuk operator</label>
              {lastQuestion && (
                <button type="button" className="text-xs text-primary underline" data-testid="button-copy-last-question" onClick={() => setDescription(lastQuestion.slice(0, 4000))}>Salin pertanyaan terakhir</button>
              )}
            </div>
            <Textarea id="op-desc" data-testid="input-case-description" rows={5} value={description} maxLength={4000} onChange={e => setDescription(e.target.value)} placeholder="Jelaskan kebutuhan Anda. Jangan sertakan kata sandi atau data sensitif." />
            <p className="text-[11px] text-muted-foreground">{description.trim().length}/4000, minimal 10 karakter.</p>
            <div className="flex gap-2">
              <Button type="submit" size="sm" disabled={!valid || create.isPending} data-testid="button-submit-case">
                {create.isPending ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1 h-3.5 w-3.5" />} Kirim ke admin PUB
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>Batal</Button>
            </div>
          </form>
        )}
        {result && (
          <p role={result.ok ? "status" : "alert"} className={`rounded-md border px-2 py-1.5 text-xs ${result.ok ? "border-pub-emerald/30 bg-pub-emerald/10 text-pub-emerald" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>{result.text}</p>
        )}

        <div className="border-t border-border pt-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Permintaan di loket ini</p>
          {cases.isLoading ? (
            <div className="space-y-2">{[0, 1].map(i => <div key={i} className="h-12 animate-pulse rounded-md bg-muted" />)}</div>
          ) : cases.isError ? (
            <div role="alert" className="space-y-2 text-xs text-destructive">
              <p>{clinicErrorMessage(cases.error, "Daftar permintaan belum dapat dimuat.")}</p>
              <Button size="sm" variant="outline" onClick={() => cases.refetch()}>Coba lagi</Button>
            </div>
          ) : mine.length === 0 ? (
            <p className="text-xs text-muted-foreground">Belum ada permintaan.</p>
          ) : (
            <ul className="space-y-2">
              {mine.map(c => (
                <li key={c.id} data-testid={`card-case-${c.id}`} className="rounded-md border border-border p-2">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium break-words">{c.subject}</p>
                    <CaseStatusBadge status={c.status} />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{formatClinicDate(c.updatedAt)}</p>
                  {c.operatorReply && (
                    <div className="mt-2 rounded border-l-2 border-pub-emerald bg-pub-emerald/5 px-2 py-1.5">
                      <p className="text-[11px] font-semibold text-pub-emerald">Balasan operator</p>
                      <p className="whitespace-pre-wrap text-xs">{c.operatorReply}</p>
                    </div>
                  )}
                  <ClinicCaseHistory caseId={c.id} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
