import { ReactNode, useEffect, useRef, useState } from "react";
import { Session, User } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { AuthContext, type Profile } from "./useAuth";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const profileRequestId = useRef(0);

  const fetchProfile = async (userId: string) => {
    const requestId = ++profileRequestId.current;
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", userId)
      .single();
    if (requestId === profileRequestId.current) {
      setProfile(data ?? null);
    }
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        profileRequestId.current += 1;
        setSession(session);
        setUser(session?.user ?? null);
        setProfile(null);
        if (session?.user) {
          setTimeout(() => fetchProfile(session.user.id), 0);
        }
        setLoading(false);
      }
    );

    void supabase.auth.getSession()
      .then(({ data: { session } }) => {
        profileRequestId.current += 1;
        setSession(session);
        setUser(session?.user ?? null);
        setProfile(null);
        if (session?.user) void fetchProfile(session.user.id);
      })
      .catch((error: unknown) => {
        console.error("Gagal memulihkan sesi autentikasi:", error);
        setSession(null);
        setUser(null);
        setProfile(null);
      })
      .finally(() => setLoading(false));

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, fullName: string) => {
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { error, session: data.session };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, profile, signUp, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}