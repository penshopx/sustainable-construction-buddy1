import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/sonner-toast";
import type { Json, Tables } from "@/integrations/supabase/types";

export interface PerformanceGrade {
  id: string;
  user_id: string;
  period: string;
  company_name: string;
  nib: string;
  sbu_number: string;
  bujk_qualification: string;
  financial_score: number;
  project_score: number;
  compliance_score: number;
  risk_score: number;
  total_score: number;
  grade: string;
  breakdown: Json;
  computed_at: string;
  created_at: string;
}

// Grade scale: AAA (95+), AA (85+), A (75+), BBB (65+), BB (55+), B (45+), CCC (35+), CC (25+), C (15+), D (5+), F (<5)
function scoreToGrade(score: number): string {
  if (score >= 95) return "AAA";
  if (score >= 85) return "AA";
  if (score >= 75) return "A";
  if (score >= 65) return "BBB";
  if (score >= 55) return "BB";
  if (score >= 45) return "B";
  if (score >= 35) return "CCC";
  if (score >= 25) return "CC";
  if (score >= 15) return "C";
  if (score >= 5) return "D";
  return "F";
}

export function gradeColor(grade: string): string {
  if (["AAA", "AA"].includes(grade)) return "text-pub-emerald";
  if (["A", "BBB"].includes(grade)) return "text-pub-sky";
  if (["BB", "B"].includes(grade)) return "text-pub-amber";
  if (["CCC", "CC"].includes(grade)) return "text-pub-amber";
  return "text-destructive";
}

export function gradeBg(grade: string): string {
  if (["AAA", "AA"].includes(grade)) return "bg-pub-emerald/10 border-pub-emerald/30";
  if (["A", "BBB"].includes(grade)) return "bg-pub-sky/10 border-pub-sky/30";
  if (["BB", "B"].includes(grade)) return "bg-pub-amber/10 border-pub-amber/30";
  return "bg-destructive/10 border-destructive/30";
}

// Weights for composite score
const WEIGHTS = { financial: 0.30, project: 0.30, compliance: 0.20, risk: 0.20 };

interface RawData {
  lkut: Tables<"lkut_reports"> | null;
  projects: Tables<"projects">[];
  risks: Tables<"risk_registers">[];
  k3Checklists: Tables<"k3_checklists">[];
  budgets: Tables<"budget_entries">[];
  profile: Tables<"profiles"> | null;
}

type ScoreDetails = Record<string, Json>;

function calcFinancialScore(lkut: Tables<"lkut_reports"> | null): { score: number; details: ScoreDetails } {
  if (!lkut) return { score: 0, details: { reason: "Belum ada data LKUT" } };

  let score = 0;
  const details: ScoreDetails = {};

  // Current Ratio (ideal >= 1.5) — 25 pts
  const cr = lkut.short_term_liabilities > 0 ? lkut.current_assets / lkut.short_term_liabilities : 0;
  details.current_ratio = Number(cr.toFixed(2));
  if (cr >= 2) score += 25;
  else if (cr >= 1.5) score += 20;
  else if (cr >= 1) score += 12;
  else if (cr > 0) score += 5;

  // Debt-to-Equity (ideal < 2) — 25 pts
  const de = lkut.total_equity > 0 ? lkut.total_liabilities / lkut.total_equity : 999;
  details.debt_to_equity = Number(de.toFixed(2));
  if (de <= 1) score += 25;
  else if (de <= 2) score += 18;
  else if (de <= 3) score += 10;
  else score += 2;

  // Profit Margin — 25 pts
  const pm = lkut.sales_value > 0 ? (lkut.gross_profit / lkut.sales_value) * 100 : 0;
  details.profit_margin_pct = Number(pm.toFixed(1));
  if (pm >= 15) score += 25;
  else if (pm >= 10) score += 20;
  else if (pm >= 5) score += 12;
  else if (pm > 0) score += 5;

  // Asset Growth — 25 pts
  const ag = lkut.asset_value_previous > 0
    ? ((lkut.asset_value_current - lkut.asset_value_previous) / lkut.asset_value_previous) * 100
    : 0;
  details.asset_growth_pct = Number(ag.toFixed(1));
  if (ag >= 15) score += 25;
  else if (ag >= 5) score += 18;
  else if (ag >= 0) score += 10;
  else score += 2;

  return { score, details };
}

