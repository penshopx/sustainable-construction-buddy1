import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Leaf } from "lucide-react";

const SOURCES = [
  { id: "diesel", label: "Solar/Diesel Alat Berat (liter)", factor: 2.68, unit: "kg CO₂/liter" },
  { id: "concrete", label: "Beton (m³)", factor: 300, unit: "kg CO₂/m³" },
  { id: "steel", label: "Baja (ton)", factor: 1800, unit: "kg CO₂/ton" },
  { id: "asphalt", label: "Aspal (ton)", factor: 250, unit: "kg CO₂/ton" },
  { id: "transport", label: "Transport Material (km × ton)", factor: 0.1, unit: "kg CO₂/ton-km" },
];

export default function CarbonCostTool() {
  const [values, setValues] = useState<Record<string, string>>({});
  const [carbonPrice, setCarbonPrice] = useState("150000"); // Rp/ton CO2

  const update = (id: string, v: string) => setValues({ ...values, [id]: v });
  const fmt = (n: number) => new Intl.NumberFormat("id-ID").format(Math.round(n));

  const results = SOURCES.map(s => {
    const qty = Number(values[s.id]) || 0;
    const emission = qty * s.factor / 1000; // ton CO2
    return { ...s, qty, emission };
  });
  const totalEmission = results.reduce((s, r) => s + r.emission, 0);
  const totalCost = totalEmission * (Number(carbonPrice) || 0);

  return (
    <div className="space-y-6">
      <Card className="border-teal-500/30 bg-gradient-to-br from-teal-50/50 to-background dark:from-teal-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Leaf className="w-5 h-5 text-teal-600" /> Carbon Cost Awareness Tool</CardTitle>
          <p className="text-sm text-muted-foreground">Estimasi emisi karbon dan biaya karbon tersembunyi proyek.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {SOURCES.map(s => (
            <div key={s.id}><Label className="text-xs">{s.label} <span className="text-muted-foreground">({s.unit})</span></Label>
              <Input type="number" placeholder="0" value={values[s.id] || ""} onChange={e => update(s.id, e.target.value)} /></div>
          ))}
          <div><Label className="text-xs">Harga Karbon (Rp/ton CO₂)</Label><Input type="number" value={carbonPrice} onChange={e => setCarbonPrice(e.target.value)} /></div>
        </CardContent>
      </Card>
      {totalEmission > 0 && (
        <Card><CardContent className="pt-6 space-y-3">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="p-3 rounded-lg bg-teal-50 dark:bg-teal-950/20">
              <Leaf className="w-5 h-5 mx-auto text-teal-600" />
              <p className="text-2xl font-bold">{totalEmission.toFixed(1)}</p><p className="text-xs text-muted-foreground">ton CO₂</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20">
              <p className="text-2xl font-bold text-amber-600">Rp {fmt(totalCost)}</p><p className="text-xs text-muted-foreground">Biaya Karbon Tersembunyi</p>
            </div>
          </div>
          {results.filter(r => r.emission > 0).map((r, i) => (
            <div key={i} className="flex justify-between p-2 rounded bg-muted/50 text-sm">
              <span>{r.label}</span><Badge variant="outline">{r.emission.toFixed(1)} ton CO₂</Badge>
            </div>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}
