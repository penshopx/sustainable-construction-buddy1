import {
  LMS_QUIZ_HISTORY_NOTICE,
  LMS_QUIZ_WEIGHT_EXAMPLE,
  LMS_QUIZ_WEIGHT_FORMULA,
  quizAnswerCount,
} from "@/lib/lmsQuizScoringExplanation";

export function QuizScoringExplanation({
  attempt,
}: {
  attempt?: { correct_answers: number; total_questions: number };
}) {
  return (
    <div className="space-y-2 text-xs">
      {attempt && <p className="font-medium">{quizAnswerCount(attempt)}</p>}
      <p>{LMS_QUIZ_WEIGHT_FORMULA}</p>
      <p>{LMS_QUIZ_WEIGHT_EXAMPLE}</p>
      {attempt && <p>{LMS_QUIZ_HISTORY_NOTICE}</p>}
    </div>
  );
}
