import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Calculator, AlertTriangle, CheckCircle2, TrendingUp } from "lucide-react";

export default function BidCalculator() {
  const [directCost, setDirectCost] = useState(10000);
  const [overhead, setOverhead] = useState(10);
  const [profit, setProfit] = useState(8);
  const [riskTeknis, setRiskTeknis] = useState(5);
  const [riskFinansial, setRiskFinansial] = useState(3);
  const [riskKontrak, setRiskKontrak] = useState(4);

  const totalRisk = riskTeknis + riskFinansial + riskKontrak;
  const overheadAmount = directCost * (overhead / 100);
  const profitAmount = directCost * (profit / 100);
  const riskAmount = directCost * (totalRisk / 100);
  const safePrice = directCost + overheadAmount + profitAmount + riskAmount;
  const minPrice = directCost + overheadAmount + riskAmount;

  const riskLevel = totalRisk <= 8 ? "low" : totalRisk <= 15 ? "medium" : "high";
  const riskColors = { low: "text-pub-emerald", medium: "text-pub-amber", high: "text-destructive" };
  const riskBadge = { low: "bg-pub-emerald/15 text-pub-emerald", medium: "bg-pub-amber/15 text-pub-amber", high: "bg-destructive/15 text-destructive" };
  const riskLabels = { low: "Risiko Rendah", medium: "Risiko Sedang", high: "Risiko Tinggi" };

  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));

  return (
    <div className="space-y-6">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold font-heading flex items-center justify-center gap-2">
          <Calculator className="w-5 h-5 text-pub-amber" /> Risk-Adjusted Bid Calculator
        </h2>
        <p className="text-sm text-muted-foreground">Hitung harga tender minimal aman + margin sehat</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Input */}
        <div className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Biaya Langsung (Juta Rp)</CardTitle>
            </CardHeader>
            <CardContent>
              <Input
                type="number"
                value={directCost}
                onChange={(e) => setDirectCost(Number(e.target.value) || 0)}
                className="text-lg font-semibold"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Overhead & Profit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-xs">Overhead</Label>
                  <span className="text-xs font-semibold">{overhead}%</span>
                </div>
                <Slider value={[overhead]} onValueChange={([v]) => setOverhead(v)} min={5} max={25} step={0.5} />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-xs">Profit Margin</Label>
                  <span className="text-xs font-semibold">{profit}%</span>
                </div>
                <Slider value={[profit]} onValueChange={([v]) => setProfit(v)} min={3} max={20} step={0.5} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-pub-amber" /> Faktor Risiko
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-xs">Risiko Teknis</Label>
                  <span className="text-xs font-semibold">{riskTeknis}%</span>
                </div>
                <Slider value={[riskTeknis]} onValueChange={([v]) => setRiskTeknis(v)} min={0} max={15} step={0.5} className="[&_[role=slider]]:bg-pub-amber" />
                <p className="text-[10px] text-muted-foreground mt-1">Tanah lunak, akses sulit, cuaca ekstrem</p>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-xs">Risiko Finansial</Label>
                  <span className="text-xs font-semibold">{riskFinansial}%</span>
                </div>
                <Slider value={[riskFinansial]} onValueChange={([v]) => setRiskFinansial(v)} min={0} max={15} step={0.5} className="[&_[role=slider]]:bg-pub-sky" />
                <p className="text-[10px] text-muted-foreground mt-1">Fluktuasi material, eskalasi, kurs</p>
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-xs">Risiko Klausul Kontrak</Label>
                  <span className="text-xs font-semibold">{riskKontrak}%</span>
                </div>
                <Slider value={[riskKontrak]} onValueChange={([v]) => setRiskKontrak(v)} min={0} max={15} step={0.5} className="[&_[role=slider]]:bg-destructive" />
                <p className="text-[10px] text-muted-foreground mt-1">Penalti, retensi, force majeure sempit</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Output */}
        <div className="space-y-4">
          <Card className="bg-gradient-to-br from-pub-navy via-pub-navy to-pub-navy-light text-white">
            <CardContent className="pt-6 space-y-4">
              <div className="text-center">
                <p className="text-xs text-white/60 mb-1">HARGA TENDER AMAN</p>
                <p className="text-3xl font-extrabold font-heading">Rp {fmt(safePrice)} <span className="text-base font-normal text-white/60">Juta</span></p>
              </div>
              <div className="h-px bg-white/10" />
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-white/50 text-xs">Harga Minimal (BEP)</p>
                  <p className="font-semibold">Rp {fmt(minPrice)} Jt</p>
                </div>
                <div>
                  <p className="text-white/50 text-xs">Profit Potensial</p>
                  <p className="font-semibold text-pub-emerald">Rp {fmt(profitAmount)} Jt</p>
                </div>
                <div>
                  <p className="text-white/50 text-xs">Cadangan Risiko</p>
                  <p className="font-semibold text-pub-amber">Rp {fmt(riskAmount)} Jt</p>
                </div>
                <div>
                  <p className="text-white/50 text-xs">Total Risk Factor</p>
                  <p className={`font-semibold ${riskColors[riskLevel]}`}>{totalRisk.toFixed(1)}%</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-semibold">Analisis Risiko</p>
                <Badge className={riskBadge[riskLevel]}>{riskLabels[riskLevel]}</Badge>
              </div>

              {/* Risk breakdown bar */}
              <div className="space-y-2">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Biaya Langsung</span>
                    <span>{((directCost / safePrice) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-foreground/60 rounded-full" style={{ width: `${(directCost / safePrice) * 100}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Overhead</span>
                    <span>{((overheadAmount / safePrice) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-pub-sky rounded-full" style={{ width: `${(overheadAmount / safePrice) * 100}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Cadangan Risiko</span>
                    <span>{((riskAmount / safePrice) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-pub-amber rounded-full" style={{ width: `${(riskAmount / safePrice) * 100}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span>Profit</span>
                    <span>{((profitAmount / safePrice) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="h-2.5 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-pub-emerald rounded-full" style={{ width: `${(profitAmount / safePrice) * 100}%` }} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className={`border ${riskLevel === 'high' ? 'border-destructive/30 bg-destructive/5' : riskLevel === 'medium' ? 'border-pub-amber/30 bg-pub-amber/5' : 'border-pub-emerald/30 bg-pub-emerald/5'}`}>
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                {riskLevel === 'high' ? (
                  <AlertTriangle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                ) : (
                  <CheckCircle2 className="w-5 h-5 text-pub-emerald shrink-0 mt-0.5" />
                )}
                <div className="text-xs space-y-1">
                  {riskLevel === 'high' && <p className="font-semibold text-destructive">⚠️ Total risiko sangat tinggi ({totalRisk.toFixed(1)}%). Pertimbangkan untuk tidak ikut tender ini atau negosiasi ulang klausul kontrak.</p>}
                  {riskLevel === 'medium' && <p className="font-semibold text-pub-amber">⚡ Risiko sedang. Pastikan cadangan risiko mencukupi dan monitor indikator risiko selama proyek.</p>}
                  {riskLevel === 'low' && <p className="font-semibold text-pub-emerald">✅ Risiko rendah. Proyek layak diikuti dengan harga tender di atas Rp {fmt(minPrice)} Juta.</p>}
                  <p className="text-muted-foreground">Jangan tender di bawah Rp {fmt(minPrice)} Juta (BEP). Harga aman: Rp {fmt(safePrice)} Juta.</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
