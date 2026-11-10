import {
  healthRequestStatus,
  requestRecommendationKeys,
  resolveInsight,
  toRecommendation,
  toInsightHealth,
} from "./contract.js";

export const SOURCE_UNAVAILABLE_OUTCOME = Object.freeze({
  httpStatus: 500,
  response: Object.freeze({ error: "Unable to read competency sources" }),
  health: Object.freeze({
    status: "deterministic",
    failureReason: "source_unavailable",
  }),
});

export function sourceUnavailableOutcome() {
  return {
    httpStatus: SOURCE_UNAVAILABLE_OUTCOME.httpStatus,
    response: { ...SOURCE_UNAVAILABLE_OUTCOME.response },
    health: { ...SOURCE_UNAVAILABLE_OUTCOME.health },
  };
}

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const HEALTH_ROW_ID = "global";
export const FALLBACK_ALERT_AFTER_PROBES = 3;
export const FALLBACK_ALERT_AFTER_MS = 15 * 60 * 1_000;
export const FALLBACK_ALERT_TYPE = "competency_insight_fallback";

export function nextInsightHealthState(previous, status, failureReason, probeAt) {
  const isFailure = status === "deterministic" && failureReason !== "none";
  const isNeutral = status === "deterministic" && failureReason === "none";
  const wasFailure = previous?.status === "deterministic"
    && previous?.failure_reason !== "none";
  const fallbackStartedAt = isFailure
    ? (wasFailure && previous.fallback_started_at
      ? previous.fallback_started_at
      : probeAt)
    : isNeutral
      ? previous?.fallback_started_at ?? null
      : null;
  const consecutiveFailureCount = isFailure
    ? (wasFailure ? Number(previous.consecutive_failure_count || 0) + 1 : 1)
    : isNeutral
      ? Number(previous?.consecutive_failure_count || 0)
      : 0;
  const fallbackDuration = fallbackStartedAt
    ? Math.max(0, Date.parse(probeAt) - Date.parse(fallbackStartedAt))
    : 0;
  const thresholdReached = isFailure && (
    consecutiveFailureCount >= FALLBACK_ALERT_AFTER_PROBES
    || fallbackDuration >= FALLBACK_ALERT_AFTER_MS
  );
  const alertActive = isFailure
    ? thresholdReached || previous?.alert_active === true
    : isNeutral
      ? previous?.alert_active === true
      : false;

  return {
    row: {
      id: HEALTH_ROW_ID,
      status,
      failure_reason: failureReason,
      last_probe_at: probeAt,
      updated_at: probeAt,
      consecutive_failure_count: consecutiveFailureCount,
      fallback_started_at: fallbackStartedAt,
      alert_active: alertActive,
    },
    shouldNotifyAdmins: alertActive && previous?.alert_active !== true,
    shouldResolveAdminAlert: status === "connected" && previous?.alert_active === true,
  };
}

