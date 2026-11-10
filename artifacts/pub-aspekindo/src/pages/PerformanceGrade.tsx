import { useState, useMemo, useEffect } from "react";
import { usePerformanceGrades, gradeColor, gradeBg, PerformanceGrade } from "@/hooks/usePerformanceGrades";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { exportGradingPdf } from "@/lib/gradingPdf";
import GradeTrendChart from "@/components/grading/GradeTrendChart";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { motion } from "framer-motion";
import {
  TrendingUp, TrendingDown,
  Calculator,
  Loader2,
  Banknote,
  FolderKanban,
  ShieldCheck,
  AlertTriangle,
  ChevronRight,
  BarChart3,
  FileDown,
  Lightbulb,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  CheckCircle2,
  XCircle,
  Database,
} from "lucide-react";

const currentYear = new Date().getFullYear();

function getPillarBreakdown(breakdown: Json, pillar: string): Record<string, Json> {
  if (!breakdown || typeof breakdown !== "object" || Array.isArray(breakdown)) return {};
  const value = breakdown[pillar];
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, Json> : {};
}

const pillarConfig = [
  { key: "financial", label: "Keuangan", icon: Banknote, color: "text-pub-emerald", bg: "bg-pub-emerald/10" },
  { key: "project", label: "Kinerja Proyek", icon: FolderKanban, color: "text-pub-sky", bg: "bg-pub-sky/10" },
  { key: "compliance", label: "Kepatuhan & SDM", icon: ShieldCheck, color: "text-pub-amber", bg: "bg-pub-amber/10" },
  { key: "risk", label: "Risk & K3", icon: AlertTriangle, color: "text-pub-violet", bg: "bg-pub-violet/10" },
];

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-semibold">{score}/100</span>
      </div>
      <Progress value={score} className={`h-2 ${color}`} />
    </div>
  );
}

function getRecommendations(grade: PerformanceGrade): { pillar: string; score: number; tips: string[] }[] {
  const scores = pillarConfig.map(p => ({
    pillar: p.label,
    score: grade[`${p.key}_score` as keyof PerformanceGrade] as number,
    key: p.key,
  }));
  
  return scores
    .filter(s => s.score < 70)
    .sort((a, b) => a.score - b.score)
    .map(s => ({
      pillar: s.pillar,
      score: s.score,
      tips: s.key === "financial" ? [
        "Tingkatkan rasio current ratio (aset lancar / utang jangka pendek)",
        "Pertahankan deviasi anggaran < 5%",
        "Lengkapi data LKUT keuangan",
      ] : s.key === "project" ? [
        "Tambah lebih banyak proyek dengan evidence lengkap",
        "Tingkatkan skor kualitas (quality score) di data LKUT",
        "Kurangi keterlambatan proyek",
      ] : s.key === "compliance" ? [
        "Lengkapi sertifikasi tenaga ahli",
        "Pastikan SMK3 dan SMAP sudah diterapkan",
        "Tingkatkan rasio karyawan terlatih",
      ] : [
        "Kurangi insiden K3 di proyek",
        "Tutup risk register yang masih terbuka",
        "Terapkan mitigasi risiko secara konsisten",
      ],
    }));
}

