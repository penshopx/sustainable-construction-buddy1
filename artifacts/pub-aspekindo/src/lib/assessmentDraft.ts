export interface AssessmentDraft {
  version: 1;
  // Optimistic concurrency token, separate from the local JSON format version.
  revision?: number;
  preTestId: string;
  questions: { id: string; question_text: string; options: string[]; difficulty: string; domain_name?: string }[];
  answers: Record<string, number>;
  answerResults: Record<string, { selected: number; is_correct: boolean; correct_answer: number; explanation: string }>;
  currentQ: number;
  phase: "test" | "review";
  timeLeft: number;
  // Display only; the server's pre_tests.deadline_at remains authoritative.
  deadlineAt?: number;
  timedOut: boolean;
}

// Countdown ticks and server revisions do not represent unsaved user edits.
export function assessmentDraftContent(draft: AssessmentDraft): string {
  return JSON.stringify([draft.preTestId, draft.questions, draft.answers,
    draft.answerResults, draft.currentQ, draft.phase]);
}

/** One retry timer with bounded backoff. The caller serializes network writes. */
export function createAssessmentDraftRetry(retry: () => Promise<void>) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let failures = 0;
  let stopped = false;
  const cancel = () => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };
  return {
    schedule() {
      if (stopped || timer !== null) return;
      const delay = Math.min(2000 * 2 ** Math.min(failures++, 4), 30000);
      timer = setTimeout(() => {
        timer = null;
        if (!stopped) void retry();
      }, delay);
    },
    reset() { cancel(); failures = 0; },
    stop() { stopped = true; cancel(); },
  };
}

// Preserve both devices' independent edits. Never decide conflicting choices silently.
export function mergeAssessmentDrafts(base: AssessmentDraft | null, local: AssessmentDraft, remote: AssessmentDraft) {
  if (local.preTestId !== remote.preTestId ||
      local.questions.map(q => q.id).join(",") !== remote.questions.map(q => q.id).join(",")) {
    throw new Error("Assessment questions changed");
  }
  const answers = { ...remote.answers };
  const answerResults = { ...remote.answerResults };
  const conflicts: string[] = [];
  for (const [id, answer] of Object.entries(local.answers)) {
    const previous = base?.answers[id];
    if (answer === previous) continue;
    if (remote.answers[id] !== undefined && remote.answers[id] !== previous && remote.answers[id] !== answer) {
      conflicts.push(id);
    }
    answers[id] = answer;
    delete answerResults[id];
    if (local.answerResults[id]?.selected === answer) answerResults[id] = local.answerResults[id];
  }
  return {
    draft: { ...local, revision: remote.revision, answers, answerResults },
    conflicts,
  };
}

export function resolveDraftSave(value: unknown): { saved: boolean; draft: AssessmentDraft } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.saved !== "boolean") return null;
  const draft = parseAssessmentDraft(JSON.stringify(record.draft));
  if (!draft || !Number.isSafeInteger(draft.revision) || draft.revision! < 0) return null;
  return { saved: record.saved, draft };
}

const assessmentDraftPrefix = "pub_assessment_draft_v1:";
let draftStorageEpoch = 0;

export const assessmentDraftKey = (userId: string) => `${assessmentDraftPrefix}${userId}`;

// Invalidate writes queued by the previous session before touching storage.
export function clearLocalAssessmentDrafts(storage: Storage): void {
  draftStorageEpoch++;
  for (let i = storage.length - 1; i >= 0; i--) {
    const key = storage.key(i);
    if (key?.startsWith(assessmentDraftPrefix)) storage.removeItem(key);
  }
}

export function assessmentDraftStorageEpoch(): number {
  return draftStorageEpoch;
}

export function saveLocalAssessmentDraft(storage: Storage, ownerId: string, draft: AssessmentDraft, epoch: number): void {
  if (epoch === draftStorageEpoch) storage.setItem(assessmentDraftKey(ownerId), JSON.stringify(draft));
}

