import { useEffect, useMemo, useState } from "react";
import { Inbox, Loader2, RefreshCw, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useOperatorClinicCases, useUpdateClinicCase, useClinicCaseHistory, clinicErrorMessage, clinicErrorStatus, type ClinicCase } from "@/hooks/useClinicCases";
import ClinicCaseHistory from "@/components/clinic/ClinicCaseHistory";
import { clinicEditorInitial, receiveClinicVersion, rebaseClinicDraft } from "@/lib/clinicEditorState";
import { getClinicTopic } from "@/lib/clinicCatalog";
import { CaseStatusBadge, CASE_STATUS_LABEL, formatClinicDate, usePageMeta } from "@/components/clinic/clinicUi";

type StatusFilter = "all" | ClinicCase["status"];
type KindFilter = "all" | ClinicCase["kind"];
const STATUSES = Object.keys(CASE_STATUS_LABEL) as ClinicCase["status"][];

export default function AdminClinic() {
  usePageMeta("Antrean Klinik Konsultasi | Admin PUB ASPEKINDO", "Antrean permintaan dan masukan Klinik Konsultasi untuk operator PUB.");
  const cases = useOperatorClinicCases();
  const [status, setStatus] = useState<StatusFilter>("all");
  const [kind, setKind] = useState<KindFilter>("all");
  const [selectedId, setSelectedId] = useState<ClinicCase["id"] | null>(null);

  const list = useMemo(() => (cases.data ?? []).filter(c => (status === "all" || c.status === status) && (kind === "all" || c.kind === kind)), [cases.data, status, kind]);
  const selected = (cases.data ?? []).find(c => c.id === selectedId) ?? null;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-pub-amber/10"><Inbox className="h-5 w-5 text-pub-amber" /></div>
          <div>
            <h1 className="font-heading text-2xl font-bold">Antrean Klinik Konsultasi</h1>
            <p className="text-sm text-muted-foreground">Permintaan operator dan masukan anggota. Hanya ringkasan yang ditulis anggota yang tampil di sini.</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => cases.refetch()} data-testid="button-refresh-queue">
          <RefreshCw className={`mr-1 h-4 w-4 ${cases.isFetching ? "animate-spin" : ""}`} /> Muat ulang
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <label className="text-sm">Status{" "}
          <select data-testid="select-filter-status" value={status} onChange={e => setStatus(e.target.value as StatusFilter)} className="ml-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm">
            <option value="all">Semua</option>
            {STATUSES.map(s => <option key={s} value={s}>{CASE_STATUS_LABEL[s]}</option>)}
          </select>
        </label>
        <label className="text-sm">Jenis{" "}
          <select data-testid="select-filter-kind" value={kind} onChange={e => setKind(e.target.value as KindFilter)} className="ml-1 rounded-md border border-input bg-background px-2 py-1.5 text-sm">
            <option value="all">Semua</option>
            <option value="consultation">Konsultasi</option>
            <option value="feedback">Masukan</option>
          </select>
        </label>
      </div>

      {cases.isLoading ? (
        <div className="space-y-2">{[0, 1, 2, 3].map(i => <div key={i} className="h-16 animate-pulse rounded-lg bg-muted" />)}</div>
      ) : cases.isError && !cases.data ? (
        <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-sm text-destructive">
          <p>{clinicErrorMessage(cases.error, "Antrean belum dapat dimuat.")}</p>
          <Button size="sm" variant="outline" className="mt-3" onClick={() => cases.refetch()}>Coba lagi</Button>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <ul className="space-y-2" aria-label="Daftar kasus">
            {list.length === 0 && <li className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Tidak ada kasus untuk filter ini.</li>}
            {list.map(c => (
              <li key={c.id}>
                <button type="button" onClick={() => setSelectedId(c.id)} data-testid={`button-case-${c.id}`}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedId === c.id ? "border-pub-amber bg-pub-amber/5" : "border-border bg-card hover:bg-accent/40"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-medium break-words">{c.subject}</span>
                    <CaseStatusBadge status={c.status} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{c.kind === "feedback" ? "Masukan" : "Konsultasi"} · {getClinicTopic(c.topicId)?.name ?? c.topicId} · {formatClinicDate(c.createdAt)}</p>
                </button>
              </li>
            ))}
          </ul>
          {selected ? <CaseEditor key={selected.id} item={selected} /> : (
            <div className="hidden items-center justify-center rounded-xl border border-dashed border-border p-10 text-sm text-muted-foreground lg:flex">Pilih kasus untuk melihat detail.</div>
          )}
        </div>
      )}
    </div>
  );
}

