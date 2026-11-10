import { motion } from "framer-motion";
import { BookOpen, FolderKanban, Wrench, Users, RefreshCw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompetencyScore, LEVEL_THRESHOLDS } from "@/hooks/useCompetencyScore";
import { Progress } from "@/components/ui/progress";
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  ResponsiveContainer,
} from "recharts";
import { useState } from "react";

const pillars = [
  { key: "learning_points", label: "Learning", weight: "25%", icon: BookOpen, color: "text-pub-sky", bg: "bg-pub-sky/10", barColor: "bg-pub-sky" },
  { key: "toolkit_points", label: "Toolkit", weight: "35%", icon: Wrench, color: "text-pub-amber", bg: "bg-pub-amber/10", barColor: "bg-pub-amber" },
  { key: "project_points", label: "Project", weight: "25%", icon: FolderKanban, color: "text-pub-emerald", bg: "bg-pub-emerald/10", barColor: "bg-pub-emerald" },
  { key: "contribution_points", label: "Kontribusi", weight: "15%", icon: Users, color: "text-pub-violet", bg: "bg-pub-violet/10", barColor: "bg-pub-violet" },
] as const;

type PillarKey = (typeof pillars)[number]["key"];
type ExplainableScoreKey =
  | "learning_normalized" | "toolkit_normalized" | "project_normalized" | "contribution_normalized"
  | "learning_weighted" | "toolkit_weighted" | "project_weighted" | "contribution_weighted";

const normalizedKeys: Record<PillarKey, ExplainableScoreKey> = {
  learning_points: "learning_normalized",
  toolkit_points: "toolkit_normalized",
  project_points: "project_normalized",
  contribution_points: "contribution_normalized",
};

const weightedKeys: Record<PillarKey, ExplainableScoreKey> = {
  learning_points: "learning_weighted",
  toolkit_points: "toolkit_weighted",
  project_points: "project_weighted",
  contribution_points: "contribution_weighted",
};

export function FourPillarCard() {
  const { currentScore, explainableScore, computeAndSave, scores, WEIGHTS, CAPS } = useCompetencyScore();
  const [showExplain, setShowExplain] = useState(false);

  const radarData = pillars.map((p) => ({
    pillar: p.label,
    value: explainableScore ? explainableScore[normalizedKeys[p.key]] || 0 : 0,
  }));

  const totalScore = currentScore?.total_score || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-card border border-border rounded-xl p-6 shadow-card"
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-bold text-foreground">4-Pillar Scoring Engine</h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowExplain(!showExplain)}
            className="gap-1.5 text-xs"
          >
            <Info className="w-3.5 h-3.5" />
            {showExplain ? "Sembunyikan" : "Kenapa skor saya segini?"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => computeAndSave.mutate()}
            disabled={computeAndSave.isPending}
            className="gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${computeAndSave.isPending ? "animate-spin" : ""}`} />
            Hitung Ulang
          </Button>
        </div>
      </div>

      {/* Pillar cards with normalized progress */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {pillars.map((p) => {
          const rawVal = currentScore?.[p.key] || 0;
          const normalizedVal = explainableScore ? Math.round(explainableScore[normalizedKeys[p.key]] || 0) : 0;
          const weightedVal = explainableScore ? Math.round(explainableScore[weightedKeys[p.key]] || 0) : 0;
          return (
            <div key={p.key} className="rounded-lg border border-border p-3">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-7 h-7 rounded-lg ${p.bg} flex items-center justify-center`}>
                  <p.icon className={`w-3.5 h-3.5 ${p.color}`} />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-body">{p.label}</p>
                  <p className="text-xs text-muted-foreground/60 font-body">Bobot: {p.weight}</p>
                </div>
              </div>
              <p className="text-xl font-bold font-heading text-foreground">{rawVal}</p>
              <div className="mt-1.5">
                <div className="flex justify-between text-[10px] text-muted-foreground mb-0.5">
                  <span>Normalized</span>
                  <span>{normalizedVal}%</span>
                </div>
                <Progress value={normalizedVal} className="h-1.5" />
              </div>
              {showExplain && (
                <p className="text-[10px] text-pub-amber font-heading mt-1">
                  Kontribusi ke skor: +{weightedVal}
                </p>
              )}
            </div>
          );
        })}
      </div>

      {/* Total */}
      <div className="text-center mb-6 p-4 rounded-xl bg-muted/50">
        <p className="text-sm text-muted-foreground font-body">Total Skor Periode Ini</p>
        <p className="text-4xl font-extrabold font-heading text-foreground">
          {totalScore}
        </p>
        <p className="text-xs text-muted-foreground font-body mt-1">
          Periode: {currentScore?.period || "—"}
        </p>
        {showExplain && explainableScore && (
          <div className="mt-3 text-xs text-left max-w-md mx-auto space-y-1 font-body text-muted-foreground">
            <p className="font-heading font-semibold text-foreground text-sm mb-2">📊 Penjelasan Skor:</p>
            <p>• Learning ({WEIGHTS.learning * 100}%): {Math.round(explainableScore.learning_normalized)}% × {WEIGHTS.learning} = <span className="text-pub-sky font-semibold">+{Math.round(explainableScore.learning_weighted)}</span></p>
            <p>• Toolkit ({WEIGHTS.toolkit * 100}%): {Math.round(explainableScore.toolkit_normalized)}% × {WEIGHTS.toolkit} = <span className="text-pub-amber font-semibold">+{Math.round(explainableScore.toolkit_weighted)}</span></p>
            <p>• Project ({WEIGHTS.project * 100}%): {Math.round(explainableScore.project_normalized)}% × {WEIGHTS.project} = <span className="text-pub-emerald font-semibold">+{Math.round(explainableScore.project_weighted)}</span></p>
            <p>• Kontribusi ({WEIGHTS.contribution * 100}%): {Math.round(explainableScore.contribution_normalized)}% × {WEIGHTS.contribution} = <span className="text-pub-violet font-semibold">+{Math.round(explainableScore.contribution_weighted)}</span></p>
            <p className="pt-1 border-t border-border font-heading font-semibold text-foreground">
              Total = {Math.round(explainableScore.learning_weighted)} + {Math.round(explainableScore.toolkit_weighted)} + {Math.round(explainableScore.project_weighted)} + {Math.round(explainableScore.contribution_weighted)} = <span className="text-pub-amber">{totalScore}</span>
            </p>
          </div>
        )}
      </div>

      {/* Radar */}
      {currentScore && (
        <ResponsiveContainer width="100%" height={250}>
          <RadarChart data={radarData}>
            <PolarGrid stroke="hsl(220, 15%, 88%)" />
            <PolarAngleAxis dataKey="pillar" tick={{ fontSize: 11, fill: "hsl(220, 10%, 50%)" }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
            <Radar
              name="Poin"
              dataKey="value"
              stroke="hsl(38, 92%, 50%)"
              fill="hsl(38, 92%, 50%)"
              fillOpacity={0.25}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      )}

      {/* History */}
      {scores.length > 1 && (
        <div className="mt-4">
          <p className="text-xs text-muted-foreground font-body mb-2">Riwayat Skor</p>
          <div className="space-y-1">
            {scores.slice(0, 5).map((s) => (
              <div key={s.id} className="flex justify-between text-xs font-body">
                <span className="text-muted-foreground">{s.period}</span>
                <span className="font-semibold text-foreground">{s.total_score} poin</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
