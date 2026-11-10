import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database, Json, Tables, TablesInsert } from "@/integrations/supabase/types";
import { issueVideoSignedUrl, VIDEO_URL_FRESH_MS } from "@/lib/lmsVideoUrl";

export type Course = Tables<"aspekindo_lms_courses">;
export type Session = Tables<"aspekindo_lms_sessions">;
export type Lesson = Tables<"aspekindo_lms_lessons">;
export type Material = Tables<"aspekindo_lms_materials">;
export type Enrollment = Tables<"aspekindo_lms_enrollments">;
export type LessonProgress = Tables<"aspekindo_lms_lesson_progress">;
export type QuizQuestion = Tables<"aspekindo_lms_quiz_questions">;
export type QuizAttempt = Tables<"aspekindo_lms_quiz_attempts">;
export type CompletionRecord = Tables<"aspekindo_lms_completion_records">;
export type AspekindoLmsAgendaSummary = Pick<
  Tables<"aspekindo_learning_agendas">,
  "id" | "title" | "start_date" | "status"
>;
type WritableLessonProgress = Omit<
  TablesInsert<"aspekindo_lms_lesson_progress">,
  "status" | "completed_at"
> & {
  status: "not_started" | "in_progress";
  completed_at?: null;
};

export type AspekindoLmsCatalogCourse = Course & {
  sessions: Session[];
  lessons: Array<Lesson & { materials: Material[] }>;
  agenda?: AspekindoLmsAgendaSummary | null;
};

export type AspekindoLmsCourseDetail = AspekindoLmsCatalogCourse;
export type AspekindoLmsPublicCourse = Pick<
  Course,
  | "id"
  | "course_code"
  | "slug"
  | "title"
  | "description_markdown"
  | "audience"
  | "member_only"
  | "siap_focus"
  | "published_at"
  | "public_landing_enabled"
>;

async function fetchCourseContent(
  course: Course,
  agenda: AspekindoLmsAgendaSummary | null = null,
): Promise<AspekindoLmsCatalogCourse> {
  const [sessionsResult, lessonsResult] = await Promise.all([
    supabase
      .from("aspekindo_lms_sessions")
      .select("*")
      .eq("course_id", course.id)
      .order("sort_order"),
    supabase
      .from("aspekindo_lms_lessons")
      .select("*")
      .eq("course_id", course.id)
      .order("sort_order"),
  ]);

  if (sessionsResult.error) throw sessionsResult.error;
  if (lessonsResult.error) throw lessonsResult.error;

  const lessons = lessonsResult.data ?? [];
  const materialsResult = lessons.length
    ? await supabase
        .from("aspekindo_lms_materials")
        .select("*")
        .in("lesson_id", lessons.map((lesson) => lesson.id))
        .order("sort_order")
    : { data: [] as Material[], error: null };

  if (materialsResult.error) throw materialsResult.error;
  const materials = materialsResult.data ?? [];

  return {
    ...course,
    agenda,
    sessions: sessionsResult.data ?? [],
    lessons: lessons.map((lesson) => ({
      ...lesson,
      materials: materials.filter((material) => material.lesson_id === lesson.id),
    })),
  };
}

export function useAspekindoLmsCatalog() {
  return useQuery({
    queryKey: ["aspekindo-lms", "catalog"],
    queryFn: async () => {
      const [coursesResult, agendasResult] = await Promise.all([
        supabase
          .from("aspekindo_lms_courses")
          .select("*")
          .eq("status", "published")
          .order("created_at", { ascending: false }),
        supabase
          .from("aspekindo_learning_agendas")
          .select("id, title, start_date, status")
          .eq("status", "published"),
      ]);
      if (coursesResult.error) throw coursesResult.error;
      const agendaMap = new Map((agendasResult.data ?? []).map((agenda) => [agenda.id, agenda]));
      return Promise.all((coursesResult.data ?? []).map((course) => fetchCourseContent(course, course.agenda_id ? agendaMap.get(course.agenda_id) ?? null : null)));
    },
  });
}

export function useAspekindoLmsCourse(courseId: string | undefined) {
  return useQuery({
    queryKey: ["aspekindo-lms", "course", courseId],
    enabled: Boolean(courseId),
    retry: false,
    queryFn: async () => {
      if (!courseId) throw new Error("Kursus belum dipilih.");
      const { data, error } = await supabase
        .from("aspekindo_lms_courses")
        .select("*")
        .eq("id", courseId)
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Kursus tidak ditemukan atau belum diterbitkan.");
       let agenda: AspekindoLmsAgendaSummary | null = null;
       if (data.agenda_id) {
         const agendaResult = await supabase
           .from("aspekindo_learning_agendas")
           .select("id, title, start_date, status")
           .eq("id", data.agenda_id)
           .maybeSingle();
         agenda = agendaResult.data ?? null;
       }
       return fetchCourseContent(data, agenda);
    },
  });
}

export function usePublicAspekindoLmsCourse(slug: string | undefined) {
  return useQuery({
    queryKey: ["aspekindo-lms", "public-course", slug],
    enabled: Boolean(slug),
    retry: false,
    queryFn: async () => {
      if (!slug) throw new Error("Kursus belum dipilih.");
      const { data, error } = await supabase
        .rpc("get_public_aspekindo_lms_course", { _slug: slug })
        .maybeSingle();
      if (error) throw error;
      return (data ?? null) as AspekindoLmsPublicCourse | null;
    },
  });
}

