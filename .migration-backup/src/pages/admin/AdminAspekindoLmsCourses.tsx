import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Archive,
  ArrowDown,
  ArrowUp,
  BookOpen,
  CheckCircle2,
  Eye,
  FileText,
  Loader2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  UsersRound,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Json, Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";

type Course = Tables<"aspekindo_lms_courses">;
type Session = Tables<"aspekindo_lms_sessions">;
type Lesson = Tables<"aspekindo_lms_lessons">;
type Material = Tables<"aspekindo_lms_materials">;
type Enrollment = Tables<"aspekindo_lms_enrollments">;
type LessonProgress = Tables<"aspekindo_lms_lesson_progress">;
type CompletionRecord = Tables<"aspekindo_lms_completion_records">;
type QuizQuestion = Tables<"aspekindo_lms_quiz_questions">;
type QuizAnswerKey = Tables<"aspekindo_lms_quiz_answer_keys">;
type Profile = Pick<Tables<"profiles">, "user_id" | "full_name" | "company">;

type CourseForm = {
  title: string;
  slug: string;
  description_markdown: string;
  audience: string;
  status: string;
  member_only: boolean;
};

type SessionForm = {
  title: string;
  description_markdown: string;
  delivery_mode: string;
  source_type: string;
  source_name: string;
  source_url: string;
  status: string;
  starts_at: string;
  ends_at: string;
  sort_order: string;
};

type LessonForm = {
  title: string;
  slug: string;
  content_markdown: string;
  passing_score: string;
  is_published: boolean;
  session_id: string;
  sort_order: string;
};

type MaterialForm = {
  title: string;
  material_type: string;
  content_markdown: string;
  external_url: string;
  is_published: boolean;
  sort_order: string;
};

type QuestionForm = {
  question_text: string;
  options: string[];
  correct_option: string;
  explanation_markdown: string;
  points: string;
  sort_order: string;
};

const EMPTY_COURSE: CourseForm = {
  title: "",
  slug: "",
  description_markdown: "",
  audience: "",
  status: "draft",
  member_only: true,
};

const EMPTY_SESSION: SessionForm = {
  title: "",
  description_markdown: "",
  delivery_mode: "internal",
  source_type: "native",
  source_name: "PUB ASPEKINDO",
  source_url: "",
  status: "draft",
  starts_at: "",
  ends_at: "",
  sort_order: "0",
};

const EMPTY_LESSON: LessonForm = {
  title: "",
  slug: "",
  content_markdown: "",
  passing_score: "70",
  is_published: false,
  session_id: "__none",
  sort_order: "0",
};

const EMPTY_MATERIAL: MaterialForm = {
  title: "",
  material_type: "markdown",
  content_markdown: "",
  external_url: "",
  is_published: false,
  sort_order: "0",
};

const EMPTY_QUESTION: QuestionForm = {
  question_text: "",
  options: ["", "", "", ""],
  correct_option: "0",
  explanation_markdown: "",
  points: "1",
  sort_order: "0",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  published: "Terbit",
  archived: "Diarsipkan",
};

