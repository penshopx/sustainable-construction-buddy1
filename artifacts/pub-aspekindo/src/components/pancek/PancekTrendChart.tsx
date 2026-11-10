import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, LineChart, Line, ComposedChart, Area,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AssessmentData {
  period_year: number;
  komitmen_score: number; komitmen_total: number;
  perencanaan_score: number; perencanaan_total: number;
  pelaksanaan_score: number; pelaksanaan_total: number;
  evaluasi_score: number; evaluasi_total: number;
  perbaikan_score: number; perbaikan_total: number;
  respon_score: number; respon_total: number;
  completion_percent: number;
  status: string;
  company_name?: string;
}

type ScoreKey = keyof Pick<AssessmentData, "komitmen_score" | "perencanaan_score" | "pelaksanaan_score" | "evaluasi_score" | "perbaikan_score" | "respon_score">;
type TotalKey = keyof Pick<AssessmentData, "komitmen_total" | "perencanaan_total" | "pelaksanaan_total" | "evaluasi_total" | "perbaikan_total" | "respon_total">;
type PillarKey = "komitmen" | "perencanaan" | "pelaksanaan" | "evaluasi" | "perbaikan" | "respon";
const PILLAR_CONFIG: { key: PillarKey; scoreKey: ScoreKey; label: string; totalKey: TotalKey; weight: number; color: string }[] = [
  { key: "komitmen", scoreKey: "komitmen_score", label: "Komitmen", totalKey: "komitmen_total", weight: 25, color: "hsl(var(--pub-sky))" },
  { key: "perencanaan", scoreKey: "perencanaan_score", label: "Perencanaan", totalKey: "perencanaan_total", weight: 10, color: "hsl(var(--pub-emerald))" },
  { key: "pelaksanaan", scoreKey: "pelaksanaan_score", label: "Pelaksanaan", totalKey: "pelaksanaan_total", weight: 25, color: "hsl(var(--pub-amber))" },
  { key: "evaluasi", scoreKey: "evaluasi_score", label: "Evaluasi", totalKey: "evaluasi_total", weight: 15, color: "hsl(var(--pub-violet))" },
  { key: "perbaikan", scoreKey: "perbaikan_score", label: "Perbaikan", totalKey: "perbaikan_total", weight: 15, color: "hsl(var(--destructive))" },
  { key: "respon", scoreKey: "respon_score", label: "Respon", totalKey: "respon_total", weight: 10, color: "hsl(var(--primary))" },
];

interface Props {
  /** Assessments data - can be single company (user view) or aggregated (admin view) */
  assessments: AssessmentData[];
  /** If true, aggregate by year across all companies */
  aggregateMode?: boolean;
  title?: string;
}

function calcWeighted(row: AssessmentData): number {
  let ws = 0;
  for (const p of PILLAR_CONFIG) {
    const sc = row[p.scoreKey] || 0;
    const tot = row[p.totalKey] || 1;
    ws += (sc / tot) * p.weight;
  }
  return Math.round(ws * 100) / 100;
}

