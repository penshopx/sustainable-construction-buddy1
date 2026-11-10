import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { TrendingDown, AlertTriangle, CheckCircle2, DollarSign } from "lucide-react";

export default function CashflowStressTest() {
  const [contractValue, setContractValue] = useState(25000);
  const [durationMonths, setDurationMonths] = useState(12);
  const [retentionPct, setRetentionPct] = useState(5);
  const [paymentDelay, setPaymentDelay] = useState(30);
  const [materialIncrease, setMaterialIncrease] = useState(10);
  const [dpPct, setDpPct] = useState(20);
  const [stressMaterialUp, setStressMaterialUp] = useState(true);
  const [stressDelayDouble, setStressDelayDouble] = useState(true);
  const [stressRetentionHigh, setStressRetentionHigh] = useState(false);

  const monthlyRevenue = contractValue / durationMonths;
  const directCostRatio = 0.75;
  const monthlyCost = monthlyRevenue * directCostRatio;
  const dpAmount = contractValue * (dpPct / 100);

  // Stress scenario adjustments
  const stressedMaterialIncrease = stressMaterialUp ? materialIncrease + 5 : materialIncrease;
  const stressedPaymentDelay = stressDelayDouble ? paymentDelay * 2 : paymentDelay;
  const stressedRetention = stressRetentionHigh ? retentionPct + 3 : retentionPct;

  // Calculate monthly cashflow
  const months = Array.from({ length: durationMonths + 3 }, (_, i) => i + 1);
  const normalCashflow: number[] = [];
  const stressedCashflow: number[] = [];

  let normalBalance = dpAmount;
  let stressedBalance = dpAmount;
  const paymentDelayMonths = Math.ceil(paymentDelay / 30);
  const stressedDelayMonths = Math.ceil(stressedPaymentDelay / 30);

  months.forEach((m) => {
    if (m <= durationMonths) {
      // Costs every month
      const costIncrease = 1 + (materialIncrease / 100) * (m / durationMonths);
      const stressCostIncrease = 1 + (stressedMaterialIncrease / 100) * (m / durationMonths);
      normalBalance -= monthlyCost * costIncrease;
      stressedBalance -= monthlyCost * stressCostIncrease;
    }

    // Revenue comes with delay
    const revenueMonth = m - paymentDelayMonths;
    const stressRevenueMonth = m - stressedDelayMonths;
    if (revenueMonth > 0 && revenueMonth <= durationMonths) {
      normalBalance += monthlyRevenue * (1 - retentionPct / 100);
    }
    if (stressRevenueMonth > 0 && stressRevenueMonth <= durationMonths) {
      stressedBalance += monthlyRevenue * (1 - stressedRetention / 100);
    }

    normalCashflow.push(normalBalance);
    stressedCashflow.push(stressedBalance);
  });

  const minNormal = Math.min(...normalCashflow);
  const minStressed = Math.min(...stressedCashflow);
  const survivalNormal = normalCashflow.every(v => v > -contractValue * 0.1);
  const survivalStressed = stressedCashflow.every(v => v > -contractValue * 0.1);
  const criticalMonth = stressedCashflow.findIndex(v => v < 0) + 1;

  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));
  const maxVal = Math.max(...normalCashflow.map(Math.abs), ...stressedCashflow.map(Math.abs), 1);

  return (
    <div className="space-y-6">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold font-heading flex items-center justify-center gap-2">
          <TrendingDown className="w-5 h-5 text-pub-amber" /> Tender Cashflow Stress Test
        </h2>
        <p className="text-sm text-muted-foreground">Simulasi: apakah proyek survive jika skenario terburuk terjadi?</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Input */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Parameter Proyek</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Nilai Kontrak (Juta Rp)</Label>
                <Input type="number" value={contractValue} onChange={(e) => setContractValue(Number(e.target.value) || 0)} />
              </div>
              <div>
                <Label className="text-xs">Durasi (Bulan)</Label>
                <Input type="number" value={durationMonths} onChange={(e) => setDurationMonths(Math.max(1, Number(e.target.value) || 1))} />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-xs">Down Payment</Label>
                  <span className="text-xs font-semibold">{dpPct}%</span>
                </div>
                <Slider value={[dpPct]} onValueChange={([v]) => setDpPct(v)} min={0} max={30} step={5} />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-xs">Retensi</Label>
                  <span className="text-xs font-semibold">{retentionPct}%</span>
                </div>
                <Slider value={[retentionPct]} onValueChange={([v]) => setRetentionPct(v)} min={0} max={10} step={0.5} />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-xs">Delay Pembayaran Termin</Label>
                  <span className="text-xs font-semibold">{paymentDelay} hari</span>
                </div>
                <Slider value={[paymentDelay]} onValueChange={([v]) => setPaymentDelay(v)} min={14} max={120} step={7} />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-xs">Kenaikan Harga Material</Label>
                  <span className="text-xs font-semibold">{materialIncrease}%</span>
                </div>
                <Slider value={[materialIncrease]} onValueChange={([v]) => setMaterialIncrease(v)} min={0} max={30} step={1} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive" /> Skenario Stress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs">Material naik tambahan +5%</Label>
                <Switch checked={stressMaterialUp} onCheckedChange={setStressMaterialUp} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Delay pembayaran 2× lipat</Label>
                <Switch checked={stressDelayDouble} onCheckedChange={setStressDelayDouble} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Retensi naik +3%</Label>
                <Switch checked={stressRetentionHigh} onCheckedChange={setStressRetentionHigh} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Output */}
        <div className="space-y-4">
          <Card className={`border ${survivalStressed ? 'border-pub-emerald/30' : 'border-destructive/30'}`}>
            <CardContent className="pt-6">
              <div className="text-center mb-4">
                {survivalStressed ? (
                  <div className="flex items-center justify-center gap-2 text-pub-emerald">
                    <CheckCircle2 className="w-6 h-6" />
                    <span className="text-lg font-bold">PROYEK SURVIVE</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 text-destructive">
                    <AlertTriangle className="w-6 h-6" />
                    <span className="text-lg font-bold">PROYEK KRITIS!</span>
                  </div>
                )}
                {!survivalStressed && criticalMonth > 0 && (
                  <p className="text-sm text-destructive mt-1">Cashflow negatif mulai bulan ke-{criticalMonth}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Saldo Terendah (Normal)</p>
                  <p className={`font-bold ${minNormal >= 0 ? 'text-pub-emerald' : 'text-destructive'}`}>Rp {fmt(minNormal)} Jt</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Saldo Terendah (Stress)</p>
                  <p className={`font-bold ${minStressed >= 0 ? 'text-pub-emerald' : 'text-destructive'}`}>Rp {fmt(minStressed)} Jt</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Revenue/Bulan</p>
                  <p className="font-bold">Rp {fmt(monthlyRevenue)} Jt</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Cost/Bulan</p>
                  <p className="font-bold">Rp {fmt(monthlyCost)} Jt</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Simple bar chart */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Cashflow Timeline (Juta Rp)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1.5">
                {months.slice(0, Math.min(months.length, 15)).map((m, idx) => (
                  <div key={m} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-6 shrink-0">B{m}</span>
                    <div className="flex-1 flex items-center h-4 relative">
                      <div className="absolute inset-0 flex">
                        {/* Zero line at center */}
                        <div className="w-1/2" />
                        <div className="w-px bg-muted-foreground/20" />
                        <div className="w-1/2" />
                      </div>
                      {/* Normal bar */}
                      {normalCashflow[idx] !== undefined && (
                        <div
                          className={`absolute h-2 rounded-sm ${normalCashflow[idx] >= 0 ? 'bg-pub-emerald/60' : 'bg-destructive/40'}`}
                          style={{
                            left: normalCashflow[idx] >= 0 ? '50%' : `${50 - (Math.abs(normalCashflow[idx]) / maxVal) * 50}%`,
                            width: `${(Math.abs(normalCashflow[idx]) / maxVal) * 50}%`,
                          }}
                        />
                      )}
                      {/* Stressed bar */}
                      {stressedCashflow[idx] !== undefined && (
                        <div
                          className={`absolute h-1.5 rounded-sm top-0.5 ${stressedCashflow[idx] >= 0 ? 'bg-pub-sky/80' : 'bg-destructive/80'}`}
                          style={{
                            left: stressedCashflow[idx] >= 0 ? '50%' : `${50 - (Math.abs(stressedCashflow[idx]) / maxVal) * 50}%`,
                            width: `${(Math.abs(stressedCashflow[idx]) / maxVal) * 50}%`,
                          }}
                        />
                      )}
                    </div>
                    <span className="text-[9px] text-muted-foreground w-14 text-right shrink-0">{fmt(stressedCashflow[idx] ?? 0)}</span>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-pub-emerald/60 inline-block" /> Normal</span>
                <span className="flex items-center gap-1"><span className="w-3 h-1.5 rounded-sm bg-pub-sky/80 inline-block" /> Stress</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