export function GradingPanel() {
  const { grades, loading, computing, computeGrade } = usePerformanceGrades();
  const { profile, user } = useAuth();
  const [detailGrade, setDetailGrade] = useState<PerformanceGrade | null>(null);
  const [showComputeDialog, setShowComputeDialog] = useState(false);
  const [bujkForm, setBujkForm] = useState({
    company_name: '',
    nib: '',
    sbu_number: '',
    bujk_qualification: 'menengah',
  });
  const [dataSources, setDataSources] = useState<{
    lkut: number;
    projects: number;
    risks: number;
    k3: number;
    budgets: number;
    loading: boolean;
  }>({ lkut: 0, projects: 0, risks: 0, k3: 0, budgets: 0, loading: true });

  // Pre-fill from profile & fetch data source counts when dialog opens
  useEffect(() => {
    if (!showComputeDialog || !user) return;
    if (profile) {
      setBujkForm(prev => ({
        ...prev,
        company_name: prev.company_name || profile.company || '',
      }));
    }
    // Fetch data source counts
    setDataSources(prev => ({ ...prev, loading: true }));
    Promise.all([
      supabase.from("lkut_reports").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("risk_registers").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("k3_checklists").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("budget_entries").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]).then(([lkut, proj, risk, k3, budget]) => {
      setDataSources({
        lkut: lkut.count || 0,
        projects: proj.count || 0,
        risks: risk.count || 0,
        k3: k3.count || 0,
        budgets: budget.count || 0,
        loading: false,
      });
    });
  }, [showComputeDialog, profile, user]);

  const latestGrade = grades[0];
  const prevGrade = grades[1] || null;

  const comparison = useMemo(() => {
    if (!latestGrade || !prevGrade) return null;
    const diff = latestGrade.total_score - prevGrade.total_score;
    const pillarDiffs = pillarConfig.map(p => {
      const key = `${p.key}_score` as keyof PerformanceGrade;
      const curr = latestGrade[key] as number;
      const prev = prevGrade[key] as number;
      return { label: p.label, icon: p.icon, color: p.color, curr, prev, diff: curr - prev };
    });
    return { diff, pillarDiffs, prevPeriod: prevGrade.period, prevGrade: prevGrade.grade };
  }, [latestGrade, prevGrade]);

  const recommendations = useMemo(() => {
    if (!latestGrade) return [];
    return getRecommendations(latestGrade);
  }, [latestGrade]);

  const handleOpenCompute = () => {
    setShowComputeDialog(true);
  };

  const handleCompute = () => {
    if (!bujkForm.company_name.trim()) {
      return;
    }
    const period = `${currentYear}`;
    computeGrade(period, bujkForm);
    setShowComputeDialog(false);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold font-heading text-foreground flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-accent" />
            Analisis Kinerja & Grading BUJK
          </h3>
          <p className="text-sm text-muted-foreground">
            Kalkulasi otomatis grade AAA–F berdasarkan data LKUT dan 4 pilar kinerja
          </p>
        </div>
        <div className="flex gap-2">
          {latestGrade && (
            <Button variant="outline" size="sm" onClick={() => exportGradingPdf(latestGrade, profile?.full_name)}>
              <FileDown className="w-4 h-4 mr-2" />
              Export PDF
            </Button>
          )}
          <Button size="sm" onClick={handleOpenCompute} disabled={computing}>
            {computing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
            Hitung Grade {currentYear}
          </Button>
        </div>
      </div>

      {/* Latest Grade Hero */}
      {latestGrade ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <Card className={`border-2 ${gradeBg(latestGrade.grade)}`}>
            <CardContent className="p-6">
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground font-heading uppercase tracking-wider mb-1">Grade Terkini</p>
                  <div className={`text-6xl font-black font-heading ${gradeColor(latestGrade.grade)}`}>
                    {latestGrade.grade}
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">Periode {latestGrade.period}</p>
                </div>
                <div className="flex-1 space-y-3">
                  {/* BUJK Identity */}
                  {(latestGrade.company_name || latestGrade.sbu_number) && (
                    <div className="flex items-start gap-2 bg-muted/40 rounded-lg p-3 mb-2">
                      <Building2 className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                      <div className="text-xs space-y-0.5">
                        {latestGrade.company_name && (
                          <p className="font-semibold text-foreground text-sm">{latestGrade.company_name}</p>
                        )}
                        <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-muted-foreground">
                          {latestGrade.sbu_number && <span>SBU: {latestGrade.sbu_number}</span>}
                          {latestGrade.nib && <span>NIB: {latestGrade.nib}</span>}
                          {latestGrade.bujk_qualification && <span>Kualifikasi: {latestGrade.bujk_qualification}</span>}
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Skor Komposit</span>
                    <span className="font-bold text-lg">{latestGrade.total_score}/100</span>
                  </div>
                  <Progress value={latestGrade.total_score} className="h-3" />
                  <div className="grid grid-cols-4 gap-3 mt-4">
                    {pillarConfig.map(p => {
                      const score = latestGrade[`${p.key}_score` as keyof PerformanceGrade] as number;
                      return (
                        <div key={p.key} className={`rounded-lg p-3 ${p.bg} text-center`}>
                          <p.icon className={`w-4 h-4 mx-auto mb-1 ${p.color}`} />
                          <p className="text-xs text-muted-foreground">{p.label}</p>
                          <p className="font-bold text-sm">{score}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ) : !loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <TrendingUp className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">Belum ada data grading</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              Klik "Hitung Grade" untuk menghitung berdasarkan data LKUT, proyek, risk register, dan K3 Anda
            </p>
            <Button className="mt-4" onClick={handleOpenCompute} disabled={computing}>
              {computing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
              Hitung Grade Sekarang
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="text-center py-12 text-muted-foreground">Memuat data...</div>
      )}

      {/* Period comparison */}
      {comparison && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                {comparison.diff >= 0 ? <TrendingUp className="w-4 h-4 text-pub-emerald" /> : <TrendingDown className="w-4 h-4 text-destructive" />}
                Perbandingan dengan Periode {comparison.prevPeriod}
              </CardTitle>
              <CardDescription>
                Grade sebelumnya: <span className={`font-bold ${gradeColor(comparison.prevGrade)}`}>{comparison.prevGrade}</span>
                {" → "}
                Perubahan skor: <span className={`font-bold ${comparison.diff >= 0 ? "text-pub-emerald" : "text-destructive"}`}>
                  {comparison.diff >= 0 ? "+" : ""}{comparison.diff}
                </span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {comparison.pillarDiffs.map(p => (
                  <div key={p.label} className="rounded-lg border border-border p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <p.icon className={`w-3.5 h-3.5 ${p.color}`} />
                      <span className="text-xs text-muted-foreground">{p.label}</span>
                    </div>
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold font-heading text-foreground">{p.curr}</span>
                      <span className={`text-xs font-heading flex items-center gap-0.5 ${p.diff >= 0 ? "text-pub-emerald" : "text-destructive"}`}>
                        {p.diff >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                        {p.diff >= 0 ? "+" : ""}{p.diff}
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">sebelumnya: {p.prev}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-pub-amber/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-heading flex items-center gap-2">
                <Lightbulb className="w-4 h-4 text-pub-amber" />
                Rekomendasi Perbaikan
              </CardTitle>
              <CardDescription>
                Fokus pada pilar dengan skor di bawah 70 untuk menaikkan grade
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {recommendations.map((rec) => (
                <div key={rec.pillar} className="bg-muted/30 rounded-xl p-4 border border-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-heading font-semibold text-foreground text-sm">{rec.pillar}</span>
                    <Badge variant="outline" className="text-destructive border-destructive/30 text-xs">{rec.score}/100</Badge>
                  </div>
                  <ul className="space-y-1">
                    {rec.tips.map((tip, i) => (
                      <li key={i} className="text-xs text-muted-foreground font-body flex items-start gap-2">
                        <span className="text-pub-amber mt-0.5">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Metodologi Perhitungan */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <Calculator className="w-4 h-4 text-accent" />
            Metodologi Perhitungan Grade
          </CardTitle>
          <CardDescription>
            Skor komposit = (Keuangan × 30%) + (Proyek × 30%) + (Kepatuhan × 20%) + (Risk & K3 × 20%)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Pillar 1: Keuangan */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className={`px-4 py-2 bg-pub-emerald/10 flex items-center gap-2`}>
              <Banknote className="w-4 h-4 text-pub-emerald" />
              <span className="font-heading font-semibold text-sm">Keuangan (30%)</span>
            </div>
            <div className="p-4 text-xs space-y-2">
              <p className="text-muted-foreground">Sumber data: <strong>LKUT</strong> (tab Keuangan)</p>
              <div className="grid gap-2">
                <div className="bg-muted/30 rounded p-2">
                  <p className="font-semibold text-foreground">Current Ratio — 25 poin</p>
                  <p className="text-muted-foreground">= Aset Lancar ÷ Kewajiban Jangka Pendek</p>
                  <p className="text-muted-foreground mt-0.5">≥2.0 → 25 · ≥1.5 → 20 · ≥1.0 → 12 · &gt;0 → 5</p>
                </div>
                <div className="bg-muted/30 rounded p-2">
                  <p className="font-semibold text-foreground">Debt-to-Equity Ratio — 25 poin</p>
                  <p className="text-muted-foreground">= Total Kewajiban ÷ Total Ekuitas</p>
                  <p className="text-muted-foreground mt-0.5">≤1.0 → 25 · ≤2.0 → 18 · ≤3.0 → 10 · &gt;3.0 → 2</p>
                </div>
                <div className="bg-muted/30 rounded p-2">
                  <p className="font-semibold text-foreground">Profit Margin — 25 poin</p>
                  <p className="text-muted-foreground">= (Laba Kotor ÷ Penjualan) × 100%</p>
                  <p className="text-muted-foreground mt-0.5">≥15% → 25 · ≥10% → 20 · ≥5% → 12 · &gt;0% → 5</p>
                </div>
                <div className="bg-muted/30 rounded p-2">
                  <p className="font-semibold text-foreground">Pertumbuhan Aset — 25 poin</p>
                  <p className="text-muted-foreground">= (Aset N − Aset N-1) ÷ Aset N-1 × 100%</p>
                  <p className="text-muted-foreground mt-0.5">≥15% → 25 · ≥5% → 18 · ≥0% → 10 · &lt;0% → 2</p>
                </div>
              </div>
            </div>
          </div>

          {/* Pillar 2: Proyek */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className={`px-4 py-2 bg-pub-sky/10 flex items-center gap-2`}>
              <FolderKanban className="w-4 h-4 text-pub-sky" />
              <span className="font-heading font-semibold text-sm">Kinerja Proyek (30%)</span>
            </div>
            <div className="p-4 text-xs space-y-2">
              <p className="text-muted-foreground">Sumber data: <strong>Proyek</strong> dan <strong>Budget Tracker</strong></p>
              <div className="grid gap-2">
                <div className="bg-muted/30 rounded p-2">
                  <p className="font-semibold text-foreground">Volume Proyek — 25 poin</p>
                  <p className="text-muted-foreground">≥10 proyek → 25 · ≥5 → 20 · ≥3 → 15 · &lt;3 → 8</p>
                </div>
                <div className="bg-muted/30 rounded p-2">
                  <p className="font-semibold text-foreground">Tingkat Penyelesaian — 25 poin</p>
                  <p className="text-muted-foreground">= (Proyek Selesai ÷ Total Proyek) × 100%</p>
                  <p className="text-muted-foreground mt-0.5">≥80% → 25 · ≥60% → 18 · ≥40% → 10 · &lt;40% → 3</p>
                </div>
                <div className="bg-muted/30 rounded p-2">
                  <p className="font-semibold text-foreground">Rata-rata Kompleksitas — 25 poin</p>
                  <p className="text-muted-foreground">Berdasarkan skor kompleksitas proyek (skala 0–10)</p>
                  <p className="text-muted-foreground mt-0.5">≥8 → 25 · ≥5 → 18 · ≥3 → 10 · &lt;3 → 5</p>
                </div>
                <div className="bg-muted/30 rounded p-2">
                  <p className="font-semibold text-foreground">Deviasi Anggaran — 25 poin</p>
                  <p className="text-muted-foreground">= |Aktual − Rencana| ÷ Rencana × 100%</p>
                  <p className="text-muted-foreground mt-0.5">≤5% → 25 · ≤10% → 18 · ≤20% → 10 · &gt;20% → 3</p>
                </div>
              </div>
            </div>
          </div>

          {/* Pillar 3: Kepatuhan */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className={`px-4 py-2 bg-pub-amber/10 flex items-center gap-2`}>
              <ShieldCheck className="w-4 h-4 text-pub-amber" />
              <span className="font-heading font-semibold text-sm">Kepatuhan & SDM (20%)</span>
            </div>
            <div className="p-4 text-xs space-y-2">
              <p className="text-muted-foreground">Sumber data: <strong>LKUT</strong> (tab Kepatuhan & SDM)</p>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/30 rounded p-2">
                  <p className="font-semibold text-foreground">SBU Valid — 20 poin</p>
                  <p className="text-muted-foreground">Nomor SBU terisi (10) + belum expired (10)</p>
                </div>
                <div className="bg-muted/30 rounded p-2">
                  <p className="font-semibold text-foreground">SMAP — 20 poin</p>
                  <p className="text-muted-foreground">Pemenuhan Sistem Manajemen Anti Penyuapan</p>
                </div>
                <div className="bg-muted/30 rounded p-2">
                  <p className="font-semibold text-foreground">Pengalaman SIJKT — 20 poin</p>
                  <p className="text-muted-foreground">Semua proyek tercatat di SIJKT</p>
                </div>
                <div className="bg-muted/30 rounded p-2">
                  <p className="font-semibold text-foreground">GCG — 10 poin</p>
                  <p className="text-muted-foreground">Good Corporate Governance diterapkan</p>
                </div>
                <div className="bg-muted/30 rounded p-2">
                  <p className="font-semibold text-foreground">SMK3 — 10 poin</p>
                  <p className="text-muted-foreground">Sistem Manajemen K3 diterapkan</p>
                </div>
                <div className="bg-muted/30 rounded p-2">
                  <p className="font-semibold text-foreground">Rasio SDM Terlatih — 20 poin</p>
                  <p className="text-muted-foreground">≥70% → 20 · ≥50% → 14 · ≥30% → 8 · &lt;30% → 2</p>
                </div>
              </div>
            </div>
          </div>

          {/* Pillar 4: Risk & K3 */}
          <div className="rounded-lg border border-border overflow-hidden">
            <div className={`px-4 py-2 bg-pub-violet/10 flex items-center gap-2`}>
              <AlertTriangle className="w-4 h-4 text-pub-violet" />
              <span className="font-heading font-semibold text-sm">Risk & K3 (20%)</span>
            </div>
            <div className="p-4 text-xs space-y-2">
              <p className="text-muted-foreground">Sumber data: <strong>Risk Register</strong> dan <strong>K3 Checklist</strong></p>
              <div className="grid gap-2">
                <div className="bg-muted/30 rounded p-2">
                  <p className="font-semibold text-foreground">Mitigasi Risiko — hingga 30 poin (dari skor dasar 50)</p>
                  <p className="text-muted-foreground">Tingkat mitigasi ≥80% → +30 · ≥50% → +15 · &lt;50% → −10</p>
                  <p className="text-muted-foreground mt-0.5">Risiko tinggi (skor ≥16): penalti −5 per risiko</p>
                </div>
                <div className="bg-muted/30 rounded p-2">
                  <p className="font-semibold text-foreground">Kepatuhan K3 — hingga 20 poin</p>
                  <p className="text-muted-foreground">Rata-rata skor inspeksi K3: ≥90% → +20 · ≥70% → +10 · &lt;70% → −10</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Grade Scale Reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading">Skala Grade BUJK</CardTitle>
          <CardDescription>Berdasarkan skor komposit 4 pilar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {[
              { g: "AAA", min: 95, c: "bg-pub-emerald/20 text-pub-emerald border-pub-emerald/30" },
              { g: "AA", min: 85, c: "bg-pub-emerald/10 text-pub-emerald border-pub-emerald/20" },
              { g: "A", min: 75, c: "bg-pub-sky/20 text-pub-sky border-pub-sky/30" },
              { g: "BBB", min: 65, c: "bg-pub-sky/10 text-pub-sky border-pub-sky/20" },
              { g: "BB", min: 55, c: "bg-pub-amber/20 text-pub-amber border-pub-amber/30" },
              { g: "B", min: 45, c: "bg-pub-amber/10 text-pub-amber border-pub-amber/20" },
              { g: "CCC", min: 35, c: "bg-orange-500/10 text-orange-500 border-orange-500/20" },
              { g: "CC", min: 25, c: "bg-orange-500/10 text-orange-400 border-orange-400/20" },
              { g: "C", min: 15, c: "bg-destructive/10 text-destructive border-destructive/20" },
              { g: "D", min: 5, c: "bg-destructive/10 text-destructive border-destructive/20" },
              { g: "F", min: 0, c: "bg-destructive/20 text-destructive border-destructive/30" },
            ].map(item => (
              <Badge key={item.g} variant="outline" className={`${item.c} font-heading`}>
                {item.g} ≥{item.min}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Trend Chart */}
      {grades.length > 0 && <GradeTrendChart grades={grades} />}

      {/* History */}
      {grades.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-heading">Riwayat Grading</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {grades.map((g, i) => (
                <motion.div
                  key={g.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center justify-between px-6 py-3 hover:bg-muted/30 cursor-pointer transition-colors"
                  onClick={() => setDetailGrade(g)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`text-2xl font-black font-heading ${gradeColor(g.grade)}`}>{g.grade}</div>
                    <div>
                      <p className="text-sm font-medium text-foreground">Periode {g.period}</p>
                      {g.company_name && (
                        <p className="text-xs text-muted-foreground font-medium">{g.company_name}</p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Dihitung: {new Date(g.computed_at).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm font-bold">{g.total_score}</p>
                      <p className="text-xs text-muted-foreground">poin</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Compute Dialog - Identitas BUJK */}
      <Dialog open={showComputeDialog} onOpenChange={setShowComputeDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-accent" />
              Identitas BUJK
            </DialogTitle>
            <DialogDescription>
              Lengkapi data BUJK yang akan dihitung grading-nya untuk periode {currentYear}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="company_name">Nama Perusahaan / BUJK <span className="text-destructive">*</span></Label>
              <Input
                id="company_name"
                placeholder="PT Maju Konstruksi Sejahtera"
                value={bujkForm.company_name}
                onChange={e => setBujkForm(prev => ({ ...prev, company_name: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="nib">NIB</Label>
                <Input
                  id="nib"
                  placeholder="1234567890123"
                  value={bujkForm.nib}
                  onChange={e => setBujkForm(prev => ({ ...prev, nib: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sbu_number">Nomor SBU</Label>
                <Input
                  id="sbu_number"
                  placeholder="SBU-JK-2024-001234"
                  value={bujkForm.sbu_number}
                  onChange={e => setBujkForm(prev => ({ ...prev, sbu_number: e.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="bujk_qualification">Kualifikasi BUJK</Label>
              <Select
                value={bujkForm.bujk_qualification}
                onValueChange={v => setBujkForm(prev => ({ ...prev, bujk_qualification: v }))}
              >
                <SelectTrigger id="bujk_qualification">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kecil">Kecil</SelectItem>
                  <SelectItem value="menengah">Menengah</SelectItem>
                  <SelectItem value="besar">Besar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sumber Data yang Akan Dihitung */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <Database className="w-4 h-4 text-accent" />
                <span className="font-heading font-semibold text-sm text-foreground">Sumber Data Perhitungan</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Grading dihitung otomatis dari data berikut yang sudah Anda input di modul lain:
              </p>
              {dataSources.loading ? (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Loader2 className="w-3 h-3 animate-spin" /> Memuat status data...
                </div>
              ) : (
                <div className="grid gap-2">
                  {[
                    { label: "LKUT (Laporan Keuangan)", count: dataSources.lkut, pillar: "Keuangan & Kepatuhan", link: "/lkut" },
                    { label: "Proyek", count: dataSources.projects, pillar: "Kinerja Proyek", link: "/projects" },
                    { label: "Budget Tracker", count: dataSources.budgets, pillar: "Deviasi Anggaran", link: "/budget" },
                    { label: "Risk Register", count: dataSources.risks, pillar: "Risk & K3", link: "/risk-register" },
                    { label: "K3 Checklist", count: dataSources.k3, pillar: "Kepatuhan K3", link: "/k3-checklist" },
                  ].map(src => (
                    <div key={src.label} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        {src.count > 0 ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-pub-emerald" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-destructive" />
                        )}
                        <span className="text-foreground">{src.label}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${src.count > 0 ? "text-pub-emerald" : "text-destructive"}`}>
                          {src.count > 0 ? `${src.count} data` : "Belum ada"}
                        </span>
                        <span className="text-muted-foreground">→ {src.pillar}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!dataSources.loading && (dataSources.lkut === 0 || dataSources.projects === 0) && (
                <p className="text-xs text-pub-amber bg-pub-amber/10 rounded p-2">
                  ⚠️ Data LKUT dan Proyek sangat penting untuk hasil grading yang akurat. Lengkapi terlebih dahulu di modul terkait.
                </p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowComputeDialog(false)}>Batal</Button>
            <Button onClick={handleCompute} disabled={computing || !bujkForm.company_name.trim()}>
              {computing ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Calculator className="w-4 h-4 mr-2" />}
              Hitung Grade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={!!detailGrade} onOpenChange={open => { if (!open) setDetailGrade(null); }}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {detailGrade && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <span className={`text-4xl font-black font-heading ${gradeColor(detailGrade.grade)}`}>
                    {detailGrade.grade}
                  </span>
                  <div>
                    <p className="text-sm text-foreground">Periode {detailGrade.period}</p>
                    <p className="text-xs text-muted-foreground">Skor: {detailGrade.total_score}/100</p>
                  </div>
                </DialogTitle>
                {(detailGrade.company_name || detailGrade.sbu_number) && (
                  <div className="flex items-start gap-2 bg-muted/40 rounded-lg p-3 mt-2">
                    <Building2 className="w-4 h-4 text-accent mt-0.5 shrink-0" />
                    <div className="text-xs space-y-0.5">
                      {detailGrade.company_name && (
                        <p className="font-semibold text-foreground text-sm">{detailGrade.company_name}</p>
                      )}
                      <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-muted-foreground">
                        {detailGrade.sbu_number && <span>SBU: {detailGrade.sbu_number}</span>}
                        {detailGrade.nib && <span>NIB: {detailGrade.nib}</span>}
                        {detailGrade.bujk_qualification && <span>Kualifikasi: {detailGrade.bujk_qualification}</span>}
                      </div>
                    </div>
                  </div>
                )}
              </DialogHeader>

              <div className="space-y-4">
                {pillarConfig.map(p => {
                  const score = detailGrade[`${p.key}_score` as keyof PerformanceGrade] as number;
                  const breakdown = getPillarBreakdown(detailGrade.breakdown, p.key);
                  return (
                    <Card key={p.key} className="overflow-hidden">
                      <CardHeader className={`py-3 px-4 ${p.bg}`}>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <p.icon className={`w-4 h-4 ${p.color}`} />
                            <CardTitle className="text-sm">{p.label}</CardTitle>
                          </div>
                          <Badge variant="outline" className={`font-bold ${p.color}`}>{score}/100</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="py-3 px-4">
                        <div className="grid grid-cols-2 gap-2 text-xs">
                          {Object.entries(breakdown)
                            .filter(([k]) => !["score", "weight", "reason"].includes(k))
                            .map(([k, v]) => (
                              <div key={k} className="flex justify-between">
                                <span className="text-muted-foreground">{k.replace(/_/g, " ")}</span>
                                <span className="font-medium">{typeof v === "boolean" ? (v ? "✓" : "✗") : String(v ?? "-")}</span>
                              </div>
                            ))}
                           {typeof breakdown.reason === "string" && (
                             <p className="col-span-2 text-muted-foreground italic">{breakdown.reason}</p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => exportGradingPdf(detailGrade, profile?.full_name)}>
                  <FileDown className="w-4 h-4 mr-2" />
                  Export PDF
                </Button>
                <Button variant="outline" onClick={() => setDetailGrade(null)}>Tutup</Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default GradingPanel;
