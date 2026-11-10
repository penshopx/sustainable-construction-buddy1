import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from "recharts";
import type { PerformanceGrade } from "@/hooks/usePerformanceGrades";
import { TrendingUp } from "lucide-react";

interface GradeTrendChartProps {
  grades: PerformanceGrade[];
}

export default function GradeTrendChart({ grades }: GradeTrendChartProps) {
  const chartData = useMemo(() => {
    return [...grades]
      .reverse()
      .map((g) => ({
        period: g.period,
        total: g.total_score,
        keuangan: g.financial_score,
        proyek: g.project_score,
        kepatuhan: g.compliance_score,
        risk: g.risk_score,
        grade: g.grade,
      }));
  }, [grades]);

  if (chartData.length < 1) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-heading flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent" />
          Tren Kinerja BUJK
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <defs>
              <linearGradient id="gradTotal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              stroke="hsl(var(--border))"
            />
            <YAxis
              domain={[0, 100]}
              tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
              stroke="hsl(var(--border))"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                color: "hsl(var(--foreground))",
                fontSize: 12,
              }}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  total: "Skor Komposit",
                  keuangan: "Keuangan",
                  proyek: "Kinerja Proyek",
                  kepatuhan: "Kepatuhan & SDM",
                  risk: "Risk & K3",
                };
                return [value, labels[name] || name];
              }}
            />
            <Legend
              formatter={(value: string) => {
                const labels: Record<string, string> = {
                  total: "Komposit",
                  keuangan: "Keuangan",
                  proyek: "Proyek",
                  kepatuhan: "Kepatuhan",
                  risk: "Risk & K3",
                };
                return labels[value] || value;
              }}
              wrapperStyle={{ fontSize: 11 }}
            />
            <Area
              type="monotone"
              dataKey="total"
              stroke="hsl(var(--accent))"
              fill="url(#gradTotal)"
              strokeWidth={2.5}
              dot={{ r: 4, fill: "hsl(var(--accent))" }}
            />
            <Line type="monotone" dataKey="keuangan" stroke="hsl(152 60% 52%)" strokeWidth={1.5} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="proyek" stroke="hsl(199 89% 48%)" strokeWidth={1.5} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="kepatuhan" stroke="hsl(38 92% 50%)" strokeWidth={1.5} dot={{ r: 3 }} />
            <Line type="monotone" dataKey="risk" stroke="hsl(263 70% 58%)" strokeWidth={1.5} dot={{ r: 3 }} />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
