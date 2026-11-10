import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Landmark } from "lucide-react";

export default function DebtServiceCalculator() {
  const [revenue, setRevenue] = useState("");
  const [opex, setOpex] = useState("");
  const [loanPayment, setLoanPayment] = useState("");
  const [interestRate, setInterestRate] = useState([12]);

  const rev = Number(revenue) || 0;
  const op = Number(opex) || 0;
  const loan = Number(loanPayment) || 0;
  const noi = rev - op;
  const annualInterest = loan * (interestRate[0] / 100);
  const totalDebtService = loan + annualInterest;
  const dscr = totalDebtService > 0 ? noi / totalDebtService : 0;
  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));

  const verdict = dscr >= 1.5 ? "Sehat" : dscr >= 1.2 ? "Cukup" : dscr >= 1 ? "Rawan" : "Berbahaya";

  return (
    <div className="space-y-6">
      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-50/50 to-background dark:from-amber-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Landmark className="w-5 h-5 text-amber-600" /> Debt Service Coverage Ratio</CardTitle>
          <p className="text-sm text-muted-foreground">Hitung kemampuan perusahaan membayar utang dari pendapatan operasional.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label className="text-xs">Pendapatan Tahunan (Rp)</Label><Input type="number" value={revenue} onChange={e => setRevenue(e.target.value)} /></div>
          <div><Label className="text-xs">Beban Operasional Tahunan (Rp)</Label><Input type="number" value={opex} onChange={e => setOpex(e.target.value)} /></div>
          <div><Label className="text-xs">Cicilan Pokok Utang/Tahun (Rp)</Label><Input type="number" value={loanPayment} onChange={e => setLoanPayment(e.target.value)} /></div>
          <div><Label className="text-xs">Suku Bunga: {interestRate[0]}%/tahun</Label><Slider value={interestRate} onValueChange={setInterestRate} min={1} max={30} step={0.5} /></div>
        </CardContent>
      </Card>
      {rev > 0 && loan > 0 && (
        <Card><CardContent className="pt-6 space-y-3">
          <div className="text-center">
            <p className={`text-4xl font-bold ${dscr >= 1.5 ? "text-emerald-600" : dscr >= 1 ? "text-amber-600" : "text-destructive"}`}>{dscr.toFixed(2)}x</p>
            <Badge className={dscr >= 1.5 ? "bg-emerald-600" : dscr >= 1 ? "bg-amber-500" : "bg-destructive"}>{verdict}</Badge>
            <p className="text-xs text-muted-foreground mt-1">DSCR &gt; 1.5x = sehat, 1.0-1.5x = rawan, &lt;1.0x = tidak mampu bayar</p>
          </div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="p-2 rounded bg-muted/50"><span className="text-muted-foreground">NOI:</span> Rp {fmt(noi)}</div>
            <div className="p-2 rounded bg-muted/50"><span className="text-muted-foreground">Total Debt Service:</span> Rp {fmt(totalDebtService)}</div>
          </div>
        </CardContent></Card>
      )}
    </div>
  );
}
