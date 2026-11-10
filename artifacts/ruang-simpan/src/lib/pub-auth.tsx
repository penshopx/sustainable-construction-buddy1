import { createClient, type Session } from "@supabase/supabase-js";
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";

// Same Supabase project and default storage key as PUB: no second account.
export const pubClient = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
const Context = createContext<{ session: Session | null; loading: boolean; error: string; signOut: () => Promise<void> }>({
  session: null, loading: true, error: "", signOut: async () => {},
});
export const usePubAuth = () => useContext(Context);
export function PubAuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true, generation = 0;
    let identity: string | null | undefined;
    let controller: AbortController | undefined;
    let queue = Promise.resolve();
    const sync = (next: Session | null) => {
      const version = ++generation;
      const changed = identity !== (next?.user.id ?? null);
      identity = next?.user.id ?? null;
      if (changed) { setLoading(true); setSession(null); qc.clear(); }
      setError("");
      // Serialize bridges: an older identity cannot overwrite a newer cookie.
      queue = queue.catch(() => {}).then(async () => {
        if (!active || version !== generation) return;
        controller = new AbortController();
        const signal = controller.signal;
        try {
          const res = await fetch("/api/ruang-simpan/session", {
            method: next ? "POST" : "DELETE", credentials: "same-origin", signal,
            headers: next ? { Authorization: `Bearer ${next.access_token}` } : {},
          });
          if (!res.ok) throw new Error("Akses PUB belum dapat dihubungkan. Muat ulang atau masuk kembali melalui PUB.");
          if (next && (await res.json()).userId !== next.user.id) throw new Error("Identitas sesi PUB tidak cocok. Masuk ulang sebelum membuka dokumen.");
          if (active && version === generation) { setSession(next); setLoading(false); }
        } catch (e) {
          if (active && version === generation) { setError(e instanceof Error ? e.message : "Sesi tidak tersedia."); setLoading(false); }
        }
      });
    };
    const { data: { subscription } } = pubClient.auth.onAuthStateChange((_event, next) => { sync(next); });
    void pubClient.auth.getSession().then(({ data }) => { if (active && generation === 0) sync(data.session); });
    return () => { active = false; controller?.abort(); subscription.unsubscribe(); };
  }, [qc]);
  async function signOut() {
    // Central PUB logout also purges private offline assessment drafts.
    window.location.assign("/auth?logout=1");
  }
  return <Context.Provider value={{ session, loading, error, signOut }}>{children}</Context.Provider>;
}
