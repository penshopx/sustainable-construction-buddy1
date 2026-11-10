import { useMemo, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  useGetVaultWorkspace,
  getGetVaultWorkspaceQueryKey,
  useCreateVaultFolder,
  useDeleteVaultFolder,
  useUpdateVaultDocument,
  useDeleteVaultDocument,
  useProcessVaultOcr,
  useImportVaultDocument,
  type VaultDocument,
  type VaultFolder,
} from '@workspace/api-client-react';
import { Upload, Link, Search, LayoutGrid, List, Star, MoreHorizontal, FolderPlus, Trash2, Download, Eye, Pencil, FolderInput, FileText, X, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { PageHeader, LoadError, PageSkeleton } from '@/components/app-shell';
import { ACCEPT_ATTR, ALLOWED_EXT, MAX_FILE_BYTES, STATUS_META, downloadUrl, errorMessage, extOf, formatBytes, formatDate, uploadDocument } from '@/lib/vault';
import { cn } from '@/lib/utils';
import { importFilename } from '@/lib/import-filename';

type UploadItem = { key: string; name: string; size: number; state: 'queued' | 'uploading' | 'done' | 'error'; error?: string };

function StatusBadge({ doc }: { doc: VaultDocument }) {
  const m = STATUS_META[doc.status];
  return (
    <span title={m.hint} data-testid={`status-doc-${doc.id}`} className={cn('inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold', m.cls)}>
      {m.label}
    </span>
  );
}

function snippet(text: string, q: string) {
  if (!q) return '';
  const i = text.toLowerCase().indexOf(q.toLowerCase());
  if (i < 0) return '';
  const start = Math.max(0, i - 50);
  return (start > 0 ? '…' : '') + text.slice(start, i + q.length + 70).replace(/\s+/g, ' ') + '…';
}

export default function PortalPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const ws = useGetVaultWorkspace({ query: {
    queryKey: getGetVaultWorkspaceQueryKey(),
    refetchInterval: (q) => q.state.data?.documents.some(d => d.status === 'processing') ? 2000 : 15000,
  } });
  const invalidate = () => qc.invalidateQueries({ queryKey: getGetVaultWorkspaceQueryKey() });

  const [tab, setTab] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [targetFolder, setTargetFolder] = useState<string>('');
  const [dragging, setDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [importOpen, setImportOpen] = useState(false);
  const [importUrl, setImportUrl] = useState('');
  const [importName, setImportName] = useState('');
  const importNameEdited = useRef(false);
  const resetImport = () => {
    setImportUrl('');
    setImportName('');
    setImportError('');
    importNameEdited.current = false;
  };
  const [importFolder, setImportFolder] = useState('');
  const [importError, setImportError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [folderToDelete, setFolderToDelete] = useState<VaultFolder | null>(null);
  const [renameDoc, setRenameDoc] = useState<VaultDocument | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [moveDoc, setMoveDoc] = useState<VaultDocument | null>(null);
  const [moveTarget, setMoveTarget] = useState('');
  const [previewSelection, setPreviewDoc] = useState<VaultDocument | null>(null);
  const [ocrDoc, setOcrDoc] = useState<VaultDocument | null>(null);
  const [ocrConsent, setOcrConsent] = useState(false);
  const [ocrStart, setOcrStart] = useState('1');
  const [ocrEnd, setOcrEnd] = useState('1');
  const rangeStart = Number(ocrStart), rangeEnd = Number(ocrEnd);
  const ocrRangeValid = Number.isSafeInteger(rangeStart) && Number.isSafeInteger(rangeEnd)
    && rangeStart >= 1 && rangeEnd >= rangeStart && rangeEnd <= 100000 && rangeEnd - rangeStart < 30;
  const [ocrRequestError, setOcrRequestError] = useState('');
  const [deleteDoc, setDeleteDoc] = useState<VaultDocument | null>(null);

  const createFolder = useCreateVaultFolder();
  const deleteFolder = useDeleteVaultFolder();
  const updateDoc = useUpdateVaultDocument();
  const removeDoc = useDeleteVaultDocument();
  const processOcr = useProcessVaultOcr();
  const importLink = useImportVaultDocument();

  const data = ws.data;
  const folders = data?.folders ?? [];
  const documents = useMemo(() => data?.documents ?? [], [data]);
  const previewDoc = documents.find(d => d.id === previewSelection?.id) ?? null;
  const folderName = (id: string) => folders.find((f) => f.id === id)?.name ?? 'Tanpa folder';

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return documents
      .filter((d) => (tab === 'all' ? true : tab === 'starred' ? d.starred : d.folderId === tab))
      .filter((d) => !q || d.name.toLowerCase().includes(q) || d.text.toLowerCase().includes(q))
      .sort((a, b) => Number(b.starred) - Number(a.starred) || b.createdAt.localeCompare(a.createdAt));
  }, [documents, tab, query]);

  if (ws.isLoading) return <PageSkeleton />;
  if (ws.isError || !data) return <LoadError onRetry={() => ws.refetch()} />;

  const effectiveTarget = (tab !== 'all' && tab !== 'starred' ? tab : targetFolder) || folders[0]?.id || '';
  const readyCount = documents.filter((d) => d.status === 'ready').length;
  const starredCount = documents.filter((d) => d.starred).length;
  const busy = uploads.some((u) => u.state === 'uploading' || u.state === 'queued');

  async function handleFiles(list: FileList | File[]) {
    const files = Array.from(list);
    if (!files.length || !data) return;
    if (!effectiveTarget) {
      toast({ title: 'Buat folder dulu', description: 'Dokumen perlu disimpan di sebuah folder.', variant: 'destructive' });
      return;
    }
    let remaining = data.limitBytes - data.usedBytes;
    const items: UploadItem[] = [];
    const accepted: { file: File; key: string }[] = [];
    files.forEach((f, i) => {
      const key = `${Date.now()}-${i}-${f.name}`;
      let error: string | undefined;
      if (!ALLOWED_EXT.includes(extOf(f.name))) error = 'Format tidak didukung';
      else if (f.size > MAX_FILE_BYTES) error = 'Melebihi 50 MB per file';
      else if (f.size > remaining) error = 'Sisa kuota 50 MB tidak cukup';
      if (error) items.push({ key, name: f.name, size: f.size, state: 'error', error });
      else {
        remaining -= f.size;
        items.push({ key, name: f.name, size: f.size, state: 'queued' });
        accepted.push({ file: f, key });
      }
    });
    setUploads((u) => [...items, ...u].slice(0, 30));
    for (const { file, key } of accepted) {
      setUploads((u) => u.map((x) => (x.key === key ? { ...x, state: 'uploading' } : x)));
      try {
        await uploadDocument(file, effectiveTarget);
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, state: 'done' } : x)));
      } catch (e) {
        setUploads((u) => u.map((x) => (x.key === key ? { ...x, state: 'error', error: errorMessage(e) } : x)));
      }
      await invalidate();
    }
  }

  function patchDoc(doc: VaultDocument, patch: { name?: string; folderId?: string; starred?: boolean }, done?: () => void, okMsg?: string) {
    updateDoc.mutate(
      { id: doc.id, data: patch },
      {
        onSuccess: () => {
          invalidate();
          done?.();
          if (okMsg) toast({ title: okMsg });
        },
        onError: (e) => toast({ title: 'Gagal memperbarui dokumen', description: errorMessage(e), variant: 'destructive' }),
      },
    );
  }

  const tabs = [
    { id: 'all', name: 'Semua file', count: documents.length },
    { id: 'starred', name: 'Berbintang', count: starredCount },
    ...folders.map((f) => ({ id: f.id, name: f.name, count: f.count })),
  ];
  const currentFolder = folders.find((f) => f.id === tab);

  function OcrAction({ doc }: { doc: VaultDocument }) {
    if (!['PDF', 'PNG', 'JPG', 'JPEG'].includes(doc.type) || doc.status === 'ready') return null;
    return <div className="mt-3 space-y-2">
      {doc.ocrError && <p role="alert" className="text-xs text-amber-200">{doc.ocrError}</p>}
      <Button size="sm" variant="secondary" disabled={doc.status === 'processing'} data-testid={`button-ocr-${doc.id}`}
        onClick={() => { setOcrDoc(doc); setOcrConsent(false); setOcrStart('1'); setOcrEnd('1'); setOcrRequestError(''); }}>
        {doc.status === 'processing' ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Memproses OCR</> : doc.ocrAttemptedAt ? 'Coba ulang OCR' : 'Baca teks dengan OCR'}
      </Button>
    </div>;
  }

  function DocActions({ doc }: { doc: VaultDocument }) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Aksi dokumen" data-testid={`button-doc-menu-${doc.id}`} className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onSelect={() => setPreviewDoc(doc)}><Eye className="h-4 w-4 mr-2" />Pratinjau</DropdownMenuItem>
          <DropdownMenuItem asChild>
            <a href={downloadUrl(doc.id)} download={doc.name}><Download className="h-4 w-4 mr-2" />Unduh</a>
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { setRenameDoc(doc); setRenameValue(doc.name); }}><Pencil className="h-4 w-4 mr-2" />Ganti nama</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => { setMoveDoc(doc); setMoveTarget(doc.folderId); }}><FolderInput className="h-4 w-4 mr-2" />Pindahkan</DropdownMenuItem>
          <DropdownMenuItem onSelect={() => patchDoc(doc, { starred: !doc.starred })}><Star className="h-4 w-4 mr-2" />{doc.starred ? 'Hapus bintang' : 'Beri bintang'}</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setDeleteDoc(doc)}><Trash2 className="h-4 w-4 mr-2" />Hapus permanen</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  function StarBtn({ doc }: { doc: VaultDocument }) {
    return (
      <button type="button" aria-label="Bintang" data-testid={`button-star-${doc.id}`} onClick={() => patchDoc(doc, { starred: !doc.starred })} className={cn('rounded-md p-1.5 hover:bg-accent', doc.starred ? 'text-amber-300' : 'text-muted-foreground')}>
        <Star className="h-4 w-4" fill={doc.starred ? 'currentColor' : 'none'} />
      </button>
    );
  }

  return (
    <div>
      <PageHeader kicker="Ruang Simpan / Dokumen" title="Dokumen tersimpan. Pengetahuan hidup.">
        <Button variant="secondary" onClick={() => setNewFolderOpen(true)} data-testid="button-new-folder"><FolderPlus className="h-4 w-4 mr-2" />Folder baru</Button>
        <Button variant="secondary" disabled={importLink.isPending || !folders.length} data-testid="button-import-link" onClick={() => { setImportFolder(effectiveTarget); setImportError(''); setImportOpen(true); }}><Link className="h-4 w-4 mr-2" />Impor dari tautan</Button>
        <Button onClick={() => fileRef.current?.click()} disabled={busy} data-testid="button-upload"><Upload className="h-4 w-4 mr-2" />Unggah file</Button>
      </PageHeader>

      <input ref={fileRef} type="file" multiple accept={ACCEPT_ATTR} className="hidden" data-testid="input-file" onChange={(e) => { if (e.target.files) handleFiles(e.target.files); e.target.value = ''; }} />

      {/* Stats strip */}
      <div className="rise grid grid-cols-2 md:grid-cols-4 gap-px rounded-xl overflow-hidden border border-border bg-border mb-6" style={{ animationDelay: '60ms' }}>
        {[
          ['Terpakai', `${formatBytes(data.usedBytes)} / ${formatBytes(data.limitBytes)}`],
          ['File', String(documents.length)],
          ['Siap AI', String(readyCount)],
          ['Folder', String(folders.length)],
        ].map(([k, v]) => (
          <div key={k} className="bg-card px-4 py-3">
            <p className="text-xs font-mono-ui uppercase tracking-widest text-muted-foreground">{k}</p>
            <p className="mt-1 text-xl font-bold" data-testid={`text-stat-${k}`}>{v}</p>
          </div>
        ))}
      </div>

      {/* Dropzone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files); }}
        className={cn('rise rounded-2xl border-2 border-dashed p-5 md:p-6 transition-colors mb-6', dragging ? 'border-primary bg-primary/10' : 'border-border bg-card/60')}
        data-testid="dropzone"
        style={{ animationDelay: '120ms' }}
      >
        <div className="flex flex-col md:flex-row md:items-center gap-4">
          <div className="flex-1">
            <p className="text-lg font-bold">Seret beberapa file ke sini</p>
            <p className="text-sm text-muted-foreground mt-1">PDF, DOCX, XLSX, TXT, MD, CSV, JPG, PNG. Maks 50 MiB per file, sesuai sisa total kuota 50 MiB gratis. Teks dokumen dibaca lokal saat unggah. Foto/PDF scan hanya dikirim untuk OCR setelah persetujuan Anda per percobaan. Pilih maksimal 30 halaman PDF; salinan yang dikirim atau gambar maksimal 15 MiB, dengan batas proses 60 detik. Indeks maksimal 100.000 karakter; pembacaan lokal maksimal 150 halaman PDF atau 20 lembar XLSX × 2.000 baris.</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground whitespace-nowrap">Simpan ke</span>
            {tab !== 'all' && tab !== 'starred' ? (
              <span className="rounded-lg bg-ice px-3 py-2 text-sm font-semibold">{currentFolder?.name}</span>
            ) : (
              <Select value={effectiveTarget} onValueChange={setTargetFolder} disabled={!folders.length}>
                <SelectTrigger className="w-48" data-testid="select-upload-folder"><SelectValue placeholder="Pilih folder" /></SelectTrigger>
                <SelectContent>
                  {folders.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}
          </div>
        </div>
        {uploads.length > 0 && (
          <div className="mt-4 space-y-1.5">
            <div className="flex justify-between items-center">
              <p className="text-xs font-mono-ui uppercase tracking-widest text-muted-foreground">Antrean unggah</p>
              {!busy && <button type="button" className="text-xs font-semibold text-primary" onClick={() => setUploads([])} data-testid="button-clear-uploads">Bersihkan</button>}
            </div>
            {uploads.map((u) => (
              <div key={u.key} className="flex items-center gap-3 rounded-lg bg-background/60 px-3 py-2 text-sm">
                {u.state === 'uploading' || u.state === 'queued' ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : u.state === 'done' ? <FileText className="h-4 w-4 text-primary" /> : <X className="h-4 w-4 text-destructive" />}
                <span className="truncate flex-1 font-medium">{u.name}</span>
                <span className="font-mono-ui text-xs text-muted-foreground">{formatBytes(u.size)}</span>
                <span className={cn('text-xs font-semibold', u.state === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
                  {u.state === 'queued' ? 'Menunggu' : u.state === 'uploading' ? 'Mengunggah' : u.state === 'done' ? 'Selesai' : u.error}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Folder tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 -mx-1 px-1">
        {tabs.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)} data-testid={`tab-folder-${t.id}`}
            className={cn('shrink-0 flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors', tab === t.id ? 'bg-ice border-transparent' : 'border-border text-foreground/85 hover:border-primary/60')}>
            {t.name}
            <span className={cn('font-mono-ui text-xs', tab === t.id ? 'opacity-70' : 'text-muted-foreground')}>{t.count}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Cari nama file atau isi dokumen…" className="pl-9 h-11" data-testid="input-search" />
        </div>
        <div className="flex gap-2">
          {currentFolder && (
            <Button variant="ghost" className="text-destructive" onClick={() => setFolderToDelete(currentFolder)} data-testid="button-delete-folder"><Trash2 className="h-4 w-4 mr-2" />Hapus folder</Button>
          )}
          <div className="flex rounded-lg border border-border p-1">
            <button type="button" aria-label="Grid" data-testid="button-view-grid" onClick={() => setView('grid')} className={cn('rounded-md p-2', view === 'grid' ? 'bg-ice' : 'text-muted-foreground')}><LayoutGrid className="h-4 w-4" /></button>
            <button type="button" aria-label="Daftar" data-testid="button-view-list" onClick={() => setView('list')} className={cn('rounded-md p-2', view === 'list' ? 'bg-ice' : 'text-muted-foreground')}><List className="h-4 w-4" /></button>
          </div>
        </div>
      </div>

      {documents.length === 0 ? (
        <div className="rounded-2xl border border-border bg-card p-8 md:p-12 grid md:grid-cols-[1.2fr_1fr] gap-8 items-center" data-testid="empty-workspace">
          <div>
            <p className="font-mono-ui text-xs uppercase tracking-widest text-primary">Ruang kerja masih kosong</p>
            <h2 className="mt-3 text-2xl md:text-3xl font-extrabold leading-tight">Mulai dari satu dokumen yang paling sering Anda cari.</h2>
            <p className="mt-3 text-muted-foreground">Misalnya akta pendirian, SOP, portofolio proyek, atau sertifikat tenaga ahli. Setelah teksnya terbaca, isinya bisa dicari dan ditanyakan ke asisten AI.</p>
            <Button className="mt-6" onClick={() => fileRef.current?.click()} data-testid="button-upload-empty"><Upload className="h-4 w-4 mr-2" />Unggah dokumen pertama</Button>
          </div>
          <ul className="space-y-3 text-sm">
            {(['ready', 'stored', 'failed'] as const).map((s) => (
              <li key={s} className="flex gap-3 items-start rounded-xl bg-background/60 p-3">
                <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold', STATUS_META[s].cls)}>{STATUS_META[s].label}</span>
                <span className="text-foreground/85">{STATUS_META[s].hint}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-10 text-center" data-testid="empty-filter">
          <p className="text-lg font-bold">{query ? `Tidak ada yang cocok dengan “${query}”.` : 'Folder ini belum berisi dokumen.'}</p>
          <p className="text-muted-foreground mt-1">{query ? 'Pencarian memeriksa nama file dan teks yang berhasil dibaca.' : 'Seret file ke area unggah di atas untuk mengisinya.'}</p>
        </div>
      ) : view === 'grid' ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((d, i) => (
            <article key={d.id} data-testid={`card-doc-${d.id}`} className="rise group rounded-xl border border-border bg-card p-4 hover:border-primary/60 transition-colors" style={{ animationDelay: `${Math.min(i, 12) * 30}ms` }}>
              <div className="flex items-start gap-3">
                <div className="h-11 w-9 shrink-0 rounded-md bg-ice grid place-items-center font-mono-ui text-[10px] font-bold uppercase">{extOf(d.name) || 'file'}</div>
                <button type="button" onClick={() => setPreviewDoc(d)} className="min-w-0 flex-1 text-left" data-testid={`button-open-${d.id}`}>
                  <p className="font-semibold leading-snug line-clamp-2 break-words">{d.name}</p>
                  <p className="text-xs text-muted-foreground mt-1">{folderName(d.folderId)}</p>
                </button>
                <StarBtn doc={d} />
                <DocActions doc={d} />
              </div>
              {query && snippet(d.text, query) && <p className="mt-3 text-xs text-foreground/80 bg-primary/10 rounded-md p-2 line-clamp-3">{snippet(d.text, query)}</p>}
              <div className="mt-4 flex items-center gap-2 text-xs">
                <StatusBadge doc={d} />
                <span className="font-mono-ui text-muted-foreground">{formatBytes(d.size)}</span>
                <span className="ml-auto text-muted-foreground">{formatDate(d.createdAt)}</span>
              </div>
              <OcrAction doc={d} />
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border overflow-hidden">
          {filtered.map((d) => (
            <div key={d.id} data-testid={`row-doc-${d.id}`} className="flex items-center gap-3 border-b border-border last:border-0 bg-card px-4 py-3 hover:bg-accent/40">
              <span className="w-10 font-mono-ui text-[10px] font-bold uppercase text-primary">{extOf(d.name)}</span>
              <button type="button" onClick={() => setPreviewDoc(d)} className="min-w-0 flex-1 text-left">
                <p className="truncate font-semibold">{d.name}</p>
                <p className="text-xs text-muted-foreground truncate">{folderName(d.folderId)} · {formatBytes(d.size)} · {formatDate(d.createdAt)}</p>
              </button>
              <OcrAction doc={d} />
              <span className="hidden sm:inline"><StatusBadge doc={d} /></span>
              <StarBtn doc={d} />
              <DocActions doc={d} />
            </div>
          ))}
        </div>
      )}

      <Dialog open={importOpen} onOpenChange={(open) => {
        if (importLink.isPending) return;
        setImportOpen(open);
        if (!open) resetImport();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Impor dokumen dari tautan</DialogTitle>
            <DialogDescription>Gunakan tautan unduh HTTPS langsung yang dapat diakses tanpa login. Tautan privat, jaringan lokal, dan halaman web akan ditolak. Maksimal 15 MiB per file dan sesuai sisa kuota.</DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => {
            e.preventDefault();
            if (importLink.isPending) return;
            setImportError('');
            importLink.mutate({ data: { url: importUrl.trim(), name: importName.trim(), folderId: importFolder } }, {
              onSuccess: (doc) => {
                invalidate(); setTab(doc.folderId); setQuery(''); setImportOpen(false);
                resetImport();
                toast({ title: 'Dokumen berhasil diimpor', description: `${doc.name} tersimpan secara privat.` });
              },
              onError: (err) => setImportError(errorMessage(err)),
            });
          }}>
            <label className="block text-sm space-y-1">
              <span>Tautan file publik</span>
              <Input type="url" required maxLength={8192} autoComplete="off" value={importUrl} onChange={e => {
                setImportUrl(e.target.value);
                if (!importNameEdited.current) setImportName(importFilename(e.target.value));
              }} disabled={importLink.isPending} placeholder="https://contoh.org/dokumen.pdf" data-testid="input-import-url" />
            </label>
            <label className="block text-sm space-y-1">
              <span>Nama file beserta ekstensi</span>
              <Input required maxLength={200} value={importName} onChange={e => {
                importNameEdited.current = true;
                setImportName(e.target.value);
              }} disabled={importLink.isPending} placeholder="dokumen.pdf" aria-describedby="import-name-help" data-testid="input-import-name" />
              <span id="import-name-help" className="block text-xs text-muted-foreground">Nama diisi dari pathname tautan jika aman dan ekstensinya didukung. Anda dapat mengubahnya sebelum impor. Jika kosong, isi nama beserta ekstensi secara manual.</span>
            </label>
            <div className="text-sm space-y-1">
              <span>Folder tujuan</span>
              <Select value={importFolder} onValueChange={setImportFolder} disabled={importLink.isPending}>
                <SelectTrigger aria-label="Folder tujuan impor" data-testid="select-import-folder"><SelectValue placeholder="Pilih folder" /></SelectTrigger>
                <SelectContent>{folders.map(f => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <p className="text-xs text-muted-foreground">File disalin ke penyimpanan privat Anda; tautan asal tidak disimpan. Teks dibaca lokal seperti unggah biasa. OCR eksternal tetap memerlukan persetujuan terpisah.</p>
            {importError && <p role="alert" className="text-sm text-destructive" data-testid="error-import-link">{importError}</p>}
            <DialogFooter>
              <Button type="button" variant="secondary" disabled={importLink.isPending} onClick={() => { setImportOpen(false); resetImport(); }}>Batal</Button>
              <Button type="submit" disabled={importLink.isPending || !importUrl.trim() || !importName.trim() || !importFolder} data-testid="button-confirm-import">
                {importLink.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {importLink.isPending ? 'Mengimpor…' : 'Impor dokumen'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New folder */}
      <Dialog open={newFolderOpen} onOpenChange={(o) => { setNewFolderOpen(o); if (!o) setNewFolderName(''); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Folder baru</DialogTitle><DialogDescription>Kelompokkan dokumen, misalnya Legalitas, Tender, atau SDM.</DialogDescription></DialogHeader>
          <form onSubmit={(e) => {
            e.preventDefault();
            const name = newFolderName.trim();
            if (!name) return;
            createFolder.mutate({ data: { name } }, {
              onSuccess: (f) => { invalidate(); setNewFolderOpen(false); setNewFolderName(''); setTab(f.id); toast({ title: `Folder “${f.name}” dibuat` }); },
              onError: (e2) => toast({ title: 'Gagal membuat folder', description: errorMessage(e2), variant: 'destructive' }),
            });
          }}>
            <Input autoFocus maxLength={80} value={newFolderName} onChange={(e) => setNewFolderName(e.target.value)} placeholder="Nama folder" data-testid="input-folder-name" />
            <DialogFooter className="mt-4"><Button type="submit" disabled={!newFolderName.trim() || createFolder.isPending} data-testid="button-create-folder">Buat folder</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete folder */}
      <AlertDialog open={!!folderToDelete} onOpenChange={(o) => !o && setFolderToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus folder “{folderToDelete?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>{folderToDelete && folderToDelete.count > 0 ? `Folder ini masih berisi ${folderToDelete.count} dokumen. Pindahkan atau hapus dokumennya terlebih dahulu.` : 'Hanya folder kosong yang dapat dihapus.'}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction disabled={!folderToDelete || folderToDelete.count > 0} className="bg-destructive text-destructive-foreground" data-testid="button-confirm-delete-folder"
              onClick={() => folderToDelete && deleteFolder.mutate({ id: folderToDelete.id }, {
                onSuccess: () => { invalidate(); setTab('all'); toast({ title: 'Folder dihapus' }); },
                onError: (e) => toast({ title: 'Folder tidak dapat dihapus', description: errorMessage(e), variant: 'destructive' }),
              })}>Hapus folder</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rename */}
      <Dialog open={!!renameDoc} onOpenChange={(o) => !o && setRenameDoc(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Ganti nama dokumen</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); const v = renameValue.trim(); if (renameDoc && v) patchDoc(renameDoc, { name: v }, () => setRenameDoc(null), 'Nama diperbarui'); }}>
            <Input autoFocus maxLength={200} value={renameValue} onChange={(e) => setRenameValue(e.target.value)} data-testid="input-rename" />
            <DialogFooter className="mt-4"><Button type="submit" disabled={!renameValue.trim() || updateDoc.isPending} data-testid="button-save-rename">Simpan</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Move */}
      <Dialog open={!!moveDoc} onOpenChange={(o) => !o && setMoveDoc(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Pindahkan dokumen</DialogTitle><DialogDescription className="break-words">{moveDoc?.name}</DialogDescription></DialogHeader>
          <Select value={moveTarget} onValueChange={setMoveTarget}>
            <SelectTrigger data-testid="select-move-folder"><SelectValue placeholder="Pilih folder" /></SelectTrigger>
            <SelectContent>{folders.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
          </Select>
          <DialogFooter><Button disabled={!moveTarget || moveTarget === moveDoc?.folderId || updateDoc.isPending} data-testid="button-confirm-move" onClick={() => moveDoc && patchDoc(moveDoc, { folderId: moveTarget }, () => setMoveDoc(null), 'Dokumen dipindahkan')}>Pindahkan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview */}
      <Dialog open={!!previewDoc} onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogContent className="max-w-3xl max-h-[88dvh] flex flex-col">
          {previewDoc && (
            <>
              <DialogHeader>
                <DialogTitle className="break-words pr-6">{previewDoc.name}</DialogTitle>
                <DialogDescription asChild>
                  <div className="flex flex-wrap items-center gap-2 text-sm"><StatusBadge doc={previewDoc} /><span>{folderName(previewDoc.folderId)} · {formatBytes(previewDoc.size)} · {formatDate(previewDoc.createdAt)}</span></div>
                </DialogDescription>
              </DialogHeader>
              <div className="flex-1 overflow-auto rounded-lg border border-border bg-background/70 p-4">
                {previewDoc.text ? (
                  <pre className="whitespace-pre-wrap text-sm leading-relaxed font-mono-ui text-foreground/90" data-testid="text-preview">{previewDoc.text}</pre>
                ) : (
                  <p className="text-muted-foreground">{STATUS_META[previewDoc.status].hint} Unduh file untuk melihat isi aslinya.</p>
                )}
                <OcrAction doc={previewDoc} />
                {previewDoc.ocrAttemptedAt && previewDoc.text && <p className="mt-3 text-xs text-muted-foreground">Teks hasil OCR dapat keliru. Periksa kutipan terhadap file asli sebelum dipakai untuk keputusan penting.</p>}
              </div>
              <DialogFooter>
                <Button asChild variant="secondary"><a href={downloadUrl(previewDoc.id)} download={previewDoc.name} data-testid="link-download-preview"><Download className="h-4 w-4 mr-2" />Unduh</a></Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!ocrDoc} onOpenChange={(open) => { if (!open && !processOcr.isPending) setOcrDoc(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Izinkan OCR dokumen ini?</DialogTitle>
            <DialogDescription className="break-words">{ocrDoc?.name}</DialogDescription>
          </DialogHeader>
          {ocrDoc?.type === 'PDF' && <fieldset className="space-y-2" disabled={processOcr.isPending}>
            <legend className="text-sm font-medium">Pilih halaman sebelum menyetujui OCR</legend>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-sm">Halaman awal<Input type="number" min={1} max={100000} value={ocrStart} data-testid="input-ocr-start" onChange={e => { setOcrStart(e.target.value); setOcrConsent(false); setOcrRequestError(''); }} /></label>
              <label className="text-sm">Halaman akhir<Input type="number" min={1} max={100000} value={ocrEnd} data-testid="input-ocr-end" onChange={e => { setOcrEnd(e.target.value); setOcrConsent(false); setOcrRequestError(''); }} /></label>
            </div>
            <p className="text-xs text-muted-foreground">{ocrRangeValid ? `${rangeEnd - rangeStart + 1} halaman dipilih: ${rangeStart}–${rangeEnd}.` : 'Masukkan rentang valid, maksimal 30 halaman.'} Gunakan nomor urut halaman PDF asli, bukan nomor cetak. Pilih sedikit halaman untuk menghemat biaya dan menghindari hasil terpotong.</p>
          </fieldset>}
          <p className="text-sm">{ocrDoc?.type === 'PDF' ? 'Hanya halaman dalam rentang pilihan, bukan seluruh PDF, akan' : 'Gambar ini akan'} dikirim secara privat ke OpenRouter dan Anthropic Claude Sonnet 4.5 untuk membaca teks. Ini layanan eksternal berbiaya; kebijakan penyedia tetap berlaku. Aplikasi meminta agar data tidak dikumpulkan dan tidak memakai model cadangan. File tidak dijadikan tautan publik.</p>
          <p className="text-sm text-muted-foreground">PDF asli maksimal 50 MiB dirender lokal di server dalam pekerja terisolasi (batas heap 128 MiB, persiapan 15 detik); hanya gambar visual halaman pilihan dalam PDF baru, maksimal 30 halaman dan 15 MiB, yang dikirim. Anotasi, lampiran, dan data tersembunyi PDF tidak disertakan; detail kecil dapat berkurang. Gambar maksimal 15 MiB. Batas proses OCR 60 detik dan hasil 100.000 karakter. File asli dan kuota penyimpanan tidak berubah. Hasil terpotong ditolak; coba rentang lebih kecil dengan persetujuan baru. Tidak ada pengiriman ulang otomatis. Teks baru siap dicari dan ditanya setelah tersimpan; OCR dapat keliru.</p>
          <label className="flex items-start gap-3 text-sm">
            <input type="checkbox" checked={ocrConsent} disabled={processOcr.isPending || (ocrDoc?.type === 'PDF' && !ocrRangeValid)} onChange={e => setOcrConsent(e.target.checked)} data-testid="checkbox-ocr-consent" className="mt-1" />
            Saya menyetujui pengiriman {ocrDoc?.type === 'PDF' ? `halaman asli ${ocrStart}–${ocrEnd} saja` : 'gambar ini'} ke OpenRouter dan Anthropic untuk satu percobaan OCR.
          </label>
          {ocrRequestError && <p role="alert" className="text-sm text-destructive">{ocrRequestError}</p>}
          <DialogFooter>
            <Button variant="secondary" disabled={processOcr.isPending} onClick={() => setOcrDoc(null)}>Batal</Button>
            <Button disabled={!ocrConsent || processOcr.isPending || (ocrDoc?.type === 'PDF' && !ocrRangeValid)} data-testid="button-confirm-ocr" onClick={() => {
              if (!ocrDoc || !ocrConsent || (ocrDoc.type === 'PDF' && !ocrRangeValid)) return;
              processOcr.mutate({ id: ocrDoc.id, data: { consent: true, provider: 'openrouter-anthropic-v1', ...(ocrDoc.type === 'PDF' ? { pageRange: { start: rangeStart, end: rangeEnd } } : {}) } }, {
                onSuccess: () => { setOcrDoc(null); invalidate(); toast({ title: 'OCR dimulai', description: 'Status akan diperbarui setelah teks tersimpan.' }); },
                onError: e => { setOcrConsent(false); setOcrRequestError(errorMessage(e)); invalidate(); },
              });
            }}>{processOcr.isPending ? 'Memulai…' : 'Izinkan dan proses OCR'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete doc */}
      <AlertDialog open={!!deleteDoc} onOpenChange={(o) => !o && setDeleteDoc(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus dokumen secara permanen?</AlertDialogTitle>
            <AlertDialogDescription className="break-words">“{deleteDoc?.name}” beserta teks terindeksnya akan dihapus dan tidak dapat dipulihkan.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive text-destructive-foreground" data-testid="button-confirm-delete-doc"
              onClick={() => deleteDoc && removeDoc.mutate({ id: deleteDoc.id }, {
                onSuccess: () => { invalidate(); toast({ title: 'Dokumen dihapus' }); },
                onError: (e) => toast({ title: 'Gagal menghapus', description: errorMessage(e), variant: 'destructive' }),
              })}>Hapus permanen</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