export function useAspekindoLmsVideoUrl(storagePath: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ["aspekindo-lms", "video-url", storagePath],
    enabled: Boolean(enabled && storagePath),
    retry: false,
    staleTime: VIDEO_URL_FRESH_MS,
    gcTime: 30 * 60 * 1000,
    queryFn: async () => {
      if (!storagePath) throw new Error("Video belum tersedia.");
      return issueVideoSignedUrl(storagePath, (path, expiresIn) =>
        supabase.storage.from("aspekindo-learning").createSignedUrl(path, expiresIn));
    },
  });
}

export function useAspekindoLmsMyEnrollments(userId: string | undefined) {
  return useQuery({
    queryKey: ["aspekindo-lms", "enrollments", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aspekindo_lms_enrollments")
        .select("*")
        .eq("user_id", userId!)
        .order("enrolled_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Enrollment[];
    },
  });
}

export function useAspekindoLmsMyProgress({
  userId,
  enrollmentId,
  courseId,
}: {
  userId?: string;
  enrollmentId?: string;
  courseId?: string;
} = {}) {
  return useQuery({
    queryKey: ["aspekindo-lms", "progress", userId, enrollmentId, courseId],
    enabled: Boolean(userId && (enrollmentId || courseId || userId)),
    queryFn: async () => {
      let query = supabase
        .from("aspekindo_lms_lesson_progress")
        .select("*")
        .order("updated_at", { ascending: false });
      if (userId) query = query.eq("user_id", userId);
      if (enrollmentId) query = query.eq("enrollment_id", enrollmentId);
      if (courseId) query = query.eq("course_id", courseId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as LessonProgress[];
    },
  });
}

export function useAspekindoLmsQuizQuestions(lessonId: string | undefined) {
  return useQuery({
    queryKey: ["aspekindo-lms", "quiz-questions", lessonId],
    enabled: Boolean(lessonId),
    retry: false,
    queryFn: async () => {
      if (!lessonId) return [] as QuizQuestion[];
      const { data, error } = await supabase
        .from("aspekindo_lms_quiz_questions")
        .select("*")
        .eq("lesson_id", lessonId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as QuizQuestion[];
    },
  });
}

export function useAspekindoLmsQuizAttempts({
  enrollmentId,
  lessonId,
}: {
  enrollmentId?: string;
  lessonId?: string;
} = {}) {
  return useQuery({
    queryKey: ["aspekindo-lms", "quiz-attempts", enrollmentId, lessonId],
    enabled: Boolean(enrollmentId || lessonId),
    queryFn: async () => {
      let query = supabase
        .from("aspekindo_lms_quiz_attempts")
        .select("*")
        .order("submitted_at", { ascending: false });
      if (enrollmentId) query = query.eq("enrollment_id", enrollmentId);
      if (lessonId) query = query.eq("lesson_id", lessonId);
      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as QuizAttempt[];
    },
  });
}

export function useAspekindoLmsCompletionRecords(userId: string | undefined) {
  return useQuery({
    queryKey: ["aspekindo-lms", "completion-records", userId],
    enabled: Boolean(userId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("aspekindo_lms_completion_records")
        .select("*")
        .eq("user_id", userId!)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as CompletionRecord[];
    },
  });
}

export function useEnrollAspekindoLmsCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (courseId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Anda harus masuk untuk mendaftar kursus.");

      const { data, error } = await supabase.rpc("enroll_aspekindo_lms_course", {
        _course_id: courseId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (enrollment) => {
      queryClient.invalidateQueries({ queryKey: ["aspekindo-lms", "enrollments", enrollment.user_id] });
    },
  });
}

export function useSaveAspekindoLmsProgress() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (progress: WritableLessonProgress) => {
      const { data, error } = await supabase
        .from("aspekindo_lms_lesson_progress")
        .upsert(progress, { onConflict: "enrollment_id,lesson_id" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (progress) => {
      queryClient.invalidateQueries({ queryKey: ["aspekindo-lms", "progress", progress.user_id] });
    },
  });
}

export function useCompleteAspekindoLmsLesson() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (lessonId: string) => {
      const { data, error } = await supabase.rpc("complete_aspekindo_lms_lesson", {
        _lesson_id: lessonId,
      });
      if (error) throw error;
      return data as LessonProgress;
    },
    onSuccess: (progress) => {
      queryClient.invalidateQueries({
        queryKey: ["aspekindo-lms", "progress", progress.user_id],
      });
      queryClient.invalidateQueries({
        queryKey: ["aspekindo-lms", "enrollments", progress.user_id],
      });
    },
  });
}

export function useSubmitAspekindoLmsQuiz() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ lessonId, answers }: { lessonId: string; answers: Record<string, number> }) => {
      const { data, error } = await supabase.rpc("submit_aspekindo_lms_quiz", {
        _lesson_id: lessonId,
        _answers: answers as Json,
      });
      if (error) throw error;
      return data as Database["public"]["Tables"]["aspekindo_lms_quiz_attempts"]["Row"];
    },
    onSuccess: (attempt) => {
      queryClient.invalidateQueries({
        queryKey: ["aspekindo-lms", "quiz-attempts", attempt.enrollment_id, attempt.lesson_id],
      });
    },
  });
}

export function useCompleteAspekindoLmsCourse() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (courseId: string) => {
      const { data, error } = await supabase.rpc("complete_aspekindo_lms_course", {
        _course_id: courseId,
      });
      if (error) throw error;
      return data as Enrollment;
    },
    onSuccess: (enrollment) => {
      queryClient.invalidateQueries({ queryKey: ["aspekindo-lms", "enrollments", enrollment.user_id] });
      queryClient.invalidateQueries({ queryKey: ["aspekindo-lms", "completion-records", enrollment.user_id] });
      queryClient.invalidateQueries({ queryKey: ["aspekindo-lms", "progress", enrollment.user_id] });
    },
  });
}