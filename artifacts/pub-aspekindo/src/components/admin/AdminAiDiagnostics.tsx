import { useEffect, useState } from "react";
import { getHelpdeskAiStatus, getVaultAiStatus } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { diagnosticGuide, projectDiagnostic, type SafeDiagnostic } from "@/lib/adminAiDiagnostics";

const services = [
  { name: "Helpdesk AI", get: getHelpdeskAiStatus },
  { name: "AI Ruang Simpan", get: getVaultAiStatus },
] as const;
type Result = { diagnostic: SafeDiagnostic } | { unavailable: true };
const formatTime = (value: string) => new Intl.DateTimeFormat("id-ID", {
  dateStyle: "medium", timeStyle: "medium",
}).format(new Date(value));

export default function AdminAiDiagnostics() {
  const { user, session, loading } = useAuth();
  if (loading || !user || !session) return null;
  // A changed account/session gets a new component, never a prior user's data.
  return <SessionDiagnostics key={`${user.id}:${session.access_token}`} owner={user.id} />;
}

function SessionDiagnostics({ owner }: { owner: string }) {
  const [results, setResults] = useState<Result[] | null>(null);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let disposed = false, generation = 0, pending: AbortController | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const clear = () => {
      generation++;
      pending?.abort();
      clearTimeout(timer);
      setResults(null);
    };
    const check = async () => {
      clear();
      if (document.visibilityState === "hidden") { setChecking(false); return; }
      const version = generation;
      const controller = pending = new AbortController();
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]);
      const current = () => !disposed && version === generation;
      setChecking(true); setError("");
      try {
        const { data, error: sessionError } = await supabase.auth.getSession();
        signal.throwIfAborted();
        if (!current()) return;
        if (sessionError || data.session?.user.id !== owner) throw { status: 401 };
        const options = {
          headers: { Authorization: `Bearer ${data.session.access_token}` },
          cache: "no-store" as const, signal,
        };
        const statuses = await Promise.allSettled(services.map(async service =>
          projectDiagnostic(await service.get({ diagnostics: true }, options))));
        if (!current()) return;
        // Any authorization failure closes BOTH services; no partial stale data.
        for (const status of statuses) {
          if (status.status === "rejected" && [401, 403].includes(status.reason?.status)) throw status.reason;
        }
        setResults(statuses.map(status => status.status === "fulfilled"
          ? { diagnostic: status.value } : { unavailable: true }));
      } catch (failure) {
        if (!current()) return;
        setResults(null);
        const status = (failure as { status?: number })?.status;
        setError(status === 401 ? "Sesi tidak dapat diverifikasi. Silakan login kembali." :
          status === 403 ? "Akses diagnostik ditutup. Peran admin tidak lagi terverifikasi." :
          "Pemeriksaan akses atau layanan gagal. Hasil sebelumnya telah dihapus; coba periksa kembali.");
      } finally {
        if (current()) {
          setChecking(false);
          // Provider metadata may be cached, but permission is reverified by
          // BOTH endpoints on every request. No React Query/persistent cache.
          timer = setTimeout(() => void check(), 30000);
        }
      }
    };
    const hide = () => { clear(); setChecking(false); };
    const visibility = () => document.visibilityState === "hidden" ? hide() : void check();
    window.addEventListener("blur", hide);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", visibility);
    void check();
    return () => {
      disposed = true; generation++; pending?.abort(); clearTimeout(timer);
      window.removeEventListener("blur", hide);
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", visibility);
    };
  }, [owner, attempt]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Diagnostik layanan AI — khusus admin</CardTitle>
        <p className="text-sm text-muted-foreground">
          Panduan operasional aman, tanpa kredensial, saldo rinci, atau respons mentah penyedia.
          Akses diperiksa ulang setiap 30 detik dan saat kembali ke halaman.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button variant="outline" disabled={checking} onClick={() => setAttempt(value => value + 1)}>
          {checking ? "Memeriksa akses dan status AI…" : "Periksa kembali layanan AI"}
        </Button>
        {checking && <p role="status" className="text-sm text-muted-foreground">Hasil lama disembunyikan selama pemeriksaan akses.</p>}
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        {!checking && !error && !results && <p className="text-sm text-muted-foreground">Kembali ke halaman atau periksa ulang untuk melihat diagnostik terbaru.</p>}
        {results && <div className="grid gap-4 md:grid-cols-2">
          {results.map((result, index) => <section key={services[index].name} className="rounded-lg border border-border p-4 space-y-2">
            <h3 className="font-semibold">{services[index].name}</h3>
            {"diagnostic" in result ? <>
              <p className="text-sm font-medium">{diagnosticGuide(result.diagnostic.code).title}</p>
              <p className="text-sm text-muted-foreground">{diagnosticGuide(result.diagnostic.code).action}</p>
              <dl className="text-xs text-muted-foreground space-y-1">
                <div><dt className="inline">Diperiksa: </dt><dd className="inline">{formatTime(result.diagnostic.checkedAt)}</dd></div>
                <div><dt className="inline">Cache server hingga: </dt><dd className="inline">{formatTime(result.diagnostic.recheckAt)}</dd></div>
              </dl>
            </> : <p role="alert" className="text-sm text-destructive">Status belum dapat dibaca. Coba periksa kembali; jangan menganggap layanan siap.</p>}
          </section>)}
        </div>}
        <p className="text-xs text-muted-foreground">
          Pemeriksaan ulang dapat memakai metadata dalam cache sampai waktu di atas, tetapi izin admin selalu diperiksa ulang.
          Status ini bukan kuota pribadi anggota dan bukan jaminan pesan akan berhasil.
        </p>
      </CardContent>
    </Card>
  );
}