export function CaseEditor({ item }: { item: ClinicCase }) {
  const update = useUpdateClinicCase();
  const latest = useClinicCaseHistory(item.id, false);
  const [draft, setDraft] = useState(() => clinicEditorInitial(item));
  const { status, reply } = draft;
  const [conflict, setConflict] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);
  useEffect(() => { setDraft(current => receiveClinicVersion(current, item)); }, [item]);
  const invalid = status === "answered" && !reply.trim();

  const reloadLatest = async () => {
    const response = await latest.refetch();
    const version = response.data?.at(-1);
    if (response.isError || !version) {
      setResult({ ok: false, text: clinicErrorMessage(response.error, "Versi terbaru belum dapat dimuat. Draf tetap utuh; coba lagi.") });
      return;
    }
    setDraft(current => rebaseClinicDraft(current, version));
    setLoaded(true);
    setConflict(false);
    setResult({ ok: true, text: "Versi terbaru dimuat. Draf Anda tetap utuh. Bandingkan dengan versi tersimpan sebelum menyimpan lagi." });
  };

  const save = () => {
    if (invalid || update.isPending || conflict) return;
    setResult(null);
    update.mutate({ id: item.id, data: { status, operatorReply: reply.trim(), expectedRevision: draft.base.revision } }, {
      onSuccess: saved => {
        setDraft(clinicEditorInitial(saved));
        setLoaded(false);
        setResult({ ok: true, text: "Tersimpan." });
      },
      onError: err => {
        setConflict(clinicErrorStatus(err) === 409);
        setResult({ ok: false, text: clinicErrorMessage(err, "Perubahan belum tersimpan.") });
      },
    });
  };

  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5" aria-label="Detail kasus">
      <div>
        <p className="text-xs uppercase tracking-wider text-muted-foreground">{item.kind === "feedback" ? "Masukan" : "Konsultasi"} · {getClinicTopic(item.topicId)?.name ?? item.topicId}</p>
        <h2 className="mt-1 font-heading text-lg font-semibold break-words">{item.subject}</h2>
        <p className="text-xs text-muted-foreground">Dibuat {formatClinicDate(item.createdAt)} · diperbarui {formatClinicDate(item.updatedAt)}</p>
        {item.rating != null && (
          <p className="mt-1 flex items-center gap-1 text-sm"><Star className="h-4 w-4 fill-pub-amber text-pub-amber" /> {item.rating}/5</p>
        )}
      </div>
      <p className="whitespace-pre-wrap rounded-lg bg-muted/40 p-3 text-sm">{item.description}</p>
      <label className="block text-sm font-medium">Status
        <select disabled={update.isPending} data-testid="select-case-status" value={status} onChange={e => setDraft(current => ({ ...current, status: e.target.value as ClinicCase["status"] }))} className="mt-1 block w-full rounded-md border border-input bg-background px-2 py-2 text-sm">
          {STATUSES.map(s => <option key={s} value={s}>{CASE_STATUS_LABEL[s]}</option>)}
        </select>
      </label>
      <div>
        <label htmlFor="op-reply" className="text-sm font-medium">Balasan operator</label>
        <Textarea disabled={update.isPending} id="op-reply" data-testid="input-operator-reply" rows={6} maxLength={6000} value={reply} onChange={e => setDraft(current => ({ ...current, reply: e.target.value }))} className="mt-1" />
        <p className="text-xs text-muted-foreground">{reply.length}/6000{invalid ? " · status Dijawab memerlukan balasan." : ""}</p>
      </div>
      {result && <p role={result.ok ? "status" : "alert"} className={`text-sm ${result.ok ? "text-pub-emerald" : "text-destructive"}`}>{result.text}</p>}
      {conflict && <Button variant="outline" disabled={latest.isFetching} onClick={reloadLatest} data-testid="button-load-latest-case">Muat versi terbaru tanpa menghapus draf</Button>}
      {loaded && <div className="rounded border border-border p-3 text-sm" data-testid="latest-case-version">
        <p className="font-semibold">Versi tersimpan · revisi {draft.base.revision} · {CASE_STATUS_LABEL[draft.base.status]}</p>
        <p className="whitespace-pre-wrap break-words">{draft.base.operatorReply || "Belum ada balasan."}</p>
      </div>}
      <Button onClick={save} disabled={invalid || update.isPending || conflict} data-testid="button-save-case">
        {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan
      </Button>
      <ClinicCaseHistory caseId={item.id} />
    </section>
  );
}
