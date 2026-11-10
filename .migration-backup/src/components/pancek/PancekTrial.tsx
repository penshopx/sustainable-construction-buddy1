import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { motion } from "framer-motion";
import { PANCEK_PILLARS, TOTAL_INDICATORS } from "@/lib/pancekIndicators";
import { calculatePillarScoresFromAnswers, calculateWeightedScore, countAnswered, type PancekAnswers, type IndicatorAnswer } from "@/lib/pancekAnswerTypes";
import IndicatorFormItem from "@/components/pancek/IndicatorFormItem";
import {
  FlaskConical, CheckCircle2, AlertTriangle, XCircle, Target, ExternalLink,
  RotateCcw, TrendingUp, ShieldCheck, Copy,
} from "lucide-react";
import { toast } from "@/components/ui/sonner-toast";

interface PancekTrialProps {
  onCopyToOfficial?: (answers: PancekAnswers) => void;
}

function getReadinessLevel(pct: number) {
  if (pct >= 90) return { label: "Sangat Siap", color: "text-pub-emerald", bg: "bg-pub-emerald/10 border-pub-emerald/30", icon: ShieldCheck };
  if (pct >= 70) return { label: "Siap", color: "text-pub-emerald", bg: "bg-pub-emerald/5 border-pub-emerald/20", icon: CheckCircle2 };
  if (pct >= 50) return { label: "Cukup", color: "text-pub-amber", bg: "bg-pub-amber/10 border-pub-amber/30", icon: TrendingUp };
  if (pct >= 30) return { label: "Perlu Perbaikan", color: "text-pub-amber", bg: "bg-pub-amber/5 border-pub-amber/20", icon: AlertTriangle };
  return { label: "Belum Siap", color: "text-destructive", bg: "bg-destructive/5 border-destructive/20", icon: XCircle };
}

