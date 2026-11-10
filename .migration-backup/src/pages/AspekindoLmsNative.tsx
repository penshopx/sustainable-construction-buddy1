import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileVideo,
  GraduationCap,
  LayoutList,
  Loader2,
  LockKeyhole,
  PlayCircle,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  Trophy,
  Users,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import {
  useAspekindoLmsCatalog,
  useAspekindoLmsCompletionRecords,
  useAspekindoLmsCourse,
  useAspekindoLmsMyEnrollments,
  useAspekindoLmsMyProgress,
  useAspekindoLmsQuizAttempts,
  useAspekindoLmsQuizQuestions,
  useCompleteAspekindoLmsCourse,
  useCompleteAspekindoLmsLesson,
  useEnrollAspekindoLmsCourse,
  useSaveAspekindoLmsProgress,
  useSubmitAspekindoLmsQuiz,
  type AspekindoLmsCatalogCourse,
  type Enrollment,
  type Lesson,
  type Material,
  type QuizAttempt,
  useAspekindoLmsVideoUrl,
} from "@/hooks/useAspekindoLms";
import type { Json } from "@/integrations/supabase/types";
import { MarkdownRenderer } from "@/components/ui/markdown-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

const DELIVERY_LABELS: Record<string, string> = {
  internal: "Internal PUB ASPEKINDO",
  external: "Platform eksternal",
  hybrid: "Hybrid",
};

const STATUS_LABELS: Record<string, string> = {
  enrolled: "Terdaftar",
  in_progress: "Sedang belajar",
  completed: "Selesai",
  withdrawn: "Dibatalkan",
};

