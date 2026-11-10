import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp } from "lucide-react";

export default function TenderRiskScorecard() {
  const [projectValue, setProjectValue] = useState("");
  const [complexity, setComplexity] = useState([5]);
  const [ownerTrack, setOwnerTrack] = useState([5]);
  const [cashReserve, setCashReserve] = useState([5]);
  const [competition, setCompetition] = useState([5]);
  const [teamExperience, setTeamExperience] = useState([5]);
  const [result, setResult] = useState<null | { score: number; verdict: string; tips: string[] }>(null);

  const calculate = () => {
    const s = (10 - complexity[0]) * 20 + ownerTrack[0] * 15 + cashReserve[0] * 25 + (10 - competition[0]) * 15 + teamExperience[0] * 25;
    const score = Math.round(s / 10);
    const tips: string[] = [];
    if (complexity[0] >= 7) tips.push("Proyek kompleks → siapkan contingency ekstra 5-8%");
    if (ownerTrack[0] <= 3) tips.push("Track record owner buruk → minta payment guarantee");
    if (cashReserve[0] <= 3) tips.push("Kas terbatas → pertimbangkan JO atau kredit modal kerja");
    if (competition[0] >= 7) tips.push("Kompetisi ketat → margin tipis, hitung ulang risiko");
    if (teamExperience[0] <= 3) tips.push("Tim belum berpengalaman → rekrut tenaga ahli/konsultan");
    const verdict = score >= 75 ? "Layak Diikuti" : score >= 50 ? "Perlu Pertimbangan" : "Sebaiknya Lewati";
    setResult({ score, verdict, tips });
  };

  return (
    <div className="space-y-6">
      <Card className="border-orange-500/30 bg-gradient-to-br from-orange-50/50 to-background dark:from-orange-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg"><Target className="w-5 h-5 text-orange-600" /> Tender Risk Scorecard</CardTitle>
          <p className="text-sm text-muted-foreground">Evaluasi kelayakan mengikuti tender berdasarkan 5 faktor kunci.</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div><Label className="text-xs">Nilai Proyek (Rp)</Label><Input type="number" placeholder="25000000000" value={projectValue} onChange={e => setProjectValue(e.target.value)} /></div>
          <div><Label className="text-xs">Kompleksitas Proyek: {complexity[0]}/10</Label><Slider value={complexity} onValueChange={setComplexity} min={1} max={10} step={1} /></div>
          <div><Label className="text-xs">Track Record Owner: {ownerTrack[0]}/10</Label><Slider value={ownerTrack} onValueChange={setOwnerTrack} min={1} max={10} step={1} /></div>
          <div><Label className="text-xs">Cadangan Kas: {cashReserve[0]}/10</Label><Slider value={cashReserve} onValueChange={setCashReserve} min={1} max={10} step={1} /></div>
          <div><Label className="text-xs">Tingkat Kompetisi: {competition[0]}/10</Label><Slider value={competition} onValueChange={setCompetition} min={1} max={10} step={1} /></div>
          <div><Label className="text-xs">Pengalaman Tim: {teamExperience[0]}/10</Label><Slider value={teamExperience} onValueChange={setTeamExperience} min={1} max={10} step={1} /></div>
          <Button onClick={calculate} className="w-full bg-orange-600 hover:bg-orange-700 text-white">Hitung Skor Kelayakan</Button>
        </CardContent>
      </Card>
      {result && (
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="text-center">
              <p className={`text-4xl font-bold ${result.score >= 75 ? "text-emerald-600" : result.score >= 50 ? "text-amber-600" : "text-destructive"}`}>{result.score}</p>
              <Badge className={result.score >= 75 ? "bg-emerald-600" : result.score >= 50 ? "bg-amber-500" : "bg-destructive"}>{result.verdict}</Badge>
            </div>
            {result.tips.length > 0 && (
              <div className="space-y-1">{result.tips.map((t, i) => <p key={i} className="text-sm p-2 rounded bg-muted/50"><TrendingUp className="w-3 h-3 inline mr-1" />{t}</p>)}</div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
