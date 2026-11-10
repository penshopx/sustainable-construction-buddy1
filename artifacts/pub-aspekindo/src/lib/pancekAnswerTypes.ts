export type IndicatorStatus = "ya" | "tidak" | "sebagian" | "";

export interface EvidenceFile {
  url: string;
  name: string;
}

export interface IndicatorAnswer {
  status: IndicatorStatus;
  score: number; // 0-4
  notes: string;
  evidence_url?: string;
  evidence_name?: string;
  /** Multiple evidence files (new format) */
  evidence_files?: EvidenceFile[];
}

export type PancekAnswers = Record<string, IndicatorAnswer>;

/** Convert legacy boolean answers to new format */
export function migrateLegacyAnswers(answers: unknown): PancekAnswers {
  if (!answers || typeof answers !== "object") return {};
  const result: PancekAnswers = {};
  for (const [key, val] of Object.entries(answers as Record<string, unknown>)) {
    if (typeof val === "boolean") {
      result[key] = {
        status: val ? "ya" : "",
        score: val ? 4 : 0,
        notes: "",
      };
    } else if (
      val && typeof val === "object" && !Array.isArray(val) &&
      typeof (val as Record<string, unknown>).status === "string" &&
      typeof (val as Record<string, unknown>).score === "number" &&
      typeof (val as Record<string, unknown>).notes === "string"
    ) {
      const candidate = val as Record<string, unknown>;
      result[key] = {
        status: ["ya", "tidak", "sebagian", ""].includes(candidate.status as string) ? candidate.status as IndicatorStatus : "",
        score: candidate.score as number,
        notes: candidate.notes as string,
        ...(typeof candidate.evidence_url === "string" ? { evidence_url: candidate.evidence_url } : {}),
        ...(typeof candidate.evidence_name === "string" ? { evidence_name: candidate.evidence_name } : {}),
      };
    }
  }
  return result;
}

/** Count indicators with status "ya" or "sebagian" */
export function countAnswered(answers: PancekAnswers): number {
  return Object.values(answers).filter(a => a.status === "ya" || a.status === "sebagian").length;
}

/** Calculate pillar scores from new answer format (count "ya" = full, "sebagian" = half) */
export function calculatePillarScoresFromAnswers(answers: PancekAnswers, pillars: { id: string; indicators: { code: string }[] }[]): Record<string, number> {
  const scores: Record<string, number> = {};
  for (const pillar of pillars) {
    let score = 0;
    for (const ind of pillar.indicators) {
      const ans = answers[ind.code];
      if (ans?.status === "ya") score += 1;
      else if (ans?.status === "sebagian") score += 0.5;
    }
    scores[pillar.id] = score;
  }
  return scores;
}

/** Calculate weighted total score (0-100) based on pillar weights */
export function calculateWeightedScore(answers: PancekAnswers, pillars: { id: string; weight: number; indicators: { code: string }[] }[]): number {
  let weightedTotal = 0;
  for (const pillar of pillars) {
    let score = 0;
    for (const ind of pillar.indicators) {
      const ans = answers[ind.code];
      if (ans?.status === "ya") score += 1;
      else if (ans?.status === "sebagian") score += 0.5;
    }
    const pillarPct = pillar.indicators.length > 0 ? score / pillar.indicators.length : 0;
    weightedTotal += pillarPct * pillar.weight;
  }
  return Math.round(weightedTotal * 100) / 100;
}

/** Convert new answers back to simple boolean for backward compatibility scoring */
export function answersToBoolean(answers: PancekAnswers): Record<string, boolean> {
  const result: Record<string, boolean> = {};
  for (const [key, val] of Object.entries(answers)) {
    result[key] = val.status === "ya";
  }
  return result;
}
