import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Copy,
  Download,
  Eye,
  ExternalLink,
  FileText,
  FileVideo,
  GraduationCap,
  LayoutList,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Share2,
  Upload,
  UsersRound,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { canonicalCompanies } from "@/lib/ruang-simpan";
import { uploadSupabaseObjectWithProgress, type UploadProgress } from "@/integrations/supabase/uploadWithProgress";
import type { Json, Tables, TablesInsert } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import AdminAspekindoLmsQuiz from "@/components/aspekindo/AdminAspekindoLmsQuiz";
import { getLessonPublicationError, QUIZ_PUBLICATION_GUIDANCE } from "@/lib/lmsLessonPublication";

type Course = Tables<"aspekindo_lms_courses">;
type Session = Tables<"aspekindo_lms_sessions">;
type Lesson = Tables<"aspekindo_lms_lessons">;
type Material = Tables<"aspekindo_lms_materials">;
type Enrollment = Tables<"aspekindo_lms_enrollments">;
type Progress = Tables<"aspekindo_lms_lesson_progress">;
type Completion = Tables<"aspekindo_lms_completion_records">;
type Agenda = Pick<Tables<"aspekindo_learning_agendas">, "id" | "title" | "status" | "start_date">;
type Activity = Pick<Tables<"aspekindo_pub_activities">, "id" | "title" | "status" | "start_at">;
type Profile = Pick<Tables<"profiles">, "user_id" | "full_name" | "company">;

type DialogKind = "course" | "session" | "lesson" | "material" | "enrollment" | null;
type PreviewTarget =
  | { kind: "course"; course: Course }
  | { kind: "session"; session: Session }
  | { kind: "lesson"; lesson: Lesson }
  | null;

type CourseForm = {
  title: string;
  slug: string;
  description_markdown: string;
  audience: string;
  status: string;
  member_only: boolean;
  agenda_id: string;
  siap_focus: string;
  public_landing_enabled: boolean;
};

type SessionForm = {
  title: string;
  description_markdown: string;
  delivery_mode: string;
  source_type: string;
  source_name: string;
  source_url: string;
  source_activity_id: string;
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
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size_bytes: number;
  is_published: boolean;
  sort_order: string;
};

type EnrollmentForm = {
  user_id: string;
  status: string;
  notes: string;
};

const EMPTY_COURSE: CourseForm = {
  title: "",
  slug: "",
  description_markdown: "",
  audience: "Anggota BUJK",
  status: "draft",
  member_only: true,
  agenda_id: "",
  siap_focus: "sertifikasi",
  public_landing_enabled: false,
};

const SIAP_LABELS: Record<string, string> = {
  legalitas: "SIAP Legalitas",
  sertifikasi: "SIAP Sertifikasi",
  tender: "SIAP Tender",
  proyek: "SIAP Proyek",
};

const EMPTY_SESSION: SessionForm = {
  title: "",
  description_markdown: "",
  delivery_mode: "internal",
  source_type: "native",
  source_name: "PUB ASPEKINDO",
  source_url: "",
  source_activity_id: "",
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
  session_id: "",
  sort_order: "0",
};

const EMPTY_MATERIAL: MaterialForm = {
  title: "",
  material_type: "markdown",
  content_markdown: "",
  external_url: "",
  storage_path: "",
  file_name: "",
  mime_type: "",
  file_size_bytes: 0,
  is_published: false,
  sort_order: "0",
};

const EMPTY_ENROLLMENT: EnrollmentForm = {
  user_id: "",
  status: "enrolled",
  notes: "",
};

