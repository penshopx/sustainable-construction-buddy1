import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  buildSiapCompetencyMap,
  type SiapActivitySource,
  type SiapAssessmentSource,
  type SiapCompetencyScoreSource,
  type SiapCompetencySnapshot,
  type SiapEngineInsight,
  type SiapModuleProgressSource,
  type SiapNativeLmsSource,
  type SiapRecommendation,
} from "@/lib/siapCompetencyEngine";

interface ModuleProgressRow {
  status: string;
  progress_percent: number;
  e_course_modules: {
    title: string;
    competency_domains: { name: string } | null;
  } | null;
}

interface NativeCourseRow {
  id: string;
  title: string;
}

function isInsight(value: unknown): value is SiapEngineInsight {
  if (!value || typeof value !== "object") return false;
  const candidate = value as { source?: unknown; recommendations?: unknown; generatedAt?: unknown };
  if (candidate.source !== "deterministic" && candidate.source !== "connected") return false;
  if (!Array.isArray(candidate.recommendations) || typeof candidate.generatedAt !== "string") return false;
  return candidate.recommendations.every((item) => {
    if (!item || typeof item !== "object") return false;
    const recommendation = item as Partial<SiapRecommendation>;
    return typeof recommendation.text === "string"
      && typeof recommendation.href === "string"
      && typeof recommendation.label === "string";
  });
}

function assertResult(
  label: string,
  result: { error: { message: string } | null },
) {
  if (result.error) {
    throw new Error(`${label}: ${result.error.message}`);
  }
}

function buildFallbackInsight(
  map: ReturnType<typeof buildSiapCompetencyMap>,
): SiapEngineInsight {
  const recommendations = map.dimensions
    .flatMap((dimension) => dimension.recommendations)
    .filter(
      (item, index, all) =>
        all.findIndex(
          (candidate) => candidate.href === item.href && candidate.text === item.text,
        ) === index,
    )
    .slice(0, 3);

  return {
    source: "deterministic",
    recommendations,
    generatedAt: map.generatedAt,
  };
}

