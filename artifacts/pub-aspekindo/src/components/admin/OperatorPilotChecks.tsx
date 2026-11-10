import { useEffect, useRef, useState } from "react";
import { createOperatorPilotJob, getOperatorPilotJob, cancelOperatorPilotJob } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { runOperatorPilotChecks, type PilotCheckResult } from "@/lib/operatorPilotChecks";

const states: Record<string, string> = {
  queued: "Antre", running: "Berjalan", completed: "Selesai", failed: "Gagal sintetis",
  cancelled: "Dibatalkan", timed_out: "Batas waktu habis",
};

export default function OperatorPilotChecks({ disabled, onBusyChange }: {
  disabled: boolean; onBusyChange: (busy: boolean) => void;
}) {
  const { user } = useAuth();
  const owner = useRef(user?.id); owner.current = user?.id;
  const version = useRef(0), pending = useRef<AbortController | null>(null);
  const plan = useRef<readonly [string, string] | null>(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState("");
  const [results, setResults] = useState<PilotCheckResult[]>([]);

  useEffect(() => {
    setResults([]); setError(""); setBusy(false); plan.current = null; onBusyChange(false);
    return () => { version.current++; pending.current?.abort(); pending.current = null; };
  }, [user?.id, onBusyChange]);

  const run = async () => {
    if (disabled || !user || pending.current) return;
    const identity = user.id, attempt = ++version.current, controller = new AbortController();
    pending.current = controller;
    const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]);
    const current = () => version.current === attempt && owner.current === identity;
    const options = async () => {
      signal.throwIfAborted();
      const { data, error: sessionError } = await supabase.auth.getSession();
      signal.throwIfAborted();
      if (!current() || sessionError || data.session?.user.id !== identity) throw { status: 401 };
      return { headers: { Authorization: `Bearer ${data.session.access_token}` }, signal };
    };
    setBusy(true); onBusyChange(true); setResults([]); setError("");
    try {
      plan.current ??= [crypto.randomUUID(), crypto.randomUUID()];
      await runOperatorPilotChecks({
        create: async input => (await createOperatorPilotJob(input, await options())).job,
        get: async id => getOperatorPilotJob(id, await options()),
        cancel: async id => cancelOperatorPilotJob(id, await options()),
      }, plan.current, signal, result => {
        if (current()) setResults(previous => [...previous, result]);
      });
      if (current()) plan.current = null;
    } catch (failure) {
      if (!current()) return;
      setResults([]); // No stale protected results after permission loss or verification failure.
      const status = (failure as { status?: number })?.status;
      setError(status === 401 ? "Sesi berakhir. Silakan login kembali." :
        status === 403 ? "Akses ditutup. Pengujian ini khusus Super Admin." :
        status === 429 ? "Batas permintaan tercapai. Tunggu sebelum mencoba kembali." :
        signal.aborted ? "Batas waktu pemeriksaan tercapai. Hasil belum terkonfirmasi." :
        "Pengujian berhenti karena akses atau layanan gagal diverifikasi. Hasil belum terkonfirmasi.");
    } finally {
      if (current()) { pending.current = null; setBusy(false); onBusyChange(false); }
    }
  };
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <h3 className="font-semibold text-foreground">Pengujian dua skenario</h3>
      <p className="text-sm text-muted-foreground">
        Satu klik membuat dua simulasi tertahan: yang pertama langsung dibatalkan,
        yang kedua dibiarkan hingga batas waktu server habis. Tidak perlu menyalin ID atau mengisi formulir.
      </p>
      <Button variant="outline" disabled={disabled || busy || !user} onClick={() => void run()}>
        {busy ? "Menguji pembatalan & timeout…" : plan.current ? "Ulangi ID pengujian yang sama" : "Uji pembatalan & timeout"}
      </Button>
      {busy && <p role="status" className="text-sm text-muted-foreground">Memeriksa hasil dari server. Maksimal 20 detik.</p>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {results.length > 0 && <ul aria-label="Hasil pengujian pembatalan dan timeout" className="space-y-2">
        {results.map(result => <li key={result.name} className="rounded-lg border border-border p-3 text-sm text-foreground">
          <p className="font-semibold">{result.name === "cancellation" ? "Pembatalan" : "Timeout"}: {result.passed ? "Lulus" : "Belum lulus"} — {states[result.state]}</p>
          {result.pollLimitReached && <p>Batas pemeriksaan tercapai; tidak dianggap sebagai timeout server.</p>}
          {!result.passed && result.name === "cancellation" && result.state === "timed_out" &&
            <p>Timeout server terjadi sebelum pembatalan; pembatalan belum terbukti.</p>}
          <p className="mt-1 break-all text-xs text-muted-foreground">ID simulasi: {result.id}</p>
        </li>)}
      </ul>}
      <p className="text-xs text-muted-foreground">
        Hanya status nyata dari API yang dihitung sebagai lulus. Semua eksekusi tetap sintetis.
        Tidak ada pengiriman ulang otomatis; percobaan manual setelah kegagalan memakai ID yang sama.
      </p>
    </div>
  );
}
