import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle, TrendingDown, Activity } from "lucide-react";

const WORK_TYPES = [
  { id: "galian", label: "Galian Tanah", unit: "m³/hari", stdRate: 120, icon: "⛏️" },
  { id: "beton", label: "Pengecoran Beton", unit: "m³/hari", stdRate: 25, icon: "🧱" },
  { id: "bekisting", label: "Bekisting", unit: "m²/hari", stdRate: 15, icon: "📐" },
  { id: "pembesian", label: "Pembesian", unit: "kg/hari", stdRate: 800, icon: "🔩" },
  { id: "urugan", label: "Urugan & Pemadatan", unit: "m³/hari", stdRate: 100, icon: "🚜" },
  { id: "aspal", label: "Penghamparan Aspal", unit: "m²/hari", stdRate: 500, icon: "🛤️" },
];

interface CheckResult {
  workType: string;
  label: string;
  estimated: number;
  standard: number;
  deviation: number;
  status: "safe" | "warning" | "danger";
}

export default function ProductivityChecker() {
  const [results, setResults] = useState<CheckResult[]>([]);
  const [entries, setEntries] = useState<{ workType: string; estimated: string }[]>([
    { workType: "galian", estimated: "" },
  ]);

  const addEntry = () => setEntries([...entries, { workType: "beton", estimated: "" }]);

  const analyze = () => {
    const res: CheckResult[] = entries
      .filter((e) => e.estimated && Number(e.estimated) > 0)
      .map((e) => {
        const wt = WORK_TYPES.find((w) => w.id === e.workType)!;
        const est = Number(e.estimated);
        const dev = ((est - wt.stdRate) / wt.stdRate) * 100;
        return {
          workType: e.workType,
          label: wt.label,
          estimated: est,
          standard: wt.stdRate,
          deviation: dev,
          status: Math.abs(dev) <= 10 ? "safe" : Math.abs(dev) <= 25 ? "warning" : "danger",
        };
      });
    setResults(res);
  };

  const dangerCount = results.filter((r) => r.status === "danger").length;
  const warningCount = results.filter((r) => r.status === "warning").length;

  return (
    <div className="space-y-6">
      <Card className="border-sky-500/30 bg-gradient-to-br from-sky-50/50 to-background dark:from-sky-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Activity className="w-5 h-5 text-sky-600" />
            Productivity Reality Checker
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Bandingkan produktivitas estimasi vs standar histori. Deviasi &gt;10% → peringatan.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {entries.map((entry, i) => (
            <div key={i} className="flex gap-3 items-end">
              <div className="flex-1">
                <Label className="text-xs">Jenis Pekerjaan</Label>
                <Select value={entry.workType} onValueChange={(v) => {
                  const copy = [...entries];
                  copy[i].workType = v;
                  setEntries(copy);
                }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {WORK_TYPES.map((w) => (
                      <SelectItem key={w.id} value={w.id}>{w.icon} {w.label} ({w.unit})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="w-40">
                <Label className="text-xs">Estimasi Anda</Label>
                <Input
                  type="number"
                  placeholder="0"
                  value={entry.estimated}
                  onChange={(e) => {
                    const copy = [...entries];
                    copy[i].estimated = e.target.value;
                    setEntries(copy);
                  }}
                />
              </div>
              <div className="w-24 text-xs text-muted-foreground pb-2">
                Std: {WORK_TYPES.find((w) => w.id === entry.workType)?.stdRate} {WORK_TYPES.find((w) => w.id === entry.workType)?.unit}
              </div>
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addEntry}>+ Tambah Item</Button>
            <Button onClick={analyze} className="bg-sky-600 hover:bg-sky-700 text-white">Analisis Produktivitas</Button>
          </div>
        </CardContent>
      </Card>

      {results.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Hasil Analisis</CardTitle>
            <div className="flex gap-2">
              {dangerCount > 0 && <Badge variant="destructive">{dangerCount} Bahaya</Badge>}
              {warningCount > 0 && <Badge className="bg-amber-500">{warningCount} Peringatan</Badge>}
              {dangerCount === 0 && warningCount === 0 && <Badge className="bg-emerald-600">Semua Aman</Badge>}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {results.map((r, i) => (
              <div key={i} className={`p-3 rounded-lg border flex items-center gap-3 ${
                r.status === "danger" ? "border-destructive/40 bg-destructive/5" :
                r.status === "warning" ? "border-amber-500/40 bg-amber-50 dark:bg-amber-950/20" :
                "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/20"
              }`}>
                {r.status === "danger" ? <AlertTriangle className="w-5 h-5 text-destructive shrink-0" /> :
                 r.status === "warning" ? <TrendingDown className="w-5 h-5 text-amber-600 shrink-0" /> :
                 <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />}
                <div className="flex-1">
                  <p className="text-sm font-semibold">{r.label}</p>
                  <p className="text-xs text-muted-foreground">
                    Estimasi: {r.estimated} | Standar: {r.standard} | Deviasi: {r.deviation > 0 ? "+" : ""}{r.deviation.toFixed(1)}%
                  </p>
                </div>
                {r.status === "danger" && (
                  <p className="text-xs text-destructive font-medium max-w-[200px]">
                    {r.deviation > 0 ? "Terlalu optimis! Risiko keterlambatan tinggi." : "Sangat konservatif, periksa efisiensi."}
                  </p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
