import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DollarSign } from "lucide-react";

export default function TheftImpactCalculator() {
  const [assetValue, setAssetValue] = useState("");
  const [rentalCost, setRentalCost] = useState("");
  const [delayDays, setDelayDays] = useState("");
  const [dailyOverhead, setDailyOverhead] = useState("");
  const [adminCost, setAdminCost] = useState("");
  const [result, setResult] = useState<null | { total: number; breakdown: { label: string; value: number }[] }>(null);

  const calculate = () => {
    const asset = Number(assetValue) || 0;
    const rental = Number(rentalCost) || 0;
    const delay = Number(delayDays) || 0;
    const overhead = Number(dailyOverhead) || 0;
    const admin = Number(adminCost) || 0;
    const delayImpact = delay * overhead;
    const total = asset + rental + delayImpact + admin;
    setResult({
      total,
      breakdown: [
        { label: "Nilai Aset Hilang", value: asset },
        { label: "Biaya Sewa Pengganti", value: rental },
        { label: `Dampak Keterlambatan (${delay} hari)`, value: delayImpact },
        { label: "Biaya Administrasi & Laporan", value: admin },
      ],
    });
  };

  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(n);

  return (
    <div className="space-y-6">
      <Card className="border-red-500/30 bg-gradient-to-br from-red-50/50 to-background dark:from-red-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><DollarSign className="w-5 h-5 text-red-600" /> Theft Cost Impact Calculator</CardTitle>
          <p className="text-sm text-muted-foreground">Hitung total kerugian finansial per insiden pencurian/kehilangan.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label className="text-xs">Nilai Aset/Material Hilang (Rp)</Label><Input type="number" value={assetValue} onChange={e => setAssetValue(e.target.value)} /></div>
          <div><Label className="text-xs">Biaya Sewa Pengganti (Rp)</Label><Input type="number" value={rentalCost} onChange={e => setRentalCost(e.target.value)} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Hari Keterlambatan</Label><Input type="number" value={delayDays} onChange={e => setDelayDays(e.target.value)} /></div>
            <div><Label className="text-xs">Overhead/Hari (Rp)</Label><Input type="number" value={dailyOverhead} onChange={e => setDailyOverhead(e.target.value)} /></div>
          </div>
          <div><Label className="text-xs">Biaya Administrasi (Rp)</Label><Input type="number" value={adminCost} onChange={e => setAdminCost(e.target.value)} /></div>
          <Button onClick={calculate} className="w-full bg-red-600 hover:bg-red-700 text-white">Hitung Total Kerugian</Button>
        </CardContent>
      </Card>
      {result && (
        <Card><CardContent className="pt-6 space-y-3">
          <div className="text-center"><p className="text-3xl font-bold text-destructive">Rp {fmt(result.total)}</p><p className="text-sm text-muted-foreground">Total Financial Impact</p></div>
          {result.breakdown.map((b, i) => (
            <div key={i} className="flex justify-between p-2 rounded bg-muted/50"><span className="text-sm">{b.label}</span><span className="text-sm font-semibold">Rp {fmt(b.value)}</span></div>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}
