import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Wallet } from "lucide-react";

interface Project { name: string; inflow: string; outflow: string; month: string }

export default function PortfolioCashPlanner() {
  const [projects, setProjects] = useState<Project[]>([
    { name: "", inflow: "", outflow: "", month: "" },
    { name: "", inflow: "", outflow: "", month: "" },
  ]);
  const [result, setResult] = useState<{ months: { month: string; net: number; cumulative: number }[]; lowest: number } | null>(null);

  const add = () => setProjects([...projects, { name: "", inflow: "", outflow: "", month: "" }]);
  const remove = (i: number) => setProjects(projects.filter((_, idx) => idx !== i));
  const update = (i: number, f: keyof Project, v: string) => { const c = [...projects]; c[i][f] = v; setProjects(c); };

  const analyze = () => {
    const monthMap = new Map<string, number>();
    projects.filter(p => p.name && p.month).forEach(p => {
      const net = (Number(p.inflow) || 0) - (Number(p.outflow) || 0);
      monthMap.set(p.month, (monthMap.get(p.month) || 0) + net);
    });
    const sorted = Array.from(monthMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
    let cum = 0;
    const months = sorted.map(([month, net]) => { cum += net; return { month, net, cumulative: cum }; });
    const lowest = Math.min(...months.map(m => m.cumulative));
    setResult({ months, lowest });
  };

  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);

  return (
    <div className="space-y-6">
      <Card className="border-indigo-500/30 bg-gradient-to-br from-indigo-50/50 to-background dark:from-indigo-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Wallet className="w-5 h-5 text-indigo-600" /> Portfolio Cash Planner</CardTitle>
          <p className="text-sm text-muted-foreground">Rencanakan arus kas gabungan semua proyek per bulan.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {projects.map((p, i) => (
            <div key={i} className="grid grid-cols-5 gap-2 items-end">
              <div><Label className="text-xs">Proyek</Label><Input placeholder="Proyek A" value={p.name} onChange={e => update(i, "name", e.target.value)} /></div>
              <div><Label className="text-xs">Bulan</Label><Input type="month" value={p.month} onChange={e => update(i, "month", e.target.value)} /></div>
              <div><Label className="text-xs">Inflow (Rp)</Label><Input type="number" value={p.inflow} onChange={e => update(i, "inflow", e.target.value)} /></div>
              <div><Label className="text-xs">Outflow (Rp)</Label><Input type="number" value={p.outflow} onChange={e => update(i, "outflow", e.target.value)} /></div>
              {projects.length > 1 && <Button variant="ghost" size="icon" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>}
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={add}><Plus className="w-3 h-3 mr-1" />Tambah</Button>
            <Button onClick={analyze} className="bg-indigo-600 hover:bg-indigo-700 text-white">Analisis Cashflow</Button>
          </div>
        </CardContent>
      </Card>
      {result && (
        <Card><CardContent className="pt-6 space-y-3">
          {result.lowest < 0 && <Badge variant="destructive">⚠️ Cashflow negatif: Rp {fmt(result.lowest)}</Badge>}
          {result.months.map((m, i) => (
            <div key={i} className={`p-2 rounded-lg border flex justify-between ${m.cumulative < 0 ? "border-destructive/40 bg-destructive/5" : "border-border"}`}>
              <span className="text-sm">{m.month}</span>
              <div className="text-right">
                <span className={`text-sm font-semibold ${m.net >= 0 ? "text-emerald-600" : "text-destructive"}`}>{m.net >= 0 ? "+" : ""}{fmt(m.net)}</span>
                <p className="text-xs text-muted-foreground">Kum: {fmt(m.cumulative)}</p>
              </div>
            </div>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}
