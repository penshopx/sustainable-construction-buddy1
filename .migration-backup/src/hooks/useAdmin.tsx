import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export function useAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    const check = async () => {
      // "super_admin" only exists as a DB enum value once its migration has run.
      // Until then, this filter errors (invalid enum literal) instead of just
      // returning no rows, so fall back to checking "admin" alone.
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .in("role", ["admin", "super_admin"]);

      if (error) {
        const fallback = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .eq("role", "admin")
          .maybeSingle();
        setIsAdmin(!!fallback.data);
      } else {
        setIsAdmin(!!data && data.length > 0);
      }
      setLoading(false);
    };
    check();
  }, [user]);

  return { isAdmin, loading };
}
