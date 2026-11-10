import { RefreshCw } from "lucide-react";
import { usePubWorkspaceSummary } from "@/hooks/usePubWorkspace";

export default function VaultReferencePanel() {
  const workspace = usePubWorkspaceSummary();
  if (!workspace.userId) return null;
  const data = workspace.data;
  return (
    <section className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm" aria-label="Acuan utama Ruang Simpan" data-testid="vault-reference-panel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <a href="/ruang-simpan/user-portal" className="font-semibold text-primary underline">Ruang Simpan · sumber data utama PUB</a>
        <button type="button" disabled={workspace.isFetching} onClick={() => void workspace.refetch()}
          className="inline-flex items-center gap-1 text-xs text-foreground disabled:opacity-50">
          <RefreshCw className={`h-3 w-3 ${workspace.isFetching ? "animate-spin" : ""}`} /> Muat ulang acuan
        </button>
      </div>
      <div aria-live="polite" className="mt-2">
        {workspace.isError ? <p role="alert">Acuan belum dapat dimuat. Data lama tidak ditampilkan; muat ulang untuk memeriksa sumber terbaru.</p>
          : !data ? <p>Memuat ringkasan acuan milik akun Anda…</p>
          : <p><a href="/ruang-simpan/profile" className="underline">{data.profile.name || "Profil perusahaan belum diisi"}</a>
            {" · "}profil v{data.profile.version}{" · "}{data.readyDocumentCount}/{data.documentCount} dokumen memiliki teks siap AI.
            <span className="block mt-1 text-xs text-muted-foreground">Diperiksa {new Date(data.checkedAt).toLocaleTimeString("id-ID")}. Pembaruan diperiksa berkala dan saat kembali ke halaman.</span></p>}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">Profil dan dokumen dikelola sekali di Ruang Simpan. Konteks privat hanya dikirim ke AI sesuai persetujuan pada fitur ini. Jawaban dan laporan terdahulu adalah catatan saat dibuat, bukan pembaruan otomatis.</p>
    </section>
  );
}
