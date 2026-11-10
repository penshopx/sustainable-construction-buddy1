import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  Building2, Users, TrendingUp, AlertTriangle, BarChart3,
  Star, Award, Crown, Gem, ChevronRight, ShieldCheck,
  CheckCircle2, XCircle, Clock, FileCheck2, FileDown, Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportCompliancePdf } from "@/lib/corporatePdf";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { differenceInDays, parseISO } from "date-fns";
import { Progress } from "@/components/ui/progress";
import { BujkDetailDialog } from "@/components/corporate/BujkDetailDialog";
import { PancekVerification } from "@/components/admin/PancekVerification";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, Legend,
  LineChart, Line, CartesianGrid,
} from "recharts";

const levelConfig = {
  Pemula: { icon: Star, color: "hsl(var(--pub-sky))", bg: "bg-pub-sky/10" },
  Muda: { icon: Award, color: "hsl(var(--pub-emerald))", bg: "bg-pub-emerald/10" },
  Madya: { icon: Crown, color: "hsl(var(--pub-amber))", bg: "bg-pub-amber/10" },
  Utama: { icon: Gem, color: "hsl(var(--pub-violet))", bg: "bg-pub-violet/10" },
};

const PIE_COLORS = [
  "hsl(var(--pub-sky))",
  "hsl(var(--pub-emerald))",
  "hsl(var(--pub-amber))",
  "hsl(var(--pub-violet))",
];

interface DashboardStats {
  totalUsers: number;
  avgScore: number;
  levelDistribution: { name: string; value: number }[];
  domainScores: { domain: string; avgScore: number; weakCount: number }[];
  topWeakDomains: string[];
  kci: number;
  activeProjects: number;
  evaluationCompliance: number;
}

interface ComplianceRow {
  userId: string;
  fullName: string;
  company: string;
  sbuNumber: string;
  sbuStatus: "valid" | "expiring" | "expired" | "missing";
  sbuDaysLeft: number | null;
  smap: boolean;
  tkk: boolean;
  gcg: boolean;
  smk3: boolean;
  pancek: "verified" | "submitted" | "draft" | "missing";
  score: number; // out of 6 now
}

interface GradeRecord {
  userId: string;
  fullName: string;
  period: string;
  grade: string;
  totalScore: number;
  financial: number;
  project: number;
  compliance: number;
  risk: number;
}

const CorporateDashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    avgScore: 0,
    levelDistribution: [],
    domainScores: [],
    topWeakDomains: [],
    kci: 0,
    activeProjects: 0,
    evaluationCompliance: 0,
  });
  const [complianceRows, setComplianceRows] = useState<ComplianceRow[]>([]);
  const [gradeRecords, setGradeRecords] = useState<GradeRecord[]>([]);
  const [selectedGradeUser, setSelectedGradeUser] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [sbuFilter, setSbuFilter] = useState<string>("all");
  const [detailUser, setDetailUser] = useState<{ userId: string; fullName: string; company: string } | null>(null);

  useEffect(() => {
    const fetchCorporateData = async () => {
      try {
        const [profilesRes, scoresRes, domainsRes, progressRes, projectsRes] = await Promise.all([
          supabase.from("profiles").select("current_level, total_score, user_id"),
          supabase.from("competency_scores").select("*"),
          supabase.from("competency_domains").select("*").order("sort_order"),
          supabase.from("module_progress").select("*, e_course_modules(domain_id, competency_domains:domain_id(name))"),
          supabase.from("projects").select("status"),
        ]);

        const profiles = profilesRes.data || [];
        const scores = scoresRes.data || [];
        const domains = domainsRes.data || [];
        const progress = progressRes.data || [];
        const projects = projectsRes.data || [];

        // Level distribution
        const levelCounts: Record<string, number> = { Pemula: 0, Muda: 0, Madya: 0, Utama: 0 };
        profiles.forEach((p) => {
          const lvl = p.current_level || "Pemula";
          if (levelCounts[lvl] !== undefined) levelCounts[lvl]++;
        });
        const levelDistribution = Object.entries(levelCounts).map(([name, value]) => ({ name, value }));

        // Average score
        const totalScore = profiles.reduce((sum, p) => sum + (p.total_score || 0), 0);
        const avgScore = profiles.length > 0 ? Math.round(totalScore / profiles.length) : 0;

        // KCI (Knowledge Capacity Index) = weighted average based on level
        const levelWeights: Record<string, number> = { Pemula: 25, Muda: 50, Madya: 75, Utama: 100 };
        const totalKCI = profiles.reduce((sum, p) => {
          return sum + (levelWeights[p.current_level || "Pemula"] || 25);
        }, 0);
        const kci = profiles.length > 0 ? Math.round(totalKCI / profiles.length) : 0;

        // Domain scores from module progress
        const domainScores = domains.map((d) => {
          const domainProgress = progress.filter(
            (p) => p.e_course_modules?.domain_id === d.id
          );
          const completed = domainProgress.filter((p) => p.status === "completed").length;
          const total = domainProgress.length || 1;
          const avgCompletion = Math.round((completed / total) * 100);
          const weakCount = domainProgress.filter((p) => p.status !== "completed").length;

          return {
            domain: d.name,
            avgScore: avgCompletion,
            weakCount,
            fullMark: 100,
          };
        });

        // Top weak domains (lowest completion)
        const sorted = [...domainScores].sort((a, b) => a.avgScore - b.avgScore);
        const topWeakDomains = sorted.slice(0, 3).map((d) => d.domain);

        // Active projects
        const activeProjects = projects.filter((p) => p.status === "active").length;

        // Evaluation compliance (users with score > 0 / total)
        const evaluated = profiles.filter((p) => (p.total_score || 0) > 0).length;
        const evaluationCompliance = profiles.length > 0 ? Math.round((evaluated / profiles.length) * 100) : 0;

        setStats({
          totalUsers: profiles.length,
          avgScore,
          levelDistribution,
          domainScores,
          topWeakDomains,
          kci,
          activeProjects,
          evaluationCompliance,
        });

        // Fetch compliance data (all LKUT reports + profiles for names)
        const { data: allLkut } = await supabase
          .from("lkut_reports")
          .select("user_id, sbu_number, sbu_expiry_date, smap_fulfilled, tkk_replacement, gcg_applied, smk3_applied, report_year")
          .order("report_year", { ascending: false });

        // Group by user_id, take latest
        const lkutByUser = new Map<string, NonNullable<typeof allLkut>[number]>();
        (allLkut || []).forEach((r) => {
          if (!lkutByUser.has(r.user_id)) lkutByUser.set(r.user_id, r);
        });

        // Fetch full names
        const { data: allProfiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, company");
        const nameMap = new Map<string, { name: string; company: string }>();
        (allProfiles || []).forEach((p) => nameMap.set(p.user_id, { name: p.full_name || "-", company: p.company || "-" }));

        const now = new Date();

        // Fetch PANCEK assessments for all users
        const { data: allPancek } = await supabase.from("pancek_assessments")
          .select("user_id, status, period_year")
          .order("period_year", { ascending: false });

        const pancekByUser = new Map<string, string>();
        (allPancek || []).forEach((p) => {
          if (!pancekByUser.has(p.user_id)) pancekByUser.set(p.user_id, p.status);
        });

        const rows: ComplianceRow[] = [];
        lkutByUser.forEach((lkut, userId) => {
          const info = nameMap.get(userId) || { name: "-", company: "-" };
          const sbuExpiry = lkut.sbu_expiry_date ? parseISO(lkut.sbu_expiry_date) : null;
          const sbuDaysLeft = sbuExpiry ? differenceInDays(sbuExpiry, now) : null;

          let sbuStatus: ComplianceRow["sbuStatus"] = "missing";
          if (lkut.sbu_number && sbuExpiry) {
            if (sbuDaysLeft! < 0) sbuStatus = "expired";
            else if (sbuDaysLeft! <= 90) sbuStatus = "expiring";
            else sbuStatus = "valid";
          } else if (lkut.sbu_number) {
            sbuStatus = "valid";
          }

          const fulfilled = [
            sbuStatus === "valid" || sbuStatus === "expiring",
            !!lkut.smap_fulfilled,
            !!lkut.tkk_replacement,
            !!lkut.gcg_applied,
            !!lkut.smk3_applied,
            pancekByUser.get(userId) === "verified",
          ].filter(Boolean).length;

          const pancekStatus = (pancekByUser.get(userId) || "missing") as ComplianceRow["pancek"];

          rows.push({
            userId,
            fullName: info.name,
            company: info.company,
            sbuNumber: lkut.sbu_number || "-",
            sbuStatus,
            sbuDaysLeft,
            smap: !!lkut.smap_fulfilled,
            tkk: !!lkut.tkk_replacement,
            gcg: !!lkut.gcg_applied,
            smk3: !!lkut.smk3_applied,
            pancek: pancekStatus,
            score: fulfilled,
          });
        });

        // Sort by score ascending (worst first)
        rows.sort((a, b) => a.score - b.score);
        setComplianceRows(rows);

        // Fetch grade data for comparison
        const { data: allGrades } = await supabase
          .from("performance_grades")
          .select("user_id, period, grade, total_score, financial_score, project_score, compliance_score, risk_score")
          .order("period", { ascending: true });

        const gradeRows: GradeRecord[] = (allGrades || []).map((g) => {
          const info = nameMap.get(g.user_id) || { name: "-", company: "-" };
          return {
            userId: g.user_id,
            fullName: info.name,
            period: g.period,
            grade: g.grade,
            totalScore: Number(g.total_score),
            financial: Number(g.financial_score),
            project: Number(g.project_score),
            compliance: Number(g.compliance_score),
            risk: Number(g.risk_score),
          };
        });
        setGradeRecords(gradeRows);

      } catch (err) {
        console.error("Error fetching corporate data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchCorporateData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pub-amber" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <div className="w-12 h-12 rounded-xl bg-pub-amber/10 flex items-center justify-center">
          <Building2 className="w-6 h-6 text-pub-amber" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Corporate Dashboard</h1>
          <p className="text-sm text-muted-foreground font-body">Monitoring kapasitas kompetensi organisasi</p>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Anggota", value: stats.totalUsers, icon: Users, color: "text-pub-sky", bg: "bg-pub-sky/10" },
          { label: "Knowledge Capacity Index", value: `${stats.kci}%`, icon: TrendingUp, color: "text-pub-emerald", bg: "bg-pub-emerald/10" },
          { label: "Rata-rata Skor", value: stats.avgScore, icon: BarChart3, color: "text-pub-amber", bg: "bg-pub-amber/10" },
          { label: "Evaluation Compliance", value: `${stats.evaluationCompliance}%`, icon: stats.evaluationCompliance < 50 ? AlertTriangle : Award, color: stats.evaluationCompliance < 50 ? "text-destructive" : "text-pub-violet", bg: stats.evaluationCompliance < 50 ? "bg-destructive/10" : "bg-pub-violet/10" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="bg-card rounded-xl border border-border p-5 shadow-card"
          >
            <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <p className="text-2xl font-bold font-heading text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground font-body">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* KCI Gauge */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card rounded-xl border border-border p-6 shadow-card"
      >
        <h2 className="text-lg font-bold font-heading text-foreground mb-2 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-pub-amber" />
          Knowledge Capacity Index (KCI)
        </h2>
        <p className="text-sm text-muted-foreground font-body mb-4">
          Indeks kapasitas pengetahuan organisasi berdasarkan distribusi level anggota (Pemula=25%, Muda=50%, Madya=75%, Utama=100%).
        </p>
        <div className="flex items-center gap-6">
          <div className="flex-1">
            <div className="flex justify-between text-sm mb-2">
              <span className="text-muted-foreground font-body">Indeks</span>
              <span className="font-heading font-bold text-pub-amber">{stats.kci}%</span>
            </div>
            <Progress value={stats.kci} className="h-4" />
            <div className="flex justify-between text-xs text-muted-foreground mt-1">
              <span>Rendah</span>
              <span>Tinggi</span>
            </div>
          </div>
          <div className="text-center px-6 py-3 bg-pub-amber/5 rounded-xl border border-pub-amber/20">
            <p className="text-3xl font-bold font-heading text-pub-amber">{stats.kci}</p>
            <p className="text-xs text-muted-foreground font-body">dari 100</p>
          </div>
        </div>
      </motion.div>

      {/* Level Distribution + Domain Heatmap */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Level Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card rounded-xl border border-border p-6 shadow-card"
        >
          <h2 className="text-lg font-bold font-heading text-foreground mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-pub-sky" />
            Distribusi Level Anggota
          </h2>
          {stats.totalUsers > 0 ? (
            <>
              <div className="h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.levelDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {stats.levelDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                {stats.levelDistribution.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                    <span className="font-body text-muted-foreground">{item.name}</span>
                    <span className="font-heading font-bold text-foreground ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">Belum ada data anggota.</p>
          )}
        </motion.div>

        {/* Domain Weakness Heatmap */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-xl border border-border p-6 shadow-card"
        >
          <h2 className="text-lg font-bold font-heading text-foreground mb-4 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-pub-amber" />
            Heatmap Domain Weakness
          </h2>
          {stats.domainScores.length > 0 ? (
            <div className="space-y-3">
              {stats.domainScores.map((d) => {
                const strength =
                  d.avgScore >= 70 ? "strong" : d.avgScore >= 40 ? "moderate" : "weak";
                const barColor =
                  strength === "strong"
                    ? "bg-pub-emerald"
                    : strength === "moderate"
                    ? "bg-pub-amber"
                    : "bg-destructive";
                const labelColor =
                  strength === "strong"
                    ? "text-pub-emerald"
                    : strength === "moderate"
                    ? "text-pub-amber"
                    : "text-destructive";
                const badgeText =
                  strength === "strong" ? "Kuat" : strength === "moderate" ? "Sedang" : "Lemah";

                return (
                  <div key={d.domain} className="group">
                    <div className="flex justify-between items-center text-sm mb-1.5">
                      <span className="font-heading font-medium text-foreground">{d.domain}</span>
                      <span className={`text-xs font-heading px-2 py-0.5 rounded-full ${labelColor} ${
                        strength === "strong"
                          ? "bg-pub-emerald/10"
                          : strength === "moderate"
                          ? "bg-pub-amber/10"
                          : "bg-destructive/10"
                      }`}>
                        {badgeText} ({d.avgScore}%)
                      </span>
                    </div>
                    <div className="w-full h-3 bg-muted rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${barColor}`}
                        style={{ width: `${d.avgScore}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">Belum ada data domain.</p>
          )}

          {stats.topWeakDomains.length > 0 && (
            <div className="mt-4 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
              <p className="text-xs font-heading text-destructive font-semibold mb-1">
                ⚠ Area yang Perlu Perhatian:
              </p>
              <p className="text-xs text-muted-foreground font-body">
                {stats.topWeakDomains.join(", ")}
              </p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Domain Radar Chart */}
      {stats.domainScores.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="bg-card rounded-xl border border-border p-6 shadow-card"
        >
          <h2 className="text-lg font-bold font-heading text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-pub-emerald" />
            Radar Kompetensi Organisasi
          </h2>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={stats.domainScores}>
                <PolarGrid stroke="hsl(var(--border))" />
                <PolarAngleAxis
                  dataKey="domain"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                />
                <PolarRadiusAxis
                  angle={30}
                  domain={[0, 100]}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                />
                <Radar
                  name="Avg Completion"
                  dataKey="avgScore"
                  stroke="hsl(var(--pub-amber))"
                  fill="hsl(var(--pub-amber))"
                  fillOpacity={0.25}
                />
                <Legend />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                  }}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Grade Comparison Section */}
      {gradeRecords.length > 0 && (() => {
        const uniqueUsers = Array.from(new Map(gradeRecords.map(g => [g.userId, g.fullName])));
        const filteredGrades = selectedGradeUser === "all"
          ? gradeRecords
          : gradeRecords.filter(g => g.userId === selectedGradeUser);

        // Build chart data: group by period
        const periodMap = new Map<string, { period: string; financial: number; project: number; compliance: number; risk: number; total: number; count: number }>();
        filteredGrades.forEach(g => {
          const existing = periodMap.get(g.period);
          if (existing) {
            existing.financial += g.financial;
            existing.project += g.project;
            existing.compliance += g.compliance;
            existing.risk += g.risk;
            existing.total += g.totalScore;
            existing.count += 1;
          } else {
            periodMap.set(g.period, { period: g.period, financial: g.financial, project: g.project, compliance: g.compliance, risk: g.risk, total: g.totalScore, count: 1 });
          }
        });
        const chartData = Array.from(periodMap.values()).map(d => ({
          period: d.period,
          Keuangan: Math.round(d.financial / d.count * 10) / 10,
          Proyek: Math.round(d.project / d.count * 10) / 10,
          Kepatuhan: Math.round(d.compliance / d.count * 10) / 10,
          Risiko: Math.round(d.risk / d.count * 10) / 10,
          Total: Math.round(d.total / d.count * 10) / 10,
        }));

        // Table: latest grade per user
        const latestByUser = new Map<string, GradeRecord>();
        filteredGrades.forEach(g => {
          const prev = latestByUser.get(g.userId);
          if (!prev || g.period > prev.period) latestByUser.set(g.userId, g);
        });
        // Previous grade per user (second latest)
        const prevByUser = new Map<string, GradeRecord>();
        filteredGrades.forEach(g => {
          const latest = latestByUser.get(g.userId);
          if (latest && g.period < latest.period) {
            const prev = prevByUser.get(g.userId);
            if (!prev || g.period > prev.period) prevByUser.set(g.userId, g);
          }
        });

        const trendIcon = (curr: number, prev: number | undefined) => {
          if (prev === undefined) return <span className="text-muted-foreground text-xs">—</span>;
          if (curr > prev) return <span className="text-pub-emerald text-xs font-bold">▲ +{(curr - prev).toFixed(1)}</span>;
          if (curr < prev) return <span className="text-destructive text-xs font-bold">▼ {(curr - prev).toFixed(1)}</span>;
          return <span className="text-muted-foreground text-xs">= 0</span>;
        };

        const gradeColor = (grade: string) => {
          if (grade.startsWith("A")) return "bg-pub-emerald/20 text-pub-emerald border-pub-emerald/30";
          if (grade.startsWith("B")) return "bg-pub-sky/20 text-pub-sky border-pub-sky/30";
          if (grade.startsWith("C")) return "bg-pub-amber/20 text-pub-amber border-pub-amber/30";
          return "bg-destructive/20 text-destructive border-destructive/30";
        };

        return (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28 }}
            className="bg-card rounded-xl border border-border p-6 shadow-card space-y-5"
          >
            <div className="flex items-center justify-between flex-wrap gap-3">
              <h2 className="text-lg font-bold font-heading text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-pub-violet" />
                Perbandingan Grade Antar Periode
              </h2>
              <Select value={selectedGradeUser} onValueChange={setSelectedGradeUser}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Pilih BUJK" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua BUJK</SelectItem>
                  {uniqueUsers.map(([id, name]) => (
                    <SelectItem key={id} value={id}>{name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Pillar Trend Line Chart */}
            {chartData.length > 0 && (
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="period" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="Keuangan" stroke="hsl(var(--pub-sky))" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Proyek" stroke="hsl(var(--pub-emerald))" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Kepatuhan" stroke="hsl(var(--pub-amber))" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Risiko" stroke="hsl(var(--pub-violet))" strokeWidth={2} dot={{ r: 4 }} />
                    <Line type="monotone" dataKey="Total" stroke="hsl(var(--foreground))" strokeWidth={2.5} strokeDasharray="5 5" dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Grade Table with Trend Arrows */}
            <div className="overflow-x-auto rounded-lg border border-border">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="font-heading">Nama</TableHead>
                    <TableHead className="font-heading text-center">Periode</TableHead>
                    <TableHead className="font-heading text-center">Grade</TableHead>
                    <TableHead className="font-heading text-center">Total</TableHead>
                    <TableHead className="font-heading text-center">Keuangan</TableHead>
                    <TableHead className="font-heading text-center">Proyek</TableHead>
                    <TableHead className="font-heading text-center">Kepatuhan</TableHead>
                    <TableHead className="font-heading text-center">Risiko</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Array.from(latestByUser.values()).map(row => {
                    const prev = prevByUser.get(row.userId);
                    return (
                      <TableRow key={row.userId} className="hover:bg-muted/20">
                        <TableCell className="font-medium text-foreground">{row.fullName}</TableCell>
                        <TableCell className="text-center text-sm text-muted-foreground">{row.period}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={gradeColor(row.grade)}>{row.grade}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-bold font-heading text-sm">{row.totalScore.toFixed(1)}</span>
                            {trendIcon(row.totalScore, prev?.totalScore)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-sm">{row.financial}</span>
                            {trendIcon(row.financial, prev?.financial)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-sm">{row.project}</span>
                            {trendIcon(row.project, prev?.project)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-sm">{row.compliance}</span>
                            {trendIcon(row.compliance, prev?.compliance)}
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-sm">{row.risk}</span>
                            {trendIcon(row.risk, prev?.risk)}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {chartData.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Pilih BUJK atau tambah data grading untuk melihat tren.</p>
            )}
          </motion.div>
        );
      })()}

      {/* PANCEK Verification Section */}
      <PancekVerification />

      {/* Compliance Overview Table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-card rounded-xl border border-border p-6 shadow-card"
      >
        <div className="flex items-center justify-between mb-1">
          <h2 className="text-lg font-bold font-heading text-foreground flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-pub-emerald" />
            Ringkasan Kepatuhan Seluruh BUJK
          </h2>
          {complianceRows.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => exportCompliancePdf(complianceRows)}
            >
              <FileDown className="w-4 h-4" />
              Export PDF
            </Button>
          )}
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Status kepatuhan SBU, SMAP, TKK, GCG, dan SMK3 berdasarkan data LKUT terbaru
        </p>

        {/* Search & Filter */}
        {complianceRows.length > 0 && (
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama atau perusahaan..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={sbuFilter} onValueChange={setSbuFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Status SBU" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="valid">SBU Aktif</SelectItem>
                <SelectItem value="expiring">SBU Expiring</SelectItem>
                <SelectItem value="expired">SBU Expired</SelectItem>
                <SelectItem value="missing">Tidak Ada SBU</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {(() => {
          const filteredRows = complianceRows.filter((row) => {
            const q = searchQuery.toLowerCase();
            const matchSearch = !q || row.fullName.toLowerCase().includes(q) || row.company.toLowerCase().includes(q);
            const matchSbu = sbuFilter === "all" || row.sbuStatus === sbuFilter;
            return matchSearch && matchSbu;
          });

          return filteredRows.length > 0 ? (
          <div className="overflow-x-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="font-heading">Nama</TableHead>
                  <TableHead className="font-heading">Perusahaan</TableHead>
                  <TableHead className="font-heading text-center">SBU</TableHead>
                  <TableHead className="font-heading text-center">SMAP</TableHead>
                  <TableHead className="font-heading text-center">TKK</TableHead>
                  <TableHead className="font-heading text-center">GCG</TableHead>
                   <TableHead className="font-heading text-center">SMK3</TableHead>
                   <TableHead className="font-heading text-center">PANCEK</TableHead>
                   <TableHead className="font-heading text-center">Skor</TableHead>
                   <TableHead className="font-heading text-center w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((row) => (
                  <TableRow key={row.userId} className="hover:bg-muted/20 cursor-pointer" onClick={() => setDetailUser({ userId: row.userId, fullName: row.fullName, company: row.company })}>
                    <TableCell className="font-medium text-foreground">{row.fullName}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{row.company}</TableCell>
                    <TableCell className="text-center">
                      {row.sbuStatus === "valid" && (
                        <Badge className="bg-pub-emerald/20 text-pub-emerald border-pub-emerald/30">
                          <CheckCircle2 className="w-3 h-3 mr-1" />Aktif
                        </Badge>
                      )}
                      {row.sbuStatus === "expiring" && (
                        <Badge className="bg-pub-amber/20 text-pub-amber border-pub-amber/30">
                          <Clock className="w-3 h-3 mr-1" />{row.sbuDaysLeft}h
                        </Badge>
                      )}
                      {row.sbuStatus === "expired" && (
                        <Badge className="bg-destructive/20 text-destructive border-destructive/30">
                          <XCircle className="w-3 h-3 mr-1" />Expired
                        </Badge>
                      )}
                      {row.sbuStatus === "missing" && (
                        <Badge variant="outline" className="text-muted-foreground">
                          <XCircle className="w-3 h-3 mr-1" />-
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.smap
                        ? <CheckCircle2 className="w-4 h-4 text-pub-emerald mx-auto" />
                        : <XCircle className="w-4 h-4 text-muted-foreground/40 mx-auto" />}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.tkk
                        ? <CheckCircle2 className="w-4 h-4 text-pub-emerald mx-auto" />
                        : <XCircle className="w-4 h-4 text-muted-foreground/40 mx-auto" />}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.gcg
                        ? <CheckCircle2 className="w-4 h-4 text-pub-emerald mx-auto" />
                        : <XCircle className="w-4 h-4 text-muted-foreground/40 mx-auto" />}
                    </TableCell>
                    <TableCell className="text-center">
                      {row.smk3
                        ? <CheckCircle2 className="w-4 h-4 text-pub-emerald mx-auto" />
                        : <XCircle className="w-4 h-4 text-muted-foreground/40 mx-auto" />}
                     </TableCell>
                     <TableCell className="text-center">
                       {row.pancek === "verified"
                         ? <CheckCircle2 className="w-4 h-4 text-pub-emerald mx-auto" />
                         : row.pancek === "submitted"
                         ? <Clock className="w-4 h-4 text-pub-amber mx-auto" />
                         : <XCircle className="w-4 h-4 text-muted-foreground/40 mx-auto" />}
                     </TableCell>
                     <TableCell className="text-center">
                       <Badge
                         className={
                           row.score >= 5
                             ? "bg-pub-emerald/20 text-pub-emerald border-pub-emerald/30"
                             : row.score >= 3
                             ? "bg-pub-amber/20 text-pub-amber border-pub-amber/30"
                             : "bg-destructive/20 text-destructive border-destructive/30"
                         }
                       >
                         {row.score}/6
                       </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <ChevronRight className="w-4 h-4 text-muted-foreground mx-auto" />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">
              {complianceRows.length === 0
                ? "Belum ada data LKUT dari BUJK manapun."
                : "Tidak ada data yang cocok dengan filter."}
            </p>
          );
        })()}

        {/* Summary stats */}
        {complianceRows.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4">
            {[
              { label: "SBU Aktif", count: complianceRows.filter(r => r.sbuStatus === "valid" || r.sbuStatus === "expiring").length },
              { label: "SMAP", count: complianceRows.filter(r => r.smap).length },
              { label: "TKK", count: complianceRows.filter(r => r.tkk).length },
              { label: "GCG", count: complianceRows.filter(r => r.gcg).length },
              { label: "SMK3", count: complianceRows.filter(r => r.smk3).length },
            ].map(item => (
              <div key={item.label} className="text-center p-3 rounded-lg bg-muted/30">
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className="text-lg font-bold font-heading text-foreground">
                  {item.count}<span className="text-sm text-muted-foreground font-normal">/{complianceRows.length}</span>
                </p>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* BUJK Detail Dialog */}
      <BujkDetailDialog
        open={!!detailUser}
        onOpenChange={(open) => !open && setDetailUser(null)}
        userId={detailUser?.userId || ""}
        fullName={detailUser?.fullName || ""}
        company={detailUser?.company || ""}
      />
    </div>
  );
};

export default CorporateDashboard;
