import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  BarChart3, TrendingUp, Target, Activity,
  Star, Award, Crown, Gem, AlertCircle, RotateCcw
} from "lucide-react";
import { FourPillarCard } from "@/components/scoring/FourPillarCard";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell
} from "recharts";
import type { LucideIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { assessmentLevel, formatAssessmentDate } from "@/lib/competencyFallbacks";
import {
  orderAssessmentsChronologically,
  selectLatestAssessment,
} from "@/lib/assessmentOrdering";

const domainColors = [
  "hsl(200, 80%, 55%)", // sky
  "hsl(160, 60%, 40%)", // emerald
  "hsl(38, 92%, 50%)",  // amber
  "hsl(260, 50%, 55%)", // violet
  "hsl(0, 84%, 60%)",   // red
  "hsl(220, 60%, 50%)", // blue
];

const levelConfig: Record<string, { icon: LucideIcon; color: string; bg: string; min: number; max: number }> = {
  Pemula: { icon: Star, color: "text-pub-sky", bg: "bg-pub-sky/10", min: 0, max: 59 },
  Muda: { icon: Award, color: "text-pub-emerald", bg: "bg-pub-emerald/10", min: 60, max: 74 },
  Madya: { icon: Crown, color: "text-pub-amber", bg: "bg-pub-amber/10", min: 75, max: 84 },
  Utama: { icon: Gem, color: "text-pub-violet", bg: "bg-pub-violet/10", min: 85, max: 100 },
};

export interface AnalyticsAssessmentRow {
  score: number | null;
  determined_level: string | null;
  completed_at: string | null;
}

export function buildAssessmentHistory(tests: AnalyticsAssessmentRow[]) {
  return orderAssessmentsChronologically(tests).map((test, index) => ({
    test: `#${index + 1}`,
    score: test.score ?? 0,
    level: assessmentLevel(test.determined_level, "Pemula"),
    date: formatAssessmentDate(test.completed_at, "short"),
  }));
}

interface AnalyticsProps {
  initialAssessmentRows?: AnalyticsAssessmentRow[];
}

const Analytics = ({ initialAssessmentRows = [] }: AnalyticsProps) => {
  const { user, profile } = useAuth();
  const [radarData, setRadarData] = useState<{ domain: string; score: number; fullMark: number }[]>([]);
  const [barData, setBarData] = useState<{ domain: string; completed: number; total: number; color: string }[]>([]);
  const [assessmentHistory, setAssessmentHistory] = useState(() =>
    buildAssessmentHistory(initialAssessmentRows),
  );
  const [latestAssessment, setLatestAssessment] = useState(() => {
    const latest = selectLatestAssessment(initialAssessmentRows);
    return latest
      ? {
          level: assessmentLevel(latest.determined_level, "Pemula"),
          date: formatAssessmentDate(latest.completed_at, "short"),
        }
      : null;
  });
  const [assessmentHistoryError, setAssessmentHistoryError] = useState(false);
  const [isRetryingAssessmentHistory, setIsRetryingAssessmentHistory] = useState(false);
  const [moduleStats, setModuleStats] = useState({ total: 0, completed: 0, inProgress: 0 });

  const fetchAnalytics = useCallback(async (isRetry = false) => {
      if (!user) return;
      if (isRetry) setIsRetryingAssessmentHistory(true);
      setAssessmentHistoryError(false);

      // Fetch domains
      const { data: domains } = await supabase
        .from("competency_domains")
        .select("*")
        .order("sort_order");

      // Fetch module progress
      const { data: progress } = await supabase
        .from("module_progress")
        .select("*, e_course_modules(domain_id, level)")
        .eq("user_id", user.id);

      // Fetch all completed pre-tests with answers
      const { data: tests, error: testsError } = await supabase
        .from("pre_tests")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "completed")
        .order("completed_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false });
      const completedTests = testsError ? [] : (tests || []);
      setAssessmentHistoryError(Boolean(testsError));

      // Fetch latest test answers for domain breakdown
      const latestTest = selectLatestAssessment(completedTests);
      const domainScores: Record<string, { correct: number; total: number }> = {};

      if (latestTest) {
        const { data: answers } = await supabase
          .from("pre_test_answers")
          .select("*, questions(domain_id)")
          .eq("pre_test_id", latestTest.id);

        (answers || []).forEach((a) => {
          const domainId = a.questions?.domain_id;
          if (!domainId) return;
          if (!domainScores[domainId]) domainScores[domainId] = { correct: 0, total: 0 };
          domainScores[domainId].total++;
          if (a.is_correct) domainScores[domainId].correct++;
        });
      }

      // Build radar data
      const radar = (domains || []).map((d) => {
        const ds = domainScores[d.id];
        const score = ds ? Math.round((ds.correct / ds.total) * 100) : 0;
        return { domain: d.name.replace("&", "\n&"), score, fullMark: 100 };
      });

      // Build bar data
      const bar = (domains || []).map((d, i) => {
        const domainModules = (progress || []).filter(
          (p) => p.e_course_modules?.domain_id === d.id
        );
        const completed = domainModules.filter((p) => p.status === "completed").length;
        return { domain: d.name.split(" ")[0], completed, total: 4, color: domainColors[i] };
      });

      // Assessment history for trend
      const history = buildAssessmentHistory(completedTests);
      const latest = selectLatestAssessment(completedTests);

      setRadarData(radar);
      setBarData(bar);
      setAssessmentHistory(history);
      setLatestAssessment(
        latest
          ? {
              level: assessmentLevel(latest.determined_level, "Pemula"),
              date: formatAssessmentDate(latest.completed_at, "short"),
            }
          : null,
      );
      setModuleStats({
        total: 24,
        completed: (progress || []).filter((p) => p.status === "completed").length,
        inProgress: (progress || []).filter((p) => p.status === "in_progress").length,
      });
      setIsRetryingAssessmentHistory(false);
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchAnalytics();
  }, [fetchAnalytics, user]);

  const level = profile?.current_level || "Pemula";
  const lc = levelConfig[level];
  const LevelIcon = lc.icon;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="mb-2 flex flex-col justify-between gap-3 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground flex items-center gap-3">
            <BarChart3 className="w-7 h-7 text-pub-amber" />
            Analytics Kompetensi
          </h1>
          <p className="text-muted-foreground font-body mt-1">
            Visualisasi dan analisis perkembangan kompetensi Anda.
          </p>
        </div>
        <Link
          to="/siap-kompetensi"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-pub-navy px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Target className="h-4 w-4" />
          Peta Kompetensi 4 SIAP
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="bg-card border border-border rounded-xl p-5 shadow-card">
          <div className={`w-10 h-10 rounded-lg ${lc.bg} flex items-center justify-center mb-3`}>
            <LevelIcon className={`w-5 h-5 ${lc.color}`} />
          </div>
          <p className="text-2xl font-bold font-heading text-foreground">{level}</p>
          <p className="text-xs text-muted-foreground font-body">Level Saat Ini</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="bg-card border border-border rounded-xl p-5 shadow-card">
          <div className="w-10 h-10 rounded-lg bg-pub-amber/10 flex items-center justify-center mb-3">
            <Target className="w-5 h-5 text-pub-amber" />
          </div>
          <p className="text-2xl font-bold font-heading text-foreground">{profile?.total_score || 0}</p>
          <p className="text-xs text-muted-foreground font-body">Skor Terakhir</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="bg-card border border-border rounded-xl p-5 shadow-card">
          <div className="w-10 h-10 rounded-lg bg-pub-emerald/10 flex items-center justify-center mb-3">
            <Activity className="w-5 h-5 text-pub-emerald" />
          </div>
          <p className="text-2xl font-bold font-heading text-foreground">{moduleStats.completed}/{moduleStats.total}</p>
          <p className="text-xs text-muted-foreground font-body">Modul Selesai</p>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="bg-card border border-border rounded-xl p-5 shadow-card">
          <div className="w-10 h-10 rounded-lg bg-pub-violet/10 flex items-center justify-center mb-3">
            <TrendingUp className="w-5 h-5 text-pub-violet" />
          </div>
          <p className="text-2xl font-bold font-heading text-foreground">{assessmentHistory.length}</p>
          <p className="text-xs text-muted-foreground font-body">Assessment Diambil</p>
        </motion.div>
      </div>

      {/* Charts */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Radar chart - Domain competency */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card border border-border rounded-xl p-6 shadow-card"
        >
          <h3 className="font-heading font-bold text-foreground mb-4">Peta Kompetensi per Domain</h3>
          {radarData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <RadarChart data={radarData}>
                <PolarGrid stroke="hsl(220, 15%, 88%)" />
                <PolarAngleAxis dataKey="domain" tick={{ fontSize: 11, fill: "hsl(220, 10%, 50%)" }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar
                  name="Skor"
                  dataKey="score"
                  stroke="hsl(38, 92%, 50%)"
                  fill="hsl(38, 92%, 50%)"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground font-body text-sm">
              Belum ada data assessment. Ambil pre-test terlebih dahulu.
            </div>
          )}
        </motion.div>

        {/* Bar chart - Module progress per domain */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card border border-border rounded-xl p-6 shadow-card"
        >
          <h3 className="font-heading font-bold text-foreground mb-4">Progress Modul per Domain</h3>
          {barData.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={barData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
                <XAxis type="number" domain={[0, 4]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="domain" width={80} tick={{ fontSize: 11 }} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(0, 0%, 100%)",
                    border: "1px solid hsl(220, 15%, 88%)",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="completed" name="Selesai" radius={[0, 4, 4, 0]}>
                  {barData.map((entry, idx) => (
                    <Cell key={idx} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[300px] flex items-center justify-center text-muted-foreground font-body text-sm">
              Belum ada progress modul.
            </div>
          )}
        </motion.div>
      </div>

      {/* Assessment history trend */}
      {assessmentHistoryError ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 text-center">
          <AlertCircle className="mx-auto mb-3 h-7 w-7 text-destructive" />
          <h3 className="font-heading font-bold text-foreground">Riwayat assessment gagal dimuat</h3>
          <p className="mt-1 text-sm text-muted-foreground font-body">
            Data riwayat Anda belum dapat ditampilkan. Silakan coba lagi.
          </p>
          <button
            type="button"
            onClick={() => fetchAnalytics(true)}
            disabled={isRetryingAssessmentHistory}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
          >
            <RotateCcw className={`h-4 w-4 ${isRetryingAssessmentHistory ? "animate-spin" : ""}`} />
            {isRetryingAssessmentHistory ? "Memuat ulang..." : "Coba Lagi"}
          </button>
        </div>
      ) : assessmentHistory.length > 0 && latestAssessment ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-card border border-border rounded-xl p-6 shadow-card"
        >
          <h3 className="font-heading font-bold text-foreground mb-4">Tren Skor Assessment</h3>
          <p className="mb-3 text-sm text-muted-foreground font-body">
            Assessment terbaru:{" "}
            <span className="font-semibold text-foreground">
              {latestAssessment.level}
            </span>
            {" · "}
            {latestAssessment.date}
          </p>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={assessmentHistory}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip
                contentStyle={{
                  background: "hsl(0, 0%, 100%)",
                  border: "1px solid hsl(220, 15%, 88%)",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number | string) => [`${value}`, "Skor"]}
              />
              <Bar dataKey="score" name="Skor" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 text-center shadow-card">
          <h3 className="font-heading font-bold text-foreground">Riwayat Assessment</h3>
          <p className="mt-1 text-sm text-muted-foreground font-body">
            Belum ada assessment yang selesai.
          </p>
        </div>
      )}

      {/* 4-Pillar Scoring Engine */}
      <FourPillarCard />

      {/* Level progression guide */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="bg-card border border-border rounded-xl p-6 shadow-card"
      >
        <h3 className="font-heading font-bold text-foreground mb-4">Skala Level Kompetensi</h3>
        <div className="flex gap-2">
          {Object.entries(levelConfig).map(([name, cfg]) => {
            const Icon = cfg.icon;
            const isActive = name === level;
            return (
              <div
                key={name}
                className={`flex-1 rounded-xl p-4 border transition-all ${
                  isActive ? "border-pub-amber bg-pub-amber/5 shadow-amber" : "border-border"
                }`}
              >
                <Icon className={`w-6 h-6 ${cfg.color} mb-2`} />
                <p className="font-heading font-bold text-foreground text-sm">{name}</p>
                <p className="text-xs text-muted-foreground font-body">
                  Skor {cfg.min}–{cfg.max}
                </p>
              </div>
            );
          })}
        </div>
      </motion.div>
    </div>
  );
};

export default Analytics;
