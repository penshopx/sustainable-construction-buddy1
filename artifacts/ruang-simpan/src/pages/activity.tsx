import { useGetVaultWorkspace } from '@workspace/api-client-react';
import { History } from 'lucide-react';
import { PageHeader, LoadError, PageSkeleton } from '@/components/app-shell';
import { formatDate, formatTime } from '@/lib/vault';

export default function ActivityPage() {
  const ws = useGetVaultWorkspace();
  if (ws.isLoading) return <PageSkeleton />;
  if (ws.isError || !ws.data) return <LoadError onRetry={() => ws.refetch()} />;
  const acts = [...ws.data.activities].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const groups: { day: string; items: typeof acts }[] = [];
  for (const a of acts) {
    const day = formatDate(a.createdAt);
    const g = groups[groups.length - 1];
    if (g && g.day === day) g.items.push(a);
    else groups.push({ day, items: [a] });
  }

  return (
    <div>
      <PageHeader kicker="Ruang Simpan / Aktivitas" title="Jejak audit ruang kerja." />
      {acts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center" data-testid="empty-activity">
          <History className="h-10 w-10 mx-auto text-primary" />
          <p className="mt-3 text-lg font-bold">Belum ada aktivitas tercatat.</p>
          <p className="text-muted-foreground mt-1">Unggahan, perubahan profil, dan pemberian akses aplikasi akan tercatat di sini.</p>
        </div>
      ) : (
        <div className="space-y-8 max-w-3xl">
          {groups.map((g) => (
            <section key={g.day}>
              <p className="font-mono-ui text-xs uppercase tracking-widest text-primary mb-3">{g.day}</p>
              <ol className="relative border-l border-border ml-2">
                {g.items.map((a) => (
                  <li key={a.id} className="pl-6 pb-4 relative" data-testid={`row-activity-${a.id}`}>
                    <span className="absolute -left-[5px] top-2 h-2.5 w-2.5 rounded-full bg-primary" />
                    <div className="rounded-lg bg-card border border-border px-4 py-3 flex gap-4 items-baseline">
                      <span className="font-mono-ui text-xs text-muted-foreground w-12 shrink-0">{formatTime(a.createdAt)}</span>
                      <span className="text-[15px] break-words">{a.action}</span>
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
