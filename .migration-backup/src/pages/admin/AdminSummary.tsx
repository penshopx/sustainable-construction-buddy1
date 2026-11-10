import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Users, FolderKanban, FileText, ShieldCheck, Award, Store, Lightbulb,
  TrendingUp, Building2, BarChart3, HardHat, DollarSign
} from "lucide-react";

interface PlatformStats {
  totalUsers: number;
  totalProjects: number;
  totalLkut: number;
  totalPancek: number;
  totalCertificates: number;
  totalProducts: number;
  totalOrders: number;
  totalInnovations: number;
  totalBujk: number;
  totalK3: number;
  totalBudget: number;
  totalRisks: number;
  innovationByStatus: Record<string, number>;
  pancekByStatus: Record<string, number>;
  orderByStatus: Record<string, number>;
}

export default function AdminSummary() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      setLoading(true);
      const [
        { count: totalUsers },
        { count: totalProjects },
        { count: totalLkut },
        { count: totalPancek },
        { count: totalCertificates },
        { count: totalProducts },
        { count: totalOrders },
        { count: totalInnovations },
        { count: totalBujk },
        { count: totalK3 },
        { count: totalBudget },
        { count: totalRisks },
        { data: innovations },
        { data: panceks },
        { data: orders },
      ] = await Promise.all([
        supabase.from("profiles").select("*", { count: "exact", head: true }),
        supabase.from("projects").select("*", { count: "exact", head: true }),
        supabase.from("lkut_reports").select("*", { count: "exact", head: true }),
        supabase.from("pancek_assessments").select("*", { count: "exact", head: true }),
        supabase.from("certificates").select("*", { count: "exact", head: true }),
        supabase.from("marketplace_products").select("*", { count: "exact", head: true }),
        supabase.from("marketplace_orders").select("*", { count: "exact", head: true }),
        supabase.from("innovation_proposals").select("*", { count: "exact", head: true }),
        supabase.from("bujk_directory").select("*", { count: "exact", head: true }),
        supabase.from("k3_checklists").select("*", { count: "exact", head: true }),
        supabase.from("budget_entries").select("*", { count: "exact", head: true }),
        supabase.from("risk_registers").select("*", { count: "exact", head: true }),
        supabase.from("innovation_proposals").select("status"),
        supabase.from("pancek_assessments").select("status"),
        supabase.from("marketplace_orders").select("status"),
      ]);

      const groupBy = (arr: { status: string }[] | null) => {
        const result: Record<string, number> = {};
        (arr || []).forEach((item) => {
          const val = item.status || "unknown";
          result[val] = (result[val] || 0) + 1;
        });
        return result;
      };

      setStats({
        totalUsers: totalUsers || 0,
        totalProjects: totalProjects || 0,
        totalLkut: totalLkut || 0,
        totalPancek: totalPancek || 0,
        totalCertificates: totalCertificates || 0,
        totalProducts: totalProducts || 0,
        totalOrders: totalOrders || 0,
        totalInnovations: totalInnovations || 0,
        totalBujk: totalBujk || 0,
        totalK3: totalK3 || 0,
        totalBudget: totalBudget || 0,
        totalRisks: totalRisks || 0,
        innovationByStatus: groupBy(innovations),
        pancekByStatus: groupBy(panceks),
        orderByStatus: groupBy(orders),
      });
      setLoading(false);
    }
    fetchStats();
  }, []);

  const statCards = stats
    ? [
        { label: "Total Pengguna", value: stats.totalUsers, icon: Users, color: "text-blue-500" },
        { label: "Proyek Aktif", value: stats.totalProjects, icon: FolderKanban, color: "text-emerald-500" },
        { label: "Laporan LKUT", value: stats.totalLkut, icon: FileText, color: "text-amber-500" },
        { label: "Asesmen PANCEK", value: stats.totalPancek, icon: ShieldCheck, color: "text-purple-500" },
        { label: "Sertifikat Terbit", value: stats.totalCertificates, icon: Award, color: "text-yellow-500" },
        { label: "Produk Marketplace", value: stats.totalProducts, icon: Store, color: "text-pink-500" },
        { label: "Total Pesanan", value: stats.totalOrders, icon: DollarSign, color: "text-green-500" },
        { label: "Proposal Inovasi", value: stats.totalInnovations, icon: Lightbulb, color: "text-orange-500" },
        { label: "BUJK Terdaftar", value: stats.totalBujk, icon: Building2, color: "text-indigo-500" },
        { label: "Inspeksi K3", value: stats.totalK3, icon: HardHat, color: "text-red-500" },
        { label: "Entri Anggaran", value: stats.totalBudget, icon: BarChart3, color: "text-cyan-500" },
        { label: "Register Risiko", value: stats.totalRisks, icon: TrendingUp, color: "text-rose-500" },
      ]
    : [];

  const StatusBreakdown = ({ title, data }: { title: string; data: Record<string, number> }) => (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-wrap gap-2">
        {Object.entries(data).map(([status, count]) => (
          <Badge key={status} variant="secondary" className="text-xs">
            {status}: {count}
          </Badge>
        ))}
        {Object.keys(data).length === 0 && <p className="text-xs text-muted-foreground">Belum ada data</p>}
      </CardContent>
    </Card>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-6 h-6 border-2 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center">
          <BarChart3 className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-heading text-foreground">Rangkuman Platform</h1>
          <p className="text-sm text-muted-foreground">Statistik keseluruhan PUB ASPEKINDO</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {statCards.map((s) => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-3 px-4 flex items-center gap-3">
              <s.icon className={`w-8 h-8 ${s.color} shrink-0`} />
              <div>
                <p className="text-2xl font-bold font-heading">{s.value}</p>
                <p className="text-xs text-muted-foreground leading-tight">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {stats && <StatusBreakdown title="Inovasi per Status" data={stats.innovationByStatus} />}
        {stats && <StatusBreakdown title="PANCEK per Status" data={stats.pancekByStatus} />}
        {stats && <StatusBreakdown title="Pesanan per Status" data={stats.orderByStatus} />}
      </div>
    </div>
  );
}
