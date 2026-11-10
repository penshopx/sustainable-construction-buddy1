import { useEffect, useRef, useState } from "react";
import { runHermesLocalCheck, runHermesBg001Check, type HermesLocalCheckResult, type HermesSchemeLocalCheckResult } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export default function HermesLocalCheck() {
  const { user } = useAuth();
  const [mode, setMode] = useState<"runtime" | "bg001">("runtime");
  const [consent, setConsent] = useState(false), [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ owner: string; data: HermesLocalCheckResult | HermesSchemeLocalCheckResult } | null>(null);
  const identity = useRef(user?.id); identity.current = user?.id;
  const pending = useRef<AbortController | null>(null), epoch = useRef(0);
  useEffect(() => {
    setResult(null); setError(""); setBusy(false); setConsent(false); setMode("runtime");
    return () => { epoch.current++; pending.current?.abort(); pending.current = null; };
  }, [user?.id]);

  const run = async () => {
    if (!user || !consent || pending.current) return;
    const owner = user.id, version = ++epoch.current, controller = new AbortController();
    pending.current = controller; setBusy(true); setError(""); setResult(null);
    const current = () => epoch.current === version && identity.current === owner;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(100_000)]);
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || data.session?.user.id !== owner) throw { status: 401 };
      if (!current() || signal.aborted) return;
      const options = { headers: { Authorization: `Bearer ${data.session.access_token}` }, signal, cache: "no-store" as const };
      const value = mode === "bg001" ? await runHermesBg001Check({ consent: true }, options)
        : await runHermesLocalCheck({ consent: true }, options);
      if (value.status !== "completed" || value.runtime !== "hermes" || value.provider !== "local-mock" ||
          value.toolCount !== 0 ||
          value.localProviderRequests !== 1 || value.externalModelRequests !== 0 ||
          !Number.isFinite(value.elapsedMs) || value.elapsedMs < 0 ||
          typeof value.fixtureReply !== "string") throw new Error("Invalid local runtime result");
      if ("schemeCode" in value) {
        const expected = [{ id: "KB09", page: 21 }, { id: "KB19", page: 17 }, { id: "KB44", page: 573 }];
        if (mode !== "bg001" || value.schemeCode !== "BG001" || value.dataScope !== "uploaded-reference-only" ||
            value.documentCount !== 3 || value.contextVerified !== true || value.citationsVerified !== true ||
            typeof value.question !== "string" || !Array.isArray(value.sources) || value.sources.length !== 3 ||
            expected.some(ref => !value.sources.some(source => source.id === ref.id && source.page === ref.page)) ||
            value.sources.some(source => typeof source.quote !== "string" || typeof source.title !== "string"))
          throw new Error("Invalid BG001 evidence");
      } else if (mode !== "runtime" || value.dataScope !== "synthetic-only" || value.documentCount !== 1)
        throw new Error("Invalid synthetic runtime result");
      if (current() && !signal.aborted) setResult({ owner, data: value });
    } catch (failure) {
      if (!current()) return;
      setResult(null);
      const status = (failure as { status?: number })?.status;
      setError(controller.signal.aborted ? "Uji dibatalkan. Tidak ada pengiriman ulang otomatis." :
        signal.aborted || status === 504 ? "Batas waktu uji habis. Tidak ada pengiriman ulang otomatis." :
        status === 401 ? "Sesi berakhir. Silakan masuk kembali." :
        status === 403 ? "Akses ditutup. Uji ini khusus Super Admin." :
        status === 429 ? "Uji sedang berjalan atau batas tiga uji per jam tercapai. Coba lagi nanti." :
        status === 404 ? "Uji Hermes hanya tersedia di preview." :
        "Uji atau pemeriksaan akses gagal. Runtime tidak diganti dengan simulasi; tidak ada pengiriman ulang otomatis.");
    } finally {
      if (current()) { pending.current = null; setBusy(false); }
    }
  };
  const visible = result?.owner === user?.id ? result?.data : null;
  const scheme = visible && "schemeCode" in visible ? visible : null;
  return <section aria-label="Uji Hermes Lokal" className="space-y-4 rounded-xl border border-border bg-card p-5">
    <div>
      <h2 className="text-lg font-semibold text-foreground">Uji Hermes Lokal</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Preview khusus Super Admin. Menjalankan runtime Hermes nyata dengan contoh sintetis
        atau rujukan unggahan BG001, menggunakan penyedia model tiruan lokal.
        Tidak memakai API berbayar, membaca dokumen anggota,
        memasang OpenClaw, atau menghasilkan analisis Claude.
      </p>
    </div>
    <label className="block space-y-1 text-sm text-foreground">
      <span>Mode uji</span>
      <select data-testid="hermes-local-mode" value={mode} disabled={busy}
        className="block w-full rounded-md border border-input bg-background px-3 py-2 text-foreground"
        onChange={event => {
          const next = event.target.value;
          if (next !== "runtime" && next !== "bg001") return;
          epoch.current++; pending.current?.abort(); pending.current = null;
          setMode(next); setConsent(false); setResult(null); setError(""); setBusy(false);
        }}>
        <option value="runtime">Runtime — data contoh sintetis</option>
        <option value="bg001">BG001 — rujukan regulasi unggahan</option>
      </select>
    </label>
    {mode === "bg001" && <p className="text-sm text-muted-foreground">
      Pertanyaan tetap: pemetaan KBLI dan perbedaan ruang lingkup BG001.
      Rujukan: KB09 halaman PDF 21, KB19 halaman PDF 17, KB44 halaman PDF 573.
      Konteks diperiksa pada pesan yang diterima Hermes. Respons sudah ditetapkan dari bank acuan,
      bukan hasil penalaran AI. Tidak mengubah profil atau jawaban chat utama.
    </p>}
    <label className="flex items-start gap-2 text-sm text-foreground">
      <input data-testid="hermes-local-consent" type="checkbox" checked={consent} disabled={busy || !user}
        onChange={event => setConsent(event.target.checked)} className="mt-1" />
      <span>{mode === "bg001" ? "Saya menyetujui uji lokal BG001 dengan kutipan regulasi unggahan tersebut, bukan dokumen anggota."
        : "Saya menyetujui satu uji runtime dengan data contoh, bukan dokumen anggota."}</span>
    </label>
    <div className="flex flex-wrap gap-2">
      <Button data-testid="hermes-local-start" disabled={!user || !consent || busy} onClick={() => void run()}>
        {busy ? "Hermes sedang diuji…" : mode === "bg001" ? "Uji Hermes BG001" : "Uji Hermes Lokal"}
      </Button>
      {busy && <Button data-testid="hermes-local-cancel" variant="outline" onClick={() => {
        epoch.current++; pending.current?.abort(); pending.current = null;
        setBusy(false); setResult(null); setError("Uji dibatalkan. Tidak ada pengiriman ulang otomatis.");
      }}>Batalkan uji</Button>}
    </div>
    {busy && <p role="status" className="text-sm text-muted-foreground">Menjalankan satu putaran agen. Tidak ada pengiriman ulang otomatis.</p>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    {visible && <div role="status" className="space-y-2 rounded-lg border border-border p-3 text-sm text-foreground">
      <p className="font-semibold">Selesai — runtime Hermes nyata, jawaban model tiruan</p>
      <p>Data: {scheme ? "rujukan unggahan BG001" : "sintetis"} · Dokumen {scheme ? "rujukan" : "contoh"}: {visible.documentCount} · Alat agen: {visible.toolCount}</p>
      <p>Panggilan model lokal: {visible.localProviderRequests} · Panggilan model eksternal: {visible.externalModelRequests}</p>
      <p>Durasi: {(visible.elapsedMs / 1000).toFixed(1)} detik</p>
      {scheme && <div className="space-y-2">
        <p>Skema: {scheme.schemeCode} · Konteks diterima Hermes · Kutipan sesuai sumber</p>
        <p className="font-medium">Pertanyaan: {scheme.question}</p>
      </div>}
      <p className="whitespace-pre-wrap text-muted-foreground">Respons contoh: {visible.fixtureReply}</p>
      {scheme && <details className="rounded border border-border p-3">
        <summary className="cursor-pointer font-medium">Sumber BG001 ({scheme.sources.length})</summary>
        <div className="mt-3 space-y-3">{scheme.sources.map(source => <div key={`${source.id}-${source.page}`}>
          <p className="font-medium">{source.id} · Halaman PDF {source.page} · {source.title}</p>
          <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap font-sans text-xs text-muted-foreground">{source.quote}</pre>
        </div>)}</div>
      </details>}
      <p className="text-muted-foreground">Ini bukan bukti ketepatan Claude, kepatuhan dokumen, atau kesiapan produksi.</p>
    </div>}
    <p className="text-xs text-muted-foreground">Maksimum tiga percobaan gabungan uji lokal dan chat Hermes per operator per jam dan satu proses bersamaan.
      Hasil tidak disimpan dan hilang saat halaman dimuat ulang. Izin diperiksa sebelum dan sesudah uji.</p>
  </section>;
}