function calcProjectScore(projects: Tables<"projects">[], budgets: Tables<"budget_entries">[]): { score: number; details: ScoreDetails } {
  if (projects.length === 0) return { score: 0, details: { reason: "Belum ada data proyek" } };

  const details: ScoreDetails = { total_projects: projects.length };
  let score = 0;

  // Volume — 25 pts (number of projects)
  if (projects.length >= 10) score += 25;
  else if (projects.length >= 5) score += 20;
  else if (projects.length >= 3) score += 15;
  else score += 8;

  // Completion rate — 25 pts
  const completed = projects.filter(p => p.status === "completed").length;
  const completionRate = projects.length > 0 ? (completed / projects.length) * 100 : 0;
  details.completion_rate = Number(completionRate.toFixed(1));
  if (completionRate >= 80) score += 25;
  else if (completionRate >= 60) score += 18;
  else if (completionRate >= 40) score += 10;
  else score += 3;

  // Complexity avg — 25 pts
  const avgComplexity = projects.reduce((s, p) => s + (p.complexity_score || 0), 0) / projects.length;
  details.avg_complexity = Number(avgComplexity.toFixed(1));
  if (avgComplexity >= 8) score += 25;
  else if (avgComplexity >= 5) score += 18;
  else if (avgComplexity >= 3) score += 10;
  else score += 5;

  // Budget deviation — 25 pts (lower is better)
  if (budgets.length > 0) {
    const totalPlanned = budgets.reduce((s, b) => s + (b.planned_amount || 0), 0);
    const totalActual = budgets.reduce((s, b) => s + (b.actual_amount || 0), 0);
    const deviation = totalPlanned > 0 ? Math.abs((totalActual - totalPlanned) / totalPlanned) * 100 : 0;
    details.budget_deviation_pct = Number(deviation.toFixed(1));
    if (deviation <= 5) score += 25;
    else if (deviation <= 10) score += 18;
    else if (deviation <= 20) score += 10;
    else score += 3;
  } else {
    score += 10; // neutral
    details.budget_deviation_pct = null;
  }

  return { score, details };
}

function calcComplianceScore(lkut: Tables<"lkut_reports"> | null, _profile: Tables<"profiles"> | null): { score: number; details: ScoreDetails } {
  let score = 0;
  const details: ScoreDetails = {};

  if (!lkut) return { score: 0, details: { reason: "Belum ada data LKUT" } };

  // SBU validity — 20 pts
  if (lkut.sbu_number) { score += 10; details.sbu_valid = true; }
  if (lkut.sbu_expiry_date && new Date(lkut.sbu_expiry_date) > new Date()) { score += 10; details.sbu_not_expired = true; }

  // SMAP — 20 pts
  if (lkut.smap_fulfilled) { score += 20; details.smap = true; }

  // Experience records — 20 pts
  if (lkut.experience_records_complete) { score += 20; details.experience_complete = true; }

  // GCG — 10 pts
  if (lkut.gcg_applied) { score += 10; details.gcg = true; }

  // SMK3 — 10 pts
  if (lkut.smk3_applied) { score += 10; details.smk3 = true; }

  // Trained employees ratio — 20 pts
  if (lkut.total_employees > 0) {
    const trainedRatio = (lkut.trained_employees / lkut.total_employees) * 100;
    details.trained_pct = Number(trainedRatio.toFixed(1));
    if (trainedRatio >= 70) score += 20;
    else if (trainedRatio >= 50) score += 14;
    else if (trainedRatio >= 30) score += 8;
    else score += 2;
  }

  return { score: Math.min(score, 100), details };
}

function calcRiskScore(risks: Tables<"risk_registers">[], k3: Tables<"k3_checklists">[]): { score: number; details: ScoreDetails } {
  const details: ScoreDetails = {};
  let score = 50; // start neutral

  // Risk management — up to 50 pts
  if (risks.length > 0) {
    const mitigated = risks.filter(r => r.status === "mitigated" || r.status === "closed").length;
    const mitigationRate = (mitigated / risks.length) * 100;
    details.risk_mitigation_rate = Number(mitigationRate.toFixed(1));
    details.total_risks = risks.length;

    if (mitigationRate >= 80) score += 30;
    else if (mitigationRate >= 50) score += 15;
    else score -= 10;

    // High severity penalty
    const highRisks = risks.filter(r => (r.probability_score * r.impact_score) >= 16).length;
    details.high_risk_count = highRisks;
    score -= highRisks * 5;
  } else {
    score += 10; // having no risks recorded is neutral-positive
  }

  // K3 compliance — up to 50 pts
  if (k3.length > 0) {
    const avgScore = k3.reduce((s, c) => s + (c.score_percent || 0), 0) / k3.length;
    details.avg_k3_score = Number(avgScore.toFixed(1));
    details.total_k3_inspections = k3.length;
    if (avgScore >= 90) score += 20;
    else if (avgScore >= 70) score += 10;
    else score -= 10;
  }

  return { score: Math.max(0, Math.min(score, 100)), details };
}

