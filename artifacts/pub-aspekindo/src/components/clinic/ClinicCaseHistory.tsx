import { useState } from "react";
import { Button } from "@/components/ui/button";
import { clinicErrorMessage, useClinicCaseHistory } from "@/hooks/useClinicCases";
import { CASE_STATUS_LABEL, formatClinicDate } from "./clinicUi";

export default function ClinicCaseHistory({ caseId }: { caseId: string }) {
  const [open, setOpen] = useState(false);
  const history = useClinicCaseHistory(caseId, open);
  return (
    <div className="mt-3 border-t border-border pt-2">
      <Button type="button" size="sm" variant="ghost" aria-expanded={open} onClick={() => setOpen(!open)}>
        {open ? "Tutup riwayat" : "Lihat riwayat balasan dan status"}
      </Button>
      {open && (
        <div className="mt-2 space-y-2" aria-label="Riwayat balasan dan status">
          <Button type="button" size="sm" variant="outline" disabled={history.isFetching} onClick={() => history.refetch()}>Muat ulang riwayat</Button>
          {history.isLoading ? <p className="text-xs">Memuat riwayat…</p> : history.isError ? (
            <p role="alert" className="text-xs text-destructive">{clinicErrorMessage(history.error, "Riwayat belum dapat dimuat. Silakan coba lagi.")}</p>
          ) : (
            <ol className="space-y-2">
              {(history.data ?? []).map(entry => (
                <li key={entry.id} className="rounded border border-border p-2 text-xs">
                  <p className="font-semibold">Revisi {entry.revision} · {CASE_STATUS_LABEL[entry.status]}</p>
                  <p className="text-muted-foreground">{formatClinicDate(entry.createdAt)}</p>
                  <p className="break-all text-muted-foreground">{entry.actorId ? `Pengubah: ${entry.actorId}` : "Catatan lama · identitas pengubah tidak tersedia"}</p>
                  <p className="mt-1 whitespace-pre-wrap break-words">{entry.operatorReply || "Belum ada balasan."}</p>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}
