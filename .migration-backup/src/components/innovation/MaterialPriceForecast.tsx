import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Plus, Trash2 } from "lucide-react";

interface MaterialEntry { name: string; price3mo: string; price2mo: string; price1mo: string; priceNow: string }

export default function MaterialPriceForecast() {
  const [materials, setMaterials] = useState<MaterialEntry[]>([{ name: "", price3mo: "", price2mo: "", price1mo: "", priceNow: "" }]);
  const [results, setResults] = useState<{ name: string; trend: number; forecast: number; risk: string }[]>([]);

  const add = () => setMaterials([...materials, { name: "", price3mo: "", price2mo: "", price1mo: "", priceNow: "" }]);
  const remove = (i: number) => setMaterials(materials.filter((_, idx) => idx !== i));
  const update = (i: number, f: keyof MaterialEntry, v: string) => { const c = [...materials]; c[i][f] = v; setMaterials(c); };
  const fmt = (n: number) => new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);

  const forecast = () => {
    setResults(materials.filter(m => m.name && m.priceNow).map(m => {
      const prices = [Number(m.price3mo), Number(m.price2mo), Number(m.price1mo), Number(m.priceNow)].filter(p => p > 0);
      if (prices.length < 2) return { name: m.name, trend: 0, forecast: Number(m.priceNow), risk: "low" };
      const avgChange = prices.slice(1).reduce((acc, p, i) => acc + ((p - prices[i]) / prices[i]) * 100, 0) / (prices.length - 1);
      const forecastPrice = Number(m.priceNow) * (1 + avgChange / 100);
      const risk = avgChange > 5 ? "high" : avgChange > 2 ? "medium" : "low";
      return { name: m.name, trend: avgChange, forecast: forecastPrice, risk };
    }));
  };

  return (
    <div className="space-y-6">
      <Card className="border-pub-sky/30 bg-gradient-to-br from-sky-50/50 to-background dark:from-sky-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><TrendingUp className="w-5 h-5 text-pub-sky" /> Material Price Forecast</CardTitle>
          <p className="text-sm text-muted-foreground">Prediksi tren harga material berdasarkan data 3 bulan terakhir.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          {materials.map((m, i) => (
            <div key={i} className="grid grid-cols-6 gap-2 items-end">
              <div><Label className="text-xs">Material</Label><Input placeholder="Besi" value={m.name} onChange={e => update(i, "name", e.target.value)} /></div>
              <div><Label className="text-xs">3 Bln Lalu</Label><Input type="number" value={m.price3mo} onChange={e => update(i, "price3mo", e.target.value)} /></div>
              <div><Label className="text-xs">2 Bln Lalu</Label><Input type="number" value={m.price2mo} onChange={e => update(i, "price2mo", e.target.value)} /></div>
              <div><Label className="text-xs">1 Bln Lalu</Label><Input type="number" value={m.price1mo} onChange={e => update(i, "price1mo", e.target.value)} /></div>
              <div><Label className="text-xs">Harga Saat Ini</Label><Input type="number" value={m.priceNow} onChange={e => update(i, "priceNow", e.target.value)} /></div>
              {materials.length > 1 && <Button variant="ghost" size="icon" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>}
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={add}><Plus className="w-3 h-3 mr-1" />Tambah</Button>
            <Button onClick={forecast} className="bg-pub-sky hover:bg-pub-sky/90 text-white">Prediksi Harga</Button>
          </div>
        </CardContent>
      </Card>
      {results.length > 0 && (
        <Card><CardContent className="pt-6 space-y-2">
          {results.map((r, i) => (
            <div key={i} className={`p-3 rounded-lg border flex justify-between items-center ${r.risk === "high" ? "border-destructive/40 bg-destructive/5" : r.risk === "medium" ? "border-amber-500/40 bg-amber-50 dark:bg-amber-950/20" : "border-emerald-500/40"}`}>
              <div><p className="text-sm font-semibold">{r.name}</p><p className="text-xs text-muted-foreground">Prediksi bulan depan: Rp {fmt(r.forecast)}</p></div>
              <Badge variant={r.risk === "high" ? "destructive" : "secondary"} className={r.risk === "medium" ? "bg-amber-500 text-white" : r.risk === "low" ? "bg-emerald-600 text-white" : ""}>
                {r.trend > 0 ? "+" : ""}{r.trend.toFixed(1)}%/bln
              </Badge>
            </div>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}
