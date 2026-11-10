import { createContext, useContext } from "react";
import { User, Session } from "@supabase/supabase-js";
import type { AuthError } from "@supabase/supabase-js";
import type { Tables } from "@/integrations/supabase/types";

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  profile: Profile | null;
  businessProfileError?: string;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: AuthError | null; session: Session | null }>;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null; session: Session | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export type Profile = Tables<"profiles">;

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
