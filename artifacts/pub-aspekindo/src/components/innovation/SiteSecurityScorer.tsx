import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield, CheckCircle, XCircle } from "lucide-react";

const ITEMS = [
  { id: "cctv", label: "CCTV aktif di area material & alat", weight: 15 },
  { id: "guard", label: "Satpam/ronda 24 jam", weight: 15 },
  { id: "fence", label: "Pagar keliling proyek tertutup", weight: 10 },
  { id: "access", label: "Pintu masuk-keluar terkontrol (log book)", weight: 10 },
  { id: "lighting", label: "Penerangan malam memadai", weight: 8 },
  { id: "inventory", label: "Inventaris alat & material tercatat harian", weight: 12 },
  { id: "handover", label: "Prosedur serah terima shift tertulis", weight: 10 },
  { id: "alarm", label: "Sistem alarm atau sensor", weight: 8 },
  { id: "insurance", label: "Asuransi all-risk aktif", weight: 7 },
  { id: "reporting", label: "SOP pelaporan insiden jelas", weight: 5 },
];

export default function SiteSecurityScorer() {
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) next.delete(id); else next.add(id);
    setChecked(next);
  };

  const score = ITEMS.filter(it => checked.has(it.id)).reduce((s, it) => s + it.weight, 0);
  const level = score >= 80 ? "Aman" : score >= 50 ? "Cukup" : score >= 30 ? "Rentan" : "Kritis";

  return (
    <div className="space-y-6">
      <Card className="border-red-500/30 bg-gradient-to-br from-red-50/50 to-background dark:from-red-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Shield className="w-5 h-5 text-red-600" /> Site Security Scorer</CardTitle>
          <p className="text-sm text-muted-foreground">Skor keamanan proyek berdasarkan 10 aspek penting.</p>
        </CardHeader>
        <CardContent className="space-y-2">
          {ITEMS.map(it => (
            <label key={it.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-muted/50 ${checked.has(it.id) ? "bg-emerald-50 dark:bg-emerald-950/20" : ""}`}>
              <Checkbox checked={checked.has(it.id)} onCheckedChange={() => toggle(it.id)} />
              <span className="text-sm flex-1">{it.label}</span>
              <Badge variant="outline" className="text-[10px]">{it.weight} pts</Badge>
            </label>
          ))}
        </CardContent>
      </Card>
      <Card><CardContent className="pt-6 text-center space-y-2">
        <p className={`text-4xl font-bold ${score >= 80 ? "text-emerald-600" : score >= 50 ? "text-amber-600" : "text-destructive"}`}>{score}/100</p>
        <Badge className={score >= 80 ? "bg-emerald-600" : score >= 50 ? "bg-amber-500" : "bg-destructive"}>{level}</Badge>
        <div className="flex items-center gap-1 justify-center text-sm text-muted-foreground mt-2">
          {score >= 80 ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <XCircle className="w-4 h-4 text-destructive" />}
          {checked.size}/{ITEMS.length} aspek terpenuhi
        </div>
      </CardContent></Card>
    </div>
  );
}
