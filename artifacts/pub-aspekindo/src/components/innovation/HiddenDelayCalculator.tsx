import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Clock, CalendarClock } from "lucide-react";

const DELAY_FACTORS = [
  { id: "weather", label: "Musim hujan / cuaca ekstrem", days: 30 },
  { id: "permit", label: "Perizinan (IMB/PBG/AMDAL)", days: 45 },
  { id: "import", label: "Lead time material impor", days: 60 },
  { id: "owner", label: "Koordinasi/approval owner lambat", days: 21 },
  { id: "utility", label: "Relokasi utilitas (listrik/air/gas)", days: 30 },
  { id: "access", label: "Akses jalan sempit / terbatas", days: 14 },
  { id: "testing", label: "Testing & commissioning", days: 21 },
  { id: "labor", label: "Kekurangan tenaga kerja", days: 14 },
  { id: "land", label: "Pembebasan lahan belum selesai", days: 60 },
  { id: "design", label: "Revisi desain di tengah proyek", days: 30 },
];

export default function HiddenDelayCalculator() {
  const [contractDuration, setContractDuration] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    const next = new Set(checked);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setChecked(next);
  };

  const totalHidden = DELAY_FACTORS.filter(f => checked.has(f.id)).reduce((s, f) => s + f.days, 0);
  const cd = Number(contractDuration) || 0;
  const pct = cd > 0 ? ((totalHidden / cd) * 100).toFixed(1) : "0";
  const adjusted = cd + totalHidden;

  return (
    <div className="space-y-6">
      <Card className="border-sky-500/30 bg-gradient-to-br from-sky-50/50 to-background dark:from-sky-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Clock className="w-5 h-5 text-sky-600" /> Hidden Delay Factor Library</CardTitle>
          <p className="text-sm text-muted-foreground">Faktor keterlambatan tersembunyi yang sering tidak diperhitungkan saat planning.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label className="text-xs">Durasi Kontrak (hari kalender)</Label><Input type="number" placeholder="365" value={contractDuration} onChange={e => setContractDuration(e.target.value)} /></div>
          <div className="space-y-2">
            {DELAY_FACTORS.map(f => (
              <label key={f.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-muted/50 ${checked.has(f.id) ? "bg-amber-50 dark:bg-amber-950/20" : ""}`}>
                <Checkbox checked={checked.has(f.id)} onCheckedChange={() => toggle(f.id)} />
                <span className="text-sm flex-1">{f.label}</span>
                <Badge variant="outline" className="text-xs">+{f.days} hari</Badge>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>
      {checked.size > 0 && cd > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-2xl font-bold">{cd}</p><p className="text-xs text-muted-foreground">Durasi Kontrak</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20">
                <p className="text-2xl font-bold text-amber-600">+{totalHidden}</p><p className="text-xs text-muted-foreground">Hidden Delay</p>
              </div>
              <div className="p-3 rounded-lg bg-destructive/10">
                <CalendarClock className="w-4 h-4 mx-auto text-destructive" />
                <p className="text-2xl font-bold text-destructive">{adjusted}</p><p className="text-xs text-muted-foreground">Durasi Realistis</p>
              </div>
            </div>
            <p className="text-sm text-center mt-3 text-muted-foreground">Potensi keterlambatan tersembunyi: <strong className="text-amber-600">{pct}%</strong> dari durasi kontrak</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
