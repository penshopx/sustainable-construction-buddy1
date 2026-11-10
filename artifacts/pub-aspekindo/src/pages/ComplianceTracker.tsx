import { useMemo, useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";
import { useLkutReports } from "@/hooks/useLkutReports";
import { usePancekAssessment } from "@/hooks/usePancekAssessment";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import {
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  CalendarClock,
  FileCheck2,
  ClipboardCheck,
  ArrowRight,
  ExternalLink,
  Database,
  FolderKanban,
  DollarSign,
  Shield,
  HardHat,
  FileText,
} from "lucide-react";
import { differenceInDays, format, parseISO } from "date-fns";
import { id as localeId } from "date-fns/locale";

// ... keep existing code (ComplianceItem interface, getUrgencyColor, getStatusBadge)
interface ComplianceItem {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  status: "valid" | "expiring" | "expired" | "missing";
  deadline?: string;
  daysLeft?: number;
  fulfilled: boolean;
  details?: string;
}

function getUrgencyColor(status: ComplianceItem["status"]) {
  switch (status) {
    case "valid": return "bg-pub-emerald/15 border-pub-emerald/30 text-pub-emerald";
    case "expiring": return "bg-pub-amber/15 border-pub-amber/30 text-pub-amber";
    case "expired": return "bg-destructive/15 border-destructive/30 text-destructive";
    case "missing": return "bg-muted border-border text-muted-foreground";
  }
}

function getStatusBadge(status: ComplianceItem["status"]) {
  switch (status) {
    case "valid": return <Badge className="bg-pub-emerald/20 text-pub-emerald border-pub-emerald/30"><CheckCircle2 className="w-3 h-3 mr-1" />Aktif</Badge>;
    case "expiring": return <Badge className="bg-pub-amber/20 text-pub-amber border-pub-amber/30"><Clock className="w-3 h-3 mr-1" />Segera Habis</Badge>;
    case "expired": return <Badge className="bg-destructive/20 text-destructive border-destructive/30"><XCircle className="w-3 h-3 mr-1" />Kadaluarsa</Badge>;
    case "missing": return <Badge variant="outline" className="text-muted-foreground"><AlertTriangle className="w-3 h-3 mr-1" />Belum Ada</Badge>;
  }
}

interface DataSourceStatus {
  label: string;
  icon: React.ElementType;
  count: number;
  description: string;
  link: string;
  contributes: string;
}

function DataCompletenessCard({ dataSources, loading }: { dataSources: DataSourceStatus[]; loading: boolean }) {
  const filledCount = dataSources.filter(d => d.count > 0).length;
  const totalCount = dataSources.length;
  const pct = Math.round((filledCount / totalCount) * 100);
  const navigate = useNavigate();

  return (
    <Card className="border-accent/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <Database className="w-4 h-4 text-accent" />
          Kelengkapan Data Operasional
        </CardTitle>
        <CardDescription>
          Semakin lengkap data yang diisi, semakin akurat penilaian kepatuhan & grading BUJK Anda
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="text-center min-w-[70px]">
            <div className={`text-3xl font-black font-heading ${pct >= 80 ? "text-pub-emerald" : pct >= 50 ? "text-pub-amber" : "text-destructive"}`}>
              {loading ? "..." : `${pct}%`}
            </div>
            <p className="text-xs text-muted-foreground">{filledCount}/{totalCount} modul</p>
          </div>
          <div className="flex-1">
            <Progress value={loading ? 0 : pct} className="h-2.5" />
          </div>
        </div>

        {!loading && (
          <div className="grid gap-2">
            {dataSources.map(src => (
              <div
                key={src.label}
                className={`flex items-center justify-between rounded-lg px-3 py-2.5 border transition-colors cursor-pointer hover:bg-muted/50 ${
                  src.count > 0 ? "border-pub-emerald/20 bg-pub-emerald/5" : "border-border bg-muted/20"
                }`}
                onClick={() => navigate(src.link)}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-1.5 rounded-md ${src.count > 0 ? "bg-pub-emerald/15" : "bg-muted"}`}>
                    <src.icon className={`w-3.5 h-3.5 ${src.count > 0 ? "text-pub-emerald" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{src.label}</p>
                    <p className="text-xs text-muted-foreground">{src.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {src.count > 0 ? (
                    <Badge className="bg-pub-emerald/15 text-pub-emerald border-pub-emerald/25 text-xs">
                      <CheckCircle2 className="w-3 h-3 mr-1" />
                      {src.count} data
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground text-xs">
                      <XCircle className="w-3 h-3 mr-1" />
                      Belum ada
                    </Badge>
                  )}
                  <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && filledCount < totalCount && (
          <p className="text-xs text-pub-amber bg-pub-amber/10 rounded-lg p-3 border border-pub-amber/20">
            💡 Setiap modul bersifat mandiri — Anda bisa mengisi sesuai kebutuhan. Data yang telah diisi akan otomatis berkontribusi pada Compliance Tracker dan Performance Grade.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function ComplianceTracker() {
  const { reports, loading } = useLkutReports();
  const { assessments, loading: pancekLoading } = usePancekAssessment();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const latestLkut = reports?.[0];
  const currentYear = new Date().getFullYear();
  const latestPancek = assessments?.find(a => a.period_year === currentYear) || assessments?.[0];


  // Fetch data source counts
  const [dsLoading, setDsLoading] = useState(true);
  const [dsCounts, setDsCounts] = useState({ lkut: 0, projects: 0, budgets: 0, risks: 0, k3: 0, smap: 0, pancek: 0 });

  useEffect(() => {
    if (!user) return;
    setDsLoading(true);
    Promise.all([
      supabase.from("lkut_reports").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("budget_entries").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("risk_registers").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("k3_checklists").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("smap_documents").select("id", { count: "exact", head: true }).eq("user_id", user.id),
      supabase.from("pancek_assessments").select("id", { count: "exact", head: true }).eq("user_id", user.id),
    ]).then(([lkut, proj, budget, risk, k3, smap, pancek]) => {
      setDsCounts({
        lkut: lkut.count || 0,
        projects: proj.count || 0,
        budgets: budget.count || 0,
        risks: risk.count || 0,
        k3: k3.count || 0,
        smap: smap.count || 0,
        pancek: pancek.count || 0,
      });
      setDsLoading(false);
    });
  }, [user]);

  const dataSources: DataSourceStatus[] = [
    { label: "Data LKUT", icon: FileText, count: dsCounts.lkut, description: "Laporan keuangan, SDM, aset", link: "/lkut", contributes: "Keuangan, Kepatuhan" },
    { label: "Project Workspace", icon: FolderKanban, count: dsCounts.projects, description: "Data proyek konstruksi", link: "/projects", contributes: "Kinerja Proyek" },
    { label: "Budget Tracker", icon: DollarSign, count: dsCounts.budgets, description: "Rencana & realisasi anggaran", link: "/budget-tracker", contributes: "Deviasi Anggaran" },
    { label: "Risk Register", icon: Shield, count: dsCounts.risks, description: "Identifikasi & mitigasi risiko", link: "/risk-register", contributes: "Risk & K3" },
    { label: "K3 Checklist", icon: HardHat, count: dsCounts.k3, description: "Inspeksi keselamatan kerja", link: "/k3-checklist", contributes: "Kepatuhan K3" },
    { label: "SMAP", icon: ShieldCheck, count: dsCounts.smap, description: "Dokumen anti penyuapan", link: "/smap", contributes: "Kepatuhan SMAP" },
    { label: "PANCEK", icon: ShieldAlert, count: dsCounts.pancek, description: "Self-assessment anti korupsi", link: "/pancek", contributes: "Kepatuhan PANCEK" },
  ];

  const complianceItems = useMemo<ComplianceItem[]>(() => {
    if (!latestLkut) {
      return [
        { id: "sbu", label: "Sertifikat Badan Usaha (SBU)", description: "Perizinan utama BUJK", icon: FileCheck2, status: "missing", fulfilled: false, details: "Belum ada data LKUT" },
        { id: "smap", label: "SMAP (Sistem Manajemen Anti Penyuapan)", description: "Kepatuhan ISO 37001", icon: ShieldCheck, status: "missing", fulfilled: false, details: "Belum ada data LKUT" },
        { id: "tkk", label: "Tenaga Kerja Konstruksi (TKK)", description: "Penggantian/pembaruan TKK", icon: ClipboardCheck, status: "missing", fulfilled: false, details: "Belum ada data LKUT" },
        { id: "gcg", label: "Good Corporate Governance (GCG)", description: "Penerapan tata kelola perusahaan", icon: ShieldCheck, status: "missing", fulfilled: false, details: "Belum ada data LKUT" },
        { id: "smk3", label: "SMK3 (Sistem Manajemen K3)", description: "Kepatuhan keselamatan kerja", icon: ShieldCheck, status: "missing", fulfilled: false, details: "Belum ada data LKUT" },
      ];
    }

    const now = new Date();
    const items: ComplianceItem[] = [];

    // SBU
    const sbuExpiry = latestLkut.sbu_expiry_date ? parseISO(latestLkut.sbu_expiry_date) : null;
    const sbuDaysLeft = sbuExpiry ? differenceInDays(sbuExpiry, now) : null;
    let sbuStatus: ComplianceItem["status"] = "missing";
    if (latestLkut.sbu_number && sbuExpiry) {
      if (sbuDaysLeft! < 0) sbuStatus = "expired";
      else if (sbuDaysLeft! <= 90) sbuStatus = "expiring";
      else sbuStatus = "valid";
    }
    items.push({
      id: "sbu",
      label: "Sertifikat Badan Usaha (SBU)",
      description: latestLkut.sbu_number ? `No. ${latestLkut.sbu_number}` : "Belum diisi",
      icon: FileCheck2,
      status: sbuStatus,
      deadline: sbuExpiry ? format(sbuExpiry, "d MMMM yyyy", { locale: localeId }) : undefined,
      daysLeft: sbuDaysLeft ?? undefined,
      fulfilled: sbuStatus === "valid" || sbuStatus === "expiring",
      details: sbuDaysLeft !== null && sbuDaysLeft >= 0
        ? `${sbuDaysLeft} hari lagi`
        : sbuDaysLeft !== null ? `Kadaluarsa ${Math.abs(sbuDaysLeft)} hari lalu` : undefined,
    });

    // SMAP
    const smapDate = latestLkut.smap_report_date ? parseISO(latestLkut.smap_report_date) : null;
    items.push({
      id: "smap",
      label: "SMAP (Sistem Manajemen Anti Penyuapan)",
      description: "Kepatuhan ISO 37001",
      icon: ShieldCheck,
      status: latestLkut.smap_fulfilled ? "valid" : "missing",
      deadline: smapDate ? format(smapDate, "d MMMM yyyy", { locale: localeId }) : undefined,
      fulfilled: !!latestLkut.smap_fulfilled,
      details: latestLkut.smap_fulfilled
        ? `Terpenuhi${smapDate ? `, dilaporkan ${format(smapDate, "d MMM yyyy", { locale: localeId })}` : ""}`
        : "Belum terpenuhi",
    });

    // TKK
    const tkkDate = latestLkut.tkk_replacement_date ? parseISO(latestLkut.tkk_replacement_date) : null;
    items.push({
      id: "tkk",
      label: "Tenaga Kerja Konstruksi (TKK)",
      description: "Penggantian/pembaruan TKK",
      icon: ClipboardCheck,
      status: latestLkut.tkk_replacement ? "valid" : "missing",
      deadline: tkkDate ? format(tkkDate, "d MMMM yyyy", { locale: localeId }) : undefined,
      fulfilled: !!latestLkut.tkk_replacement,
      details: latestLkut.tkk_replacement
        ? `Terpenuhi${tkkDate ? `, tanggal ${format(tkkDate, "d MMM yyyy", { locale: localeId })}` : ""}`
        : latestLkut.tkk_replacement_notes || "Belum ada penggantian",
    });

    // GCG
    items.push({
      id: "gcg",
      label: "Good Corporate Governance (GCG)",
      description: "Penerapan tata kelola perusahaan",
      icon: ShieldCheck,
      status: latestLkut.gcg_applied ? "valid" : "missing",
      fulfilled: !!latestLkut.gcg_applied,
      details: latestLkut.gcg_applied
        ? `Diterapkan${latestLkut.gcg_first_year ? ` sejak ${latestLkut.gcg_first_year}` : ""}`
        : "Belum diterapkan",
    });

    // SMK3
    items.push({
      id: "smk3",
      label: "SMK3 (Sistem Manajemen K3)",
      description: "Kepatuhan keselamatan kerja",
      icon: ShieldCheck,
      status: latestLkut.smk3_applied ? "valid" : "missing",
      fulfilled: !!latestLkut.smk3_applied,
      details: latestLkut.smk3_applied
        ? `Diterapkan${latestLkut.smk3_first_year ? ` sejak ${latestLkut.smk3_first_year}` : ""}`
        : "Belum diterapkan",
    });

    // PANCEK KPK
    const pancekVerified = latestPancek?.status === "verified";
    const pancekSubmitted = latestPancek?.status === "submitted";
    let pancekStatus: ComplianceItem["status"] = "missing";
    if (pancekVerified) pancekStatus = "valid";
    else if (pancekSubmitted) pancekStatus = "expiring";

    items.push({
      id: "pancek",
      label: "PANCEK KPK (Panduan Cegah Korupsi)",
      description: "Syarat perpanjangan SBU — Verifikasi Asosiasi",
      icon: ShieldAlert,
      status: pancekStatus,
      fulfilled: pancekVerified,
      details: pancekVerified
        ? `Terverifikasi${latestPancek?.verified_at ? ` pada ${new Date(latestPancek.verified_at).toLocaleDateString("id-ID")}` : ""}`
        : pancekSubmitted
        ? `Menunggu verifikasi Asosiasi (${latestPancek?.completion_percent || 0}% terisi)`
        : latestPancek
        ? `Draft — ${latestPancek.completion_percent || 0}% terisi`
        : "Belum mengisi self-assessment PANCEK",
    });

    return items;
  }, [latestLkut, latestPancek]);

  const fulfilledCount = complianceItems.filter(i => i.fulfilled).length;
  const compliancePct = Math.round((fulfilledCount / complianceItems.length) * 100);
  const urgentItems = complianceItems.filter(i => i.status === "expiring" || i.status === "expired");

  if (loading || pancekLoading) {
    return <div className="text-center py-12 text-muted-foreground">Memuat data kepatuhan...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold font-heading text-foreground flex items-center gap-2">
          <ShieldCheck className="w-6 h-6 text-accent" />
          Compliance Tracker
        </h2>
        <p className="text-sm text-muted-foreground">
          Pantau kepatuhan perizinan SBU, SMAP, TKK, GCG, SMK3 & PANCEK KPK BUJK Anda
        </p>

        {/* Company Identity */}
        {(profile || latestLkut) && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2 px-4 py-3 rounded-lg bg-accent/5 border border-accent/15">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-accent shrink-0" />
              <span className="text-sm font-semibold text-foreground">
                {profile?.company?.trim() ? profile.company : "Data perusahaan belum diisi"}
              </span>
            </div>
            {!profile?.company?.trim() && (
              <Badge variant="outline" className="text-xs">
                Wajib isi Profil Perusahaan
              </Badge>
            )}
            {latestLkut?.sbu_number && (
              <Badge variant="outline" className="text-xs">
                SBU: {latestLkut.sbu_number}
              </Badge>
            )}
            {profile?.bujk_qualification && (
              <Badge variant="outline" className="text-xs capitalize">
                {profile.bujk_qualification}
              </Badge>
            )}
            {latestLkut && (
              <Badge variant="outline" className="text-xs">
                LKUT {latestLkut.report_year}
              </Badge>
            )}
            {!profile?.company?.trim() && (
              <Button variant="link" className="p-0 h-auto text-xs underline" onClick={() => navigate("/profile")}>
                Lengkapi profil →
              </Button>
            )}
          </div>
        )}

        {!profile?.company?.trim() && !loading && (
          <div className="flex items-center gap-2 text-sm px-4 py-3 rounded-lg bg-muted border border-border text-muted-foreground">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Data perusahaan belum ada. Silakan isi Nama Perusahaan di halaman Profil.</span>
          </div>
        )}
      </div>

      {/* Data Completeness */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <DataCompletenessCard dataSources={dataSources} loading={dsLoading} />
      </motion.div>

      {/* Summary Card */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="border-2">
          <CardContent className="p-6">
            <div className="flex items-center gap-6">
              <div className="text-center min-w-[100px]">
                <p className="text-xs text-muted-foreground font-heading uppercase tracking-wider mb-1">Kepatuhan</p>
                <div className={`text-5xl font-black font-heading ${compliancePct >= 80 ? "text-pub-emerald" : compliancePct >= 50 ? "text-pub-amber" : "text-destructive"}`}>
                  {compliancePct}%
                </div>
                <p className="text-sm text-muted-foreground mt-1">{fulfilledCount}/{complianceItems.length} terpenuhi</p>
              </div>
              <div className="flex-1 space-y-3">
                <Progress value={compliancePct} className="h-3" />
                {urgentItems.length > 0 && (
                  <div className="space-y-1.5">
                    {urgentItems.map(item => (
                      <div key={item.id} className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-md ${item.status === "expired" ? "bg-destructive/10 text-destructive" : "bg-pub-amber/10 text-pub-amber"}`}>
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-medium">{item.label}</span>
                        <ArrowRight className="w-3 h-3 shrink-0" />
                        <span className="text-xs">{item.details}</span>
                      </div>
                    ))}
                  </div>
                )}
                {urgentItems.length === 0 && fulfilledCount === complianceItems.length && (
                  <div className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md bg-pub-emerald/10 text-pub-emerald">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Semua kepatuhan terpenuhi</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Compliance Items */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {complianceItems.map((item, i) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className={`border ${getUrgencyColor(item.status)} h-full`}>
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <item.icon className="w-5 h-5 shrink-0" />
                    <CardTitle className="text-sm leading-tight">{item.label}</CardTitle>
                  </div>
                  {getStatusBadge(item.status)}
                </div>
                <CardDescription className="text-xs">{item.description}</CardDescription>
              </CardHeader>
              <CardContent className="pt-0 space-y-2">
                {item.deadline && (
                  <div className="flex items-center gap-1.5 text-xs">
                    <CalendarClock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="text-muted-foreground">Deadline:</span>
                    <span className="font-medium">{item.deadline}</span>
                  </div>
                )}
                {item.details && (
                  <p className="text-xs text-muted-foreground">{item.details}</p>
                )}
                {item.daysLeft !== undefined && item.daysLeft > 0 && item.daysLeft <= 90 && (
                  <Progress value={Math.max(0, 100 - (item.daysLeft / 90) * 100)} className="h-1.5" />
                )}
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Deadline Reference */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-heading flex items-center gap-2">
            <CalendarClock className="w-4 h-4 text-accent" />
            Referensi Batas Waktu
          </CardTitle>
          <CardDescription>Berdasarkan Permen PUPR No. 7/2024</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 text-sm">
            <div className="flex items-start gap-2 p-2 rounded-md bg-muted/30">
              <FileCheck2 className="w-4 h-4 text-pub-sky mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">LKUT</p>
                <p className="text-xs text-muted-foreground">Batas pelaporan: 30 April setiap tahun</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2 rounded-md bg-muted/30">
              <FileCheck2 className="w-4 h-4 text-pub-emerald mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">SBU</p>
                <p className="text-xs text-muted-foreground">Perpanjang sebelum masa berlaku habis</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2 rounded-md bg-muted/30">
              <ShieldCheck className="w-4 h-4 text-pub-amber mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">SMAP</p>
                <p className="text-xs text-muted-foreground">Wajib dipenuhi sesuai ketentuan LPJK</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2 rounded-md bg-muted/30">
              <ClipboardCheck className="w-4 h-4 text-pub-violet mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">TKK</p>
                <p className="text-xs text-muted-foreground">Penggantian dilaporkan dalam LKUT</p>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2 rounded-md bg-pub-amber/10 border border-pub-amber/20">
              <ShieldAlert className="w-4 h-4 text-pub-amber mt-0.5 shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-foreground">PANCEK KPK</p>
                <p className="text-xs text-muted-foreground">Verifikasi oleh Asosiasi — syarat perpanjangan SBU</p>
              </div>
              <Button variant="outline" size="sm" className="gap-1 text-xs shrink-0" onClick={() => navigate("/smap")}>
                <ExternalLink className="w-3 h-3" />
                Buka SMAP
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
