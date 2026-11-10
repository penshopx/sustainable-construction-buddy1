export interface DatedAssessment {
  completed_at: string | null;
}

function completedAtTimestamp(value: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function orderAssessmentsChronologically<T extends DatedAssessment>(
  assessments: T[],
) {
  return assessments
    .map((assessment, index) => ({ assessment, index }))
    .sort((left, right) => {
      const leftTimestamp = completedAtTimestamp(left.assessment.completed_at);
      const rightTimestamp = completedAtTimestamp(right.assessment.completed_at);

      if (leftTimestamp === null && rightTimestamp === null) {
        return left.index - right.index;
      }
      if (leftTimestamp === null) return 1;
      if (rightTimestamp === null) return -1;
      return leftTimestamp - rightTimestamp || left.index - right.index;
    })
    .map(({ assessment }) => assessment);
}

export function selectLatestAssessment<T extends DatedAssessment>(
  assessments: T[],
) {
  let latest: T | undefined;
  let latestTimestamp = Number.NEGATIVE_INFINITY;

  for (const assessment of assessments) {
    const timestamp = completedAtTimestamp(assessment.completed_at);
    if (timestamp !== null && timestamp > latestTimestamp) {
      latest = assessment;
      latestTimestamp = timestamp;
    }
  }

  return latest ?? assessments[0];
}