export default function PancekTrendChart({ assessments, aggregateMode = false, title = "Tren Skor PANCEK Antar Periode" }: Props) {
  const chartData = useMemo(() => {
    if (!assessments || assessments.length === 0) return [];

    // Group by year
    const byYear = new Map<number, AssessmentData[]>();
    for (const a of assessments) {
      const arr = byYear.get(a.period_year) || [];
      arr.push(a);
      byYear.set(a.period_year, arr);
    }

    // Sort years
    const years = [...byYear.keys()].sort();

    return years.map(year => {
      const rows = byYear.get(year)!;
      const count = rows.length;

      // Average each pillar percentage
      const pillarPcts: Record<string, number> = {};
      for (const p of PILLAR_CONFIG) {
        const avg = rows.reduce((sum, r) => {
          const sc = r[p.scoreKey] || 0;
          const tot = r[p.totalKey] || 1;
          return sum + (sc / tot) * 100;
        }, 0) / count;
        pillarPcts[p.key] = Math.round(avg * 10) / 10;
      }

      const avgWeighted = Math.round(rows.reduce((s, r) => s + calcWeighted(r), 0) / count * 100) / 100;
      const avgCompletion = Math.round(rows.reduce((s, r) => s + (r.completion_percent || 0), 0) / count);

      return {
        year: String(year),
        skorTertimbang: avgWeighted,
        kelengkapan: avgCompletion,
        jumlahBUJK: count,
        ...pillarPcts,
      };
    });
  }, [assessments]);

  const trend = useMemo(() => {
    if (chartData.length < 2) return null;
    const last = chartData[chartData.length - 1].skorTertimbang;
    const prev = chartData[chartData.length - 2].skorTertimbang;
    const diff = Math.round((last - prev) * 100) / 100;
    return { diff, direction: diff > 0 ? "up" : diff < 0 ? "down" : "flat" as const };
  }, [chartData]);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Belum ada data multi-periode untuk menampilkan tren.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border border-border shadow-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-bold font-heading text-foreground flex items-center justify-between flex-wrap gap-2">
          <span className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-pub-amber" />
            {title}
          </span>
          {trend && (
            <Badge
              variant="outline"
              className={`gap-1 text-xs ${
                trend.direction === "up" ? "border-pub-emerald/50 text-pub-emerald" :
                trend.direction === "down" ? "border-destructive/50 text-destructive" :
                "border-border text-muted-foreground"
              }`}
            >
              {trend.direction === "up" ? <TrendingUp className="w-3 h-3" /> :
               trend.direction === "down" ? <TrendingDown className="w-3 h-3" /> :
               <Minus className="w-3 h-3" />}
              {trend.diff > 0 ? "+" : ""}{trend.diff} poin
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Weighted Score Line */}
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-heading">Skor Tertimbang per Periode</p>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === "skorTertimbang") return [`${value}/100`, "Skor Tertimbang"];
                    if (name === "kelengkapan") return [`${value}%`, "Kelengkapan"];
                    return [value, name];
                  }}
                />
                <Area type="monotone" dataKey="skorTertimbang" fill="hsl(var(--pub-amber) / 0.15)" stroke="hsl(var(--pub-amber))" strokeWidth={2.5} name="skorTertimbang" dot={{ r: 5, fill: "hsl(var(--pub-amber))" }} />
                <Line type="monotone" dataKey="kelengkapan" stroke="hsl(var(--pub-sky))" strokeWidth={1.5} strokeDasharray="5 5" name="kelengkapan" dot={{ r: 3 }} />
                <Legend
                  formatter={(value) => {
                    if (value === "skorTertimbang") return "Skor Tertimbang";
                    if (value === "kelengkapan") return "Kelengkapan (%)";
                    return value;
                  }}
                />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pillar Breakdown Bars */}
        <div>
          <p className="text-xs text-muted-foreground mb-2 font-heading">Perbandingan Skor per Pilar (%)</p>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} barCategoryGap="20%">
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="year" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    color: "hsl(var(--foreground))",
                    fontSize: 12,
                  }}
                  formatter={(value: number, name: string) => [`${value}%`, name]}
                />
                <Legend />
                {PILLAR_CONFIG.map(p => (
                  <Bar key={p.key} dataKey={p.key} name={`${p.label} (${p.weight}%)`} fill={p.color} radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Year-over-Year Table */}
        {chartData.length >= 2 && (
          <div>
            <p className="text-xs text-muted-foreground mb-2 font-heading">Perubahan Antar Periode</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 px-2 text-muted-foreground font-heading">Pilar</th>
                    {chartData.map(d => (
                      <th key={d.year} className="text-center py-2 px-2 text-muted-foreground font-heading">{d.year}</th>
                    ))}
                    <th className="text-center py-2 px-2 text-muted-foreground font-heading">Δ Terakhir</th>
                  </tr>
                </thead>
                <tbody>
                  {PILLAR_CONFIG.map(p => {
                     const values = chartData.map(d => (d as Record<string, string | number>)[p.key] as number);
                    const delta = values.length >= 2 ? Math.round((values[values.length - 1] - values[values.length - 2]) * 10) / 10 : 0;
                    return (
                      <tr key={p.key} className="border-b border-border/50">
                        <td className="py-1.5 px-2 font-medium text-foreground">{p.label}</td>
                        {values.map((v, i) => (
                          <td key={i} className="text-center py-1.5 px-2">{v}%</td>
                        ))}
                        <td className={`text-center py-1.5 px-2 font-bold ${delta > 0 ? "text-pub-emerald" : delta < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                          {delta > 0 ? "+" : ""}{delta}%
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-t-2 border-border">
                    <td className="py-1.5 px-2 font-bold text-foreground font-heading">Skor Tertimbang</td>
                    {chartData.map(d => (
                      <td key={d.year} className="text-center py-1.5 px-2 font-bold font-heading">{d.skorTertimbang}</td>
                    ))}
                    <td className={`text-center py-1.5 px-2 font-bold font-heading ${
                      trend && trend.diff > 0 ? "text-pub-emerald" : trend && trend.diff < 0 ? "text-destructive" : "text-muted-foreground"
                    }`}>
                      {trend ? `${trend.diff > 0 ? "+" : ""}${trend.diff}` : "-"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
