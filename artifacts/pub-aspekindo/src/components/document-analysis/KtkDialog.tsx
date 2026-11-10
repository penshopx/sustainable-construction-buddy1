import { useEffect, useRef, useState } from "react";
import { FileDown, Loader2 } from "lucide-react";
import type { DocumentAnalysis } from "@workspace/api-client-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ktkReadiness, validateKtkAgency } from "@/lib/ktkReadiness";

export default function KtkDialog({ analysis, onClose }: { analysis: DocumentAnalysis | null; onClose: () => void }) {
  const [agency, setAgency] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  useEffect(() => {
    generation.current++;
    setAgency(""); setError(""); setBusy(false);
    return () => { generation.current++; };
  }, [analysis?.id]);
  const generate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!analysis || busy) return;
    const attempt = generation.current;
    try {
      const name = validateKtkAgency(agency);
      setBusy(true); setError("");
      const { downloadKtkPdf } = await import("@/lib/ktkPdf");
      if (attempt !== generation.current) return;
      await downloadKtkPdf(analysis, name);
      if (attempt !== generation.current) return;
      toast.success("Knowledge Transfer Kit berhasil dibuat.");
      onClose();
    } catch (cause) {
      if (attempt === generation.current) setError(cause instanceof Error ? cause.message : "PDF belum berhasil dibuat. Coba lagi.");
    } finally { if (attempt === generation.current) setBusy(false); }
  };
  return <Dialog open={!!analysis} onOpenChange={open => { if (!open && !busy) onClose(); }}>
    <DialogContent className="max-w-lg" aria-busy={busy}>
      <DialogHeader>
        <DialogTitle>Generate Knowledge Transfer Kit</DialogTitle>
        <DialogDescription>PDF ringkasan siap kirim ke klien, berisi status kesiapan, risiko, dan action plan dalam bahasa yang mudah dipahami.</DialogDescription>
      </DialogHeader>
      <form onSubmit={generate} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="ktk-agency">Nama Biro Jasa / Konsultan Anda</Label>
          <Input id="ktk-agency" value={agency} onChange={e => setAgency(e.target.value)} required maxLength={120}
            disabled={busy} placeholder="Contoh: CV Maju Konsultan Konstruksi" aria-describedby="ktk-agency-help" data-testid="input-ktk-agency" />
          <p id="ktk-agency-help" className="text-xs text-muted-foreground">Akan tercetak di header dan footer setiap halaman PDF.</p>
        </div>
        <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm">
          <p className="font-semibold">PDF akan berisi:</p>
          <ul className="mt-2 list-disc space-y-2 pl-5">
            <li>Status kesiapan dokumen: hijau, kuning, atau merah</li>
            <li>Ringkasan eksekutif singkat</li>
            <li>Catatan risiko dan regulasi relevan</li>
            <li>Action plan langkah-langkah yang perlu klien lakukan</li>
          </ul>
        </div>
        {analysis && <p className="text-xs text-muted-foreground">Indikator saat ini: <strong>{ktkReadiness(analysis).label}</strong>. Hanya berdasarkan temuan tersimpan, bukan keputusan resmi. PDF dibuat di perangkat Anda tanpa permintaan AI baru; chat privat tidak disertakan.</p>}
        {error && <p role="alert" className="text-sm text-destructive" data-testid="text-ktk-error">{error}</p>}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={busy} data-testid="button-cancel-ktk">Batal</Button>
          <Button type="submit" disabled={busy || !agency.trim()} data-testid="button-generate-ktk">
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
            {busy ? "Membuat PDF..." : "Generate PDF"}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}
