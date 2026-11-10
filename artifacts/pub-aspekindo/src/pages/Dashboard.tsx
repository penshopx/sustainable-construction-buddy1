import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Star, Award, Crown, Gem, TrendingUp, BookOpen, ClipboardCheck,
  Target, ArrowRight, BarChart3, CheckCircle2, Clock, GraduationCap,
  AlertTriangle, Shield, DollarSign, FolderKanban, Zap, ChevronRight,
  ShoppingCart, FileText, Package, MessageCircle, ExternalLink
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLevelRequirements, LEVEL_THRESHOLDS, getNextLevel } from "@/hooks/useCompetencyScore";
import { FourPillarCard } from "@/components/scoring/FourPillarCard";
import { RoleDashboard } from "@/components/dashboard/RoleDashboard";
import { RoleConflictAlert } from "@/components/RoleConflictAlert";
import { useSbuReminder } from "@/hooks/useSbuReminder";
import logoAspekindo from "@/assets/logo-aspekindo.jpg";
import logoLsbuki from "@/assets/logo-lsbuki.webp";
import type { LucideIcon } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const levelConfig: Record<string, { icon: LucideIcon; color: string; bg: string; gradient: string }> = {
  Pemula: { icon: Star, color: "text-pub-sky", bg: "bg-pub-sky/10", gradient: "from-pub-sky/20 to-pub-sky/5" },
  Muda: { icon: Award, color: "text-pub-emerald", bg: "bg-pub-emerald/10", gradient: "from-pub-emerald/20 to-pub-emerald/5" },
  Madya: { icon: Crown, color: "text-pub-amber", bg: "bg-pub-amber/10", gradient: "from-pub-amber/20 to-pub-amber/5" },
  Utama: { icon: Gem, color: "text-pub-violet", bg: "bg-pub-violet/10", gradient: "from-pub-violet/20 to-pub-violet/5" },
};

const reqTypeIcons: Record<string, LucideIcon> = {
  score: Target,
  learning: GraduationCap,
  project: FolderKanban,
  toolkit: Shield,
  contribution: Star,
};

