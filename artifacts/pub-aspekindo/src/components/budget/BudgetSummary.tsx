import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, TrendingDown, TrendingUp, AlertTriangle } from "lucide-react";
import { getDeviationSeverity } from "@/hooks/useBudgetEntries";

interface BudgetSummaryProps {
  totalPlanned: number;
  totalActual: number;
  overallDeviation: number | null;
  warningCount: number;
}

function formatRp(amount: number) {
  if (amount >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1)}M`;
  if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(0)}jt`;
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}

export function BudgetSummary({ totalPlanned, totalActual, overallDeviation, warningCount }: BudgetSummaryProps) {
  const severity = getDeviationSeverity(overallDeviation);

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-body">Total Rencana</p>
            <p className="text-sm font-bold font-heading">{formatRp(totalPlanned)}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-pub-emerald/10 flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-pub-emerald" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-body">Total Aktual</p>
            <p className="text-sm font-bold font-heading">{formatRp(totalActual)}</p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${severity === 'danger' ? 'bg-destructive/10' : severity === 'warning' ? 'bg-yellow-500/10' : 'bg-pub-emerald/10'}`}>
            <TrendingDown className={`w-5 h-5 ${severity === 'danger' ? 'text-destructive' : severity === 'warning' ? 'text-yellow-500' : 'text-pub-emerald'}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-body">Deviasi</p>
            <p className={`text-sm font-bold font-heading ${severity === 'danger' ? 'text-destructive' : severity === 'warning' ? 'text-yellow-600' : 'text-pub-emerald'}`}>
              {overallDeviation !== null ? `${overallDeviation > 0 ? '+' : ''}${overallDeviation}%` : '—'}
            </p>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4 flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${warningCount > 0 ? 'bg-yellow-500/10' : 'bg-pub-emerald/10'}`}>
            <AlertTriangle className={`w-5 h-5 ${warningCount > 0 ? 'text-yellow-500' : 'text-pub-emerald'}`} />
          </div>
          <div>
            <p className="text-xs text-muted-foreground font-body">Peringatan</p>
            <p className="text-sm font-bold font-heading">{warningCount} item</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
