import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Trash2 } from "lucide-react";

interface Project { name: string; needed: string; assigned: string; priority: string }

export default function WorkforceOptimizer() {
  const [projects, setProjects] = useState<Project[]>([{ name: "", needed: "", assigned: "", priority: "medium" }]);
  const [totalAvailable, setTotalAvailable] = useState("");
  const [results, setResults] = useState<{ name: string; gap: number; optimal: number; status: string }[]>([]);

  const add = () => setProjects([...projects, { name: "", needed: "", assigned: "", priority: "medium" }]);
  const remove = (i: number) => setProjects(projects.filter((_, idx) => idx !== i));
  const update = (i: number, f: keyof Project, v: string) => { const c = [...projects]; c[i][f] = v; setProjects(c); };

  const optimize = () => {
    const total = Number(totalAvailable);
    const totalNeeded = projects.reduce((s, p) => s + Number(p.needed), 0);
    const ratio = total > 0 && totalNeeded > 0 ? total / totalNeeded : 1;
    setResults(projects.filter(p => p.name).map(p => {
      const needed = Number(p.needed);
      const assigned = Number(p.assigned);
      const optimal = Math.round(needed * Math.min(ratio, 1));
      const gap = assigned - optimal;
      const status = gap < -2 ? "deficit" : gap > 2 ? "surplus" : "balanced";
      return { name: p.name, gap, optimal, status };
    }));
  };

  return (
    <div className="space-y-6">
      <Card className="border-purple-500/30 bg-gradient-to-br from-purple-50/50 to-background dark:from-purple-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Users className="w-5 h-5 text-purple-600" /> Workforce Allocation Optimizer</CardTitle>
          <p className="text-sm text-muted-foreground">Distribusi tenaga kerja optimal antar proyek berdasarkan kebutuhan.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><Label className="text-xs">Total Tenaga Kerja Tersedia</Label><Input type="number" value={totalAvailable} onChange={e => setTotalAvailable(e.target.value)} placeholder="150" /></div>
          {projects.map((p, i) => (
            <div key={i} className="grid grid-cols-4 gap-2 items-end">
              <div><Label className="text-xs">Proyek</Label><Input placeholder="Gedung A" value={p.name} onChange={e => update(i, "name", e.target.value)} /></div>
              <div><Label className="text-xs">Dibutuhkan</Label><Input type="number" value={p.needed} onChange={e => update(i, "needed", e.target.value)} /></div>
              <div><Label className="text-xs">Saat Ini</Label><Input type="number" value={p.assigned} onChange={e => update(i, "assigned", e.target.value)} /></div>
              {projects.length > 1 && <Button variant="ghost" size="icon" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>}
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={add}><Plus className="w-3 h-3 mr-1" />Tambah</Button>
            <Button onClick={optimize} className="bg-purple-600 hover:bg-purple-700 text-white">Optimasi Alokasi</Button>
          </div>
        </CardContent>
      </Card>
      {results.length > 0 && (
        <Card><CardContent className="pt-6 space-y-2">
          {results.map((r, i) => (
            <div key={i} className={`p-3 rounded-lg border flex justify-between items-center ${r.status === "deficit" ? "border-destructive/40 bg-destructive/5" : r.status === "surplus" ? "border-amber-500/40 bg-amber-50 dark:bg-amber-950/20" : "border-emerald-500/40"}`}>
              <div><p className="text-sm font-semibold">{r.name}</p><p className="text-xs text-muted-foreground">Rekomendasi optimal: {r.optimal} orang | Selisih: {r.gap > 0 ? "+" : ""}{r.gap}</p></div>
              <Badge variant={r.status === "deficit" ? "destructive" : "secondary"} className={r.status === "surplus" ? "bg-amber-500 text-white" : r.status === "balanced" ? "bg-emerald-600 text-white" : ""}>
                {r.status === "deficit" ? "Kurang" : r.status === "surplus" ? "Surplus" : "Seimbang"}
              </Badge>
            </div>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}
