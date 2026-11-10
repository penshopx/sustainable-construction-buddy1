import { useEffect, useRef, useState } from "react";
import { runHermesBg001Chat, type HermesBg001ChatResult } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Access = "allowed" | "checking" | "denied";
export default function HermesBg001Chat({ access }: { access: Access }) {
  const { user } = useAuth();
  const [question, setQuestion] = useState("");
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [result, setResult] = useState<{ owner: string; data: HermesBg001ChatResult } | null>(null);
  const pending = useRef<AbortController | null>(null), epoch = useRef(0);
  const identity = useRef(user?.id); identity.current = user?.id;
  const permission = useRef(access); permission.current = access;
  const clear = () => {
    epoch.current++; pending.current?.abort(); pending.current = null;
    setResult(null); setConsent(false); setBusy(false); setError("");
  };
  useEffect(() => {
    clear(); setQuestion("");
    return () => { epoch.current++; pending.current?.abort(); pending.current = null; };
  }, [user?.id]);
  useEffect(() => { if (access === "denied") { clear(); setQuestion(""); } }, [access]);

  const send = async () => {
    const text = question.trim();
    if (!user || access !== "allowed" || !consent || pending.current || text.length < 5 || text.length > 1000) return;
    const owner = user.id, version = ++epoch.current, controller = new AbortController();
    pending.current = controller; setBusy(true); setError(""); setResult(null); setConsent(false);
    const current = () => epoch.current === version && identity.current === owner && permission.current !== "denied";
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(100_000)]);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || data.session?.user.id !== owner) throw { status: 401 };
      if (!current() || signal.aborted) return;
      const value = await runHermesBg001Chat({ consent: true, question: text }, {
        headers: { Authorization: `Bearer ${data.session.access_token}` }, signal, cache: "no-store",
      });
      const expected = [{ id: "KB09", page: 21 }, { id: "KB19", page: 17 }, { id: "KB44", page: 573 }];
      if (value.status !== "completed" || value.runtime !== "hermes" || value.provider !== "openrouter-claude" ||
          value.schemeCode !== "BG001" || value.dataScope !== "question-and-public-references" ||
          value.toolCount !== 0 || value.externalModelRequests !== 1 || value.contextVerified !== true ||
          typeof value.model !== "string" || !value.model.startsWith("anthropic/claude-") ||
          typeof value.answer !== "string" || !value.answer.trim() || value.answer.length > 10000 ||
          typeof value.insufficientEvidence !== "boolean" || !Number.isFinite(value.elapsedMs) || value.elapsedMs < 0 ||
          !Array.isArray(value.sources) || value.sources.length > 3 ||
          (!value.insufficientEvidence && value.sources.length === 0) ||
          value.sources.some(source => !expected.some(ref => ref.id === source.id && ref.page === source.page) ||
            typeof source.title !== "string" || typeof source.quote !== "string") ||
          new Set(value.sources.map(source => `${source.id}:${source.page}`)).size !== value.sources.length)
        throw new Error("Invalid Hermes chat response");
      if (current() && !signal.aborted) setResult({ owner, data: value });
    } catch (failure) {
      if (!current()) return;
      setResult(null);
      const status = (failure as { status?: number })?.status;
      setError(controller.signal.aborted ? "Permintaan dibatalkan. Tidak ada pengiriman ulang otomatis." :
        signal.aborted || status === 504 ? "Batas waktu habis. Tidak ada pengiriman ulang otomatis." :
        status === 402 ? "Provider Claude menolak dengan status 402. Periksa saldo atau batas anggaran provider." :
        status === 401 ? "Sesi berakhir. Silakan masuk kembali." :
        status === 403 ? "Akses ditutup. Pilot ini khusus Super Admin." :
        status === 429 ? "Batas tiga permintaan Hermes per jam tercapai atau ada proses lain yang berjalan." :
        status === 404 ? "Pilot ini hanya tersedia di preview." :
        "Hermes, provider Claude, atau pemeriksaan sumber belum berhasil. Tidak ada jawaban tiruan atau pengiriman ulang otomatis.");
    } finally {
      if (current()) { pending.current = null; setBusy(false); }
    }
  };
  // Keep the component mounted, but hide its contents during periodic role checks.
  // A fresh successful check may reveal its result; denial clears and aborts it.
  if (access !== "allowed") return <p className="text-sm text-muted-foreground">
    {access === "checking" ? "Memeriksa akses Super Admin…" : "Pilot Hermes BG001 khusus Super Admin."}
  </p>;
  const visible = result?.owner === user?.id ? result?.data : null;
  return <section aria-label="Chat Hermes BG001" className="space-y-4 rounded-xl border border-border bg-card p-5">
    <div>
      <h2 className="text-lg font-semibold text-foreground">Chat Hermes + Claude — BG001</h2>
      <p className="text-xs text-muted-foreground">Dikelola harness baca-saja yang sama dengan chat skema:
        persiapan referensi → satu panggilan model → pemeriksaan jawaban. Hermes adalah runtime pada jalur ini.</p>
      <p className="text-sm text-muted-foreground">Pilot preview untuk pemetaan KBLI dan ruang lingkup BG001.
        Hermes meminta satu jawaban Claude melalui OpenRouter, bukan respons tiruan.
        Rujukan terbatas: KB09 halaman PDF 21, KB19 halaman PDF 17, KB44 halaman PDF 573.</p>
    </div>
    <form className="space-y-3" onSubmit={event => { event.preventDefault(); void send(); }}>
      <label className="block space-y-1 text-sm text-foreground">
        <span>Pertanyaan BG001</span>
        <textarea data-testid="hermes-chat-question" value={question} maxLength={1000} rows={4} disabled={busy}
          placeholder="Contoh: Apa perbedaan ruang lingkup BG001 dan uraian KBLI 2025?"
          className="w-full rounded-md border border-input bg-background p-3 text-foreground"
          onChange={event => { setQuestion(event.target.value); setConsent(false); setResult(null); setError(""); }} />
      </label>
      <p className="text-xs text-muted-foreground">{question.length}/1000 karakter. Jangan masukkan data pribadi,
        kunci API, atau isi dokumen anggota. Tidak mengambil lampiran, profil, atau riwayat chat.</p>
      <label className="flex items-start gap-2 text-sm text-foreground">
        <input data-testid="hermes-chat-consent" type="checkbox" checked={consent} disabled={busy || !user}
          className="mt-1" onChange={event => setConsent(event.target.checked)} />
        <span>Saya menyetujui satu permintaan yang dapat berbiaya: mengirim pertanyaan di atas dan
          kutipan regulasi BG001 ke Claude melalui OpenRouter. Persetujuan berlaku sekali kirim.</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button data-testid="hermes-chat-send" type="submit" disabled={!user || !consent || busy || question.trim().length < 5 || question.trim().length > 1000}>
          {busy ? "Hermes meminta jawaban Claude…" : "Kirim melalui Hermes + Claude"}
        </Button>
        {busy && <Button data-testid="hermes-chat-cancel" type="button" variant="outline" onClick={() => {
          clear(); setError("Permintaan dibatalkan. Biaya provider mungkin tetap berlaku.");
        }}>Batalkan</Button>}
        {!busy && <Button data-testid="hermes-chat-clear" type="button" variant="outline" onClick={() => {
          clear(); setQuestion("");
        }}>Bersihkan</Button>}
      </div>
    </form>
    {busy && <p role="status" className="text-sm text-muted-foreground">Satu putaran agen; tanpa alat, fallback, atau percobaan ulang otomatis.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {visible && <div role="status" className="space-y-3 rounded-lg border border-border p-4 text-sm text-foreground">
      <p className="font-semibold">Draf Claude melalui Hermes — BG001</p>
      {visible.insufficientEvidence && <p className="font-medium">Bukti rujukan belum cukup untuk menjawab pertanyaan ini.</p>}
      <p className="whitespace-pre-wrap">{visible.answer}</p>
      <p className="text-xs text-muted-foreground">Model: {visible.model} · Panggilan model: 1 · Alat: 0 · {(visible.elapsedMs / 1000).toFixed(1)} detik</p>
      {visible.sources.length > 0 && <details>
        <summary className="cursor-pointer font-medium">Sumber yang dikutip ({visible.sources.length})</summary>
        <div className="mt-2 space-y-3">{visible.sources.map(source => <div key={`${source.id}:${source.page}`}>
          <p>{source.id} · Halaman PDF {source.page} · {source.title}</p>
          <pre className="max-h-60 overflow-auto whitespace-pre-wrap font-sans text-xs text-muted-foreground">{source.quote}</pre>
        </div>)}</div>
      </details>}
      <p className="text-xs text-muted-foreground">ID sumber dan halaman diperiksa, bukan kebenaran seluruh kesimpulan AI.
        Tinjau kutipan; ini bukan keputusan sertifikasi.</p>
    </div>}
    <p className="text-xs text-muted-foreground">Jawaban hanya di sesi halaman ini, tidak disimpan ke riwayat.
      Gabungan uji lokal dan chat Hermes: tiga percobaan per operator per jam, satu proses bersamaan.
      Jika provider sudah menerima permintaan, biaya mungkin tetap berlaku meski proses gagal atau dibatalkan.</p>
  </section>;
}