export function usePerformanceGrades() {
  const { user } = useAuth();
  const [grades, setGrades] = useState<PerformanceGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [computing, setComputing] = useState(false);

  const fetchGrades = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("performance_grades")
      .select("*")
      .eq("user_id", user.id)
      .order("period", { ascending: false });
    setGrades((data || []) as unknown as PerformanceGrade[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchGrades(); }, [fetchGrades]);

  const computeGrade = useCallback(async (period: string, bujkIdentity: { company_name: string; nib: string; sbu_number: string; bujk_qualification: string }) => {
    if (!user) return null;
    setComputing(true);

    try {
      // Fetch all data in parallel
      const [lkutRes, projRes, riskRes, k3Res, budgetRes, profileRes] = await Promise.all([
        supabase.from("lkut_reports").select("*").eq("user_id", user.id).order("report_year", { ascending: false }).limit(1),
        supabase.from("projects").select("*").eq("user_id", user.id),
        supabase.from("risk_registers").select("*").eq("user_id", user.id),
        supabase.from("k3_checklists").select("*").eq("user_id", user.id),
        supabase.from("budget_entries").select("*").eq("user_id", user.id),
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
      ]);

      const raw: RawData = {
        lkut: lkutRes.data?.[0] || null,
        projects: projRes.data || [],
        risks: riskRes.data || [],
        k3Checklists: k3Res.data || [],
        budgets: budgetRes.data || [],
        profile: profileRes.data,
      };

      const fin = calcFinancialScore(raw.lkut);
      const proj = calcProjectScore(raw.projects, raw.budgets);
      const comp = calcComplianceScore(raw.lkut, raw.profile);
      const risk = calcRiskScore(raw.risks, raw.k3Checklists);

      const totalScore = Number((
        fin.score * WEIGHTS.financial +
        proj.score * WEIGHTS.project +
        comp.score * WEIGHTS.compliance +
        risk.score * WEIGHTS.risk
      ).toFixed(1));

      const grade = scoreToGrade(totalScore);
      const breakdown = {
        financial: { score: fin.score, weight: WEIGHTS.financial, ...fin.details },
        project: { score: proj.score, weight: WEIGHTS.project, ...proj.details },
        compliance: { score: comp.score, weight: WEIGHTS.compliance, ...comp.details },
        risk: { score: risk.score, weight: WEIGHTS.risk, ...risk.details },
      };

      // Upsert
      const { data, error } = await supabase
        .from("performance_grades")
        .upsert(
          {
            user_id: user.id,
            period,
            company_name: bujkIdentity.company_name,
            nib: bujkIdentity.nib,
            sbu_number: bujkIdentity.sbu_number,
            bujk_qualification: bujkIdentity.bujk_qualification,
            financial_score: fin.score,
            project_score: proj.score,
            compliance_score: comp.score,
            risk_score: risk.score,
            total_score: totalScore,
            grade,
            breakdown,
            computed_at: new Date().toISOString(),
          },
          { onConflict: "user_id,period" }
        )
        .select()
        .single();

      if (error) {
        toast.error("Gagal menyimpan grade: " + error.message);
        return null;
      }

      // Check if grade dropped from previous period
      const prevGrade = grades.length > 0 ? grades[0] : null;
      if (prevGrade && prevGrade.period !== period && totalScore < prevGrade.total_score) {
        await supabase.from("notifications").insert({
          user_id: user.id,
          type: "grade_drop",
          title: "⚠️ Grade BUJK Anda Turun",
          message: `Grade Anda turun dari ${prevGrade.grade} (${prevGrade.total_score}) ke ${grade} (${totalScore}) pada periode ${period}. Periksa pilar kinerja yang menurun.`,
        });
        toast.warning(`Grade turun dari ${prevGrade.grade} → ${grade}`);
      } else {
        toast.success(`Grade ${period}: ${grade} (${totalScore} poin)`);
      }
      await fetchGrades();
      return data as unknown as PerformanceGrade;
    } finally {
      setComputing(false);
    }
  }, [user, fetchGrades, grades]);

  return { grades, loading, computing, computeGrade, fetchGrades };
}
