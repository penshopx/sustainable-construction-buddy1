import { useCallback, useEffect, useRef, useState } from "react";
import {
  createOperatorPilotJob, getOperatorPilotJob, cancelOperatorPilotJob,
  type OperatorPilotInput, type OperatorPilotJob,
} from "@workspace/api-client-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import OperatorPilotChecks from "./OperatorPilotChecks";

const terminal = (state: string) => !["queued", "running"].includes(state);
const states: Record<OperatorPilotJob["state"], string> = {
  queued: "Antre", running: "Berjalan", completed: "Selesai",
  failed: "Gagal sintetis", cancelled: "Dibatalkan", timed_out: "Batas waktu habis",
};

export default function OperatorPilotPanel() {
  const { user } = useAuth();
  const [scenario, setScenario] = useState<NonNullable<OperatorPilotInput["scenario"]>>("success");
  const [job, setJob] = useState<OperatorPilotJob | null>(null);
  const [phase, setPhase] = useState<"create" | "get" | "cancel" | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const owner = useRef(user?.id); owner.current = user?.id;
  const epoch = useRef(0), pending = useRef<AbortController | null>(null);
  const last = useRef<OperatorPilotInput | null>(null);

  const execute = useCallback(async (
    action: "create" | "get" | "cancel", payload: OperatorPilotInput | string,
  ) => {
    if (!user || (pending.current && action !== "cancel")) return;
    pending.current?.abort();
    const controller = new AbortController(), version = ++epoch.current, identity = user.id;
    pending.current = controller; setPhase(action); setError("");
    const current = () => epoch.current === version && owner.current === identity && !controller.signal.aborted;
    try {
      const { data, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || data.session?.user.id !== identity) throw { status: 401 };
      if (!current()) return;
      const options = { headers: { Authorization: `Bearer ${data.session.access_token}` }, signal: controller.signal };
      const result = action === "create"
        ? (await createOperatorPilotJob(payload as OperatorPilotInput, options)).job
        : action === "get" ? await getOperatorPilotJob(payload as string, options)
        : await cancelOperatorPilotJob(payload as string, options);
      if (current()) setJob(result);
    } catch (failure) {
      if (!current()) return;
      setJob(null); // Stop polling and hide stale results on access loss or verification failure.
      const status = (failure as { status?: number })?.status;
      setError(status === 401 ? "Sesi berakhir. Silakan login kembali." :
        status === 403 ? "Akses ditutup. Pilot ini khusus Super Admin." :
        status === 429 ? "Batas pilot tercapai. Tunggu sebelum mencoba kembali." :
        status === 404 ? "Pilot atau simulasi tidak ditemukan. Status lama tidak ditampilkan." :
        "Pemeriksaan akses atau layanan gagal. Akses ditutup; tidak ada pengiriman ulang otomatis.");
    } finally {
      if (current()) { pending.current = null; setPhase(null); }
    }
  }, [user?.id]);

  useEffect(() => {
    setJob(null); setError(""); setPhase(null); last.current = null;
    return () => { epoch.current++; pending.current?.abort(); pending.current = null; };
  }, [user?.id]);

  useEffect(() => {
    if (!job || terminal(job.state) || phase) return;
    const timer = setTimeout(() => void execute("get", job.id), 750);
    return () => clearTimeout(timer);
  }, [job?.id, job?.state, phase, execute]);

  const start = () => {
    if (checking || phase || (job && !terminal(job.state))) return;
    if (job || !last.current) last.current = { requestId: crypto.randomUUID(), operation: "service_health", scenario };
    setJob(null);
    void execute("create", last.current);
  };
  const active = !!job && !terminal(job.state);
  return (
    <section className="space-y-4 rounded-xl border border-border bg-card p-5" aria-label="Pilot operator sintetis">
      <div>
        <h2 className="text-lg font-semibold text-foreground">Pilot operator · Simulasi OpenClaw–Hermes</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Preview khusus Super Admin. Tidak memasang OpenClaw, menjalankan Hermes, memanggil AI,
          membaca dokumen anggota, atau mengukur kesehatan layanan sebenarnya.
        </p>
      </div>
      <label className="block text-sm text-foreground">Skenario sintetis
        <select className="ml-3 rounded border border-border bg-background px-3 py-2"
          value={scenario} disabled={checking || !!phase || active || (!job && !!last.current)}
          onChange={event => setScenario(event.target.value as typeof scenario)}>
          <option value="success">Selesai normal</option>
          <option value="failure">Gagal sintetis</option>
          <option value="hang">Tertahan hingga timeout</option>
        </select>
      </label>
      <div className="flex flex-wrap gap-3">
        <Button disabled={checking || !!phase || active || !user} onClick={start}>
          {phase === "create" ? "Memeriksa akses…" : !job && last.current ? "Kirim ulang ID yang sama" : "Mulai simulasi"}
        </Button>
        {active && <Button variant="outline" disabled={phase === "create" || phase === "cancel"}
          onClick={() => void execute("cancel", job.id)}>Batalkan simulasi</Button>}
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {job && <div role="status" className="rounded-lg border border-border p-3 text-sm text-foreground">
        <p className="font-semibold">Status: {states[job.state]}</p>
        <p className="mt-1 break-all text-xs text-muted-foreground">ID simulasi: {job.id} · Mode: sintetis</p>
        {job.result && <p className="mt-2">OpenClaw: simulasi · Hermes: simulasi. Bukan hasil layanan nyata.</p>}
      </div>}
      <p className="text-xs text-muted-foreground">
        Izin diperiksa ulang pada setiap permintaan. Status hanya tersedia bagi pembuat simulasi.
        Jika pengiriman gagal, tombol memakai ID permintaan yang sama; tidak ada pengiriman ulang otomatis.
        Riwayat berada di memori proses dan dapat hilang saat restart; retensi terminal 5 menit.
      </p>
      <OperatorPilotChecks disabled={!!phase || active || (!job && !!last.current)} onBusyChange={setChecking} />
    </section>
  );
}
