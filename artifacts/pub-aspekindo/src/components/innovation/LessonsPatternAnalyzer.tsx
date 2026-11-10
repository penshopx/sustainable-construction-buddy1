import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Search } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const ISSUE_TYPES = [
  { value: "overbudget", label: "Cost Overrun" },
  { value: "delay", label: "Keterlambatan" },
  { value: "quality", label: "Masalah Kualitas" },
  { value: "subcon", label: "Masalah Subkontraktor" },
  { value: "safety", label: "Insiden K3" },
  { value: "claim", label: "Klaim/Dispute" },
];

interface Entry { project: string; issue: string; item: string; amount: string }

export default function LessonsPatternAnalyzer() {
  const [entries, setEntries] = useState<Entry[]>([{ project: "", issue: "overbudget", item: "", amount: "" }]);
  const [patterns, setPatterns] = useState<{ issue: string; count: number; items: string[]; totalAmount: number }[]>([]);

  const add = () => setEntries([...entries, { project: "", issue: "overbudget", item: "", amount: "" }]);
  const remove = (i: number) => setEntries(entries.filter((_, idx) => idx !== i));
  const update = (i: number, f: keyof Entry, v: string) => { const c = [...entries]; c[i][f] = v; setEntries(c); };

  const analyze = () => {
    const map = new Map<string, { count: number; items: Set<string>; totalAmount: number }>();
    entries.filter(e => e.project && e.issue).forEach(e => {
      const existing = map.get(e.issue) || { count: 0, items: new Set<string>(), totalAmount: 0 };
      existing.count++;
      if (e.item) existing.items.add(e.item);
      existing.totalAmount += Number(e.amount) || 0;
      map.set(e.issue, existing);
    });
    const result = Array.from(map.entries())
      .map(([issue, data]) => ({ issue, count: data.count, items: Array.from(data.items), totalAmount: data.totalAmount }))
      .filter(r => r.count >= 2)
      .sort((a, b) => b.count - a.count);
    setPatterns(result);
  };

  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);
  const issueLabel = (v: string) => ISSUE_TYPES.find(t => t.value === v)?.label || v;

  return (
    <div className="space-y-6">
      <Card className="border-violet-500/30 bg-gradient-to-br from-violet-50/50 to-background dark:from-violet-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Search className="w-5 h-5 text-violet-600" /> Lessons Pattern Analyzer</CardTitle>
          <p className="text-sm text-muted-foreground">Deteksi pola kesalahan berulang dari histori proyek.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {entries.map((e, i) => (
            <div key={i} className="grid grid-cols-5 gap-2 items-end">
              <div><Label className="text-xs">Proyek</Label><Input placeholder="Proyek A" value={e.project} onChange={ev => update(i, "project", ev.target.value)} /></div>
              <div><Label className="text-xs">Jenis Masalah</Label>
                <Select value={e.issue} onValueChange={v => update(i, "issue", v)}><SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ISSUE_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select></div>
              <div><Label className="text-xs">Item Pekerjaan</Label><Input placeholder="Beton" value={e.item} onChange={ev => update(i, "item", ev.target.value)} /></div>
              <div><Label className="text-xs">Kerugian (Rp)</Label><Input type="number" value={e.amount} onChange={ev => update(i, "amount", ev.target.value)} /></div>
              {entries.length > 1 && <Button variant="ghost" size="icon" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>}
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={add}><Plus className="w-3 h-3 mr-1" />Tambah</Button>
            <Button onClick={analyze} className="bg-violet-600 hover:bg-violet-700 text-white">Cari Pola</Button>
          </div>
        </CardContent>
      </Card>
      {patterns.length > 0 && (
        <Card><CardHeader><CardTitle className="text-base">⚠️ Pola Berulang Ditemukan</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {patterns.map((p, i) => (
              <div key={i} className="p-3 rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
                <div className="flex justify-between items-center">
                  <p className="font-semibold text-sm">{issueLabel(p.issue)}</p>
                  <Badge className="bg-amber-500">{p.count}x berulang</Badge>
                </div>
                {p.items.length > 0 && <p className="text-xs text-muted-foreground mt-1">Item: {p.items.join(", ")}</p>}
                {p.totalAmount > 0 && <p className="text-xs text-destructive">Total kerugian: Rp {fmt(p.totalAmount)}</p>}
              </div>
            ))}
          </CardContent></Card>
      )}
    </div>
  );
}
