import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  CheckCircle2, XCircle, Clock, ShieldCheck, FileText,
  BarChart3, FolderKanban, AlertTriangle, TrendingUp, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { exportBujkDetailPdf } from "@/lib/bujkDetailPdf";
import { differenceInDays, parseISO, format } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from "recharts";

interface BujkDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  fullName: string;
  company: string;
}

interface LkutRow {
  id: string;
  report_year: number;
  status: string;
  sbu_number: string;
  sbu_expiry_date: string | null;
  smap_fulfilled: boolean;
  tkk_replacement: boolean;
  gcg_applied: boolean;
  smk3_applied: boolean;
  submitted_at: string | null;
  asset_value_current: number;
  sales_value: number;
  total_employees: number;
  trained_employees: number;
}

interface GradeRow {
  period: string;
  grade: string;
  total_score: number;
  financial_score: number;
  project_score: number;
  compliance_score: number;
  risk_score: number;
}

interface ProjectRow {
  name: string;
  status: string;
  risk_class: string;
  value_amount: number;
  started_at: string | null;
}

interface RiskRow {
  risk_description: string;
  risk_level: string | null;
  status: string;
  probability_score: number;
  impact_score: number;
}

export function BujkDetailDialog({ open, onOpenChange, userId, fullName, company }: BujkDetailDialogProps) {
  const [lkutReports, setLkutReports] = useState<LkutRow[]>([]);
  const [grades, setGrades] = useState<GradeRow[]>([]);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [risks, setRisks] = useState<RiskRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open || !userId) return;
    setLoading(true);

    const fetchAll = async () => {
      const [lkutRes, gradeRes, projRes, riskRes] = await Promise.all([
        supabase.from("lkut_reports").select("id, report_year, status, sbu_number, sbu_expiry_date, smap_fulfilled, tkk_replacement, gcg_applied, smk3_applied, submitted_at, asset_value_current, sales_value, total_employees, trained_employees").eq("user_id", userId).order("report_year", { ascending: false }),
        supabase.from("performance_grades").select("period, grade, total_score, financial_score, project_score, compliance_score, risk_score").eq("user_id", userId).order("period", { ascending: true }),
        supabase.from("projects").select("name, status, risk_class, value_amount, started_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
        supabase.from("risk_registers").select("risk_description, risk_level, status, probability_score, impact_score").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      ]);

      setLkutReports((lkutRes.data || []) as LkutRow[]);
      setGrades((gradeRes.data || []) as GradeRow[]);
      setProjects((projRes.data || []) as ProjectRow[]);
      setRisks((riskRes.data || []) as RiskRow[]);
      setLoading(false);
    };

    fetchAll();
  }, [open, userId]);

  const now = new Date();

  const sbuStatusBadge = (sbuNumber: string, expiryDate: string | null) => {
    if (!sbuNumber) return <Badge variant="outline" className="text-muted-foreground"><XCircle className="w-3 h-3 mr-1" />Tidak Ada</Badge>;
    if (!expiryDate) return <Badge className="bg-pub-emerald/20 text-pub-emerald border-pub-emerald/30"><CheckCircle2 className="w-3 h-3 mr-1" />Aktif</Badge>;
    const days = differenceInDays(parseISO(expiryDate), now);
    if (days < 0) return <Badge className="bg-destructive/20 text-destructive border-destructive/30"><XCircle className="w-3 h-3 mr-1" />Expired</Badge>;
    if (days <= 90) return <Badge className="bg-pub-amber/20 text-pub-amber border-pub-amber/30"><Clock className="w-3 h-3 mr-1" />{days}h</Badge>;
    return <Badge className="bg-pub-emerald/20 text-pub-emerald border-pub-emerald/30"><CheckCircle2 className="w-3 h-3 mr-1" />Aktif ({days}h)</Badge>;
  };

  const boolIcon = (v: boolean) => v
    ? <CheckCircle2 className="w-4 h-4 text-pub-emerald mx-auto" />
    : <XCircle className="w-4 h-4 text-muted-foreground/40 mx-auto" />;

  const gradeColor = (grade: string) => {
    if (grade.startsWith("A")) return "bg-pub-emerald/20 text-pub-emerald border-pub-emerald/30";
    if (grade.startsWith("B")) return "bg-pub-sky/20 text-pub-sky border-pub-sky/30";
    if (grade.startsWith("C")) return "bg-pub-amber/20 text-pub-amber border-pub-amber/30";
    return "bg-destructive/20 text-destructive border-destructive/30";
  };

  const riskLevelColor = (level: string | null) => {
    if (!level) return "bg-muted text-muted-foreground";
    if (level === "extreme" || level === "high") return "bg-destructive/20 text-destructive border-destructive/30";
    if (level === "medium") return "bg-pub-amber/20 text-pub-amber border-pub-amber/30";
    return "bg-pub-emerald/20 text-pub-emerald border-pub-emerald/30";
  };

  // Grade trend chart data
  const chartData = grades.map(g => ({
    period: g.period,
    Keuangan: Number(g.financial_score),
    Proyek: Number(g.project_score),
    Kepatuhan: Number(g.compliance_score),
    Risiko: Number(g.risk_score),
    Total: Number(g.total_score),
  }));

  // Compliance score over years
  const complianceOverYears = lkutReports.map(r => {
    const fulfilled = [
      !!r.sbu_number,
      !!r.smap_fulfilled,
      !!r.tkk_replacement,
      !!r.gcg_applied,
      !!r.smk3_applied,
    ].filter(Boolean).length;
    return { year: r.report_year, score: fulfilled, pct: Math.round((fulfilled / 5) * 100) };
  }).reverse();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-xl font-heading">
            <div className="w-10 h-10 rounded-lg bg-pub-amber/10 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-pub-amber" />
            </div>
            <div className="flex-1">
              <p>{fullName}</p>
              <p className="text-sm font-normal text-muted-foreground">{company}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => exportBujkDetailPdf({ fullName, company, lkutReports, grades, projects, risks })}
              disabled={loading}
            >
              <Download className="w-4 h-4" />
              Export PDF
            </Button>
          </DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pub-amber" />
          </div>
        ) : (
          <Tabs defaultValue="compliance" className="mt-2">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="compliance" className="text-xs gap-1"><ShieldCheck className="w-3.5 h-3.5" />Kepatuhan</TabsTrigger>
              <TabsTrigger value="grades" className="text-xs gap-1"><BarChart3 className="w-3.5 h-3.5" />Grading</TabsTrigger>
              <TabsTrigger value="projects" className="text-xs gap-1"><FolderKanban className="w-3.5 h-3.5" />Proyek</TabsTrigger>
              <TabsTrigger value="risks" className="text-xs gap-1"><AlertTriangle className="w-3.5 h-3.5" />Risiko</TabsTrigger>
            </TabsList>

            {/* Tab: Kepatuhan */}
            <TabsContent value="compliance" className="space-y-4 mt-4">
              {/* Compliance Progress Over Years */}
              {complianceOverYears.length > 0 && (
                <div className="p-4 rounded-lg border border-border bg-muted/20">
                  <h3 className="text-sm font-heading font-semibold mb-3 flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-pub-emerald" />
                    Tren Kepatuhan per Tahun
                  </h3>
                  <div className="space-y-2">
                    {complianceOverYears.map(c => (
                      <div key={c.year} className="flex items-center gap-3">
                        <span className="text-sm font-heading w-12 text-foreground">{c.year}</span>
                        <div className="flex-1">
                          <Progress value={c.pct} className="h-3" />
                        </div>
                        <Badge className={c.score >= 4 ? "bg-pub-emerald/20 text-pub-emerald border-pub-emerald/30" : c.score >= 2 ? "bg-pub-amber/20 text-pub-amber border-pub-amber/30" : "bg-destructive/20 text-destructive border-destructive/30"}>
                          {c.score}/5
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* LKUT History Table */}
              {lkutReports.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="font-heading">Tahun</TableHead>
                        <TableHead className="font-heading text-center">Status</TableHead>
                        <TableHead className="font-heading text-center">SBU</TableHead>
                        <TableHead className="font-heading text-center">SMAP</TableHead>
                        <TableHead className="font-heading text-center">TKK</TableHead>
                        <TableHead className="font-heading text-center">GCG</TableHead>
                        <TableHead className="font-heading text-center">SMK3</TableHead>
                        <TableHead className="font-heading text-right">Aset</TableHead>
                        <TableHead className="font-heading text-right">SDM</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lkutReports.map(r => (
                        <TableRow key={r.id} className="hover:bg-muted/20">
                          <TableCell className="font-heading font-bold text-foreground">{r.report_year}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant={r.status === "submitted" ? "default" : "outline"} className={r.status === "submitted" ? "bg-pub-emerald/20 text-pub-emerald border-pub-emerald/30" : ""}>
                              {r.status === "submitted" ? "Terkirim" : "Draft"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">{sbuStatusBadge(r.sbu_number, r.sbu_expiry_date)}</TableCell>
                          <TableCell className="text-center">{boolIcon(!!r.smap_fulfilled)}</TableCell>
                          <TableCell className="text-center">{boolIcon(!!r.tkk_replacement)}</TableCell>
                          <TableCell className="text-center">{boolIcon(!!r.gcg_applied)}</TableCell>
                          <TableCell className="text-center">{boolIcon(!!r.smk3_applied)}</TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {r.asset_value_current > 0 ? `Rp ${(r.asset_value_current / 1e6).toFixed(0)} jt` : "-"}
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {r.total_employees > 0 ? `${r.trained_employees}/${r.total_employees}` : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Belum ada data LKUT.</p>
              )}
            </TabsContent>

            {/* Tab: Grading */}
            <TabsContent value="grades" className="space-y-4 mt-4">
              {chartData.length > 0 && (
                <div className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis dataKey="period" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", color: "hsl(var(--foreground))" }} />
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

              {grades.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="font-heading">Periode</TableHead>
                        <TableHead className="font-heading text-center">Grade</TableHead>
                        <TableHead className="font-heading text-center">Total</TableHead>
                        <TableHead className="font-heading text-center">Keuangan</TableHead>
                        <TableHead className="font-heading text-center">Proyek</TableHead>
                        <TableHead className="font-heading text-center">Kepatuhan</TableHead>
                        <TableHead className="font-heading text-center">Risiko</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...grades].reverse().map((g, i, arr) => {
                        const prev = i < arr.length - 1 ? arr[i + 1] : null;
                        const trend = (curr: number, p: number | undefined) => {
                          if (p === undefined) return null;
                          const diff = curr - p;
                          if (diff > 0) return <span className="text-pub-emerald text-[10px] font-bold">▲{diff.toFixed(1)}</span>;
                          if (diff < 0) return <span className="text-destructive text-[10px] font-bold">▼{diff.toFixed(1)}</span>;
                          return <span className="text-muted-foreground text-[10px]">=</span>;
                        };
                        return (
                          <TableRow key={g.period} className="hover:bg-muted/20">
                            <TableCell className="font-heading text-foreground">{g.period}</TableCell>
                            <TableCell className="text-center"><Badge className={gradeColor(g.grade)}>{g.grade}</Badge></TableCell>
                            <TableCell className="text-center">
                              <span className="font-bold">{Number(g.total_score).toFixed(1)}</span>
                              {prev && <div>{trend(Number(g.total_score), Number(prev.total_score))}</div>}
                            </TableCell>
                            <TableCell className="text-center text-sm">{Number(g.financial_score)} {prev && trend(Number(g.financial_score), Number(prev.financial_score))}</TableCell>
                            <TableCell className="text-center text-sm">{Number(g.project_score)} {prev && trend(Number(g.project_score), Number(prev.project_score))}</TableCell>
                            <TableCell className="text-center text-sm">{Number(g.compliance_score)} {prev && trend(Number(g.compliance_score), Number(prev.compliance_score))}</TableCell>
                            <TableCell className="text-center text-sm">{Number(g.risk_score)} {prev && trend(Number(g.risk_score), Number(prev.risk_score))}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Belum ada data grading.</p>
              )}
            </TabsContent>

            {/* Tab: Proyek */}
            <TabsContent value="projects" className="mt-4">
              {projects.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="font-heading">Nama Proyek</TableHead>
                        <TableHead className="font-heading text-center">Status</TableHead>
                        <TableHead className="font-heading text-center">Kelas Risiko</TableHead>
                        <TableHead className="font-heading text-right">Nilai</TableHead>
                        <TableHead className="font-heading text-center">Mulai</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {projects.map((p, i) => (
                        <TableRow key={i} className="hover:bg-muted/20">
                          <TableCell className="font-medium text-foreground">{p.name}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={p.status === "active" ? "border-pub-emerald/30 text-pub-emerald" : p.status === "completed" ? "border-pub-sky/30 text-pub-sky" : ""}>{p.status}</Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge className={riskLevelColor(p.risk_class)}>{p.risk_class}</Badge>
                          </TableCell>
                          <TableCell className="text-right text-sm text-muted-foreground">
                            {p.value_amount > 0 ? `Rp ${(p.value_amount / 1e9).toFixed(2)} M` : "-"}
                          </TableCell>
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {p.started_at ? format(parseISO(p.started_at), "MMM yyyy", { locale: idLocale }) : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Belum ada proyek.</p>
              )}
            </TabsContent>

            {/* Tab: Risiko */}
            <TabsContent value="risks" className="mt-4">
              {risks.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/30">
                        <TableHead className="font-heading">Deskripsi Risiko</TableHead>
                        <TableHead className="font-heading text-center">Level</TableHead>
                        <TableHead className="font-heading text-center">P×I</TableHead>
                        <TableHead className="font-heading text-center">Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {risks.map((r, i) => (
                        <TableRow key={i} className="hover:bg-muted/20">
                          <TableCell className="text-foreground text-sm max-w-[300px] truncate">{r.risk_description}</TableCell>
                          <TableCell className="text-center">
                            <Badge className={riskLevelColor(r.risk_level)}>{r.risk_level || "-"}</Badge>
                          </TableCell>
                          <TableCell className="text-center text-sm font-heading font-bold">
                            {r.probability_score}×{r.impact_score}={r.probability_score * r.impact_score}
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline" className={r.status === "mitigated" ? "text-pub-emerald border-pub-emerald/30" : r.status === "open" ? "text-pub-amber border-pub-amber/30" : ""}>
                              {r.status}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">Belum ada data risiko.</p>
              )}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}
