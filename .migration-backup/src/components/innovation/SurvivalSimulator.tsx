import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, Shield, TrendingDown } from "lucide-react";

export default function SurvivalSimulator() {
  const [cashReserve, setCashReserve] = useState(5000);
  const [monthlyOverhead, setMonthlyOverhead] = useState(800);
  const [activeProjects, setActiveProjects] = useState(4);
  const [avgMarginPct, setAvgMarginPct] = useState(8);
  const [avgRevenue, setAvgRevenue] = useState(3000);

  // Stress toggles
  const [twoProjectsLoss, setTwoProjectsLoss] = useState(true);
  const [materialUp20, setMaterialUp20] = useState(true);
  const [interestUp3, setInterestUp3] = useState(false);
  const [paymentDelay90, setPaymentDelay90] = useState(true);
  const [usdUp15, setUsdUp15] = useState(false);

  // Calculate survival
  const monthlyIncome = avgRevenue * activeProjects;
  const monthlyMargin = monthlyIncome * (avgMarginPct / 100);
  const normalNetCash = monthlyMargin - monthlyOverhead;

  // Stress impacts
  let stressedIncome = monthlyIncome;
  let stressedCost = monthlyOverhead;
  let additionalLoss = 0;

  if (twoProjectsLoss) {
    const lossProjects = Math.min(2, activeProjects);
    stressedIncome -= avgRevenue * lossProjects * 0.3; // 30% revenue loss from 2 projects
    additionalLoss += avgRevenue * lossProjects * 0.05; // direct losses
  }
  if (materialUp20) {
    stressedCost += monthlyIncome * 0.75 * 0.20 * 0.3; // 20% material up on 75% cost, 30% is material
  }
  if (interestUp3) {
    stressedCost += cashReserve * 0.03 / 12; // 3% annual interest increase
  }
  if (paymentDelay90) {
    additionalLoss += monthlyIncome * 0.15; // working capital cost
  }
  if (usdUp15) {
    stressedCost += monthlyIncome * 0.1 * 0.15; // 10% import content, 15% increase
  }

  const stressedMargin = stressedIncome * (avgMarginPct / 100);
  const stressedNetCash = stressedMargin - stressedCost - additionalLoss;
  const burnRate = Math.abs(stressedNetCash);
  const survivalMonths = stressedNetCash >= 0 ? 999 : cashReserve / burnRate;
  const survivalLevel = survivalMonths > 12 ? "safe" : survivalMonths > 6 ? "warning" : survivalMonths > 3 ? "danger" : "critical";

  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));

  // Timeline simulation
  const timelineMonths = 12;
  const timeline = Array.from({ length: timelineMonths }, (_, i) => {
    const month = i + 1;
    const balance = cashReserve + stressedNetCash * month;
    return { month, balance: Math.max(balance, -cashReserve) };
  });

  const colors = {
    safe: { text: "text-pub-emerald", bg: "bg-pub-emerald/10", border: "border-pub-emerald/30" },
    warning: { text: "text-pub-amber", bg: "bg-pub-amber/10", border: "border-pub-amber/30" },
    danger: { text: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" },
    critical: { text: "text-destructive", bg: "bg-destructive/15", border: "border-destructive/40" },
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-2">
        <h2 className="text-xl font-bold font-heading flex items-center justify-center gap-2">
          <Shield className="w-5 h-5 text-pub-amber" /> Business Survival Simulator
        </h2>
        <p className="text-sm text-muted-foreground">Berapa bulan perusahaan bertahan jika skenario terburuk terjadi?</p>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Input */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Kondisi Perusahaan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs">Cadangan Kas (Juta Rp)</Label>
                <Input type="number" value={cashReserve} onChange={(e) => setCashReserve(Number(e.target.value) || 0)} />
              </div>
              <div>
                <Label className="text-xs">Overhead Bulanan (Juta Rp)</Label>
                <Input type="number" value={monthlyOverhead} onChange={(e) => setMonthlyOverhead(Number(e.target.value) || 0)} />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-xs">Jumlah Proyek Aktif</Label>
                  <span className="text-xs font-semibold">{activeProjects}</span>
                </div>
                <Slider value={[activeProjects]} onValueChange={([v]) => setActiveProjects(v)} min={1} max={10} step={1} />
              </div>
              <div>
                <Label className="text-xs">Rata-rata Revenue/Proyek/Bulan (Juta)</Label>
                <Input type="number" value={avgRevenue} onChange={(e) => setAvgRevenue(Number(e.target.value) || 0)} />
              </div>
              <div>
                <div className="flex justify-between mb-2">
                  <Label className="text-xs">Rata-rata Margin</Label>
                  <span className="text-xs font-semibold">{avgMarginPct}%</span>
                </div>
                <Slider value={[avgMarginPct]} onValueChange={([v]) => setAvgMarginPct(v)} min={2} max={20} step={0.5} />
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
                <Label className="text-xs">2 proyek rugi bersamaan</Label>
                <Switch checked={twoProjectsLoss} onCheckedChange={setTwoProjectsLoss} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Harga material naik 20%</Label>
                <Switch checked={materialUp20} onCheckedChange={setMaterialUp20} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Bunga bank naik 3%</Label>
                <Switch checked={interestUp3} onCheckedChange={setInterestUp3} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Termin tertunda 90 hari</Label>
                <Switch checked={paymentDelay90} onCheckedChange={setPaymentDelay90} />
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Kurs USD naik 15%</Label>
                <Switch checked={usdUp15} onCheckedChange={setUsdUp15} />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Output */}
        <div className="space-y-4">
          {/* Main result */}
          <Card className={`${colors[survivalLevel].border} ${colors[survivalLevel].bg}`}>
            <CardContent className="pt-6 text-center">
              <div className={`text-5xl font-extrabold font-heading ${colors[survivalLevel].text}`}>
                {survivalMonths >= 999 ? "∞" : survivalMonths.toFixed(1)}
              </div>
              <p className="text-sm font-medium mt-1">
                {survivalMonths >= 999 ? "Perusahaan tetap profitable" : "bulan bertahan"}
              </p>
              <Badge className={`mt-2 ${survivalLevel === 'safe' ? 'bg-pub-emerald/15 text-pub-emerald' : survivalLevel === 'warning' ? 'bg-pub-amber/15 text-pub-amber' : 'bg-destructive/15 text-destructive'}`}>
                {survivalLevel === 'safe' ? '✅ AMAN' : survivalLevel === 'warning' ? '⚡ WASPADA' : survivalLevel === 'danger' ? '⚠️ BAHAYA' : '🚨 KRITIS'}
              </Badge>
            </CardContent>
          </Card>

          {/* Key metrics */}
          <Card>
            <CardContent className="pt-6">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Net Cash Normal</p>
                  <p className={`font-bold ${normalNetCash >= 0 ? 'text-pub-emerald' : 'text-destructive'}`}>Rp {fmt(normalNetCash)} Jt/bln</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Net Cash Stress</p>
                  <p className={`font-bold ${stressedNetCash >= 0 ? 'text-pub-emerald' : 'text-destructive'}`}>Rp {fmt(stressedNetCash)} Jt/bln</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Cadangan Kas</p>
                  <p className="font-bold">Rp {fmt(cashReserve)} Jt</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <p className="text-xs text-muted-foreground">Burn Rate</p>
                  <p className="font-bold text-destructive">Rp {fmt(burnRate)} Jt/bln</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Timeline */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Proyeksi Kas 12 Bulan</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-1">
                {timeline.map(({ month, balance }) => {
                  const pct = cashReserve > 0 ? (balance / cashReserve) * 100 : 0;
                  return (
                    <div key={month} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-6">B{month}</span>
                      <div className="flex-1 h-3 bg-muted rounded-full overflow-hidden relative">
                        <div
                          className={`h-full rounded-full transition-all ${balance >= 0 ? 'bg-pub-emerald' : 'bg-destructive'}`}
                          style={{ width: `${Math.max(Math.min(Math.abs(pct), 100), 2)}%` }}
                        />
                      </div>
                      <span className={`text-[9px] w-16 text-right ${balance < 0 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                        {fmt(balance)} Jt
                      </span>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
