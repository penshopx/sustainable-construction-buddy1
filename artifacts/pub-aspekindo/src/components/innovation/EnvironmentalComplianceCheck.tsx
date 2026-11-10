import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Droplets, CheckCircle } from "lucide-react";

const CHECKLIST = [
  { id: "b3-log", label: "Log pengelolaan limbah B3 harian", category: "Limbah" },
  { id: "b3-storage", label: "TPS limbah B3 sesuai standar", category: "Limbah" },
  { id: "dust-water", label: "Penyiraman debu berkala (2x/hari)", category: "Debu" },
  { id: "dust-barrier", label: "Hoarding/barrier debu terpasang", category: "Debu" },
  { id: "noise-limit", label: "Jam kerja bising dibatasi (08-17)", category: "Kebisingan" },
  { id: "noise-barrier", label: "Sound barrier di area sensitif", category: "Kebisingan" },
  { id: "transport-log", label: "Log pengangkutan material lengkap", category: "Transport" },
  { id: "transport-cover", label: "Truk material ditutup terpal", category: "Transport" },
  { id: "amdal", label: "Dokumen UKL-UPL/AMDAL lengkap", category: "Dokumen" },
  { id: "monthly-report", label: "Laporan lingkungan bulanan", category: "Dokumen" },
  { id: "photo-doc", label: "Dokumentasi foto kondisi lingkungan", category: "Dokumen" },
  { id: "erosion", label: "Pengendalian erosi & sedimentasi", category: "Air" },
  { id: "wastewater", label: "Pengelolaan air limbah konstruksi", category: "Air" },
  { id: "community", label: "Sosialisasi lingkungan ke warga", category: "Sosial" },
];

export default function EnvironmentalComplianceCheck() {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setChecked(next);
  };

  const score = Math.round((checked.size / CHECKLIST.length) * 100);
  const categories = [...new Set(CHECKLIST.map(c => c.category))];

  return (
    <div className="space-y-6">
      <Card className="border-teal-500/30 bg-gradient-to-br from-teal-50/50 to-background dark:from-teal-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Droplets className="w-5 h-5 text-teal-600" /> Environmental Compliance Check</CardTitle>
          <p className="text-sm text-muted-foreground">Checklist kepatuhan lingkungan proyek konstruksi.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {categories.map(cat => (
            <div key={cat}>
              <p className="text-xs font-semibold text-muted-foreground mb-1">{cat}</p>
              {CHECKLIST.filter(c => c.category === cat).map(c => (
                <label key={c.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-muted/50 ${checked.has(c.id) ? "bg-emerald-50 dark:bg-emerald-950/20" : ""}`}>
                  <Checkbox checked={checked.has(c.id)} onCheckedChange={() => toggle(c.id)} />
                  <span className="text-sm">{c.label}</span>
                </label>
              ))}
            </div>
          ))}
        </CardContent>
      </Card>
      <Card><CardContent className="pt-6 text-center space-y-2">
        <p className={`text-4xl font-bold ${score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-destructive"}`}>{score}%</p>
        <Badge className={score >= 80 ? "bg-emerald-600" : score >= 50 ? "bg-amber-500" : "bg-destructive"}>
          {score >= 80 ? "Patuh" : score >= 50 ? "Perlu Perbaikan" : "Tidak Patuh"}
        </Badge>
        <div className="flex items-center gap-1 justify-center text-sm text-muted-foreground">
          <CheckCircle className="w-4 h-4" />{checked.size}/{CHECKLIST.length} item
        </div>
      </CardContent></Card>
    </div>
  );
}
