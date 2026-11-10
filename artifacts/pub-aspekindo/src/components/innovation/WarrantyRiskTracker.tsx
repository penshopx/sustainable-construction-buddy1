import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, Plus, Trash2 } from "lucide-react";

interface Project { name: string; handoverDate: string; warrantyMonths: string; retentionAmount: string; defectCount: string }

export default function WarrantyRiskTracker() {
  const [projects, setProjects] = useState<Project[]>([{ name: "", handoverDate: "", warrantyMonths: "12", retentionAmount: "", defectCount: "0" }]);
  const [results, setResults] = useState<{ name: string; daysLeft: number; riskLevel: string; retentionAt: string }[]>([]);

  const add = () => setProjects([...projects, { name: "", handoverDate: "", warrantyMonths: "12", retentionAmount: "", defectCount: "0" }]);
  const remove = (i: number) => setProjects(projects.filter((_, idx) => idx !== i));
  const update = (i: number, f: keyof Project, v: string) => { const c = [...projects]; c[i][f] = v; setProjects(c); };
  const fmt = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);

  const analyze = () => {
    const today = new Date();
    setResults(projects.filter(p => p.name && p.handoverDate).map(p => {
      const handover = new Date(p.handoverDate);
      const warrantyEnd = new Date(handover.getTime() + Number(p.warrantyMonths) * 30 * 86400000);
      const daysLeft = Math.ceil((warrantyEnd.getTime() - today.getTime()) / 86400000);
      const defects = Number(p.defectCount);
      const riskLevel = daysLeft <= 0 ? "expired" : daysLeft <= 30 ? "urgent" : defects > 5 ? "high" : defects > 2 ? "medium" : "low";
      return { name: p.name, daysLeft, riskLevel, retentionAt: warrantyEnd.toLocaleDateString("id-ID") };
    }));
  };

  return (
    <div className="space-y-6">
      <Card className="border-pub-emerald/30 bg-gradient-to-br from-emerald-50/50 to-background dark:from-emerald-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Shield className="w-5 h-5 text-pub-emerald" /> Warranty Risk Tracker</CardTitle>
          <p className="text-sm text-muted-foreground">Monitoring risiko masa pemeliharaan dan pencairan retensi proyek.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {projects.map((p, i) => (
            <div key={i} className="grid grid-cols-6 gap-2 items-end">
              <div><Label className="text-xs">Proyek</Label><Input placeholder="Gedung A" value={p.name} onChange={e => update(i, "name", e.target.value)} /></div>
              <div><Label className="text-xs">Tgl Serah Terima</Label><Input type="date" value={p.handoverDate} onChange={e => update(i, "handoverDate", e.target.value)} /></div>
              <div><Label className="text-xs">Masa Garansi (bln)</Label><Input type="number" value={p.warrantyMonths} onChange={e => update(i, "warrantyMonths", e.target.value)} /></div>
              <div><Label className="text-xs">Retensi (Rp)</Label><Input type="number" value={p.retentionAmount} onChange={e => update(i, "retentionAmount", e.target.value)} /></div>
              <div><Label className="text-xs">Jml Defect</Label><Input type="number" value={p.defectCount} onChange={e => update(i, "defectCount", e.target.value)} /></div>
              {projects.length > 1 && <Button variant="ghost" size="icon" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>}
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={add}><Plus className="w-3 h-3 mr-1" />Tambah</Button>
            <Button onClick={analyze} className="bg-pub-emerald hover:bg-pub-emerald/90 text-white">Analisis Garansi</Button>
          </div>
        </CardContent>
      </Card>
      {results.length > 0 && (
        <Card><CardContent className="pt-6 space-y-2">
          {results.map((r, i) => (
            <div key={i} className={`p-3 rounded-lg border flex justify-between items-center ${r.riskLevel === "expired" || r.riskLevel === "urgent" ? "border-destructive/40 bg-destructive/5" : r.riskLevel === "high" || r.riskLevel === "medium" ? "border-amber-500/40 bg-amber-50 dark:bg-amber-950/20" : "border-emerald-500/40"}`}>
              <div><p className="text-sm font-semibold">{r.name}</p><p className="text-xs text-muted-foreground">{r.daysLeft > 0 ? `${r.daysLeft} hari tersisa` : "Garansi berakhir"} | Retensi cair: {r.retentionAt}</p></div>
              <Badge variant={r.riskLevel === "expired" || r.riskLevel === "urgent" ? "destructive" : "secondary"} className={r.riskLevel === "medium" || r.riskLevel === "high" ? "bg-amber-500 text-white" : r.riskLevel === "low" ? "bg-emerald-600 text-white" : ""}>
                {r.riskLevel === "expired" ? "Berakhir" : r.riskLevel === "urgent" ? "Segera" : r.riskLevel === "high" ? "Risiko Tinggi" : r.riskLevel === "medium" ? "Perhatian" : "Aman"}
              </Badge>
            </div>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}