const DELIVERY_LABELS: Record<string, string> = {
  internal: "Internal",
  external: "Eksternal",
  hybrid: "Hybrid",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  published: "Terbit",
  archived: "Arsip",
  enrolled: "Terdaftar",
  in_progress: "Sedang belajar",
  completed: "Selesai",
  withdrawn: "Dibatalkan",
  ready_for_review: "Siap ditinjau",
  exported: "Diekspor",
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

function toLocalInput(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function toIso(value: string) {
  return value ? new Date(value).toISOString() : null;
}

function formatDate(value: string | null | undefined) {
  if (!value) return "Belum ditentukan";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatStatus(value: string) {
  return STATUS_LABELS[value] ?? value;
}

function formatFileSize(bytes: number) {
  if (!bytes) return "0 MB";
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function formatUploadBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function jsonRecord(value: Json) {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? value : {};
}

function csvCell(value: string | number) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

export default function AdminAspekindoLmsNative() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [progress, setProgress] = useState<Progress[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [selectedCourseId, setSelectedCourseId] = useState<string | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [previewTarget, setPreviewTarget] = useState<PreviewTarget>(null);
  const [saving, setSaving] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [editingEnrollment, setEditingEnrollment] = useState<Enrollment | null>(null);
  const [courseForm, setCourseForm] = useState<CourseForm>(EMPTY_COURSE);
  const [sessionForm, setSessionForm] = useState<SessionForm>(EMPTY_SESSION);
  const [lessonForm, setLessonForm] = useState<LessonForm>(EMPTY_LESSON);
  const [materialForm, setMaterialForm] = useState<MaterialForm>(EMPTY_MATERIAL);
  const [enrollmentForm, setEnrollmentForm] = useState<EnrollmentForm>(EMPTY_ENROLLMENT);
  const [rosterSearch, setRosterSearch] = useState("");
  const [rosterStatus, setRosterStatus] = useState("all");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadData = useCallback(async (background = false) => {
    if (background) setRefreshing(true);
    else setLoading(true);
    setError(null);

    const [
      coursesResult,
      sessionsResult,
      lessonsResult,
      materialsResult,
      enrollmentResult,
      progressResult,
      completionResult,
      agendaResult,
      activityResult,
      profileResult,
    ] = await Promise.all([
      supabase.from("aspekindo_lms_courses").select("*").order("updated_at", { ascending: false }),
      supabase.from("aspekindo_lms_sessions").select("*").order("sort_order"),
      supabase.from("aspekindo_lms_lessons").select("*").order("sort_order"),
      supabase.from("aspekindo_lms_materials").select("*").order("sort_order"),
      supabase.from("aspekindo_lms_enrollments").select("*").order("enrolled_at", { ascending: false }),
      supabase.from("aspekindo_lms_lesson_progress").select("*").order("updated_at", { ascending: false }),
      supabase.from("aspekindo_lms_completion_records").select("*").order("issued_at", { ascending: false }),
      supabase.from("aspekindo_learning_agendas").select("id, title, status, start_date").order("start_date", { ascending: false }),
      supabase.from("aspekindo_pub_activities").select("id, title, status, start_at").order("start_at", { ascending: false }),
      supabase.from("profiles").select("user_id, full_name, company").order("company"),
    ]);

    const firstError = [
      coursesResult,
      sessionsResult,
      lessonsResult,
      materialsResult,
      enrollmentResult,
      progressResult,
      completionResult,
      agendaResult,
      activityResult,
      profileResult,
    ].find((result) => result.error)?.error;

    if (firstError) {
      setError(firstError.message);
      toast({
        title: "Data operasi LMS belum lengkap",
        description: firstError.message,
        variant: "destructive",
      });
    }

    setCourses(coursesResult.data ?? []);
    setSessions(sessionsResult.data ?? []);
    setLessons(lessonsResult.data ?? []);
    setMaterials(materialsResult.data ?? []);
    setEnrollments(enrollmentResult.data ?? []);
    setProgress(progressResult.data ?? []);
    setCompletions(completionResult.data ?? []);
    setAgendas(agendaResult.data ?? []);
    setActivities(activityResult.data ?? []);
    setProfiles(await canonicalCompanies(profileResult.data ?? []));
    setLoading(false);
    setRefreshing(false);
  }, [toast]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    if (!selectedCourseId || !courses.some((course) => course.id === selectedCourseId)) {
      setSelectedCourseId(courses[0]?.id ?? null);
    }
  }, [courses, selectedCourseId]);

  const selectedCourse = courses.find((course) => course.id === selectedCourseId) ?? null;
  const selectedSessions = useMemo(
    () => sessions.filter((session) => session.course_id === selectedCourseId).sort((a, b) => a.sort_order - b.sort_order),
    [sessions, selectedCourseId],
  );
  const selectedLessons = useMemo(
    () => lessons.filter((lesson) => lesson.course_id === selectedCourseId).sort((a, b) => a.sort_order - b.sort_order),
    [lessons, selectedCourseId],
  );
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  const filteredCourses = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return courses;
    return courses.filter((course) =>
      `${course.title} ${course.course_code} ${course.audience}`.toLowerCase().includes(query),
    );
  }, [courses, search]);
  const profileMap = useMemo(() => new Map(profiles.map((profile) => [profile.user_id, profile])), [profiles]);
  const sessionMap = useMemo(() => new Map(sessions.map((session) => [session.id, session])), [sessions]);
  const lessonMap = useMemo(() => new Map(lessons.map((lesson) => [lesson.id, lesson])), [lessons]);

  const courseEnrollments = enrollments.filter((enrollment) => enrollment.course_id === selectedCourseId);
  const courseProgress = progress.filter((item) => item.course_id === selectedCourseId);
  const courseCompletions = completions.filter((item) => item.course_id === selectedCourseId);
  const visibleEnrollments = courseEnrollments.filter((enrollment) => {
    const person = profileMap.get(enrollment.user_id);
    const query = rosterSearch.trim().toLowerCase();
    const matchesSearch = !query || `${person?.full_name ?? ""} ${person?.company ?? ""} ${enrollment.user_id}`.toLowerCase().includes(query);
    return matchesSearch && (rosterStatus === "all" || enrollment.status === rosterStatus);
  });

  const openCreateCourse = () => {
    setEditingCourse(null);
    setCourseForm(EMPTY_COURSE);
    setDialog("course");
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
      agenda_id: course.agenda_id ?? "",
      siap_focus: course.siap_focus,
      public_landing_enabled: course.public_landing_enabled,
    });
    setDialog("course");
  };

  const openCreateSession = () => {
    if (!selectedCourse) return;
    setEditingSession(null);
    setSessionForm({ ...EMPTY_SESSION, sort_order: String(selectedSessions.length) });
    setDialog("session");
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
      source_activity_id: session.source_activity_id ?? "",
      status: session.status,
      starts_at: toLocalInput(session.starts_at),
      ends_at: toLocalInput(session.ends_at),
      sort_order: String(session.sort_order),
    });
    setDialog("session");
  };

  const openCreateLesson = () => {
    if (!selectedCourse) return;
    setEditingLesson(null);
    setLessonForm({
      ...EMPTY_LESSON,
      sort_order: String(selectedLessons.length),
      session_id: selectedSessions[0]?.id ?? "",
    });
    setDialog("lesson");
  };

  const openEditLesson = (lesson: Lesson) => {
    setEditingLesson(lesson);
    setSelectedLessonId(lesson.id);
    setLessonForm({
      title: lesson.title,
      slug: lesson.slug,
      content_markdown: lesson.content_markdown,
      passing_score: String(lesson.passing_score),
      is_published: lesson.is_published,
      session_id: lesson.session_id ?? "",
      sort_order: String(lesson.sort_order),
    });
    setDialog("lesson");
  };

  const openCreateMaterial = (lesson: Lesson) => {
    setEditingMaterial(null);
    setSelectedLessonId(lesson.id);
    const lessonMaterials = materials.filter((material) => material.lesson_id === lesson.id);
    setMaterialForm({ ...EMPTY_MATERIAL, sort_order: String(lessonMaterials.length) });
    setVideoFile(null);
    setUploadProgress(null);
    setDialog("material");
  };

  const openEditMaterial = (material: Material) => {
    setEditingMaterial(material);
    setSelectedLessonId(material.lesson_id);
    setMaterialForm({
      title: material.title,
      material_type: material.material_type,
      content_markdown: material.content_markdown,
      external_url: material.external_url,
      storage_path: material.storage_path,
      file_name: material.file_name,
      mime_type: material.mime_type,
      file_size_bytes: material.file_size_bytes,
      is_published: material.is_published,
      sort_order: String(material.sort_order),
    });
    setVideoFile(null);
    setUploadProgress(null);
    setDialog("material");
  };

  const openCreateEnrollment = () => {
    if (!selectedCourse) return;
    setEditingEnrollment(null);
    setEnrollmentForm(EMPTY_ENROLLMENT);
    setDialog("enrollment");
  };

  const openEditEnrollment = (enrollment: Enrollment) => {
    setEditingEnrollment(enrollment);
    setEnrollmentForm({
      user_id: enrollment.user_id,
      status: enrollment.status,
      notes: enrollment.notes,
    });
    setDialog("enrollment");
  };

  const saveCourse = async () => {
    if (!courseForm.title.trim() || !courseForm.slug.trim()) {
      toast({ title: "Lengkapi kursus", description: "Judul dan slug wajib diisi.", variant: "destructive" });
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(courseForm.slug)) {
      toast({ title: "Slug tidak valid", description: "Gunakan huruf kecil, angka, dan tanda hubung.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      title: courseForm.title.trim(),
      slug: courseForm.slug,
      description_markdown: courseForm.description_markdown.trim(),
      audience: courseForm.audience.trim(),
      status: courseForm.status,
      member_only: courseForm.member_only,
      agenda_id: courseForm.agenda_id || null,
      siap_focus: courseForm.siap_focus,
      public_landing_enabled: courseForm.public_landing_enabled,
      published_at: courseForm.status === "published" ? editingCourse?.published_at ?? new Date().toISOString() : null,
    };
    let saveError: { message: string } | null = null;
    let savedCourseId = editingCourse?.id;
    if (editingCourse) {
      const result = await supabase.from("aspekindo_lms_courses").update(payload).eq("id", editingCourse.id);
      saveError = result.error;
    } else {
      const result = await supabase
        .from("aspekindo_lms_courses")
        .insert({ ...payload, created_by: user?.id ?? null } satisfies TablesInsert<"aspekindo_lms_courses">)
        .select("id")
        .single();
      saveError = result.error;
      savedCourseId = result.data?.id;
    }
    setSaving(false);
    if (saveError) {
      toast({ title: "Kursus gagal disimpan", description: saveError.message, variant: "destructive" });
      return;
    }
    setDialog(null);
    toast({ title: editingCourse ? "Kursus diperbarui" : "Kursus dibuat" });
    await loadData(true);
    if (savedCourseId) setSelectedCourseId(savedCourseId);
  };

  const saveSession = async () => {
    if (!selectedCourse || !sessionForm.title.trim()) {
      toast({ title: "Lengkapi sesi", description: "Pilih kursus dan isi judul sesi.", variant: "destructive" });
      return;
    }
    if (sessionForm.delivery_mode !== "internal" && sessionForm.source_type === "native" && !sessionForm.source_activity_id) {
      toast({ title: "Sumber sesi diperlukan", description: "Sesi eksternal atau hybrid dengan sumber native harus dikaitkan ke kegiatan PUB.", variant: "destructive" });
      return;
    }
    if (sessionForm.source_type === "external" && (!sessionForm.source_url || !sessionForm.source_url.startsWith("https://"))) {
      toast({ title: "Tautan tidak aman", description: "Sumber eksternal harus menggunakan URL https://.", variant: "destructive" });
      return;
    }
    if (sessionForm.ends_at && sessionForm.starts_at && new Date(sessionForm.ends_at) < new Date(sessionForm.starts_at)) {
      toast({ title: "Jadwal tidak valid", description: "Waktu selesai tidak boleh mendahului waktu mulai.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      course_id: selectedCourse.id,
      title: sessionForm.title.trim(),
      description_markdown: sessionForm.description_markdown.trim(),
      delivery_mode: sessionForm.delivery_mode,
      source_type: sessionForm.source_type,
      source_name: sessionForm.source_name.trim() || "PUB ASPEKINDO",
      source_url: sessionForm.source_url.trim(),
      source_activity_id: sessionForm.source_activity_id || null,
      status: sessionForm.status,
      starts_at: toIso(sessionForm.starts_at),
      ends_at: toIso(sessionForm.ends_at),
      sort_order: Number(sessionForm.sort_order) || 0,
    };
    const result = editingSession
      ? await supabase.from("aspekindo_lms_sessions").update(payload).eq("id", editingSession.id)
      : await supabase.from("aspekindo_lms_sessions").insert({ ...payload, created_by: user?.id ?? null } satisfies TablesInsert<"aspekindo_lms_sessions">);
    setSaving(false);
    if (result.error) {
      toast({ title: "Sesi gagal disimpan", description: result.error.message, variant: "destructive" });
      return;
    }
    setDialog(null);
    toast({ title: editingSession ? "Sesi diperbarui" : "Sesi dibuat" });
    await loadData(true);
  };

  const saveLesson = async () => {
    if (!selectedCourse || !lessonForm.title.trim() || !lessonForm.slug.trim()) {
      toast({ title: "Lengkapi pelajaran", description: "Judul dan slug wajib diisi.", variant: "destructive" });
      return;
    }
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(lessonForm.slug)) {
      toast({ title: "Slug tidak valid", description: "Gunakan huruf kecil, angka, dan tanda hubung.", variant: "destructive" });
      return;
    }
    const passingScore = Number(lessonForm.passing_score);
    if (!Number.isInteger(passingScore) || passingScore < 0 || passingScore > 100) {
      toast({ title: "Nilai kelulusan tidak valid", description: "Masukkan angka 0 sampai 100.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const publicationError = await getLessonPublicationError(supabase, {
      id: editingLesson?.id,
      is_published: lessonForm.is_published,
      passing_score: passingScore,
    });
    if (publicationError) {
      setSaving(false);
      toast({ title: "Pelajaran belum dapat diterbitkan", description: publicationError, variant: "destructive" });
      return;
    }
    const payload = {
      course_id: selectedCourse.id,
      session_id: lessonForm.session_id || null,
      title: lessonForm.title.trim(),
      slug: lessonForm.slug,
      content_markdown: lessonForm.content_markdown.trim(),
      passing_score: passingScore,
      is_published: lessonForm.is_published,
      sort_order: Number(lessonForm.sort_order) || 0,
    };
    const result = editingLesson
      ? await supabase.from("aspekindo_lms_lessons").update(payload).eq("id", editingLesson.id)
      : await supabase.from("aspekindo_lms_lessons").insert({ ...payload, created_by: user?.id ?? null } satisfies TablesInsert<"aspekindo_lms_lessons">);
    setSaving(false);
    if (result.error) {
      toast({ title: "Pelajaran gagal disimpan", description: result.error.message, variant: "destructive" });
      return;
    }
    setDialog(null);
    toast({ title: editingLesson ? "Pelajaran diperbarui" : "Pelajaran dibuat" });
    await loadData(true);
  };

  const saveMaterial = async () => {
    if (!selectedLesson || !materialForm.title.trim()) {
      toast({ title: "Lengkapi materi", description: "Pilih pelajaran dan isi judul materi.", variant: "destructive" });
      return;
    }
    if (materialForm.material_type === "markdown" && !materialForm.content_markdown.trim()) {
      toast({ title: "Isi materi wajib diisi", description: "Materi markdown harus memiliki isi.", variant: "destructive" });
      return;
    }
    if (materialForm.material_type === "link" && !materialForm.external_url.startsWith("https://")) {
      toast({ title: "Tautan tidak aman", description: "Materi link harus menggunakan URL https://.", variant: "destructive" });
      return;
    }
    if (materialForm.material_type === "video" && !videoFile && !materialForm.storage_path) {
      toast({ title: "Pilih file video", description: "Video MP4 atau WebM wajib diunggah sebelum materi disimpan.", variant: "destructive" });
      return;
    }
    setSaving(true);
    let uploadedPath = "";
    if (materialForm.material_type === "video" && videoFile) {
      const safeName = videoFile.name.toLowerCase().replace(/[^a-z0-9._-]+/g, "-").slice(-120);
      uploadedPath = `native/${selectedLesson.course_id}/${selectedLesson.id}/${crypto.randomUUID()}-${safeName}`;
      setUploadProgress({ loaded: 0, total: videoFile.size, percent: 0 });
      const uploadResult = await uploadSupabaseObjectWithProgress({
        bucket: "aspekindo-learning",
        path: uploadedPath,
        file: videoFile,
        onProgress: setUploadProgress,
      });
      if (uploadResult.error) {
        setSaving(false);
        setUploadProgress(null);
        toast({ title: "Video gagal diunggah", description: uploadResult.error.message, variant: "destructive" });
        return;
      }
    }
    const activeVideoPath = materialForm.material_type === "video"
      ? uploadedPath || materialForm.storage_path
      : "";
    const payload = {
      lesson_id: selectedLesson.id,
      title: materialForm.title.trim(),
      material_type: materialForm.material_type,
      content_markdown: materialForm.material_type === "markdown" ? materialForm.content_markdown.trim() : "",
      external_url: materialForm.material_type === "link" ? materialForm.external_url.trim() : "",
      storage_path: activeVideoPath,
      file_name: materialForm.material_type === "video" ? videoFile?.name ?? materialForm.file_name : "",
      mime_type: materialForm.material_type === "video" ? videoFile?.type ?? materialForm.mime_type : "",
      file_size_bytes: materialForm.material_type === "video" ? videoFile?.size ?? materialForm.file_size_bytes : 0,
      is_published: materialForm.is_published,
      sort_order: Number(materialForm.sort_order) || 0,
    };
    const result = editingMaterial
      ? await supabase.from("aspekindo_lms_materials").update(payload).eq("id", editingMaterial.id)
      : await supabase.from("aspekindo_lms_materials").insert({ ...payload, created_by: user?.id ?? null } satisfies TablesInsert<"aspekindo_lms_materials">);
    setSaving(false);
    if (result.error) {
      if (uploadedPath) {
        await supabase.storage.from("aspekindo-learning").remove([uploadedPath]);
      }
      setUploadProgress(null);
      toast({ title: "Materi gagal disimpan", description: result.error.message, variant: "destructive" });
      return;
    }
    if (
      editingMaterial?.storage_path
      && editingMaterial.storage_path !== activeVideoPath
    ) {
      const cleanupResult = await supabase.storage
        .from("aspekindo-learning")
        .remove([editingMaterial.storage_path]);
      if (cleanupResult.error) {
        toast({
          title: "Materi tersimpan, file lama belum terhapus",
          description: "Segarkan halaman dan coba bersihkan file lama dari Storage.",
          variant: "destructive",
        });
      }
    }
    setDialog(null);
    setUploadProgress(null);
    toast({ title: editingMaterial ? "Materi diperbarui" : "Materi dibuat" });
    await loadData(true);
  };

  const selectVideoFile = (file: File | null) => {
    if (!file) return;
    setUploadProgress(null);
    const allowedTypes = new Set(["video/mp4", "video/webm"]);
    const lowerName = file.name.toLowerCase();
    const validExtension = lowerName.endsWith(".mp4") || lowerName.endsWith(".webm");
    if ((!allowedTypes.has(file.type) && !validExtension) || file.size <= 0) {
      toast({ title: "Format video tidak didukung", description: "Gunakan file MP4 atau WebM yang valid.", variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > 500 * 1024 * 1024) {
      toast({ title: "Video terlalu besar", description: "Ukuran maksimum video adalah 500 MB.", variant: "destructive" });
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const mimeType = allowedTypes.has(file.type)
      ? file.type
      : lowerName.endsWith(".webm") ? "video/webm" : "video/mp4";
    const normalizedFile = file.type ? file : new File([file], file.name, { type: mimeType });
    setVideoFile(normalizedFile);
    setMaterialForm((current) => ({
      ...current,
      file_name: normalizedFile.name,
      mime_type: mimeType,
      file_size_bytes: normalizedFile.size,
    }));
  };

  const copyPublicCourseUrl = async (course: Course) => {
    const url = `${window.location.origin}/kursus/${course.slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Tautan landing disalin", description: url });
    } catch {
      toast({ title: "Tautan belum dapat disalin", description: url, variant: "destructive" });
    }
  };

  const saveEnrollment = async () => {
    if (!selectedCourse || !enrollmentForm.user_id) {
      toast({ title: "Pilih peserta", description: "Peserta wajib dipilih sebelum enrollment disimpan.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = {
      course_id: selectedCourse.id,
      user_id: enrollmentForm.user_id,
      status: enrollmentForm.status,
      notes: enrollmentForm.notes.trim(),
      completed_at: enrollmentForm.status === "completed" ? editingEnrollment?.completed_at ?? new Date().toISOString() : null,
      last_activity_at: editingEnrollment?.last_activity_at ?? null,
    };
    const result = editingEnrollment
      ? await supabase.from("aspekindo_lms_enrollments").update(payload).eq("id", editingEnrollment.id)
      : await supabase.from("aspekindo_lms_enrollments").insert(payload);
    setSaving(false);
    if (result.error) {
      toast({ title: "Enrollment gagal disimpan", description: result.error.message, variant: "destructive" });
      return;
    }
    setDialog(null);
    toast({ title: editingEnrollment ? "Enrollment diperbarui" : "Peserta ditambahkan ke kursus" });
    await loadData(true);
  };

  const markCompletionExported = async (record: Completion) => {
    const exportedAt = new Date().toISOString();
    const exportBatchId = `manual-${exportedAt.slice(0, 10)}-${record.id.slice(0, 8)}`;
    const { error: updateError } = await supabase
      .from("aspekindo_lms_completion_records")
      .update({ status: "exported", exported_at: exportedAt, export_batch_id: exportBatchId })
      .eq("id", record.id);
    if (updateError) {
      toast({ title: "Bukti gagal ditandai sebagai diekspor", description: updateError.message, variant: "destructive" });
      return;
    }
    toast({ title: "Bukti ditandai sudah diekspor", description: `Batch ${exportBatchId}` });
    await loadData(true);
  };

  const updateCourseStatus = async (course: Course, status: "published" | "archived" | "draft") => {
    const { error: updateError } = await supabase
      .from("aspekindo_lms_courses")
      .update({ status, published_at: status === "published" ? course.published_at ?? new Date().toISOString() : null })
      .eq("id", course.id);
    if (updateError) {
      toast({ title: "Status kursus gagal diubah", description: updateError.message, variant: "destructive" });
      return;
    }
    toast({ title: `Kursus ${formatStatus(status).toLowerCase()}` });
    await loadData(true);
  };

  const updateSessionStatus = async (session: Session, status: "published" | "archived" | "draft") => {
    const { error: updateError } = await supabase.from("aspekindo_lms_sessions").update({ status }).eq("id", session.id);
    if (updateError) {
      toast({ title: "Status sesi gagal diubah", description: updateError.message, variant: "destructive" });
      return;
    }
    await loadData(true);
  };

  const updateLessonStatus = async (lesson: Lesson, is_published: boolean) => {
    const publicationError = await getLessonPublicationError(supabase, { ...lesson, is_published });
    if (publicationError) {
      toast({ title: "Pelajaran belum dapat diterbitkan", description: publicationError, variant: "destructive" });
      return;
    }
    const { error: updateError } = await supabase.from("aspekindo_lms_lessons").update({ is_published }).eq("id", lesson.id);
    if (updateError) {
      toast({ title: "Status pelajaran gagal diubah", description: updateError.message, variant: "destructive" });
      return;
    }
    await loadData(true);
  };

  const exportRoster = () => {
    const rows = courseEnrollments.map((enrollment) => {
      const person = profileMap.get(enrollment.user_id);
      const personProgress = courseProgress.filter((item) => item.user_id === enrollment.user_id);
      const completedLessons = personProgress.filter((item) => item.status === "completed").length;
      return [
        person?.full_name ?? enrollment.user_id,
        person?.company ?? "-",
        formatStatus(enrollment.status),
        `${completedLessons}/${selectedLessons.length}`,
        formatDate(enrollment.enrolled_at),
      ];
    });
    const csv = [
      ["Peserta", "Perusahaan", "Status", "Pelajaran selesai", "Terdaftar"],
      ...rows,
    ].map((row) => row.map(csvCell).join(",")).join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    link.download = `rekap-lms-${selectedCourse?.slug ?? "kursus"}-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  if (loading) {
    return (
      <div className="flex min-h-[360px] items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" /> Memuat operasi LMS native...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div>
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <Badge className="bg-pub-sky/10 text-pub-sky hover:bg-pub-sky/10">LMS native</Badge>
            <span className="text-xs text-muted-foreground">Terpisah dari Operasi Kegiatan PUB legacy</span>
          </div>
          <h1 className="flex items-center gap-2 text-2xl font-bold font-heading">
            <GraduationCap className="h-6 w-6 text-pub-sky" /> Kelola LMS ASPEKINDO
          </h1>
          <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
            Susun kurikulum, terbitkan pembelajaran, dan pantau bukti progres peserta dari satu ruang operasi.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => void loadData(true)} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Segarkan
          </Button>
          <Button onClick={openCreateCourse}>
            <Plus className="mr-2 h-4 w-4" /> Tambah kursus
          </Button>
        </div>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5">
          <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-semibold text-destructive">Sebagian data belum tersedia</p>
              <p className="text-sm text-muted-foreground">{error}</p>
            </div>
            <Button variant="outline" onClick={() => void loadData(true)}>Coba lagi</Button>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Kursus</p><p className="mt-1 text-2xl font-bold">{courses.length}</p><p className="text-xs text-muted-foreground">{courses.filter((course) => course.status === "published").length} terbit</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Pelajaran</p><p className="mt-1 text-2xl font-bold">{lessons.length}</p><p className="text-xs text-muted-foreground">{lessons.filter((lesson) => lesson.is_published).length} terbit</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Enrollment</p><p className="mt-1 text-2xl font-bold">{enrollments.length}</p><p className="text-xs text-muted-foreground">lintas kursus native</p></CardContent></Card>
        <Card><CardContent className="p-4"><p className="text-xs text-muted-foreground">Bukti selesai</p><p className="mt-1 text-2xl font-bold">{completions.length}</p><p className="text-xs text-muted-foreground">siap ditinjau untuk LKUT</p></CardContent></Card>
      </div>

      <Card className="border-pub-sky/20 bg-pub-sky/5">
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-3">
            <BookOpen className="mt-0.5 h-5 w-5 shrink-0 text-pub-sky" />
            <div>
              <p className="font-semibold">Ruang kerja LMS native</p>
              <p className="text-sm text-muted-foreground">Untuk agenda, anggota, dan evidence kegiatan PUB legacy, gunakan operasi terpisah.</p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <a href="/admin/aspekindo-lms">Operasi kegiatan PUB <ExternalLink className="ml-2 h-3.5 w-3.5" /></a>
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="curriculum">
        <TabsList className="grid h-auto w-full grid-cols-3">
          <TabsTrigger value="curriculum"><LayoutList className="mr-2 h-4 w-4" /> Kurikulum</TabsTrigger>
          <TabsTrigger value="quiz"><ClipboardList className="mr-2 h-4 w-4" /> Kuis</TabsTrigger>
          <TabsTrigger value="participants"><UsersRound className="mr-2 h-4 w-4" /> Peserta & bukti</TabsTrigger>
        </TabsList>

        <TabsContent value="curriculum" className="mt-4 grid gap-4 xl:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.8fr)]">
          <Card className="h-fit">
            <CardHeader className="gap-3">
              <div><CardTitle className="text-base">Katalog kerja</CardTitle><CardDescription>Draft, terbit, dan arsip tetap terlihat oleh admin.</CardDescription></div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cari kursus..." className="pl-9" />
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {filteredCourses.length === 0 ? (
                <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                  {search ? "Kursus tidak ditemukan." : "Belum ada kursus. Mulai dari kursus pertama."}
                </div>
              ) : filteredCourses.map((course) => (
                <button
                  type="button"
                  key={course.id}
                  onClick={() => setSelectedCourseId(course.id)}
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${course.id === selectedCourseId ? "border-pub-sky bg-pub-sky/10" : "border-border hover:bg-muted/50"}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold">{course.title}</p>
                    <Badge variant="outline" className="shrink-0 text-[10px]">{formatStatus(course.status)}</Badge>
                  </div>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">{course.course_code}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{lessons.filter((lesson) => lesson.course_id === course.id).length} pelajaran · {enrollments.filter((item) => item.course_id === course.id).length} peserta</p>
                </button>
              ))}
            </CardContent>
          </Card>

          {!selectedCourse ? (
            <Card><CardContent className="flex min-h-[360px] flex-col items-center justify-center gap-3 text-center text-muted-foreground"><GraduationCap className="h-10 w-10 text-pub-sky" /><p>Pilih kursus untuk mulai mengelola kurikulum.</p></CardContent></Card>
          ) : (
            <div className="space-y-4">
              <Card className="overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-pub-sky via-pub-emerald to-pub-amber" />
                <CardHeader>
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant="outline">{selectedCourse.course_code}</Badge>
                        <Badge variant="outline">{formatStatus(selectedCourse.status)}</Badge>
                        {selectedCourse.member_only && <Badge variant="secondary">Anggota</Badge>}
                        {selectedCourse.public_landing_enabled && <Badge className="bg-pub-emerald/10 text-pub-emerald hover:bg-pub-emerald/10">Landing publik aktif</Badge>}
                      </div>
                      <CardTitle className="mt-3 text-2xl">{selectedCourse.title}</CardTitle>
                      <CardDescription className="mt-1 max-w-2xl">{selectedCourse.audience || "Belum ada sasaran peserta"}</CardDescription>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {selectedCourse.public_landing_enabled && selectedCourse.status === "published" && (
                        <>
                          <Button variant="outline" size="sm" asChild>
                            <a href={`/kursus/${selectedCourse.slug}`} target="_blank" rel="noopener noreferrer">
                              <Share2 className="mr-2 h-4 w-4" /> Buka landing
                            </a>
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => void copyPublicCourseUrl(selectedCourse)}>
                            <Copy className="mr-2 h-4 w-4" /> Salin tautan
                          </Button>
                        </>
                      )}
                      <Button variant="outline" size="sm" onClick={() => setPreviewTarget({ kind: "course", course: selectedCourse })}><Eye className="mr-2 h-4 w-4" /> Pratinjau</Button>
                      <Button variant="outline" size="sm" onClick={() => openEditCourse(selectedCourse)}><Pencil className="mr-2 h-4 w-4" /> Edit</Button>
                      {selectedCourse.status === "published"
                        ? <Button variant="outline" size="sm" onClick={() => void updateCourseStatus(selectedCourse, "archived")}><Archive className="mr-2 h-4 w-4" /> Arsipkan</Button>
                        : <Button size="sm" onClick={() => void updateCourseStatus(selectedCourse, "published")}><CheckCircle2 className="mr-2 h-4 w-4" /> Terbitkan</Button>}
                    </div>
                  </div>
                  {selectedCourse.description_markdown && <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{selectedCourse.description_markdown}</p>}
                  {selectedCourse.agenda_id && <p className="text-xs text-muted-foreground">Terhubung agenda: {agendas.find((agenda) => agenda.id === selectedCourse.agenda_id)?.title ?? "Agenda terhubung"}</p>}
                </CardHeader>
              </Card>

              <Card>
                <CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div><CardTitle className="text-base">Sesi pembelajaran</CardTitle><CardDescription>Delivery mode, sumber, jadwal, dan status publikasi.</CardDescription></div>
                  <Button size="sm" onClick={openCreateSession}><Plus className="mr-2 h-4 w-4" /> Tambah sesi</Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedSessions.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Belum ada sesi. Tambahkan sesi untuk menyusun alur pembelajaran.</div>
                  ) : selectedSessions.map((session) => (
                    <div key={session.id} className="rounded-lg border p-4">
                      <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono text-xs text-muted-foreground">#{session.sort_order + 1}</span>
                            <Badge variant="outline">{DELIVERY_LABELS[session.delivery_mode] ?? session.delivery_mode}</Badge>
                            <Badge variant="outline">{formatStatus(session.status)}</Badge>
                          </div>
                          <p className="mt-2 font-semibold">{session.title}</p>
                          <p className="text-xs text-muted-foreground">{session.source_name}{session.source_url ? ` · ${session.source_url}` : ""}</p>
                          {(session.starts_at || session.ends_at) && <p className="mt-1 text-xs text-muted-foreground">{formatDate(session.starts_at)}{session.ends_at ? ` — ${formatDate(session.ends_at)}` : ""}</p>}
                        </div>
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => setPreviewTarget({ kind: "session", session })}><Eye className="mr-1 h-4 w-4" /> Lihat</Button>
                          <Button size="sm" variant="ghost" onClick={() => openEditSession(session)}><Pencil className="mr-1 h-4 w-4" /> Edit</Button>
                          {session.status === "published"
                            ? <Button size="sm" variant="ghost" onClick={() => void updateSessionStatus(session, "archived")}><Archive className="mr-1 h-4 w-4" /> Arsip</Button>
                            : <Button size="sm" variant="ghost" onClick={() => void updateSessionStatus(session, "published")}><CheckCircle2 className="mr-1 h-4 w-4" /> Terbit</Button>}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                  <div><CardTitle className="text-base">Pelajaran & materi</CardTitle><CardDescription>Atur urutan, isi markdown, tautan, video privat, dan kesiapan publikasi.</CardDescription></div>
                  <Button size="sm" onClick={openCreateLesson}><Plus className="mr-2 h-4 w-4" /> Tambah pelajaran</Button>
                </CardHeader>
                <CardContent className="space-y-3">
                  {selectedLessons.length === 0 ? (
                    <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Belum ada pelajaran. Tambahkan konten pertama untuk kursus ini.</div>
                  ) : selectedLessons.map((lesson) => {
                    const lessonMaterials = materials.filter((material) => material.lesson_id === lesson.id).sort((a, b) => a.sort_order - b.sort_order);
                    const lessonSession = lesson.session_id ? sessionMap.get(lesson.session_id) : null;
                    return (
                      <div key={lesson.id} className="rounded-lg border p-4">
                        <div className="flex flex-col justify-between gap-3 md:flex-row md:items-start">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs text-muted-foreground">#{lesson.sort_order + 1}</span>
                              <Badge variant="outline">{lesson.is_published ? "Terbit" : "Draft"}</Badge>
                              <Badge variant="secondary">Lulus {lesson.passing_score}</Badge>
                            </div>
                            <p className="mt-2 font-semibold">{lesson.title}</p>
                            <p className="text-xs text-muted-foreground">{lessonSession ? `Sesi: ${lessonSession.title}` : "Belum dikaitkan ke sesi"} · {lessonMaterials.length} materi</p>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <Button size="sm" variant="ghost" onClick={() => setPreviewTarget({ kind: "lesson", lesson })}><Eye className="mr-1 h-4 w-4" /> Lihat</Button>
                            <Button size="sm" variant="ghost" onClick={() => openEditLesson(lesson)}><Pencil className="mr-1 h-4 w-4" /> Edit</Button>
                            <Button size="sm" variant="ghost" onClick={() => void updateLessonStatus(lesson, !lesson.is_published)}>{lesson.is_published ? "Jadikan draft" : "Terbitkan"}</Button>
                            <Button size="sm" variant="outline" onClick={() => openCreateMaterial(lesson)}><Plus className="mr-1 h-4 w-4" /> Materi</Button>
                          </div>
                        </div>
                        {lessonMaterials.length > 0 && (
                          <div className="mt-3 space-y-2 border-t pt-3">
                            {lessonMaterials.map((material) => (
                              <div key={material.id} className="flex flex-col justify-between gap-2 rounded-md bg-muted/40 px-3 py-2 text-sm sm:flex-row sm:items-center">
                                <div className="flex min-w-0 items-center gap-2">{material.material_type === "video" ? <FileVideo className="h-4 w-4 shrink-0 text-pub-amber" /> : <FileText className="h-4 w-4 shrink-0 text-pub-sky" />}<span className="truncate">{material.title}</span><Badge variant="outline" className="text-[10px]">{material.material_type}</Badge>{material.material_type === "video" && <span className="text-xs text-muted-foreground">{formatFileSize(material.file_size_bytes)}</span>}</div>
                                <Button size="sm" variant="ghost" onClick={() => openEditMaterial(material)}><Pencil className="mr-1 h-3.5 w-3.5" /> Edit</Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

        <TabsContent value="quiz" className="mt-4">
          <AdminAspekindoLmsQuiz course={selectedCourse} lessons={selectedLessons} userId={user?.id} />
        </TabsContent>

        <TabsContent value="participants" className="mt-4 space-y-4">
          <Card>
            <CardHeader className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
              <div><CardTitle className="text-base">Roster kursus</CardTitle><CardDescription>{selectedCourse ? `Peserta untuk ${selectedCourse.title}` : "Pilih kursus di tab Kurikulum terlebih dahulu."}</CardDescription></div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={!selectedCourse} onClick={openCreateEnrollment}><Plus className="mr-2 h-4 w-4" /> Tambah peserta</Button>
                <Button variant="outline" size="sm" disabled={!selectedCourse || courseEnrollments.length === 0} onClick={exportRoster}><Download className="mr-2 h-4 w-4" /> Export CSV</Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {!selectedCourse ? <p className="py-8 text-center text-sm text-muted-foreground">Belum ada kursus yang dipilih.</p> : courseEnrollments.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada enrollment untuk kursus ini.</div> : (
                <>
                <div className="mb-4 flex flex-col gap-3 sm:flex-row">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input aria-label="Cari peserta LMS" value={rosterSearch} onChange={(event) => setRosterSearch(event.target.value)} placeholder="Cari nama, perusahaan, atau user ID..." className="pl-9" />
                  </div>
                  <Select value={rosterStatus} onValueChange={setRosterStatus}>
                    <SelectTrigger className="sm:w-48"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Semua status</SelectItem>
                      <SelectItem value="enrolled">Terdaftar</SelectItem>
                      <SelectItem value="in_progress">Sedang belajar</SelectItem>
                      <SelectItem value="completed">Selesai</SelectItem>
                      <SelectItem value="withdrawn">Dibatalkan</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {visibleEnrollments.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Tidak ada peserta yang cocok dengan filter.</div> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Peserta</TableHead><TableHead>Status</TableHead><TableHead>Progres</TableHead><TableHead>Terdaftar</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {visibleEnrollments.map((enrollment) => {
                      const person = profileMap.get(enrollment.user_id);
                      const personProgress = courseProgress.filter((item) => item.user_id === enrollment.user_id);
                      const completedLessons = personProgress.filter((item) => item.status === "completed").length;
                      return (
                        <TableRow key={enrollment.id}>
                          <TableCell><p className="font-medium">{person?.full_name ?? enrollment.user_id}</p><p className="text-xs text-muted-foreground">{person?.company ?? "Perusahaan belum diisi"}</p></TableCell>
                          <TableCell><Badge variant="outline">{formatStatus(enrollment.status)}</Badge></TableCell>
                          <TableCell>{completedLessons}/{selectedLessons.length} pelajaran</TableCell>
                          <TableCell className="whitespace-nowrap">{formatDate(enrollment.enrolled_at)}</TableCell>
                          <TableCell className="text-right"><Button size="sm" variant="ghost" onClick={() => openEditEnrollment(enrollment)}><Pencil className="mr-1 h-3.5 w-3.5" /> Kelola</Button></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
                )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ClipboardList className="h-5 w-5 text-pub-emerald" /> Bukti penyelesaian</CardTitle><CardDescription>Catatan native LMS untuk review internal dan persiapan rekap LKUT, bukan sertifikat legal otomatis.</CardDescription></CardHeader>
            <CardContent className="overflow-x-auto">
              {!selectedCourse || courseCompletions.length === 0 ? <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">Belum ada completion record untuk kursus ini.</div> : (
                <Table>
                  <TableHeader><TableRow><TableHead>Nomor</TableHead><TableHead>Peserta</TableHead><TableHead>Status</TableHead><TableHead>Diterbitkan</TableHead><TableHead className="text-right">Aksi</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {courseCompletions.map((record) => <TableRow key={record.id}><TableCell className="font-mono text-xs">{record.record_number}</TableCell><TableCell>{profileMap.get(record.user_id)?.full_name ?? record.user_id}</TableCell><TableCell><Badge variant="outline">{formatStatus(record.status)}</Badge></TableCell><TableCell className="whitespace-nowrap">{formatDate(record.issued_at)}</TableCell><TableCell className="text-right">{record.status === "exported" ? <span className="text-xs text-muted-foreground">{record.export_batch_id}</span> : <Button size="sm" variant="outline" onClick={() => void markCompletionExported(record)}><CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Tandai diekspor</Button>}</TableCell></TableRow>)}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={Boolean(previewTarget)} onOpenChange={(open) => !open && setPreviewTarget(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {previewTarget?.kind === "course" ? "Pratinjau kursus" : previewTarget?.kind === "session" ? "Pratinjau sesi" : "Pratinjau pelajaran"}
            </DialogTitle>
          </DialogHeader>
          {previewTarget?.kind === "course" && (
            <div className="space-y-5">
              <div><div className="flex flex-wrap gap-2"><Badge variant="outline">{previewTarget.course.course_code}</Badge><Badge variant="outline">{formatStatus(previewTarget.course.status)}</Badge><Badge variant="secondary">{SIAP_LABELS[previewTarget.course.siap_focus] ?? previewTarget.course.siap_focus}</Badge></div><h2 className="mt-3 text-2xl font-bold font-heading">{previewTarget.course.title}</h2><p className="mt-2 text-sm text-muted-foreground">{previewTarget.course.audience}</p></div>
              {previewTarget.course.description_markdown && <div className="whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-sm leading-relaxed">{previewTarget.course.description_markdown}</div>}
              <div><p className="font-semibold">Struktur pembelajaran</p><div className="mt-2 space-y-2">{selectedSessions.length === 0 && selectedLessons.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada sesi atau pelajaran.</p> : selectedSessions.map((session) => <div key={session.id} className="rounded-lg border p-3"><p className="font-medium">{session.title}</p><p className="text-xs text-muted-foreground">{DELIVERY_LABELS[session.delivery_mode] ?? session.delivery_mode} · {selectedLessons.filter((lesson) => lesson.session_id === session.id).length} pelajaran</p></div>)}</div></div>
            </div>
          )}
          {previewTarget?.kind === "session" && (
            <div className="space-y-4">
              <div><div className="flex flex-wrap gap-2"><Badge variant="outline">{DELIVERY_LABELS[previewTarget.session.delivery_mode] ?? previewTarget.session.delivery_mode}</Badge><Badge variant="outline">{formatStatus(previewTarget.session.status)}</Badge></div><h2 className="mt-3 text-2xl font-bold font-heading">{previewTarget.session.title}</h2></div>
              {previewTarget.session.description_markdown && <div className="whitespace-pre-wrap rounded-lg bg-muted/40 p-4 text-sm leading-relaxed">{previewTarget.session.description_markdown}</div>}
              <div className="grid gap-3 text-sm sm:grid-cols-2"><div><p className="text-xs text-muted-foreground">Sumber</p><p className="font-medium">{previewTarget.session.source_name}</p></div><div><p className="text-xs text-muted-foreground">Jadwal</p><p className="font-medium">{formatDate(previewTarget.session.starts_at)}{previewTarget.session.ends_at ? ` — ${formatDate(previewTarget.session.ends_at)}` : ""}</p></div></div>
              <div><p className="font-semibold">Pelajaran dalam sesi</p><div className="mt-2 space-y-2">{selectedLessons.filter((lesson) => lesson.session_id === previewTarget.session.id).map((lesson) => <div key={lesson.id} className="rounded-lg border p-3"><p className="font-medium">{lesson.title}</p><p className="text-xs text-muted-foreground">{lesson.is_published ? "Terbit" : "Draft"} · Nilai lulus {lesson.passing_score}</p></div>)}</div></div>
            </div>
          )}
          {previewTarget?.kind === "lesson" && (
            <div className="space-y-4">
              <div><div className="flex flex-wrap gap-2"><Badge variant="outline">{previewTarget.lesson.is_published ? "Terbit" : "Draft"}</Badge><Badge variant="secondary">Nilai lulus {previewTarget.lesson.passing_score}</Badge></div><h2 className="mt-3 text-2xl font-bold font-heading">{previewTarget.lesson.title}</h2></div>
              {previewTarget.lesson.content_markdown ? <div className="whitespace-pre-wrap rounded-lg border p-4 text-sm leading-relaxed">{previewTarget.lesson.content_markdown}</div> : <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Isi pelajaran belum tersedia.</div>}
              <div><p className="font-semibold">Materi</p><div className="mt-2 space-y-2">{materials.filter((material) => material.lesson_id === previewTarget.lesson.id).map((material) => <div key={material.id} className="rounded-lg border p-3"><p className="font-medium">{material.title}</p><p className="text-xs text-muted-foreground">{material.material_type} · {material.is_published ? "Terbit" : "Draft"}</p></div>)}</div></div>
            </div>
          )}
          <DialogFooter><Button variant="outline" onClick={() => setPreviewTarget(null)}>Tutup pratinjau</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "enrollment"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingEnrollment ? "Kelola enrollment peserta" : "Tambah peserta ke kursus"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Peserta *</Label>
              <Select
                value={enrollmentForm.user_id || "none"}
                disabled={Boolean(editingEnrollment)}
                onValueChange={(value) => setEnrollmentForm((current) => ({ ...current, user_id: value === "none" ? "" : value }))}
              >
                <SelectTrigger><SelectValue placeholder="Pilih peserta" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Pilih peserta</SelectItem>
                  {profiles
                    .filter((profile) => editingEnrollment?.user_id === profile.user_id || !courseEnrollments.some((item) => item.user_id === profile.user_id))
                    .map((profile) => <SelectItem key={profile.user_id} value={profile.user_id}>{profile.full_name || profile.user_id} · {profile.company || "Tanpa perusahaan"}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Status</Label>
              <Select value={enrollmentForm.status} onValueChange={(value) => setEnrollmentForm((current) => ({ ...current, status: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="enrolled">Terdaftar</SelectItem>
                  <SelectItem value="in_progress">Sedang belajar</SelectItem>
                  <SelectItem value="completed">Selesai</SelectItem>
                  <SelectItem value="withdrawn">Dibatalkan</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label htmlFor="native-enrollment-notes">Catatan admin</Label><Textarea id="native-enrollment-notes" value={enrollmentForm.notes} onChange={(event) => setEnrollmentForm((current) => ({ ...current, notes: event.target.value }))} rows={4} placeholder="Alasan penambahan, penarikan, atau catatan operasional..." /></div>
            <p className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">Perubahan status enrollment tidak menandai pelajaran selesai dan tidak menerbitkan completion record secara otomatis.</p>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Batal</Button><Button onClick={() => void saveEnrollment()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan enrollment</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "course"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editingCourse ? "Edit kursus LMS native" : "Tambah kursus LMS native"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label htmlFor="native-course-title">Judul kursus *</Label><Input id="native-course-title" value={courseForm.title} onChange={(event) => setCourseForm((current) => ({ ...current, title: event.target.value, slug: current.slug || slugify(event.target.value) }))} /></div>
            <div><Label htmlFor="native-course-slug">Slug *</Label><Input id="native-course-slug" value={courseForm.slug} onChange={(event) => setCourseForm((current) => ({ ...current, slug: slugify(event.target.value) }))} /><p className="mt-1 text-xs text-muted-foreground">Menjadi bagian URL landing publik saat fitur tersebut diaktifkan. Mengubah slug akan mengubah tautannya.</p></div>
            <div><Label htmlFor="native-course-description">Deskripsi markdown</Label><Textarea id="native-course-description" value={courseForm.description_markdown} onChange={(event) => setCourseForm((current) => ({ ...current, description_markdown: event.target.value }))} rows={5} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label htmlFor="native-course-audience">Sasaran peserta</Label><Input id="native-course-audience" value={courseForm.audience} onChange={(event) => setCourseForm((current) => ({ ...current, audience: event.target.value }))} /></div>
              <div><Label>Status</Label><Select value={courseForm.status} onValueChange={(value) => setCourseForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Terbit</SelectItem><SelectItem value="archived">Arsip</SelectItem></SelectContent></Select></div>
            </div>
            <div><Label>Fokus 4 SIAP *</Label><Select value={courseForm.siap_focus} onValueChange={(value) => setCourseForm((current) => ({ ...current, siap_focus: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="legalitas">SIAP Legalitas</SelectItem><SelectItem value="sertifikasi">SIAP Sertifikasi</SelectItem><SelectItem value="tender">SIAP Tender</SelectItem><SelectItem value="proyek">SIAP Proyek</SelectItem></SelectContent></Select><p className="mt-1 text-xs text-muted-foreground">Progres dan bukti kursus diproyeksikan ke dimensi ini pada peta kompetensi anggota.</p></div>
            <div><Label>Agenda ASPEKINDO (opsional)</Label><Select value={courseForm.agenda_id || "none"} onValueChange={(value) => setCourseForm((current) => ({ ...current, agenda_id: value === "none" ? "" : value }))}><SelectTrigger><SelectValue placeholder="Pilih agenda" /></SelectTrigger><SelectContent><SelectItem value="none">Tidak dikaitkan</SelectItem>{agendas.map((agenda) => <SelectItem key={agenda.id} value={agenda.id}>{agenda.title} · {agenda.status}</SelectItem>)}</SelectContent></Select></div>
            <div className="flex items-center justify-between rounded-lg border p-3"><div><Label htmlFor="native-course-member-only">Khusus anggota</Label><p className="text-xs text-muted-foreground">Kursus hanya terlihat oleh anggota aktif saat terbit.</p></div><Switch id="native-course-member-only" checked={courseForm.member_only} onCheckedChange={(checked) => setCourseForm((current) => ({ ...current, member_only: checked }))} /></div>
            <div className="flex items-center justify-between rounded-lg border border-pub-sky/25 bg-pub-sky/5 p-3"><div><Label htmlFor="native-course-public-landing">Landing publik</Label><p className="text-xs text-muted-foreground">Bagikan judul, deskripsi, sasaran peserta, dan CTA login tanpa membuka materi kursus.</p></div><Switch id="native-course-public-landing" checked={courseForm.public_landing_enabled} onCheckedChange={(checked) => setCourseForm((current) => ({ ...current, public_landing_enabled: checked }))} /></div>
            {courseForm.public_landing_enabled && courseForm.status !== "published" && <p className="rounded-lg bg-pub-amber/10 p-3 text-xs text-muted-foreground">Landing baru dapat dibuka publik setelah status kursus menjadi Terbit.</p>}
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Batal</Button><Button onClick={() => void saveCourse()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan kursus</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "session"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editingSession ? "Edit sesi pembelajaran" : "Tambah sesi pembelajaran"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label htmlFor="native-session-title">Judul sesi *</Label><Input id="native-session-title" value={sessionForm.title} onChange={(event) => setSessionForm((current) => ({ ...current, title: event.target.value }))} /></div>
            <div><Label htmlFor="native-session-description">Deskripsi markdown</Label><Textarea id="native-session-description" value={sessionForm.description_markdown} onChange={(event) => setSessionForm((current) => ({ ...current, description_markdown: event.target.value }))} rows={4} /></div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Delivery mode</Label><Select value={sessionForm.delivery_mode} onValueChange={(value) => setSessionForm((current) => ({ ...current, delivery_mode: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="internal">Internal</SelectItem><SelectItem value="external">Eksternal</SelectItem><SelectItem value="hybrid">Hybrid</SelectItem></SelectContent></Select></div>
              <div><Label>Status</Label><Select value={sessionForm.status} onValueChange={(value) => setSessionForm((current) => ({ ...current, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="draft">Draft</SelectItem><SelectItem value="published">Terbit</SelectItem><SelectItem value="archived">Arsip</SelectItem></SelectContent></Select></div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div><Label>Tipe sumber</Label><Select value={sessionForm.source_type} onValueChange={(value) => setSessionForm((current) => ({ ...current, source_type: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="native">Native PUB</SelectItem><SelectItem value="external">Platform eksternal</SelectItem></SelectContent></Select></div>
              <div><Label htmlFor="native-session-source-name">Nama sumber</Label><Input id="native-session-source-name" value={sessionForm.source_name} onChange={(event) => setSessionForm((current) => ({ ...current, source_name: event.target.value }))} /></div>
            </div>
            {sessionForm.source_type === "external" && <div><Label htmlFor="native-session-source-url">URL sumber (https://)</Label><Input id="native-session-source-url" value={sessionForm.source_url} onChange={(event) => setSessionForm((current) => ({ ...current, source_url: event.target.value }))} placeholder="https://..." /></div>}
            {sessionForm.source_type === "native" && sessionForm.delivery_mode !== "internal" && <div><Label>Kegiatan PUB sumber *</Label><Select value={sessionForm.source_activity_id || "none"} onValueChange={(value) => setSessionForm((current) => ({ ...current, source_activity_id: value === "none" ? "" : value }))}><SelectTrigger><SelectValue placeholder="Pilih kegiatan" /></SelectTrigger><SelectContent><SelectItem value="none">Pilih kegiatan</SelectItem>{activities.map((activity) => <SelectItem key={activity.id} value={activity.id}>{activity.title}</SelectItem>)}</SelectContent></Select></div>}
            <div className="grid gap-4 sm:grid-cols-3">
              <div><Label htmlFor="native-session-start">Mulai</Label><Input id="native-session-start" type="datetime-local" value={sessionForm.starts_at} onChange={(event) => setSessionForm((current) => ({ ...current, starts_at: event.target.value }))} /></div>
              <div><Label htmlFor="native-session-end">Selesai</Label><Input id="native-session-end" type="datetime-local" value={sessionForm.ends_at} onChange={(event) => setSessionForm((current) => ({ ...current, ends_at: event.target.value }))} /></div>
              <div><Label htmlFor="native-session-order">Urutan</Label><Input id="native-session-order" type="number" min="0" value={sessionForm.sort_order} onChange={(event) => setSessionForm((current) => ({ ...current, sort_order: event.target.value }))} /></div>
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Batal</Button><Button onClick={() => void saveSession()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan sesi</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "lesson"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editingLesson ? "Edit pelajaran" : "Tambah pelajaran"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2"><div><Label htmlFor="native-lesson-title">Judul *</Label><Input id="native-lesson-title" value={lessonForm.title} onChange={(event) => setLessonForm((current) => ({ ...current, title: event.target.value, slug: current.slug || slugify(event.target.value) }))} /></div><div><Label htmlFor="native-lesson-slug">Slug *</Label><Input id="native-lesson-slug" value={lessonForm.slug} onChange={(event) => setLessonForm((current) => ({ ...current, slug: slugify(event.target.value) }))} /></div></div>
            <div className="grid gap-4 sm:grid-cols-3">
              <div><Label>Sesi</Label><Select value={lessonForm.session_id || "none"} onValueChange={(value) => setLessonForm((current) => ({ ...current, session_id: value === "none" ? "" : value }))}><SelectTrigger><SelectValue placeholder="Tanpa sesi" /></SelectTrigger><SelectContent><SelectItem value="none">Tanpa sesi</SelectItem>{selectedSessions.map((session) => <SelectItem key={session.id} value={session.id}>{session.title}</SelectItem>)}</SelectContent></Select></div>
              <div><Label htmlFor="native-lesson-score">Nilai lulus</Label><Input id="native-lesson-score" type="number" min="0" max="100" value={lessonForm.passing_score} onChange={(event) => setLessonForm((current) => ({ ...current, passing_score: event.target.value }))} /></div>
              <div><Label htmlFor="native-lesson-order">Urutan</Label><Input id="native-lesson-order" type="number" min="0" value={lessonForm.sort_order} onChange={(event) => setLessonForm((current) => ({ ...current, sort_order: event.target.value }))} /></div>
            </div>
            <div><Label htmlFor="native-lesson-content">Isi markdown</Label><Textarea id="native-lesson-content" value={lessonForm.content_markdown} onChange={(event) => setLessonForm((current) => ({ ...current, content_markdown: event.target.value }))} rows={10} placeholder="Tulis materi utama pelajaran..." /></div>
            <div className="flex items-center justify-between rounded-lg border p-3"><div><Label htmlFor="native-lesson-published">Terbitkan pelajaran</Label><p className="text-xs text-muted-foreground">Pelajaran hanya tampil ke peserta jika kursus dan sesi juga terbit.</p></div><Switch id="native-lesson-published" checked={lessonForm.is_published} onCheckedChange={(checked) => setLessonForm((current) => ({ ...current, is_published: checked }))} /></div>
          </div>
          {Number(lessonForm.passing_score) > 0 && <p className="text-sm text-muted-foreground">{QUIZ_PUBLICATION_GUIDANCE}</p>}
          <DialogFooter><Button variant="outline" onClick={() => setDialog(null)}>Batal</Button><Button onClick={() => void saveLesson()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Simpan pelajaran</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={dialog === "material"} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editingMaterial ? "Edit materi" : "Tambah materi"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label htmlFor="native-material-title">Judul materi *</Label><Input id="native-material-title" value={materialForm.title} onChange={(event) => setMaterialForm((current) => ({ ...current, title: event.target.value }))} /></div>
            <div className="grid gap-4 sm:grid-cols-2"><div><Label>Jenis</Label><Select value={materialForm.material_type} onValueChange={(value) => { setMaterialForm((current) => ({ ...current, material_type: value })); setVideoFile(null); setUploadProgress(null); }}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="markdown">Markdown</SelectItem><SelectItem value="link">Tautan HTTPS</SelectItem><SelectItem value="video">Video privat</SelectItem></SelectContent></Select></div><div><Label htmlFor="native-material-order">Urutan</Label><Input id="native-material-order" type="number" min="0" value={materialForm.sort_order} onChange={(event) => setMaterialForm((current) => ({ ...current, sort_order: event.target.value }))} /></div></div>
            {materialForm.material_type === "markdown" && <div><Label htmlFor="native-material-content">Isi markdown *</Label><Textarea id="native-material-content" value={materialForm.content_markdown} onChange={(event) => setMaterialForm((current) => ({ ...current, content_markdown: event.target.value }))} rows={9} /></div>}
            {materialForm.material_type === "link" && <div><Label htmlFor="native-material-url">URL eksternal *</Label><Input id="native-material-url" value={materialForm.external_url} onChange={(event) => setMaterialForm((current) => ({ ...current, external_url: event.target.value }))} placeholder="https://..." /></div>}
            {materialForm.material_type === "video" && (
              <div className="space-y-3">
                <input ref={fileInputRef} id="native-material-video" type="file" accept="video/mp4,video/webm,.mp4,.webm" className="sr-only" onChange={(event) => selectVideoFile(event.target.files?.[0] ?? null)} />
                <button type="button" onClick={() => fileInputRef.current?.click()} className="flex min-h-36 w-full flex-col items-center justify-center rounded-xl border border-dashed border-pub-sky/40 bg-pub-sky/5 p-5 text-center transition hover:bg-pub-sky/10">
                  <Upload className="h-7 w-7 text-pub-sky" />
                  <span className="mt-3 text-sm font-semibold">{videoFile || materialForm.storage_path ? "Ganti file video" : "Pilih video untuk diunggah"}</span>
                  <span className="mt-1 text-xs text-muted-foreground">MP4 atau WebM · maksimum 500 MB</span>
                </button>
                {(videoFile || materialForm.storage_path) && (
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                    <FileVideo className="h-5 w-5 shrink-0 text-pub-amber" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{videoFile?.name ?? materialForm.file_name}</p>
                      <p className="text-xs text-muted-foreground">{videoFile?.type ?? materialForm.mime_type} · {formatFileSize(videoFile?.size ?? materialForm.file_size_bytes)}</p>
                    </div>
                  </div>
                )}
                {uploadProgress && (
                  <div
                    role="status"
                    aria-live="polite"
                    aria-label={`Progres upload video ${uploadProgress.percent}%`}
                    data-testid="video-upload-progress"
                    className="space-y-2 rounded-lg border border-pub-sky/25 bg-pub-sky/5 p-3"
                  >
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold text-foreground">Mengunggah video</span>
                      <span className="font-mono font-semibold text-pub-sky">{uploadProgress.percent}%</span>
                    </div>
                    <Progress value={uploadProgress.percent} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {formatUploadBytes(uploadProgress.loaded)} dari {formatUploadBytes(uploadProgress.total)} terkirim
                    </p>
                  </div>
                )}
                <p className="text-xs leading-relaxed text-muted-foreground">File disimpan privat. Peserta memperoleh tautan sementara hanya setelah masuk dan terdaftar pada kursus.</p>
              </div>
            )}
            <div className="flex items-center justify-between rounded-lg border p-3"><div><Label htmlFor="native-material-published">Terbitkan materi</Label><p className="text-xs text-muted-foreground">Materi draft tetap hanya dapat dikelola admin.</p></div><Switch id="native-material-published" checked={materialForm.is_published} onCheckedChange={(checked) => setMaterialForm((current) => ({ ...current, is_published: checked }))} /></div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setDialog(null)} disabled={saving}>Batal</Button><Button onClick={() => void saveMaterial()} disabled={saving}>{saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} {saving && materialForm.material_type === "video" && videoFile ? `Mengunggah ${uploadProgress?.percent ?? 0}%` : "Simpan materi"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}