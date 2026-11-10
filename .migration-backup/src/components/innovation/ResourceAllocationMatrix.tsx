import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Users } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const RESOURCE_TYPES = ["Excavator", "Crane", "Batching Plant", "Site Manager", "Surveyor", "Operator", "Welder", "Foreman"];

interface Allocation { resource: string; type: string; projectA: string; projectB: string; pctA: string; pctB: string }

export default function ResourceAllocationMatrix() {
  const [items, setItems] = useState<Allocation[]>([{ resource: "", type: RESOURCE_TYPES[0], projectA: "", projectB: "", pctA: "50", pctB: "50" }]);
  const add = () => setItems([...items, { resource: "", type: RESOURCE_TYPES[0], projectA: "", projectB: "", pctA: "50", pctB: "50" }]);
  const remove = (i: number) => setItems(items.filter((_, idx) => idx !== i));
  const update = (i: number, f: keyof Allocation, v: string) => { const c = [...items]; c[i][f] = v; setItems(c); };

  const overloaded = items.filter(it => (Number(it.pctA) || 0) + (Number(it.pctB) || 0) > 100 && it.resource);

  return (
    <div className="space-y-6">
      <Card className="border-indigo-500/30 bg-gradient-to-br from-indigo-50/50 to-background dark:from-indigo-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Users className="w-5 h-5 text-indigo-600" /> Resource Allocation Matrix</CardTitle>
          <p className="text-sm text-muted-foreground">Alokasi sumber daya antar proyek. Deteksi over-allocation.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {items.map((it, i) => (
            <div key={i} className="p-3 border rounded-lg space-y-2 relative">
              {items.length > 1 && <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>}
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Nama Resource</Label><Input placeholder="EX-200 #1" value={it.resource} onChange={e => update(i, "resource", e.target.value)} /></div>
                <div><Label className="text-xs">Tipe</Label>
                  <Select value={it.type} onValueChange={v => update(i, "type", v)}><SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{RESOURCE_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent></Select></div>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <div><Label className="text-xs">Proyek 1</Label><Input placeholder="A" value={it.projectA} onChange={e => update(i, "projectA", e.target.value)} /></div>
                <div><Label className="text-xs">Alokasi %</Label><Input type="number" value={it.pctA} onChange={e => update(i, "pctA", e.target.value)} /></div>
                <div><Label className="text-xs">Proyek 2</Label><Input placeholder="B" value={it.projectB} onChange={e => update(i, "projectB", e.target.value)} /></div>
                <div><Label className="text-xs">Alokasi %</Label><Input type="number" value={it.pctB} onChange={e => update(i, "pctB", e.target.value)} /></div>
              </div>
              {it.resource && (Number(it.pctA) || 0) + (Number(it.pctB) || 0) > 100 && (
                <Badge variant="destructive" className="text-xs">⚠️ Over-allocated: {(Number(it.pctA) || 0) + (Number(it.pctB) || 0)}%</Badge>
              )}
            </div>
          ))}
          <Button variant="outline" size="sm" onClick={add}><Plus className="w-3 h-3 mr-1" />Tambah Resource</Button>
        </CardContent>
      </Card>
      {overloaded.length > 0 && (
        <Card className="border-destructive/30"><CardContent className="pt-6">
          <p className="font-semibold text-sm text-destructive">⚠️ {overloaded.length} resource over-allocated!</p>
          {overloaded.map((o, i) => <p key={i} className="text-sm mt-1">{o.resource} ({o.type}): {(Number(o.pctA) || 0) + (Number(o.pctB) || 0)}% total</p>)}
        </CardContent></Card>
      )}
    </div>
  );
}
