import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeSmapPilot, listSmapPilotDocuments, type SmapPilotDocument, type SmapPilotResult } from "@workspace/api-client-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export function useSmapPilot() {
  const { user } = useAuth();
  const owner = useRef(user?.id);
  owner.current = user?.id;
  const operation = useRef(0);
  const pending = useRef<AbortController | null>(null);
  const [documents, setDocuments] = useState<SmapPilotDocument[]>([]);
  const [result, setResult] = useState<SmapPilotResult | null>(null);
  const [busy, setBusy] = useState<"list" | "analysis" | null>(null);
  const [error, setError] = useState("");

  const cancel = useCallback(() => {
    operation.current++;
    pending.current?.abort();
    pending.current = null;
    setBusy(null);
    setResult(null);
  }, []);

  const execute = useCallback(async (ids?: string[]) => {
    if (!user || (ids && pending.current)) return;
    const identity = user.id;
    const version = ++operation.current;
    pending.current?.abort();
    const controller = new AbortController();
    pending.current = controller;
    setBusy(ids ? "analysis" : "list");
    setError("");
    setResult(null);
    if (!ids) setDocuments([]);
    const current = () => operation.current === version && owner.current === identity && !controller.signal.aborted;
    try {
      const session = await supabase.auth.getSession();
      if (session.error || session.data.session?.user.id !== identity) throw { status: 401 };
      if (!current()) return;
      const options = {
        headers: { Authorization: `Bearer ${session.data.session.access_token}` },
        signal: controller.signal,
      };
      if (ids) {
        const value = await analyzeSmapPilot({ documentIds: ids, consent: "smap-presence-v1" }, options);
        if (current()) setResult(value);
      } else {
        const value = await listSmapPilotDocuments(options);
        if (current()) setDocuments(value.documents);
      }
    } catch (failure) {
      if (!current()) return;
      const status = (failure as { status?: number })?.status;
      setError(status === 401 ? "Sesi berakhir. Silakan login kembali." :
        status === 429 ? "Batas pilot tercapai atau pilot sedang digunakan. Coba lagi nanti; jangan kirim berulang." :
        status === 404 ? "Catatan atau akses berubah. Muat ulang daftar." :
        status === 504 ? "Analisis melewati batas waktu. Tidak ada pengiriman ulang otomatis." :
        status === 503 ? "Runtime Hermes atau layanan Claude belum tersedia. Tidak ada model pengganti otomatis." :
        "Permintaan gagal. Hasil belum tersedia; tidak ada pengiriman ulang otomatis.");
    } finally {
      if (current()) { setBusy(null); pending.current = null; }
    }
  }, [user?.id]);

  useEffect(() => {
    setDocuments([]);
    setResult(null);
    setBusy(null);
    setError("");
    void execute();
    return () => {
      operation.current++;
      pending.current?.abort();
      pending.current = null;
    };
  }, [execute]);

  return { documents, result, busy, error, refresh: () => execute(),
    analyze: (ids: string[]) => execute(ids), cancel };
}
