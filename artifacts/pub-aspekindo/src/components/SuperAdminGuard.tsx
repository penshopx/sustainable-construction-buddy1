import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useSuperAdmin } from "@/hooks/useSuperAdmin";
import { Loader2 } from "lucide-react";

export default function SuperAdminGuard({ children }: { children: ReactNode }) {
  const { isSuperAdmin, loading } = useSuperAdmin();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !isSuperAdmin) navigate("/dashboard", { replace: true });
  }, [loading, isSuperAdmin, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperAdmin) return null;

  return <>{children}</>;
}
