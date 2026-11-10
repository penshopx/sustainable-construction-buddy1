import { Link } from "react-router-dom";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginGate({ next, what }: { next: string; what: string }) {
  return (
    <div className="rounded-xl border-2 border-dashed border-pub-navy/30 bg-card p-6 text-center">
      <LogIn className="mx-auto h-8 w-8 text-pub-navy dark:text-pub-amber" aria-hidden />
      <p className="mt-3 font-heading text-lg font-bold">Masuk untuk {what}</p>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">Riwayat tersimpan di akun PUB Anda sendiri. Halaman ini tetap bisa dibaca tanpa masuk.</p>
      <Button asChild className="mt-4" data-testid="link-login-gate"><Link to={`/auth?next=${encodeURIComponent(next)}`}>Masuk akun PUB</Link></Button>
    </div>
  );
}
