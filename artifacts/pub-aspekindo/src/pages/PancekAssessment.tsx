import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import { usePancekAssessment } from "@/hooks/usePancekAssessment";
import { useAuth } from "@/hooks/useAuth";
import { PANCEK_PILLARS, TOTAL_INDICATORS } from "@/lib/pancekIndicators";
import { migrateLegacyAnswers, countAnswered, calculatePillarScoresFromAnswers, calculateWeightedScore, type PancekAnswers, type IndicatorAnswer } from "@/lib/pancekAnswerTypes";
import PancekImport from "@/components/pancek/PancekImport";
import PancekTrial from "@/components/pancek/PancekTrial";
import IndicatorFormItem from "@/components/pancek/IndicatorFormItem";
import LembarVerifikasi from "@/components/pancek/LembarVerifikasi";
import {
  ShieldAlert, Save, Send, CheckCircle2, AlertTriangle, FileText,
  Clock, Shield, FlaskConical, FileCheck, ShieldCheck, Download, TrendingUp,
} from "lucide-react";
import PancekTrendChart from "@/components/pancek/PancekTrendChart";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer,
} from "recharts";
import { toast } from "@/components/ui/sonner-toast";
import { exportPancekPdf } from "@/lib/pancekPdf";

export default function PancekAssessment() {
  const { profile } = useAuth();
  const { assessments, loading, saveAssessment, submitAssessment } = usePancekAssessment();
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear);
  const [mode, setMode] = useState<"trial" | "official" | "verifikasi">("trial");
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const existing = assessments.find(a => a.period_year === selectedYear);
  const [answers, setAnswers] = useState<PancekAnswers>(
    migrateLegacyAnswers(existing?.answers)
  );
  const [companyName, setCompanyName] = useState(existing?.company_name || profile?.company || "");
  const [npwp, setNpwp] = useState(existing?.npwp || "");
  const [nib, setNib] = useState(existing?.nib || "");

  useEffect(() => {
    if (existing) {
      setAnswers(migrateLegacyAnswers(existing.answers));
      setCompanyName(existing.company_name || profile?.company || "");
      setNpwp(existing.npwp || "");
      setNib(existing.nib || "");
    } else {
      setAnswers({});
      setCompanyName(profile?.company || "");
      setNpwp("");
      setNib("");
    }
  }, [selectedYear, existing, profile?.company]);

  const pillarScores = calculatePillarScoresFromAnswers(answers, PANCEK_PILLARS);
  const weightedScore = calculateWeightedScore(answers, PANCEK_PILLARS);
  const totalAnswered = countAnswered(answers);
  const totalIndicators = TOTAL_INDICATORS;
  const completionPct = Math.round((totalAnswered / totalIndicators) * 100);

  const isReadonly = existing?.status === "submitted" || existing?.status === "verified";

  const handleIndicatorChange = (code: string, answer: IndicatorAnswer) => {
    if (isReadonly) return;
    setAnswers(prev => ({ ...prev, [code]: answer }));
  };

  const handleSave = () => {
    saveAssessment(selectedYear, answers, pillarScores, {
      company_name: companyName,
      npwp,
      nib,
    });
  };

  const handleSubmit = () => {
    if (!existing) {
      toast.error("Simpan terlebih dahulu sebelum submit");
      return;
    }
    if (completionPct < 50) {
      toast.error("Minimal 50% indikator harus dijawab sebelum submit");
      return;
    }
    submitAssessment(existing.id);
  };

  const handleImport = (importedAnswers: Record<string, boolean>, meta?: { company_name?: string; npwp?: string; nib?: string }) => {
    // Convert imported boolean answers to new format
    const converted: PancekAnswers = {};
    for (const [key, val] of Object.entries(importedAnswers)) {
      if (val) {
        converted[key] = { status: "ya", score: 4, notes: "" };
      }
    }
    setAnswers(prev => ({ ...prev, ...converted }));
    if (meta?.company_name) setCompanyName(meta.company_name);
    if (meta?.npwp) setNpwp(meta.npwp);
    if (meta?.nib) setNib(meta.nib);
  };

  const handleCopyTrialToOfficial = (trialAnswers: PancekAnswers) => {
    setAnswers(prev => ({ ...prev, ...trialAnswers }));
    setMode("official");
    toast.success("Data simulasi disalin ke form resmi. Jangan lupa simpan!");
  };

  const statusBadge = (status?: string) => {
    switch (status) {
      case "submitted": return <Badge className="bg-pub-sky/20 text-pub-sky border-pub-sky/30"><Clock className="w-3 h-3 mr-1" />Menunggu Verifikasi</Badge>;
      case "verified": return <Badge className="bg-pub-emerald/20 text-pub-emerald border-pub-emerald/30"><CheckCircle2 className="w-3 h-3 mr-1" />Terverifikasi</Badge>;
      case "rejected": return <Badge className="bg-destructive/20 text-destructive border-destructive/30"><AlertTriangle className="w-3 h-3 mr-1" />Ditolak</Badge>;
      default: return <Badge variant="outline"><FileText className="w-3 h-3 mr-1" />Draft</Badge>;
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Memuat data PANCEK...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-pub-amber" />
            PANCEK KPK
          </h2>
          <p className="text-sm text-muted-foreground">
            Panduan Cegah Korupsi — Self-Assessment Antikorupsi Badan Usaha
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            <Shield className="w-3 h-3 inline mr-1" />
            Verifikasi oleh Asosiasi sebagai syarat perpanjangan SBU
          </p>
        </div>
        {existing && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => exportPancekPdf(existing)}
          >
            <Download className="w-4 h-4" />
            Export PDF
          </Button>
        )}
      </div>

      {/* Trend Chart */}
      {assessments.length > 0 && (
        <PancekTrendChart assessments={assessments} title="Tren Skor PANCEK Anda" />
      )}

      {/* Mode Tabs */}
      <Tabs value={mode} onValueChange={v => setMode(v as "trial" | "official" | "verifikasi")}>
        <TabsList className="grid w-full grid-cols-3 max-w-lg">
          <TabsTrigger value="trial" className="gap-2 text-sm">
            <FlaskConical className="w-4 h-4" />
            Simulasi Trial
          </TabsTrigger>
          <TabsTrigger value="official" className="gap-2 text-sm">
            <FileCheck className="w-4 h-4" />
            Form Resmi
          </TabsTrigger>
          <TabsTrigger value="verifikasi" className="gap-2 text-sm">
            <ShieldCheck className="w-4 h-4" />
            Lembar Verifikasi
          </TabsTrigger>
        </TabsList>

        {/* Trial Mode */}
        <TabsContent value="trial" className="mt-6">
          <PancekTrial onCopyToOfficial={handleCopyTrialToOfficial} />
        </TabsContent>

        {/* Official Mode */}
        <TabsContent value="official" className="mt-6 space-y-6">
          {/* Year Selector & Status */}
          <div className="flex items-center gap-3">
            <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {years.map(y => (
                  <SelectItem key={y} value={String(y)}>Periode {y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {statusBadge(existing?.status)}
          </div>

          {/* Import */}
          {!isReadonly && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
              <PancekImport onImport={handleImport} disabled={isReadonly} />
            </motion.div>
          )}

          {/* Summary */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <Card className="border-2">
              <CardContent className="p-6">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div>
                    <Label className="text-xs text-muted-foreground">Nama Badan Usaha</Label>
                    <Input value={companyName} onChange={e => setCompanyName(e.target.value)} disabled={isReadonly} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">NPWP</Label>
                    <Input value={npwp} onChange={e => setNpwp(e.target.value)} disabled={isReadonly} className="mt-1" placeholder="00.000.000.0-000.000" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">NIB</Label>
                    <Input value={nib} onChange={e => setNib(e.target.value)} disabled={isReadonly} className="mt-1" placeholder="Nomor Induk Berusaha" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Progres Pengisian</Label>
                    <div className="mt-2">
                      <Progress value={completionPct} className="h-3" />
                      <p className="text-xs text-muted-foreground mt-1 font-heading font-bold">
                        {totalAnswered}/{totalIndicators} indikator ({completionPct}%)
                      </p>
                    </div>
                  </div>
                </div>

                {/* Weighted Score */}
                <div className="mb-4 p-3 rounded-lg bg-primary/5 border border-primary/20 text-center">
                  <p className="text-xs text-muted-foreground font-heading">Skor Tertimbang (Weighted Score)</p>
                  <p className={`text-3xl font-bold font-heading ${weightedScore >= 70 ? "text-pub-emerald" : weightedScore >= 50 ? "text-pub-amber" : "text-destructive"}`}>
                    {weightedScore}<span className="text-base text-muted-foreground">/100</span>
                  </p>
                </div>

                {/* Radar Chart + Pillar Score Summary */}
                <div className="grid md:grid-cols-2 gap-4">
                  {/* Radar */}
                  <div className="flex items-center justify-center">
                    <ResponsiveContainer width="100%" height={220}>
                      <RadarChart data={PANCEK_PILLARS.map(p => {
                        const score = pillarScores[p.id] || 0;
                        const total = p.indicators.length;
                        return { pillar: p.label, pct: Math.round((score / total) * 100), fullMark: 100 };
                      })}>
                        <PolarGrid stroke="hsl(var(--border))" />
                        <PolarAngleAxis dataKey="pillar" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 9 }} />
                        <Radar name="Skor" dataKey="pct" stroke="hsl(38, 92%, 50%)" fill="hsl(38, 92%, 50%)" fillOpacity={0.25} strokeWidth={2} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Pillar cards */}
                  <div className="grid grid-cols-3 gap-2">
                    {PANCEK_PILLARS.map(p => {
                      const score = pillarScores[p.id] || 0;
                      const total = p.indicators.length;
                      const pct = Math.round((score / total) * 100);
                      return (
                        <div key={p.id} className="text-center p-2 rounded-lg bg-muted/30 border border-border">
                          <div className="text-lg">{p.icon}</div>
                          <p className="text-[10px] text-muted-foreground font-heading truncate">{p.label}</p>
                          <p className="text-[9px] text-muted-foreground/60 font-heading">Bobot: {p.weight}%</p>
                          <p className={`text-sm font-bold font-heading ${pct >= 80 ? "text-pub-emerald" : pct >= 50 ? "text-pub-amber" : "text-destructive"}`}>
                            {score}/{total}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Pillar Tabs with Indicator Forms */}
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
                        disabled={isReadonly}
                        index={i}
                      />
                    ))}
                  </CardContent>
                </Card>
              </TabsContent>
            ))}
          </Tabs>

          {/* Actions */}
          {!isReadonly && (
            <div className="flex items-center gap-3 justify-end sticky bottom-4">
              <Button variant="outline" onClick={handleSave} className="gap-2">
                <Save className="w-4 h-4" />
                Simpan Draft
              </Button>
              <Button onClick={handleSubmit} className="gap-2 bg-pub-amber hover:bg-pub-amber/90 text-pub-amber-foreground">
                <Send className="w-4 h-4" />
                Submit untuk Verifikasi Asosiasi
              </Button>
            </div>
          )}

          {/* Verification Info */}
          {existing?.status === "verified" && (
            <Card className="border-pub-emerald/30 bg-pub-emerald/5">
              <CardContent className="p-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-pub-emerald" />
                <div>
                  <p className="text-sm font-medium text-pub-emerald">Terverifikasi oleh Asosiasi</p>
                  <p className="text-xs text-muted-foreground">
                    Diverifikasi oleh {existing.verified_by}
                    {existing.verified_at ? ` pada ${new Date(existing.verified_at).toLocaleDateString("id-ID")}` : ""}
                  </p>
                  {existing.verification_notes && (
                    <p className="text-xs text-muted-foreground mt-1">{existing.verification_notes}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Lembar Verifikasi Tab */}
        <TabsContent value="verifikasi" className="mt-6">
          <LembarVerifikasi assessmentId={existing?.id} periodYear={selectedYear} assessment={existing} />
        </TabsContent>
      </Tabs>

      {/* Info Box */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <h3 className="text-sm font-heading font-semibold mb-2 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-pub-amber" />
            Tentang PANCEK KPK
          </h3>
          <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
            <li>PANCEK (Panduan Cegah Korupsi) adalah instrumen self-assessment dari KPK untuk badan usaha</li>
            <li>Berdasarkan Perma No. 13 Tahun 2016 tentang penanganan perkara pidana oleh korporasi</li>
            <li>Terdiri dari 6 pilar: Komitmen, Perencanaan, Pelaksanaan, Evaluasi, Perbaikan, Respon</li>
            <li>Total 70 indikator yang harus dipenuhi untuk menjamin prosedur antikorupsi yang memadai</li>
            <li className="font-medium text-foreground">Verifikasi PANCEK oleh Asosiasi merupakan syarat perpanjangan SBU</li>
            <li>Gunakan <strong>Mode Simulasi</strong> untuk latihan sebelum upload ke Jaga.id</li>
            <li>Gunakan <strong>Form Resmi</strong> untuk submit verifikasi ke Asosiasi</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
