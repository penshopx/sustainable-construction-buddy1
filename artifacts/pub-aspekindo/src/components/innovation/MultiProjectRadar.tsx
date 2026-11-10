import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Radar, Plus, Trash2, BarChart3 } from "lucide-react";

interface ProjectEntry {
  name: string;
  value: string; // miliar
  progress: number[]; // 0-100
  cashflowHealth: number[]; // 1-10
  scheduleRisk: number[]; // 1-10
  resourceClash: number[]; // 1-10
}

interface ProjectResult {
  name: string;
  value: number;
  progress: number;
  riskScore: number;
  priority: "critical" | "high" | "medium" | "low";
  issues: string[];
}

const emptyProject = (): ProjectEntry => ({
  name: "", value: "", progress: [50], cashflowHealth: [5], scheduleRisk: [5], resourceClash: [3],
});

export default function MultiProjectRadar() {
  const [projects, setProjects] = useState<ProjectEntry[]>([emptyProject(), emptyProject()]);
  const [results, setResults] = useState<ProjectResult[]>([]);

  const addProject = () => setProjects([...projects, emptyProject()]);
  const removeProject = (i: number) => setProjects(projects.filter((_, idx) => idx !== i));

  const update = <K extends keyof ProjectEntry>(i: number, field: K, value: ProjectEntry[K]) => {
    const project = projects[i];
    if (!project) return;
    const copy = [...projects];
    copy[i] = { ...project, [field]: value };
    setProjects(copy);
  };

  const analyze = () => {
    const res: ProjectResult[] = projects
      .filter((p) => p.name && p.value)
      .map((p) => {
        const cashflow = 10 - p.cashflowHealth[0]; // inverse: low health = high risk
        const schedule = p.scheduleRisk[0];
        const resource = p.resourceClash[0];
        const progressPenalty = p.progress[0] < 30 ? 2 : p.progress[0] < 60 ? 1 : 0;
        const riskScore = (cashflow * 0.4 + schedule * 0.35 + resource * 0.25 + progressPenalty) / 1.2;

        const issues: string[] = [];
        if (cashflow >= 7) issues.push("⚠️ Cashflow kritis");
        if (schedule >= 7) issues.push("⏰ Keterlambatan tinggi");
        if (resource >= 7) issues.push("🔄 Konflik sumber daya");
        if (p.progress[0] < 30) issues.push("📉 Progress sangat rendah");

        const priority: ProjectResult["priority"] = riskScore >= 7 ? "critical" : riskScore >= 5 ? "high" : riskScore >= 3 ? "medium" : "low";

        return {
          name: p.name,
          value: Number(p.value),
          progress: p.progress[0],
          riskScore,
          priority,
          issues,
        };
      })
      .sort((a, b) => b.riskScore - a.riskScore);
    setResults(res);
  };

  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);
  const priorityColor = (p: string) =>
    p === "critical" ? "bg-destructive text-white" : p === "high" ? "bg-amber-500 text-white" : p === "medium" ? "bg-blue-500 text-white" : "bg-emerald-600 text-white";

  return (
    <div className="space-y-6">
      <Card className="border-indigo-500/30 bg-gradient-to-br from-indigo-50/50 to-background dark:from-indigo-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Radar className="w-5 h-5 text-indigo-600" />
            Multi-Project Risk Radar
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Pantau risiko gabungan semua proyek aktif. Deteksi proyek paling kritis.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {projects.map((p, i) => (
            <div key={i} className="p-3 border rounded-lg space-y-3 relative">
              {projects.length > 1 && (
                <Button variant="ghost" size="icon" className="absolute top-2 right-2 h-6 w-6" onClick={() => removeProject(i)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Nama Proyek</Label>
                  <Input placeholder="Proyek A" value={p.name} onChange={(e) => update(i, "name", e.target.value)} />
                </div>
                <div>
                  <Label className="text-xs">Nilai (Miliar Rp)</Label>
                  <Input type="number" placeholder="25" value={p.value} onChange={(e) => update(i, "value", e.target.value)} />
                </div>
              </div>
              <div>
                <Label className="text-xs">Progress: {p.progress[0]}%</Label>
                <Slider value={p.progress} onValueChange={(v) => update(i, "progress", v)} min={0} max={100} step={5} />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Kesehatan Kas: {p.cashflowHealth[0]}/10</Label>
                  <Slider value={p.cashflowHealth} onValueChange={(v) => update(i, "cashflowHealth", v)} min={1} max={10} step={1} />
                </div>
                <div>
                  <Label className="text-xs">Risiko Jadwal: {p.scheduleRisk[0]}/10</Label>
                  <Slider value={p.scheduleRisk} onValueChange={(v) => update(i, "scheduleRisk", v)} min={1} max={10} step={1} />
                </div>
                <div>
                  <Label className="text-xs">Konflik Resource: {p.resourceClash[0]}/10</Label>
                  <Slider value={p.resourceClash} onValueChange={(v) => update(i, "resourceClash", v)} min={1} max={10} step={1} />
                </div>
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addProject}><Plus className="w-3 h-3 mr-1" /> Tambah Proyek</Button>
            <Button onClick={analyze} className="bg-indigo-600 hover:bg-indigo-700 text-white">Analisis Portfolio</Button>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Portfolio Risk Dashboard
            </CardTitle>
            <div className="flex gap-2 flex-wrap">
              {results.filter((r) => r.priority === "critical").length > 0 && (
                <Badge variant="destructive">{results.filter((r) => r.priority === "critical").length} Kritis</Badge>
              )}
              <Badge variant="secondary">Total Rp {fmt(results.reduce((s, r) => s + r.value, 0))} M</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.map((r, i) => (
              <div key={i} className={`p-4 rounded-lg border ${
                r.priority === "critical" ? "border-destructive/40 bg-destructive/5" :
                r.priority === "high" ? "border-amber-500/40 bg-amber-50 dark:bg-amber-950/20" :
                "border-border"
              }`}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-sm">{r.name}</p>
                    <p className="text-xs text-muted-foreground">Rp {fmt(r.value)} M • Progress {r.progress}%</p>
                  </div>
                  <div className="text-right">
                    <Badge className={priorityColor(r.priority)}>
                      {r.priority === "critical" ? "🔴 Kritis" : r.priority === "high" ? "🟡 Tinggi" : r.priority === "medium" ? "🔵 Sedang" : "🟢 Rendah"}
                    </Badge>
                    <p className="text-xs mt-1 text-muted-foreground">Risk Score: {r.riskScore.toFixed(1)}/10</p>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="w-full h-2 bg-muted rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-indigo-500 rounded-full transition-all" style={{ width: `${r.progress}%` }} />
                </div>
                {r.issues.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {r.issues.map((issue, j) => (
                      <span key={j} className="text-xs bg-muted px-2 py-0.5 rounded">{issue}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
