import { useEffect, useState } from "react";
import { getSchemeReferences, type SchemeReferenceBank } from "@workspace/api-client-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function useSchemeReferenceBank() {
  const { user } = useAuth();
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{
    owner?: string; bank: SchemeReferenceBank | null; loading: boolean; error: string | null;
  }>({ bank: null, loading: true, error: null });
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const owner = user?.id;
    setState({ owner, bank: null, loading: !!owner, error: null });
    if (owner) void (async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        const session = data.session;
        if (error || !session?.access_token || session.user.id !== owner) throw new Error("Member session required");
        if (!active) return;
        const bank = await getSchemeReferences({
          headers: { Authorization: `Bearer ${session.access_token}` },
          signal: controller.signal, cache: "no-store",
        });
        if (active) setState({ owner, bank, loading: false, error: null });
      } catch {
        if (active) setState({ owner, bank: null, loading: false,
          error: "Referensi belum dapat dimuat. Periksa koneksi atau masuk kembali, lalu coba lagi." });
      }
    })();
    return () => { active = false; controller.abort(); };
  }, [user?.id, retry]);
  const belongsToUser = !!user && state.owner === user.id;
  return {
    bank: belongsToUser ? state.bank : null,
    loading: belongsToUser ? state.loading : !!user,
    error: belongsToUser ? state.error : null,
    onRetry: () => setRetry(value => value + 1),
  };
}
