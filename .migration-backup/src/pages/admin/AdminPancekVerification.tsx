import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  ShieldAlert, CheckCircle2, XCircle, Clock, FileDown,
  TrendingUp, Users, AlertTriangle, BarChart3, FileSpreadsheet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { PancekVerification } from "@/components/admin/PancekVerification";
import { exportPancekPdf, exportPancekExcel } from "@/lib/pancekExportAdmin";
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
} from "recharts";
import PancekTrendChart from "@/components/pancek/PancekTrendChart";
import type { PancekExportRow } from "@/lib/pancekExportAdmin";

const PIE_COLORS = [
  "hsl(var(--pub-sky))",
  "hsl(var(--pub-emerald))",
  "hsl(var(--pub-amber))",
  "hsl(var(--destructive))",
];

interface PancekSummary {
  total: number;
  draft: number;
  submitted: number;
  verified: number;
  rejected: number;
  avgCompletion: number;
  avgScore: number;
  companiesCount: number;
}

type PancekScoreField =
  | "komitmen_score" | "perencanaan_score" | "pelaksanaan_score"
  | "evaluasi_score" | "perbaikan_score" | "respon_score";
type PancekTotalField =
  | "komitmen_total" | "perencanaan_total" | "pelaksanaan_total"
  | "evaluasi_total" | "perbaikan_total" | "respon_total";