const Dashboard = () => {
  const { profile, user } = useAuth();
  const navigate = useNavigate();
  const levelReqs = useLevelRequirements();
  useSbuReminder();
  type DomainProgress = Tables<"competency_domains"> & { completed: number; total: number };
  const [stats, setStats] = useState<{
    totalModules: number; completedModules: number; inProgressModules: number;
    lastAssessment: Tables<"pre_tests"> | null; domainProgress: DomainProgress[];
    activeProjects: number; riskCount: number; budgetWarnings: number;
    pancekStatus: string | null; pancekYear: number | null; lkutStatus: string | null; lkutYear: number | null;
    marketplaceProducts: number; marketplaceOrders: number;
  }>({
    totalModules: 0,
    completedModules: 0,
    inProgressModules: 0,
    lastAssessment: null,
    domainProgress: [],
    activeProjects: 0,
    riskCount: 0,
    budgetWarnings: 0,
    pancekStatus: null as string | null,
    pancekYear: null as number | null,
    lkutStatus: null as string | null,
    lkutYear: null as number | null,
    marketplaceProducts: 0,
    marketplaceOrders: 0,
  });

  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      try {
        const [progressRes, modulesRes, testRes, domainsRes, projectsRes, risksRes, budgetRes, pancekRes, lkutRes, productsRes, ordersRes] = await Promise.all([
          supabase.from("module_progress")
            .select("*, e_course_modules(title, domain_id, level, competency_domains:domain_id(name))")
            .eq("user_id", user.id),
          supabase.from("e_course_modules").select("*", { count: "exact", head: true }),
          supabase.from("pre_tests").select("*").eq("user_id", user.id).eq("status", "completed")
            .order("completed_at", { ascending: false }).limit(1),
          supabase.from("competency_domains").select("*").order("sort_order"),
          supabase.from("projects").select("status").eq("user_id", user.id),
          supabase.from("risk_registers").select("id").eq("user_id", user.id),
          supabase.from("budget_entries").select("deviation_percent").eq("user_id", user.id),
          supabase.from("pancek_assessments").select("status, period_year").eq("user_id", user.id).order("period_year", { ascending: false }).limit(1),
          supabase.from("lkut_reports").select("status, report_year").eq("user_id", user.id).order("report_year", { ascending: false }).limit(1),
          supabase.from("marketplace_products").select("id", { count: "exact", head: true }).eq("user_id", user.id),
          supabase.from("marketplace_orders").select("id", { count: "exact", head: true }).eq("buyer_id", user.id),
        ]);

        const progress = progressRes.data || [];
        const domains = domainsRes.data || [];
        const budgetEntries = budgetRes.data || [];

        const domainProgress = domains.map((d) => {
          const domainModules = progress.filter((p) => p.e_course_modules?.domain_id === d.id);
          const completed = domainModules.filter((p) => p.status === "completed").length;
          return { ...d, completed, total: 4 };
        });

        const budgetWarnings = budgetEntries.filter((e) => {
          const abs = Math.abs(e.deviation_percent || 0);
          return abs >= 5;
        }).length;

        const pancekData = pancekRes.data?.[0];
        const lkutData = lkutRes.data?.[0];

        setStats({
          totalModules: modulesRes.count || 0,
          completedModules: progress.filter((p) => p.status === "completed").length,
          inProgressModules: progress.filter((p) => p.status === "in_progress").length,
          lastAssessment: testRes.data?.[0] || null,
          domainProgress,
          activeProjects: (projectsRes.data || []).filter((p) => p.status === 'active').length,
          riskCount: risksRes.data?.length || 0,
          budgetWarnings,
          pancekStatus: pancekData?.status || null,
          pancekYear: pancekData?.period_year || null,
          lkutStatus: lkutData?.status || null,
          lkutYear: lkutData?.report_year || null,
          marketplaceProducts: productsRes.count || 0,
          marketplaceOrders: ordersRes.count || 0,
        });
      } catch {
        // Keep the zero-value initial state when a new user's data is unavailable.
      }
    };
    void fetchStats();
  }, [user]);

  const level = profile?.current_level || "Pemula";
  const lc = levelConfig[level] || levelConfig.Pemula;
  const LevelIcon = lc.icon;
  const totalScore = profile?.total_score || 0;
  const nextLevel = getNextLevel(level);
  const nextThreshold = nextLevel ? LEVEL_THRESHOLDS[nextLevel as keyof typeof LEVEL_THRESHOLDS]?.min || 100 : 100;
  const progressToNext = nextLevel ? Math.min(Math.round((totalScore / nextThreshold) * 100), 100) : 100;
  const pointsNeeded = Math.max(nextThreshold - totalScore, 0);

  const reqData = levelReqs.data;
  const metCount = reqData?.requirements.filter(r => r.met).length || 0;
  const totalReqs = reqData?.requirements.length || 0;

  const pancekBadge = stats.pancekStatus === "verified" ? { label: "Terverifikasi", color: "bg-pub-emerald/15 text-pub-emerald border-pub-emerald/30" }
    : stats.pancekStatus === "submitted" ? { label: "Menunggu", color: "bg-pub-amber/15 text-pub-amber border-pub-amber/30" }
    : stats.pancekStatus === "draft" ? { label: "Draft", color: "bg-muted text-muted-foreground border-border" }
    : null;

  const lkutBadge = stats.lkutStatus === "submitted" ? { label: "Terkirim", color: "bg-pub-emerald/15 text-pub-emerald border-pub-emerald/30" }
    : stats.lkutStatus === "draft" ? { label: "Draft", color: "bg-pub-amber/15 text-pub-amber border-pub-amber/30" }
    : null;

  return (
    <div className="max-w-6xl mx-auto space-y-4 md:space-y-6">
      {/* Welcome card with level progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-hero rounded-2xl p-5 md:p-8 text-primary-foreground relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-pub-amber/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-start md:justify-between gap-4">
          <div className="flex-1">
            <p className="text-primary-foreground/60 font-body text-sm mb-1">Selamat datang kembali,</p>
            <h1 className="text-2xl md:text-3xl font-bold font-heading mb-3">{profile?.full_name || "User"}</h1>
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl ${lc.bg} flex items-center justify-center`}>
                <LevelIcon className={`w-5 h-5 ${lc.color}`} />
              </div>
              <div>
                <p className="text-xs text-primary-foreground/50 font-body">Level Kompetensi</p>
                <p className="text-lg font-bold font-heading text-pub-amber-light">{level}</p>
              </div>
              <div className="ml-6">
                <p className="text-xs text-primary-foreground/50 font-body">Skor Total</p>
                <p className="text-lg font-bold font-heading text-primary-foreground">{totalScore}</p>
              </div>
            </div>

            {nextLevel && (
              <div className="bg-primary-foreground/5 rounded-xl p-3 border border-primary-foreground/10">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-primary-foreground/70 font-body">Progress ke {nextLevel}</span>
                  <span className="text-pub-amber-light font-heading font-semibold">{pointsNeeded} poin lagi</span>
                </div>
                <Progress value={progressToNext} className="h-2" />
              </div>
            )}
          </div>
          <div className="flex items-center gap-3 md:gap-4 shrink-0">
            <img src={logoAspekindo} alt="ASPEKINDO" className="h-12 w-12 md:h-[6.75rem] md:w-[6.75rem] object-contain rounded-lg md:rounded-xl" />
            <img src={logoLsbuki} alt="LSBUKI" className="h-12 w-12 md:h-[6.75rem] md:w-[6.75rem] object-contain rounded-lg md:rounded-xl" />
          </div>
        </div>
      </motion.div>

      <RoleConflictAlert compact />
      <RoleDashboard />

      <motion.button
        type="button"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        onClick={() => navigate("/siap-kompetensi")}
        className="group flex w-full items-center justify-between gap-4 rounded-2xl border border-pub-sky/20 bg-gradient-to-r from-pub-navy to-pub-sky/80 p-5 text-left text-primary-foreground shadow-card transition-transform hover:-translate-y-0.5"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10">
            <Target className="h-5 w-5 text-pub-sky-light" />
          </div>
          <div>
            <p className="font-heading text-lg font-bold">Peta Kompetensi 4 SIAP</p>
            <p className="mt-1 text-sm text-primary-foreground/70">
              Lihat kesiapan Legalitas, Sertifikasi, Tender, dan Proyek dari bukti yang sudah tersedia.
            </p>
          </div>
        </div>
        <ArrowRight className="h-5 w-5 shrink-0 transition-transform group-hover:translate-x-1" />
      </motion.button>

      {/* Quick stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Proyek Aktif", value: stats.activeProjects, icon: FolderKanban, color: "text-pub-sky", bg: "bg-pub-sky/10", link: "/projects" },
          { label: "Modul Selesai", value: `${stats.completedModules}/${stats.totalModules}`, icon: CheckCircle2, color: "text-pub-emerald", bg: "bg-pub-emerald/10", link: "/courses" },
          { label: "Risk Register", value: stats.riskCount, icon: Shield, color: "text-pub-amber", bg: "bg-pub-amber/10", link: "/risk-register" },
          { label: "Budget Warning", value: stats.budgetWarnings, icon: stats.budgetWarnings > 0 ? AlertTriangle : CheckCircle2, color: stats.budgetWarnings > 0 ? "text-destructive" : "text-pub-emerald", bg: stats.budgetWarnings > 0 ? "bg-destructive/10" : "bg-pub-emerald/10", link: "/budget-tracker" },
        ].map((s, i) => (
          <motion.button
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => navigate(s.link)}
            className="bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-card-hover transition-all text-left group"
          >
            <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <p className="text-2xl font-bold font-heading text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground font-body flex items-center gap-1">
              {s.label}
              <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
            </p>
          </motion.button>
        ))}
      </div>

      {/* PANCEK, LKUT, Marketplace widgets */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* PANCEK */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={() => navigate("/pancek")}
          className="bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-card-hover transition-all text-left group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-pub-violet/10 flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-pub-violet" />
            </div>
            {pancekBadge && (
              <Badge variant="outline" className={`text-[10px] ${pancekBadge.color}`}>{pancekBadge.label}</Badge>
            )}
          </div>
          <p className="font-heading font-bold text-foreground text-sm">PANCEK</p>
          <p className="text-xs text-muted-foreground font-body mt-0.5">
            {stats.pancekYear ? `Periode ${stats.pancekYear}` : "Belum ada asesmen"}
          </p>
          <ArrowRight className="w-3.5 h-3.5 mt-2 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
        </motion.button>

        {/* LKUT */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          onClick={() => navigate("/lkut")}
          className="bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-card-hover transition-all text-left group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-pub-sky/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-pub-sky" />
            </div>
            {lkutBadge && (
              <Badge variant="outline" className={`text-[10px] ${lkutBadge.color}`}>{lkutBadge.label}</Badge>
            )}
          </div>
          <p className="font-heading font-bold text-foreground text-sm">LKUT Report</p>
          <p className="text-xs text-muted-foreground font-body mt-0.5">
            {stats.lkutYear ? `Tahun ${stats.lkutYear}` : "Belum ada laporan"}
          </p>
          <ArrowRight className="w-3.5 h-3.5 mt-2 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
        </motion.button>

        {/* Marketplace */}
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onClick={() => navigate("/marketplace")}
          className="bg-card rounded-xl border border-border p-5 shadow-card hover:shadow-card-hover transition-all text-left group"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg bg-pub-amber/10 flex items-center justify-center">
              <ShoppingCart className="w-5 h-5 text-pub-amber" />
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="text-[10px] bg-pub-emerald/15 text-pub-emerald border-pub-emerald/30">
                {stats.marketplaceProducts} produk
              </Badge>
              <Badge variant="outline" className="text-[10px] bg-pub-sky/15 text-pub-sky border-pub-sky/30">
                {stats.marketplaceOrders} order
              </Badge>
            </div>
          </div>
          <p className="font-heading font-bold text-foreground text-sm">Marketplace</p>
          <p className="text-xs text-muted-foreground font-body mt-0.5">Jual beli material & jasa BUJK</p>
          <ArrowRight className="w-3.5 h-3.5 mt-2 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
        </motion.button>
      </div>

      {/* Next Level Requirements + Quick Actions */}
      <div className="grid md:grid-cols-3 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="md:col-span-2 bg-card rounded-xl border border-border p-6 shadow-card"
        >
          <h2 className="text-lg font-bold font-heading text-foreground mb-1 flex items-center gap-2">
            <Zap className="w-5 h-5 text-pub-amber" />
            {nextLevel ? `Syarat Naik ke ${nextLevel}` : "Level Tertinggi Tercapai! 🏆"}
          </h2>
          {nextLevel && (
            <p className="text-xs text-muted-foreground font-body mb-4">
              {metCount}/{totalReqs} syarat terpenuhi
            </p>
          )}
          
          {reqData?.requirements && reqData.requirements.length > 0 ? (
            <div className="space-y-3">
              {reqData.requirements.map((req, i) => {
                const ReqIcon = reqTypeIcons[req.type] || Target;
                return (
                  <div
                    key={i}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-all ${
                      req.met
                        ? "border-pub-emerald/30 bg-pub-emerald/5"
                        : "border-border hover:border-pub-amber/30"
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      req.met ? "bg-pub-emerald/10" : "bg-muted"
                    }`}>
                      {req.met ? (
                        <CheckCircle2 className="w-4 h-4 text-pub-emerald" />
                      ) : (
                        <ReqIcon className="w-4 h-4 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-heading ${req.met ? "text-pub-emerald font-semibold" : "text-foreground"}`}>
                        {req.label}
                      </p>
                      {!req.met && (
                        <p className="text-xs text-muted-foreground font-body">
                          Progress: {req.current}/{req.target}
                        </p>
                      )}
                    </div>
                    {!req.met && (
                      <span className="text-xs font-heading text-pub-amber bg-pub-amber/10 px-2 py-0.5 rounded-full">
                        {req.target - req.current} lagi
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : !nextLevel ? (
            <div className="text-center py-6">
              <Gem className="w-12 h-12 text-pub-violet mx-auto mb-2" />
              <p className="text-foreground font-heading font-semibold">Selamat! Anda di level tertinggi.</p>
              <p className="text-sm text-muted-foreground font-body">Terus tingkatkan kompetensi melalui mentoring & kontribusi.</p>
            </div>
          ) : null}
        </motion.div>

        {/* Quick actions */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-4"
        >
          <button
            onClick={() => navigate("/assessment")}
            className="w-full bg-gradient-amber text-accent-foreground rounded-xl p-5 shadow-amber hover:brightness-110 transition-all text-left group"
          >
            <ClipboardCheck className="w-8 h-8 mb-3" />
            <p className="font-bold font-heading text-lg">Mulai Pre-test</p>
            <p className="text-sm opacity-80 font-body mt-1">Uji kompetensi Anda sekarang</p>
            <ArrowRight className="w-4 h-4 mt-2 group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={() => navigate("/courses")}
            className="w-full bg-card border border-border rounded-xl p-5 shadow-card hover:shadow-card-hover transition-all text-left group"
          >
            <GraduationCap className="w-8 h-8 mb-3 text-pub-emerald" />
            <p className="font-bold font-heading text-foreground">Pusat Pembelajaran PUB</p>
            <p className="text-sm text-muted-foreground font-body mt-1">Lanjutkan pembelajaran</p>
            <ArrowRight className="w-4 h-4 mt-2 text-muted-foreground group-hover:translate-x-1 transition-transform" />
          </button>

          <button
            onClick={() => navigate("/projects")}
            className="w-full bg-card border border-border rounded-xl p-5 shadow-card hover:shadow-card-hover transition-all text-left group"
          >
            <FolderKanban className="w-8 h-8 mb-3 text-pub-sky" />
            <p className="font-bold font-heading text-foreground">Proyek Saya</p>
            <p className="text-sm text-muted-foreground font-body mt-1">Kelola proyek & evidence</p>
            <ArrowRight className="w-4 h-4 mt-2 text-muted-foreground group-hover:translate-x-1 transition-transform" />
          </button>

          {/* DokumenProyek widget (Siap Proyek — third-party service) */}
          <a
            href="https://dokumenproyek.com"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full rounded-xl p-5 text-left group overflow-hidden relative border border-[hsl(0,0%,100%)/10%] bg-gradient-to-br from-[hsl(220,60%,14%)] to-[hsl(225,55%,22%)] hover:brightness-110 transition-all shadow-card block"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-pub-sky/20 flex items-center justify-center shrink-0">
                <span className="text-pub-sky font-extrabold text-base font-heading">D</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-pub-sky/70" />
                  <span className="text-[hsl(0,0%,60%)] text-xs font-body">Siap Proyek · layanan pihak ketiga</span>
                </div>
                <p className="font-bold font-heading text-white text-sm">DokumenProyek</p>
                <p className="text-xs text-[hsl(0,0%,60%)] font-body mt-0.5">dokumenproyek.com</p>
              </div>
              <ExternalLink className="w-4 h-4 text-pub-sky mt-1 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <p className="text-xs text-[hsl(0,0%,55%)] font-body mt-3 leading-relaxed">
              Administrasi dokumen proyek konstruksi — dibuka di tab baru
            </p>
          </a>
        </motion.div>
      </div>

      {/* Domain Progress */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="bg-card rounded-xl border border-border p-6 shadow-card"
      >
        <h2 className="text-lg font-bold font-heading text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-pub-amber" />
          Progress per Domain
        </h2>
        <div className="space-y-4">
          {stats.domainProgress.length > 0 ? (
            stats.domainProgress.map((d) => (
              <div key={d.id}>
                <div className="flex justify-between text-sm mb-1.5">
                  <span className="font-medium font-heading text-foreground">{d.name}</span>
                  <span className="text-muted-foreground font-body">{d.completed}/{d.total}</span>
                </div>
                <Progress value={(d.completed / d.total) * 100} className="h-2" />
              </div>
            ))
          ) : (
            <div className="rounded-lg border border-dashed border-border p-5 text-center">
              <BarChart3 className="w-8 h-8 text-muted-foreground/60 mx-auto mb-2" />
              <p className="text-sm font-heading font-semibold text-foreground">Belum ada progres domain</p>
              <p className="text-xs text-muted-foreground font-body mt-1">
                 Mulai dari Pusat Pembelajaran PUB untuk membangun kompetensi Anda.
              </p>
            </div>
          )}
        </div>
      </motion.div>

      {/* 4-Pillar Scoring */}
      <FourPillarCard />
    </div>
  );
};

export default Dashboard;
