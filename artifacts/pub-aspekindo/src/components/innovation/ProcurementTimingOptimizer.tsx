import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, Plus, Trash2 } from "lucide-react";

interface Item { name: string; needDate: string; leadTime: string; currentPrice: string; bulkDiscount: string }

export default function ProcurementTimingOptimizer() {
  const [items, setItems] = useState<Item[]>([{ name: "", needDate: "", leadTime: "14", currentPrice: "", bulkDiscount: "5" }]);
  const [results, setResults] = useState<{ name: string; orderBy: string; savings: number; urgency: string }[]>([]);

  const add = () => setItems([...items, { name: "", needDate: "", leadTime: "14", currentPrice: "", bulkDiscount: "5" }]);
  const remove = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const update = (i: number, f: keyof Item, v: string) => { const c = [...items]; c[i][f] = v; setItems(c); };
  const fmt = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);

  const optimize = () => {
    const today = new Date();
    setResults(items.filter(it => it.name && it.needDate).map(it => {
      const need = new Date(it.needDate);
      const lead = Number(it.leadTime) || 14;
      const orderDate = new Date(need.getTime() - lead * 86400000);
      const daysUntilOrder = Math.ceil((orderDate.getTime() - today.getTime()) / 86400000);
      const savings = Number(it.currentPrice) * (Number(it.bulkDiscount) / 100);
      const urgency = daysUntilOrder <= 0 ? "overdue" : daysUntilOrder <= 7 ? "urgent" : "planned";
      return { name: it.name, orderBy: orderDate.toLocaleDateString("id-ID"), savings, urgency };
    }));
  };

  return (
    <div className="space-y-6">
      <Card className="border-pub-emerald/30 bg-gradient-to-br from-emerald-50/50 to-background dark:from-emerald-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Clock className="w-5 h-5 text-pub-emerald" /> Procurement Timing Optimizer</CardTitle>
          <p className="text-sm text-muted-foreground">Tentukan waktu beli paling menguntungkan berdasarkan kebutuhan dan lead time.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="grid grid-cols-6 gap-2 items-end">
              <div><Label className="text-xs">Material</Label><Input placeholder="Baja" value={it.name} onChange={e => update(i, "name", e.target.value)} /></div>
              <div><Label className="text-xs">Tgl Butuh</Label><Input type="date" value={it.needDate} onChange={e => update(i, "needDate", e.target.value)} /></div>
              <div><Label className="text-xs">Lead Time (hari)</Label><Input type="number" value={it.leadTime} onChange={e => update(i, "leadTime", e.target.value)} /></div>
              <div><Label className="text-xs">Harga (Rp)</Label><Input type="number" value={it.currentPrice} onChange={e => update(i, "currentPrice", e.target.value)} /></div>
              <div><Label className="text-xs">Diskon Bulk (%)</Label><Input type="number" value={it.bulkDiscount} onChange={e => update(i, "bulkDiscount", e.target.value)} /></div>
              {items.length > 1 && <Button variant="ghost" size="icon" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>}
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={add}><Plus className="w-3 h-3 mr-1" />Tambah</Button>
            <Button onClick={optimize} className="bg-pub-emerald hover:bg-pub-emerald/90 text-white">Optimasi Waktu Beli</Button>
          </div>
        </CardContent>
      </Card>
      {results.length > 0 && (
        <Card><CardContent className="pt-6 space-y-2">
          {results.map((r, i) => (
            <div key={i} className={`p-3 rounded-lg border flex justify-between items-center ${r.urgency === "overdue" ? "border-destructive/40 bg-destructive/5" : r.urgency === "urgent" ? "border-amber-500/40 bg-amber-50 dark:bg-amber-950/20" : "border-emerald-500/40"}`}>
              <div><p className="text-sm font-semibold">{r.name}</p><p className="text-xs text-muted-foreground">Order paling lambat: {r.orderBy} | Potensi hemat: Rp {fmt(r.savings)}</p></div>
              <Badge variant={r.urgency === "overdue" ? "destructive" : "secondary"} className={r.urgency === "urgent" ? "bg-amber-500 text-white" : r.urgency === "planned" ? "bg-emerald-600 text-white" : ""}>
                {r.urgency === "overdue" ? "Terlambat!" : r.urgency === "urgent" ? "Segera" : "Terencana"}
              </Badge>
            </div>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}
