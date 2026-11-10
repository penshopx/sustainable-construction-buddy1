import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetVaultWorkspace,
  getGetVaultWorkspaceQueryKey,
  useUpdateVaultProfile,
  useCreateVaultConnection,
  useRevokeVaultConnection,
  type VaultConnection,
  type VaultConnectionInputScopesItem,
} from '@workspace/api-client-react';
import { KeyRound, Copy, Check, ShieldCheck, RefreshCw, AlertTriangle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, LoadError, PageSkeleton } from '@/components/app-shell';
import { errorMessage, errorStatus, formatDate } from '@/lib/vault';
import { cn } from '@/lib/utils';

const SCOPES: { id: VaultConnectionInputScopesItem; label: string; hint: string }[] = [
  { id: 'profile:read', label: 'Baca profil', hint: 'Aplikasi dapat membaca profil resmi.' },
  { id: 'profile:write', label: 'Ubah profil', hint: 'Aplikasi dapat memperbarui profil. Berikan hanya bila perlu.' },
  { id: 'documents:read', label: 'Baca dokumen', hint: 'Metadata dan unduhan untuk dokumen/folder terpilih.' },
  { id: 'documents:upload', label: 'Unggah dokumen', hint: 'Mengunggah ke folder terpilih.' },
];
const scopeLabel = (s: string) => SCOPES.find((x) => x.id === s)?.label ?? s;

function connState(c: VaultConnection) {
  if (c.revoked) return { label: 'Dicabut', cls: 'text-muted-foreground border-border' };
  if (new Date(c.expiresAt).getTime() < Date.now()) return { label: 'Kedaluwarsa', cls: 'text-amber-200 border-amber-400/40' };
  return { label: 'Aktif', cls: 'text-sky-200 border-sky-400/50 bg-sky-400/10' };
}

