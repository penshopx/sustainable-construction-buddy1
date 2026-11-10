import { type RiskRegister, RISK_LEVEL_CONFIG } from "@/hooks/useRiskRegisters";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RiskMatrix } from "@/components/risk/RiskMatrix";
import { Trash2, Calendar, User } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

interface RiskListProps {
  risks: RiskRegister[];
  isLoading: boolean;
  onDelete: (id: string) => void;
}

const STATUS_LABELS: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' }> = {
  open: { label: 'Open', variant: 'default' },
  mitigated: { label: 'Mitigated', variant: 'secondary' },
  closed: { label: 'Closed', variant: 'outline' },
};

export function RiskList({ risks, isLoading, onDelete }: RiskListProps) {
  if (isLoading) {
    return <div className="space-y-3">{[1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}</div>;
  }

  if (risks.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <p className="text-lg font-heading text-muted-foreground">Belum ada risiko</p>
          <p className="text-sm text-muted-foreground mt-1">Tambahkan risiko pertama untuk mulai tracking</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {risks.map(risk => {
        const statusConfig = STATUS_LABELS[risk.status] || STATUS_LABELS.open;
        return (
          <Card key={risk.id} className="hover:border-pub-amber/30 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium">{risk.risk_description}</p>
                  {risk.mitigation_action && (
                    <p className="text-xs text-muted-foreground">💡 {risk.mitigation_action}</p>
                  )}
                  <div className="flex flex-wrap gap-2 items-center">
                    <Badge variant={statusConfig.variant}>{statusConfig.label}</Badge>
                    {risk.owner && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <User className="w-3 h-3" /> {risk.owner}
                      </span>
                    )}
                    {risk.due_date && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Calendar className="w-3 h-3" /> {risk.due_date}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <RiskMatrix probability={risk.probability_score} impact={risk.impact_score} />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Hapus Risiko?</AlertDialogTitle>
                        <AlertDialogDescription>Risiko ini akan dihapus secara permanen.</AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={() => onDelete(risk.id)}>Hapus</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
