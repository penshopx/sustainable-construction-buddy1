import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/components/ui/sonner-toast";
import {
  ClipboardCheck, ArrowRight, ArrowLeft, CheckCircle2, XCircle,
  Trophy, Star, Award, Crown, Gem, Loader2, RotateCcw, Timer, Target, AlertCircle
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { LucideIcon } from "lucide-react";
import type { Json, Tables } from "@/integrations/supabase/types";
import { assessmentLevel, formatAssessmentDate } from "@/lib/competencyFallbacks";
import { assessmentDraftContent, createAssessmentDraftRetry, assessmentDraftKey, assessmentDraftStorageEpoch, assessmentSecondsLeft, parseAssessmentDraft, resolveAssessmentClock, resolveServerAssessmentDraft, saveLocalAssessmentDraft, mergeAssessmentDrafts, resolveDraftSave, type AssessmentDraft } from "@/lib/assessmentDraft";

interface Question {
  id: string;
  question_text: string;
  options: string[];
  difficulty: string;
  domain_name?: string;
}

interface AnswerResult {
  selected: number;
  is_correct: boolean;
  correct_answer: number;
  explanation: string;
}

const levelConfig: Record<string, { icon: LucideIcon; color: string; minScore: number }> = {
  Pemula: { icon: Star, color: "text-pub-sky", minScore: 0 },
  Muda: { icon: Award, color: "text-pub-emerald", minScore: 60 },
  Madya: { icon: Crown, color: "text-pub-amber", minScore: 75 },
  Utama: { icon: Gem, color: "text-pub-violet", minScore: 85 },
};

function determineLevel(score: number): string {
  if (score >= 85) return "Utama";
  if (score >= 75) return "Madya";
  if (score >= 60) return "Muda";
  return "Pemula";
}

interface AssessmentRpcQuestion extends Question {
  created_at: string;
  domain_id: string;
}

interface AnswerCheckResponse {
  is_correct: boolean;
  correct_answer: number;
  explanation: string;
}

interface AssessmentSubmitResponse {
  error?: string;
  score: number;
  level: string;
  correct: number;
  total: number;
}

type AssessmentResult = Pick<AssessmentSubmitResponse, "score" | "level" | "correct" | "total">;
type AssessmentSubmitOutcome =
  | { ok: true; result: AssessmentResult; nextPhase: "result" }
  | { ok: false; message: string; nextPhase: "review" | "restart" };

export const assessmentRestartMessage =
  "Assessment lama ini tidak dapat dilanjutkan karena daftar soal atau draf server tidak dapat diverifikasi. Mulai ulang untuk mendapatkan sesi dan batas waktu baru. Jawaban draf lama tidak akan dinilai. Hasil assessment yang sudah selesai tetap tersimpan.";

const requiresAssessmentRestart = (message: unknown) =>
  message === "Invalid assessment questions" ||
  message === "Assessment draft unavailable; restart assessment";

export const createAssessmentSubmitGuard = () => {
  let inFlight: Promise<void> | null = null;

  return (submit: () => Promise<void>): Promise<void> => {
    if (inFlight) return inFlight;

    inFlight = Promise.resolve()
      .then(submit)
      .finally(() => {
        inFlight = null;
      });

    return inFlight;
  };
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
const draftJson = (draft: AssessmentDraft): Json => JSON.parse(JSON.stringify(draft)) as Json;
const isAssessmentQuestion = (value: unknown): value is AssessmentRpcQuestion =>
  isRecord(value) && typeof value.id === "string" && typeof value.question_text === "string" &&
  Array.isArray(value.options) && value.options.every((option) => typeof option === "string") &&
  typeof value.difficulty === "string" && typeof value.domain_id === "string";
const isAnswerCheckResponse = (value: unknown): value is AnswerCheckResponse =>
  isRecord(value) && typeof value.is_correct === "boolean" && typeof value.correct_answer === "number" && typeof value.explanation === "string";
const isAssessmentSubmitResponse = (value: unknown): value is AssessmentSubmitResponse =>
  isRecord(value) && typeof value.score === "number" && typeof value.level === "string" &&
  typeof value.correct === "number" && typeof value.total === "number" &&
  (value.error === undefined || typeof value.error === "string");

export const resolveAssessmentSubmitResponse = (value: unknown): AssessmentSubmitOutcome => {
  // RPC failures have an error-only envelope, without score/result fields.
  if (isRecord(value) && typeof value.error === "string" && value.error) {
    return {
      ok: false,
      message: requiresAssessmentRestart(value.error) ? assessmentRestartMessage : "Assessment belum dapat dikirim. Periksa sesi dan koneksi Anda, lalu coba lagi.",
      nextPhase: requiresAssessmentRestart(value.error) ? "restart" : "review",
    };
  }
  if (!isAssessmentSubmitResponse(value)) {
    return { ok: false, message: "Respons assessment tidak valid.", nextPhase: "review" };
  }
  return {
    ok: true,
    result: { score: value.score, level: value.level, correct: value.correct, total: value.total },
    nextPhase: "result",
  };
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface AssessmentProps {
  initialPastTests?: Tables<"pre_tests">[];
}

export const AssessmentResultView = ({ result }: { result: AssessmentResult }) => {
  const rc = levelConfig[result.level];
  const Icon = rc?.icon ?? Trophy;
  const iconColor = rc?.color ?? "text-pub-amber";

  return (
    <>
      <h1 className="text-3xl font-bold font-heading text-foreground mb-2">Assessment Selesai!</h1>
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-foreground font-heading text-lg font-bold mb-6">
        Skor: {result.score}
      </div>
      <div className="bg-card border border-border rounded-2xl p-8 max-w-md mx-auto shadow-card mb-8">
        <p className="text-sm text-muted-foreground font-body mb-2">Level Kompetensi Anda:</p>
        <div className="flex items-center justify-center gap-3">
          <Icon className={`w-10 h-10 ${iconColor}`} />
          <span className="text-3xl font-bold font-heading text-foreground">{result.level}</span>
        </div>
        <p className="text-sm text-muted-foreground font-body mt-3">
          {result.correct} dari {result.total} jawaban benar
        </p>
      </div>
    </>
  );
};

const Assessment = ({ initialPastTests = [] }: AssessmentProps) => {
  const { user, refreshProfile } = useAuth();
  const [phase, setPhase] = useState<"intro" | "test" | "review" | "result">("intro");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [answerResults, setAnswerResults] = useState<Record<string, AnswerResult>>({});
  const [preTestId, setPreTestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AssessmentResult | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [pastTests, setPastTests] = useState<Tables<"pre_tests">[]>(initialPastTests);
  const [pastTestsError, setPastTestsError] = useState(false);
  const [pastTestsLoading, setPastTestsLoading] = useState(false);
  const [checkingAnswer, setCheckingAnswer] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [deadlineAt, setDeadlineAt] = useState<number | null>(null);
  const [serverClock, setServerClock] = useState<ReturnType<typeof resolveAssessmentClock>>(null);
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timeoutSubmissionRef = useRef(false);
  const submitGuardRef = useRef(createAssessmentSubmitGuard());
  const [draftOwner, setDraftOwner] = useState<string | null>(null);
  const [recoveryState, setRecoveryState] = useState<"checking" | "ready" | "error" | "restart">("checking");
  const [recoveryAttempt, setRecoveryAttempt] = useState(0);
  const saveQueueRef = useRef<Promise<void>>(Promise.resolve());
  const baseDraftRef = useRef<AssessmentDraft | null>(null);
  const latestDraftRef = useRef<AssessmentDraft | null>(null);
  const conflictRef = useRef<{ remote: AssessmentDraft; ids: string[] } | null>(null);
  const [draftConflict, setDraftConflict] = useState<typeof conflictRef.current>(null);
  const [saveBlocked, setSaveBlocked] = useState(false);
  const [saveStatus, setSaveStatus] = useState<"pending" | "saving" | "saved">("pending");
  const [saveUnavailable, setSaveUnavailable] = useState(false);
  const unavailableDraftRef = useRef<string | null>(null);
  const retryRef = useRef<ReturnType<typeof createAssessmentDraftRetry> | null>(null);
  const queuedSaveRef = useRef<Promise<void> | null>(null);
  const submittingRef = useRef(false);
  const activeSaveRef = useRef<{ owner: string; id: string; clock: NonNullable<typeof serverClock> } | null>(null);
  activeSaveRef.current = user && draftOwner === user.id && preTestId && serverClock &&
    recoveryState === "ready" && !timedOut && unavailableDraftRef.current !== preTestId &&
    (phase === "test" || phase === "review")
    ? { owner: user.id, id: preTestId, clock: serverClock } : null;

  if (recoveryState === "ready" && preTestId && (phase === "test" || phase === "review")) {
    latestDraftRef.current = {
      version: 1, preTestId, questions, answers, answerResults, currentQ, phase,
      timeLeft, deadlineAt: deadlineAt ?? undefined, timedOut,
      revision: baseDraftRef.current?.revision ?? 0,
    };
  }

  const requireRestart = useCallback(() => {
    // Invalidate in-flight/queued saves before rendering the restart choice.
    // Do not delete or rewrite any server result, including completed history.
    unavailableDraftRef.current = latestDraftRef.current?.preTestId ?? null;
    activeSaveRef.current = null;
    latestDraftRef.current = null;
    baseDraftRef.current = null;
    conflictRef.current = null;
    retryRef.current?.reset();
    timeoutSubmissionRef.current = true;
    setDraftConflict(null);
    setSaveBlocked(false);
    setDraftOwner(null);
    setPreTestId(null);
    setServerClock(null);
    setDeadlineAt(null);
    setPhase("intro");
    setRecoveryState("restart");
  }, []);

  const syncDraft = useCallback(async (forSubmit = false): Promise<boolean> => {
    const epoch = assessmentDraftStorageEpoch();
    const owner = user?.id;
    const initial = latestDraftRef.current;
    if (!owner || !initial) return false;
    const canSave = () => !!owner && !!initial &&
      activeSaveRef.current?.owner === owner && activeSaveRef.current?.id === initial.preTestId &&
      epoch === assessmentDraftStorageEpoch() && !conflictRef.current &&
      (!submittingRef.current || forSubmit) &&
      assessmentSecondsLeft(activeSaveRef.current.clock, performance.now()) > 0;
    if (!canSave()) return false;
    setSaveStatus("saving");
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        if (!canSave()) return false;
        const local = latestDraftRef.current!;
        const outgoing = { ...local, revision: baseDraftRef.current?.revision ?? 0 };
        const { data, error } = await supabase.rpc("save_assessment_draft", {
          _pre_test_id: outgoing.preTestId, _draft: draftJson(outgoing),
        });
        if (!canSave()) return false;
        if (error && ["Assessment unavailable", "Assessment deadline has passed"].includes(error.message)) {
          unavailableDraftRef.current = outgoing.preTestId;
          activeSaveRef.current = null;
          retryRef.current?.reset();
          setSaveUnavailable(true);
          setSaveBlocked(false);
          setSaveStatus("pending");
          return false;
        }
        const response = resolveDraftSave(data);
        if (error || !response || response.draft.preTestId !== outgoing.preTestId) throw new Error("Draft save failed");
        if (response.saved) {
          baseDraftRef.current = response.draft;
          setSaveBlocked(false);
          // An answer or navigation may have changed while this request was in flight.
          if (assessmentDraftContent(latestDraftRef.current!) !== assessmentDraftContent(outgoing)) {
            setSaveStatus("pending");
            try { saveLocalAssessmentDraft(localStorage, owner!, latestDraftRef.current!, epoch); } catch { /* Unavailable. */ }
            continue;
          }
          retryRef.current?.reset();
          setSaveStatus("saved");
          try { localStorage.removeItem(assessmentDraftKey(owner)); } catch { /* Unavailable. */ }
          return true;
        }
        // Read the newest local choices after the request, not its old snapshot.
        const merged = mergeAssessmentDrafts(baseDraftRef.current, latestDraftRef.current!, response.draft);
        baseDraftRef.current = response.draft;
        latestDraftRef.current = merged.draft;
        setAnswers(merged.draft.answers);
        setAnswerResults(merged.draft.answerResults);
        setShowExplanation(false);
        if (merged.conflicts.length) {
          conflictRef.current = { remote: response.draft, ids: merged.conflicts };
          setDraftConflict(conflictRef.current);
          setSaveStatus("pending");
          retryRef.current?.reset();
          try { saveLocalAssessmentDraft(localStorage, owner, merged.draft, epoch); } catch { /* Unavailable. */ }
          return false;
        }
      }
      throw new Error("Assessment is being edited on another device");
    } catch {
      if (canSave()) {
        setSaveBlocked(true);
        setSaveStatus("pending");
        try { saveLocalAssessmentDraft(localStorage, owner, latestDraftRef.current!, epoch); } catch { /* Unavailable. */ }
        retryRef.current?.schedule();
      }
      return false;
    }
  }, [user?.id]);

  const enqueueSave = useCallback((): Promise<void> => {
    // Coalesce timer, online event, manual retry, and edits into a single queued write.
    if (queuedSaveRef.current) return queuedSaveRef.current;
    const epoch = assessmentDraftStorageEpoch();
    const task = saveQueueRef.current.catch(() => undefined).then(async () => {
      if (epoch === assessmentDraftStorageEpoch()) await syncDraft();
    }).finally(() => {
      if (queuedSaveRef.current === task) queuedSaveRef.current = null;
    });
    queuedSaveRef.current = task;
    saveQueueRef.current = task;
    return task;
  }, [syncDraft]);

  useEffect(() => {
    const retry = createAssessmentDraftRetry(enqueueSave);
    retryRef.current = retry;
    const online = () => {
      if (activeSaveRef.current && !conflictRef.current && !submittingRef.current) {
        void enqueueSave();
      }
    };
    window.addEventListener("online", online);
    return () => {
      retry.stop();
      activeSaveRef.current = null;
      window.removeEventListener("online", online);
    };
  }, [enqueueSave]);

  const resolveConflict = (id: string, useRemote: boolean) => {
    const conflict = conflictRef.current;
    const local = latestDraftRef.current;
    if (!conflict || !local) return;
    const next = { ...local, answers: { ...local.answers }, answerResults: { ...local.answerResults } };
    if (useRemote) {
      next.answers[id] = conflict.remote.answers[id];
      delete next.answerResults[id];
      if (conflict.remote.answerResults[id]) next.answerResults[id] = conflict.remote.answerResults[id];
    }
    latestDraftRef.current = next;
    // A reload can happen before the queued server write finishes. Replace the
    // pre-resolution fallback immediately so it cannot resurrect the old choice.
    if (user) {
      try { saveLocalAssessmentDraft(localStorage, user.id, next, assessmentDraftStorageEpoch()); } catch { /* Unavailable. */ }
    }
    setAnswers(next.answers);
    setAnswerResults(next.answerResults);
    const remaining = conflict.ids.filter(questionId => questionId !== id);
    conflictRef.current = remaining.length ? { ...conflict, ids: remaining } : null;
    setDraftConflict(conflictRef.current);
  };

  useEffect(() => {
    if (!user) return;
    let active = true;
    const key = assessmentDraftKey(user.id);
    baseDraftRef.current = null;
    latestDraftRef.current = null;
    conflictRef.current = null;
    setDraftConflict(null);
    setRecoveryState("checking");
    setSaveUnavailable(false);
    void (async () => {
      const { data: remote, error: remoteError } = await supabase.rpc("get_active_assessment_draft");
      if (!active) return;
      if (remoteError) {
        setRecoveryState("error");
        return;
      }
      let draft = remote ? resolveServerAssessmentDraft(remote) : null;
      let clock = remote ? resolveAssessmentClock(remote, performance.now()) : null;
      if (remote && (!draft || !clock)) {
        if (!draft && clock && isRecord(remote) && typeof remote.preTestId === "string") requireRestart();
        else setRecoveryState("error");
        return;
      }
      baseDraftRef.current = draft;
      if (draft) {
        // A failed write on this browser may contain an answer not yet on the server.
        let stored: string | null = null;
        try { stored = localStorage.getItem(key); } catch { /* No browser storage. */ }
        const pending = stored ? parseAssessmentDraft(stored) : null;
        if (pending?.preTestId === draft.preTestId &&
            pending.questions.map((q) => q.id).join(",") === draft.questions.map((q) => q.id).join(",")) {
          if (clock && assessmentSecondsLeft(clock, performance.now()) > 0) {
            const merged = mergeAssessmentDrafts(null, pending, draft);
            if (merged.conflicts.length) {
              conflictRef.current = { remote: draft, ids: merged.conflicts };
              setDraftConflict(conflictRef.current);
            }
            draft = merged.draft;
          }
        }
      }
      if (!draft) {
        // Browser-only drafts cannot establish a missing server question roster.
        // Read only their identity, even if the local question list is corrupt.
        let stored: string | null = null;
        try { stored = localStorage.getItem(key); } catch { /* No browser storage. */ }
        let legacy: unknown = null;
        try { legacy = stored ? JSON.parse(stored) : null; } catch { /* Invalid backup. */ }
        if (isRecord(legacy) && typeof legacy.preTestId === "string") {
          const { data: row, error } = await supabase.from("pre_tests")
            .select("id, status")
            .eq("id", legacy.preTestId).eq("user_id", user.id).maybeSingle();
          if (!active) return;
          if (error) { setRecoveryState("error"); return; }
          if (row?.status === "in_progress") {
            requireRestart();
            return;
          }
        }
      }
      if (!draft) {
        setRecoveryState("ready");
        return;
      }
      if (!clock) { setRecoveryState("error"); return; }
      // Keep the local backup until its merged choices have actually been saved.
      setQuestions(draft.questions);
      setPreTestId(draft.preTestId);
      setAnswers(draft.answers);
      setAnswerResults(draft.answerResults);
      setCurrentQ(draft.currentQ);
      const restoredDeadline = draft.deadlineAt!;
      setDeadlineAt(restoredDeadline);
      setServerClock(clock);
      setTimeLeft(assessmentSecondsLeft(clock, performance.now()));
      setTimedOut(draft.timedOut);
      // A previous tab may have attempted submission without reaching the server.
      // Retry against the server's idempotent endpoint after recovery.
      timeoutSubmissionRef.current = false;
      setShowExplanation(false);
      setDraftOwner(user.id);
      setPhase(draft.phase);
      setRecoveryState("ready");
    })();
    return () => { active = false; };
  }, [user?.id, recoveryAttempt, requireRestart]);

  useEffect(() => {
    if (!user || draftOwner !== user.id || !preTestId || timedOut ||
        (phase !== "test" && phase !== "review") || !questions.length) return;
    setSaveStatus("pending");
    if (latestDraftRef.current) {
      try { saveLocalAssessmentDraft(localStorage, user.id, latestDraftRef.current, assessmentDraftStorageEpoch()); } catch { /* Unavailable. */ }
    }
    void enqueueSave();
  }, [user?.id, draftOwner, preTestId, questions, answers, answerResults, currentQ, phase, deadlineAt, timedOut, serverClock, draftConflict, enqueueSave]);

  useEffect(() => {
    if (!activeSaveRef.current || timedOut) retryRef.current?.reset();
  }, [phase, draftOwner, user?.id, timedOut]);

  const fetchPastTests = useCallback(async () => {
    if (!user) return;

    setPastTestsLoading(true);
    setPastTestsError(false);
    const { data, error } = await supabase
      .from("pre_tests")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false, nullsFirst: false })
      .order("id", { ascending: false });

    if (error) {
      setPastTests([]);
      setPastTestsError(true);
    } else {
      setPastTests(data || []);
    }
    setPastTestsLoading(false);
  }, [user]);

  useEffect(() => {
    fetchPastTests();
  }, [fetchPastTests, result]);

  // Use the server's time sample and a monotonic clock; the device wall clock
  // cannot extend the countdown. Server validation is authoritative on submit.
  useEffect(() => {
    if ((phase !== "test" && phase !== "review") || !serverClock || timedOut) return;
    const update = () => setTimeLeft(assessmentSecondsLeft(serverClock, performance.now()));
    update();
    timerRef.current = setInterval(update, 1000);
    document.addEventListener("visibilitychange", update);
    window.addEventListener("focus", update);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = null;
      document.removeEventListener("visibilitychange", update);
      window.removeEventListener("focus", update);
    };
  }, [phase, serverClock, timedOut]);

  const startTest = async () => {
    if (!user || (recoveryState !== "ready" && recoveryState !== "restart") || loading) return;
    setLoading(true);
    const [{ data: allQuestions }, { data: domains }] = await Promise.all([
      supabase.rpc("get_questions_safe"),
      supabase.from("competency_domains").select("id, name"),
    ]);

    if (!allQuestions || allQuestions.length === 0) {
      toast.error("Belum ada soal tersedia.");
      setLoading(false);
      return;
    }

    const domainMap: Record<string, string> = {};
    (domains || []).forEach((d) => { domainMap[d.id] = d.name; });

    const byDomain: Record<string, AssessmentRpcQuestion[]> = {};
    (Array.isArray(allQuestions) ? allQuestions : []).filter(isAssessmentQuestion).forEach((q) => {
      const domainName = domainMap[q.domain_id] || "Unknown";
      if (!byDomain[domainName]) byDomain[domainName] = [];
      byDomain[domainName].push({ ...q, domain_name: domainName });
    });

    const selected: Question[] = [];
    Object.values(byDomain).forEach((domainQs) => {
      const shuffled = domainQs.sort(() => Math.random() - 0.5);
      selected.push(...shuffled.slice(0, 4));
    });

    if (!selected.length) {
      toast.error("Soal assessment tidak valid.");
      setLoading(false);
      return;
    }
    const initialDraft: AssessmentDraft = {
      version: 1, preTestId: "pending", questions: selected,
      answers: {}, answerResults: {}, currentQ: 0, phase: "test",
      timeLeft: selected.length * 90, timedOut: false,
    };
    const { data: started, error } = await supabase.rpc("start_assessment_draft", { _draft: draftJson(initialDraft) });
    const clock = resolveAssessmentClock(started, performance.now());
    if (error || !started || typeof started !== "object" || Array.isArray(started) ||
        typeof started.preTestId !== "string" || !clock) {
      toast.error("Gagal memulai assessment.");
      setLoading(false);
      return;
    }

    setQuestions(selected);
    setRecoveryState("ready");
    unavailableDraftRef.current = null;
    try { localStorage.removeItem(assessmentDraftKey(user.id)); } catch { /* Storage may be unavailable. */ }
    setSaveUnavailable(false);
    baseDraftRef.current = { ...initialDraft, preTestId: started.preTestId, revision: 0 };
    conflictRef.current = null;
    setDraftConflict(null);
    setPreTestId(started.preTestId);
    setDraftOwner(user.id);
    setAnswers({});
    setAnswerResults({});
    setCurrentQ(0);
    setPhase("test");
    setShowExplanation(false);
    timeoutSubmissionRef.current = false;
    setTimedOut(false);
    setDeadlineAt(clock.deadlineAt);
    setServerClock(clock);
    setTimeLeft(assessmentSecondsLeft(clock, performance.now()));
    setLoading(false);
  };

  const selectAnswer = async (questionId: string, answerIdx: number) => {
    if (latestDraftRef.current) {
      latestDraftRef.current = {
        ...latestDraftRef.current, answers: { ...latestDraftRef.current.answers, [questionId]: answerIdx },
      };
    }
    setAnswers((prev) => ({ ...prev, [questionId]: answerIdx }));
    setCheckingAnswer(true);
    
    const { data } = await supabase.rpc("check_question_answer", {
      _question_id: questionId,
      _selected_answer: answerIdx,
    });
    // A conflict may have been resolved while feedback was in flight.
    if (latestDraftRef.current?.answers[questionId] !== answerIdx) {
      setCheckingAnswer(false);
      return;
    }
    
    if (data) {
      if (!isAnswerCheckResponse(data)) {
        toast.error("Respons jawaban tidak valid.");
        setCheckingAnswer(false);
        return;
      }
      const result = data;
      setAnswerResults((prev) => ({
        ...prev,
        [questionId]: {
          selected: answerIdx,
          is_correct: result.is_correct,
          correct_answer: result.correct_answer,
          explanation: result.explanation,
        },
      }));
    }
    setCheckingAnswer(false);
    setShowExplanation(true);
  };

  const goNext = () => {
    setShowExplanation(false);
    if (currentQ < questions.length - 1) {
      setCurrentQ(currentQ + 1);
    } else {
      setPhase("review");
    }
  };

  const goPrev = () => {
    setShowExplanation(false);
    if (currentQ > 0) setCurrentQ(currentQ - 1);
  };

  const submitTest = useCallback(async () => {
    if (recoveryState !== "ready" || !preTestId) return;
    return submitGuardRef.current(async () => {
      submittingRef.current = true;
      retryRef.current?.reset();
      setLoading(true);

      try {
        await saveQueueRef.current;
        // Freeze expired tests from the server snapshot, as before. Before expiry,
        // synchronize first so submitting from a stale device cannot drop answers.
        if (!serverClock || assessmentSecondsLeft(serverClock, performance.now()) > 0) {
          if (!await syncDraft(true)) {
            toast.error("Selesaikan perbedaan jawaban dan simpan progres sebelum mengirim.");
            return;
          }
        }
        const answersPayload = questions.map((q) => ({
          question_id: q.id,
          selected_answer: latestDraftRef.current?.answers[q.id] ?? answers[q.id] ?? -1,
        }));

        const { data, error } = await supabase.rpc("submit_assessment", {
          _pre_test_id: preTestId!,
          _answers: answersPayload,
        });

        if (error) {
          if (requiresAssessmentRestart(error.message)) {
            requireRestart();
            return;
          }
          toast.error("Gagal mengirim assessment.");
          return;
        }

        const outcome = resolveAssessmentSubmitResponse(data);
        if (!outcome.ok) {
          if (outcome.nextPhase === "restart") {
            requireRestart();
            return;
          }
          toast.error(outcome.message);
          return;
        }

        // Invalidate queued/background saves before profile refresh or any render.
        activeSaveRef.current = null;
        latestDraftRef.current = null;
        retryRef.current?.reset();
        if (user) {
          try { localStorage.removeItem(assessmentDraftKey(user.id)); } catch { /* Storage may be unavailable. */ }
        }
        setDraftOwner(null);
        await refreshProfile();

        setResult(outcome.result);
        setPhase(outcome.nextPhase);
      } finally {
        submittingRef.current = false;
        if (activeSaveRef.current && !conflictRef.current) retryRef.current?.schedule();
        setLoading(false);
      }
    });
  }, [answers, preTestId, questions, refreshProfile, user, serverClock, syncDraft, recoveryState, requireRestart]);

  // Auto-submit when timer runs out
  useEffect(() => {
    if ((phase === "test" || phase === "review") && timeLeft === 0 &&
        deadlineAt !== null && questions.length > 0 && !timeoutSubmissionRef.current) {
      timeoutSubmissionRef.current = true;
      setTimedOut(true);
      setPhase("review");
      toast.warning("Waktu habis! Assessment akan di-submit otomatis.");
      void submitTest();
    }
  }, [phase, questions.length, submitTest, timeLeft, deadlineAt]);

  // Domain breakdown for result
  const getDomainBreakdown = () => {
    const domainMap: Record<string, { correct: number; total: number }> = {};
    questions.forEach(q => {
      const name = q.domain_name || "Unknown";
      if (!domainMap[name]) domainMap[name] = { correct: 0, total: 0 };
      domainMap[name].total++;
      if (answerResults[q.id]?.is_correct) domainMap[name].correct++;
    });
    return Object.entries(domainMap).map(([name, data]) => ({
      name: name.length > 14 ? name.slice(0, 14) + "…" : name,
      fullName: name,
      score: data.total > 0 ? Math.round((data.correct / data.total) * 100) : 0,
      correct: data.correct,
      total: data.total,
    }));
  };

  const q = questions[currentQ];
  const progress = questions.length > 0 ? ((currentQ + 1) / questions.length) * 100 : 0;
  const timerWarning = timeLeft > 0 && timeLeft <= 60;
  const countdown = (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-heading font-semibold ${
      timerWarning ? "bg-destructive/10 text-destructive animate-pulse" : "bg-muted text-muted-foreground"
    }`}>
      <Timer className="w-3.5 h-3.5" aria-hidden="true" />
      <span>Sisa waktu: {formatTime(timeLeft)}</span>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
      {draftConflict && !timedOut && (
        <section role="alert" className="mb-6 rounded-xl border border-pub-amber bg-card p-5 text-foreground">
          <h2 className="font-bold">Ada jawaban berbeda di perangkat lain</h2>
          <p className="mt-2 text-sm">Jawaban pada soal lain sudah digabungkan. Pilih jawaban untuk setiap soal berikut sebelum progres dapat disimpan atau dikirim. Waktu assessment tetap berjalan.</p>
          {draftConflict.ids.map(id => {
            const question = questions.find(item => item.id === id);
            if (!question) return null;
            return (
              <div key={id} className="mt-4 space-y-2">
                <p className="font-semibold">{question.question_text}</p>
                <button type="button" className="block rounded border border-border p-3 text-left" onClick={() => resolveConflict(id, false)}>
                  Gunakan jawaban perangkat ini: {question.options[answers[id]]}
                </button>
                <button type="button" className="block rounded border border-border p-3 text-left" onClick={() => resolveConflict(id, true)}>
                  Gunakan jawaban perangkat lain: {question.options[draftConflict.remote.answers[id]]}
                </button>
              </div>
            );
          })}
        </section>
      )}
      {(phase === "test" || phase === "review") && !timedOut && (
        <p role="status" aria-live="polite" className="mb-4 text-sm text-foreground">
          {saveUnavailable ? "Assessment sudah berakhir atau tidak lagi tersedia. Muat ulang halaman untuk melihat status terbaru."
            : draftConflict ? "Penyimpanan tertunda — pilih jawaban yang berbeda terlebih dahulu."
            : saveStatus === "saved" ? "Progres tersimpan di server."
            : saveStatus === "saving" ? "Menyimpan progres…"
            : "Penyimpanan tertunda — akan dicoba ulang otomatis saat koneksi tersedia."}
        </p>
      )}
      {saveBlocked && !timedOut && (phase === "test" || phase === "review") && (
        <div role="alert" className="mb-4 rounded border border-destructive p-4 text-foreground">
          Progres belum tersimpan di server. Penyimpanan akan dicoba ulang otomatis.
          <button type="button" className="ml-2 underline" onClick={() => {
            void enqueueSave();
          }}>Coba simpan lagi</button>
        </div>
      )}
      <AnimatePresence mode="wait">
        {/* INTRO */}
        {phase === "intro" && (
          <motion.div key="intro" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="text-center mb-8">
              <div className="w-16 h-16 rounded-2xl bg-pub-amber/10 flex items-center justify-center mx-auto mb-4">
                <ClipboardCheck className="w-8 h-8 text-pub-amber" />
              </div>
              <h1 className="text-3xl font-bold font-heading text-foreground">Pre-test Assessment</h1>
              <p className="text-muted-foreground font-body mt-2 max-w-lg mx-auto">
                Uji kompetensi manajerial Anda di 6 domain keahlian BUJK. Hasil assessment menentukan level dan rekomendasi learning path.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-4 mb-8">
              {[
                { icon: Timer, label: "24 Soal", desc: "4 soal per domain" },
                { icon: Target, label: "Scoring Otomatis", desc: "Hasil langsung terlihat" },
                { icon: Trophy, label: "Level Determination", desc: "Pemula → Utama" },
              ].map((f, i) => (
                <div key={i} className="bg-card border border-border rounded-xl p-5 shadow-card text-center">
                  <f.icon className="w-8 h-8 text-pub-amber mx-auto mb-2" />
                  <p className="font-bold font-heading text-foreground">{f.label}</p>
                  <p className="text-xs text-muted-foreground font-body">{f.desc}</p>
                </div>
              ))}
            </div>

            <div className="text-center">
              {recoveryState === "restart" && (
                <section role="alert" className="mb-4 rounded-xl border border-pub-amber bg-card p-5 text-foreground">
                  <h2 className="font-bold">Assessment lama perlu dimulai ulang</h2>
                  <p className="mt-2 text-sm">{assessmentRestartMessage}</p>
                </section>
              )}
              {recoveryState === "error" && (
                <div role="alert" className="mb-4 text-sm text-destructive">
                  Draf assessment belum dapat diperiksa. Periksa koneksi Anda, lalu coba lagi.
                  <button type="button" className="ml-2 underline" onClick={() => setRecoveryAttempt((n) => n + 1)}>
                    Coba Lagi
                  </button>
                </div>
              )}
              <button
                onClick={startTest}
                disabled={loading || (recoveryState !== "ready" && recoveryState !== "restart")}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-gradient-amber text-accent-foreground font-semibold font-heading shadow-amber hover:brightness-110 transition-all disabled:opacity-50"
              >
                {loading || recoveryState === "checking" ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>{recoveryState === "restart" ? "Mulai Ulang Assessment" : "Mulai Assessment"} <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </div>

            <div className="mt-10">
              <h3 className="text-lg font-bold font-heading text-foreground mb-4">Riwayat Assessment</h3>
              {pastTestsError ? (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-center">
                  <AlertCircle className="mx-auto mb-2 h-6 w-6 text-destructive" />
                  <p className="font-heading font-semibold text-foreground">Riwayat assessment gagal dimuat</p>
                  <p className="mt-1 text-sm text-muted-foreground font-body">
                    Silakan periksa koneksi Anda lalu coba lagi.
                  </p>
                  <button
                    type="button"
                    onClick={fetchPastTests}
                    disabled={pastTestsLoading}
                    className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted disabled:opacity-50"
                  >
                    <RotateCcw className={`h-4 w-4 ${pastTestsLoading ? "animate-spin" : ""}`} />
                    {pastTestsLoading ? "Memuat ulang..." : "Coba Lagi"}
                  </button>
                </div>
              ) : pastTests.length > 0 ? (
                <div className="space-y-3">
                  {pastTests.slice(0, 5).map((t) => (
                    <div key={t.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-card">
                      <div>
                        <p className="font-heading font-semibold text-foreground">Skor: {t.score}</p>
                        <p className="text-xs text-muted-foreground font-body">
                           {formatAssessmentDate(t.completed_at, "long")}
                        </p>
                      </div>
                      <span className="text-sm font-heading font-semibold text-pub-amber">
                        {assessmentLevel(t.determined_level, "Belum ditentukan")}
                      </span>
                    </div>
                  ))}
                </div>
              ) : !pastTestsLoading ? (
                <div className="rounded-xl border border-border bg-card p-5 text-center text-sm text-muted-foreground font-body shadow-card">
                  Belum ada assessment yang selesai.
                </div>
              ) : null}
            </div>
          </motion.div>
        )}

        {/* TEST */}
        {phase === "test" && q && (
          <motion.div key={`test-${currentQ}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
            <div className="mb-6">
              {deadlineAt !== null && <p className="mb-2 text-xs text-muted-foreground">Batas waktu server: {new Date(deadlineAt).toLocaleString("id-ID")}</p>}
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-heading text-pub-amber font-semibold uppercase">{q.domain_name}</span>
                <div className="flex items-center gap-3">
                  {countdown}
                  <span className="text-xs text-muted-foreground font-body">Soal {currentQ + 1}/{questions.length}</span>
                </div>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            <div className="bg-card border border-border rounded-2xl p-8 shadow-card">
              <span className="text-xs px-2 py-1 rounded-full bg-muted text-muted-foreground font-heading mb-4 inline-block">
                {q.difficulty}
              </span>
              <h2 className="text-xl font-bold font-heading text-foreground mb-6">{q.question_text}</h2>

              <div className="space-y-3">
                {q.options.map((opt: string, idx: number) => {
                  const selected = answers[q.id] === idx;
                  const answered = answers[q.id] !== undefined;
                  const ar = answerResults[q.id];
                  const isCorrect = ar ? idx === ar.correct_answer : false;

                  let borderClass = "border-border hover:border-pub-amber/40";
                  if (answered && ar) {
                    if (selected && isCorrect) borderClass = "border-pub-emerald bg-pub-emerald/5";
                    else if (selected && !isCorrect) borderClass = "border-destructive bg-destructive/5";
                    else if (isCorrect) borderClass = "border-pub-emerald/30 bg-pub-emerald/5";
                  }

                  return (
                    <motion.button
                      key={idx}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => !answered && selectAnswer(q.id, idx)}
                      disabled={answered || checkingAnswer || !!draftConflict || loading}
                      className={`w-full text-left px-5 py-4 rounded-xl border ${borderClass} transition-all flex items-center gap-3 group`}
                    >
                      <span className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-sm font-heading font-bold text-foreground shrink-0">
                        {String.fromCharCode(65 + idx)}
                      </span>
                      <span className="font-body text-sm text-foreground flex-1">{opt}</span>
                      {answered && ar && selected && isCorrect && <CheckCircle2 className="w-5 h-5 text-pub-emerald shrink-0" />}
                      {answered && ar && selected && !isCorrect && <XCircle className="w-5 h-5 text-destructive shrink-0" />}
                      {answered && ar && !selected && isCorrect && <CheckCircle2 className="w-5 h-5 text-pub-emerald/50 shrink-0" />}
                    </motion.button>
                  );
                })}
              </div>

              {showExplanation && answerResults[q.id] && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="mt-6 p-4 rounded-xl bg-muted/50 border border-border"
                >
                  <p className="text-sm font-heading font-semibold text-foreground mb-1">Penjelasan:</p>
                  <p className="text-sm text-muted-foreground font-body">{answerResults[q.id].explanation}</p>
                </motion.div>
              )}
            </div>

            <div className="flex items-center justify-between mt-6">
              <button
                onClick={goPrev}
                disabled={currentQ === 0}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-foreground font-heading font-medium hover:bg-muted transition-colors disabled:opacity-30"
              >
                <ArrowLeft className="w-4 h-4" /> Sebelumnya
              </button>
              <button
                onClick={goNext}
                disabled={answers[q.id] === undefined}
                className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg bg-gradient-amber text-accent-foreground font-heading font-semibold shadow-amber hover:brightness-110 transition-all disabled:opacity-30"
              >
                {currentQ < questions.length - 1 ? "Selanjutnya" : "Review Jawaban"}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}

        {/* REVIEW */}
        {phase === "review" && (
          <motion.div key="review" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-2xl font-bold font-heading text-foreground">Review Jawaban</h2>
              {countdown}
            </div>
            {deadlineAt !== null && <p className="mb-3 text-xs text-muted-foreground">Batas waktu server: {new Date(deadlineAt).toLocaleString("id-ID")}</p>}
            {timerWarning && !timedOut && (
              <p className="mb-3 text-sm font-semibold text-destructive" role="status">
                Waktu hampir habis. Segera kirim jawaban Anda.
              </p>
            )}
            {timedOut && (
              <p className="mb-6 text-sm text-muted-foreground" role="status">
                Waktu habis. Hanya jawaban yang tersimpan di server sebelum batas waktu yang dinilai; soal lain dihitung salah. Jika pengiriman gagal, pilih Selesai &amp; Lihat Hasil untuk mencoba lagi.
              </p>
            )}
            <div className="grid grid-cols-6 md:grid-cols-8 gap-2 mb-8">
              {questions.map((q, i) => {
                const answered = answers[q.id] !== undefined;
                const isCorrect = answerResults[q.id]?.is_correct ?? false;
                return (
                  <button
                    key={q.id}
                    onClick={() => { setCurrentQ(i); setPhase("test"); }}
                    disabled={timedOut}
                    className={`w-10 h-10 rounded-lg flex items-center justify-center text-sm font-heading font-bold transition-colors ${
                      !answered ? "bg-muted text-muted-foreground" :
                      isCorrect ? "bg-pub-emerald/20 text-pub-emerald" : "bg-destructive/20 text-destructive"
                    }`}
                  >
                    {i + 1}
                  </button>
                );
              })}
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => { setCurrentQ(0); setPhase("test"); }}
                disabled={timedOut}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-foreground font-heading font-medium hover:bg-muted transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Kembali ke Soal
              </button>
              <button
                onClick={submitTest}
                disabled={loading || (!timedOut && (!!draftConflict || Object.keys(answers).length < questions.length))}
                className="inline-flex items-center gap-2 px-8 py-2.5 rounded-lg bg-gradient-amber text-accent-foreground font-heading font-semibold shadow-amber hover:brightness-110 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>Selesai & Lihat Hasil <Trophy className="w-4 h-4" /></>
                )}
              </button>
            </div>
          </motion.div>
        )}

        {/* RESULT */}
        {phase === "result" && result && (
          <motion.div key="result" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <div className="text-center">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="w-24 h-24 rounded-3xl bg-pub-amber/10 flex items-center justify-center mx-auto mb-6"
              >
                <Trophy className="w-12 h-12 text-pub-amber" />
              </motion.div>

              <AssessmentResultView result={result} />

              {/* Domain Breakdown Chart */}
              {(() => {
                const domainData = getDomainBreakdown();
                const barColors = ["hsl(var(--primary))", "hsl(38, 92%, 50%)", "hsl(160, 60%, 40%)", "hsl(200, 80%, 55%)", "hsl(260, 50%, 55%)", "hsl(0, 84%, 60%)"];
                return domainData.length > 0 ? (
                  <Card className="mb-8 max-w-lg mx-auto">
                    <CardContent className="p-5">
                      <p className="text-sm font-heading font-semibold text-foreground mb-3">Breakdown per Domain</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={domainData} layout="vertical" margin={{ left: 0, right: 16 }}>
                          <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} fontSize={10} stroke="hsl(var(--muted-foreground))" />
                          <YAxis type="category" dataKey="name" width={110} fontSize={11} stroke="hsl(var(--muted-foreground))" />
                          <Tooltip
                            formatter={(value: number, _name: string, props: { payload: { correct: number; total: number } }) => [`${value}% (${props.payload.correct}/${props.payload.total})`, "Skor"]}
                            contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                          />
                          <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={18}>
                            {domainData.map((_, i) => (
                              <Cell key={i} fill={barColors[i % barColors.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>
                ) : null;
              })()}

              <div className="flex gap-4 justify-center">
                <button
                  onClick={() => { setPhase("intro"); setResult(null); }}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-lg border border-border text-foreground font-heading font-medium hover:bg-muted transition-colors"
                >
                  <RotateCcw className="w-4 h-4" /> Coba Lagi
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Assessment;
