import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wind, Volume2, AlertTriangle, Shield } from "lucide-react";

type RiskLevel = "Kritis" | "Sedang" | "Rendah";

const WORK_CATEGORIES = [
  { id: "demolition", label: "Pembongkaran Bangunan", dustFactor: 9, noiseFactor: 9 },
  { id: "piling", label: "Pemancangan Tiang", dustFactor: 4, noiseFactor: 10 },
  { id: "excavation", label: "Galian & Pengerukan", dustFactor: 8, noiseFactor: 6 },
  { id: "concrete", label: "Pengecoran Beton", dustFactor: 3, noiseFactor: 5 },
  { id: "steelwork", label: "Pemasangan Baja", dustFactor: 2, noiseFactor: 7 },
  { id: "asphalt", label: "Penghamparan Aspal", dustFactor: 6, noiseFactor: 5 },
];

export default function DustNoiseIndex() {
  const [workType, setWorkType] = useState("demolition");
  const [density, setDensity] = useState([5]); // kepadatan penduduk 1-10
  const [distance, setDistance] = useState([3]); // jarak km (0.1-5)
  const [hours, setHours] = useState([10]); // jam kerja/hari
  const [duration, setDuration] = useState([30]); // hari
  const [result, setResult] = useState<null | {
    dustScore: number; noiseScore: number; totalScore: number;
    level: RiskLevel; mitigations: string[];
  }>(null);

  const calculate = () => {
    const wt = WORK_CATEGORIES.find((w) => w.id === workType)!;
    const distFactor = Math.max(1, 6 - distance[0]); // closer = higher risk
    const hourFactor = hours[0] > 8 ? 1.3 : hours[0] > 12 ? 1.6 : 1;
    const durationFactor = duration[0] > 60 ? 1.4 : duration[0] > 30 ? 1.2 : 1;

    const dustScore = Math.min(10, (wt.dustFactor * density[0] * distFactor * hourFactor * durationFactor) / 30);
    const noiseScore = Math.min(10, (wt.noiseFactor * density[0] * distFactor * hourFactor * durationFactor) / 30);
    const totalScore = (dustScore + noiseScore) / 2;

    const level: RiskLevel = totalScore >= 7 ? "Kritis" : totalScore >= 4 ? "Sedang" : "Rendah";

    const mitigations: string[] = [];
    if (dustScore >= 4) mitigations.push("🚿 Penyiraman berkala setiap 2 jam");
    if (dustScore >= 6) mitigations.push("🧱 Pasang hoarding/pagar pelindung debu");
    if (dustScore >= 7) mitigations.push("💨 Gunakan dust suppression system");
    if (noiseScore >= 4) mitigations.push("🕐 Batasi jam kerja: 08:00-17:00");
    if (noiseScore >= 6) mitigations.push("🔇 Pasang sound barrier/peredam");
    if (noiseScore >= 7) mitigations.push("📢 Sosialisasi warga + hotline pengaduan");
    if (totalScore >= 5) mitigations.push("📋 Monitoring harian & dokumentasi foto");
    if (totalScore >= 7) mitigations.push("⚠️ Sediakan dana mitigasi protes masyarakat");

    setResult({ dustScore, noiseScore, totalScore, level, mitigations });
  };

  const levelColor = result?.level === "Kritis" ? "destructive" : result?.level === "Sedang" ? "default" : "secondary";

  return (
    <div className="space-y-6">
      <Card className="border-teal-500/30 bg-gradient-to-br from-teal-50/50 to-background dark:from-teal-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wind className="w-5 h-5 text-teal-600" />
            Dust & Noise Risk Index
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Hitung skor risiko protes masyarakat dari debu & kebisingan proyek.
          </p>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label className="text-xs">Jenis Pekerjaan</Label>
            <Select value={workType} onValueChange={setWorkType}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {WORK_CATEGORIES.map((w) => (
                  <SelectItem key={w.id} value={w.id}>{w.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Kepadatan Penduduk Sekitar: {density[0]}/10</Label>
            <Slider value={density} onValueChange={setDensity} min={1} max={10} step={1} />
          </div>

          <div>
            <Label className="text-xs">Jarak ke Permukiman: {distance[0]} km</Label>
            <Slider value={distance} onValueChange={setDistance} min={1} max={10} step={1} />
          </div>

          <div>
            <Label className="text-xs">Jam Kerja/Hari: {hours[0]} jam</Label>
            <Slider value={hours} onValueChange={setHours} min={6} max={16} step={1} />
          </div>

          <div>
            <Label className="text-xs">Durasi Pekerjaan: {duration[0]} hari</Label>
            <Slider value={duration} onValueChange={setDuration} min={7} max={180} step={7} />
          </div>

          <Button onClick={calculate} className="w-full bg-teal-600 hover:bg-teal-700 text-white">
            Hitung Risk Index
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Hasil Analisis Risiko</CardTitle>
              <Badge variant={levelColor} className={result.level === "Sedang" ? "bg-amber-500 text-white" : ""}>
                {result.level}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <Wind className="w-5 h-5 mx-auto mb-1 text-amber-600" />
                <p className="text-2xl font-bold">{result.dustScore.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Skor Debu</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-muted/50">
                <Volume2 className="w-5 h-5 mx-auto mb-1 text-blue-600" />
                <p className="text-2xl font-bold">{result.noiseScore.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Skor Kebisingan</p>
              </div>
              <div className={`text-center p-3 rounded-lg ${
                result.totalScore >= 7 ? "bg-destructive/10" : result.totalScore >= 4 ? "bg-amber-100 dark:bg-amber-950/30" : "bg-emerald-100 dark:bg-emerald-950/30"
              }`}>
                <AlertTriangle className={`w-5 h-5 mx-auto mb-1 ${
                  result.totalScore >= 7 ? "text-destructive" : result.totalScore >= 4 ? "text-amber-600" : "text-emerald-600"
                }`} />
                <p className="text-2xl font-bold">{result.totalScore.toFixed(1)}</p>
                <p className="text-xs text-muted-foreground">Total Risiko</p>
              </div>
            </div>

            {result.mitigations.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold flex items-center gap-1">
                  <Shield className="w-4 h-4 text-teal-600" /> Rekomendasi Mitigasi
                </p>
                <ul className="space-y-1">
                  {result.mitigations.map((m, i) => (
                    <li key={i} className="text-sm p-2 rounded bg-muted/50">{m}</li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
