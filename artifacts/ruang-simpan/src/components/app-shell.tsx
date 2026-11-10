import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { usePubAuth } from '@/lib/pub-auth';
import { useGetVaultWorkspace } from '@workspace/api-client-react';
import { FolderOpen, Building2, Bot, History, LogOut } from 'lucide-react';
import { formatBytes } from '@/lib/vault';
import { cn } from '@/lib/utils';

const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');

const NAV = [
  { href: '/user-portal', label: 'Dokumen', icon: FolderOpen },
  { href: '/assistants', label: 'Asisten AI', icon: Bot },
  { href: '/profile', label: 'Profil & Akses', icon: Building2 },
  { href: '/activity', label: 'Aktivitas', icon: History },
];

export function Brand({ className }: { className?: string }) {
  return (
    <span className={cn('flex items-center gap-2.5', className)}>
      <img src={`${basePath}/logo.svg`} alt="" className="h-8 w-8" />
      <span className="text-lg font-extrabold tracking-tight">
        Ruang<span className="text-primary">Simpan</span>
      </span>
    </span>
  );
}

function Quota() {
  const { data } = useGetVaultWorkspace();
  if (!data) return <div className="h-14 rounded-lg bg-sidebar-accent/60 animate-pulse" />;
  const pct = Math.min(100, (data.usedBytes / Math.max(1, data.limitBytes)) * 100);
  return (
    <div className="rounded-lg border border-sidebar-border p-3" data-testid="text-quota">
      <div className="flex justify-between text-xs font-mono-ui text-sidebar-foreground/80">
        <span>{formatBytes(data.usedBytes)}</span>
        <span>{formatBytes(data.limitBytes)} gratis</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-sidebar-accent overflow-hidden">
        <div className="h-full bg-primary origin-left" style={{ transform: `scaleX(${pct / 100})` }} />
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [loc] = useLocation();
  const { signOut, session } = usePubAuth();
  const fullName = session?.user.user_metadata?.full_name;
  const name = (typeof fullName === 'string' && fullName) || session?.user.email || 'Akun PUB';
  const initials = name.split(/\s|@/).filter(Boolean).slice(0, 2).map((s) => s[0]?.toUpperCase()).join('');

  return (
    <div className="min-h-[100dvh] md:pl-64">
      <aside className="hidden md:flex fixed inset-y-0 left-0 w-64 flex-col bg-sidebar border-r border-sidebar-border p-4 text-sidebar-foreground">
        <Link href="/user-portal" className="px-2 py-2" data-testid="link-home">
          <Brand />
        </Link>
        <a href="/dashboard" className="px-2 mt-2 block text-sm text-primary">← Kembali ke PUB ASPEKINDO</a>
        <a href="/klinik-konsultasi" className="px-2 mt-3 block text-sm font-semibold text-primary">Buka Klinik Konsultasi</a>
        <a href="/bedah-dokumen" data-testid="link-bedah-dokumen" className="px-2 mt-2 block text-sm font-semibold text-primary">Buka Bedah Dokumen</a>
        <a href="/brain-project" data-testid="link-brain-project" className="px-2 mt-2 block text-sm font-semibold text-primary">Analisis proyek di Brain Project</a>
        <a href="/konsultasi" data-testid="link-konsultasi" className="px-2 mt-2 block text-sm font-semibold text-primary">Konsultasi terpandu</a>
        <a href="/helpdesk" className="px-2 mt-2 block text-sm font-semibold text-primary">Buka Helpdesk AI PUB</a>
        <p className="px-2 mt-1 text-[11px] uppercase tracking-[0.2em] text-sidebar-foreground/60 font-mono-ui">Acuan data bisnis PUB</p>
        <nav className="mt-8 flex flex-col gap-1">
          {NAV.map((n) => {
            const active = loc === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                data-testid={`link-nav-${n.href.slice(1)}`}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] font-semibold transition-colors',
                  active ? 'bg-ice' : 'text-sidebar-foreground/85 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                )}
              >
                <n.icon className="h-4 w-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto space-y-3">
          <Quota />
          <div className="flex items-center gap-3 rounded-lg p-2">
            <div className="h-9 w-9 shrink-0 rounded-full bg-primary/20 text-primary grid place-items-center text-sm font-bold">{initials || 'RS'}</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold" data-testid="text-username">{name}</p>
            </div>
            <button
              type="button"
              aria-label="Keluar"
              data-testid="button-logout"
              onClick={() => void signOut()}
              className="rounded-md p-2 text-sidebar-foreground/70 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/90 backdrop-blur px-4 py-3">
        <Brand />
        <a href="/klinik-konsultasi" className="text-sm font-semibold text-primary">Klinik</a>
        <a href="/bedah-dokumen" data-testid="link-bedah-dokumen-mobile" className="text-sm font-semibold text-primary">Bedah</a>
        <button type="button" data-testid="button-logout-mobile" onClick={() => void signOut()} className="text-sm font-semibold text-muted-foreground flex items-center gap-1.5">
          <LogOut className="h-4 w-4" /> Keluar
        </button>
      </header>

      <main className="px-4 py-6 pb-28 md:px-10 md:py-10 md:pb-10 max-w-[1400px]">{children}</main>

      <nav className="md:hidden fixed bottom-0 inset-x-0 z-30 grid grid-cols-4 border-t border-border bg-sidebar">
        {NAV.map((n) => (
          <Link key={n.href} href={n.href} data-testid={`link-mnav-${n.href.slice(1)}`} className={cn('flex flex-col items-center gap-1 py-2.5 text-[11px] font-semibold', loc === n.href ? 'text-primary' : 'text-muted-foreground')}>
            <n.icon className="h-5 w-5" />
            {n.label.split(' ')[0]}
          </Link>
        ))}
      </nav>
    </div>
  );
}

export function PageHeader({ kicker, title, children }: { kicker: string; title: string; children?: ReactNode }) {
  return (
    <div className="rise flex flex-col gap-4 md:flex-row md:items-end md:justify-between mb-8">
      <div>
        <p className="font-mono-ui text-xs uppercase tracking-[0.22em] text-primary">{kicker}</p>
        <h1 className="mt-2 text-3xl md:text-[44px] leading-[1.02] font-extrabold tracking-tight">{title}</h1>
      </div>
      {children && <div className="flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}

export function LoadError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-6">
      <p className="font-bold text-lg">Ruang kerja tidak dapat dimuat.</p>
      <p className="text-muted-foreground mt-1">Periksa koneksi atau sesi Anda, lalu coba lagi.</p>
      <button type="button" onClick={onRetry} data-testid="button-retry" className="mt-4 rounded-lg bg-primary px-4 py-2 font-semibold text-primary-foreground">
        Coba lagi
      </button>
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-72 rounded-lg bg-muted animate-pulse" />
      <div className="h-32 rounded-xl bg-muted animate-pulse" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-36 rounded-xl bg-muted animate-pulse" />
        ))}
      </div>
    </div>
  );
}