export default function ProfilePage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const ws = useGetVaultWorkspace();
  const invalidate = () => qc.invalidateQueries({ queryKey: getGetVaultWorkspaceQueryKey() });
  const saveProfile = useUpdateVaultProfile();
  const createConn = useCreateVaultConnection();
  const revokeConn = useRevokeVaultConnection();

  const [profile, setProfile] = useState({ name: '', nib: '', address: '', version: 0 });
  const [conflict, setConflict] = useState(false);
  const inited = useRef(false);

  const [conn, setConn] = useState({ name: '', scopes: ['profile:read'] as VaultConnectionInputScopesItem[], documentIds: [] as string[], folderIds: [] as string[] });
  const [secret, setSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [toRevoke, setToRevoke] = useState<VaultConnection | null>(null);

  useEffect(() => {
    if (ws.data && !inited.current) {
      inited.current = true;
      setProfile({ ...ws.data.profile });
    }
  }, [ws.data]);

  if (ws.isLoading) return <PageSkeleton />;
  if (ws.isError || !ws.data) return <LoadError onRetry={() => ws.refetch()} />;
  const { folders, documents, connections } = ws.data;
  const activeCount = connections.filter((c) => connState(c).label === 'Aktif').length;
  const needsDocs = conn.scopes.includes('documents:read') || conn.scopes.includes('documents:upload');

  async function reloadProfile() {
    const res = await ws.refetch();
    if (res.data) setProfile({ ...res.data.profile });
    setConflict(false);
  }

  function submitProfile(e: React.FormEvent) {
    e.preventDefault();
    saveProfile.mutate({ data: profile }, {
      onSuccess: (p) => { setProfile({ ...p }); setConflict(false); invalidate(); toast({ title: 'Profil disimpan', description: `Versi data ${p.version}` }); },
      onError: (err) => {
        if (errorStatus(err) === 409) setConflict(true);
        else toast({ title: 'Gagal menyimpan profil', description: errorMessage(err), variant: 'destructive' });
      },
    });
  }

  function submitConn(e: React.FormEvent) {
    e.preventDefault();
    if (!conn.name.trim() || !conn.scopes.length) return;
    createConn.mutate({ data: { name: conn.name.trim(), scopes: conn.scopes, documentIds: needsDocs ? conn.documentIds : [], folderIds: needsDocs ? conn.folderIds : [] } }, {
      onSuccess: (res) => { setSecret(res.token); setCopied(false); setConn({ name: '', scopes: ['profile:read'], documentIds: [], folderIds: [] }); invalidate(); },
      onError: (err) => toast({ title: 'Gagal membuat token', description: errorMessage(err), variant: 'destructive' }),
    });
  }

  const toggle = <T,>(arr: T[], v: T, on: boolean) => (on ? [...arr, v] : arr.filter((x) => x !== v));

  return (
    <div>
      <PageHeader kicker="Ruang Simpan / Profil & Akses" title="Satu profil resmi, akses yang terukur." />

      <div className="grid xl:grid-cols-[1fr_1.15fr] gap-6 items-start">
        <form onSubmit={submitProfile} className="rise rounded-2xl border border-border bg-card p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold">Profil resmi perusahaan</h2>
              <p className="text-sm text-muted-foreground mt-1">Acuan bersama untuk aplikasi tepercaya. Setiap penyimpanan diperiksa versinya agar pembaruan tidak saling menimpa.</p>
            </div>
            <span className="shrink-0 font-mono-ui text-xs rounded-full bg-ice px-3 py-1" data-testid="text-profile-version">v{profile.version}</span>
          </div>
          {conflict && (
            <div className="rounded-xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm" data-testid="alert-conflict">
              <p className="font-bold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-300" />Profil sudah diubah di tempat lain.</p>
              <p className="mt-1 text-foreground/85">Perubahan Anda belum disimpan. Muat ulang versi terbaru, lalu terapkan kembali perubahan Anda.</p>
              <Button type="button" size="sm" variant="secondary" className="mt-3" onClick={reloadProfile} data-testid="button-reload-profile"><RefreshCw className="h-4 w-4 mr-2" />Muat ulang profil</Button>
            </div>
          )}
          <div><label className="text-sm font-semibold">Nama badan usaha</label><Input className="mt-1" maxLength={200} value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} placeholder="PT …" data-testid="input-profile-name" /></div>
          <div><label className="text-sm font-semibold">NIB <span className="text-muted-foreground font-normal">Nomor Induk Berusaha</span></label><Input className="mt-1 font-mono-ui" maxLength={40} value={profile.nib} onChange={(e) => setProfile({ ...profile, nib: e.target.value })} data-testid="input-profile-nib" /></div>
          <div><label className="text-sm font-semibold">Alamat perusahaan</label><Textarea className="mt-1" rows={3} maxLength={1000} value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} data-testid="input-profile-address" /></div>
          <Button type="submit" disabled={saveProfile.isPending || conflict} data-testid="button-save-profile">{saveProfile.isPending ? 'Menyimpan…' : 'Simpan profil'}</Button>
        </form>

        <div className="space-y-6">
          <form onSubmit={submitConn} className="rise rounded-2xl border border-border bg-card p-6 space-y-4" style={{ animationDelay: '80ms' }}>
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2"><KeyRound className="h-5 w-5 text-primary" />Hubungkan aplikasi eksternal</h2>
              <p className="text-sm text-muted-foreground mt-1">Buat token terpisah untuk setiap aplikasi. Token berlaku 90 hari, hanya ditampilkan sekali, dan harus disimpan di server aplikasi — bukan di browser atau kode publik.</p>
            </div>
            <div><label className="text-sm font-semibold">Nama aplikasi</label><Input className="mt-1" maxLength={100} value={conn.name} onChange={(e) => setConn({ ...conn, name: e.target.value })} placeholder="Contoh: Portal Proyek" data-testid="input-connection-name" /></div>
            <div className="grid sm:grid-cols-2 gap-2">
              {SCOPES.map((s) => (
                <label key={s.id} className={cn('flex gap-3 rounded-xl border p-3 cursor-pointer text-sm', conn.scopes.includes(s.id) ? 'border-primary bg-primary/10' : 'border-border')}>
                  <Checkbox checked={conn.scopes.includes(s.id)} onCheckedChange={(v) => setConn({ ...conn, scopes: toggle(conn.scopes, s.id, v === true) })} className="mt-0.5" data-testid={`checkbox-scope-${s.id}`} />
                  <span><b>{s.label}</b><span className="block text-muted-foreground text-xs mt-0.5">{s.hint}</span></span>
                </label>
              ))}
            </div>
            {needsDocs && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-sm font-semibold mb-1.5">Folder <span className="text-muted-foreground font-normal">({conn.folderIds.length})</span></p>
                  <div className="max-h-44 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                    {folders.length === 0 ? <p className="p-3 text-sm text-muted-foreground">Belum ada folder.</p> : folders.map((f) => (
                      <label key={f.id} className="flex items-center gap-2 p-2 text-sm cursor-pointer">
                        <Checkbox checked={conn.folderIds.includes(f.id)} onCheckedChange={(v) => setConn({ ...conn, folderIds: toggle(conn.folderIds, f.id, v === true) })} data-testid={`checkbox-conn-folder-${f.id}`} />
                        <span className="truncate">{f.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold mb-1.5">Dokumen <span className="text-muted-foreground font-normal">({conn.documentIds.length})</span></p>
                  <div className="max-h-44 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                    {documents.length === 0 ? <p className="p-3 text-sm text-muted-foreground">Belum ada dokumen.</p> : documents.map((d) => (
                      <label key={d.id} className="flex items-center gap-2 p-2 text-sm cursor-pointer">
                        <Checkbox checked={conn.documentIds.includes(d.id)} onCheckedChange={(v) => setConn({ ...conn, documentIds: toggle(conn.documentIds, d.id, v === true) })} data-testid={`checkbox-conn-doc-${d.id}`} />
                        <span className="truncate">{d.name}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <p className="sm:col-span-2 text-xs text-muted-foreground">Akses dokumen tidak diberikan otomatis: hanya folder dan dokumen yang dicentang.</p>
              </div>
            )}
            <Button type="submit" disabled={!conn.name.trim() || !conn.scopes.length || createConn.isPending} data-testid="button-create-connection">{createConn.isPending ? 'Membuat…' : 'Buat token akses'}</Button>
          </form>

          <section className="rounded-2xl border border-border bg-card p-6">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold">Aplikasi terhubung</h2>
              <span className="text-sm font-mono-ui text-muted-foreground">{activeCount} aktif</span>
            </div>
            {connections.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground" data-testid="empty-connections">Belum ada aplikasi yang terhubung. Data Anda hanya bisa diakses melalui akun ini.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {[...connections].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((c) => {
                  const st = connState(c);
                  return (
                    <li key={c.id} className={cn('rounded-xl border border-border p-4', c.revoked && 'opacity-60')} data-testid={`row-connection-${c.id}`}>
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="font-bold flex items-center gap-2 flex-wrap">{c.name}<span className={cn('text-[11px] rounded-full border px-2 py-0.5', st.cls)}>{st.label}</span></p>
                          <p className="text-sm text-foreground/85 mt-1">Izin: {c.scopes.map(scopeLabel).join(', ')}</p>
                          {(c.documentIds.length > 0 || c.folderIds.length > 0) && <p className="text-xs text-muted-foreground mt-1">{c.documentIds.length} file · {c.folderIds.length} folder dipilih</p>}
                          <p className="text-xs text-muted-foreground mt-1 font-mono-ui">Dibuat {formatDate(c.createdAt)} · Berakhir {formatDate(c.expiresAt)}</p>
                        </div>
                        {!c.revoked && <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setToRevoke(c)} data-testid={`button-revoke-${c.id}`}>Cabut akses</Button>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>

      <Dialog open={!!secret} onOpenChange={(o) => { if (!o) setSecret(null); }}>
        <DialogContent onInteractOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Salin token sekarang</DialogTitle>
            <DialogDescription>Token ini hanya ditampilkan sekali dan tidak dapat dilihat lagi. Simpan di server aplikasi Anda.</DialogDescription>
          </DialogHeader>
          <div className="rounded-lg bg-ice p-3 font-mono-ui text-sm break-all select-all" data-testid="text-token">{secret}</div>
          <DialogFooter className="gap-2">
            <Button variant="secondary" data-testid="button-copy-token" onClick={async () => { if (secret) { try { await navigator.clipboard.writeText(secret); setCopied(true); } catch { toast({ title: 'Salin manual', description: 'Browser menolak akses clipboard.', variant: 'destructive' }); } } }}>
              {copied ? <Check className="h-4 w-4 mr-2" /> : <Copy className="h-4 w-4 mr-2" />}{copied ? 'Tersalin' : 'Salin token'}
            </Button>
            <Button onClick={() => setSecret(null)} data-testid="button-close-token">Saya sudah menyimpannya</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toRevoke} onOpenChange={(o) => !o && setToRevoke(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Cabut akses “{toRevoke?.name}”?</AlertDialogTitle><AlertDialogDescription>Token langsung berhenti berfungsi. Aplikasi perlu token baru untuk terhubung kembali.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" data-testid="button-confirm-revoke" onClick={() => toRevoke && revokeConn.mutate({ id: toRevoke.id }, {
              onSuccess: () => { invalidate(); toast({ title: 'Akses dicabut' }); },
              onError: (err) => toast({ title: 'Gagal mencabut', description: errorMessage(err), variant: 'destructive' }),
            })}>Cabut akses</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
