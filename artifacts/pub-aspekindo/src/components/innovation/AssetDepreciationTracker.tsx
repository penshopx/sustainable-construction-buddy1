import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { HardHat, TrendingDown } from "lucide-react";

const EQUIPMENT = [
  { id: "excavator", label: "Excavator PC200", depRate: 12.5, lifeYears: 8 },
  { id: "bulldozer", label: "Bulldozer D6", depRate: 10, lifeYears: 10 },
  { id: "crane", label: "Crane 25T", depRate: 8, lifeYears: 12 },
  { id: "wheel-loader", label: "Wheel Loader", depRate: 12.5, lifeYears: 8 },
  { id: "dump-truck", label: "Dump Truck 20T", depRate: 14.3, lifeYears: 7 },
  { id: "batching", label: "Batching Plant", depRate: 6.7, lifeYears: 15 },
];

export default function AssetDepreciationTracker() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [ages, setAges] = useState<Record<string, number[]>>({});

  const update = (id: string, v: string) => setValues({ ...values, [id]: v });
  const updateAge = (id: string, v: number[]) => setAges({ ...ages, [id]: v });
  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));

  const results = EQUIPMENT.map(e => {
    const purchase = Number(values[e.id]) || 0;
    const age = (ages[e.id] || [0])[0];
    const depPerYear = purchase * (e.depRate / 100);
    const totalDep = depPerYear * age;
    const bookValue = Math.max(0, purchase - totalDep);
    const remainingLife = Math.max(0, e.lifeYears - age);
    return { ...e, purchase, age, depPerYear, bookValue, remainingLife };
  }).filter(r => r.purchase > 0);

  const totalBook = results.reduce((s, r) => s + r.bookValue, 0);
  const totalDep = results.reduce((s, r) => s + (r.purchase - r.bookValue), 0);

  return (
    <div className="space-y-6">
      <Card className="border-red-500/30 bg-gradient-to-br from-red-50/50 to-background dark:from-red-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><HardHat className="w-5 h-5 text-red-600" /> Asset Depreciation Tracker</CardTitle>
          <p className="text-sm text-muted-foreground">Lacak nilai buku aset alat berat dan rencana penggantian.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {EQUIPMENT.map(e => (
            <div key={e.id} className="p-3 border rounded-lg space-y-2">
              <p className="text-sm font-semibold">{e.label} <span className="text-muted-foreground text-xs">(umur ekonomis: {e.lifeYears} thn)</span></p>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Harga Perolehan (Rp)</Label><Input type="number" value={values[e.id] || ""} onChange={ev => update(e.id, ev.target.value)} /></div>
                <div><Label className="text-xs">Umur Saat Ini: {(ages[e.id] || [0])[0]} tahun</Label><Slider value={ages[e.id] || [0]} onValueChange={v => updateAge(e.id, v)} min={0} max={e.lifeYears + 5} step={1} /></div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
      {results.length > 0 && (
        <Card><CardContent className="pt-6 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-3 rounded-lg bg-muted/50"><p className="text-xl font-bold">Rp {fmt(totalBook)}</p><p className="text-xs text-muted-foreground">Total Nilai Buku</p></div>
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20"><p className="text-xl font-bold text-amber-600">Rp {fmt(totalDep)}</p><p className="text-xs text-muted-foreground">Total Penyusutan</p></div>
          </div>
          {results.map((r, i) => (
            <div key={i} className={`p-2 rounded-lg border flex justify-between ${r.remainingLife <= 1 ? "border-destructive/40 bg-destructive/5" : ""}`}>
              <div><p className="text-sm font-semibold">{r.label}</p><p className="text-xs text-muted-foreground">Nilai buku: Rp {fmt(r.bookValue)}</p></div>
              <Badge variant={r.remainingLife <= 1 ? "destructive" : "secondary"}>{r.remainingLife <= 0 ? "Perlu Ganti" : `Sisa ${r.remainingLife} thn`}</Badge>
            </div>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}