export default function AdminPancekVerification() {
  const [summary, setSummary] = useState<PancekSummary>({
    total: 0, draft: 0, submitted: 0, verified: 0, rejected: 0,
    avgCompletion: 0, avgScore: 0, companiesCount: 0,
  });
  const [exportRows, setExportRows] = useState<PancekExportRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSummary = async () => {
      const { data } = await supabase.from("pancek_assessments")
        .select("status, completion_percent, company_name, npwp, nib, period_year, komitmen_score, komitmen_total, perencanaan_score, perencanaan_total, pelaksanaan_score, pelaksanaan_total, evaluasi_score, evaluasi_total, perbaikan_score, perbaikan_total, respon_score, respon_total, verified_by, verified_at, verification_notes, user_id");

      if (!data) { setLoading(false); return; }

      const total = data.length;
      const draft = data.filter((d) => d.status === "draft").length;
      const submitted = data.filter((d) => d.status === "submitted").length;
      const verified = data.filter((d) => d.status === "verified").length;
      const rejected = data.filter((d) => d.status === "rejected").length;
      const avgCompletion = total > 0 ? Math.round(data.reduce((s, d) => s + (d.completion_percent || 0), 0) / total) : 0;
      const companies = new Set(data.map((d) => d.company_name).filter(Boolean));

      // Calculate average weighted score
      const weights: { s: PancekScoreField; t: PancekTotalField; w: number }[] = [
        { s: "komitmen_score", t: "komitmen_total", w: 25 },
        { s: "perencanaan_score", t: "perencanaan_total", w: 10 },
        { s: "pelaksanaan_score", t: "pelaksanaan_total", w: 25 },
        { s: "evaluasi_score", t: "evaluasi_total", w: 15 },
        { s: "perbaikan_score", t: "perbaikan_total", w: 15 },
        { s: "respon_score", t: "respon_total", w: 10 },
      ];
      let totalWScore = 0;
      for (const d of data) {
        let ws = 0;
        for (const p of weights) {
          const sc = d[p.s] || 0;
          const tot = d[p.t] || 1;
          ws += (sc / tot) * p.w;
        }
        totalWScore += ws;
      }
      const avgScore = total > 0 ? Math.round((totalWScore / total) * 100) / 100 : 0;

      // Fetch profile names for export
      const userIds = [...new Set(data.map((d) => d.user_id).filter(Boolean))];
      const { data: profiles } = await supabase.from("profiles").select("user_id, full_name");
      const nameMap = new Map<string, string>();
      (profiles || []).forEach((p) => nameMap.set(p.user_id, p.full_name || "-"));
      
      const enriched: PancekExportRow[] = data.map((d) => ({ ...d, full_name: nameMap.get(d.user_id) || "-" }));
      setExportRows(enriched);
      setSummary({ total, draft, submitted, verified, rejected, avgCompletion, avgScore, companiesCount: companies.size });
      setLoading(false);
    };
    fetchSummary();
  }, []);

  const pieData = useMemo(() => [
    { name: "Menunggu", value: summary.submitted },
    { name: "Terverifikasi", value: summary.verified },
    { name: "Draft", value: summary.draft },
    { name: "Ditolak", value: summary.rejected },
  ].filter(d => d.value > 0), [summary]);

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
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-pub-amber/10 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6 text-pub-amber" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading text-foreground">Dashboard Verifikasi PANCEK</h1>
            <p className="text-sm text-muted-foreground">Monitoring & verifikasi asesmen antikorupsi seluruh BUJK anggota</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportPancekExcel(exportRows)} disabled={exportRows.length === 0}>
            <FileSpreadsheet className="w-4 h-4" />
            Export Excel
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={() => exportPancekPdf(exportRows)} disabled={exportRows.length === 0}>
            <FileDown className="w-4 h-4" />
            Export PDF
          </Button>
        </div>
      </motion.div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Asesmen", value: summary.total, icon: BarChart3, color: "text-pub-sky", bg: "bg-pub-sky/10" },
          { label: "Menunggu Verifikasi", value: summary.submitted, icon: Clock, color: "text-pub-amber", bg: "bg-pub-amber/10", alert: summary.submitted > 0 },
          { label: "Terverifikasi", value: summary.verified, icon: CheckCircle2, color: "text-pub-emerald", bg: "bg-pub-emerald/10" },
          { label: "BUJK Terdaftar", value: summary.companiesCount, icon: Users, color: "text-pub-violet", bg: "bg-pub-violet/10" },
        ].map((s, i) => (
          <motion.div
            key={s.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className={`bg-card rounded-xl border ${s.alert ? "border-pub-amber/50 ring-1 ring-pub-amber/20" : "border-border"} p-5 shadow-card`}
          >
            <div className={`w-10 h-10 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
              <s.icon className={`w-5 h-5 ${s.color}`} />
            </div>
            <p className="text-2xl font-bold font-heading text-foreground">{s.value}</p>
            <p className="text-xs text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Status Distribution */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-card rounded-xl border border-border p-6 shadow-card"
        >
          <h2 className="text-lg font-bold font-heading text-foreground mb-4 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-pub-sky" />
            Distribusi Status
          </h2>
          {pieData.length > 0 ? (
            <>
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={75} paddingAngle={4} dataKey="value">
                      {pieData.map((_, index) => (
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
                {pieData.map((item, i) => (
                  <div key={item.name} className="flex items-center gap-2 text-sm">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: PIE_COLORS[i] }} />
                    <span className="text-muted-foreground">{item.name}</span>
                    <span className="font-heading font-bold text-foreground ml-auto">{item.value}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">Belum ada data asesmen.</p>
          )}
        </motion.div>

        {/* Score Overview */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card rounded-xl border border-border p-6 shadow-card"
        >
          <h2 className="text-lg font-bold font-heading text-foreground mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-pub-emerald" />
            Ringkasan Skor
          </h2>
          <div className="space-y-6">
            <div className="text-center p-6 bg-primary/5 rounded-xl border border-primary/20">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Rata-rata Skor Tertimbang</p>
              <p className={`text-4xl font-bold font-heading mt-1 ${summary.avgScore >= 50 ? "text-pub-emerald" : summary.avgScore >= 30 ? "text-pub-amber" : "text-destructive"}`}>
                {summary.avgScore}<span className="text-lg text-muted-foreground">/100</span>
              </p>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-muted-foreground">Rata-rata Kelengkapan</span>
                <span className="font-heading font-bold">{summary.avgCompletion}%</span>
              </div>
              <Progress value={summary.avgCompletion} className="h-3" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="text-center p-3 rounded-lg bg-pub-emerald/5 border border-pub-emerald/20">
                <p className="text-2xl font-bold font-heading text-pub-emerald">
                  {summary.total > 0 ? Math.round((summary.verified / summary.total) * 100) : 0}%
                </p>
                <p className="text-xs text-muted-foreground">Tingkat Verifikasi</p>
              </div>
              <div className="text-center p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <p className="text-2xl font-bold font-heading text-destructive">{summary.rejected}</p>
                <p className="text-xs text-muted-foreground">Ditolak</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Year-over-Year Trend */}
      {exportRows.length > 0 && (
        <PancekTrendChart assessments={exportRows} aggregateMode title="Tren Kepatuhan Antikorupsi Seluruh BUJK" />
      )}

      {/* Verification Table */}
      <PancekVerification />
    </div>
  );
}
