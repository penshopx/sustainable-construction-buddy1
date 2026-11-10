import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function useSuperAdmin() {
  const { user } = useAuth();
  const [role, setRole] = useState<{ userId: string; allowed: boolean; loading: boolean } | null>(null);

  useEffect(() => {
    if (!user) return;

    let active = true;
    let requestId = 0;
    const userId = user.id;
    const check = async () => {
      const currentRequest = ++requestId;
      // Hide protected content while a fresh role check is pending.
      setRole({ userId, allowed: false, loading: true });
      try {
        const { data, error } = await supabase.rpc("current_user_is_super_admin");
        if (active && currentRequest === requestId) {
          setRole({ userId, allowed: !error && data === true, loading: false });
        }
      } catch {
        if (active && currentRequest === requestId) {
          setRole({ userId, allowed: false, loading: false });
        }
      }
    };
    const checkWhenVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    void check();
    window.addEventListener("focus", checkWhenVisible);
    document.addEventListener("visibilitychange", checkWhenVisible);
    const interval = window.setInterval(checkWhenVisible, 30_000);
    return () => {
      active = false;
      window.removeEventListener("focus", checkWhenVisible);
      document.removeEventListener("visibilitychange", checkWhenVisible);
      window.clearInterval(interval);
    };
  }, [user?.id]);

  const currentRole = user && role?.userId === user.id ? role : null;
  return {
    isSuperAdmin: currentRole?.allowed === true && !currentRole.loading,
    loading: Boolean(user) && (currentRole?.loading ?? true),
  };
}
