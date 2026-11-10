import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, Plus, Trash2 } from "lucide-react";

interface Activity { name: string; planned: string; actual: string; unit: string }

export default function DailyProgressIntelligence() {
  const [activities, setActivities] = useState<Activity[]>([{ name: "", planned: "", actual: "", unit: "m³" }]);
  const [results, setResults] = useState<{ name: string; spiDay: number; status: string }[]>([]);

  const add = () => setActivities([...activities, { name: "", planned: "", actual: "", unit: "m³" }]);
  const remove = (i: number) => setActivities(activities.filter((_, idx) => idx !== i));
  const update = (i: number, f: keyof Activity, v: string) => { const c = [...activities]; c[i][f] = v; setActivities(c); };

  const analyze = () => {
    setResults(activities.filter(a => a.name && a.planned && a.actual).map(a => {
      const p = Number(a.planned), act = Number(a.actual);
      const spiDay = p > 0 ? act / p : 0;
      const status = spiDay >= 1 ? "on-track" : spiDay >= 0.8 ? "warning" : "behind";
      return { name: a.name, spiDay, status };
    }));
  };

  return (
    <div className="space-y-6">
      <Card className="border-pub-sky/30 bg-gradient-to-br from-sky-50/50 to-background dark:from-sky-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><BarChart3 className="w-5 h-5 text-pub-sky" /> Daily Progress Intelligence</CardTitle>
          <p className="text-sm text-muted-foreground">Monitoring progres harian – bandingkan rencana vs aktual per aktivitas.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {activities.map((a, i) => (
            <div key={i} className="grid grid-cols-5 gap-2 items-end">
              <div><Label className="text-xs">Aktivitas</Label><Input placeholder="Pengecoran" value={a.name} onChange={e => update(i, "name", e.target.value)} /></div>
              <div><Label className="text-xs">Rencana Hari Ini</Label><Input type="number" value={a.planned} onChange={e => update(i, "planned", e.target.value)} /></div>
              <div><Label className="text-xs">Aktual Hari Ini</Label><Input type="number" value={a.actual} onChange={e => update(i, "actual", e.target.value)} /></div>
              <div><Label className="text-xs">Satuan</Label><Input value={a.unit} onChange={e => update(i, "unit", e.target.value)} /></div>
              {activities.length > 1 && <Button variant="ghost" size="icon" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>}
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={add}><Plus className="w-3 h-3 mr-1" />Tambah</Button>
            <Button onClick={analyze} className="bg-pub-sky hover:bg-pub-sky/90 text-white">Analisis Progres</Button>
          </div>
        </CardContent>
      </Card>
      {results.length > 0 && (
        <Card><CardContent className="pt-6 space-y-2">
          {results.map((r, i) => (
            <div key={i} className={`p-3 rounded-lg border flex justify-between items-center ${r.status === "behind" ? "border-destructive/40 bg-destructive/5" : r.status === "warning" ? "border-amber-500/40 bg-amber-50 dark:bg-amber-950/20" : "border-emerald-500/40 bg-emerald-50/50"}`}>
              <div><p className="text-sm font-semibold">{r.name}</p><p className="text-xs text-muted-foreground">SPI Harian: {r.spiDay.toFixed(2)}</p></div>
              <Badge variant={r.status === "behind" ? "destructive" : "secondary"} className={r.status === "warning" ? "bg-amber-500 text-white" : r.status === "on-track" ? "bg-emerald-600 text-white" : ""}>
                {r.status === "on-track" ? "On Track" : r.status === "warning" ? "Perhatian" : "Tertinggal"}
              </Badge>
            </div>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}
