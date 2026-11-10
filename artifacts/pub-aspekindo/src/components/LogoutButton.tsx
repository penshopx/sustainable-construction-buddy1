import { useEffect, useRef, useState } from "react";
import { Loader2, LogOut } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { LogoutTimeoutError } from "@/lib/logoutRequest";

const errorToastId = "pub-logout-error";

export function LogoutButton({ collapsed }: { collapsed: boolean }) {
  const { signOut } = useAuth();
  const [pending, setPending] = useState(false);
  const inFlight = useRef(false);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      toast.dismiss(errorToastId);
    };
  }, []);

  const handleLogout = async () => {
    if (!mounted.current || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    toast.dismiss(errorToastId);
    try {
      await signOut();
    } catch (error) {
      if (!mounted.current) return;
      toast.error(error instanceof LogoutTimeoutError
        ? error.message
        : "Logout belum terkonfirmasi. Sesi mungkin masih aktif.", {
        id: errorToastId,
        duration: Infinity,
        description: "Jangan tinggalkan perangkat bersama sebelum berhasil keluar. Periksa koneksi lalu coba lagi. Jika permintaan sebelumnya masih berjalan, percobaan ulang menunggu hasilnya tanpa mengirim permintaan ganda.",
        action: { label: "Coba lagi", onClick: () => { void handleLogout(); } },
      });
    } finally {
      inFlight.current = false;
      if (mounted.current) setPending(false);
    }
  };

  return (
    <SidebarMenuButton
      onClick={() => { void handleLogout(); }}
      disabled={pending}
      aria-busy={pending}
      aria-label={pending ? "Sedang keluar…" : "Keluar"}
      tooltip={pending ? "Sedang keluar…" : "Keluar"}
      className="text-destructive hover:bg-destructive/10"
    >
      {pending
        ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
        : <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />}
      {!collapsed && <span>{pending ? "Sedang keluar…" : "Keluar"}</span>}
    </SidebarMenuButton>
  );
}