export default function PancekTrial({ onCopyToOfficial }: PancekTrialProps) {
  const [answers, setAnswers] = useState<PancekAnswers>({});

  const pillarScores = calculatePillarScoresFromAnswers(answers, PANCEK_PILLARS);
  const weightedScore = calculateWeightedScore(answers, PANCEK_PILLARS);
  const totalAnswered = countAnswered(answers);
  const completionPct = Math.round((totalAnswered / TOTAL_INDICATORS) * 100);
  const readiness = getReadinessLevel(weightedScore);
  const ReadinessIcon = readiness.icon;

  const handleIndicatorChange = (code: string, answer: IndicatorAnswer) => {
    setAnswers(prev => ({ ...prev, [code]: answer }));
  };

  const handleReset = () => {
    setAnswers({});
    toast.success("Simulasi direset");
  };

  const handleCopyToOfficial = () => {
    if (onCopyToOfficial) {
      onCopyToOfficial(answers);
      toast.success("Data simulasi disalin ke form resmi");
    }
  };

  const pillarAnalysis = PANCEK_PILLARS.map(p => ({
    ...p,
    score: pillarScores[p.id] || 0,
    total: p.indicators.length,
    pct: Math.round(((pillarScores[p.id] || 0) / p.indicators.length) * 100),
    missing: p.indicators.filter(ind => {
      const ans = answers[ind.code];
      return !ans || (ans.status !== "ya" && ans.status !== "sebagian");
    }),
  })).sort((a, b) => a.pct - b.pct);

  return (
    <div className="space-y-6">
      {/* Trial Header Banner */}
      <Card className="border-2 border-dashed border-pub-sky/40 bg-pub-sky/5">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-pub-sky/20 flex items-center justify-center shrink-0">
              <FlaskConical className="w-5 h-5 text-pub-sky" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-heading font-bold text-foreground flex items-center gap-2">
                Mode Simulasi PANCEK
                <Badge className="bg-pub-sky/20 text-pub-sky border-pub-sky/30 text-[10px]">Trial</Badge>
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Latihan pengisian PANCEK KPK sebelum upload ke platform Jaga.id. Data simulasi <strong>tidak tersimpan</strong> di database — 
                gunakan untuk evaluasi kesiapan perusahaan Anda.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Readiness Dashboard */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <Card className={`border-2 ${readiness.bg}`}>
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row md:items-center gap-6">
              <div className="flex items-center gap-4 flex-1">
                <div className={`w-16 h-16 rounded-xl flex items-center justify-center ${readiness.bg}`}>
                  <ReadinessIcon className={`w-8 h-8 ${readiness.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-heading">Tingkat Kesiapan</p>
                  <p className={`text-2xl font-bold font-heading ${readiness.color}`}>{readiness.label}</p>
                  <p className="text-sm text-muted-foreground">Skor Tertimbang: <strong className={readiness.color}>{weightedScore}/100</strong></p>
                  <p className="text-xs text-muted-foreground">{totalAnswered}/{TOTAL_INDICATORS} indikator terpenuhi ({completionPct}%)</p>
                </div>
              </div>
              <div className="flex-1">
                <Progress value={weightedScore} className="h-4" />
                <div className="flex justify-between mt-2 text-[10px] text-muted-foreground font-heading">
                  <span>0%</span>
                  <span className="text-pub-amber">50% min</span>
                  <span className="text-pub-emerald">100%</span>
                </div>
              </div>
            </div>

            <Separator className="my-4" />
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
              {PANCEK_PILLARS.map(p => {
                const score = pillarScores[p.id] || 0;
                const total = p.indicators.length;
                const pct = Math.round((score / total) * 100);
                return (
                  <div key={p.id} className="text-center p-3 rounded-lg bg-background/50 border border-border">
                    <div className="text-lg">{p.icon}</div>
                    <p className="text-[10px] text-muted-foreground font-heading truncate">{p.label}</p>
                    <p className="text-[9px] text-muted-foreground/60 font-heading">Bobot: {p.weight}%</p>
                    <p className={`text-sm font-bold font-heading ${pct >= 80 ? "text-pub-emerald" : pct >= 50 ? "text-pub-amber" : "text-destructive"}`}>
                      {score}/{total}
                    </p>
                    <Progress value={pct} className="h-1 mt-1" />
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Recommendations */}
      {totalAnswered > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-heading flex items-center gap-2">
                <Target className="w-4 h-4 text-pub-amber" />
                Rekomendasi Perbaikan
              </CardTitle>
              <CardDescription className="text-xs">Fokus pada pilar terlemah untuk meningkatkan skor sebelum upload ke Jaga.id</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {pillarAnalysis.filter(p => p.pct < 100).slice(0, 3).map(p => (
                <div key={p.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                  <div className="text-lg">{p.icon}</div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-heading font-semibold">{p.label}</p>
                      <Badge variant="outline" className="text-[10px]">{p.score}/{p.total}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{p.missing.length} indikator belum terpenuhi:</p>
                    <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      {p.missing.slice(0, 3).map(ind => (
                        <li key={ind.code} className="flex items-start gap-1">
                          <XCircle className="w-3 h-3 text-destructive shrink-0 mt-0.5" />
                          <span><strong className="text-pub-amber">{ind.code}</strong> — {ind.text}</span>
                        </li>
                      ))}
                      {p.missing.length > 3 && (
                        <li className="text-muted-foreground/60">...dan {p.missing.length - 3} indikator lainnya</li>
                      )}
                    </ul>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Indicator Form */}
      <Tabs defaultValue="komitmen">
        <TabsList className="flex flex-wrap h-auto gap-1">
          {PANCEK_PILLARS.map(p => (
            <TabsTrigger key={p.id} value={p.id} className="text-xs gap-1">
              <span>{p.icon}</span> {p.label}
              <Badge variant="outline" className="ml-1 text-[10px] px-1 py-0">
                {Math.round(pillarScores[p.id] || 0)}/{p.indicators.length}
              </Badge>
            </TabsTrigger>
          ))}
        </TabsList>

        {PANCEK_PILLARS.map(pillar => (
          <TabsContent key={pillar.id} value={pillar.id} className="mt-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-heading flex items-center gap-2">
                  <span className="text-xl">{pillar.icon}</span>
                  {pillar.label}
                  <Badge className="bg-pub-sky/20 text-pub-sky border-pub-sky/30 text-[10px]">Simulasi</Badge>
                </CardTitle>
                <CardDescription>{pillar.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {pillar.indicators.map((ind, i) => (
                  <IndicatorFormItem
                    key={ind.code}
                    indicator={ind}
                    answer={answers[ind.code] || { status: "", score: 0, notes: "" }}
                    onChange={handleIndicatorChange}
                    index={i}
                    isTrial
                  />
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 justify-between sticky bottom-4">
        <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
          <RotateCcw className="w-4 h-4" />
          Reset Simulasi
        </Button>
        <div className="flex items-center gap-2">
          {onCopyToOfficial && totalAnswered > 0 && (
            <Button variant="outline" size="sm" onClick={handleCopyToOfficial} className="gap-2">
              <Copy className="w-4 h-4" />
              Salin ke Form Resmi
            </Button>
          )}
          <Button size="sm" className="gap-2" onClick={() => window.open("https://jaga.id", "_blank")}>
            <ExternalLink className="w-4 h-4" />
            Buka Jaga.id
          </Button>
        </div>
      </div>
    </div>
  );
}
