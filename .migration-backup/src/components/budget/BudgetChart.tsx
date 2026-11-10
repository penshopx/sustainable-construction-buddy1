import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";

interface Entry {
  period_month: string;
  planned_amount: number;
  actual_amount: number;
  deviation_percent: number | null;
  category: string;
}

interface BudgetChartProps {
  entries: Entry[];
}

export function BudgetChart({ entries }: BudgetChartProps) {
  const chartData = useMemo(() => {
    const grouped: Record<string, { planned: number; actual: number }> = {};
    entries.forEach((e) => {
      if (!grouped[e.period_month]) grouped[e.period_month] = { planned: 0, actual: 0 };
      grouped[e.period_month].planned += e.planned_amount;
      grouped[e.period_month].actual += e.actual_amount;
    });
    return Object.entries(grouped)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, vals]) => ({
        period,
        planned: vals.planned / 1_000_000,
        actual: vals.actual / 1_000_000,
        deviation: vals.planned > 0
          ? +((vals.actual - vals.planned) / vals.planned * 100).toFixed(1)
          : 0,
      }));
  }, [entries]);

  if (chartData.length === 0) {
    return (
      <div className="bg-card border border-border rounded-xl p-6 shadow-card text-center">
        <p className="text-sm text-muted-foreground font-body">Belum ada data budget untuk divisualisasikan.</p>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-6 shadow-card"
    >
      <h3 className="font-heading font-bold text-foreground mb-4">Tren Budget: Planned vs Actual</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220, 15%, 90%)" />
          <XAxis dataKey="period" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}jt`} />
          <Tooltip
            contentStyle={{
              background: "hsl(0, 0%, 100%)",
              border: "1px solid hsl(220, 15%, 88%)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            formatter={(value: number, name: string) => [
              `Rp ${value.toFixed(0)} jt`,
              name === "planned" ? "Rencana" : "Aktual",
            ]}
          />
          <Legend formatter={(v) => (v === "planned" ? "Rencana" : "Aktual")} />
          <ReferenceLine y={0} stroke="hsl(220, 15%, 80%)" />
          <Bar dataKey="planned" fill="hsl(200, 80%, 55%)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="actual" fill="hsl(38, 92%, 50%)" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
}
