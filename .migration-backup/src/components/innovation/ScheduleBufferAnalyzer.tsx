import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Timer } from "lucide-react";

export default function ScheduleBufferAnalyzer() {
  const [duration, setDuration] = useState("");
  const [criticalPath, setCriticalPath] = useState("");
  const [weatherRisk, setWeatherRisk] = useState([5]);
  const [supplyRisk, setSupplyRisk] = useState([5]);
  const [approvalRisk, setApprovalRisk] = useState([5]);
  const [result, setResult] = useState<null | { buffer: number; pct: number; verdict: string }>(null);

  const calculate = () => {
    const d = Number(duration) || 0;
    const cp = Number(criticalPath) || d;
    const riskAvg = (weatherRisk[0] + supplyRisk[0] + approvalRisk[0]) / 3;
    const bufferPct = riskAvg * 2.5 + (cp / d > 0.8 ? 5 : 0);
    const bufferDays = Math.ceil(d * bufferPct / 100);
    const verdict = bufferPct >= 20 ? "Buffer besar, proyek berisiko tinggi" : bufferPct >= 10 ? "Buffer wajar, tetap monitor" : "Buffer minimal, proyek stabil";
    setResult({ buffer: bufferDays, pct: Math.round(bufferPct), verdict });
  };

  return (
    <div className="space-y-6">
      <Card className="border-sky-500/30 bg-gradient-to-br from-sky-50/50 to-background dark:from-sky-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Timer className="w-5 h-5 text-sky-600" /> Schedule Buffer Analyzer</CardTitle>
          <p className="text-sm text-muted-foreground">Hitung buffer waktu yang dibutuhkan berdasarkan profil risiko proyek.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Total Durasi (hari)</Label><Input type="number" placeholder="365" value={duration} onChange={e => setDuration(e.target.value)} /></div>
            <div><Label className="text-xs">Critical Path (hari)</Label><Input type="number" placeholder="300" value={criticalPath} onChange={e => setCriticalPath(e.target.value)} /></div>
          </div>
          <div><Label className="text-xs">Risiko Cuaca: {weatherRisk[0]}/10</Label><Slider value={weatherRisk} onValueChange={setWeatherRisk} min={1} max={10} step={1} /></div>
          <div><Label className="text-xs">Risiko Supply Chain: {supplyRisk[0]}/10</Label><Slider value={supplyRisk} onValueChange={setSupplyRisk} min={1} max={10} step={1} /></div>
          <div><Label className="text-xs">Risiko Approval/Koordinasi: {approvalRisk[0]}/10</Label><Slider value={approvalRisk} onValueChange={setApprovalRisk} min={1} max={10} step={1} /></div>
          <Button onClick={calculate} className="w-full bg-sky-600 hover:bg-sky-700 text-white">Hitung Buffer</Button>
        </CardContent>
      </Card>
      {result && (
        <Card><CardContent className="pt-6 text-center space-y-3">
          <p className="text-4xl font-bold text-sky-600">+{result.buffer} hari</p>
          <Badge className={result.pct >= 20 ? "bg-destructive" : result.pct >= 10 ? "bg-amber-500" : "bg-emerald-600"}>{result.pct}% buffer</Badge>
          <p className="text-sm text-muted-foreground">{result.verdict}</p>
        </CardContent></Card>
      )}
    </div>
  );
}