const DELIVERY_LABELS: Record<string, string> = {
  internal: "Internal PUB",
  external: "Eksternal",
  hybrid: "Hybrid",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function isHttpsUrl(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDate(value: string | null) {
  if (!value) return "Belum ditentukan";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

function jsonStringArray(value: Json) {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : [];
}

function statusBadge(status: string) {
  const style = status === "published"
    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
    : status === "archived"
      ? "border-slate-300 bg-slate-100 text-slate-600"
      : "border-amber-300 bg-amber-50 text-amber-700";
  return <Badge variant="outline" className={style}>{STATUS_LABELS[status] ?? status}</Badge>;
}

function reorder<T extends { id: string; sort_order: number }>(items: T[], id: string, direction: -1 | 1) {
  const index = items.findIndex((item) => item.id === id);
  const nextIndex = index + direction;
  if (index < 0 || nextIndex < 0 || nextIndex >= items.length) return null;
  return { current: items[index], adjacent: items[nextIndex] };
}

export default function AdminAspekindoLmsCourses() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [sessions, setSessions] = useState<Session[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [progress, setProgress] = useState<LessonProgress[]>([]);
  const [completionRecords, setCompletionRecords] = useState<CompletionRecord[]>([]);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizAnswerKeys, setQuizAnswerKeys] = useState<QuizAnswerKey[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [contentLoading, setContentLoading] = useState(false);
  const [operationsLoading, setOperationsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [courseDialogOpen, setCourseDialogOpen] = useState(false);
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [lessonDialogOpen, setLessonDialogOpen] = useState(false);
  const [materialDialogOpen, setMaterialDialogOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [quizDialogOpen, setQuizDialogOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [editingQuestion, setEditingQuestion] = useState<QuizQuestion | null>(null);
  const [quizLesson, setQuizLesson] = useState<Lesson | null>(null);
  const [courseForm, setCourseForm] = useState<CourseForm>(EMPTY_COURSE);
  const [sessionForm, setSessionForm] = useState<SessionForm>(EMPTY_SESSION);
  const [lessonForm, setLessonForm] = useState<LessonForm>(EMPTY_LESSON);
  const [materialForm, setMaterialForm] = useState<MaterialForm>(EMPTY_MATERIAL);
  const [questionForm, setQuestionForm] = useState<QuestionForm>(EMPTY_QUESTION);
  const [saving, setSaving] = useState(false);
  const [participantSearch, setParticipantSearch] = useState("");

  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? null;
  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.user_id, profile])), [profiles]);
  const courseMap = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
  const lessonCountByCourse = useMemo(
    () => lessons.reduce<Record<string, number>>((counts, lesson) => {
      counts[lesson.course_id] = (counts[lesson.course_id] ?? 0) + 1;
      return counts;
    }, {}),
    [lessons],
  );
  const progressByEnrollment = useMemo(() => progress.reduce<Record<string, number>>((counts, item) => {
    if (item.status === "completed") counts[item.enrollment_id] = (counts[item.enrollment_id] ?? 0) + 1;
    return counts;
  }, {}), [progress]);
  const filteredEnrollments = useMemo(() => {
    const query = participantSearch.trim().toLowerCase();
    if (!query) return enrollments;
    return enrollments.filter((enrollment) => {
      const profile = profileMap.get(enrollment.user_id);
      const course = courseMap.get(enrollment.course_id);
      return [profile?.full_name, profile?.company, course?.title, enrollment.status]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });
  }, [courseMap, enrollments, participantSearch, profileMap]);

  const loadCourses = useCallback(async () => {
    setLoadError(null);
    const { data, error } = await supabase
      .from("aspekindo_lms_courses")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) {
      setLoadError(error.message);
      setCourses([]);
      setLoading(false);
      return;
    }
    const nextCourses = data ?? [];
    setCourses(nextCourses);
    setSelectedCourseId((current) => current && nextCourses.some((course) => course.id === current)
      ? current
      : nextCourses[0]?.id ?? "");
    setLoading(false);
  }, []);

  const loadCourseContent = useCallback(async (courseId: string) => {
    if (!courseId) {
      setSessions([]);
      setLessons([]);
      setMaterials([]);
      setQuizQuestions([]);
      setQuizAnswerKeys([]);
      return;
    }
    setContentLoading(true);
    const [sessionResult, lessonResult] = await Promise.all([
      supabase.from("aspekindo_lms_sessions").select("*").eq("course_id", courseId).order("sort_order"),
      supabase.from("aspekindo_lms_lessons").select("*").eq("course_id", courseId).order("sort_order"),
    ]);
    const lessonRows = lessonResult.data ?? [];
    const materialResult = lessonRows.length
      ? await supabase.from("aspekindo_lms_materials").select("*").in("lesson_id", lessonRows.map((lesson) => lesson.id)).order("sort_order")
      : { data: [], error: null };
    const questionResult = lessonRows.length
      ? await supabase.from("aspekindo_lms_quiz_questions").select("*").in("lesson_id", lessonRows.map((lesson) => lesson.id)).order("sort_order")
      : { data: [], error: null };
    const questionRows = questionResult.data ?? [];
    const answerKeyResult = questionRows.length
      ? await supabase.from("aspekindo_lms_quiz_answer_keys").select("*").in("question_id", questionRows.map((question) => question.id))
      : { data: [], error: null };
    const firstError = sessionResult.error ?? lessonResult.error ?? materialResult.error ?? questionResult.error ?? answerKeyResult.error;
    if (firstError) toast({ title: "Konten kursus belum dapat dimuat", description: firstError.message, variant: "destructive" });
    setSessions(sessionResult.data ?? []);
    setLessons(lessonRows);
    setMaterials(materialResult.data ?? []);
    setQuizQuestions(questionRows);
    setQuizAnswerKeys(answerKeyResult.data ?? []);
    setContentLoading(false);
  }, [toast]);

  const loadOperations = useCallback(async () => {
    setOperationsLoading(true);
    const [enrollmentResult, progressResult, recordResult, profileResult] = await Promise.all([
      supabase.from("aspekindo_lms_enrollments").select("*").order("enrolled_at", { ascending: false }),
      supabase.from("aspekindo_lms_lesson_progress").select("*").order("updated_at", { ascending: false }),
      supabase.from("aspekindo_lms_completion_records").select("*").order("issued_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name, company"),
    ]);
    const firstError = enrollmentResult.error ?? progressResult.error ?? recordResult.error ?? profileResult.error;
    if (firstError) toast({ title: "Data peserta belum lengkap", description: firstError.message, variant: "destructive" });
    setEnrollments(enrollmentResult.data ?? []);
    setProgress(progressResult.data ?? []);
    setCompletionRecords(recordResult.data ?? []);
    setProfiles(profileResult.data ?? []);
    setOperationsLoading(false);
  }, [toast]);

  useEffect(() => { void loadCourses(); void loadOperations(); }, [loadCourses, loadOperations]);
  useEffect(() => { void loadCourseContent(selectedCourseId); }, [loadCourseContent, selectedCourseId]);

  const openCreateCourse = () => {
    setEditingCourse(null);
    setCourseForm(EMPTY_COURSE);
    setCourseDialogOpen(true);
  };

  const openEditCourse = (course: Course) => {
    setEditingCourse(course);
    setCourseForm({
      title: course.title,
      slug: course.slug,
      description_markdown: course.description_markdown,
      audience: course.audience,
      status: course.status,
      member_only: course.member_only,
    });
    setCourseDialogOpen(true);
  };

  const saveCourse = async () => {
    const slug = slugify(courseForm.slug || courseForm.title);
    if (!courseForm.title.trim() || !slug || !courseForm.description_markdown.trim() || !courseForm.audience.trim()) {
      toast({ title: "Lengkapi data kursus", description: "Judul, slug, deskripsi, dan sasaran peserta wajib diisi.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      title: courseForm.title.trim(),
      slug,
      description_markdown: courseForm.description_markdown.trim(),
      audience: courseForm.audience.trim(),
      status: courseForm.status,
      member_only: courseForm.member_only,
      ...(courseForm.status === "published" ? { published_at: editingCourse?.published_at ?? new Date().toISOString() } : { published_at: null }),
    };
    const result = editingCourse
      ? await supabase.from("aspekindo_lms_courses").update(payload).eq("id", editingCourse.id)
      : await supabase.from("aspekindo_lms_courses").insert({ ...payload, created_by: user?.id });
    setSaving(false);
    if (result.error) {
      toast({ title: "Kursus gagal disimpan", description: result.error.message, variant: "destructive" });
      return;
    }
    setCourseDialogOpen(false);
    toast({ title: editingCourse ? "Kursus diperbarui" : "Kursus ditambahkan" });
    await loadCourses();
  };

  const changeCourseStatus = async (course: Course, status: string) => {
    const { error } = await supabase.from("aspekindo_lms_courses").update({
      status,
      published_at: status === "published" ? course.published_at ?? new Date().toISOString() : null,
    }).eq("id", course.id);
    if (error) {
      toast({ title: "Status kursus gagal diubah", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: `Kursus ${STATUS_LABELS[status].toLowerCase()}` });
    await loadCourses();
  };

  const openCreateSession = () => {
    if (!selectedCourseId) return;
    setEditingSession(null);
    setSessionForm({ ...EMPTY_SESSION, sort_order: String(sessions.length) });
    setSessionDialogOpen(true);
  };

  const openEditSession = (session: Session) => {
    setEditingSession(session);
    setSessionForm({
      title: session.title,
      description_markdown: session.description_markdown,
      delivery_mode: session.delivery_mode,
      source_type: session.source_type,
      source_name: session.source_name,
      source_url: session.source_url,
      status: session.status,
      starts_at: toLocalDateTime(session.starts_at),
      ends_at: toLocalDateTime(session.ends_at),
      sort_order: String(session.sort_order),
    });
    setSessionDialogOpen(true);
  };

  const saveSession = async () => {
    const sourceUrl = sessionForm.source_url.trim();
    if (!selectedCourseId || !sessionForm.title.trim() || !sessionForm.source_name.trim()) {
      toast({ title: "Lengkapi data sesi", description: "Judul dan sumber sesi wajib diisi.", variant: "destructive" });
      return;
    }
    if (sourceUrl && !isHttpsUrl(sourceUrl)) {
      toast({ title: "Tautan sumber tidak aman", description: "Gunakan alamat lengkap yang diawali https://.", variant: "destructive" });
      return;
    }
    if (sessionForm.delivery_mode !== "internal" && sessionForm.source_type !== "external") {
      toast({ title: "Sumber eksternal belum dipilih", description: "Sesi eksternal atau hybrid harus memakai sumber eksternal.", variant: "destructive" });
      return;
    }
    if (sessionForm.starts_at && sessionForm.ends_at && new Date(sessionForm.ends_at) < new Date(sessionForm.starts_at)) {
      toast({ title: "Jadwal sesi tidak valid", description: "Waktu selesai tidak boleh mendahului waktu mulai.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      course_id: selectedCourseId,
      title: sessionForm.title.trim(),
      description_markdown: sessionForm.description_markdown.trim(),
      delivery_mode: sessionForm.delivery_mode,
      source_type: sessionForm.source_type,
      source_name: sessionForm.source_name.trim(),
      source_url: sourceUrl,
      status: sessionForm.status,
      starts_at: sessionForm.starts_at ? new Date(sessionForm.starts_at).toISOString() : null,
      ends_at: sessionForm.ends_at ? new Date(sessionForm.ends_at).toISOString() : null,
      sort_order: Math.max(0, Number(sessionForm.sort_order) || 0),
      created_by: user?.id,
    };
    const result = editingSession
      ? await supabase.from("aspekindo_lms_sessions").update(payload).eq("id", editingSession.id)
      : await supabase.from("aspekindo_lms_sessions").insert(payload);
    setSaving(false);
    if (result.error) {
      toast({ title: "Sesi gagal disimpan", description: result.error.message, variant: "destructive" });
      return;
    }
    setSessionDialogOpen(false);
    toast({ title: editingSession ? "Sesi diperbarui" : "Sesi ditambahkan" });
    await loadCourseContent(selectedCourseId);
  };

  const changeSessionStatus = async (session: Session, status: string) => {
    const { error } = await supabase.from("aspekindo_lms_sessions").update({ status }).eq("id", session.id);
    if (error) {
      toast({ title: "Status sesi gagal diubah", description: error.message, variant: "destructive" });
      return;
    }
    await loadCourseContent(selectedCourseId);
  };

  const moveSession = async (session: Session, direction: -1 | 1) => {
    const pair = reorder(sessions, session.id, direction);
    if (!pair) return;
    const temporary = 1000000;
    const first = await supabase.from("aspekindo_lms_sessions").update({ sort_order: temporary }).eq("id", pair.current.id);
    if (first.error) {
      toast({ title: "Urutan sesi gagal diubah", description: first.error.message, variant: "destructive" });
      return;
    }
    const second = await supabase.from("aspekindo_lms_sessions").update({ sort_order: pair.adjacent.sort_order }).eq("id", pair.adjacent.id);
    const third = second.error ? second : await supabase.from("aspekindo_lms_sessions").update({ sort_order: pair.current.sort_order }).eq("id", pair.current.id);
    if (second.error) {
      await supabase.from("aspekindo_lms_sessions").update({ sort_order: pair.current.sort_order }).eq("id", pair.current.id);
    } else if (third.error) {
      await supabase.from("aspekindo_lms_sessions").update({ sort_order: temporary + 1 }).eq("id", pair.adjacent.id);
      await supabase.from("aspekindo_lms_sessions").update({ sort_order: pair.current.sort_order }).eq("id", pair.current.id);
      await supabase.from("aspekindo_lms_sessions").update({ sort_order: pair.adjacent.sort_order }).eq("id", pair.adjacent.id);
    }
    if (second.error || third.error) toast({ title: "Urutan sesi gagal disimpan", description: (second.error ?? third.error)?.message, variant: "destructive" });
    await loadCourseContent(selectedCourseId);
  };

  const openCreateLesson = () => {
    if (!selectedCourseId) return;
    setEditingLesson(null);
    setLessonForm({ ...EMPTY_LESSON, sort_order: String(lessons.length) });
    setLessonDialogOpen(true);
  };

  const openEditLesson = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setLessonForm({
      title: lesson.title,
      slug: lesson.slug,
      content_markdown: lesson.content_markdown,
      passing_score: String(lesson.passing_score),
      is_published: lesson.is_published,
      session_id: lesson.session_id ?? "__none",
      sort_order: String(lesson.sort_order),
    });
    setLessonDialogOpen(true);
  };

  const saveLesson = async () => {
    const slug = slugify(lessonForm.slug || lessonForm.title);
    const passingScore = Number(lessonForm.passing_score);
    if (!selectedCourseId || !lessonForm.title.trim() || !slug || !lessonForm.content_markdown.trim()) {
      toast({ title: "Lengkapi data pelajaran", description: "Judul, slug, dan materi pelajaran wajib diisi.", variant: "destructive" });
      return;
    }
    if (!Number.isInteger(passingScore) || passingScore < 0 || passingScore > 100) {
      toast({ title: "Nilai kelulusan tidak valid", description: "Isi angka antara 0 sampai 100.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      course_id: selectedCourseId,
      title: lessonForm.title.trim(),
      slug,
      content_markdown: lessonForm.content_markdown.trim(),
      passing_score: passingScore,
      is_published: lessonForm.is_published,
      session_id: lessonForm.session_id === "__none" ? null : lessonForm.session_id,
      sort_order: Math.max(0, Number(lessonForm.sort_order) || 0),
      created_by: user?.id,
    };
    const result = editingLesson
      ? await supabase.from("aspekindo_lms_lessons").update(payload).eq("id", editingLesson.id)
      : await supabase.from("aspekindo_lms_lessons").insert(payload);
    setSaving(false);
    if (result.error) {
      toast({ title: "Pelajaran gagal disimpan", description: result.error.message, variant: "destructive" });
      return;
    }
    setLessonDialogOpen(false);
    toast({ title: editingLesson ? "Pelajaran diperbarui" : "Pelajaran ditambahkan" });
    await loadCourseContent(selectedCourseId);
  };

  const moveLesson = async (lesson: Lesson, direction: -1 | 1) => {
    const pair = reorder(lessons, lesson.id, direction);
    if (!pair) return;
    const first = await supabase.from("aspekindo_lms_lessons").update({ sort_order: 1000000 }).eq("id", pair.current.id);
    if (first.error) {
      toast({ title: "Urutan pelajaran gagal diubah", description: first.error.message, variant: "destructive" });
      return;
    }
    const second = await supabase.from("aspekindo_lms_lessons").update({ sort_order: pair.adjacent.sort_order }).eq("id", pair.adjacent.id);
    const third = second.error ? second : await supabase.from("aspekindo_lms_lessons").update({ sort_order: pair.current.sort_order }).eq("id", pair.current.id);
    if (second.error) {
      await supabase.from("aspekindo_lms_lessons").update({ sort_order: pair.current.sort_order }).eq("id", pair.current.id);
    } else if (third.error) {
      await supabase.from("aspekindo_lms_lessons").update({ sort_order: 1000001 }).eq("id", pair.adjacent.id);
      await supabase.from("aspekindo_lms_lessons").update({ sort_order: pair.current.sort_order }).eq("id", pair.current.id);
      await supabase.from("aspekindo_lms_lessons").update({ sort_order: pair.adjacent.sort_order }).eq("id", pair.adjacent.id);
    }
    if (second.error || third.error) toast({ title: "Urutan pelajaran gagal disimpan", description: (second.error ?? third.error)?.message, variant: "destructive" });
    await loadCourseContent(selectedCourseId);
  };

  const openCreateMaterial = (lesson: Lesson) => {
    setEditingMaterial(null);
    setLessonForm((current) => ({ ...current, session_id: lesson.id }));
    setMaterialForm({ ...EMPTY_MATERIAL, sort_order: String(materials.filter((item) => item.lesson_id === lesson.id).length) });
    setMaterialDialogOpen(true);
  };

  const openEditMaterial = (material: Material) => {
    setEditingMaterial(material);
    setLessonForm((current) => ({ ...current, session_id: material.lesson_id }));
    setMaterialForm({
      title: material.title,
      material_type: material.material_type,
      content_markdown: material.content_markdown,
      external_url: material.external_url,
      is_published: material.is_published,
      sort_order: String(material.sort_order),
    });
    setMaterialDialogOpen(true);
  };

  const saveMaterial = async () => {
    const lessonId = lessonForm.session_id;
    if (!lessonId || lessonId === "__none" || !materialForm.title.trim()) {
      toast({ title: "Lengkapi data materi", description: "Judul dan pelajaran wajib dipilih.", variant: "destructive" });
      return;
    }
    if (materialForm.material_type === "markdown" && !materialForm.content_markdown.trim()) {
      toast({ title: "Isi materi wajib diisi", variant: "destructive" });
      return;
    }
    if (materialForm.material_type === "link" && !isHttpsUrl(materialForm.external_url.trim())) {
      toast({ title: "Tautan materi tidak aman", description: "Gunakan alamat lengkap yang diawali https://.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      lesson_id: lessonId,
      title: materialForm.title.trim(),
      material_type: materialForm.material_type,
      content_markdown: materialForm.material_type === "markdown" ? materialForm.content_markdown.trim() : "",
      external_url: materialForm.material_type === "link" ? materialForm.external_url.trim() : "",
      is_published: materialForm.is_published,
      sort_order: Math.max(0, Number(materialForm.sort_order) || 0),
      created_by: user?.id,
    };
    const result = editingMaterial
      ? await supabase.from("aspekindo_lms_materials").update(payload).eq("id", editingMaterial.id)
      : await supabase.from("aspekindo_lms_materials").insert(payload);
    setSaving(false);
    if (result.error) {
      toast({ title: "Materi gagal disimpan", description: result.error.message, variant: "destructive" });
      return;
    }
    setMaterialDialogOpen(false);
    toast({ title: editingMaterial ? "Materi diperbarui" : "Materi ditambahkan" });
    await loadCourseContent(selectedCourseId);
  };

  const deleteMaterial = async (material: Material) => {
    const { error } = await supabase.from("aspekindo_lms_materials").delete().eq("id", material.id);
    if (error) {
      toast({ title: "Materi gagal dihapus", description: error.message, variant: "destructive" });
      return;
    }
    await loadCourseContent(selectedCourseId);
  };

  const openQuizDialog = (lesson: Lesson) => {
    setQuizLesson(lesson);
    setEditingQuestion(null);
    setQuestionForm({
      ...EMPTY_QUESTION,
      sort_order: String(quizQuestions.filter((question) => question.lesson_id === lesson.id).length),
    });
    setQuizDialogOpen(true);
  };

  const editQuestion = (question: QuizQuestion) => {
    const answerKey = quizAnswerKeys.find((key) => key.question_id === question.id);
    const options = jsonStringArray(question.options);
    setEditingQuestion(question);
    setQuestionForm({
      question_text: question.question_text,
      options: options.length >= 2 ? options : ["", "", "", ""],
      correct_option: String(answerKey?.correct_option ?? 0),
      explanation_markdown: answerKey?.explanation_markdown ?? "",
      points: String(question.points),
      sort_order: String(question.sort_order),
    });
  };

  const resetQuestionForm = () => {
    setEditingQuestion(null);
    setQuestionForm({
      ...EMPTY_QUESTION,
      sort_order: String(quizQuestions.filter((question) => question.lesson_id === quizLesson?.id).length),
    });
  };

  const saveQuestion = async () => {
    if (!quizLesson || !questionForm.question_text.trim()) {
      toast({ title: "Pertanyaan wajib diisi", variant: "destructive" });
      return;
    }
    const selectedUiIndex = Number(questionForm.correct_option);
    const normalizedOptions = questionForm.options.map((option, index) => ({
      value: option.trim(),
      isCorrect: index === selectedUiIndex,
    })).filter((option) => option.value);
    const options = normalizedOptions.map((option) => option.value);
    const correctOption = normalizedOptions.findIndex((option) => option.isCorrect);
    if (options.length < 2 || correctOption < 0) {
      toast({ title: "Opsi kuis belum valid", description: "Isi sedikitnya dua opsi dan pilih jawaban yang benar.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const questionResult = await supabase.rpc("save_aspekindo_lms_quiz_question", {
      _question_id: editingQuestion?.id ?? null,
      _lesson_id: quizLesson.id,
      _question_text: questionForm.question_text.trim(),
      _options: options,
      _correct_option: correctOption,
      _explanation_markdown: questionForm.explanation_markdown.trim(),
      _points: Math.max(1, Number(questionForm.points) || 1),
      _sort_order: Math.max(0, Number(questionForm.sort_order) || 0),
    });
    if (questionResult.error) {
      setSaving(false);
      toast({ title: "Soal kuis gagal disimpan", description: questionResult.error.message, variant: "destructive" });
      return;
    }
    setSaving(false);
    toast({ title: editingQuestion ? "Soal kuis diperbarui" : "Soal kuis ditambahkan" });
    resetQuestionForm();
    await loadCourseContent(selectedCourseId);
  };

  const deleteQuestion = async (question: QuizQuestion) => {
    const { error } = await supabase.from("aspekindo_lms_quiz_questions").delete().eq("id", question.id);
    if (error) {
      toast({ title: "Soal kuis gagal dihapus", description: error.message, variant: "destructive" });
      return;
    }
    if (editingQuestion?.id === question.id) resetQuestionForm();
    await loadCourseContent(selectedCourseId);
  };

  const updateRecordStatus = async (record: CompletionRecord, status: string) => {
    const payload = status === "exported"
      ? { status, export_batch_id: `PUB-LMS-${new Date().toISOString().slice(0, 10)}`, exported_at: new Date().toISOString() }
      : { status, export_batch_id: null, exported_at: null };
    const { error } = await supabase.from("aspekindo_lms_completion_records").update(payload).eq("id", record.id);
    if (error) {
      toast({ title: "Status evidence gagal diubah", description: error.message, variant: "destructive" });
      return;
    }
    setCompletionRecords((current) => current.map((item) => item.id === record.id ? { ...item, ...payload } : item));
  };

  const exportParticipants = () => {
    const headers = ["Nomor peserta", "Nama peserta", "Perusahaan", "Kursus", "Status", "Progres (%)", "Terdaftar", "Selesai"];
    const rows = filteredEnrollments.map((enrollment) => {
      const profile = profileMap.get(enrollment.user_id);
      const course = courseMap.get(enrollment.course_id);
      const total = lessonCountByCourse[enrollment.course_id] ?? 0;
      const completed = progressByEnrollment[enrollment.id] ?? 0;
      const percent = total ? Math.round((completed / total) * 100) : 0;
      return [
        enrollment.user_id,
        profile?.full_name ?? "-",
        profile?.company ?? "-",
        course?.title ?? "-",
        enrollment.status,
        percent,
        formatDate(enrollment.enrolled_at),
        formatDate(enrollment.completed_at),
      ];
    });
    const csv = [headers, ...rows].map((row) => row.map((value) => csvCell(value)).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `rekap-peserta-lms-aspekindo-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="flex justify-center py-20 text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin" /> Memuat authoring LMS...</div>;
  }

  if (loadError) {
    return <Card><CardContent className="flex flex-col items-center gap-3 py-16 text-center"><FileText className="h-9 w-9 text-destructive" /><p className="font-semibold">Katalog LMS belum dapat dimuat.</p><p className="text-sm text-muted-foreground">{loadError}</p><Button variant="outline" onClick={() => void loadCourses()}>Coba lagi</Button></CardContent></Card>;
  }

  return (
    <div className="min-w-0 space-y-6 overflow-hidden">
      <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-pub-sky">Admin ASPEKINDO</p>
          <h1 className="mt-2 flex items-center gap-2 text-2xl font-bold font-heading"><BookOpen className="h-6 w-6 text-pub-sky" /> Authoring & operasi LMS</h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">Terbitkan kursus internal, susun sesi dan pelajaran, lalu tinjau progres peserta untuk persiapan rekap LKUT.</p>
        </div>
        <Button onClick={openCreateCourse}><Plus className="mr-2 h-4 w-4" /> Tambah kursus</Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        {(["published", "draft", "archived"] as const).map((status) => (
          <Card key={status}><CardContent className="p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">{STATUS_LABELS[status]}</p><p className="mt-1 text-2xl font-bold">{courses.filter((course) => course.status === status).length}</p></CardContent></Card>
        ))}
      </div>

      <Tabs defaultValue="authoring" className="min-w-0">
        <TabsList className="grid h-auto w-full grid-cols-2">
          <TabsTrigger value="authoring" className="gap-2 py-2.5"><BookOpen className="h-4 w-4" /> Kursus & materi</TabsTrigger>
          <TabsTrigger value="participants" className="gap-2 py-2.5"><UsersRound className="h-4 w-4" /> Peserta & evidence</TabsTrigger>
        </TabsList>

        <TabsContent value="authoring" className="mt-5 grid gap-5 lg:grid-cols-[minmax(260px,0.75fr),minmax(0,1.55fr)]">
          <Card>
            <CardHeader><CardTitle className="text-base">Katalog authoring</CardTitle><CardDescription>Draft dan arsip hanya terlihat oleh admin.</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {courses.length === 0 ? <div className="rounded-lg border border-dashed p-7 text-center text-sm text-muted-foreground">Belum ada kursus native. Tambahkan kursus untuk mulai authoring.</div> : courses.map((course) => (
                <button key={course.id} type="button" onClick={() => setSelectedCourseId(course.id)} className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedCourseId === course.id ? "border-pub-sky bg-pub-sky/10" : "hover:bg-muted/50"}`}>
                  <div className="flex items-start justify-between gap-2"><span className="font-semibold">{course.title}</span>{statusBadge(course.status)}</div>
                  <p className="mt-1 text-xs text-muted-foreground">{course.course_code}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{course.member_only ? "Khusus anggota" : "Terbuka untuk pengunjung terdaftar"}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-5">
            {!selectedCourse ? (
              <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Pilih kursus untuk mengelola sesi dan pelajaran.</CardContent></Card>
            ) : (
              <>
                <Card>
                  <CardHeader className="gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div><div className="flex flex-wrap items-center gap-2">{statusBadge(selectedCourse.status)}<Badge variant="outline">{selectedCourse.course_code}</Badge></div><CardTitle className="mt-3">{selectedCourse.title}</CardTitle><CardDescription className="mt-1">{selectedCourse.audience}</CardDescription></div>
                    <div className="flex shrink-0 gap-2"><Button variant="outline" size="sm" onClick={() => setPreviewOpen(true)}><Eye className="mr-1.5 h-4 w-4" /> Preview</Button><Button variant="outline" size="sm" onClick={() => openEditCourse(selectedCourse)}><Pencil className="mr-1.5 h-4 w-4" /> Edit</Button></div>
                  </CardHeader>
                  <CardContent className="flex flex-wrap items-center justify-between gap-3 border-t pt-4">
                    <p className="text-sm text-muted-foreground">{sessions.length} sesi · {lessons.length} pelajaran · {materials.length} materi</p>
                    <Button size="sm" variant="ghost" onClick={() => void changeCourseStatus(selectedCourse, selectedCourse.status === "published" ? "archived" : "published")}>{selectedCourse.status === "published" ? <><Archive className="mr-1.5 h-4 w-4" /> Arsipkan</> : <><RotateCcw className="mr-1.5 h-4 w-4" /> Terbitkan</>}</Button>
                  </CardContent>
                </Card>

                {contentLoading ? <div className="flex justify-center py-8 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat konten...</div> : (
                  <>
                    <Card>
                      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-base">Sesi pembelajaran</CardTitle><CardDescription>Atur jalur internal, eksternal, atau hybrid tanpa klaim SSO.</CardDescription></div><Button size="sm" onClick={openCreateSession}><Plus className="mr-1.5 h-4 w-4" /> Tambah sesi</Button></CardHeader>
                      <CardContent className="space-y-3">
                        {sessions.length === 0 ? <div className="rounded-lg border border-dashed p-7 text-center text-sm text-muted-foreground">Belum ada sesi pada kursus ini.</div> : sessions.map((session, index) => (
                          <div key={session.id} className="rounded-xl border p-4">
                            <div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{session.title}</p>{statusBadge(session.status)}<Badge variant="outline">{DELIVERY_LABELS[session.delivery_mode] ?? session.delivery_mode}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{session.source_name} · urutan {session.sort_order}</p>{session.starts_at && <p className="mt-1 text-xs text-muted-foreground">{formatDate(session.starts_at)}{session.ends_at ? ` — ${formatDate(session.ends_at)}` : ""}</p>}</div><div className="flex shrink-0 gap-1"><Button size="icon" variant="ghost" aria-label={`Naikkan sesi ${session.title}`} disabled={index === 0} onClick={() => void moveSession(session, -1)}><ArrowUp className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label={`Turunkan sesi ${session.title}`} disabled={index === sessions.length - 1} onClick={() => void moveSession(session, 1)}><ArrowDown className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label={`Edit sesi ${session.title}`} onClick={() => openEditSession(session)}><Pencil className="h-4 w-4" /></Button></div></div>
                            <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void changeSessionStatus(session, session.status === "published" ? "archived" : "published")}>{session.status === "published" ? "Arsipkan sesi" : "Terbitkan sesi"}</Button></div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="text-base">Pelajaran & materi</CardTitle><CardDescription>Pelajaran terbit tampil berurutan kepada peserta terdaftar.</CardDescription></div><Button size="sm" onClick={openCreateLesson}><Plus className="mr-1.5 h-4 w-4" /> Tambah pelajaran</Button></CardHeader>
                      <CardContent className="space-y-3">
                        {lessons.length === 0 ? <div className="rounded-lg border border-dashed p-7 text-center text-sm text-muted-foreground">Belum ada pelajaran. Tambahkan materi utama sebelum menerbitkan kursus.</div> : lessons.map((lesson, index) => {
                          const lessonMaterials = materials.filter((material) => material.lesson_id === lesson.id);
                          return <div key={lesson.id} className="rounded-xl border p-4">
                            <div className="flex items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><p className="font-semibold">{lesson.title}</p><Badge variant="outline" className={lesson.is_published ? "border-emerald-300 bg-emerald-50 text-emerald-700" : ""}>{lesson.is_published ? "Terbit" : "Draft"}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Urutan {lesson.sort_order} · Nilai lulus {lesson.passing_score} · {lessonMaterials.length} materi pendukung</p></div><div className="flex shrink-0 gap-1"><Button size="icon" variant="ghost" aria-label={`Naikkan pelajaran ${lesson.title}`} disabled={index === 0} onClick={() => void moveLesson(lesson, -1)}><ArrowUp className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label={`Turunkan pelajaran ${lesson.title}`} disabled={index === lessons.length - 1} onClick={() => void moveLesson(lesson, 1)}><ArrowDown className="h-4 w-4" /></Button><Button size="icon" variant="ghost" aria-label={`Edit pelajaran ${lesson.title}`} onClick={() => openEditLesson(lesson)}><Pencil className="h-4 w-4" /></Button></div></div>
                            <div className="mt-3 space-y-2 border-t pt-3">{lessonMaterials.map((material) => <div key={material.id} className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-3 py-2 text-sm"><span className="min-w-0 truncate">{material.title} <span className="text-xs text-muted-foreground">({material.material_type})</span></span><span className="flex shrink-0 gap-1"><Button size="icon" variant="ghost" aria-label={`Edit materi ${material.title}`} onClick={() => openEditMaterial(material)}><Pencil className="h-3.5 w-3.5" /></Button><Button size="icon" variant="ghost" className="text-destructive" aria-label={`Hapus materi ${material.title}`} onClick={() => void deleteMaterial(material)}><Trash2 className="h-3.5 w-3.5" /></Button></span></div>)}<div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => openCreateMaterial(lesson)}><Plus className="mr-1.5 h-3.5 w-3.5" /> Tambah materi</Button><Button size="sm" variant="outline" onClick={() => openQuizDialog(lesson)}>Kuis ({quizQuestions.filter((question) => question.lesson_id === lesson.id).length})</Button></div></div>
                          </div>;
                        })}
                      </CardContent>
                    </Card>
                  </>
                )}
              </>
            )}
          </div>
        </TabsContent>

        <TabsContent value="participants" className="min-w-0 mt-5 space-y-5">
          <Card className="min-w-0">
            <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between"><div><CardTitle className="flex items-center gap-2 text-base"><UsersRound className="h-5 w-5 text-pub-sky" /> Enrollment & progres peserta</CardTitle><CardDescription>Ringkasan operasional internal untuk persiapan LKUT; tidak membuka data ini ke route publik.</CardDescription></div><Button variant="outline" onClick={exportParticipants} disabled={filteredEnrollments.length === 0}>Export CSV</Button></CardHeader>
            <CardContent className="space-y-4">
              <Input placeholder="Cari nama, perusahaan, kursus, atau status..." value={participantSearch} onChange={(event) => setParticipantSearch(event.target.value)} aria-label="Cari peserta LMS" />
              {operationsLoading ? <div className="flex justify-center py-8 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Memuat peserta...</div> : filteredEnrollments.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada enrollment yang cocok.</div> : <div className="max-w-full overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="px-3 py-3">Peserta</th><th className="px-3 py-3">Kursus</th><th className="px-3 py-3">Progres</th><th className="px-3 py-3">Status</th><th className="px-3 py-3">Terdaftar</th></tr></thead><tbody>{filteredEnrollments.map((enrollment) => { const profile = profileMap.get(enrollment.user_id); const course = courseMap.get(enrollment.course_id); const total = lessonCountByCourse[enrollment.course_id] ?? 0; const completed = progressByEnrollment[enrollment.id] ?? 0; const percent = total ? Math.round((completed / total) * 100) : 0; return <tr key={enrollment.id} className="border-b last:border-0"><td className="px-3 py-3"><p className="font-medium">{profile?.full_name ?? "Peserta"}</p><p className="text-xs text-muted-foreground">{profile?.company ?? "Perusahaan belum diisi"}</p></td><td className="px-3 py-3">{course?.title ?? "-"}</td><td className="min-w-[150px] px-3 py-3"><div className="flex items-center gap-2"><Progress value={percent} className="h-2" /><span className="text-xs">{percent}%</span></div><p className="mt-1 text-xs text-muted-foreground">{completed}/{total} pelajaran</p></td><td className="px-3 py-3"><Badge variant="outline">{enrollment.status}</Badge></td><td className="px-3 py-3 text-xs text-muted-foreground">{formatDate(enrollment.enrolled_at)}</td></tr>; })}</tbody></table></div>}
            </CardContent>
          </Card>
          <Card className="min-w-0">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CheckCircle2 className="h-5 w-5 text-pub-emerald" /> Review completion record</CardTitle><CardDescription>Bukti penyelesaian yang dapat ditinjau sebelum dipakai dalam rekap persiapan LKUT resmi.</CardDescription></CardHeader>
            <CardContent className="max-w-full overflow-x-auto">
              {completionRecords.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada completion record.</div> : <table className="w-full text-sm"><thead><tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground"><th className="px-3 py-3">Bukti</th><th className="px-3 py-3">Peserta</th><th className="px-3 py-3">Diterbitkan</th><th className="px-3 py-3">Review</th></tr></thead><tbody>{completionRecords.map((record) => <tr key={record.id} className="border-b last:border-0"><td className="px-3 py-3"><p className="font-medium">{record.evidence_title}</p><p className="font-mono text-xs text-muted-foreground">{record.record_number}</p></td><td className="px-3 py-3">{profileMap.get(record.user_id)?.full_name ?? "Peserta"}</td><td className="px-3 py-3 text-xs text-muted-foreground">{formatDate(record.issued_at)}</td><td className="px-3 py-3"><Select value={record.status} onValueChange={(value) => void updateRecordStatus(record, value)}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="ready_for_review">Siap ditinjau</SelectItem><SelectItem value="exported">Sudah diekspor</SelectItem></SelectContent></Select></td></tr>)}</tbody></table>}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={courseDialogOpen} onOpenChange={setCourseDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{editingCourse ? "Ubah kursus native" : "Tambah kursus native ASPEKINDO"}</DialogTitle></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="native-course-title">Judul *</Label><Input id="native-course-title" value={courseForm.title} onChange={(event) => setCourseForm({ ...courseForm, title: event.target.value })} /></div><div><Label htmlFor="native-course-slug">Slug *</Label><Input id="native-course-slug" value={courseForm.slug} onChange={(event) => setCourseForm({ ...courseForm, slug: slugify(event.target.value) })} placeholder="persiapan-bujk" /></div></div><div><Label htmlFor="native-course-description">Deskripsi / tujuan *</Label><Textarea id="native-course-description" value={courseForm.description_markdown} onChange={(event) => setCourseForm({ ...courseForm, description_markdown: event.target.value })} rows={5} /></div><div><Label htmlFor="native-course-audience">Sasaran peserta *</Label><Input id="native-course-audience" value={courseForm.audience} onChange={(event) => setCourseForm({ ...courseForm, audience: event.target.value })} /></div><div className="grid gap-4 sm:grid-cols-2"><div><Label>Status</Label><Select value={courseForm.status} onValueChange={(value) => setCourseForm({ ...courseForm, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft — belum tampil</SelectItem><SelectItem value="published">Terbit — tampil di LMS</SelectItem><SelectItem value="archived">Diarsipkan — disembunyikan</SelectItem></SelectContent></Select></div><div className="flex items-end gap-3 pb-2"><Switch id="native-course-member-only" checked={courseForm.member_only} onCheckedChange={(checked) => setCourseForm({ ...courseForm, member_only: checked })} /><Label htmlFor="native-course-member-only">Khusus anggota aktif</Label></div></div></div><DialogFooter><Button variant="outline" onClick={() => setCourseDialogOpen(false)}>Batal</Button><Button onClick={() => void saveCourse()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan kursus</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={sessionDialogOpen} onOpenChange={setSessionDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{editingSession ? "Ubah sesi pembelajaran" : "Tambah sesi pembelajaran"}</DialogTitle></DialogHeader><div className="grid gap-4 py-2"><div><Label>Judul sesi *</Label><Input value={sessionForm.title} onChange={(event) => setSessionForm({ ...sessionForm, title: event.target.value })} /></div><div><Label>Deskripsi</Label><Textarea value={sessionForm.description_markdown} onChange={(event) => setSessionForm({ ...sessionForm, description_markdown: event.target.value })} /></div><div className="grid gap-4 sm:grid-cols-3"><div><Label>Delivery</Label><Select value={sessionForm.delivery_mode} onValueChange={(value) => setSessionForm({ ...sessionForm, delivery_mode: value, source_type: value === "internal" ? "native" : "external" })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="internal">Internal PUB</SelectItem><SelectItem value="external">Eksternal</SelectItem><SelectItem value="hybrid">Hybrid</SelectItem></SelectContent></Select></div><div><Label>Tipe sumber</Label><Select value={sessionForm.source_type} onValueChange={(value) => setSessionForm({ ...sessionForm, source_type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="native">LMS native</SelectItem><SelectItem value="external">Platform eksternal</SelectItem></SelectContent></Select></div><div><Label>Status</Label><Select value={sessionForm.status} onValueChange={(value) => setSessionForm({ ...sessionForm, status: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Terbit</SelectItem><SelectItem value="archived">Diarsipkan</SelectItem></SelectContent></Select></div></div><div className="grid gap-4 sm:grid-cols-2"><div><Label>Nama sumber *</Label><Input value={sessionForm.source_name} onChange={(event) => setSessionForm({ ...sessionForm, source_name: event.target.value })} /></div><div><Label>Tautan HTTPS</Label><Input type="url" placeholder="https://..." value={sessionForm.source_url} onChange={(event) => setSessionForm({ ...sessionForm, source_url: event.target.value })} /></div></div><div className="grid gap-4 sm:grid-cols-3"><div><Label>Mulai</Label><Input type="datetime-local" value={sessionForm.starts_at} onChange={(event) => setSessionForm({ ...sessionForm, starts_at: event.target.value })} /></div><div><Label>Selesai</Label><Input type="datetime-local" value={sessionForm.ends_at} min={sessionForm.starts_at || undefined} onChange={(event) => setSessionForm({ ...sessionForm, ends_at: event.target.value })} /></div><div><Label>Urutan</Label><Input type="number" min={0} value={sessionForm.sort_order} onChange={(event) => setSessionForm({ ...sessionForm, sort_order: event.target.value })} /></div></div></div><DialogFooter><Button variant="outline" onClick={() => setSessionDialogOpen(false)}>Batal</Button><Button onClick={() => void saveSession()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan sesi</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={lessonDialogOpen} onOpenChange={setLessonDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{editingLesson ? "Ubah pelajaran" : "Tambah pelajaran"}</DialogTitle></DialogHeader><div className="grid gap-4 py-2"><div className="grid gap-4 sm:grid-cols-2"><div><Label>Judul *</Label><Input value={lessonForm.title} onChange={(event) => setLessonForm({ ...lessonForm, title: event.target.value, slug: lessonForm.slug || slugify(event.target.value) })} /></div><div><Label>Slug *</Label><Input value={lessonForm.slug} onChange={(event) => setLessonForm({ ...lessonForm, slug: slugify(event.target.value) })} /></div></div><div><Label>Materi utama (Markdown) *</Label><Textarea value={lessonForm.content_markdown} onChange={(event) => setLessonForm({ ...lessonForm, content_markdown: event.target.value })} rows={12} className="font-mono text-xs" /></div><div className="grid gap-4 sm:grid-cols-3"><div><Label>Sesi</Label><Select value={lessonForm.session_id} onValueChange={(value) => setLessonForm({ ...lessonForm, session_id: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="__none">Tanpa sesi</SelectItem>{sessions.map((session) => <SelectItem key={session.id} value={session.id}>{session.title}</SelectItem>)}</SelectContent></Select></div><div><Label>Nilai lulus</Label><Input type="number" min={0} max={100} value={lessonForm.passing_score} onChange={(event) => setLessonForm({ ...lessonForm, passing_score: event.target.value })} /></div><div><Label>Urutan</Label><Input type="number" min={0} value={lessonForm.sort_order} onChange={(event) => setLessonForm({ ...lessonForm, sort_order: event.target.value })} /></div></div><div className="flex items-center gap-3"><Switch id="native-lesson-published" checked={lessonForm.is_published} onCheckedChange={(checked) => setLessonForm({ ...lessonForm, is_published: checked })} /><Label htmlFor="native-lesson-published">Terbitkan pelajaran</Label></div></div><DialogFooter><Button variant="outline" onClick={() => setLessonDialogOpen(false)}>Batal</Button><Button onClick={() => void saveLesson()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan pelajaran</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={materialDialogOpen} onOpenChange={setMaterialDialogOpen}>
        <DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{editingMaterial ? "Ubah materi pendukung" : "Tambah materi pendukung"}</DialogTitle></DialogHeader><div className="grid gap-4 py-2"><div><Label>Judul *</Label><Input value={materialForm.title} onChange={(event) => setMaterialForm({ ...materialForm, title: event.target.value })} /></div><div><Label>Format materi</Label><Select value={materialForm.material_type} onValueChange={(value) => setMaterialForm({ ...materialForm, material_type: value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="markdown">Teks Markdown</SelectItem><SelectItem value="link">Tautan HTTPS</SelectItem></SelectContent></Select></div>{materialForm.material_type === "markdown" ? <div><Label>Isi materi *</Label><Textarea value={materialForm.content_markdown} onChange={(event) => setMaterialForm({ ...materialForm, content_markdown: event.target.value })} rows={8} /></div> : <div><Label>Tautan HTTPS *</Label><Input type="url" placeholder="https://..." value={materialForm.external_url} onChange={(event) => setMaterialForm({ ...materialForm, external_url: event.target.value })} /></div>}<div className="grid gap-4 sm:grid-cols-2"><div><Label>Urutan</Label><Input type="number" min={0} value={materialForm.sort_order} onChange={(event) => setMaterialForm({ ...materialForm, sort_order: event.target.value })} /></div><div className="flex items-end gap-3 pb-2"><Switch id="native-material-published" checked={materialForm.is_published} onCheckedChange={(checked) => setMaterialForm({ ...materialForm, is_published: checked })} /><Label htmlFor="native-material-published">Terbitkan materi</Label></div></div></div><DialogFooter><Button variant="outline" onClick={() => setMaterialDialogOpen(false)}>Batal</Button><Button onClick={() => void saveMaterial()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan materi</Button></DialogFooter></DialogContent>
      </Dialog>

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Preview: {selectedCourse?.title}</DialogTitle></DialogHeader>{selectedCourse && <div className="space-y-5"><div className="rounded-xl bg-pub-navy p-5 text-white"><Badge variant="outline" className="border-white/30 text-white">{selectedCourse.course_code}</Badge><h2 className="mt-3 text-2xl font-bold">{selectedCourse.title}</h2><p className="mt-2 text-sm text-white/70">{selectedCourse.audience}</p></div><MarkdownRenderer>{selectedCourse.description_markdown}</MarkdownRenderer><div className="space-y-3"><h3 className="font-heading text-lg font-bold">Rangkaian pembelajaran</h3>{lessons.filter((lesson) => lesson.is_published).map((lesson, index) => <div key={lesson.id} className="rounded-xl border p-4"><p className="font-semibold">{index + 1}. {lesson.title}</p><p className="mt-1 text-xs text-muted-foreground">Nilai kelulusan {lesson.passing_score}</p></div>)}{lessons.filter((lesson) => lesson.is_published).length === 0 && <p className="text-sm text-muted-foreground">Belum ada pelajaran terbit.</p>}</div></div>}</DialogContent>
      </Dialog>

      <Dialog open={quizDialogOpen} onOpenChange={setQuizDialogOpen}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>Bank soal: {quizLesson?.title}</DialogTitle></DialogHeader>
          <div className="grid gap-5 lg:grid-cols-[0.9fr,1.1fr]">
            <div className="space-y-2">
              {quizQuestions.filter((question) => question.lesson_id === quizLesson?.id).length === 0 ? <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Belum ada soal kuis.</div> : quizQuestions.filter((question) => question.lesson_id === quizLesson?.id).map((question, index) => <div key={question.id} className="rounded-lg border p-3"><p className="text-sm font-semibold">{index + 1}. {question.question_text}</p><div className="mt-2 flex gap-1"><Button size="sm" variant="outline" onClick={() => editQuestion(question)}>Edit</Button><Button size="sm" variant="ghost" className="text-destructive" onClick={() => void deleteQuestion(question)}>Hapus</Button></div></div>)}
            </div>
            <div className="space-y-4 rounded-xl border p-4">
              <div className="flex items-center justify-between"><h3 className="font-semibold">{editingQuestion ? "Ubah soal" : "Tambah soal"}</h3>{editingQuestion && <Button size="sm" variant="ghost" onClick={resetQuestionForm}>Batal edit</Button>}</div>
              <div><Label>Pertanyaan *</Label><Textarea value={questionForm.question_text} onChange={(event) => setQuestionForm({ ...questionForm, question_text: event.target.value })} /></div>
              <div className="space-y-2"><Label>Opsi jawaban</Label>{questionForm.options.map((option, index) => <div key={index} className="flex items-center gap-2"><input type="radio" name="native-quiz-answer" checked={Number(questionForm.correct_option) === index} onChange={() => setQuestionForm({ ...questionForm, correct_option: String(index) })} aria-label={`Jawaban benar opsi ${index + 1}`} /><Input value={option} onChange={(event) => { const options = [...questionForm.options]; options[index] = event.target.value; setQuestionForm({ ...questionForm, options }); }} placeholder={`Opsi ${index + 1}`} /></div>)}</div>
              <div><Label>Penjelasan jawaban</Label><Textarea value={questionForm.explanation_markdown} onChange={(event) => setQuestionForm({ ...questionForm, explanation_markdown: event.target.value })} /></div>
              <div className="grid grid-cols-2 gap-3"><div><Label>Poin</Label><Input type="number" min={1} value={questionForm.points} onChange={(event) => setQuestionForm({ ...questionForm, points: event.target.value })} /></div><div><Label>Urutan</Label><Input type="number" min={0} value={questionForm.sort_order} onChange={(event) => setQuestionForm({ ...questionForm, sort_order: event.target.value })} /></div></div>
              <Button onClick={() => void saveQuestion()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}{editingQuestion ? "Simpan perubahan" : "Tambah soal"}</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}