import { Badge } from "@/components/ui/badge";
import { RISK_LEVEL_CONFIG } from "@/hooks/useRiskRegisters";

interface RiskMatrixProps {
  probability: number;
  impact: number;
}

const MATRIX_COLORS: Record<string, string> = {
  low: 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400',
  medium: 'bg-amber-500/20 border-amber-500/40 text-amber-400',
  high: 'bg-orange-500/20 border-orange-500/40 text-orange-400',
  critical: 'bg-red-500/20 border-red-500/40 text-red-400',
};

function getLevel(p: number, i: number): string {
  const s = p * i;
  if (s >= 15) return 'critical';
  if (s >= 10) return 'high';
  if (s >= 5) return 'medium';
  return 'low';
}

export function RiskMatrix({ probability, impact }: RiskMatrixProps) {
  const level = getLevel(probability, impact);
  const score = probability * impact;
  const config = RISK_LEVEL_CONFIG[level];

  return (
    <div className="flex items-center gap-3">
      <div className={`w-12 h-12 rounded-lg border-2 flex items-center justify-center font-heading font-extrabold text-lg ${MATRIX_COLORS[level]}`}>
        {score}
      </div>
      <div>
        <Badge variant={config.color as 'default' | 'secondary' | 'destructive'}>{config.label}</Badge>
        <p className="text-xs text-muted-foreground mt-0.5">{probability} × {impact}</p>
      </div>
    </div>
  );
}

export function RiskMatrixGrid({ probability, impact }: RiskMatrixProps) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-heading text-muted-foreground">Matriks P×I</p>
      <div className="grid grid-cols-5 gap-0.5 w-fit">
        {[5, 4, 3, 2, 1].map(p => (
          [1, 2, 3, 4, 5].map(i => {
            const level = getLevel(p, i);
            const isActive = p === probability && i === impact;
            return (
              <div
                key={`${p}-${i}`}
                className={`w-6 h-6 rounded-sm text-[10px] flex items-center justify-center font-bold transition-all
                  ${MATRIX_COLORS[level]} ${isActive ? 'ring-2 ring-white scale-125 z-10' : 'opacity-40'}`}
              >
                {p * i}
              </div>
            );
          })
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground w-[7.5rem]">
        <span>Impact →</span>
      </div>
    </div>
  );
}
