import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { toast } from "@/components/ui/sonner-toast";
import {
  Building2, FileText, Shield, DollarSign, TrendingUp, AlertTriangle,
  CheckCircle2, HardHat, ClipboardCheck, FolderKanban, Users, BarChart3,
  Package, ShoppingCart, FileCheck, ChevronRight, Briefcase, Loader2
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { Tables } from "@/integrations/supabase/types";

type ProjectStats = Pick<Tables<"projects">, "status" | "value_amount" | "complexity_score">;
type RiskStats = Pick<Tables<"risk_registers">, "risk_level" | "status">;
type BudgetStats = Pick<Tables<"budget_entries">, "planned_amount" | "actual_amount" | "deviation_percent">;
type K3Stats = Pick<Tables<"k3_checklists">, "status" | "score_percent">;

interface RoleStats {
  projects: ProjectStats[];
  risks: RiskStats[];
  budget: BudgetStats[];
  k3: K3Stats[];
}

interface RoleMetric {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color: string;
  bg: string;
  link?: string;
}

interface RoleConfig {
  title: string;
  subtitle: string;
  icon: LucideIcon;
  gradient: string;
  metrics: RoleMetric[];
  quickLinks: { label: string; link: string; icon: LucideIcon }[];
}

const useRoleStats = (position: string, userId: string) => {
  const [stats, setStats] = useState<RoleStats>({ projects: [], risks: [], budget: [], k3: [] });

  useEffect(() => {
    if (!userId || !position) return;
    const fetch = async () => {
      const [projects, risks, budget, k3] = await Promise.all([
        supabase.from("projects").select("status, value_amount, complexity_score").eq("user_id", userId),
        supabase.from("risk_registers").select("risk_level, status").eq("user_id", userId),
        supabase.from("budget_entries").select("planned_amount, actual_amount, deviation_percent").eq("user_id", userId),
        supabase.from("k3_checklists").select("status, score_percent").eq("user_id", userId),
      ]);
      setStats({
        projects: projects.data || [],
        risks: risks.data || [],
        budget: budget.data || [],
        k3: k3.data || [],
      });
    };
    fetch();
  }, [userId, position]);

  return stats;
};

function getRoleConfig(position: string, stats: RoleStats): RoleConfig | null {
  const { projects, risks, budget, k3 } = stats;

  const activeProjects = projects.filter((p) => p.status === "active").length;
  const totalValue = projects.reduce((s, p) => s + (p.value_amount || 0), 0);
  const highRisks = risks.filter((r) => r.risk_level === "high" || r.risk_level === "extreme").length;
  const openRisks = risks.filter((r) => r.status === "open").length;
  const totalPlanned = budget.reduce((s, b) => s + (b.planned_amount || 0), 0);
  const totalActual = budget.reduce((s, b) => s + (b.actual_amount || 0), 0);
  const budgetDeviation = totalPlanned > 0 ? Math.round(((totalActual - totalPlanned) / totalPlanned) * 100) : 0;
  const budgetWarnings = budget.filter((b) => Math.abs(b.deviation_percent || 0) >= 5).length;
  const k3Completed = k3.filter((c) => c.status === "completed").length;
  const avgK3Score = k3.length > 0 ? Math.round(k3.reduce((s, c) => s + (c.score_percent || 0), 0) / k3.length) : 0;

  const fmt = (n: number) => {
    if (n >= 1e9) return `Rp ${(n / 1e9).toFixed(1)}M`;
    if (n >= 1e6) return `Rp ${(n / 1e6).toFixed(0)}Jt`;
    return `Rp ${n.toLocaleString("id-ID")}`;
  };

  if (position.includes("PJBU") || position.includes("Direktur")) {
    return {
      title: "Dashboard PJBU / Direktur",
      subtitle: "Tata Kelola & Pemantauan Kapasitas Organisasi",
      icon: Building2,
      gradient: "from-pub-navy to-pub-sky",
      metrics: [
        { label: "Proyek Aktif", value: activeProjects, icon: FolderKanban, color: "text-pub-sky", bg: "bg-pub-sky/10", link: "/projects" },
        { label: "Total Nilai Proyek", value: fmt(totalValue), icon: TrendingUp, color: "text-pub-emerald", bg: "bg-pub-emerald/10" },
        { label: "Risiko Tinggi", value: highRisks, icon: AlertTriangle, color: highRisks > 0 ? "text-destructive" : "text-pub-emerald", bg: highRisks > 0 ? "bg-destructive/10" : "bg-pub-emerald/10", link: "/risk-register" },
        { label: "Deviasi Anggaran", value: `${budgetDeviation}%`, icon: DollarSign, color: Math.abs(budgetDeviation) >= 5 ? "text-destructive" : "text-pub-emerald", bg: Math.abs(budgetDeviation) >= 5 ? "bg-destructive/10" : "bg-pub-emerald/10", link: "/budget-tracker" },
      ],
      quickLinks: [
        { label: "Kelola Proyek", link: "/projects", icon: FolderKanban },
        { label: "Risk Register", link: "/risk-register", icon: Shield },
        { label: "Budget Tracker", link: "/budget-tracker", icon: DollarSign },
        { label: "Analitik", link: "/analytics", icon: BarChart3 },
      ],
    };
  }

  if (position.includes("PJT")) {
    return {
      title: "Dashboard PJT",
      subtitle: "Dokumentasi Risiko & Teknis Proyek",
      icon: HardHat,
      gradient: "from-pub-amber to-pub-amber-light",
      metrics: [
        { label: "Proyek Aktif", value: activeProjects, icon: FolderKanban, color: "text-pub-sky", bg: "bg-pub-sky/10", link: "/projects" },
        { label: "Risiko Terbuka", value: openRisks, icon: Shield, color: openRisks > 0 ? "text-pub-amber" : "text-pub-emerald", bg: openRisks > 0 ? "bg-pub-amber/10" : "bg-pub-emerald/10", link: "/risk-register" },
        { label: "Risiko Tinggi", value: highRisks, icon: AlertTriangle, color: highRisks > 0 ? "text-destructive" : "text-pub-emerald", bg: highRisks > 0 ? "bg-destructive/10" : "bg-pub-emerald/10", link: "/risk-register" },
        { label: "Inspeksi K3", value: k3Completed, icon: ClipboardCheck, color: "text-pub-emerald", bg: "bg-pub-emerald/10", link: "/k3-checklist" },
      ],
      quickLinks: [
        { label: "Kelola Proyek", link: "/projects", icon: FolderKanban },
        { label: "Risk Register", link: "/risk-register", icon: Shield },
        { label: "K3 Checklist", link: "/k3-checklist", icon: ClipboardCheck },
        { label: "Generator Dokumen", link: "/generator", icon: FileText },
      ],
    };
  }

  if (position.includes("PJSKBU")) {
    return {
      title: "Dashboard PJSKBU",
      subtitle: "Subklasifikasi & Kompetensi Teknis",
      icon: FileCheck,
      gradient: "from-pub-violet to-pub-sky",
      metrics: [
        { label: "Proyek Aktif", value: activeProjects, icon: FolderKanban, color: "text-pub-sky", bg: "bg-pub-sky/10", link: "/projects" },
        { label: "Risiko Terbuka", value: openRisks, icon: Shield, color: "text-pub-amber", bg: "bg-pub-amber/10", link: "/risk-register" },
        { label: "Inspeksi K3", value: k3Completed, icon: ClipboardCheck, color: "text-pub-emerald", bg: "bg-pub-emerald/10", link: "/k3-checklist" },
        { label: "Total Proyek", value: projects.length, icon: BarChart3, color: "text-pub-violet", bg: "bg-pub-violet/10", link: "/projects" },
      ],
      quickLinks: [
        { label: "Kelola Proyek", link: "/projects", icon: FolderKanban },
        { label: "Pusat Pembelajaran PUB", link: "/courses", icon: FileText },
        { label: "Risk Register", link: "/risk-register", icon: Shield },
        { label: "Sertifikat", link: "/certificates", icon: FileCheck },
      ],
    };
  }

  if (position.includes("Keuangan")) {
    return {
      title: "Dashboard Manajer Keuangan",
      subtitle: "Kontrol Arus Kas & Peringatan Dini Deviasi",
      icon: DollarSign,
      gradient: "from-pub-emerald to-pub-sky",
      metrics: [
        { label: "Total Anggaran", value: fmt(totalPlanned), icon: DollarSign, color: "text-pub-sky", bg: "bg-pub-sky/10", link: "/budget-tracker" },
        { label: "Total Realisasi", value: fmt(totalActual), icon: TrendingUp, color: "text-pub-emerald", bg: "bg-pub-emerald/10", link: "/budget-tracker" },
        { label: "Deviasi Rata-rata", value: `${budgetDeviation}%`, icon: Math.abs(budgetDeviation) >= 5 ? AlertTriangle : CheckCircle2, color: Math.abs(budgetDeviation) >= 5 ? "text-destructive" : "text-pub-emerald", bg: Math.abs(budgetDeviation) >= 5 ? "bg-destructive/10" : "bg-pub-emerald/10", link: "/budget-tracker" },
        { label: "Item Warning", value: budgetWarnings, icon: AlertTriangle, color: budgetWarnings > 0 ? "text-pub-amber" : "text-pub-emerald", bg: budgetWarnings > 0 ? "bg-pub-amber/10" : "bg-pub-emerald/10", link: "/budget-tracker" },
      ],
      quickLinks: [
        { label: "Budget Tracker", link: "/budget-tracker", icon: DollarSign },
        { label: "Kelola Proyek", link: "/projects", icon: FolderKanban },
        { label: "Analitik", link: "/analytics", icon: BarChart3 },
        { label: "Generator Laporan", link: "/generator", icon: FileText },
      ],
    };
  }

  if (position.includes("Logistik")) {
    return {
      title: "Dashboard Manajer Logistik",
      subtitle: "Logistik & Rantai Pasok",
      icon: Package,
      gradient: "from-pub-amber to-pub-emerald",
      metrics: [
        { label: "Proyek Aktif", value: activeProjects, icon: FolderKanban, color: "text-pub-sky", bg: "bg-pub-sky/10", link: "/projects" },
        { label: "Budget Warning", value: budgetWarnings, icon: AlertTriangle, color: budgetWarnings > 0 ? "text-pub-amber" : "text-pub-emerald", bg: budgetWarnings > 0 ? "bg-pub-amber/10" : "bg-pub-emerald/10", link: "/budget-tracker" },
        { label: "Risiko Terbuka", value: openRisks, icon: Shield, color: "text-pub-amber", bg: "bg-pub-amber/10", link: "/risk-register" },
        { label: "Inspeksi K3", value: k3Completed, icon: ClipboardCheck, color: "text-pub-emerald", bg: "bg-pub-emerald/10", link: "/k3-checklist" },
      ],
      quickLinks: [
        { label: "Budget Tracker", link: "/budget-tracker", icon: DollarSign },
        { label: "Risk Register", link: "/risk-register", icon: Shield },
        { label: "Kelola Proyek", link: "/projects", icon: FolderKanban },
        { label: "K3 Checklist", link: "/k3-checklist", icon: ClipboardCheck },
      ],
    };
  }

  if (position.includes("Pengadaan") || position.includes("Tender")) {
    return {
      title: "Dashboard Manajer Pengadaan",
      subtitle: "Pengadaan & Tender Management",
      icon: ShoppingCart,
      gradient: "from-pub-sky to-pub-violet",
      metrics: [
        { label: "Proyek Aktif", value: activeProjects, icon: FolderKanban, color: "text-pub-sky", bg: "bg-pub-sky/10", link: "/projects" },
        { label: "Total Nilai Proyek", value: fmt(totalValue), icon: TrendingUp, color: "text-pub-emerald", bg: "bg-pub-emerald/10" },
        { label: "Budget Warning", value: budgetWarnings, icon: AlertTriangle, color: budgetWarnings > 0 ? "text-pub-amber" : "text-pub-emerald", bg: budgetWarnings > 0 ? "bg-pub-amber/10" : "bg-pub-emerald/10", link: "/budget-tracker" },
        { label: "Total Risiko", value: risks.length, icon: Shield, color: "text-pub-amber", bg: "bg-pub-amber/10", link: "/risk-register" },
      ],
      quickLinks: [
        { label: "Kelola Proyek", link: "/projects", icon: FolderKanban },
        { label: "Budget Tracker", link: "/budget-tracker", icon: DollarSign },
        { label: "Risk Register", link: "/risk-register", icon: Shield },
        { label: "Generator Dokumen", link: "/generator", icon: FileText },
      ],
    };
  }

  if (position.includes("Administrasi")) {
    return {
      title: "Dashboard Manajer Administrasi",
      subtitle: "Administrasi & Dokumentasi",
      icon: FileText,
      gradient: "from-pub-navy to-pub-amber",
      metrics: [
        { label: "Total Proyek", value: projects.length, icon: FolderKanban, color: "text-pub-sky", bg: "bg-pub-sky/10", link: "/projects" },
        { label: "Proyek Aktif", value: activeProjects, icon: CheckCircle2, color: "text-pub-emerald", bg: "bg-pub-emerald/10", link: "/projects" },
        { label: "Inspeksi K3", value: k3Completed, icon: ClipboardCheck, color: "text-pub-amber", bg: "bg-pub-amber/10", link: "/k3-checklist" },
        { label: "Total Risiko", value: risks.length, icon: Shield, color: "text-pub-violet", bg: "bg-pub-violet/10", link: "/risk-register" },
      ],
      quickLinks: [
        { label: "Generator Dokumen", link: "/generator", icon: FileText },
        { label: "Sertifikat", link: "/certificates", icon: FileCheck },
        { label: "Kelola Proyek", link: "/projects", icon: FolderKanban },
        { label: "K3 Checklist", link: "/k3-checklist", icon: ClipboardCheck },
      ],
    };
  }

  if (position.includes("K3")) {
    return {
      title: "Dashboard Petugas K3",
      subtitle: "Dokumentasi Inspeksi & Keselamatan Kerja",
      icon: Shield,
      gradient: "from-pub-emerald to-pub-sky",
      metrics: [
        { label: "Inspeksi Selesai", value: k3Completed, icon: ClipboardCheck, color: "text-pub-emerald", bg: "bg-pub-emerald/10", link: "/k3-checklist" },
        { label: "Skor K3 Rata-rata", value: `${avgK3Score}%`, icon: BarChart3, color: avgK3Score >= 80 ? "text-pub-emerald" : "text-pub-amber", bg: avgK3Score >= 80 ? "bg-pub-emerald/10" : "bg-pub-amber/10", link: "/k3-checklist" },
        { label: "Risiko Tinggi", value: highRisks, icon: AlertTriangle, color: highRisks > 0 ? "text-destructive" : "text-pub-emerald", bg: highRisks > 0 ? "bg-destructive/10" : "bg-pub-emerald/10", link: "/risk-register" },
        { label: "Proyek Aktif", value: activeProjects, icon: FolderKanban, color: "text-pub-sky", bg: "bg-pub-sky/10", link: "/projects" },
      ],
      quickLinks: [
        { label: "K3 Checklist", link: "/k3-checklist", icon: ClipboardCheck },
        { label: "Risk Register", link: "/risk-register", icon: Shield },
        { label: "Kelola Proyek", link: "/projects", icon: FolderKanban },
        { label: "Generator Laporan", link: "/generator", icon: FileText },
      ],
    };
  }

  return null;
}

const QUICK_ROLES = [
  { label: "PJBU / Direktur", value: "Penanggung Jawab Badan Usaha (PJBU) / Direktur", icon: Building2, color: "text-pub-sky", bg: "bg-pub-sky/10" },
  { label: "PJT", value: "Penanggung Jawab Teknik (PJT)", icon: HardHat, color: "text-pub-amber", bg: "bg-pub-amber/10" },
  { label: "PJSKBU", value: "Penanggung Jawab Subklasifikasi (PJSKBU)", icon: FileCheck, color: "text-pub-violet", bg: "bg-pub-violet/10" },
  { label: "Mgr. Keuangan", value: "Manajer Keuangan", icon: DollarSign, color: "text-pub-emerald", bg: "bg-pub-emerald/10" },
  { label: "Mgr. Logistik", value: "Manajer Logistik & Rantai Pasok", icon: Package, color: "text-pub-amber", bg: "bg-pub-amber/10" },
  { label: "Mgr. Pengadaan", value: "Manajer Pengadaan / Tender", icon: ShoppingCart, color: "text-pub-sky", bg: "bg-pub-sky/10" },
  { label: "Mgr. Administrasi", value: "Manajer Administrasi", icon: FileText, color: "text-pub-violet", bg: "bg-pub-violet/10" },
  { label: "Petugas K3", value: "Petugas K3", icon: Shield, color: "text-pub-emerald", bg: "bg-pub-emerald/10" },
];

export function RoleDashboard() {
  const { profile, user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const position = profile?.position || "";
  const stats = useRoleStats(position, user?.id || "");
  const config = getRoleConfig(position, stats);
  const [savingRole, setSavingRole] = useState<string | null>(null);

  const handleQuickSetRole = async (value: string) => {
    if (!user) return;
    setSavingRole(value);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .upsert(
          { user_id: user.id, position: value },
          { onConflict: "user_id" },
        )
        .select()
        .single();

      if (error || !data) {
        toast.error("Gagal menyimpan jabatan. Silakan coba lagi.");
        return;
      }

      await refreshProfile();
      toast.success("Jabatan berhasil disimpan!");
    } catch {
      toast.error("Gagal menyimpan jabatan. Silakan coba lagi.");
    } finally {
      setSavingRole(null);
    }
  };

  if (!position || !config) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-card rounded-xl border border-border p-6 shadow-card"
      >
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-pub-amber/10 flex items-center justify-center">
            <Briefcase className="w-5 h-5 text-pub-amber" />
          </div>
          <div>
            <p className="font-heading font-semibold text-foreground">Pilih Jabatan Anda</p>
            <p className="text-xs text-muted-foreground font-body">
              Dashboard akan dipersonalisasi sesuai peran Anda di BUJK
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {QUICK_ROLES.map((role) => (
            <motion.button
              key={role.value}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleQuickSetRole(role.value)}
              disabled={savingRole !== null}
              className="flex items-center gap-2 p-3 rounded-lg border border-border hover:border-pub-amber/40 hover:bg-pub-amber/5 transition-all text-left group disabled:opacity-50"
            >
              <div className={`w-8 h-8 rounded-lg ${role.bg} flex items-center justify-center shrink-0`}>
                {savingRole === role.value ? (
                  <Loader2 className="w-4 h-4 animate-spin text-pub-amber" />
                ) : (
                  <role.icon className={`w-4 h-4 ${role.color}`} />
                )}
              </div>
              <span className="text-xs font-heading font-medium text-foreground">{role.label}</span>
            </motion.button>
          ))}
        </div>
      </motion.div>
    );
  }

  const RoleIcon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Role Header */}
      <div className={`bg-gradient-to-r ${config.gradient} rounded-xl p-5 text-primary-foreground relative overflow-hidden`}>
        <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="relative z-10 flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-white/10 flex items-center justify-center">
            <RoleIcon className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold font-heading">{config.title}</h2>
            <p className="text-sm opacity-80 font-body">{config.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Role Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {config.metrics.map((m, i) => (
          <motion.button
            key={m.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            onClick={() => m.link && navigate(m.link)}
            className="bg-card rounded-xl border border-border p-4 shadow-card hover:shadow-card-hover transition-all text-left group"
          >
            <div className={`w-9 h-9 rounded-lg ${m.bg} flex items-center justify-center mb-2`}>
              <m.icon className={`w-4 h-4 ${m.color}`} />
            </div>
            <p className="text-xl font-bold font-heading text-foreground">{m.value}</p>
            <p className="text-xs text-muted-foreground font-body flex items-center gap-1">
              {m.label}
              {m.link && <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />}
            </p>
          </motion.button>
        ))}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {config.quickLinks.map((ql, i) => (
          <button
            key={ql.label}
            onClick={() => navigate(ql.link)}
            className="flex items-center gap-2 bg-card border border-border rounded-lg px-4 py-3 hover:shadow-card-hover transition-all text-left group"
          >
            <ql.icon className="w-4 h-4 text-muted-foreground group-hover:text-pub-amber transition-colors" />
            <span className="text-sm font-heading text-foreground">{ql.label}</span>
            <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        ))}
      </div>
    </motion.div>
  );
}
