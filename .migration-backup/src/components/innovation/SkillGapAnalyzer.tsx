import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Users, Plus, Trash2 } from "lucide-react";

interface Skill { name: string; required: number[]; current: number[] }

export default function SkillGapAnalyzer() {
  const [skills, setSkills] = useState<Skill[]>([
    { name: "Manajemen Proyek", required: [8], current: [5] },
    { name: "K3 Konstruksi", required: [7], current: [6] },
    { name: "Estimasi Biaya", required: [8], current: [4] },
    { name: "Quality Control", required: [7], current: [5] },
  ]);
  const [analyzed, setAnalyzed] = useState(false);

  const add = () => setSkills([...skills, { name: "", required: [5], current: [3] }]);
  const remove = (i: number) => setSkills(skills.filter((_, idx) => idx !== i));

  const gaps = skills.filter(s => s.name).map(s => ({
    name: s.name,
    gap: s.required[0] - s.current[0],
    priority: s.required[0] - s.current[0] >= 3 ? "critical" : s.required[0] - s.current[0] >= 2 ? "high" : "normal",
    required: s.required[0],
    current: s.current[0],
  }));

  return (
    <div className="space-y-6">
      <Card className="border-purple-500/30 bg-gradient-to-br from-purple-50/50 to-background dark:from-purple-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Users className="w-5 h-5 text-purple-600" /> Skill Gap Mapping Analyzer</CardTitle>
          <p className="text-sm text-muted-foreground">Identifikasi kekurangan kompetensi SDM – bandingkan level yang dibutuhkan vs aktual.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {skills.map((s, i) => (
            <div key={i} className="p-3 border rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Input placeholder="Nama Kompetensi" value={s.name} onChange={e => { const c = [...skills]; c[i].name = e.target.value; setSkills(c); }} className="flex-1" />
                {skills.length > 1 && <Button variant="ghost" size="icon" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>}
              </div>
              <div><Label className="text-xs">Dibutuhkan: {s.required[0]}/10</Label><Slider value={s.required} onValueChange={v => { const c = [...skills]; c[i].required = v; setSkills(c); }} min={1} max={10} step={1} /></div>
              <div><Label className="text-xs">Saat Ini: {s.current[0]}/10</Label><Slider value={s.current} onValueChange={v => { const c = [...skills]; c[i].current = v; setSkills(c); }} min={1} max={10} step={1} /></div>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={add}><Plus className="w-3 h-3 mr-1" />Tambah</Button>
            <Button onClick={() => setAnalyzed(true)} className="bg-purple-600 hover:bg-purple-700 text-white">Analisis Gap</Button>
          </div>
        </CardContent>
      </Card>
      {analyzed && gaps.length > 0 && (
        <Card><CardContent className="pt-6 space-y-2">
          {gaps.sort((a, b) => b.gap - a.gap).map((g, i) => (
            <div key={i} className={`p-3 rounded-lg border flex justify-between items-center ${g.priority === "critical" ? "border-destructive/40 bg-destructive/5" : g.priority === "high" ? "border-amber-500/40 bg-amber-50 dark:bg-amber-950/20" : "border-muted"}`}>
              <div>
                <p className="text-sm font-semibold">{g.name}</p>
                <p className="text-xs text-muted-foreground">Dibutuhkan: {g.required} | Saat ini: {g.current} | Gap: {g.gap}</p>
              </div>
              <Badge variant={g.priority === "critical" ? "destructive" : "secondary"} className={g.priority === "high" ? "bg-amber-500 text-white" : ""}>
                {g.priority === "critical" ? "Kritis" : g.priority === "high" ? "Prioritas" : "Normal"}
              </Badge>
            </div>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}
