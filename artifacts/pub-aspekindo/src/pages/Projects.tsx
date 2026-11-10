import { useState, useMemo } from "react";
import { useProjects } from "@/hooks/useProjects";
import { ProjectList } from "@/components/projects/ProjectList";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { ProjectDetail } from "@/components/projects/ProjectDetail";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, FolderKanban, TrendingUp, Clock, MapPin, BarChart3, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";

type View = { type: 'list' } | { type: 'create' } | { type: 'detail'; id: string };

const statusColors: Record<string, string> = {
  active: "hsl(160, 60%, 40%)",
  completed: "hsl(200, 80%, 55%)",
  on_hold: "hsl(38, 92%, 50%)",
  cancelled: "hsl(0, 84%, 60%)",
};

const Projects = () => {
  const [view, setView] = useState<View>({ type: 'list' });
  const { projects, isLoading, createProject, updateProject, deleteProject } = useProjects();

  const stats = useMemo(() => {
    if (!projects.length) return null;
    const totalValue = projects.reduce((s, p) => s + (p.value_amount || 0), 0);
    const avgDuration = Math.round(projects.reduce((s, p) => s + (p.duration_months || 0), 0) / projects.length);
    const active = projects.filter(p => p.status === "active").length;
    const completed = projects.filter(p => p.status === "completed").length;

    // Status distribution for pie
    const statusMap: Record<string, number> = {};
    projects.forEach(p => { statusMap[p.status] = (statusMap[p.status] || 0) + 1; });
    const statusData = Object.entries(statusMap).map(([status, count]) => ({
      name: status === "active" ? "Aktif" : status === "completed" ? "Selesai" : status === "on_hold" ? "Ditunda" : status,
      value: count,
      fill: statusColors[status] || "hsl(var(--muted-foreground))",
    }));

    // Value by contract type
    const contractMap: Record<string, number> = {};
    projects.forEach(p => {
      const key = p.contract_type || "lainnya";
      contractMap[key] = (contractMap[key] || 0) + (p.value_amount || 0);
    });
    const contractData = Object.entries(contractMap).map(([type, value]) => ({
      name: type === "lumpsum" ? "Lump Sum" : type === "unit_price" ? "Harga Satuan" : type === "turnkey" ? "Turnkey" : type,
      value: Math.round(value / 1e9 * 10) / 10,
    }));

    return { totalValue, avgDuration, active, completed, statusData, contractData };
  }, [projects]);

  const fmt = (n: number) => {
    if (n >= 1e12) return `Rp ${(n / 1e12).toFixed(1)}T`;
    if (n >= 1e9) return `Rp ${(n / 1e9).toFixed(1)}M`;
    if (n >= 1e6) return `Rp ${(n / 1e6).toFixed(0)}Jt`;
    return `Rp ${n.toLocaleString("id-ID")}`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FolderKanban className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-heading">Project Workspace</h1>
            <p className="text-sm text-muted-foreground font-body">Kelola proyek dan hubungkan dengan toolkit kompetensi</p>
          </div>
        </div>
        {view.type === 'list' && (
          <div className="flex flex-wrap justify-end gap-2">
            <Button asChild variant="outline">
              <a
                href="https://sistem-manajemen-proyek-konstruksi.replit.app"
                target="_blank"
                rel="noopener noreferrer"
              >
                <ExternalLink className="w-4 h-4 mr-1" /> Sistem Manajemen Proyek
              </a>
            </Button>
            <Button onClick={() => setView({ type: 'create' })} className="bg-gradient-amber text-accent-foreground font-heading shadow-amber hover:brightness-110">
              <Plus className="w-4 h-4 mr-1" /> Tambah Proyek
            </Button>
          </div>
        )}
        {view.type !== 'list' && (
          <Button variant="outline" onClick={() => setView({ type: 'list' })}>
            ← Kembali
          </Button>
        )}
      </div>

      {/* Stats & Charts - only on list view */}
      {view.type === 'list' && stats && (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Proyek", value: projects.length, icon: FolderKanban, color: "text-pub-sky", bg: "bg-pub-sky/10" },
              { label: "Proyek Aktif", value: stats.active, icon: BarChart3, color: "text-pub-emerald", bg: "bg-pub-emerald/10" },
              { label: "Total Nilai", value: fmt(stats.totalValue), icon: TrendingUp, color: "text-pub-amber", bg: "bg-pub-amber/10" },
              { label: "Durasi Rata-rata", value: `${stats.avgDuration} bln`, icon: Clock, color: "text-pub-violet", bg: "bg-pub-violet/10" },
            ].map((s, i) => (
              <motion.div
                key={s.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="bg-card rounded-xl border border-border p-4 shadow-card"
              >
                <div className={`w-9 h-9 rounded-lg ${s.bg} flex items-center justify-center mb-2`}>
                  <s.icon className={`w-4 h-4 ${s.color}`} />
                </div>
                <p className="text-xl font-bold font-heading text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground font-body">{s.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid md:grid-cols-2 gap-4">
            {/* Status distribution */}
            <Card>
              <CardContent className="p-4">
                <p className="text-sm font-heading font-semibold text-foreground mb-3">Distribusi Status</p>
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width={120} height={120}>
                    <PieChart>
                      <Pie data={stats.statusData} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={3}>
                        {stats.statusData.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {stats.statusData.map((s) => (
                      <div key={s.name} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.fill }} />
                          <span className="text-muted-foreground">{s.name}</span>
                        </div>
                        <span className="font-heading font-semibold text-foreground">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contract value breakdown */}
            {stats.contractData.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <p className="text-sm font-heading font-semibold text-foreground mb-3">Nilai per Tipe Kontrak (Miliar)</p>
                  <ResponsiveContainer width="100%" height={120}>
                    <BarChart data={stats.contractData} layout="vertical" margin={{ left: 0, right: 8 }}>
                      <XAxis type="number" fontSize={10} stroke="hsl(var(--muted-foreground))" tickFormatter={v => `${v}M`} />
                      <YAxis type="category" dataKey="name" width={80} fontSize={10} stroke="hsl(var(--muted-foreground))" />
                      <Tooltip
                        formatter={(v: number) => [`Rp ${v}M`, "Nilai"]}
                        contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                      />
                      <Bar dataKey="value" fill="hsl(38, 92%, 50%)" radius={[0, 4, 4, 0]} maxBarSize={16} />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}

      {/* Content */}
      {view.type === 'list' && (
        <ProjectList
          projects={projects}
          isLoading={isLoading}
          onSelect={(id) => setView({ type: 'detail', id })}
          onDelete={(id) => deleteProject.mutate(id)}
        />
      )}

      {view.type === 'create' && (
        <ProjectForm
          onSubmit={(data) => {
            createProject.mutate(data, { onSuccess: () => setView({ type: 'list' }) });
          }}
          isSubmitting={createProject.isPending}
        />
      )}

      {view.type === 'detail' && (
        <ProjectDetail
          projectId={view.id}
          onBack={() => setView({ type: 'list' })}
          onUpdate={(data) => updateProject.mutate(data)}
        />
      )}
    </div>
  );
};

export default Projects;
