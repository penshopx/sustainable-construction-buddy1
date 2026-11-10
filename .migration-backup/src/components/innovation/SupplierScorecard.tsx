import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Star, Plus, Trash2 } from "lucide-react";

interface Vendor { name: string; quality: number[]; delivery: number[]; price: number[]; responsiveness: number[]; compliance: number[] }

export default function SupplierScorecard() {
  const [vendors, setVendors] = useState<Vendor[]>([{ name: "", quality: [5], delivery: [5], price: [5], responsiveness: [5], compliance: [5] }]);
  const [results, setResults] = useState<{ name: string; score: number; grade: string }[]>([]);

  const add = () => setVendors([...vendors, { name: "", quality: [5], delivery: [5], price: [5], responsiveness: [5], compliance: [5] }]);
  const remove = (i: number) => setVendors(vendors.filter((_, idx) => idx !== i));

  const calculate = () => {
    setResults(vendors.filter(v => v.name).map(v => {
      const score = Math.round((v.quality[0] * 25 + v.delivery[0] * 25 + v.price[0] * 20 + v.responsiveness[0] * 15 + v.compliance[0] * 15) / 10);
      const grade = score >= 80 ? "A" : score >= 65 ? "B" : score >= 50 ? "C" : "D";
      return { name: v.name, score, grade };
    }));
  };

  return (
    <div className="space-y-6">
      <Card className="border-pub-amber/30 bg-gradient-to-br from-amber-50/50 to-background dark:from-amber-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Star className="w-5 h-5 text-pub-amber" /> Supplier Reliability Scorecard</CardTitle>
          <p className="text-sm text-muted-foreground">Nilai kinerja vendor berdasarkan mutu, waktu, harga, responsivitas, dan kepatuhan.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          {vendors.map((v, i) => (
            <div key={i} className="p-4 border rounded-lg space-y-3">
              <div className="flex items-center gap-2">
                <Input placeholder="Nama Vendor" value={v.name} onChange={e => { const c = [...vendors]; c[i].name = e.target.value; setVendors(c); }} className="flex-1" />
                {vendors.length > 1 && <Button variant="ghost" size="icon" onClick={() => remove(i)}><Trash2 className="w-3 h-3" /></Button>}
              </div>
              {[
                { key: "quality" as const, label: "Mutu Material" },
                { key: "delivery" as const, label: "Ketepatan Waktu" },
                { key: "price" as const, label: "Daya Saing Harga" },
                { key: "responsiveness" as const, label: "Responsivitas" },
                { key: "compliance" as const, label: "Kepatuhan Dokumen" },
              ].map(f => (
                <div key={f.key}><Label className="text-xs">{f.label}: {v[f.key][0]}/10</Label><Slider value={v[f.key]} onValueChange={val => { const c = [...vendors]; c[i][f.key] = val; setVendors(c); }} min={1} max={10} step={1} /></div>
              ))}
            </div>
          ))}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={add}><Plus className="w-3 h-3 mr-1" />Tambah Vendor</Button>
            <Button onClick={calculate} className="bg-pub-amber hover:bg-pub-amber/90 text-white">Hitung Skor</Button>
          </div>
        </CardContent>
      </Card>
      {results.length > 0 && (
        <Card><CardContent className="pt-6 space-y-2">
          {results.sort((a, b) => b.score - a.score).map((r, i) => (
            <div key={i} className="p-3 rounded-lg border flex justify-between items-center">
              <div><p className="text-sm font-semibold">#{i + 1} {r.name}</p><p className="text-xs text-muted-foreground">Skor: {r.score}/100</p></div>
              <Badge className={r.grade === "A" ? "bg-emerald-600 text-white" : r.grade === "B" ? "bg-pub-sky text-white" : r.grade === "C" ? "bg-amber-500 text-white" : "bg-destructive"}>Grade {r.grade}</Badge>
            </div>
          ))}
        </CardContent></Card>
      )}
    </div>
  );
}
