import { useEffect, useState, useCallback, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "@/components/ui/sonner-toast";
import {
  ClipboardCheck, ArrowRight, ArrowLeft, CheckCircle2, XCircle,
  Trophy, Star, Award, Crown, Gem, Loader2, RotateCcw, Timer, Target
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { LucideIcon } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

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

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);
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

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const Assessment = () => {
  const { user, refreshProfile } = useAuth();
  const [phase, setPhase] = useState<"intro" | "test" | "review" | "result">("intro");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [answerResults, setAnswerResults] = useState<Record<string, AnswerResult>>({});
  const [preTestId, setPreTestId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ score: number; level: string; correct: number; total: number } | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [pastTests, setPastTests] = useState<Tables<"pre_tests">[]>([]);
  const [checkingAnswer, setCheckingAnswer] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("pre_tests")
      .select("*")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .then(({ data }) => setPastTests(data || []));
  }, [user, result]);

  // Timer countdown
  useEffect(() => {
    if (phase === "test" && timeLeft > 0) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            toast.warning("Waktu habis! Assessment akan di-submit otomatis.");
            // Auto-submit will be handled by effect below
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    }
  }, [phase, timeLeft]);

  const startTest = async () => {
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

    const { data: preTest, error } = await supabase
      .from("pre_tests")
      .insert({ user_id: user!.id, total_questions: selected.length })
      .select()
      .single();

    if (error) {
      toast.error("Gagal memulai assessment.");
      setLoading(false);
      return;
    }

    setQuestions(selected);
    setPreTestId(preTest.id);
    setAnswers({});
    setAnswerResults({});
    setCurrentQ(0);
    setPhase("test");
    setShowExplanation(false);
    setTimeLeft(selected.length * 90); // 90 seconds per question
    setLoading(false);
  };

  const selectAnswer = async (questionId: string, answerIdx: number) => {
    setAnswers((prev) => ({ ...prev, [questionId]: answerIdx }));
    setCheckingAnswer(true);
    
    const { data } = await supabase.rpc("check_question_answer", {
      _question_id: questionId,
      _selected_answer: answerIdx,
    });
    
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
    if (timerRef.current) clearInterval(timerRef.current);
    setLoading(true);

    const answersPayload = questions.map((q) => ({
      question_id: q.id,
      selected_answer: answers[q.id] ?? -1,
    }));

    const { data, error } = await supabase.rpc("submit_assessment", {
      _pre_test_id: preTestId!,
      _answers: answersPayload,
    });

    if (error) {
      toast.error("Gagal mengirim assessment.");
      setLoading(false);
      return;
    }

    if (!isAssessmentSubmitResponse(data)) {
      toast.error("Respons assessment tidak valid.");
      setLoading(false);
      return;
    }
    const res = data;
    if (res.error) {
      toast.error(res.error);
      setLoading(false);
      return;
    }

    await refreshProfile();

    setResult({ score: res.score, level: res.level, correct: res.correct, total: res.total });
    setPhase("result");
    setLoading(false);
  }, [answers, preTestId, questions, refreshProfile]);

  // Auto-submit when timer runs out
  useEffect(() => {
    if (phase === "test" && timeLeft === 0 && questions.length > 0 && Object.keys(answers).length > 0) {
      submitTest();
    }
  }, [answers, phase, questions.length, submitTest, timeLeft]);

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

  return (
    <div className="max-w-4xl mx-auto">
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
              <button
                onClick={startTest}
                disabled={loading}
                className="inline-flex items-center gap-2 px-8 py-3.5 rounded-lg bg-gradient-amber text-accent-foreground font-semibold font-heading shadow-amber hover:brightness-110 transition-all disabled:opacity-50"
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                  <>Mulai Assessment <ArrowRight className="w-4 h-4" /></>
                )}
              </button>
            </div>

            {pastTests.length > 0 && (
              <div className="mt-10">
                <h3 className="text-lg font-bold font-heading text-foreground mb-4">Riwayat Assessment</h3>
                <div className="space-y-3">
                  {pastTests.slice(0, 5).map((t) => (
                    <div key={t.id} className="bg-card border border-border rounded-xl p-4 flex items-center justify-between shadow-card">
                      <div>
                        <p className="font-heading font-semibold text-foreground">Skor: {t.score}</p>
                        <p className="text-xs text-muted-foreground font-body">
                          {new Date(t.completed_at).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })}
                        </p>
                      </div>
                      <span className="text-sm font-heading font-semibold text-pub-amber">{t.determined_level}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* TEST */}
        {phase === "test" && q && (
          <motion.div key={`test-${currentQ}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-heading text-pub-amber font-semibold uppercase">{q.domain_name}</span>
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-heading font-semibold ${
                    timerWarning ? "bg-destructive/10 text-destructive animate-pulse" : "bg-muted text-muted-foreground"
                  }`}>
                    <Timer className="w-3.5 h-3.5" />
                    {formatTime(timeLeft)}
                  </div>
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
                      disabled={answered || checkingAnswer}
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
            <h2 className="text-2xl font-bold font-heading text-foreground mb-6">Review Jawaban</h2>
            <div className="grid grid-cols-6 md:grid-cols-8 gap-2 mb-8">
              {questions.map((q, i) => {
                const answered = answers[q.id] !== undefined;
                const isCorrect = answerResults[q.id]?.is_correct ?? false;
                return (
                  <button
                    key={q.id}
                    onClick={() => { setCurrentQ(i); setPhase("test"); }}
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
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border text-foreground font-heading font-medium hover:bg-muted transition-colors"
              >
                <ArrowLeft className="w-4 h-4" /> Kembali ke Soal
              </button>
              <button
                onClick={submitTest}
                disabled={loading || Object.keys(answers).length < questions.length}
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

              <h1 className="text-3xl font-bold font-heading text-foreground mb-2">Assessment Selesai!</h1>

              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-muted text-foreground font-heading text-lg font-bold mb-6">
                Skor: {result.score}
              </div>

              <div className="bg-card border border-border rounded-2xl p-8 max-w-md mx-auto shadow-card mb-8">
                <p className="text-sm text-muted-foreground font-body mb-2">Level Kompetensi Anda:</p>
                <div className="flex items-center justify-center gap-3">
                  {(() => {
                    const rc = levelConfig[result.level];
                    const Icon = rc.icon;
                    return (
                      <>
                        <Icon className={`w-10 h-10 ${rc.color}`} />
                        <span className="text-3xl font-bold font-heading text-foreground">{result.level}</span>
                      </>
                    );
                  })()}
                </div>
                <p className="text-sm text-muted-foreground font-body mt-3">
                  {result.correct} dari {result.total} jawaban benar
                </p>
              </div>

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