export function useSiapCompetencyMap() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["siap-competency-map", user?.id],
    enabled: Boolean(user),
    staleTime: 60_000,
    refetchOnMount: "always",
    queryFn: async () => {
      if (!user) throw new Error("Pengguna belum terautentikasi.");

      const memberResult = await supabase
        .from("aspekindo_members")
        .select("id, membership_status, membership_number, expires_at")
        .eq("user_id", user.id)
        .maybeSingle();
      assertResult("Data anggota", memberResult);

      const [
        activitiesResult,
        enrollmentsResult,
        evidenceResult,
        modulesResult,
        certificatesResult,
        pancekResult,
        lkutResult,
        smapResult,
        projectsResult,
        projectEvidenceResult,
        risksResult,
        budgetsResult,
        k3Result,
        obligationsResult,
        assessmentResult,
        competencyScoreResult,
        nativeCoursesResult,
        nativeEnrollmentsResult,
        nativeProgressResult,
        nativeAttemptsResult,
        nativeCompletionResult,
      ] = await Promise.all([
        supabase
          .from("aspekindo_pub_activities")
          .select("id, title, siap_focus")
          .in("status", ["published", "completed"]),
        supabase
          .from("aspekindo_activity_enrollments")
          .select("activity_id, status, completed_at")
          .eq("user_id", user.id),
        supabase
          .from("aspekindo_activity_evidence")
          .select("id, activity_id, title, issued_at")
          .eq("user_id", user.id)
          .order("issued_at", { ascending: false }),
        supabase
          .from("module_progress")
          .select("status, progress_percent, e_course_modules(title, competency_domains:domain_id(name))")
          .eq("user_id", user.id),
        supabase
          .from("certificates")
          .select("id, module_name, level, issued_at")
          .eq("user_id", user.id)
          .order("issued_at", { ascending: false }),
        supabase
          .from("pancek_assessments")
          .select("company_name, nib, npwp, completion_percent, status, period_year")
          .eq("user_id", user.id)
          .order("period_year", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("lkut_reports")
          .select(
            "report_year, status, submitted_at, kta_number, kta_expiry_date, sbu_number, sbu_expiry_date, experience_records_complete, experience_pending_list",
          )
          .eq("user_id", user.id)
          .order("report_year", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("smap_documents")
          .select("id, doc_type, status, verified_at")
          .eq("user_id", user.id),
        supabase
          .from("projects")
          .select("id, status, contract_type, complexity_score")
          .eq("user_id", user.id),
        supabase
          .from("lkut_project_data")
          .select("id")
          .eq("user_id", user.id),
        supabase.from("risk_registers").select("id").eq("user_id", user.id),
        supabase.from("budget_entries").select("id").eq("user_id", user.id),
        supabase.from("k3_checklists").select("id").eq("user_id", user.id),
        memberResult.data
          ? supabase
              .from("aspekindo_member_obligations")
              .select("id, title, siap_focus, status, fulfilled_at")
              .eq("member_id", memberResult.data.id)
          : Promise.resolve({ data: [], error: null }),
        supabase
          .from("pre_tests")
          .select("score, determined_level, completed_at")
          .eq("user_id", user.id)
          .eq("status", "completed")
          .order("completed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("competency_scores")
          .select("total_score, learning_points, toolkit_points, project_points, contribution_points, computed_at")
          .eq("user_id", user.id)
          .order("computed_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("aspekindo_lms_courses")
          .select("id, title")
          .eq("status", "published"),
        supabase
          .from("aspekindo_lms_enrollments")
          .select("course_id, status")
          .eq("user_id", user.id),
        supabase
          .from("aspekindo_lms_lesson_progress")
          .select("status")
          .eq("user_id", user.id),
        supabase
          .from("aspekindo_lms_quiz_attempts")
          .select("passed")
          .eq("user_id", user.id),
        supabase
          .from("aspekindo_lms_completion_records")
          .select("id")
          .eq("user_id", user.id),
      ]);

      [
        ["Kegiatan PUB", activitiesResult],
        ["Pendaftaran kegiatan", enrollmentsResult],
        ["Bukti kegiatan", evidenceResult],
        ["Progres kursus", modulesResult],
        ["Sertifikat", certificatesResult],
        ["PANCEK", pancekResult],
        ["LKUT", lkutResult],
        ["SMAP", smapResult],
        ["Proyek", projectsResult],
        ["Evidence proyek", projectEvidenceResult],
        ["Risk register", risksResult],
        ["Budget tracker", budgetsResult],
        ["K3 checklist", k3Result],
        ["Kewajiban anggota", obligationsResult],
        ["Assessment", assessmentResult],
        ["Scoring 4 Pilar", competencyScoreResult],
        ["Kursus LMS native", nativeCoursesResult],
        ["Pendaftaran LMS native", nativeEnrollmentsResult],
        ["Progress LMS native", nativeProgressResult],
        ["Kuis LMS native", nativeAttemptsResult],
        ["Bukti completion LMS native", nativeCompletionResult],
      ].forEach(([label, result]) =>
        assertResult(label as string, result as { error: { message: string } | null }),
      );

      const modules = (modulesResult.data as ModuleProgressRow[] | null ?? []).map(
        (item): SiapModuleProgressSource => ({
          status: item.status,
          progress_percent: item.progress_percent,
          module_title: item.e_course_modules?.title ?? "Modul pembelajaran",
          domain_name: item.e_course_modules?.competency_domains?.name ?? "",
        }),
      );

      const snapshot: SiapCompetencySnapshot = {
        member: memberResult.data
          ? {
              membership_status: memberResult.data.membership_status,
              membership_number: memberResult.data.membership_number,
              expires_at: memberResult.data.expires_at,
            }
          : null,
        obligations: obligationsResult.data ?? [],
        activities: (activitiesResult.data ?? []) as SiapActivitySource[],
        enrollments: enrollmentsResult.data ?? [],
        evidence: evidenceResult.data ?? [],
        modules,
        certificates: certificatesResult.data ?? [],
        pancek: pancekResult.data,
        lkut: lkutResult.data,
        smapDocuments: smapResult.data ?? [],
        projects: projectsResult.data ?? [],
        projectEvidenceCount: projectEvidenceResult.data?.length ?? 0,
        assessment: assessmentResult.data
          ? {
              score: assessmentResult.data.score,
              level: assessmentResult.data.determined_level,
              completed_at: assessmentResult.data.completed_at,
            } satisfies SiapAssessmentSource
          : null,
        competencyScore: competencyScoreResult.data
          ? competencyScoreResult.data satisfies SiapCompetencyScoreSource
          : null,
        nativeLms: {
          published_courses: (nativeCoursesResult.data as NativeCourseRow[] | null ?? []).length,
          enrolled_courses: nativeEnrollmentsResult.data?.length ?? 0,
          completed_courses: nativeEnrollmentsResult.data?.filter((item) => item.status === "completed").length ?? 0,
          lesson_progress_records: nativeProgressResult.data?.length ?? 0,
          completed_lessons: nativeProgressResult.data?.filter((item) => item.status === "completed").length ?? 0,
          quiz_attempts: nativeAttemptsResult.data?.length ?? 0,
          passed_quizzes: nativeAttemptsResult.data?.filter((item) => item.passed).length ?? 0,
          completion_records: nativeCompletionResult.data?.length ?? 0,
        } satisfies SiapNativeLmsSource,
        operationalCounts: {
          risks: risksResult.data?.length ?? 0,
          budgets: budgetsResult.data?.length ?? 0,
          k3: k3Result.data?.length ?? 0,
        },
      };

      const map = buildSiapCompetencyMap(snapshot);
      const { data: insightData, error: insightError } = await supabase.functions.invoke("competency-insight", {
        body: {},
      });

      if (!insightError && isInsight(insightData)) {
        return { ...map, insight: insightData };
      }

      return { ...map, insight: buildFallbackInsight(map) };
    },
  });
}