import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, ClipboardCheck, Loader2, Pencil, Plus, RefreshCw, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { getQuizMutationError, hasValidQuizQuestion, QUIZ_PUBLICATION_GUIDANCE } from "@/lib/lmsLessonPublication";

type Course = Tables<"aspekindo_lms_courses">;
type Lesson = Tables<"aspekindo_lms_lessons">;
type Question = Tables<"aspekindo_lms_quiz_questions">;
type AnswerKey = Tables<"aspekindo_lms_quiz_answer_keys">;

type QuestionForm = {
  lesson_id: string;
  question_text: string;
  options_text: string;
  correct_option: string;
  points: string;
  sort_order: string;
  explanation_markdown: string;
};

const EMPTY_FORM: QuestionForm = {
  lesson_id: "",
  question_text: "",
  options_text: "",
  correct_option: "0",
  points: "1",
  sort_order: "0",
  explanation_markdown: "",
};

function optionStrings(value: Question["options"]) {
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? value : [];
}

export default function AdminAspekindoLmsQuiz({
  course,
  lessons,
  userId,
}: {
  course: Course | null;
  lessons: Lesson[];
  userId?: string;
}) {
  const { toast } = useToast();
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answerKeys, setAnswerKeys] = useState<AnswerKey[]>([]);
  const [selectedLessonId, setSelectedLessonId] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Question | null>(null);
  const [form, setForm] = useState<QuestionForm>(EMPTY_FORM);

  const loadQuestions = useCallback(async () => {
    const lessonIds = lessons.map((lesson) => lesson.id);
    if (!lessonIds.length) {
      setQuestions([]);
      setAnswerKeys([]);
      return;
    }
    setLoading(true);
    const questionResult = await supabase
      .from("aspekindo_lms_quiz_questions")
      .select("*")
      .in("lesson_id", lessonIds)
      .order("sort_order");
    if (questionResult.error) {
      setLoading(false);
      toast({ title: "Bank soal gagal dimuat", description: questionResult.error.message, variant: "destructive" });
      return;
    }
    const questionRows = questionResult.data ?? [];
    const keyResult = questionRows.length
      ? await supabase.from("aspekindo_lms_quiz_answer_keys").select("*").in("question_id", questionRows.map((item) => item.id))
      : { data: [], error: null };
    setLoading(false);
    if (keyResult.error) {
      toast({ title: "Answer key gagal dimuat", description: keyResult.error.message, variant: "destructive" });
      return;
    }
    setQuestions(questionRows);
    setAnswerKeys(keyResult.data ?? []);
  }, [lessons, toast]);

  useEffect(() => {
    if (!selectedLessonId || !lessons.some((lesson) => lesson.id === selectedLessonId)) {
      setSelectedLessonId(lessons[0]?.id ?? "");
    }
    void loadQuestions();
  }, [lessons, loadQuestions, selectedLessonId]);

  const answerKeyMap = useMemo(() => new Map(answerKeys.map((key) => [key.question_id, key])), [answerKeys]);
  const lessonQuestions = questions.filter((question) => question.lesson_id === selectedLessonId);
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId);

  const openCreate = () => {
    if (!selectedLessonId) return;
    setEditing(null);
    setForm({
      ...EMPTY_FORM,
      lesson_id: selectedLessonId,
      sort_order: String(lessonQuestions.length),
    });
    setDialogOpen(true);
  };

  const openEdit = (question: Question) => {
    const key = answerKeyMap.get(question.id);
    setEditing(question);
    setForm({
      lesson_id: question.lesson_id,
      question_text: question.question_text,
      options_text: optionStrings(question.options).join("\n"),
      correct_option: String(key?.correct_option ?? 0),
      points: String(question.points),
      sort_order: String(question.sort_order),
      explanation_markdown: key?.explanation_markdown ?? "",
    });
    setDialogOpen(true);
  };

  const saveQuestion = async () => {
    const options = form.options_text.split("\n").map((item) => item.trim()).filter(Boolean);
    const correctOption = Number(form.correct_option);
    const points = Number(form.points);
    if (!form.lesson_id || !form.question_text.trim() || options.length < 2) {
      toast({ title: "Lengkapi pertanyaan", description: "Pertanyaan dan minimal dua opsi jawaban wajib diisi.", variant: "destructive" });
      return;
    }
    if (!Number.isInteger(correctOption) || correctOption < 0 || correctOption >= options.length) {
      toast({ title: "Jawaban benar tidak valid", description: "Pilih indeks opsi yang tersedia.", variant: "destructive" });
      return;
    }
    if (!Number.isInteger(points) || points < 1) {
      toast({ title: "Poin tidak valid", description: "Poin minimal adalah 1.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const questionPayload = {
      lesson_id: form.lesson_id,
      question_text: form.question_text.trim(),
      options,
      points,
      sort_order: Number(form.sort_order) || 0,
    };
    let questionId = editing?.id;
    if (editing) {
      const guardError = await getQuizMutationError(supabase, editing.id, {
        ...questionPayload, correct_option: correctOption,
      });
      if (guardError) {
        setSaving(false);
        toast({ title: "Perubahan soal ditolak", description: guardError, variant: "destructive" });
        return;
      }
    }
    // Keep question + key in one transaction, including when options are shortened.
    if (editing && editing.lesson_id === form.lesson_id) {
      const { error } = await supabase.rpc("save_aspekindo_lms_quiz_question", {
        _question_id: editing.id,
        _lesson_id: form.lesson_id,
        _question_text: questionPayload.question_text,
        _options: options,
        _points: points,
        _sort_order: questionPayload.sort_order,
        _correct_option: correctOption,
        _explanation_markdown: form.explanation_markdown.trim(),
      });
      setSaving(false);
      if (error) {
        toast({ title: "Pertanyaan gagal diperbarui", description: error.message, variant: "destructive" });
        return;
      }
      setDialogOpen(false);
      toast({ title: "Pertanyaan diperbarui" });
      await loadQuestions();
      return;
    } else if (editing) {
      const { error } = await supabase.from("aspekindo_lms_quiz_questions").update(questionPayload).eq("id", editing.id);
      if (error) {
        setSaving(false);
        toast({ title: "Pertanyaan gagal diperbarui", description: error.message, variant: "destructive" });
        return;
      }
    } else {
      const { data, error } = await supabase
        .from("aspekindo_lms_quiz_questions")
        .insert({ ...questionPayload, created_by: userId ?? null })
        .select()
        .single();
      if (error || !data) {
        setSaving(false);
        toast({ title: "Pertanyaan gagal dibuat", description: error?.message, variant: "destructive" });
        return;
      }
      questionId = data.id;
    }

    const { error: keyError } = await supabase.from("aspekindo_lms_quiz_answer_keys").upsert({
      question_id: questionId!,
      correct_option: correctOption,
      explanation_markdown: form.explanation_markdown.trim(),
    });
    setSaving(false);
    if (keyError) {
      toast({
        title: "Answer key gagal disimpan",
        description: "Pertanyaan tersimpan, tetapi jawaban benar belum lengkap. Buka kembali pertanyaan untuk memperbaikinya.",
        variant: "destructive",
      });
      await loadQuestions();
      return;
    }
    setDialogOpen(false);
    toast({ title: editing ? "Pertanyaan diperbarui" : "Pertanyaan ditambahkan" });
    await loadQuestions();
  };

  const deleteQuestion = async (question: Question) => {
    if (!window.confirm(`Hapus pertanyaan “${question.question_text}”? Upaya peserta yang sudah tersimpan tidak ikut diubah.`)) return;
    const guardError = await getQuizMutationError(supabase, question.id);
    if (guardError) {
      toast({ title: "Pertanyaan tidak dapat dihapus", description: guardError, variant: "destructive" });
      return;
    }
    const { error } = await supabase.from("aspekindo_lms_quiz_questions").delete().eq("id", question.id);
    if (error) {
      toast({ title: "Pertanyaan gagal dihapus", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Pertanyaan dihapus" });
    await loadQuestions();
  };

  if (!course) {
    return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Pilih kursus di tab Kurikulum sebelum mengelola kuis.</CardContent></Card>;
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <CardTitle className="flex items-center gap-2 text-base"><ClipboardCheck className="h-5 w-5 text-pub-sky" /> Bank soal native</CardTitle>
            <CardDescription>Answer key hanya tersedia untuk admin dan penilaian dilakukan oleh RPC server.</CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void loadQuestions()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Segarkan</Button>
            <Button size="sm" onClick={openCreate} disabled={!selectedLessonId}><Plus className="mr-2 h-4 w-4" /> Tambah pertanyaan</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {lessons.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Tambahkan pelajaran terlebih dahulu sebelum membuat kuis.</div>
          ) : (
            <>
              <div className="max-w-lg">
                <Label>Pelajaran</Label>
                <Select value={selectedLessonId} onValueChange={setSelectedLessonId}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{lessons.map((lesson) => <SelectItem key={lesson.id} value={lesson.id}>{lesson.title}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat bank soal...</div>
              ) : lessonQuestions.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada pertanyaan untuk pelajaran ini.</div>
              ) : (
                <div className="space-y-3">
                  {lessonQuestions.map((question, index) => {
                    const options = optionStrings(question.options);
                    const key = answerKeyMap.get(question.id);
                    return (
                      <div key={question.id} className="rounded-lg border p-4">
                        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <Badge variant="outline">Soal {index + 1}</Badge>
                              <Badge variant="secondary">{question.points} poin</Badge>
                            </div>
                            <p className="mt-2 font-semibold">{question.question_text}</p>
                            <div className="mt-3 grid gap-2 sm:grid-cols-2">
                              {options.map((option, optionIndex) => (
                                <div key={`${question.id}-${optionIndex}`} className={`rounded-md border px-3 py-2 text-sm ${key?.correct_option === optionIndex ? "border-pub-emerald/40 bg-pub-emerald/10" : "bg-muted/30"}`}>
                                  <span className="mr-2 font-mono text-xs text-muted-foreground">{String.fromCharCode(65 + optionIndex)}.</span>{option}
                                  {key?.correct_option === optionIndex && <CheckCircle2 className="ml-2 inline h-4 w-4 text-pub-emerald" />}
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(question)}><Pencil className="mr-1 h-4 w-4" /> Edit</Button>
                            <Button size="icon" variant="ghost" className="text-destructive" onClick={() => void deleteQuestion(question)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {!loading && selectedLesson && selectedLesson.passing_score > 0 && !hasValidQuizQuestion(lessonQuestions, answerKeys) && (
                <p role="alert" className="rounded-lg border border-destructive/30 p-3 text-sm">
                  Kuis wajib belum siap. {QUIZ_PUBLICATION_GUIDANCE}
                </p>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editing ? "Edit pertanyaan kuis" : "Tambah pertanyaan kuis"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>Pelajaran</Label><Select value={form.lesson_id} onValueChange={(value) => setForm((current) => ({ ...current, lesson_id: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{lessons.map((lesson) => <SelectItem key={lesson.id} value={lesson.id}>{lesson.title}</SelectItem>)}</SelectContent></Select></div>
            <div><Label htmlFor="native-quiz-question">Pertanyaan *</Label><Textarea id="native-quiz-question" value={form.question_text} onChange={(event) => setForm((current) => ({ ...current, question_text: event.target.value }))} rows={3} /></div>
            <div><Label htmlFor="native-quiz-options">Opsi jawaban *</Label><Textarea id="native-quiz-options" value={form.options_text} onChange={(event) => setForm((current) => ({ ...current, options_text: event.target.value }))} rows={6} placeholder={"Satu opsi per baris\nOpsi kedua\nOpsi ketiga"} /><p className="mt-1 text-xs text-muted-foreground">Minimal dua opsi. Indeks jawaban dimulai dari 0.</p></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><Label htmlFor="native-quiz-correct">Indeks jawaban benar</Label><Input id="native-quiz-correct" type="number" min="0" value={form.correct_option} onChange={(event) => setForm((current) => ({ ...current, correct_option: event.target.value }))} /></div>
              <div><Label htmlFor="native-quiz-points">Poin</Label><Input id="native-quiz-points" type="number" min="1" value={form.points} onChange={(event) => setForm((current) => ({ ...current, points: event.target.value }))} /></div>
              <div><Label htmlFor="native-quiz-order">Urutan</Label><Input id="native-quiz-order" type="number" min="0" value={form.sort_order} onChange={(event) => setForm((current) => ({ ...current, sort_order: event.target.value }))} /></div>
            </div>
            <div><Label htmlFor="native-quiz-explanation">Penjelasan jawaban</Label><Textarea id="native-quiz-explanation" value={form.explanation_markdown} onChange={(event) => setForm((current) => ({ ...current, explanation_markdown: event.target.value }))} rows={4} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Batal</Button><Button onClick={() => void saveQuestion()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan pertanyaan</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}