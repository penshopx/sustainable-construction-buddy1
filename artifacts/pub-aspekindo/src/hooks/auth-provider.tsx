import { ReactNode, useEffect, useRef, useState } from "react";
import { AuthError, Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { clearLocalAssessmentDrafts } from "@/lib/assessmentDraft";
import { AuthContext, type Profile } from "./useAuth";
import { loadBusinessProfile } from "@/lib/ruang-simpan";
import { createLogoutRequest } from "@/lib/logoutRequest";

// Match createClient's default key; do not react to unrelated apps' storage.
const authStorageKey = `sb-${new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split(".")[0]}-auth-token`;

// Shared with every provider instance: an SDK request may outlive its UI.
const logoutRequest = createLogoutRequest(
  async (signal) => {
    const cleared = await fetch("/api/ruang-simpan/session", {
      method: "DELETE", credentials: "same-origin", signal,
    });
    if (!cleared.ok) throw new Error("Sesi Ruang Simpan belum dapat ditutup. Coba keluar lagi.");
  },
  async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },
);

function pendingLogoutError() {
  return new AuthError("Permintaan keluar sebelumnya belum selesai. Coba keluar lagi sebelum masuk atau mendaftar.");
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [businessProfileError, setBusinessProfileError] = useState("");
  const profileRequestId = useRef(0);
  const currentIdentity = useRef<string | null>(null);
  const mounted = useRef(false);

  const fetchProfile = async (userId: string) => {
    if (!mounted.current || currentIdentity.current !== userId) return;
    const requestId = ++profileRequestId.current;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    let company = "";
    let companyError = "";
    try { company = (await loadBusinessProfile()).name; }
    catch { companyError = "Profil perusahaan Ruang Simpan belum dapat dimuat. Data lama tidak dipakai sebagai pengganti."; }
    if (mounted.current && currentIdentity.current === userId && requestId === profileRequestId.current) {
      setProfile(data ? { ...data, company } : null);
      setBusinessProfileError(companyError);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };
  useEffect(() => {
    const refresh = () => { if (user && document.visibilityState === "visible") void fetchProfile(user.id); };
    window.addEventListener("focus", refresh);
    const timer = window.setInterval(refresh, 30_000);
    return () => { window.removeEventListener("focus", refresh); window.clearInterval(timer); };
  }, [user?.id]);

  useEffect(() => {
    mounted.current = true;
    let active = true;
    let authEventVersion = 0;
    const handleStorage = (event: StorageEvent) => {
      if (!active || event.storageArea !== localStorage ||
          (event.key !== authStorageKey && event.key !== null) ||
          event.newValue !== null) return;
      // Storage events are queued. A newer login may already have replaced the
      // removed token; an old logout must not erase that newer identity.
      try {
        if (localStorage.getItem(authStorageKey) !== null) return;
      } catch { return; }
      authEventVersion += 1;
      // Invalidate this tab's pending draft writes even if tab one already
      // removed the shared keys. Do not call signOut: it can race a new login.
      try { clearLocalAssessmentDrafts(localStorage); } catch { /* Storage is unavailable. */ }
      profileRequestId.current += 1;
      currentIdentity.current = null;
      setSession(null);
      setUser(null);
      setProfile(null);
      setBusinessProfileError("");
      setLoading(false);
    };
    window.addEventListener("storage", handleStorage);
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!active) return;
        authEventVersion += 1;
        if (event === "SIGNED_OUT") {
          try { clearLocalAssessmentDrafts(localStorage); } catch { /* Storage is unavailable. */ }
        }
        profileRequestId.current += 1;
        currentIdentity.current = session?.user.id ?? null;
        setSession(session);
        setUser(session?.user ?? null);
        setProfile(null);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
        }
        setLoading(false);
      }
    );

    const restoreVersion = authEventVersion;
    void supabase.auth.getSession()
      .then(({ data: { session } }) => {
        if (!active || restoreVersion !== authEventVersion) return;
        profileRequestId.current += 1;
        currentIdentity.current = session?.user.id ?? null;
        setSession(session);
        setUser(session?.user ?? null);
        setProfile(null);
        if (session?.user) void fetchProfile(session.user.id);
      })
      .catch(() => {
        if (!active || restoreVersion !== authEventVersion) return;
        console.error("Gagal memulihkan sesi autentikasi.");
        currentIdentity.current = null;
        setSession(null);
        setUser(null);
        setProfile(null);
      })
      .finally(() => { if (active && restoreVersion === authEventVersion) setLoading(false); });

    return () => {
      mounted.current = false;
      active = false;
      currentIdentity.current = null;
      profileRequestId.current += 1;
      window.removeEventListener("storage", handleStorage);
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
    if (logoutRequest.pending) return { error: pendingLogoutError(), session: null };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: `${window.location.origin}/auth?confirmed=1`,
      },
    });
    return { error, session: data.session };
  };

  const signIn = async (email: string, password: string) => {
    if (logoutRequest.pending) return { error: pendingLogoutError(), session: null };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { error, session: data.session };
  };

  const signOut = async () => {
    // Purge before the auth request so an interrupted logout cannot leave answers behind.
    try { clearLocalAssessmentDrafts(localStorage); } catch { /* Storage is unavailable. */ }
    await logoutRequest.run();
    // Auth state/profile changes belong to onAuthStateChange, not a stale
    // completion callback from a previous provider or identity.
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, profile, businessProfileError, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}