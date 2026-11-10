import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GraduationCap } from "lucide-react";

export default function TrainingROICalculator() {
  const [trainingCost, setTrainingCost] = useState("");
  const [participants, setParticipants] = useState("");
  const [productivityBefore, setProductivityBefore] = useState("");
  const [productivityAfter, setProductivityAfter] = useState("");
  const [avgSalary, setAvgSalary] = useState("");
  const [result, setResult] = useState<null | { roi: number; payback: number; benefit: number }>(null);

  const fmt = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);

  const calculate = () => {
    const cost = Number(trainingCost);
    const pBefore = Number(productivityBefore) / 100;
    const pAfter = Number(productivityAfter) / 100;
    const salary = Number(avgSalary);
    const n = Number(participants) || 1;
    const monthlyBenefit = salary * (pAfter - pBefore) * n;
    const annualBenefit = monthlyBenefit * 12;
    const roi = cost > 0 ? ((annualBenefit - cost) / cost) * 100 : 0;
    const payback = monthlyBenefit > 0 ? cost / monthlyBenefit : 0;
    setResult({ roi, payback, benefit: annualBenefit });
  };

  return (
    <div className="space-y-6">
      <Card className="border-pub-sky/30 bg-gradient-to-br from-sky-50/50 to-background dark:from-sky-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><GraduationCap className="w-5 h-5 text-pub-sky" /> Training ROI Calculator</CardTitle>
          <p className="text-sm text-muted-foreground">Mengukur dampak pelatihan terhadap produktivitas dan return on investment.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Total Biaya Pelatihan (Rp)</Label><Input type="number" value={trainingCost} onChange={e => setTrainingCost(e.target.value)} placeholder="50000000" /></div>
            <div><Label className="text-xs">Jumlah Peserta</Label><Input type="number" value={participants} onChange={e => setParticipants(e.target.value)} placeholder="20" /></div>
            <div><Label className="text-xs">Produktivitas Sebelum (%)</Label><Input type="number" value={productivityBefore} onChange={e => setProductivityBefore(e.target.value)} placeholder="70" /></div>
            <div><Label className="text-xs">Produktivitas Sesudah (%)</Label><Input type="number" value={productivityAfter} onChange={e => setProductivityAfter(e.target.value)} placeholder="85" /></div>
            <div className="col-span-2"><Label className="text-xs">Rata-rata Gaji Bulanan/Orang (Rp)</Label><Input type="number" value={avgSalary} onChange={e => setAvgSalary(e.target.value)} placeholder="8000000" /></div>
          </div>
          <Button onClick={calculate} className="w-full bg-pub-sky hover:bg-pub-sky/90 text-white">Hitung ROI Pelatihan</Button>
        </CardContent>
      </Card>
      {result && (
        <Card><CardContent className="pt-6 space-y-4">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div><p className={`text-2xl font-bold ${result.roi > 100 ? "text-emerald-600" : result.roi > 0 ? "text-amber-600" : "text-destructive"}`}>{result.roi.toFixed(0)}%</p><p className="text-xs text-muted-foreground">ROI Tahunan</p></div>
            <div><p className="text-2xl font-bold text-pub-sky">{result.payback.toFixed(1)}</p><p className="text-xs text-muted-foreground">Payback (bulan)</p></div>
            <div><p className="text-2xl font-bold text-pub-emerald">Rp {fmt(result.benefit)}</p><p className="text-xs text-muted-foreground">Benefit Tahunan</p></div>
          </div>
          <Badge className={result.roi > 100 ? "bg-emerald-600 text-white" : result.roi > 0 ? "bg-amber-500 text-white" : "bg-destructive"}>
            {result.roi > 100 ? "Sangat Layak" : result.roi > 0 ? "Layak" : "Tidak Layak"}
          </Badge>
        </CardContent></Card>
      )}
    </div>
  );
}
