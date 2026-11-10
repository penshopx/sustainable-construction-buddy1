import type { SiapAssessmentSource } from "./siapCompetencyEngine.ts";

export interface NullableAssessmentResponse {
  score: number | null;
  determined_level: string | null;
  completed_at: string | null;
}

export function mapAssessmentResponse(
  assessment: NullableAssessmentResponse | null,
): SiapAssessmentSource | null {
  return assessment
    ? {
        score: assessment.score ?? 0,
        level: assessment.determined_level,
        completed_at: assessment.completed_at,
      }
    : null;
}