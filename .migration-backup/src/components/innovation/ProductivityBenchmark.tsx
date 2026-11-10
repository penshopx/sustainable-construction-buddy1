import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3 } from "lucide-react";

const benchmarks: Record<string, { unit: string; standard: number; good: number }> = {
  "Pengecoran Beton": { unit: "m³/hari/tim", standard: 15, good: 20 },
  "Pemasangan Besi": { unit: "kg/hari/tukang", standard: 200, good: 280 },
  "Pasangan Bata": { unit: "m²/hari/tukang", standard: 8, good: 12 },
  "Plesteran": { unit: "m²/hari/tukang", standard: 10, good: 15 },
  "Galian Tanah Manual": { unit: "m³/hari/pekerja", standard: 3, good: 5 },
  "Pemasangan Keramik": { unit: "m²/hari/tukang", standard: 6, good: 9 },
};

export default function ProductivityBenchmark() {
  const [selectedWork, setSelectedWork] = useState("");
  const [actualOutput, setActualOutput] = useState("");
  const [result, setResult] = useState<null | { ratio: number; status: string; standard: number; good: number; unit: string }>(null);

  const calculate = () => {
    const bench = benchmarks[selectedWork];
    if (!bench) return;
    const actual = Number(actualOutput);
    const ratio = actual / bench.standard;
    const status = ratio >= bench.good / bench.standard ? "excellent" : ratio >= 1 ? "good" : ratio >= 0.7 ? "below" : "poor";
    setResult({ ratio, status, standard: bench.standard, good: bench.good, unit: bench.unit });
  };

  return (
    <div className="space-y-6">
      <Card className="border-pub-emerald/30 bg-gradient-to-br from-emerald-50/50 to-background dark:from-emerald-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><BarChart3 className="w-5 h-5 text-pub-emerald" /> Productivity Benchmark Engine</CardTitle>
          <p className="text-sm text-muted-foreground">Bandingkan produktivitas aktual dengan standar industri konstruksi Indonesia.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div><Label className="text-xs">Jenis Pekerjaan</Label>
            <select className="w-full h-9 rounded-md border bg-background px-3 text-sm" value={selectedWork} onChange={e => setSelectedWork(e.target.value)}>
              <option value="">Pilih jenis pekerjaan</option>
              {Object.keys(benchmarks).map(k => <option key={k} value={k}>{k}</option>)}
            </select>
          </div>
          {selectedWork && benchmarks[selectedWork] && (
            <div className="p-3 rounded-lg bg-muted/50 text-xs space-y-1">
              <p>Standar: <strong>{benchmarks[selectedWork].standard} {benchmarks[selectedWork].unit}</strong></p>
              <p>Target Baik: <strong>{benchmarks[selectedWork].good} {benchmarks[selectedWork].unit}</strong></p>
            </div>
          )}
          <div><Label className="text-xs">Output Aktual Anda</Label><Input type="number" value={actualOutput} onChange={e => setActualOutput(e.target.value)} placeholder="Masukkan angka aktual" /></div>
          <Button onClick={calculate} disabled={!selectedWork || !actualOutput} className="w-full bg-pub-emerald hover:bg-pub-emerald/90 text-white">Bandingkan</Button>
        </CardContent>
      </Card>
      {result && (
        <Card><CardContent className="pt-6 text-center space-y-3">
          <p className={`text-4xl font-bold ${result.status === "excellent" ? "text-emerald-600" : result.status === "good" ? "text-pub-sky" : result.status === "below" ? "text-amber-600" : "text-destructive"}`}>
            {(result.ratio * 100).toFixed(0)}%
          </p>
          <p className="text-xs text-muted-foreground">dari standar {result.standard} {result.unit}</p>
          <Badge className={result.status === "excellent" ? "bg-emerald-600 text-white" : result.status === "good" ? "bg-pub-sky text-white" : result.status === "below" ? "bg-amber-500 text-white" : "bg-destructive"}>
            {result.status === "excellent" ? "Sangat Baik" : result.status === "good" ? "Baik" : result.status === "below" ? "Di Bawah Standar" : "Perlu Perbaikan Serius"}
          </Badge>
        </CardContent></Card>
      )}
    </div>
  );
}
