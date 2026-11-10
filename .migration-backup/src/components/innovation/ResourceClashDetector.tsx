import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GitBranch, AlertTriangle } from "lucide-react";

interface Resource { name: string; projects: string }
interface Clash { resource: string; projects: string[]; severity: string }

export default function ResourceClashDetector() {
  const [resources, setResources] = useState<Resource[]>([
    { name: "", projects: "" }, { name: "", projects: "" },
  ]);
  const [clashes, setClashes] = useState<Clash[]>([]);

  const update = (i: number, f: keyof Resource, v: string) => {
    const c = [...resources]; c[i][f] = v; setResources(c);
  };
  const addRow = () => setResources([...resources, { name: "", projects: "" }]);
  const removeRow = (i: number) => setResources(resources.filter((_, idx) => idx !== i));

  const detect = () => {
    const projectMap = new Map<string, string[]>();
    resources.filter(r => r.name && r.projects).forEach(r => {
      r.projects.split(",").map(p => p.trim()).filter(Boolean).forEach(proj => {
        const list = projectMap.get(r.name) || [];
        list.push(proj);
        projectMap.set(r.name, list);
      });
    });
    const found: Clash[] = [];
    projectMap.forEach((projects, resource) => {
      if (projects.length > 1) {
        found.push({ resource, projects, severity: projects.length >= 3 ? "high" : "medium" });
      }
    });
    setClashes(found);
  };

  return (
    <div className="space-y-6">
      <Card className="border-cyan-500/30 bg-gradient-to-br from-cyan-50/50 to-background dark:from-cyan-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><GitBranch className="w-5 h-5 text-cyan-600" /> Resource Clash Detector</CardTitle>
          <p className="text-sm text-muted-foreground">Deteksi alat/tenaga ahli yang dijadwalkan di 2+ proyek bersamaan. Pisahkan nama proyek dengan koma.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {resources.map((r, i) => (
            <div key={i} className="flex gap-2 items-end">
              <div className="flex-1"><Label className="text-xs">Sumber Daya</Label><Input placeholder="Excavator PC200" value={r.name} onChange={e => update(i, "name", e.target.value)} /></div>
              <div className="flex-1"><Label className="text-xs">Proyek (pisah koma)</Label><Input placeholder="Proyek A, Proyek B" value={r.projects} onChange={e => update(i, "projects", e.target.value)} /></div>
              {resources.length > 1 && <Button variant="ghost" size="icon" onClick={() => removeRow(i)} className="h-9 w-9"><Trash2 className="w-3 h-3" /></Button>}
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addRow}><Plus className="w-3 h-3 mr-1" />Tambah</Button>
            <Button onClick={detect} className="bg-cyan-600 hover:bg-cyan-700 text-white">Deteksi Konflik</Button>
          </div>
        </CardContent>
      </Card>
      {clashes.length > 0 ? (
        <Card className="border-amber-500/30">
          <CardHeader><CardTitle className="text-base flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" />{clashes.length} Konflik Ditemukan</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {clashes.map((c, i) => (
              <div key={i} className="p-3 rounded-lg border border-amber-500/30 bg-amber-50 dark:bg-amber-950/20">
                <p className="font-semibold text-sm">{c.resource}</p>
                <p className="text-xs text-muted-foreground">Digunakan di: {c.projects.join(", ")}</p>
                <Badge className={c.severity === "high" ? "bg-destructive" : "bg-amber-500"}>{c.severity === "high" ? "Kritis" : "Perhatian"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : resources.some(r => r.name) && clashes.length === 0 && (
        <Card><CardContent className="pt-6 text-center text-sm text-emerald-600">✅ Tidak ada konflik sumber daya terdeteksi</CardContent></Card>
      )}
    </div>
  );
}