function formatDate(value: string | null | undefined) {
  if (!value) return "Belum ditentukan";
  return new Intl.DateTimeFormat("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function safeHttps(value: string) {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

function jsonStrings(value: Json): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string")
    ? value
    : [];
}

function courseProgress(course: AspekindoLmsCatalogCourse, progress: { lesson_id: string; status: string }[]) {
  const lessons = course.lessons;
  if (!lessons.length) return 0;
  const completed = lessons.filter((lesson) =>
    progress.some((item) => item.lesson_id === lesson.id && item.status === "completed"),
  ).length;
  return Math.round((completed / lessons.length) * 100);
}

function statusStyle(status: string | undefined) {
  if (status === "completed") return "border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300";
  if (status === "in_progress") return "border-pub-sky/30 bg-pub-sky/10 text-pub-sky";
  return "border-border bg-muted/50 text-muted-foreground";
}

function formatFileSize(bytes: number) {
  if (!bytes) return "";
  return `${(bytes / 1024 / 1024).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
}

function VideoMaterialPlayer({ material }: { material: Material }) {
  const [playbackError, setPlaybackError] = useState(false);
  const videoQuery = useAspekindoLmsVideoUrl(material.storage_path, true);

  useEffect(() => {
    setPlaybackError(false);
  }, [videoQuery.data]);

  if (videoQuery.isLoading) {
    return (
      <div className="flex aspect-video items-center justify-center rounded-xl bg-[hsl(220,60%,8%)] text-sm font-semibold text-white/75">
        <Loader2 className="mr-2 h-5 w-5 animate-spin text-pub-sky" /> Menyiapkan video privat...
      </div>
    );
  }

  if (videoQuery.isError || !videoQuery.data || playbackError) {
    return (
      <div className="flex aspect-video flex-col items-center justify-center rounded-xl bg-[hsl(220,60%,8%)] px-6 text-center text-white">
        <CircleAlert className="h-8 w-8 text-pub-amber" />
        <p className="mt-3 font-semibold">Video belum dapat diputar</p>
        <p className="mt-1 max-w-md text-xs leading-relaxed text-white/60">
          Tautan video mungkin kedaluwarsa atau file belum tersedia. Muat ulang untuk membuat tautan sementara baru.
        </p>
        <Button
          size="sm"
          variant="secondary"
          className="mt-4"
          onClick={() => {
            setPlaybackError(false);
            void videoQuery.refetch();
          }}
        >
          <RefreshCw className="mr-2 h-4 w-4" /> Muat ulang video
        </Button>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl bg-[hsl(220,60%,8%)]">
      <video
        key={videoQuery.data}
        className="aspect-video w-full bg-black object-contain"
        controls
        controlsList="nodownload"
        playsInline
        preload="metadata"
        onError={() => setPlaybackError(true)}
      >
        <source src={videoQuery.data} type={material.mime_type} />
        Browser Anda belum mendukung pemutaran video ini.
      </video>
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-xs text-white/65">
        <span className="flex items-center gap-2 font-semibold text-white"><FileVideo className="h-4 w-4 text-pub-sky" /> Video pembelajaran</span>
        <span>{material.mime_type.replace("video/", "").toUpperCase()} · {formatFileSize(material.file_size_bytes)}</span>
      </div>
    </div>
  );
}

function CatalogCard({
  course,
  enrollment,
  progress,
}: {
  course: AspekindoLmsCatalogCourse;
  enrollment?: Enrollment;
  progress: { lesson_id: string; status: string }[];
}) {
  const percent = courseProgress(course, progress);
  const action = enrollment?.status === "completed" ? "Selesai" : enrollment ? "Lanjutkan" : "Daftar";
  const publishedLessons = course.lessons.length;

  return (
    <Card className="group flex h-full flex-col overflow-hidden shadow-card transition-all hover:-translate-y-0.5 hover:shadow-lg">
      <div className="h-1.5 bg-gradient-to-r from-pub-sky via-pub-emerald to-pub-amber" />
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <Badge variant="outline" className="border-pub-sky/30 bg-pub-sky/10 text-pub-sky">
            {course.course_code}
          </Badge>
          <Badge variant="outline" className={statusStyle(enrollment?.status)}>
            {STATUS_LABELS[enrollment?.status ?? ""] ?? "Belum terdaftar"}
          </Badge>
        </div>
        <CardTitle className="pt-3 text-xl">{course.title}</CardTitle>
        <CardDescription className="line-clamp-3 leading-relaxed">
          {course.description_markdown.replace(/[#*_`]/g, "").slice(0, 220) || "Pembelajaran terstruktur untuk anggota ASPEKINDO."}
        </CardDescription>
      </CardHeader>
      <CardContent className="mt-auto space-y-4">
        <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><LayoutList className="h-3.5 w-3.5 text-pub-sky" /> {publishedLessons} pelajaran</span>
          <span className="flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-pub-amber" /> {course.audience || "Anggota BUJK"}</span>
        </div>
        {course.agenda && (
          <Link to="/agenda-pub" className="flex items-start gap-1.5 text-xs font-semibold text-pub-emerald hover:underline">
            <CalendarDays className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>Agenda terkait: {course.agenda.title}</span>
          </Link>
        )}
        {enrollment && (
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs text-muted-foreground"><span>Progres</span><span>{percent}%</span></div>
            <Progress value={percent} className="h-2" />
          </div>
        )}
        <Button asChild className="w-full" variant={enrollment ? "default" : "outline"}>
          <Link to={`/aspekindo-lms/kursus/${course.id}`}>
            {action} <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function CompletionSummary() {
  const { user } = useAuth();
  const recordsQuery = useAspekindoLmsCompletionRecords(user?.id);
  const records = recordsQuery.data ?? [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base"><FileCheck2 className="h-5 w-5 text-pub-emerald" /> Aktivitas PUB selesai</CardTitle>
        <CardDescription>Catatan bukti yang siap ditinjau untuk persiapan rekap LKUT.</CardDescription>
      </CardHeader>
      <CardContent>
        {recordsQuery.isLoading ? (
          <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Memuat catatan bukti...</div>
        ) : records.length === 0 ? (
          <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
            Belum ada aktivitas pembelajaran yang selesai. Setelah semua pelajaran dituntaskan, catatan bukti akan muncul di sini.
          </div>
        ) : (
          <div className="space-y-3">
            {records.slice(0, 5).map((record) => (
              <div key={record.id} className="rounded-lg border bg-muted/30 p-3">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-sm font-semibold">{record.evidence_title}</p>
                  <Badge variant="outline" className="shrink-0 text-[10px]">{record.status === "ready_for_review" ? "Siap ditinjau" : record.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Sumber: LMS ASPEKINDO · {formatDate(record.issued_at)}
                </p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground">{record.record_number}</p>
              </div>
            ))}
          </div>
        )}
        <p className="mt-4 text-xs text-muted-foreground">
          Catatan ini membantu review admin dan tidak menggantikan pengiriman ke aplikasi resmi Kementerian PU/LPJK.
        </p>
      </CardContent>
    </Card>
  );
}

export function AspekindoLmsCatalog() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<"all" | "active" | "completed" | "available">("all");
  const catalogQuery = useAspekindoLmsCatalog();
  const enrollmentsQuery = useAspekindoLmsMyEnrollments(user?.id);
  const progressQuery = useAspekindoLmsMyProgress({ userId: user?.id });
  const courses = useMemo(() => catalogQuery.data ?? [], [catalogQuery.data]);
  const enrollments = useMemo(() => enrollmentsQuery.data ?? [], [enrollmentsQuery.data]);
  const allProgress = useMemo(() => progressQuery.data ?? [], [progressQuery.data]);
  const enrollmentMap = useMemo(() => new Map(enrollments.map((item) => [item.course_id, item])), [enrollments]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return courses.filter((course) => {
      const enrollment = enrollmentMap.get(course.id);
      const matchesSearch = !query || `${course.title} ${course.description_markdown} ${course.audience}`.toLowerCase().includes(query);
      const matchesStatus =
        status === "all" ||
        (status === "available" && !enrollment) ||
        (status === "active" && Boolean(enrollment && enrollment.status !== "completed")) ||
        (status === "completed" && enrollment?.status === "completed");
      return matchesSearch && matchesStatus;
    });
  }, [courses, enrollmentMap, search, status]);
  const activeCourses = enrollments.filter((item) => item.status !== "completed").length;
  const completedCourses = enrollments.filter((item) => item.status === "completed").length;

  useEffect(() => {
    if (catalogQuery.error) {
      toast({ title: "Katalog LMS belum dapat dimuat", description: "Coba muat ulang halaman atau hubungi admin.", variant: "destructive" });
    }
  }, [catalogQuery.error, toast]);

  if (catalogQuery.isLoading || enrollmentsQuery.isLoading || progressQuery.isLoading) {
    return <div className="flex min-h-[360px] items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Memuat LMS ASPEKINDO...</div>;
  }

  if (catalogQuery.isError) {
    return (
      <Card className="border-destructive/30">
        <CardContent className="flex flex-col items-center gap-3 py-16 text-center">
          <CircleAlert className="h-9 w-9 text-destructive" />
          <p className="font-semibold">Katalog belum tersedia</p>
          <p className="max-w-md text-sm text-muted-foreground">Terjadi kendala saat mengambil pembelajaran terbit. Silakan coba lagi.</p>
          <Button variant="outline" onClick={() => void catalogQuery.refetch()}>Coba lagi</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="overflow-hidden rounded-2xl bg-hero p-6 text-primary-foreground md:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">Ruang belajar internal PUB ASPEKINDO</Badge>
            <h1 className="mt-4 text-3xl font-extrabold font-heading md:text-4xl">LMS ASPEKINDO</h1>
            <h2 className="mt-2 text-lg font-bold font-heading md:text-xl">Kegiatan & pembelajaran anggota</h2>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-primary-foreground/75 md:text-base">
              Temukan sesi terbit, belajar secara berurutan, dan simpan catatan penyelesaian untuk persiapan LKUT. Kegiatan eksternal tetap membuka platform asal tanpa klaim SSO.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button asChild variant="secondary" size="sm"><Link to="/aspekindo-aktivitas"><CalendarDays className="mr-2 h-4 w-4" /> Aktivitas & bukti PUB</Link></Button>
              <Button asChild variant="outline" size="sm" className="border-white/25 bg-white/5 text-white hover:bg-white/10 hover:text-white"><Link to="/agenda-pub">Lihat agenda publik</Link></Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-white/15 bg-white/10 px-5 py-4"><p className="text-xs text-primary-foreground/65">Sedang belajar</p><p className="mt-1 text-2xl font-bold">{activeCourses}</p></div>
            <div className="rounded-xl border border-white/15 bg-white/10 px-5 py-4"><p className="text-xs text-primary-foreground/65">Selesai</p><p className="mt-1 text-2xl font-bold">{completedCourses}</p></div>
          </div>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr,320px]">
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold font-heading">Katalog pembelajaran ASPEKINDO</h2>
            <p className="mt-1 text-sm text-muted-foreground">Hanya sesi dan kursus berstatus terbit yang tampil untuk peserta.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input aria-label="Cari pembelajaran ASPEKINDO" placeholder="Cari judul atau sasaran peserta..." value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" />
            </div>
            <div className="flex gap-1 overflow-x-auto rounded-lg border bg-muted/40 p-1">
              {([["all", "Semua"], ["active", "Saya ikuti"], ["available", "Belum daftar"], ["completed", "Selesai"]] as const).map(([value, label]) => (
                <Button key={value} size="sm" variant={status === value ? "default" : "ghost"} onClick={() => setStatus(value)} className="shrink-0 text-xs">{label}</Button>
              ))}
            </div>
          </div>
          {courses.length === 0 ? (
            <Card className="border-dashed"><CardContent className="py-14 text-center"><GraduationCap className="mx-auto h-10 w-10 text-muted-foreground/60" /><p className="mt-3 font-semibold">Belum ada pembelajaran terbit</p><p className="mt-1 text-sm text-muted-foreground">Admin akan menampilkan kursus di sini setelah siap diikuti.</p></CardContent></Card>
          ) : filtered.length === 0 ? (
            <Card className="border-dashed"><CardContent className="py-12 text-center"><Search className="mx-auto h-8 w-8 text-muted-foreground/60" /><p className="mt-3 font-semibold">Tidak ada hasil yang cocok</p><p className="mt-1 text-sm text-muted-foreground">Ubah kata kunci atau filter status.</p></CardContent></Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">{filtered.map((course) => <CatalogCard key={course.id} course={course} enrollment={enrollmentMap.get(course.id)} progress={allProgress.filter((item) => item.course_id === course.id)} />)}</div>
          )}
        </section>
        <aside className="space-y-4">
          <CompletionSummary />
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-5 w-5 text-pub-sky" /> Catatan belajar</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p>Pelajaran dibuka sesuai urutan. Kuis, jika tersedia, harus lulus sebelum pelajaran dapat ditandai selesai.</p>
              <p className="flex items-start gap-2"><Target className="mt-0.5 h-4 w-4 shrink-0 text-pub-amber" /> Bukti pembelajaran bersifat bahan review, bukan pengajuan resmi.</p>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function SessionList({ course }: { course: AspekindoLmsCatalogCourse }) {
  const sessions = course.sessions;
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2 text-base"><CalendarDays className="h-5 w-5 text-pub-amber" /> Sesi dan format</CardTitle><CardDescription>Label sumber menjelaskan jalur belajar tanpa mengklaim integrasi platform eksternal.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        {sessions.length === 0 ? <p className="text-sm text-muted-foreground">Belum ada sesi terbit di kursus ini.</p> : sessions.map((session) => (
          <div key={session.id} className="rounded-xl border p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div><p className="font-semibold">{session.title}</p><p className="mt-1 text-xs text-muted-foreground">{session.source_name}</p></div>
              <Badge variant="outline" className={session.delivery_mode === "external" ? "border-pub-amber/30 bg-pub-amber/10 text-pub-amber" : "border-pub-sky/30 bg-pub-sky/10 text-pub-sky"}>{DELIVERY_LABELS[session.delivery_mode] ?? session.delivery_mode}</Badge>
            </div>
            {session.description_markdown && <div className="mt-2"><MarkdownRenderer>{session.description_markdown}</MarkdownRenderer></div>}
            {(session.starts_at || session.ends_at) && <p className="mt-2 flex items-center gap-2 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" /> {formatDate(session.starts_at)}{session.ends_at ? ` — ${formatDate(session.ends_at)}` : ""}</p>}
            {session.delivery_mode !== "internal" && safeHttps(session.source_url) ? <Button asChild size="sm" variant="outline" className="mt-3"><a href={session.source_url} target="_blank" rel="noopener noreferrer">Buka platform asal <ExternalLink className="ml-2 h-3.5 w-3.5" /></a></Button> : session.delivery_mode !== "internal" ? <p className="mt-3 text-xs text-pub-amber">Tautan platform asal belum tersedia.</p> : null}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function AspekindoLmsCourseDetail() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const courseQuery = useAspekindoLmsCourse(courseId);
  const enrollmentsQuery = useAspekindoLmsMyEnrollments(user?.id);
  const enrollment = enrollmentsQuery.data?.find((item) => item.course_id === courseId);
  const progressQuery = useAspekindoLmsMyProgress({ userId: user?.id, courseId, enrollmentId: enrollment?.id });
  const course = courseQuery.data;
  const lessons = useMemo(() => course?.lessons ?? [], [course?.lessons]);
  const [selectedLessonId, setSelectedLessonId] = useState<string>();
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [quizResult, setQuizResult] = useState<QuizAttempt>();
  const [quizStarted, setQuizStarted] = useState(false);
  const startedLessonRef = useRef<string>();
  const enrollMutation = useEnrollAspekindoLmsCourse();
  const saveProgressMutation = useSaveAspekindoLmsProgress();
  const completeLessonMutation = useCompleteAspekindoLmsLesson();
  const questionsQuery = useAspekindoLmsQuizQuestions(selectedLessonId && enrollment ? selectedLessonId : undefined);
  const attemptsQuery = useAspekindoLmsQuizAttempts({ enrollmentId: enrollment?.id, lessonId: selectedLessonId });
  const submitQuizMutation = useSubmitAspekindoLmsQuiz();
  const completeCourseMutation = useCompleteAspekindoLmsCourse();
  const progress = useMemo(() => progressQuery.data ?? [], [progressQuery.data]);
  const completedIds = useMemo(() => new Set(progress.filter((item) => item.status === "completed").map((item) => item.lesson_id)), [progress]);
  const selectedLesson = lessons.find((lesson) => lesson.id === selectedLessonId);
  const selectedIndex = selectedLesson ? lessons.findIndex((lesson) => lesson.id === selectedLesson.id) : -1;
  const previousLessonCompleted = selectedIndex <= 0 || completedIds.has(lessons[selectedIndex - 1]?.id);
  const selectedCompleted = Boolean(selectedLesson && completedIds.has(selectedLesson.id));
  const percent = lessons.length ? Math.round((completedIds.size / lessons.length) * 100) : 0;
  const latestAttempt = quizResult ?? attemptsQuery.data?.[0];

  useEffect(() => {
    if (!selectedLessonId && enrollment && lessons.length) {
      const lastInProgress = progress.find((item) => item.status === "in_progress");
      const nextLesson = lessons.find((lesson) => !completedIds.has(lesson.id));
      setSelectedLessonId(lastInProgress?.lesson_id ?? nextLesson?.id ?? lessons[lessons.length - 1].id);
    }
  }, [completedIds, enrollment, lessons, progress, selectedLessonId]);

  useEffect(() => {
    if (!selectedLesson || !enrollment || !user || selectedCompleted) return;
    const current = progress.find((item) => item.lesson_id === selectedLesson.id);
    const operationKey = `${enrollment.id}:${selectedLesson.id}`;
    if (current || startedLessonRef.current === operationKey) return;
    startedLessonRef.current = operationKey;
    saveProgressMutation.mutate({
      enrollment_id: enrollment.id,
      course_id: selectedLesson.course_id,
      lesson_id: selectedLesson.id,
      user_id: user.id,
      status: "in_progress",
      progress_percent: 1,
      started_at: new Date().toISOString(),
    }, {
      onError: () => {
        startedLessonRef.current = undefined;
        toast({ title: "Progres belum tersimpan", description: "Coba buka pelajaran lagi.", variant: "destructive" });
      },
    });
  }, [enrollment, progress, saveProgressMutation, selectedCompleted, selectedLesson, toast, user]);

  useEffect(() => {
    setAnswers({});
    setQuizResult(undefined);
    setQuizStarted(false);
  }, [selectedLessonId]);

  const selectLesson = (lesson: Lesson, index: number) => {
    if (!enrollment) {
      toast({ title: "Daftar terlebih dahulu", description: "Daftar kursus untuk membuka pelajaran.", variant: "destructive" });
      return;
    }
    if (index > 0 && !completedIds.has(lessons[index - 1].id)) {
      toast({ title: "Pelajaran masih terkunci", description: "Selesaikan pelajaran sebelumnya terlebih dahulu.", variant: "destructive" });
      return;
    }
    setSelectedLessonId(lesson.id);
  };

  const submitQuiz = () => {
    if (!selectedLesson || !questionsQuery.data?.length || Object.keys(answers).length !== questionsQuery.data.length) {
      toast({ title: "Jawaban belum lengkap", description: "Jawab semua soal sebelum mengirim kuis.", variant: "destructive" });
      return;
    }
    submitQuizMutation.mutate({ lessonId: selectedLesson.id, answers }, {
      onSuccess: (attempt) => { setQuizResult(attempt); setQuizStarted(false); },
      onError: (error) => toast({ title: "Kuis belum dapat dikirim", description: error.message, variant: "destructive" }),
    });
  };

  if (courseQuery.isLoading || enrollmentsQuery.isLoading) return <div className="flex min-h-[360px] items-center justify-center gap-2 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /> Memuat detail pembelajaran...</div>;
  if (courseQuery.isError || !course) return <Card><CardContent className="flex flex-col items-center gap-3 py-16 text-center"><CircleAlert className="h-9 w-9 text-destructive" /><p className="font-semibold">Pembelajaran tidak ditemukan</p><p className="text-sm text-muted-foreground">Kursus mungkin masih draft, sudah diarsipkan, atau tautannya tidak valid.</p><Button variant="outline" onClick={() => navigate("/aspekindo-lms")}>Kembali ke LMS ASPEKINDO</Button></CardContent></Card>;

  return (
    <div className="mx-auto max-w-7xl space-y-5">
      <Button variant="ghost" onClick={() => navigate("/aspekindo-lms")} className="-ml-2"><ArrowLeft className="mr-2 h-4 w-4" /> Kembali ke katalog</Button>
      <div className="overflow-hidden rounded-2xl bg-hero p-6 text-primary-foreground md:p-8">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div><Badge className="border-white/20 bg-white/10 text-white hover:bg-white/10">{course.course_code}</Badge><h1 className="mt-4 text-3xl font-extrabold font-heading md:text-4xl">{course.title}</h1><p className="mt-2 max-w-3xl text-sm leading-relaxed text-primary-foreground/75">{course.audience ? `Sasaran peserta: ${course.audience}` : "Pembelajaran untuk anggota ASPEKINDO."}</p></div>
          {enrollment ? <div className="min-w-[220px] rounded-xl border border-white/15 bg-white/10 p-4"><div className="flex justify-between text-xs text-primary-foreground/70"><span>Progres kursus</span><span>{percent}%</span></div><Progress value={percent} className="mt-2 h-2 bg-white/20" /></div> : <Button onClick={() => enrollMutation.mutate(course.id, { onError: (error) => toast({ title: "Pendaftaran gagal", description: error.message.includes("duplicate") ? "Anda sudah terdaftar di kursus ini." : error.message, variant: "destructive" }), onSuccess: () => toast({ title: "Pendaftaran berhasil", description: "Pelajaran pertama sekarang dapat dibuka." }) })} disabled={enrollMutation.isPending} variant="secondary">{enrollMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Daftar kursus</Button>}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr),330px]">
        <main className="space-y-5">
          {course.description_markdown && <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Target className="h-5 w-5 text-pub-sky" /> Tujuan pembelajaran</CardTitle></CardHeader><CardContent><MarkdownRenderer>{course.description_markdown}</MarkdownRenderer></CardContent></Card>}
          <SessionList course={course} />
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><BookOpen className="h-5 w-5 text-pub-emerald" /> Pelajaran berurutan</CardTitle><CardDescription>{enrollment ? "Buka pelajaran aktif. Pelajaran berikutnya terbuka setelah pelajaran sebelumnya selesai." : "Daftar kursus untuk membuka materi dan kuis."}</CardDescription></CardHeader>
            <CardContent className="space-y-2">
              {lessons.length === 0 ? <p className="rounded-lg border border-dashed p-5 text-sm text-muted-foreground">Belum ada pelajaran terbit.</p> : lessons.map((lesson, index) => {
                const locked = !enrollment || (index > 0 && !completedIds.has(lessons[index - 1].id));
                const completed = completedIds.has(lesson.id);
                return <button key={lesson.id} type="button" onClick={() => selectLesson(lesson, index)} className={`flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-colors ${selectedLessonId === lesson.id ? "border-pub-sky bg-pub-sky/10" : "hover:bg-muted/50"} ${locked ? "cursor-not-allowed opacity-60" : ""}`}><span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${completed ? "bg-pub-emerald text-white" : "bg-muted text-muted-foreground"}`}>{completed ? <Check className="h-4 w-4" /> : index + 1}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{lesson.title}</span><span className="mt-1 block text-xs text-muted-foreground">{lesson.passing_score > 0 ? `Kuis lulus minimal ${lesson.passing_score}%` : "Materi pembelajaran"}</span></span>{locked ? <LockKeyhole className="h-4 w-4 text-muted-foreground" /> : completed ? <CheckCircle2 className="h-5 w-5 text-pub-emerald" /> : <ArrowRight className="h-4 w-4 text-muted-foreground" />}</button>;
              })}
            </CardContent>
          </Card>
          {selectedLesson && enrollment && previousLessonCompleted && (
            <Card>
              <CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><Badge variant="outline">Pelajaran {selectedIndex + 1} dari {lessons.length}</Badge><CardTitle className="mt-2 text-2xl">{selectedLesson.title}</CardTitle></div>{selectedCompleted && <Badge className="bg-pub-emerald text-white">Selesai</Badge>}</div></CardHeader>
              <CardContent className="space-y-5">
                <MarkdownRenderer>{selectedLesson.content_markdown || "Materi belum memiliki isi Markdown."}</MarkdownRenderer>
                {selectedLesson.materials.length > 0 && <div className="space-y-3"><h3 className="font-semibold">Materi pendukung</h3>{selectedLesson.materials.map((material) => <div key={material.id} className={material.material_type === "video" ? "space-y-3" : "rounded-lg border p-3"}><p className="text-sm font-semibold">{material.title}</p>{material.material_type === "video" && <VideoMaterialPlayer material={material} />}{material.content_markdown && <MarkdownRenderer>{material.content_markdown}</MarkdownRenderer>}{safeHttps(material.external_url) && <a className="mt-2 inline-flex items-center text-sm text-pub-sky hover:underline" href={material.external_url} target="_blank" rel="noopener noreferrer">Buka tautan aman <ExternalLink className="ml-1 h-3.5 w-3.5" /></a>}</div>)}</div>}
                {questionsQuery.isLoading ? <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Menyiapkan kuis...</div> : questionsQuery.data && questionsQuery.data.length > 0 ? <div className="rounded-xl border bg-muted/20 p-4"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="flex items-center gap-2 font-semibold"><Trophy className="h-4 w-4 text-pub-amber" /> Kuis pelajaran</h3><p className="mt-1 text-xs text-muted-foreground">Nilai lulus minimal {selectedLesson.passing_score}% dan jawaban dinilai di server.</p></div>{!quizStarted && !quizResult && <Button onClick={() => setQuizStarted(true)} variant="outline"><PlayCircle className="mr-2 h-4 w-4" /> Mulai kuis</Button>}</div>{latestAttempt && !quizStarted && <div className={`mt-4 rounded-lg border p-3 text-sm ${latestAttempt.passed ? "border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300" : "border-pub-amber/30 bg-pub-amber/10"}`}><p className="font-semibold">{latestAttempt.passed ? "Kuis lulus" : "Kuis belum lulus"} · Skor {latestAttempt.score}%</p><p className="mt-1 text-xs">Percobaan ke-{latestAttempt.attempt_number} · {formatDate(latestAttempt.submitted_at)}</p>{!latestAttempt.passed && <Button size="sm" className="mt-3" onClick={() => { setQuizResult(undefined); setQuizStarted(true); }}>Coba lagi</Button>}</div>}{quizStarted && <div className="mt-4 space-y-4">{questionsQuery.data.map((question, index) => <div key={question.id} className="rounded-lg border bg-background p-4"><p className="text-sm font-semibold">{index + 1}. {question.question_text}</p><div className="mt-3 space-y-2">{jsonStrings(question.options).map((option, optionIndex) => <label key={`${question.id}-${optionIndex}`} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-3 text-sm ${answers[question.id] === optionIndex ? "border-pub-sky bg-pub-sky/10" : "hover:bg-muted/50"}`}><input type="radio" name={question.id} checked={answers[question.id] === optionIndex} onChange={() => setAnswers((current) => ({ ...current, [question.id]: optionIndex }))} className="mt-0.5" />{option}</label>)}</div></div>)}<Button onClick={submitQuiz} disabled={submitQuizMutation.isPending}>{submitQuizMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Kirim jawaban</Button></div>}</div> : null}
                <div className="flex flex-col justify-between gap-3 border-t pt-4 sm:flex-row sm:items-center">{selectedCompleted ? <p className="flex items-center gap-2 text-sm font-semibold text-pub-emerald"><CheckCircle2 className="h-4 w-4" /> Pelajaran ini sudah selesai</p> : <Button onClick={() => completeLessonMutation.mutate(selectedLesson.id, { onError: (error) => toast({ title: "Pelajaran belum dapat diselesaikan", description: error.message, variant: "destructive" }), onSuccess: () => toast({ title: "Pelajaran selesai", description: "Pelajaran berikutnya sekarang terbuka." }) })} disabled={completeLessonMutation.isPending || (questionsQuery.data?.length ?? 0) > 0 && !latestAttempt?.passed}>{completeLessonMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Tandai pelajaran selesai</Button>}<p className="text-xs text-muted-foreground">Progres tersimpan otomatis saat pelajaran dibuka.</p></div>
              </CardContent>
            </Card>
          )}
        </main>
        <aside className="space-y-4">
          <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="h-5 w-5 text-pub-sky" /> Status peserta</CardTitle></CardHeader><CardContent className="space-y-3 text-sm"><div className="flex justify-between"><span className="text-muted-foreground">Status</span><Badge variant="outline" className={statusStyle(enrollment?.status)}>{STATUS_LABELS[enrollment?.status ?? ""] ?? "Belum terdaftar"}</Badge></div><div className="flex justify-between"><span className="text-muted-foreground">Pelajaran selesai</span><span className="font-semibold">{completedIds.size}/{lessons.length}</span></div>{enrollment?.enrolled_at && <p className="text-xs text-muted-foreground">Terdaftar {formatDate(enrollment.enrolled_at)}</p>}</CardContent></Card>
          {enrollment && percent === 100 && enrollment.status !== "completed" && <Card className="border-pub-emerald/30 bg-pub-emerald/5"><CardHeader><CardTitle className="text-base">Semua pelajaran selesai</CardTitle><CardDescription>Buat catatan bukti penyelesaian untuk rekap LKUT.</CardDescription></CardHeader><CardContent><Button className="w-full" onClick={() => completeCourseMutation.mutate(course.id, { onError: (error) => toast({ title: "Kursus belum dapat diselesaikan", description: error.message, variant: "destructive" }), onSuccess: () => toast({ title: "Pembelajaran selesai", description: "Catatan bukti siap ditinjau admin." }) })} disabled={completeCourseMutation.isPending}>{completeCourseMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Buat catatan bukti</Button></CardContent></Card>}
          {!enrollment && <Card className="border-pub-amber/30 bg-pub-amber/5"><CardContent className="space-y-3 p-5"><p className="font-semibold">Belum terdaftar</p><p className="text-sm text-muted-foreground">Daftar sekali untuk membuka urutan pelajaran dan menyimpan progres Anda.</p><Button className="w-full" onClick={() => enrollMutation.mutate(course.id, { onError: (error) => toast({ title: "Pendaftaran gagal", description: error.message, variant: "destructive" }), onSuccess: () => toast({ title: "Pendaftaran berhasil" }) })} disabled={enrollMutation.isPending}>Daftar sekarang</Button></CardContent></Card>}
        </aside>
      </div>
    </div>
  );
}