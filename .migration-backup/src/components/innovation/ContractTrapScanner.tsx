import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { FileSearch, AlertTriangle, CheckCircle } from "lucide-react";

const TRAPS = [
  { id: "penalty", label: "Penalti keterlambatan tidak proporsional (>1‰/hari)", severity: "high" },
  { id: "retention", label: "Retensi > 5% dari nilai kontrak", severity: "high" },
  { id: "force-majeure", label: "Klausul force majeure sangat sempit/terbatas", severity: "high" },
  { id: "payment-delay", label: "Termin pembayaran > 60 hari", severity: "high" },
  { id: "design-risk", label: "Risiko desain dibebankan ke kontraktor", severity: "medium" },
  { id: "indemnity", label: "Klausul indemnity berlebihan / tanpa batas", severity: "high" },
  { id: "escalation", label: "Tidak ada klausul eskalasi harga material", severity: "medium" },
  { id: "vo-procedure", label: "Prosedur VO rumit / memerlukan persetujuan multi-level", severity: "medium" },
  { id: "liquidated", label: "Liquidated damages tanpa cap maksimal", severity: "high" },
  { id: "termination", label: "Hak terminasi sepihak oleh owner tanpa kompensasi", severity: "high" },
  { id: "insurance", label: "Beban asuransi seluruhnya di kontraktor", severity: "low" },
  { id: "defect-period", label: "Masa pemeliharaan > 12 bulan", severity: "medium" },
  { id: "scope-creep", label: "Ruang lingkup pekerjaan tidak didefinisikan jelas", severity: "medium" },
  { id: "dispute", label: "Mekanisme penyelesaian sengketa tidak jelas", severity: "low" },
  { id: "subcon", label: "Pembatasan berlebihan untuk sub-kontraktor", severity: "low" },
];

export default function ContractTrapScanner() {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setChecked(next);
  };

  const highCount = TRAPS.filter(t => checked.has(t.id) && t.severity === "high").length;
  const medCount = TRAPS.filter(t => checked.has(t.id) && t.severity === "medium").length;
  const riskLevel = highCount >= 3 ? "Sangat Berisiko" : highCount >= 1 ? "Berisiko" : medCount >= 2 ? "Perlu Perhatian" : "Relatif Aman";

  return (
    <div className="space-y-6">
      <Card className="border-rose-500/30 bg-gradient-to-br from-rose-50/50 to-background dark:from-rose-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileSearch className="w-5 h-5 text-rose-600" /> Contract Trap Scanner
          </CardTitle>
          <p className="text-sm text-muted-foreground">Checklist klausul kontrak berbahaya. Centang yang ditemukan di kontrak Anda.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {TRAPS.map(t => (
            <label key={t.id} className={`flex items-start gap-3 p-2 rounded-lg cursor-pointer hover:bg-muted/50 transition ${checked.has(t.id) ? "bg-destructive/5" : ""}`}>
              <Checkbox checked={checked.has(t.id)} onCheckedChange={() => toggle(t.id)} className="mt-0.5" />
              <div className="flex-1">
                <span className="text-sm">{t.label}</span>
                <Badge variant="outline" className={`ml-2 text-[10px] ${t.severity === "high" ? "border-destructive text-destructive" : t.severity === "medium" ? "border-amber-500 text-amber-600" : ""}`}>
                  {t.severity === "high" ? "Tinggi" : t.severity === "medium" ? "Sedang" : "Rendah"}
                </Badge>
              </div>
            </label>
          ))}
        </CardContent>
      </Card>

      {checked.size > 0 && (
        <Card className={highCount >= 3 ? "border-destructive/40" : ""}>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              {highCount >= 1 ? <AlertTriangle className="w-8 h-8 text-destructive" /> : <CheckCircle className="w-8 h-8 text-emerald-600" />}
              <div>
                <p className="font-bold text-lg">{riskLevel}</p>
                <p className="text-sm text-muted-foreground">{checked.size} klausul berbahaya ditemukan ({highCount} tinggi, {medCount} sedang)</p>
                {highCount >= 3 && <p className="text-sm text-destructive mt-1 font-medium">⚠️ Pertimbangkan ulang untuk ikut tender ini, atau negosiasikan klausul berisiko tinggi.</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
