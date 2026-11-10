import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";

const CATEGORIES = [
  { id: "rework", label: "Rework / Pekerjaan Ulang", threshold: 3 },
  { id: "overtime", label: "Lembur Berlebihan", threshold: 5 },
  { id: "waste", label: "Material Waste", threshold: 5 },
  { id: "idle", label: "Idle Equipment", threshold: 10 },
];

export default function ReworkCostCalculator() {
  const [totalBudget, setTotalBudget] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  const update = (id: string, v: string) => setValues({ ...values, [id]: v });
  const budget = Number(totalBudget) || 0;
  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);

  const results = CATEGORIES.map(c => {
    const val = Number(values[c.id]) || 0;
    const pct = budget > 0 ? (val / budget) * 100 : 0;
    return { ...c, value: val, pct, over: pct > c.threshold };
  });
  const totalLoss = results.reduce((s, r) => s + r.value, 0);

  return (
    <div className="space-y-6">
      <Card className="border-pub-emerald/30 bg-gradient-to-br from-emerald-50/50 to-background dark:from-emerald-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><RefreshCw className="w-5 h-5 text-pub-emerald" /> Rework & Waste Cost Calculator</CardTitle>
          <p className="text-sm text-muted-foreground">Hitung total biaya tersembunyi dari rework, lembur, dan waste.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label className="text-xs">Total Budget Proyek (Rp)</Label><Input type="number" placeholder="10000000000" value={totalBudget} onChange={e => setTotalBudget(e.target.value)} /></div>
          {CATEGORIES.map(c => (
            <div key={c.id}><Label className="text-xs">{c.label} (Rp) — Batas wajar: {c.threshold}%</Label>
              <Input type="number" placeholder="0" value={values[c.id] || ""} onChange={e => update(c.id, e.target.value)} /></div>
          ))}
        </CardContent>
      </Card>
      {budget > 0 && totalLoss > 0 && (
        <Card><CardContent className="pt-6 space-y-3">
          <div className="text-center"><p className="text-3xl font-bold text-destructive">Rp {fmt(totalLoss)}</p><p className="text-sm text-muted-foreground">Total biaya tersembunyi ({((totalLoss / budget) * 100).toFixed(1)}% dari budget)</p></div>
          {results.filter(r => r.value > 0).map((r, i) => (
            <div key={i} className={`p-3 rounded-lg border flex justify-between ${r.over ? "border-destructive/40 bg-destructive/5" : "border-border"}`}>
              <div><p className="text-sm font-semibold">{r.label}</p><p className="text-xs text-muted-foreground">Rp {fmt(r.value)}</p></div>
              <Badge variant={r.over ? "destructive" : "secondary"}>{r.pct.toFixed(1)}% {r.over ? `> ${r.threshold}%` : "OK"}</Badge>
            </div>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}
