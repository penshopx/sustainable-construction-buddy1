import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Search, AlertTriangle, CheckCircle2, TrendingDown } from "lucide-react";

interface LeakItem {
  label: string;
  budget: number;
  actual: number;
  threshold: number;
  tip: string;
}

const defaultItems: LeakItem[] = [
  { label: "Overhead Kantor Proyek", budget: 500, actual: 650, threshold: 10, tip: "Review kebutuhan staff & fasilitas kantor" },
  { label: "Idle Alat Berat", budget: 200, actual: 280, threshold: 20, tip: "Optimasi jadwal mobilisasi alat" },
  { label: "Rework / Pekerjaan Ulang", budget: 100, actual: 180, threshold: 3, tip: "Tingkatkan QC & shop drawing review" },
  { label: "Lembur Berlebihan", budget: 300, actual: 420, threshold: 15, tip: "Evaluasi jadwal shift & produktivitas" },
  { label: "Material Waste", budget: 800, actual: 880, threshold: 5, tip: "Monitor cutting plan & stock opname" },
  { label: "Markup Subkontraktor", budget: 1500, actual: 1620, threshold: 5, tip: "Negosiasi ulang atau cari alternatif" },
  { label: "Transportasi", budget: 250, actual: 290, threshold: 10, tip: "Optimasi rute & konsolidasi pengiriman" },
  { label: "Consumable & ATK", budget: 100, actual: 130, threshold: 15, tip: "Sistem approval pengadaan consumable" },
];

export default function MarginLeakScanner() {
  const [items, setItems] = useState<LeakItem[]>(defaultItems);

  const updateItem = (idx: number, field: "budget" | "actual", val: number) => {
    setItems(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
  };

  const totalBudget = items.reduce((s, i) => s + i.budget, 0);
  const totalActual = items.reduce((s, i) => s + i.actual, 0);
  const totalLeak = totalActual - totalBudget;
  const totalLeakPct = totalBudget > 0 ? ((totalLeak / totalBudget) * 100) : 0;

  const leaks = items
    .map((item, idx) => {
      const diff = item.actual - item.budget;
      const pct = item.budget > 0 ? (diff / item.budget) * 100 : 0;
      const isLeak = pct > item.threshold;
      return { ...item, idx, diff, pct, isLeak };
    })
    .sort((a, b) => b.diff - a.diff);

  const leakCount = leaks.filter(l => l.isLeak).length;
  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));
  const severity = leakCount >= 4 ? "critical" : leakCount >= 2 ? "warning" : "ok";

  return (
    <div className="space-y-6">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold font-heading flex items-center justify-center gap-2">
          <Search className="w-5 h-5 text-pub-amber" /> Margin Leak Scanner
        </h2>
        <p className="text-sm text-muted-foreground">Deteksi sumber kebocoran margin proyek Anda</p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-xs text-muted-foreground">Total Budget</p>
            <p className="text-lg font-bold">Rp {fmt(totalBudget)} Jt</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-xs text-muted-foreground">Total Aktual</p>
            <p className="text-lg font-bold">Rp {fmt(totalActual)} Jt</p>
          </CardContent>
        </Card>
        <Card className={totalLeak > 0 ? "border-destructive/30" : "border-pub-emerald/30"}>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-xs text-muted-foreground">Total Kebocoran</p>
            <p className={`text-lg font-bold ${totalLeak > 0 ? 'text-destructive' : 'text-pub-emerald'}`}>Rp {fmt(totalLeak)} Jt</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-4 text-center">
            <p className="text-xs text-muted-foreground">Sumber Bocor</p>
            <p className={`text-lg font-bold ${leakCount > 0 ? 'text-destructive' : 'text-pub-emerald'}`}>{leakCount} / {items.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Status alert */}
      <Card className={`border ${severity === 'critical' ? 'border-destructive/30 bg-destructive/5' : severity === 'warning' ? 'border-pub-amber/30 bg-pub-amber/5' : 'border-pub-emerald/30 bg-pub-emerald/5'}`}>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3">
            {severity === 'ok' ? (
              <CheckCircle2 className="w-5 h-5 text-pub-emerald shrink-0" />
            ) : (
              <AlertTriangle className={`w-5 h-5 ${severity === 'critical' ? 'text-destructive' : 'text-pub-amber'} shrink-0`} />
            )}
            <div className="text-sm">
              {severity === 'critical' && <p className="font-semibold text-destructive">⚠️ KRITIS: {leakCount} sumber kebocoran terdeteksi! Total kebocoran {totalLeakPct.toFixed(1)}% dari budget.</p>}
              {severity === 'warning' && <p className="font-semibold text-pub-amber">⚡ PERINGATAN: {leakCount} item melebihi threshold. Segera lakukan pengendalian.</p>}
              {severity === 'ok' && <p className="font-semibold text-pub-emerald">✅ Margin terkendali. Semua item dalam batas threshold.</p>}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detail items */}
      <div className="space-y-3">
        {leaks.map((item) => (
          <Card key={item.idx} className={`${item.isLeak ? 'border-destructive/20' : ''}`}>
            <CardContent className="pt-4 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <p className="text-sm font-semibold">{item.label}</p>
                    {item.isLeak && <Badge className="bg-destructive/15 text-destructive text-[10px]">BOCOR</Badge>}
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-1">
                      <Label className="text-[10px] text-muted-foreground w-12">Budget</Label>
                      <Input
                        type="number"
                        value={item.budget}
                        onChange={(e) => updateItem(item.idx, "budget", Number(e.target.value) || 0)}
                        className="h-7 w-24 text-xs"
                      />
                    </div>
                    <div className="flex items-center gap-1">
                      <Label className="text-[10px] text-muted-foreground w-12">Aktual</Label>
                      <Input
                        type="number"
                        value={item.actual}
                        onChange={(e) => updateItem(item.idx, "actual", Number(e.target.value) || 0)}
                        className="h-7 w-24 text-xs"
                      />
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-bold ${item.diff > 0 ? 'text-destructive' : 'text-pub-emerald'}`}>
                    {item.diff > 0 ? '+' : ''}{fmt(item.diff)} Jt
                  </p>
                  <p className={`text-xs ${item.isLeak ? 'text-destructive' : 'text-muted-foreground'}`}>
                    {item.pct > 0 ? '+' : ''}{item.pct.toFixed(1)}% (threshold {item.threshold}%)
                  </p>
                  {item.isLeak && <p className="text-[10px] text-pub-amber mt-1">💡 {item.tip}</p>}
                </div>
              </div>
              {/* Visual bar */}
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${item.isLeak ? 'bg-destructive' : 'bg-pub-emerald'}`}
                  style={{ width: `${Math.min((item.actual / Math.max(item.budget, 1)) * 100, 200) / 2}%` }}
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