export function resolveServerAssessmentDraft(value: unknown): AssessmentDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.preTestId !== "string" || typeof record.deadlineAt !== "string" ||
      !Number.isInteger(record.totalQuestions)) return null;
  const deadlineAt = Date.parse(record.deadlineAt);
  if (!Number.isFinite(deadlineAt)) return null;
  const draft = parseAssessmentDraft(JSON.stringify(record.draft));
  if (!draft || draft.preTestId !== record.preTestId || draft.questions.length !== record.totalQuestions) return null;
  return { ...draft, deadlineAt };
}

export function resolveAssessmentClock(value: unknown, monotonicNow: number): { deadlineAt: number; serverNow: number; receivedAt: number } | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.deadlineAt !== "string" || typeof record.serverNow !== "string") return null;
  const deadlineAt = Date.parse(record.deadlineAt);
  const serverNow = Date.parse(record.serverNow);
  if (!Number.isFinite(deadlineAt) || !Number.isFinite(serverNow)) return null;
  return { deadlineAt, serverNow, receivedAt: monotonicNow };
}

export function assessmentSecondsLeft(clock: { deadlineAt: number; serverNow: number; receivedAt: number }, monotonicNow: number): number {
  return Math.max(0, Math.ceil((clock.deadlineAt - clock.serverNow - Math.max(0, monotonicNow - clock.receivedAt)) / 1000));
}

export function parseAssessmentDraft(raw: string): AssessmentDraft | null {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const draft = value as Record<string, unknown>;
    if (draft.version !== 1 || typeof draft.preTestId !== "string" || !draft.preTestId ||
        (draft.revision !== undefined && (!Number.isSafeInteger(draft.revision) || (draft.revision as number) < 0)) ||
        !Array.isArray(draft.questions) || draft.questions.length === 0 || draft.questions.length > 100 ||
        !Number.isInteger(draft.currentQ) || (draft.currentQ as number) < 0 ||
        (draft.currentQ as number) >= draft.questions.length ||
        !Number.isInteger(draft.timeLeft) || (draft.timeLeft as number) < 0 ||
        (draft.timeLeft as number) > draft.questions.length * 90 ||
         (draft.deadlineAt !== undefined && (!Number.isFinite(draft.deadlineAt) || (draft.deadlineAt as number) <= 0)) ||
        typeof draft.timedOut !== "boolean" ||
        (draft.phase !== "test" && draft.phase !== "review") ||
        !draft.answers || typeof draft.answers !== "object" || Array.isArray(draft.answers) ||
        !draft.answerResults || typeof draft.answerResults !== "object" || Array.isArray(draft.answerResults)) return null;

    const questions = draft.questions as Record<string, unknown>[];
    if (!questions.every((q) => q && typeof q.id === "string" && q.id &&
        typeof q.question_text === "string" && typeof q.difficulty === "string" &&
        (q.domain_name === undefined || typeof q.domain_name === "string") &&
        Array.isArray(q.options) && q.options.length > 0 &&
        q.options.every((option) => typeof option === "string")) ||
        new Set(questions.map((q) => q.id)).size !== questions.length) return null;

    const lengths = new Map(questions.map((q) => [q.id as string, (q.options as string[]).length]));
    const answers = draft.answers as Record<string, unknown>;
    if (!Object.entries(answers).every(([id, index]) =>
      lengths.has(id) && Number.isInteger(index) && (index as number) >= 0 && (index as number) < lengths.get(id)!)) return null;
    const results = draft.answerResults as Record<string, unknown>;
    if (!Object.entries(results).every(([id, result]) => {
      if (!result || typeof result !== "object" || Array.isArray(result)) return false;
      const r = result as Record<string, unknown>;
      return answers[id] === r.selected && typeof r.is_correct === "boolean" &&
        Number.isInteger(r.correct_answer) && (r.correct_answer as number) >= 0 &&
        (r.correct_answer as number) < (lengths.get(id) ?? 0) && typeof r.explanation === "string";
    })) return null;
    return draft as unknown as AssessmentDraft;
  } catch {
    return null;
  }
}