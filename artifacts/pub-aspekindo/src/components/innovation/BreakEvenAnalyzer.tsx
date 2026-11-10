import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp } from "lucide-react";

export default function BreakEvenAnalyzer() {
  const [fixedCost, setFixedCost] = useState("");
  const [avgContractValue, setAvgContractValue] = useState("");
  const [avgMargin, setAvgMargin] = useState("");
  const [monthlyOverhead, setMonthlyOverhead] = useState("");

  const fc = Number(fixedCost) || 0;
  const acv = Number(avgContractValue) || 0;
  const margin = (Number(avgMargin) || 0) / 100;
  const overhead = Number(monthlyOverhead) || 0;
  const annualFixed = fc + overhead * 12;
  const contributionPerProject = acv * margin;
  const breakEvenProjects = contributionPerProject > 0 ? Math.ceil(annualFixed / contributionPerProject) : 0;
  const breakEvenRevenue = margin > 0 ? annualFixed / margin : 0;
  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));

  return (
    <div className="space-y-6">
      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-50/50 to-background dark:from-amber-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><TrendingUp className="w-5 h-5 text-amber-600" /> Break-Even Analyzer</CardTitle>
          <p className="text-sm text-muted-foreground">Berapa proyek minimum yang harus dimenangkan untuk BEP?</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label className="text-xs">Biaya Tetap Tahunan (Rp)</Label><Input type="number" placeholder="5000000000" value={fixedCost} onChange={e => setFixedCost(e.target.value)} /></div>
          <div><Label className="text-xs">Overhead Bulanan (Rp)</Label><Input type="number" placeholder="500000000" value={monthlyOverhead} onChange={e => setMonthlyOverhead(e.target.value)} /></div>
          <div><Label className="text-xs">Rata-rata Nilai Kontrak (Rp)</Label><Input type="number" placeholder="10000000000" value={avgContractValue} onChange={e => setAvgContractValue(e.target.value)} /></div>
          <div><Label className="text-xs">Rata-rata Margin Bersih (%)</Label><Input type="number" placeholder="8" value={avgMargin} onChange={e => setAvgMargin(e.target.value)} /></div>
        </CardContent>
      </Card>
      {annualFixed > 0 && acv > 0 && margin > 0 && (
        <Card><CardContent className="pt-6 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-950/20">
              <p className="text-3xl font-bold text-amber-600">{breakEvenProjects}</p>
              <p className="text-xs text-muted-foreground">Proyek Minimum/Tahun</p>
            </div>
            <div className="p-4 rounded-lg bg-muted/50">
              <p className="text-lg font-bold">Rp {fmt(breakEvenRevenue)}</p>
              <p className="text-xs text-muted-foreground">Revenue BEP</p>
            </div>
          </div>
          <div className="text-sm text-center text-muted-foreground">
            Total biaya tetap: Rp {fmt(annualFixed)} | Kontribusi/proyek: Rp {fmt(contributionPerProject)}
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}
