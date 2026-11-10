import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ClipboardCheck, AlertCircle, CheckCircle2 } from "lucide-react";

const DOC_ITEMS = [
  { id: "ba-serah", label: "BA Serah Terima Pertama (PHO)", critical: true },
  { id: "ba-final", label: "BA Serah Terima Kedua (FHO)", critical: true },
  { id: "as-built", label: "As-Built Drawing lengkap", critical: true },
  { id: "manual", label: "Manual operasi & pemeliharaan", critical: false },
  { id: "warranty", label: "Sertifikat garansi peralatan", critical: false },
  { id: "testing", label: "Laporan testing & commissioning", critical: true },
  { id: "insurance", label: "Klaim asuransi diselesaikan", critical: false },
  { id: "subcon-settle", label: "Settlement subkontraktor selesai", critical: true },
  { id: "retention-doc", label: "Dokumen pencairan retensi", critical: true },
  { id: "defect-list", label: "Snag/defect list ditandatangani", critical: true },
  { id: "photo-final", label: "Dokumentasi foto akhir proyek", critical: false },
  { id: "financial-close", label: "Laporan keuangan final proyek", critical: true },
];

export default function FinalAccountChecker() {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setChecked(next);
  };

  const criticalMissing = DOC_ITEMS.filter(d => d.critical && !checked.has(d.id));
  const score = Math.round((checked.size / DOC_ITEMS.length) * 100);
  const ready = criticalMissing.length === 0;

  return (
    <div className="space-y-6">
      <Card className="border-violet-500/30 bg-gradient-to-br from-violet-50/50 to-background dark:from-violet-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><ClipboardCheck className="w-5 h-5 text-violet-600" /> Final Account Checker</CardTitle>
          <p className="text-sm text-muted-foreground">Pastikan semua dokumen penutupan proyek lengkap sebelum final account.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {DOC_ITEMS.map(d => (
            <label key={d.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-muted/50 ${checked.has(d.id) ? "bg-emerald-50 dark:bg-emerald-950/20" : ""}`}>
              <Checkbox checked={checked.has(d.id)} onCheckedChange={() => toggle(d.id)} />
              <span className="text-sm flex-1">{d.label}</span>
              {d.critical && <Badge variant="outline" className="text-[10px] border-destructive text-destructive">Wajib</Badge>}
            </label>
          ))}
        </CardContent>
      </Card>
      <Card><CardContent className="pt-6 space-y-3">
        <div className="text-center">
          <p className={`text-4xl font-bold ${ready ? "text-emerald-600" : "text-amber-600"}`}>{score}%</p>
          <Badge className={ready ? "bg-emerald-600" : "bg-amber-500"}>{ready ? "Siap Final Account" : "Belum Lengkap"}</Badge>
        </div>
        {criticalMissing.length > 0 && (
          <div className="space-y-1">
            <p className="text-sm font-semibold flex items-center gap-1"><AlertCircle className="w-4 h-4 text-destructive" /> Dokumen wajib belum lengkap:</p>
            {criticalMissing.map((d, i) => (
              <p key={i} className="text-sm p-2 rounded bg-destructive/5 text-destructive">❌ {d.label}</p>
            ))}
          </div>
        )}
        {ready && <p className="text-sm text-emerald-600 text-center flex items-center gap-1 justify-center"><CheckCircle2 className="w-4 h-4" /> Semua dokumen kritis lengkap!</p>}
      </CardContent></Card>
    </div>
  );
}
