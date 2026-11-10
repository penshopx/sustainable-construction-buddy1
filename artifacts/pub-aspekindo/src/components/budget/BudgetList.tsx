import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { type BudgetEntry, getDeviationSeverity } from "@/hooks/useBudgetEntries";
import { Skeleton } from "@/components/ui/skeleton";

interface BudgetListProps {
  entries: BudgetEntry[];
  isLoading: boolean;
  onDelete: (id: string) => void;
}

function formatRp(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}

export function BudgetList({ entries, isLoading, onDelete }: BudgetListProps) {
  if (isLoading) return <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-12" />)}</div>;

  if (entries.length === 0) {
    return <p className="text-center text-muted-foreground py-8 font-body">Belum ada entri anggaran.</p>;
  }

  return (
    <div className="rounded-lg border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="font-heading">Periode</TableHead>
            <TableHead className="font-heading">Kategori</TableHead>
            <TableHead className="font-heading text-right">Rencana</TableHead>
            <TableHead className="font-heading text-right">Aktual</TableHead>
            <TableHead className="font-heading text-center">Deviasi</TableHead>
            <TableHead className="font-heading w-10"></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map(entry => {
            const severity = getDeviationSeverity(entry.deviation_percent);
            return (
              <TableRow key={entry.id}>
                <TableCell className="font-body text-sm">{entry.period_month}</TableCell>
                <TableCell><Badge variant="outline" className="text-xs">{entry.category}</Badge></TableCell>
                <TableCell className="text-right text-sm font-body">{formatRp(entry.planned_amount)}</TableCell>
                <TableCell className="text-right text-sm font-body">{formatRp(entry.actual_amount)}</TableCell>
                <TableCell className="text-center">
                  {entry.deviation_percent !== null ? (
                    <span className={`inline-flex items-center gap-1 text-xs font-semibold ${severity === 'danger' ? 'text-destructive' : severity === 'warning' ? 'text-yellow-600' : 'text-pub-emerald'}`}>
                      {severity !== 'normal' && <AlertTriangle className="w-3 h-3" />}
                      {severity === 'normal' && <CheckCircle2 className="w-3 h-3" />}
                      {entry.deviation_percent > 0 ? '+' : ''}{entry.deviation_percent}%
                    </span>
                  ) : '—'}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="icon" onClick={() => onDelete(entry.id)} className="h-7 w-7 text-destructive hover:bg-destructive/10">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
