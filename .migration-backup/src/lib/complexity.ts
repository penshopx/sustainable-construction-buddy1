// Project Complexity Scoring Engine
export interface ProjectInput {
  value_amount: number;
  duration_months: number;
  multidiscipline: boolean;
  contract_type: string;
  risk_class: string;
}

export function computeComplexityScore(p: ProjectInput): number {
  let score = 0;

  // Value-based scoring
  if (p.value_amount >= 50_000_000_000) score += 8;
  else if (p.value_amount >= 10_000_000_000) score += 5;
  else if (p.value_amount >= 1_000_000_000) score += 3;
  else score += 1;

  // Duration
  if (p.duration_months >= 24) score += 5;
  else if (p.duration_months >= 12) score += 3;
  else score += 1;

  // Multi-discipline
  if (p.multidiscipline) score += 3;

  // Contract type
  if (['turnkey', 'design_build', 'epc'].includes(p.contract_type)) score += 4;
  else if (['lumpsum'].includes(p.contract_type)) score += 2;
  else score += 1;

  // Risk class
  if (p.risk_class === 'high') score += 5;
  else if (p.risk_class === 'medium') score += 3;
  else score += 1;

  return score;
}

export function getComplexityLabel(score: number): { label: string; color: string } {
  if (score >= 18) return { label: 'Tinggi', color: 'destructive' };
  if (score >= 12) return { label: 'Sedang', color: 'default' };
  return { label: 'Rendah', color: 'secondary' };
}

export function getComplexityPoints(score: number): number {
  if (score >= 18) return 20;
  if (score >= 12) return 10;
  return 5;
}
