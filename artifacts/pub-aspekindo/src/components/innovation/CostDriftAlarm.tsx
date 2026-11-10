import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, TrendingDown } from "lucide-react";

interface Item { name: string; budget: string; actual: string; week: string }

export default function CostDriftAlarm() {
  const [items, setItems] = useState<Item[]>([{ name: "", budget: "", actual: "", week: "" }]);
  const [results, setResults] = useState<{ name: string; drift: number; projected: number; status: string }[]>([]);

  const add = () => setItems([...items, { name: "", budget: "", actual: "", week: "" }]);
  const remove = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const update = (i: number, f: keyof Item, v: string) => { const c = [...items]; c[i][f] = v; setItems(c); };

  const analyze = () => {
    setResults(items.filter(it => it.name && it.budget && it.actual).map(it => {
      const b = Number(it.budget), a = Number(it.actual);
      const drift = ((a - b) / b) * 100;
      const weeksLeft = Math.max(1, 52 - (Number(it.week) || 1));
      const projected = a + (a / Math.max(1, Number(it.week) || 1)) * weeksLeft;
      const status = drift > 10 ? "danger" : drift > 5 ? "warning" : "safe";
      return { name: it.name, drift, projected, status };
    }));
  };

  const fmt = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);

  return (
    <div className="space-y-6">
      <Card className="border-pub-emerald/30 bg-gradient-to-br from-emerald-50/50 to-background dark:from-emerald-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><TrendingDown className="w-5 h-5 text-pub-emerald" /> Real-Time Cost Drift Alarm</CardTitle>
          <p className="text-sm text-muted-foreground">Monitor deviasi biaya per item pekerjaan. Alarm jika actual &gt; budget 5%.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-5 gap-2 items-end">
              <div><Label className="text-xs">Item</Label><Input placeholder="Beton K-300" value={it.name} onChange={e => update(i, "name", e.target.value)} /></div>
              <div><Label className="text-xs">Budget (Rp)</Label><Input type="number" value={it.budget} onChange={e => update(i, "budget", e.target.value)} /></div>
              <div><Label className="text-xs">Actual (Rp)</Label><Input type="number" value={it.actual} onChange={e => update(i, "actual", e.target.value)} /></div>
              <div><Label className="text-xs">Minggu ke-</Label><Input type="number" value={it.week} onChange={e => update(i, "week", e.target.value)} /></div>
              {items.length > 1 && <Button variant="ghost" size="icon" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>}
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={add}><Plus className="w-3 h-3 mr-1" />Tambah</Button>
            <Button onClick={analyze} className="bg-pub-emerald hover:bg-pub-emerald/90 text-white">Cek Deviasi</Button>
          </div>
        </CardContent>
      </Card>
      {results.length > 0 && (
        <Card><CardContent className="pt-6 space-y-2">
          {results.map((r, i) => (
            <div key={i} className={`p-3 rounded-lg border flex justify-between items-center ${r.status === "danger" ? "border-destructive/40 bg-destructive/5" : r.status === "warning" ? "border-amber-500/40 bg-amber-50 dark:bg-amber-950/20" : "border-emerald-500/40"}`}>
              <div><p className="text-sm font-semibold">{r.name}</p><p className="text-xs text-muted-foreground">Proyeksi akhir: Rp {fmt(r.projected)}</p></div>
              <Badge variant={r.status === "danger" ? "destructive" : "secondary"} className={r.status === "warning" ? "bg-amber-500 text-white" : ""}>
                {r.drift > 0 ? "+" : ""}{r.drift.toFixed(1)}%
              </Badge>
            </div>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}
