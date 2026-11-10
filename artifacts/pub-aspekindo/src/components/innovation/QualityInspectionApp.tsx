import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ClipboardCheck } from "lucide-react";

const defaultItems = [
  { category: "Struktur", item: "Tulangan sesuai gambar kerja", checked: false },
  { category: "Struktur", item: "Cover beton terpasang benar", checked: false },
  { category: "Struktur", item: "Bekisting rapat dan stabil", checked: false },
  { category: "Material", item: "Slump test beton sesuai spec", checked: false },
  { category: "Material", item: "Sertifikat material tersedia", checked: false },
  { category: "Material", item: "Penyimpanan material aman", checked: false },
  { category: "Finishing", item: "Dimensi sesuai toleransi", checked: false },
  { category: "Finishing", item: "Permukaan rata dan bersih", checked: false },
  { category: "K3", item: "APD lengkap digunakan", checked: false },
  { category: "K3", item: "Rambu keselamatan terpasang", checked: false },
];

export default function QualityInspectionApp() {
  const [items, setItems] = useState(defaultItems);
  const [inspector, setInspector] = useState("");
  const [location, setLocation] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const toggle = (i: number) => { const c = [...items]; c[i].checked = !c[i].checked; setItems(c); };
  const checked = items.filter(it => it.checked).length;
  const score = Math.round((checked / items.length) * 100);
  const categories = [...new Set(items.map(it => it.category))];

  return (
    <div className="space-y-6">
      <Card className="border-pub-emerald/30 bg-gradient-to-br from-emerald-50/50 to-background dark:from-emerald-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><ClipboardCheck className="w-5 h-5 text-pub-emerald" /> Mobile Quality Inspection</CardTitle>
          <p className="text-sm text-muted-foreground">Checklist mutu digital lapangan – 10 item inspeksi standar.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Inspektor</Label><Input value={inspector} onChange={e => setInspector(e.target.value)} placeholder="Nama inspektor" /></div>
            <div><Label className="text-xs">Lokasi</Label><Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Lantai 3, Zona A" /></div>
          </div>
          {categories.map(cat => (
            <div key={cat}>
              <p className="text-xs font-bold text-muted-foreground mb-2">{cat}</p>
              {items.map((it, i) => it.category === cat && (
                <label key={i} className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer">
                  <Checkbox checked={it.checked} onCheckedChange={() => toggle(i)} />
                  <span className="text-sm">{it.item}</span>
                </label>
              ))}
            </div>
          ))}
          <Button onClick={() => setSubmitted(true)} className="w-full bg-pub-emerald hover:bg-pub-emerald/90 text-white">
            Submit Inspeksi ({checked}/{items.length})
          </Button>
        </CardContent>
      </Card>
      {submitted && (
        <Card><CardContent className="pt-6 text-center space-y-2">
          <p className={`text-4xl font-bold ${score >= 80 ? "text-emerald-600" : score >= 60 ? "text-amber-600" : "text-destructive"}`}>{score}%</p>
          <Badge className={score >= 80 ? "bg-emerald-600" : score >= 60 ? "bg-amber-500" : "bg-destructive"}>{score >= 80 ? "Lulus" : score >= 60 ? "Perlu Perbaikan" : "Tidak Lulus"}</Badge>
          <p className="text-xs text-muted-foreground">{inspector && `Inspektor: ${inspector}`} {location && `| Lokasi: ${location}`}</p>
        </CardContent></Card>
      )}
    </div>
  );
}
