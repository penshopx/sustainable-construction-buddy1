import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useCreateClinicCase, useMyClinicCases, clinicErrorMessage } from "@/hooks/useClinicCases";
import { CaseStatusBadge, formatClinicDate } from "./clinicUi";
import ClinicCaseHistory from "./ClinicCaseHistory";

export default function ClinicFeedbackForm() {
  const { user } = useAuth();
  const create = useCreateClinicCase();
  const cases = useMyClinicCases();
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null);

  if (!user) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6">
        <p className="text-sm text-muted-foreground">Masukan dikirim atas nama akun PUB agar dapat ditindaklanjuti. Silakan masuk terlebih dahulu.</p>
        <Button asChild className="mt-4" data-testid="link-feedback-login">
          <Link to="/auth?next=/klinik-konsultasi">Masuk untuk memberi masukan</Link>
        </Button>
      </div>
    );
  }

  const valid = subject.trim().length >= 3 && subject.trim().length <= 180 && description.trim().length >= 10 && description.trim().length <= 4000;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || create.isPending) return;
    setResult(null);
    create.mutate(
      { topicId: "pub-lkut", kind: "feedback", subject: subject.trim(), description: description.trim(), ...(rating ? { rating } : {}) },
      {
        onSuccess: () => { setResult({ ok: true, text: "Masukan tersimpan dan dapat dibaca operator PUB." }); setSubject(""); setDescription(""); setRating(null); },
        onError: err => setResult({ ok: false, text: clinicErrorMessage(err, "Masukan belum terkirim. Silakan coba lagi.") }),
      },
    );
  };

  return (
    <div className="space-y-4">
    <form onSubmit={submit} className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="space-y-1.5">
        <label htmlFor="fb-subject" className="text-sm font-medium">Judul masukan</label>
        <Input id="fb-subject" data-testid="input-feedback-subject" value={subject} maxLength={180} onChange={e => setSubject(e.target.value)} placeholder="Misal: Loket SKK perlu contoh portofolio" />
      </div>
      <div className="space-y-1.5">
        <label htmlFor="fb-desc" className="text-sm font-medium">Isi masukan</label>
        <Textarea id="fb-desc" data-testid="input-feedback-description" value={description} maxLength={4000} rows={4} onChange={e => setDescription(e.target.value)} placeholder="Ceritakan apa yang membantu atau apa yang perlu diperbaiki." />
        <p className="text-xs text-muted-foreground">{description.trim().length}/4000, minimal 10 karakter.</p>
      </div>
      <fieldset>
        <legend className="text-sm font-medium">Penilaian (opsional)</legend>
        <div className="mt-2 flex gap-1" role="radiogroup">
          {[1, 2, 3, 4, 5].map(n => (
            <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} dari 5`} data-testid={`button-rating-${n}`}
              onClick={() => setRating(rating === n ? null : n)}
              className="rounded-md p-1.5 transition-colors hover:bg-pub-amber/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Star className={`h-5 w-5 ${rating && n <= rating ? "fill-pub-amber text-pub-amber" : "text-muted-foreground"}`} />
            </button>
          ))}
        </div>
      </fieldset>
      {result && (
        <p role={result.ok ? "status" : "alert"} data-testid="text-feedback-result" className={`rounded-lg border px-3 py-2 text-sm ${result.ok ? "border-pub-emerald/30 bg-pub-emerald/10 text-pub-emerald" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
          {result.text}
        </p>
      )}
      <Button type="submit" disabled={!valid || create.isPending} data-testid="button-submit-feedback">
        {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Kirim masukan
      </Button>
    </form>
    <section className="rounded-2xl border border-border bg-card p-6" aria-label="Masukan saya">
      <h3 className="font-heading font-semibold">Masukan saya</h3>
      <p className="mt-1 text-xs text-muted-foreground">Lima masukan terbaru dan balasan operator untuk akun Anda.</p>
      {cases.isLoading ? <p className="mt-3 text-sm text-muted-foreground">Memuat masukan...</p>
        : cases.isError ? <div role="alert" className="mt-3 text-sm text-destructive">
          <p>{clinicErrorMessage(cases.error, "Masukan belum dapat dimuat.")}</p>
          <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => void cases.refetch()}>Coba lagi</Button>
        </div>
        : <>
          {(cases.data ?? []).filter(c => c.kind === "feedback").slice(0, 5).map(c => (
            <article key={c.id} className="mt-3 space-y-2 rounded-lg border border-border p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="break-words text-sm font-semibold">{c.subject}</p><CaseStatusBadge status={c.status} />
              </div>
              <p className="text-xs text-muted-foreground">{formatClinicDate(c.createdAt)}{c.rating ? ` · ${c.rating}/5` : ""}</p>
              {c.operatorReply && <p className="whitespace-pre-wrap break-words text-sm"><span className="font-semibold">Balasan operator: </span>{c.operatorReply}</p>}
              <ClinicCaseHistory caseId={c.id} />
            </article>
          ))}
          {!(cases.data ?? []).some(c => c.kind === "feedback") && <p className="mt-3 text-sm text-muted-foreground">Belum ada masukan dari akun ini.</p>}
        </>}
    </section>
    </div>
  );
}