function isPresent(value) {
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/**
 * Build the Edge Function handler with its platform dependencies injected.
 * This keeps the production Deno entrypoint small and lets contract tests run
 * the complete request flow against fake Supabase and insight services.
 */
export function createCompetencyInsightHandler({
  createClient,
  getEnv,
  fetchImpl = fetch,
  timeoutMs,
  now = () => new Date().toISOString(),
  logger = console,
}) {
  const env = (key) => getEnv(key);

  async function recordInsightHealth(supabaseUrl, status, failureReason) {
    const serviceKey = env("SUPABASE_SERVICE_ROLE_KEY");
    if (!serviceKey) {
      logger.error("Competency insight health storage is not configured");
      throw new Error("Competency insight health storage is not configured");
    }

    const adminClient = createClient(supabaseUrl, serviceKey);
    const probeAt = now();
    const { error } = await adminClient.rpc("record_competency_insight_health", {
      p_status: status,
      p_failure_reason: failureReason,
      p_probe_at: probeAt,
    });
    if (error) {
      logger.error("Competency insight health update failed");
      throw new Error("Competency insight health update failed");
    }
  }

  async function readInsightHealth(client) {
    const { data, error } = await client
      .from("competency_insight_health")
      .select("status, failure_reason, last_probe_at")
      .eq("id", HEALTH_ROW_ID)
      .maybeSingle();
    if (error) {
      logger.error("Competency insight health read failed");
      return null;
    }
    if (!data) return null;
    return {
      status: data.status,
      failureReason: data.failure_reason,
      lastProbeAt: data.last_probe_at,
    };
  }

  async function isAdmin(client, userId) {
    const { data, error } = await client.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    return !error && data === true;
  }

  async function recommendationResponse(supabaseUrl, insight) {
    const health = toInsightHealth(insight);
    await recordInsightHealth(supabaseUrl, health.status, health.failureReason);
    return json({
      source: insight.source,
      recommendations: insight.recommendationKeys.map(toRecommendation).filter(Boolean),
      generatedAt: now(),
    });
  }

  return async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    try {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) return json({ error: "Unauthorized" }, 401);

      const supabaseUrl = env("SUPABASE_URL");
      const supabaseAnonKey = env("SUPABASE_ANON_KEY");
      if (!supabaseUrl || !supabaseAnonKey) {
        return json({ error: "Server configuration unavailable" }, 500);
      }

      const client = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError || !user) return json({ error: "Unauthorized" }, 401);

      let requestBody = {};
      try {
        const parsedBody = await req.json();
        if (parsedBody && typeof parsedBody === "object" && !Array.isArray(parsedBody)) {
          requestBody = parsedBody;
        }
      } catch {
        // The insight request body is optional; malformed JSON is a normal request.
      }

      if (requestBody.action === "health") {
        const accessStatus = healthRequestStatus(await isAdmin(client, user.id));
        if (accessStatus === 403) return json({ error: "Forbidden" }, accessStatus);
        return json({ health: await readInsightHealth(client) });
      }

      const [
        member,
        pancek,
        lkut,
        assessment,
        competencyScore,
        legacyModules,
        certificates,
        activityEnrollments,
        activityEvidence,
        nativeEnrollments,
        nativeLessonProgress,
        nativeQuizAttempts,
        nativeCompletions,
        smap,
        projects,
        projectEvidence,
        risks,
        budgets,
        k3,
      ] = await Promise.all([
        client.from("aspekindo_members").select("id").eq("user_id", user.id).maybeSingle(),
        client.from("pancek_assessments").select("id").eq("user_id", user.id).limit(1),
        client.from("lkut_reports").select("id").eq("user_id", user.id).limit(1),
        client.from("pre_tests").select("id").eq("user_id", user.id).eq("status", "completed").limit(1),
        client.from("competency_scores").select("id").eq("user_id", user.id).limit(1),
        client.from("module_progress").select("id, status, progress_percent").eq("user_id", user.id),
        client.from("certificates").select("id").eq("user_id", user.id).limit(1),
        client.from("aspekindo_activity_enrollments").select("id, status").eq("user_id", user.id),
        client.from("aspekindo_activity_evidence").select("id").eq("user_id", user.id).limit(1),
        client.from("aspekindo_lms_enrollments").select("id, status").eq("user_id", user.id),
        client.from("aspekindo_lms_lesson_progress").select("id, status").eq("user_id", user.id),
        client.from("aspekindo_lms_quiz_attempts").select("id, passed").eq("user_id", user.id),
        client.from("aspekindo_lms_completion_records").select("id").eq("user_id", user.id).limit(1),
        client.from("smap_documents").select("id").eq("user_id", user.id).limit(1),
        client.from("projects").select("id").eq("user_id", user.id).limit(1),
        client.from("lkut_project_data").select("id").eq("user_id", user.id).limit(1),
        client.from("risk_registers").select("id").eq("user_id", user.id).limit(1),
        client.from("budget_entries").select("id").eq("user_id", user.id).limit(1),
        client.from("k3_checklists").select("id").eq("user_id", user.id).limit(1),
      ]);

      const results = [
        member, pancek, lkut, assessment, competencyScore, legacyModules, certificates,
        activityEnrollments, activityEvidence, nativeEnrollments, nativeLessonProgress,
        nativeQuizAttempts, nativeCompletions, smap, projects, projectEvidence, risks, budgets, k3,
      ];
      const obligations = member.data
        ? await client.from("aspekindo_member_obligations").select("id, status").eq("member_id", member.data.id)
        : { data: [], error: null };
      results.push(obligations);
      const sourceError = results.find((result) => result.error)?.error;
      if (sourceError) {
        logger.error("Competency source query failed");
        const outcome = sourceUnavailableOutcome();
        await recordInsightHealth(
          supabaseUrl,
          outcome.health.status,
          outcome.health.failureReason,
        );
        return json(outcome.response, outcome.httpStatus);
      }

      const missingKeys = [
        !member.data && "legalitas-member",
        !isPresent(pancek.data) && "legalitas-pancek",
        !isPresent(lkut.data) && "legalitas-lkut",
        !isPresent(assessment.data) && "sertifikasi-assessment",
        (
          !isPresent(nativeCompletions.data)
          || nativeEnrollments.data?.some((item) => item.status !== "completed")
          || nativeLessonProgress.data?.some((item) => item.status !== "completed")
          || nativeQuizAttempts.data?.some((item) => !item.passed)
        ) && "sertifikasi-lms",
        !isPresent(certificates.data)
          && !isPresent(smap.data)
          && !isPresent(pancek.data)
          && !isPresent(activityEvidence.data)
          && "sertifikasi-evidence",
        (
          !isPresent(legacyModules.data)
          || legacyModules.data?.some((item) => item.status !== "completed" || item.progress_percent < 75)
        ) && "tender-learning",
        !isPresent(assessment.data) && !isPresent(competencyScore.data) && "tender-team",
        !isPresent(risks.data) && "tender-risk",
        !isPresent(projects.data) && "proyek-workspace",
        !isPresent(projectEvidence.data) && "proyek-evidence",
        !isPresent(risks.data) && !isPresent(budgets.data) && !isPresent(k3.data) && "proyek-controls",
      ].filter((key) => Boolean(key));

      const engineUrl = env("GUSTAFTA_ENGINE_URL");
      const engineApiKey = env("GUSTAFTA_ENGINE_API_KEY");
      const insight = await resolveInsight({
        missingKeys,
        engineUrl,
        engineApiKey,
        requestKeys: (url, apiKey, availableKeys) => requestRecommendationKeys(
          url,
          apiKey,
          availableKeys,
          fetchImpl,
          timeoutMs,
        ),
      });
      return await recommendationResponse(supabaseUrl, insight);
    } catch (error) {
      logger.error("competency-insight request failed");
      return json({ error: "Unable to create competency insight" }, 500);
    }
  };
}
