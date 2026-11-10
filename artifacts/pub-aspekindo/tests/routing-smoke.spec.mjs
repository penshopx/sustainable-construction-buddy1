import { expect, test } from "@playwright/test";
import { freezeVideoClock, installControlledVideo, resumeControlledVideo, signalVideo } from "./helpers/controlled-video.mjs";

test("rute publik utama dari build aplikasi aktif dapat dibuka", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Standar Sertifikasi BUJK Diperbarui/ })).toBeVisible();

  await page.goto("/simulator-sbu");
  await expect(page.getByRole("heading", { name: "Ukur kesiapan BUJK sebelum mengurus SBU", level: 1 })).toBeVisible();

  await page.goto("/simulator-lkut");
  await expect(page.getByRole("heading", { name: "Ukur kesiapan dokumen LKUT BUJK", level: 1 })).toBeVisible();

  await page.goto("/program-kegiatan");
  await expect(page.getByRole("heading", { name: "Ruang kolaborasi untuk BUJK yang terus bertumbuh.", level: 1 })).toBeVisible();
});

test("ponsel dapat melompat ke daftar bagian dan membuka-tutup accordion", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const explore = page.getByTestId("link-jelajahi-bagian");
  const introduction = page.getByTestId("button-expand-pengenalan");
  const readiness = page.getByTestId("button-expand-kesiapan");
  await expect(explore).toBeVisible();
  await explore.click();
  await expect(page).toHaveURL(/#jelajahi-bagian$/);
  await expect(page.getByRole("heading", { name: "Jelajahi bagian PUB" })).toBeInViewport();
  await expect(introduction).toHaveAttribute("aria-expanded", "false");
  await expect(readiness).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#video-pub")).toHaveCount(0);

  await introduction.click();
  await expect(introduction).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#video-pub")).toBeVisible();
  await readiness.click();
  await expect(introduction).toHaveAttribute("aria-expanded", "false");
  await expect(readiness).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#simulator-kesiapan")).toBeVisible();
  await readiness.click();
  await expect(readiness).toHaveAttribute("aria-expanded", "false");
  await expect(page.locator("#simulator-kesiapan")).toHaveCount(0);

  await page.goto("/#perjalanan-anggota");
  await expect(page.getByTestId("button-expand-tentang")).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#perjalanan-anggota")).toBeVisible();
});

test("desktop tetap menampilkan bagian lengkap tanpa tombol accordion", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");
  await expect(page.getByTestId("link-jelajahi-bagian")).toBeHidden();
  await expect(page.getByTestId("button-expand-pengenalan")).toHaveCount(0);
  await expect(page.locator("#video-pub")).toBeVisible();
  await expect(page.locator("#simulator-kesiapan")).toBeVisible();
});

test("rute anggota, admin, dan alias mewajibkan login tanpa sesi", async ({ page }) => {
  for (const path of ["/dashboard", "/assessment", "/siap-kompetensi", "/aspekindo-lms", "/ai-helpdesk", "/admin", "/admin/users", "/admin/akses", "/admin/permintaan"]) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/auth$/);
    await expect(page.getByRole("heading", { name: "Masuk ke Akun" })).toBeVisible();
  }
});

test("rute tidak dikenal menampilkan halaman 404", async ({ page }) => {
  await page.goto("/rute-tidak-tersedia");
  await expect(page).toHaveURL(/\/rute-tidak-tersedia$/);
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
});

// CI builds against ci-playwright.supabase.co. Nothing here uses a real account or database.
const SUPABASE_HOST = "ci-playwright.supabase.co";
const MEMBER_ID = "00000000-0000-4000-8000-000000000030";
const COURSE_ID = "00000000-0000-4000-8000-000000000031";
const ASSESSMENT_ID = "00000000-0000-4000-8000-000000000032";
const LESSON_ID = "00000000-0000-4000-8000-000000000037";
const SECOND_LESSON_ID = "00000000-0000-4000-8000-000000000042";
const ENROLLMENT_ID = "00000000-0000-4000-8000-000000000038";
const ADMIN_REQUEST_ID = "00000000-0000-4000-8000-000000000041";
const VIDEO_STORAGE_PATH = "kursus-uji/video-pengenalan.mp4";
const VIDEO_SIGN_PATH = `/storage/v1/object/sign/aspekindo-learning/${VIDEO_STORAGE_PATH}`;
const VIDEO_SIGNED_URL = `https://${SUPABASE_HOST}${VIDEO_SIGN_PATH}?token=video-test-only`;
const assessmentQuestions = [
  {
    id: "00000000-0000-4000-8000-000000000033",
    question_text: "Apa dokumen pertama yang perlu disiapkan?",
    options: ["Dokumen legalitas", "Dokumen lain"],
    difficulty: "Mudah",
    domain_id: "00000000-0000-4000-8000-000000000035",
    created_at: "2026-09-01T00:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000034",
    question_text: "Apa langkah berikutnya dalam evaluasi?",
    options: ["Lewati evaluasi", "Periksa kesiapan"],
    difficulty: "Sedang",
    domain_id: "00000000-0000-4000-8000-000000000036",
    created_at: "2026-09-01T00:00:00.000Z",
  },
];

const member = {
  id: MEMBER_ID,
  aud: "authenticated",
  role: "authenticated",
  email: "anggota@example.test",
  app_metadata: { provider: "email", providers: ["email"] },
  user_metadata: { full_name: "Anggota Uji" },
  created_at: "2026-09-01T00:00:00.000Z",
};
const secondMember = {
  ...member,
  id: "00000000-0000-4000-8000-000000000060",
  email: "anggota-kedua@example.test",
  user_metadata: { full_name: "Anggota Uji Kedua" },
};
const fixtureSession = (user) => ({
  access_token: `test-only-access-token-${user.id}`,
  refresh_token: `test-only-refresh-token-${user.id}`,
  token_type: "bearer",
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user,
});
const course = {
  id: COURSE_ID,
  course_code: "LMS-UJI-01",
  title: "Kursus Uji Anggota",
  description_markdown: "Materi latihan untuk anggota.",
  audience: "Anggota BUJK",
  status: "published",
  agenda_id: null,
  created_at: "2026-09-01T00:00:00.000Z",
};
const lesson = {
  id: LESSON_ID,
  course_id: COURSE_ID,
  title: "Mengenal dokumen BUJK",
  content_markdown: "Siapkan **dokumen legalitas BUJK** sebelum memulai proses.",
  passing_score: 0,
  sort_order: 1,
  status: "published",
};
const quizQuestions = [
  {
    id: "00000000-0000-4000-8000-000000000045",
    lesson_id: LESSON_ID,
    question_text: "Dokumen apa yang disiapkan lebih dahulu?",
    options: ["Dokumen legalitas", "Dokumen tidak terkait"],
    sort_order: 1,
  },
  {
    id: "00000000-0000-4000-8000-000000000046",
    lesson_id: LESSON_ID,
    question_text: "Apa langkah setelah dokumen terkumpul?",
    options: ["Abaikan pemeriksaan", "Periksa kelengkapan"],
    sort_order: 2,
  },
];
const secondLesson = {
  id: SECOND_LESSON_ID,
  course_id: COURSE_ID,
  title: "Memeriksa kesiapan dokumen",
  content_markdown: "Lanjutkan dengan **pemeriksaan kelengkapan dokumen**.",
  passing_score: 0,
  sort_order: 2,
  status: "published",
};
const material = {
  id: "00000000-0000-4000-8000-000000000039",
  lesson_id: LESSON_ID,
  title: "Daftar periksa dokumen",
  material_type: "text",
  content_markdown: "Periksa akta dan izin usaha.",
  external_url: null,
  sort_order: 1,
};
const videoMaterial = {
  id: "00000000-0000-4000-8000-000000000044",
  lesson_id: LESSON_ID,
  title: "Video pengenalan BUJK",
  material_type: "video",
  content_markdown: null,
  external_url: null,
  storage_path: VIDEO_STORAGE_PATH,
  mime_type: "video/mp4",
  file_size_bytes: 1024 * 1024,
  sort_order: 2,
};
const secondVideoMaterial = {
  ...videoMaterial,
  id: "00000000-0000-4000-8000-000000000061",
  lesson_id: SECOND_LESSON_ID,
  title: "Video pemeriksaan dokumen",
  storage_path: "kursus-uji/video-pemeriksaan.mp4",
};
const SECOND_VIDEO_SIGN_PATH = `/storage/v1/object/sign/aspekindo-learning/${secondVideoMaterial.storage_path}`;
const enrollment = {
  id: ENROLLMENT_ID,
  course_id: COURSE_ID,
  user_id: MEMBER_ID,
  status: "enrolled",
  enrolled_at: "2026-09-01T00:00:00.000Z",
};

const emptyTables = new Set([
  "notifications", "pre_tests", "aspekindo_members",
  "aspekindo_pub_activities", "aspekindo_activity_enrollments",
  "aspekindo_activity_evidence", "module_progress", "certificates",
  "pancek_assessments", "lkut_reports", "smap_documents", "projects",
  "lkut_project_data", "risk_registers", "budget_entries", "k3_checklists",
  "competency_scores", "aspekindo_lms_enrollments",
  "aspekindo_lms_lesson_progress", "aspekindo_lms_quiz_attempts",
  "aspekindo_lms_completion_records", "aspekindo_learning_agendas",
  "aspekindo_lms_sessions", "aspekindo_lms_lessons",
]);

async function installAuthenticatedFixture(page, { user = member, asAdmin = false, asSuperAdmin = false, roleCheck = null, assessment = null, accounts = null, lms = null, lmsAccounts = null, preserveLmsState = false } = {}) {
  // A shared fake backend keeps each identity's enrollment and progress separate.
  if (lmsAccounts) {
    lms = lmsAccounts.get(user.id);
    expect(lms, `Missing LMS fixture for ${user.id}`).toBeDefined();
  }
  const userEnrollment = { ...enrollment, id: lms?.enrollmentId ?? ENROLLMENT_ID, user_id: user.id };
  const unexpectedRequests = [];
  if (lms && !preserveLmsState) {
    lms.progress = [];
    lms.attempts = [];
    lms.completionRequests = [];
  }
  await page.addInitScript(({ session, hostname }) => {
    localStorage.setItem(`sb-${hostname.split(".")[0]}-auth-token`, JSON.stringify(session));
    localStorage.setItem("pub_onboarding_done", "1");
  }, { session: fixtureSession(user), hostname: SUPABASE_HOST });
  if (assessment && !assessment.liveCountdown) {
    // Reconcile the countdown via visibilitychange; keep animation frames on
    // real time instead of fast-forwarding the browser's animation clock.
    await page.addInitScript(() => {
      const originalSetInterval = window.setInterval.bind(window);
      window.setInterval = ((handler, delay, ...args) =>
        originalSetInterval(handler, delay === 1000 ? 600_000 : delay, ...args));
    });
  }

  // Only local, read-only application assets may pass through. All data calls
  // (including a changed API host) must be fulfilled by this fixture or fail.
  await page.route("**/*", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.hostname === "127.0.0.1" && request.method() === "GET" &&
        ["document", "script", "stylesheet", "image", "font", "manifest"].includes(request.resourceType()) &&
        !url.pathname.startsWith("/api/") && !url.pathname.startsWith("/rest/")) {
      await route.continue();
      return;
    }
    if (url.hostname === "fonts.googleapis.com" && request.method() === "GET") {
      await route.fulfill({ status: 200, contentType: "text/css", body: "" });
      return;
    }
    if (url.hostname === "127.0.0.1" && url.pathname === "/api/ruang-simpan/session" && request.method() === "DELETE") {
      await route.fulfill({ status: 204 });
      return;
    }
    if (url.hostname === "127.0.0.1" && url.pathname === "/api/ruang-simpan/workspace" && request.method() === "GET") {
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ profile: { name: "BUJK Uji" } }),
      });
      return;
    }
    if (url.hostname === "127.0.0.1" && url.pathname === "/api/ruang-simpan/company-names" && request.method() === "POST") {
      const { userIds } = request.postDataJSON();
      // Only the fixture user's workspace exists; do not invent companies for
      // arbitrary IDs. Match the API's { companies: [{ userId, name }] } contract.
      await route.fulfill({
        status: 200, contentType: "application/json",
        body: JSON.stringify({ companies: userIds.includes(user.id) ? [{ userId: user.id, name: "BUJK Uji" }] : [] }),
      });
      return;
    }
    if (url.hostname === "127.0.0.1" &&
        ["/api/helpdesk/status", "/api/ruang-simpan/ai-status"].includes(url.pathname) &&
        url.searchParams.get("diagnostics") === "true") {
      await route.fulfill({ status: asAdmin ? 200 : 403, contentType: "application/json",
        body: JSON.stringify(asAdmin ? {
          state: "configured", message: "metadata only",
          checkedAt: "2026-11-02T01:00:00.000Z", recheckAt: "2026-11-02T01:01:00.000Z",
          diagnostics: { reason: "metadata_available" },
        } : { error: "Admin required" }) });
      return;
    }
    unexpectedRequests.push(`${request.method()} ${url.hostname}${url.pathname}`);
    await route.fulfill({ status: 503, contentType: "application/json", body: '{"message":"Unexpected test request"}' });
  });

  // Intercept every Supabase HTTP call, including unexpected ones; never let a
  // test request escape to a live project if the build configuration changes.
  const defaultAssessment = assessment;
  await page.route(/https:\/\/[^/]+\.supabase\.co\/.*/, async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const endpoint = url.pathname.split("/").pop();
    const single = request.headers().accept?.includes("vnd.pgrst.object");
    // Resolve ownership from each request, not the last login. An in-flight A
    // request must still belong to A after B signs in in the same page.
    const account = accounts && [...accounts.values()].find(({ user }) =>
      request.headers().authorization === `Bearer ${fixtureSession(user).access_token}`);
    const requestUser = account?.user ?? user;
    const currentAssessment = accounts ? account?.assessment : defaultAssessment;
    const assessmentId = currentAssessment?.id ?? ASSESSMENT_ID;
    // Keep the existing single-identity scenarios using the same RPC fixture.
    const assessment = currentAssessment;
    let data;

    if (url.hostname !== SUPABASE_HOST) {
      unexpectedRequests.push(`${request.method()} ${url.hostname}${url.pathname}`);
    } else if (accounts && url.pathname === "/auth/v1/token" && request.method() === "POST" &&
        url.searchParams.get("grant_type") === "password") {
      const credentials = request.postDataJSON();
      const login = [...accounts.values()].find(({ user }) => user.email === credentials.email);
      if (login && credentials.password === "test-only-password") data = fixtureSession(login.user);
    } else if (accounts && !account) {
      unexpectedRequests.push(`${request.method()} ${url.pathname} without a fixture identity`);
    } else if (url.pathname === "/auth/v1/logout" && request.method() === "POST") {
      data = {};
    } else if (url.pathname === "/auth/v1/user") {
      data = requestUser;
    } else if (roleCheck && url.pathname === "/rest/v1/rpc/current_user_is_super_admin") {
      roleCheck.requests++;
      // Snapshot each request before waiting so a newer check can finish first
      // without changing the response belonging to an older, held request.
      const { waitForRelease, abortError, response } = roleCheck;
      await waitForRelease;
      if (abortError) {
        await route.abort(abortError);
        return;
      }
      await route.fulfill(response);
      return;
    } else if (url.pathname === "/rest/v1/rpc/current_user_is_super_admin") {
      data = asSuperAdmin;
    } else if (url.pathname === "/rest/v1/user_roles") {
      data = asAdmin || asSuperAdmin ? [{ role: "admin" }] : [];
    } else if (asSuperAdmin && url.pathname === "/rest/v1/rpc/list_admin_directory") {
      data = [{
        user_id: MEMBER_ID, email: member.email, full_name: "Anggota Uji",
        company: "BUJK Uji", is_admin: false, is_super_admin: false,
      }];
    } else if (asSuperAdmin && url.pathname === "/rest/v1/admin_requests") {
      data = [{
        id: ADMIN_REQUEST_ID, user_id: MEMBER_ID, status: "pending",
        requested_at: "2026-09-01T00:00:00.000Z",
      }];
    } else if (url.pathname === "/functions/v1/competency-insight") {
      data = { source: "deterministic", recommendations: [], generatedAt: "2026-09-01T00:00:00.000Z" };
    } else if (lms?.video && (url.pathname === VIDEO_SIGN_PATH ||
        (lms.secondVideo && url.pathname === SECOND_VIDEO_SIGN_PATH)) && request.method() === "POST") {
      lms.signRequests.push({ path: url.pathname, body: request.postDataJSON() });
      const signNumber = lms.signRequests.length;
      // Hold before choosing the outcome so a delayed failure exercises the
      // player's catch branch only after the original stream has recovered.
      if (lms.holdSignAt === signNumber) {
        await new Promise((resolve) => { lms.releaseSignResponse = resolve; });
      }
      if ((lms.failFirstSign && signNumber === 1) ||
          lms.failSignAt === signNumber) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ statusCode: "500", error: "StorageError", message: "Gagal membuat tautan sementara" }),
        });
        return;
      }
      const token = lms.rotateVideoTokens ? `video-test-${signNumber}` : "video-test-only";
      data = { signedURL: `${url.pathname.replace("/storage/v1", "")}?token=${token}` };
    } else if (lms?.video && (url.pathname === VIDEO_SIGN_PATH ||
               (lms.secondVideo && url.pathname === SECOND_VIDEO_SIGN_PATH)) && request.method() === "GET" &&
               /^video-test-(?:only|\d+)$/.test(url.searchParams.get("token") ?? "")) {
      lms.videoRequests.push(request.url());
      // Keep the simulated media request pending until the DOM assertion; no real
      // video bytes or storage service are needed to check source assignment.
      await new Promise((resolve) => {
        lms.releaseVideoResponses ??= [];
        lms.releaseVideoResponses.push(resolve);
        lms.releaseVideoResponse = resolve;
      });
      await route.fulfill({ status: 200, contentType: "video/mp4", body: "" });
      return;
    } else if (url.pathname === "/rest/v1/aspekindo_lms_courses") {
      data = url.searchParams.get("select") === "*" ? [course] : [{ id: COURSE_ID, title: course.title }];
    } else if (lms && url.pathname === "/rest/v1/aspekindo_lms_lessons" && request.method() === "GET") {
      data = [lms.quiz ? { ...lesson, passing_score: 75 } : lesson, secondLesson];
    } else if (lms && url.pathname === "/rest/v1/aspekindo_lms_materials" && request.method() === "GET") {
      data = lms.video ? [material, videoMaterial, ...(lms.secondVideo ? [secondVideoMaterial] : [])] : [material];
    } else if (lms && url.pathname === "/rest/v1/aspekindo_lms_enrollments" && request.method() === "GET") {
      if (url.searchParams.get("user_id") === `eq.${user.id}`) {
        data = lms.enrolled ? [userEnrollment] : [];
      }
    } else if (lms && url.pathname === "/rest/v1/rpc/enroll_aspekindo_lms_course" && request.method() === "POST") {
      if (request.postDataJSON()?._course_id === COURSE_ID) {
        lms.enrolled = true;
        data = userEnrollment;
      }
    } else if (lms && url.pathname === "/rest/v1/aspekindo_lms_lesson_progress" && request.method() === "GET") {
      if (url.searchParams.get("user_id") === `eq.${user.id}`) {
        data = lms.progress.filter((item) => item.user_id === user.id &&
          (!url.searchParams.has("enrollment_id") || url.searchParams.get("enrollment_id") === `eq.${item.enrollment_id}`));
      }
    } else if (lms && url.pathname === "/rest/v1/aspekindo_lms_lesson_progress" && request.method() === "POST") {
      const progress = request.postDataJSON();
      if ([LESSON_ID, SECOND_LESSON_ID].includes(progress?.lesson_id) &&
          progress?.enrollment_id === userEnrollment.id && progress?.course_id === COURSE_ID &&
          progress?.user_id === user.id && progress?.status === "in_progress" &&
          (progress.lesson_id === LESSON_ID || lms.progress.some((item) => item.lesson_id === LESSON_ID && item.status === "completed"))) {
        lms.startedLesson = progress;
        const saved = { id: progress.lesson_id === LESSON_ID ? "00000000-0000-4000-8000-000000000040" : "00000000-0000-4000-8000-000000000043", ...progress };
        lms.progress = [...lms.progress.filter((item) => item.lesson_id !== progress.lesson_id), saved];
        data = single ? saved : [saved];
      }
    } else if (lms && url.pathname === "/rest/v1/rpc/complete_aspekindo_lms_lesson" && request.method() === "POST") {
      const lessonId = request.postDataJSON()?._lesson_id;
      lms.completionRequests.push(lessonId);
      const current = lms.progress.find((item) => item.lesson_id === lessonId && item.status === "in_progress");
      if (current && (lessonId === LESSON_ID ||
          lessonId === SECOND_LESSON_ID && lms.progress.some((item) => item.lesson_id === LESSON_ID && item.status === "completed")) &&
          (!lms.quiz || lessonId !== LESSON_ID || lms.attempts.some((attempt) => attempt.passed))) {
        data = { ...current, status: "completed", progress_percent: 100, completed_at: "2026-09-01T01:00:00.000Z" };
        lms.progress = [...lms.progress.filter((item) => item.lesson_id !== lessonId), data];
      }
    } else if (lms && url.pathname === "/rest/v1/aspekindo_lms_quiz_questions" && request.method() === "GET") {
      lms.questionRequests = (lms.questionRequests ?? 0) + 1;
      if (lms.waitForQuestions) await lms.waitForQuestions;
      if (lms.failQuestions) {
        await route.fulfill({ status: 400, contentType: "application/json", body: '{"message":"Soal kuis tidak tersedia"}' });
        return;
      }
      data = lms.quiz && url.searchParams.get("lesson_id") === `eq.${LESSON_ID}` ? quizQuestions : [];
    } else if (lms && url.pathname === "/rest/v1/aspekindo_lms_quiz_attempts" && request.method() === "GET") {
      data = lms.attempts.filter((attempt) =>
        (!url.searchParams.has("enrollment_id") || url.searchParams.get("enrollment_id") === `eq.${attempt.enrollment_id}`) &&
        (!url.searchParams.has("lesson_id") || url.searchParams.get("lesson_id") === `eq.${attempt.lesson_id}`)).reverse();
    } else if (lms?.quiz && url.pathname === "/rest/v1/rpc/submit_aspekindo_lms_quiz" && request.method() === "POST") {
      const submission = request.postDataJSON();
      const answers = submission?._answers;
      if (submission?._lesson_id === LESSON_ID && answers && typeof answers === "object" &&
          !Array.isArray(answers) && Object.keys(answers).length === quizQuestions.length &&
          quizQuestions.every((question) => Number.isInteger(answers[question.id]) &&
            answers[question.id] >= 0 && answers[question.id] < question.options.length)) {
        const correct = Number(answers[quizQuestions[0].id] === 0) + Number(answers[quizQuestions[1].id] === 1);
        const score = Math.round(correct / quizQuestions.length * 100);
        data = {
          id: `00000000-0000-4000-8000-${String(50 + lms.attempts.length).padStart(12, "0")}`,
          lesson_id: LESSON_ID, course_id: COURSE_ID, enrollment_id: ENROLLMENT_ID, user_id: MEMBER_ID,
          attempt_number: lms.attempts.length + 1, correct_answers: correct, total_questions: quizQuestions.length,
          score, passed: score >= 75, submitted_at: "2026-09-01T00:30:00.000Z",
        };
        lms.attempts.push(data);
      }
    } else if (assessment && url.pathname === "/rest/v1/rpc/get_questions_safe" && request.method() === "POST") {
      data = assessmentQuestions;
    } else if (assessment && url.pathname === "/rest/v1/competency_domains" && request.method() === "GET") {
      data = [
        { id: assessmentQuestions[0].domain_id, name: "Legalitas" },
        { id: assessmentQuestions[1].domain_id, name: "Manajemen" },
      ];
    } else if (url.pathname === "/rest/v1/rpc/get_active_assessment_draft" && request.method() === "POST") {
      // Even an account with no assessment must check for a remote draft.
      if (assessment?.started) assessment.recoveryChecks = (assessment.recoveryChecks ?? 0) + 1;
      data = assessment?.draft && !assessment.submitted ? {
        preTestId: assessmentId, totalQuestions: assessmentQuestions.length,
        startedAt: assessment.startedAt, deadlineAt: assessment.deadlineAt,
        serverNow: new Date(Date.now() + (assessment.serverTimeOffset ?? 0)).toISOString(), draft: assessment.draft,
      } : null;
    } else if (assessment && url.pathname === "/rest/v1/rpc/start_assessment_draft") {
      assessment.starts = (assessment.starts ?? 0) + 1;
      assessment.started = { user_id: requestUser.id, total_questions: assessmentQuestions.length, status: "in_progress" };
      const now = Date.now() + (assessment.serverTimeOffset ?? 0);
      assessment.startedAt = new Date(now).toISOString();
      assessment.deadlineAt = new Date(now + (assessment.durationMs ?? 180_000)).toISOString();
      assessment.draft = { ...request.postDataJSON()._draft, preTestId: assessmentId, revision: 0 };
      data = { preTestId: assessmentId, startedAt: assessment.startedAt, revision: 0, serverNow: new Date(now).toISOString(), deadlineAt: assessment.deadlineAt };
    } else if (assessment && url.pathname === "/rest/v1/rpc/save_assessment_draft" && request.method() === "POST") {
      const { _pre_test_id: preTestId, _draft: incoming } = request.postDataJSON();
      const unavailable = preTestId !== assessmentId || !assessment.started || assessment.submitted;
      const expired = Date.now() + (assessment.serverTimeOffset ?? 0) >= Date.parse(assessment.deadlineAt);
      if (unavailable || expired) {
        await route.fulfill({
          status: 400, contentType: "application/json",
          body: JSON.stringify({ message: unavailable ? "Assessment unavailable" : "Assessment deadline has passed" }),
        });
        return;
      }
      const revision = assessment.draft?.revision ?? 0;
      const saved = incoming.revision === revision;
      if (saved) assessment.draft = { ...incoming, revision: revision + 1 };
      else assessment.conflicts = (assessment.conflicts ?? 0) + 1;
      data = { saved, draft: assessment.draft };
    } else if (assessment && url.pathname === "/rest/v1/rpc/get_assessment_time") {
      data = { serverNow: new Date(Date.now() + (assessment.serverTimeOffset ?? 0)).toISOString(), deadlineAt: assessment.deadlineAt };
    } else if (assessment && url.pathname === "/rest/v1/pre_tests" && request.method() === "POST") {
      assessment.starts = (assessment.starts ?? 0) + 1;
      assessment.started = request.postDataJSON();
      data = { id: assessmentId, ...assessment.started, status: "in_progress" };
    } else if (assessment && url.pathname === "/rest/v1/pre_tests" && request.method() === "GET") {
      if (url.searchParams.has("id")) {
        // Browser-only backups need a separate completed/in-progress lookup.
        assessment.legacyRecoveryChecks = (assessment.legacyRecoveryChecks ?? 0) + 1;
        data = assessment.started ? [{
          id: assessmentId, user_id: requestUser.id, status: assessment.submitted ? "completed" : "in_progress",
        }] : [];
      } else {
        data = assessment.submitted ? [{
          id: assessmentId, user_id: requestUser.id, status: "completed",
          score: assessment.result.score, determined_level: assessment.result.level, completed_at: "2026-09-01T01:00:00.000Z",
        }] : [];
      }
    } else if (assessment && url.pathname === "/rest/v1/rpc/check_question_answer" && request.method() === "POST") {
      const answer = request.postDataJSON();
      assessment.checks.push(answer);
      const question = assessmentQuestions.find((q) => q.id === answer._question_id);
      if (question && Number.isInteger(answer._selected_answer)) {
        const correctAnswer = question === assessmentQuestions[0] ? 0 : 1;
        data = {
          is_correct: answer._selected_answer === correctAnswer,
          correct_answer: correctAnswer,
          explanation: "Penjelasan soal uji.",
        };
      }
    } else if (assessment && url.pathname === "/rest/v1/rpc/submit_assessment" && request.method() === "POST") {
      assessment.submission = request.postDataJSON();
      assessment.submissions ??= [];
      assessment.submissions.push(assessment.submission);
      if (assessment.failFirstSubmit && assessment.submissions.length === 1) {
        await route.abort("failed");
        return;
      }
      const answers = assessment.submission?._answers;
      const matchesRoster = Array.isArray(answers) &&
        answers.length === assessmentQuestions.length &&
        new Set(answers.map((answer) => answer?.question_id)).size === assessmentQuestions.length &&
        answers.every((answer) => {
          const question = assessmentQuestions.find((item) => item.id === answer?.question_id);
          return question && Number.isInteger(answer.selected_answer) &&
            answer.selected_answer >= -1 && answer.selected_answer < question.options.length;
        });
      if (assessment.submission?._pre_test_id !== assessmentId || !assessment.started) {
        data = { error: "Pre-test not found" };
      } else if (!matchesRoster) {
        data = { error: "Invalid assessment questions" };
      } else if (assessment.submitted) {
        data = assessment.result;
      } else if (!assessment.draft) {
        data = { error: "Assessment draft unavailable; restart assessment" };
      } else {
        // Match the server authority boundary: the payload validates the roster,
        // but only the last committed draft supplies choices, even after expiry.
        const effectiveAnswers = assessmentQuestions.map((question) =>
          assessment.draft.answers?.[question.id] ?? -1);
        const correct = effectiveAnswers.filter((answer, index) => answer === index).length;
        const score = Math.round(correct / assessmentQuestions.length * 100);
        assessment.result = { score, level: "Pemula", correct, total: assessmentQuestions.length };
        assessment.successfulSubmissions = (assessment.successfulSubmissions ?? 0) + 1;
        assessment.submitted = true;
        data = assessment.result;
      }
    } else if (url.pathname.startsWith("/rest/v1/") &&
        ["toolkit_activities", "contributions", "e_course_modules", "competency_domains",
        "marketplace_products", "marketplace_orders"].includes(endpoint) &&
        ["GET", "HEAD"].includes(request.method())) {
      // Login and revoked-role redirects both visit the real Dashboard.
      // Its ancillary read-only lists/counts are empty in this isolated backend.
      await route.fulfill({
        status: 200, contentType: "application/json",
        headers: { "content-range": "*/0" },
        body: request.method() === "HEAD" ? "" : "[]",
      });
      return;
    } else if (url.pathname.startsWith("/rest/v1/") && emptyTables.has(endpoint)) {
      data = [];
    } else if (url.pathname === "/rest/v1/profiles") {
      const profile = {
        user_id: requestUser.id, full_name: requestUser.user_metadata.full_name, company: "Perusahaan Profil Lama",
        position: "Anggota", current_level: "Pemula", total_score: 0,
        created_at: "2026-09-01T00:00:00.000Z",
      };
      data = single ? profile : [profile];
    } else {
      unexpectedRequests.push(`${request.method()} ${url.pathname}`);
    }

    await route.fulfill({
      status: data === undefined ? 503 : 200,
      contentType: "application/json",
      body: JSON.stringify(data === undefined ? { message: "Unexpected test request" } : single && Array.isArray(data) ? data[0] ?? null : data),
    });
  });
  return unexpectedRequests;
}

test.describe("halaman anggota dengan sesi tiruan", () => {
  test("draf assessment pulih otomatis setelah jaringan browser benar-benar offline lalu reload", async ({ page, context }) => {
    const assessment = { started: null, checks: [], submissions: [], submitted: false, liveCountdown: true };
    const unexpected = await installAuthenticatedFixture(page, { assessment });
    const draftKey = `pub_assessment_draft_v1:${MEMBER_ID}`;
    const saveUrl = `https://${SUPABASE_HOST}/rest/v1/rpc/save_assessment_draft`;
    const failedSaves = [];
    page.on("requestfailed", request => {
      if (request.url() === saveUrl) failedSaves.push(request.failure()?.errorText);
    });
    await page.addInitScript(() => {
      window.__assessmentNetworkEvents = [];
      for (const type of ["offline", "online"]) {
        window.addEventListener(type, event => {
          window.__assessmentNetworkEvents.push({ type, trusted: event.isTrusted });
        });
      }
    });
    // route.fulfill() bypasses Chromium's offline mode. While offline, let
    // ONLY the inert CI host reach the browser network stack so requests
    // really fail with ERR_INTERNET_DISCONNECTED, rather than mocking an RPC
    // error or dispatching an artificial "online" event. Online requests
    // fall back to the existing isolated, authenticated backend fixture.
    await page.route(`https://${SUPABASE_HOST}/**`, async route => {
      if (await page.evaluate(() => navigator.onLine)) await route.fallback();
      else await route.continue();
    });
    const localDraft = () => page.evaluate(key => {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : null;
    }, draftKey);
    const status = page.getByRole("status").filter({ hasText: /progres|Penyimpanan/i });

    try {
      await page.goto("/assessment");
      await page.getByRole("button", { name: "Mulai Assessment" }).click();
      await expect(status).toHaveText("Progres tersimpan di server.");
      const baseline = structuredClone(assessment.draft);
      expect(baseline.answers).toEqual({});

      await context.setOffline(true);
      await expect.poll(() => page.evaluate(() => navigator.onLine)).toBe(false);
      await page.getByRole("button", { name: /Dokumen legalitas/ }).click();
      await expect(status).toContainText("Penyimpanan tertunda");
      await expect.poll(() => failedSaves.length).toBeGreaterThan(0);
      expect(failedSaves).toContain("net::ERR_INTERNET_DISCONNECTED");
      await expect.poll(async () => (await localDraft())?.answers).toEqual({
        [assessmentQuestions[0].id]: 0,
      });
      expect(assessment.draft).toEqual(baseline);

      // Stay disconnected through at least one real backoff retry. No clock
      // manipulation: countdown, debounce and retry run in the actual browser.
      const failuresBeforeRetry = failedSaves.length;
      await expect.poll(() => failedSaves.length, { timeout: 10_000 }).toBeGreaterThan(failuresBeforeRetry);
      await expect(status).toContainText("Penyimpanan tertunda");
      expect(assessment.draft).toEqual(baseline);

      await context.setOffline(false);
      // No click, focus event, navigation, or reload is allowed to trigger
      // saving here: the browser online event/backoff must recover by itself.
      await expect(status).toHaveText("Progres tersimpan di server.", { timeout: 10_000 });
      expect(assessment.draft.answers).toEqual({ [assessmentQuestions[0].id]: 0 });
      expect(assessment.draft.revision).toBeGreaterThan(baseline.revision);
      await expect.poll(localDraft).toBeNull();
      expect(await page.evaluate(() => window.__assessmentNetworkEvents)).toEqual([
        { type: "offline", trusted: true },
        { type: "online", trusted: true },
      ]);

      // With no local fallback left, reload must recover the answer from the
      // server fixture, not from React state or the browser's pending copy.
      const recoveryChecks = assessment.recoveryChecks ?? 0;
      await page.reload();
      await expect(page).toHaveURL(/\/assessment$/);
      await expect(page.getByRole("heading", { name: assessmentQuestions[0].question_text })).toBeVisible();
      await expect(page.getByRole("button", { name: /Dokumen legalitas/ })).toBeDisabled();
      await expect(page.getByRole("button", { name: "Selanjutnya" })).toBeEnabled();
      await expect(status).toHaveText("Progres tersimpan di server.");
      expect(assessment.recoveryChecks).toBeGreaterThan(recoveryChecks);
      expect(assessment.draft.answers).toEqual({ [assessmentQuestions[0].id]: 0 });
      expect(assessment.starts).toBe(1);
      expect(assessment.submissions).toEqual([]);
      expect(unexpected).toEqual([]);
    } finally {
      await context.setOffline(false);
    }
  });

  for (const useRemote of [false, true]) {
    test(`dua perangkat mempertahankan jawaban lain saat memilih ${useRemote ? "perangkat lain" : "perangkat ini"} pada konflik`, async ({ page, browser }) => {
      const assessment = { started: null, checks: [], submissions: [], submitted: false };
      const unexpected = await installAuthenticatedFixture(page, { assessment });
      await page.goto("/assessment");
      await page.getByRole("button", { name: "Mulai Assessment" }).click();
      await expect.poll(() => assessment.draft?.revision).toBeGreaterThan(0);
      const other = await browser.newPage();
      try {
        const otherUnexpected = await installAuthenticatedFixture(other, { assessment });
        await other.goto("/assessment");
        await expect(other.getByRole("heading", { name: assessmentQuestions[0].question_text })).toBeVisible();
        await page.getByRole("button", { name: /Dokumen legalitas/ }).click();
        await expect.poll(() => assessment.draft.answers[assessmentQuestions[0].id]).toBe(0);
        await other.getByRole("button", { name: /Dokumen lain/ }).click();
        await expect(other.getByRole("heading", { name: "Ada jawaban berbeda di perangkat lain" })).toBeVisible();
        // While resolution is paused, the first device adds another valid answer.
        await page.getByRole("button", { name: "Selanjutnya" }).click();
        await page.getByRole("button", { name: /Periksa kesiapan/ }).click();
        await expect.poll(() => assessment.draft.answers[assessmentQuestions[1].id]).toBe(1);
        await other.getByRole("button", {
          name: useRemote ? /Gunakan jawaban perangkat lain:/ : /Gunakan jawaban perangkat ini:/,
        }).click();
        await expect(other.getByRole("heading", { name: "Ada jawaban berbeda di perangkat lain" })).toHaveCount(0);
        await expect.poll(() => assessment.draft.answers).toEqual({
          [assessmentQuestions[0].id]: useRemote ? 0 : 1,
          [assessmentQuestions[1].id]: 1,
        });
        await other.reload();
        // Navigation is shared draft metadata: the first device may have saved
        // its position on question two immediately before the reload.
        await expect(other.getByRole("heading", { name: /Apa dokumen pertama|Apa langkah berikutnya/ })).toBeVisible();
        await expect(other.getByRole("heading", { name: "Ada jawaban berbeda di perangkat lain" })).toHaveCount(0);
        if (await other.getByRole("heading", { name: assessmentQuestions[0].question_text }).isVisible()) {
          await other.getByRole("button", { name: "Selanjutnya" }).click();
        }
        await expect(other.getByRole("button", { name: /Periksa kesiapan/ })).toBeDisabled();
        await other.getByRole("button", { name: "Review Jawaban" }).click();
        await expect(other.getByRole("heading", { name: "Review Jawaban" })).toBeVisible();
        await expect(other.getByRole("button", { name: "Selesai & Lihat Hasil" })).toBeEnabled();
        await other.getByRole("button", { name: "Selesai & Lihat Hasil" }).click();
        await expect(other.getByRole("heading", { name: "Assessment Selesai!" })).toBeVisible();
        expect(assessment.submissions[0]._answers.map(item => item.selected_answer)).toEqual([useRemote ? 0 : 1, 1]);
        expect(unexpected).toEqual([]);
        expect(otherUnexpected).toEqual([]);
      } finally { await other.close(); }
    });
  }

  test("logout membersihkan jawaban assessment dari browser bersama", async ({ page }) => {
    await installAuthenticatedFixture(page);
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: /Keluar/ })).toBeVisible();
    await page.evaluate((ownerId) => {
      localStorage.setItem(`pub_assessment_draft_v1:${ownerId}`, JSON.stringify({ answers: { soal: 1 }, questions: ["Rahasia"] }));
      localStorage.setItem("pub_assessment_draft_v1:anggota-sebelumnya", JSON.stringify({ answers: { soal: 0 } }));
    }, MEMBER_ID);
    await page.getByRole("button", { name: /Keluar/ }).click();
    await expect(page).toHaveURL(/\/auth$/);
    expect(await page.evaluate(() => ({
      drafts: Object.keys(localStorage).filter((key) => key.startsWith("pub_assessment_draft_v1:")),
      onboarding: localStorage.getItem("pub_onboarding_done"),
    }))).toEqual({ drafts: [], onboarding: "1" });
  });

  for (const outcome of ["success", "failure", "conflict"]) {
    test(`pergantian akun mengabaikan respons assessment A (${outcome}) setelah B masuk`, async ({ page }) => {
      const first = { started: null, submitted: false, checks: [] };
      const second = { started: null, submitted: false, checks: [], id: "00000000-0000-4000-8000-000000000061" };
      const accounts = new Map([
        [member.id, { user: member, assessment: first }],
        [secondMember.id, { user: secondMember, assessment: second }],
      ]);
      const unexpected = await installAuthenticatedFixture(page, { assessment: first, accounts });
      // Record even transient writes: a later B save must not hide A's
      // resurrected local backup by deleting/overwriting it before assertion.
      await page.addInitScript(() => {
        window.__assessmentWrites = [];
        const setItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (this === localStorage && key.startsWith("pub_assessment_draft_v1:")) {
            window.__assessmentWrites.push({ key, draft: JSON.parse(value) });
          }
          return setItem.call(this, key, value);
        };
      });
      await page.goto("/assessment");
      await expect(page.getByText(member.user_metadata.full_name, { exact: true })).toBeVisible();
      await page.getByRole("button", { name: "Mulai Assessment" }).click();
      await expect.poll(() => first.draft?.revision).toBeGreaterThan(0);

      const saveUrl = `https://${SUPABASE_HOST}/rest/v1/rpc/save_assessment_draft`;
      let releaseA, releaseB;
      const gateA = new Promise(resolve => { releaseA = resolve; });
      const gateB = new Promise(resolve => { releaseB = resolve; });
      let pendingA, pendingB;
      let savesA = 0, savesB = 0, profilesA = 0;
      const staleProfileName = "Profil lama anggota A";
      const staleProfileUrl = `https://${SUPABASE_HOST}/rest/v1/profiles?*`;
      await page.route(staleProfileUrl, async route => {
        if (new URL(route.request().url()).searchParams.get("user_id") !== `eq.${member.id}`) {
          await route.fallback();
          return;
        }
        profilesA++;
        await gateA;
        await route.fulfill({
          status: 200, contentType: "application/json",
          body: JSON.stringify({
            user_id: member.id, full_name: staleProfileName, company: "Perusahaan A",
            current_level: "Ahli", total_score: 999,
          }),
        });
      });
      await page.route(saveUrl, async route => {
        const incoming = route.request().postDataJSON()._draft;
        if (route.request().headers().authorization === `Bearer ${fixtureSession(member).access_token}`) {
          savesA++;
          pendingA = incoming;
          await gateA;
          await route.fulfill({
            status: outcome === "failure" ? 503 : 200, contentType: "application/json",
            body: JSON.stringify(outcome === "failure" ? { message: "Penyimpanan A gagal terlambat" } : {
              saved: outcome === "success",
              draft: { ...incoming, revision: incoming.revision + 1 },
            }),
          });
        } else {
          expect(route.request().headers().authorization).toBe(`Bearer ${fixtureSession(secondMember).access_token}`);
          if (incoming.answers[assessmentQuestions[0].id] === 1) {
            savesB++;
            pendingB = incoming;
            await gateB;
          }
          await route.fallback();
        }
      });
      const localDrafts = () => page.evaluate(() => Object.fromEntries(
        Object.keys(localStorage).filter(key => key.startsWith("pub_assessment_draft_v1:"))
          .map(key => [key, JSON.parse(localStorage.getItem(key))])));
      const firstKey = `pub_assessment_draft_v1:${member.id}`;
      const secondKey = `pub_assessment_draft_v1:${secondMember.id}`;
      try {
        await page.getByRole("button", { name: /Dokumen legalitas/ }).click();
        await expect.poll(() => pendingA?.answers[assessmentQuestions[0].id]).toBe(0);
        await expect.poll(async () => (await localDrafts())[firstKey]?.answers)
          .toEqual({ [assessmentQuestions[0].id]: 0 });
        await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        await expect.poll(() => profilesA).toBe(1);
        await page.getByRole("button", { name: /Keluar/ }).click();
        await expect(page).toHaveURL(/\/auth$/);
        expect(await localDrafts()).toEqual({});
        const writesAtLogout = await page.evaluate(() => window.__assessmentWrites.length);

        // Real login form and SDK auth event, without reload or token injection:
        // A's unresolved requests and provider instance remain alive.
        await page.locator('input[type="email"]').fill(secondMember.email);
        await page.locator('input[type="password"]').fill("test-only-password");
        await page.getByRole("button", { name: "Masuk", exact: true }).click();
        await expect(page).toHaveURL(/\/dashboard$/);
        await expect(page.getByRole("heading", { name: secondMember.user_metadata.full_name, exact: true })).toBeVisible();
        await page.getByText("Mulai Pre-test", { exact: true }).click();
        await expect(page).toHaveURL(/\/assessment$/);
        await page.getByRole("button", { name: "Mulai Assessment" }).click();
        await expect.poll(() => second.draft?.revision).toBeGreaterThan(0);
        await page.getByRole("button", { name: /Dokumen lain/ }).click();
        await expect.poll(() => pendingB?.answers[assessmentQuestions[0].id]).toBe(1);
        // Answer checking is independent of the blocked draft save; wait for
        // its legitimate update before comparing B's backup across release.
        await expect.poll(async () => (await localDrafts())[secondKey]?.answerResults[assessmentQuestions[0].id]?.selected)
          .toBe(1);
        expect(second.started.user_id).toBe(secondMember.id);
        expect(pendingB.preTestId).toBe(second.id);
        const bDraftBefore = (await localDrafts())[secondKey];
        expect(bDraftBefore.answers).toEqual({ [assessmentQuestions[0].id]: 1 });

        const lateSave = page.waitForResponse(response => response.url() === saveUrl &&
          response.request().headers().authorization === `Bearer ${fixtureSession(member).access_token}`);
        const lateProfile = page.waitForResponse(response => response.url().includes("/rest/v1/profiles?") &&
          new URL(response.url()).searchParams.get("user_id") === `eq.${member.id}`);
        releaseA();
        await Promise.all([(await lateSave).finished(), (await lateProfile).finished()]);
        // Cross the first automatic retry delay as well as promise callbacks.
        await page.waitForTimeout(2200);
        expect(savesA).toBe(1);
        expect(await localDrafts()).toEqual({ [secondKey]: bDraftBefore });
        await expect(page).toHaveURL(/\/assessment$/);
        await expect(page.getByText(secondMember.user_metadata.full_name, { exact: true })).toBeVisible();
        await expect(page.getByText(staleProfileName, { exact: true })).toHaveCount(0);
        await expect(page.getByText(member.user_metadata.full_name, { exact: true })).toHaveCount(0);
        await expect(page.getByRole("heading", { name: assessmentQuestions[0].question_text })).toBeVisible();
        await expect(page.getByRole("button", { name: /Dokumen lain/ })).toBeDisabled();
        await expect(page.getByText("Penjelasan soal uji.")).toBeVisible();
        const writes = await page.evaluate(index => window.__assessmentWrites.slice(index), writesAtLogout);
        expect(writes.length).toBeGreaterThan(0);
        expect(writes.every(({ key, draft }) => key === secondKey && draft.preTestId === second.id &&
          draft.answers[assessmentQuestions[0].id] !== 0)).toBe(true);

        // B can finish its own write and make another edit after the old A
        // callbacks; this catches a stale callback blocking the new save queue.
        releaseB();
        await expect.poll(() => second.draft?.answers[assessmentQuestions[0].id]).toBe(1);
        await page.getByRole("button", { name: "Selanjutnya" }).click();
        await page.getByRole("button", { name: /Periksa kesiapan/ }).click();
        await expect.poll(() => second.draft?.answers).toEqual({
          [assessmentQuestions[0].id]: 1, [assessmentQuestions[1].id]: 1,
        });
        await expect.poll(localDrafts).toEqual({});
        expect(savesB).toBeGreaterThanOrEqual(2);
        expect(unexpected).toEqual([]);
      } finally {
        releaseA();
        releaseB();
      }
    });
  }

  test("storage logout lama tanpa BroadcastChannel tidak menutup identitas baru", async ({ page, context }) => {
    await context.addInitScript(() => {
      Object.defineProperty(window, "BroadcastChannel", { value: undefined, configurable: true });
    });
    const accounts = new Map([
      [member.id, { user: member, assessment: {} }],
      [secondMember.id, { user: secondMember, assessment: {} }],
    ]);
    const unexpected = await installAuthenticatedFixture(page, { accounts });
    let logoutRequests = 0;
    context.on("request", request => {
      if (request.url().startsWith(`https://${SUPABASE_HOST}/auth/v1/logout`) &&
          request.method() === "POST") logoutRequests++;
    });
    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: member.user_metadata.full_name, exact: true })).toBeVisible();
    const other = await context.newPage();
    try {
      const otherUnexpected = await installAuthenticatedFixture(other, { accounts });
      await other.addInitScript(() => {
        window.__heldTokenRemovals = [];
        window.__deliveredTokenRemovals = 0;
        window.__releaseTokenRemoval = () => {
          const event = window.__heldTokenRemovals.shift();
          if (!event) throw new Error("No queued token removal");
          // Replay the captured cross-tab event, not an SDK auth callback.
          window.__replayingTokenRemoval = true;
          try {
            window.dispatchEvent(new StorageEvent("storage", { ...event, storageArea: localStorage }));
          }
          finally { window.__replayingTokenRemoval = false; }
        };
        // Registered before AuthProvider: defer only token-removal delivery,
        // while shared storage itself changes normally in the other tab.
        window.addEventListener("storage", event => {
          if (event.storageArea !== localStorage ||
              event.key !== "sb-ci-playwright-auth-token" || event.newValue !== null) return;
          if (window.__replayingTokenRemoval) {
            window.__deliveredTokenRemovals++;
            return;
          }
          window.__heldRemovalWasTrusted = event.isTrusted;
          // Copy payload while the native event is being dispatched; do not
          // retain the browser-owned Storage wrapper for later redispatch.
          window.__heldTokenRemovals.push({
            key: event.key, oldValue: event.oldValue, newValue: event.newValue, url: event.url,
          });
          event.stopImmediatePropagation();
        });
      });
      await other.goto("/dashboard");
      await expect(other.getByRole("heading", { name: member.user_metadata.full_name, exact: true })).toBeVisible();
      expect(await other.evaluate(() => typeof BroadcastChannel)).toBe("undefined");

      await page.getByRole("button", { name: /Keluar/ }).click();
      await expect(page).toHaveURL(/\/auth$/);
      await expect.poll(() => other.evaluate(() => window.__heldTokenRemovals.length)).toBe(1);
      expect(await other.evaluate(() => ({
        trusted: window.__heldRemovalWasTrusted,
        oldUser: JSON.parse(window.__heldTokenRemovals[0].oldValue).user.id,
        token: localStorage.getItem("sb-ci-playwright-auth-token"),
        delivered: window.__deliveredTokenRemovals,
      }))).toEqual({ trusted: true, oldUser: member.id, token: null, delivered: 0 });
      // The receiver has not processed the old notification yet.
      await expect(other.getByRole("heading", { name: member.user_metadata.full_name, exact: true })).toBeVisible();
      expect(logoutRequests).toBe(1);

      // Finish an explicit local logout before logging in B. No SDK request
      // or navigation callback is held: only the cross-tab storage event is.
      await other.getByRole("button", { name: /Keluar/ }).click();
      await expect(other).toHaveURL(/\/auth$/);
      // The token is already absent, so the SDK's local signOut has no
      // session to revoke and must not send another HTTP logout request.
      expect(logoutRequests).toBe(1);
      await other.locator('input[type="email"]').fill(secondMember.email);
      await other.locator('input[type="password"]').fill("test-only-password");
      await other.getByRole("button", { name: "Masuk", exact: true }).click();
      await expect(other).toHaveURL(/\/dashboard$/);
      await expect(other.getByRole("heading", { name: secondMember.user_metadata.full_name, exact: true })).toBeVisible();
      const newToken = await other.evaluate(() => localStorage.getItem("sb-ci-playwright-auth-token"));
      expect(JSON.parse(newToken).user.id).toBe(secondMember.id);

      await other.evaluate(() => window.__releaseTokenRemoval());
      expect(await other.evaluate(() => window.__deliveredTokenRemovals)).toBe(1);
      await expect(other).toHaveURL(/\/dashboard$/);
      await expect(other.getByRole("heading", { name: secondMember.user_metadata.full_name, exact: true })).toBeVisible();
      await expect(other.getByRole("heading", { name: member.user_metadata.full_name, exact: true })).toHaveCount(0);
      expect(await other.evaluate(() => localStorage.getItem("sb-ci-playwright-auth-token"))).toBe(newToken);
      // Cross a protected client-side navigation too: B must remain signed in
      // with the same mounted provider, not be restored by a full page reload.
      await other.getByText("Mulai Pre-test", { exact: true }).click();
      await expect(other).toHaveURL(/\/assessment$/);
      await expect(other.getByRole("heading", { name: "Pre-test Assessment" })).toBeVisible();
      await expect(other.getByText(secondMember.user_metadata.full_name, { exact: true })).toBeVisible();
      expect(logoutRequests).toBe(1);
      expect(unexpected).toEqual([]);
      expect(otherUnexpected).toEqual([]);
    } finally {
      await other.close();
    }
  });

  for (const logoutMode of ["available", "unavailable", "throws", "storage-clear"]) {
  const channelMode = logoutMode === "storage-clear" ? "unavailable" : logoutMode;
  test(`logout dua tab (${logoutMode}) menghapus draf meskipun penyimpanan masih tertunda`, async ({ page, context }) => {
    // Each test owns an isolated browser context. Both tabs share only this
    // fake session; no requests may escape to a hosted Supabase project.
    await context.addInitScript((mode) => {
      if (mode === "unavailable") {
        Object.defineProperty(window, "BroadcastChannel", { value: undefined, configurable: true });
      } else if (mode === "throws") {
        Object.defineProperty(window, "BroadcastChannel", {
          value: class { constructor() { throw new Error("BroadcastChannel blocked for test"); } },
          configurable: true,
        });
      }
    }, channelMode);
    const assessment = { started: null, checks: [], submissions: [], submitted: false };
    const unexpected = await installAuthenticatedFixture(page, { assessment });
    await page.goto("/assessment");
    await expect(page.getByRole("button", { name: /Keluar/ })).toBeVisible();

    // Same context, unlike separate-device tests: use real browser storage
    // events, and Supabase's real broadcast only in the available variant.
    const other = await context.newPage();
    let releaseSave;
    const saveGate = new Promise((resolve) => { releaseSave = resolve; });
    try {
      const otherUnexpected = await installAuthenticatedFixture(other, { assessment });
      await other.addInitScript(({ mode, clearStorage }) => {
        window.__logoutBroadcasts = 0;
        window.__logoutStorageEvents = 0;
        window.__receivedLogoutStorageEvents = [];
        window.__unrelatedStorageRemovals = 0;
        window.__draftWritesAfterLogout = [];
        const originalSetItem = Storage.prototype.setItem;
        Storage.prototype.setItem = function (key, value) {
          if (this === localStorage && (window.__logoutBroadcasts > 0 || window.__logoutStorageEvents > 0) &&
              key.startsWith("pub_assessment_draft_v1:")) {
            window.__draftWritesAfterLogout.push(key);
          }
          return originalSetItem.call(this, key, value);
        };
        if (mode !== "available") {
          window.addEventListener("storage", (event) => {
            if (event.storageArea === localStorage && event.isTrusted &&
                event.key === "pub_test_unrelated" && event.newValue === null) {
              window.__unrelatedStorageRemovals++;
            }
            if (event.storageArea === localStorage &&
                event.key === (clearStorage ? null : "sb-ci-playwright-auth-token") &&
                event.newValue === null) {
              // Seed a late leftover before the provider's listener runs.
              // Shared storage removal alone must not make the test pass.
              originalSetItem.call(localStorage, "pub_assessment_draft_v1:late-leftover",
                JSON.stringify({ answers: { soal: 1 }, questions: ["Rahasia"] }));
              window.__receivedLogoutStorageEvents.push({
                key: event.key, newValue: event.newValue, isTrusted: event.isTrusted,
              });
              window.__logoutStorageEvents++;
            }
          });
          return;
        }
        const originalAddListener = BroadcastChannel.prototype.addEventListener;
        BroadcastChannel.prototype.addEventListener = function (type, listener, options) {
          if (type !== "message" || this.name !== "sb-ci-playwright-auth-token") {
            return originalAddListener.call(this, type, listener, options);
          }
          return originalAddListener.call(this, type, (event) => {
            if (event.data?.event === "SIGNED_OUT") {
              // Tab one's purge already removed shared localStorage. Seed a
              // late leftover immediately before delivery so only tab two's
              // SIGNED_OUT handler can clean it; shared storage alone cannot
              // make this test pass.
              originalSetItem.call(localStorage, "pub_assessment_draft_v1:late-leftover",
                JSON.stringify({ answers: { soal: 1 }, questions: ["Rahasia"] }));
              window.__logoutBroadcasts++;
            }
            return listener.call(this, event);
          }, options);
        };
      }, { mode: channelMode, clearStorage: logoutMode === "storage-clear" });
      await other.goto("/assessment");
      await other.getByRole("button", { name: "Mulai Assessment" }).click();
      await expect.poll(() => assessment.draft?.revision).toBeGreaterThan(0);

      let saveRequests = 0;
      let pendingDraft;
      await other.route(`https://${SUPABASE_HOST}/rest/v1/rpc/save_assessment_draft`, async (route) => {
        saveRequests++;
        pendingDraft = route.request().postDataJSON()._draft;
        await saveGate;
        await route.fulfill({
          status: 503, contentType: "application/json",
          body: JSON.stringify({ message: "Penyimpanan uji tertunda lalu gagal" }),
        });
      });
      await other.getByRole("button", { name: /Dokumen legalitas/ }).click();
      await expect.poll(() => pendingDraft?.answers[assessmentQuestions[0].id]).toBe(0);
      const localDrafts = () => other.evaluate(() =>
        Object.keys(localStorage).filter((key) => key.startsWith("pub_assessment_draft_v1:")));
      await expect.poll(async () => other.evaluate((id) => {
        const draft = JSON.parse(localStorage.getItem(`pub_assessment_draft_v1:${id}`) ?? "null");
        return draft?.answers;
      }, MEMBER_ID)).toEqual({ [assessmentQuestions[0].id]: 0 });

      if (logoutMode === "storage-clear") {
        // The same native event path must ignore a non-auth key removal.
        // Wait for delivery before checking identity and the in-flight draft.
        await page.evaluate(() => {
          localStorage.setItem("pub_test_unrelated", "1");
          localStorage.removeItem("pub_test_unrelated");
        });
        await expect.poll(() => other.evaluate(() => window.__unrelatedStorageRemovals)).toBe(1);
        await expect(other).toHaveURL(/\/assessment$/);
        await expect(other.getByRole("heading", { name: assessmentQuestions[0].question_text })).toBeVisible();
        await expect(other.getByRole("button", { name: /Keluar/ })).toBeVisible();
        expect(await other.evaluate(() => localStorage.getItem("sb-ci-playwright-auth-token"))).not.toBeNull();
        expect(await localDrafts()).toEqual([`pub_assessment_draft_v1:${MEMBER_ID}`]);
        expect(saveRequests).toBe(1);

        // No SDK signOut or synthetic StorageEvent: clearing in tab one
        // produces the real key=null event consumed by tab two's provider.
        await page.evaluate(() => localStorage.clear());
      } else {
        await page.getByRole("button", { name: /Keluar/ }).click();
        await expect(page).toHaveURL(/\/auth$/);
      }
      await expect.poll(() => other.evaluate(() =>
        localStorage.getItem("sb-ci-playwright-auth-token"))).toBeNull();
      if (channelMode === "available") {
        await expect.poll(() => other.evaluate(() => window.__logoutBroadcasts)).toBe(1);
      } else {
        await expect.poll(() => other.evaluate(() => window.__logoutStorageEvents)).toBe(1);
        expect(await other.evaluate(() => window.__receivedLogoutStorageEvents)).toEqual([{
          key: logoutMode === "storage-clear" ? null : "sb-ci-playwright-auth-token",
          newValue: null, isTrusted: true,
        }]);
        expect(await other.evaluate(() => window.__logoutBroadcasts)).toBe(0);
        expect(await other.evaluate(() => typeof BroadcastChannel)).toBe(
          channelMode === "unavailable" ? "undefined" : "function");
      }
      await expect(other).toHaveURL(/\/auth$/);
      await expect(other.getByRole("heading", { name: "Masuk ke Akun" })).toBeVisible();
      await expect(other.getByRole("heading", { name: assessmentQuestions[0].question_text })).toHaveCount(0);
      await expect(other.getByRole("button", { name: /Keluar/ })).toHaveCount(0);
      await expect.poll(localDrafts).toEqual([]);

      const lateResponse = other.waitForResponse((response) =>
        response.url() === `https://${SUPABASE_HOST}/rest/v1/rpc/save_assessment_draft` &&
        response.status() === 503);
      releaseSave();
      await (await lateResponse).finished();
      // Also cross the first automatic retry's 2-second delay. A late failure
      // must neither recreate the fallback nor schedule another save.
      await other.waitForTimeout(2200);
      expect(await localDrafts()).toEqual([]);
      expect(await other.evaluate(() => window.__draftWritesAfterLogout)).toEqual([]);
      expect(await other.evaluate(() => localStorage.getItem("pub_onboarding_done"))).toBe(
        logoutMode === "storage-clear" ? null : "1");
      expect(saveRequests).toBe(1);
      expect(unexpected).toEqual([]);
      expect(otherUnexpected).toEqual([]);
    } finally {
      releaseSave();
      await other.close();
    }
  });
  }

  test("assessment menampilkan formulir awal dan riwayat", async ({ page }) => {
    const unexpected = await installAuthenticatedFixture(page);
    await page.goto("/assessment");
    await expect(page).toHaveURL(/\/assessment$/);
    await expect(page.getByRole("heading", { name: "Pre-test Assessment" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Mulai Assessment" })).toBeVisible();
    await expect(page.getByText("Belum ada assessment yang selesai.")).toBeVisible();
    expect(unexpected).toEqual([]);
  });

  test("anggota menyelesaikan assessment dan melihat hasil dari respons server", async ({ page }) => {
    const assessment = { started: null, checks: [], submission: null, submitted: false };
    const unexpected = await installAuthenticatedFixture(page, { assessment });
    await page.goto("/assessment");
    await expect(page.getByRole("button", { name: "Mulai Assessment" })).toBeVisible();
    await page.getByRole("button", { name: "Mulai Assessment" }).click();

    await expect(page.getByRole("heading", { name: assessmentQuestions[0].question_text })).toBeVisible();
    await expect(page.getByText("Soal 1/2")).toBeVisible();
    await expect(page.getByRole("button", { name: "Selanjutnya" })).toBeDisabled();
    await page.getByRole("button", { name: /Dokumen legalitas/ }).click();
    await expect(page.getByText("Penjelasan soal uji.")).toBeVisible();
    await page.getByRole("button", { name: "Selanjutnya" }).click();

    await expect(page.getByRole("heading", { name: assessmentQuestions[1].question_text })).toBeVisible();
    await page.getByRole("button", { name: /Lewati evaluasi/ }).click();
    await expect(page.getByText("Penjelasan soal uji.")).toBeVisible();
    await page.getByRole("button", { name: "Review Jawaban" }).click();
    await expect(page.getByRole("heading", { name: "Review Jawaban" })).toBeVisible();
    await page.getByRole("button", { name: "Selesai & Lihat Hasil" }).click();

    await expect(page.getByRole("heading", { name: "Assessment Selesai!" })).toBeVisible();
    await expect(page.getByText("Skor: 50")).toBeVisible();
    await expect(page.getByText("Level Kompetensi Anda:")).toBeVisible();
    await expect(page.getByText("1 dari 2 jawaban benar")).toBeVisible();
    expect(assessment.started).toEqual({ user_id: MEMBER_ID, total_questions: 2, status: "in_progress" });
    expect(assessment.checks).toEqual([
      { _question_id: assessmentQuestions[0].id, _selected_answer: 0 },
      { _question_id: assessmentQuestions[1].id, _selected_answer: 0 },
    ]);
    expect(assessment.submission).toEqual({
      _pre_test_id: ASSESSMENT_ID,
      _answers: assessmentQuestions.map((q) => ({ question_id: q.id, selected_answer: 0 })),
    });
    expect(unexpected).toEqual([]);
  });

  for (const expired of [false, true]) {
    test(`nilai memakai draf server meski payload browser berbeda ${expired ? "setelah" : "sebelum"} tenggat`, async ({ page }) => {
      const assessment = { started: null, checks: [], submissions: [], submitted: false };
      const unexpected = await installAuthenticatedFixture(page, { assessment });
      await page.goto("/assessment");
      await page.getByRole("button", { name: "Mulai Assessment" }).click();
      await page.getByRole("button", { name: /Dokumen legalitas/ }).click();
      await page.getByRole("button", { name: "Selanjutnya" }).click();
      await page.getByRole("button", { name: /Lewati evaluasi/ }).click();
      await page.getByRole("button", { name: "Review Jawaban" }).click();
      await expect(page.getByRole("heading", { name: "Review Jawaban" })).toBeVisible();
      const savedAnswers = Object.fromEntries(assessmentQuestions.map((question) => [question.id, 0]));
      await expect.poll(() => assessment.draft?.answers).toEqual(savedAnswers);

      // Alter the wire payload only, after the UI has synchronized its draft.
      // Moving server time here also avoids relying on the browser's countdown.
      const changedPayloads = [];
      await page.route(`https://${SUPABASE_HOST}/rest/v1/rpc/submit_assessment`, async (route) => {
        const payload = route.request().postDataJSON();
        if (expired) assessment.serverTimeOffset = Date.parse(assessment.deadlineAt) - Date.now() + 1_000;
        expect(Date.now() + (assessment.serverTimeOffset ?? 0) >= Date.parse(assessment.deadlineAt)).toBe(expired);
        const changed = {
          ...payload,
          _answers: assessmentQuestions.map((question, index) => ({
            question_id: question.id, selected_answer: index,
          })),
        };
        changedPayloads.push(changed);
        await route.fallback({ postData: JSON.stringify(changed) });
      });
      await page.getByRole("button", { name: "Selesai & Lihat Hasil" }).click();
      await expect(page.getByRole("heading", { name: "Assessment Selesai!" })).toBeVisible();
      await expect(page.getByText("Skor: 50", { exact: true })).toBeVisible();
      await expect(page.getByText("1 dari 2 jawaban benar", { exact: true })).toBeVisible();
      expect(changedPayloads).toHaveLength(1);
      expect(assessment.submissions).toEqual(changedPayloads);
      expect(assessment.submission._answers.map((answer) => answer.selected_answer)).toEqual([0, 1]);
      expect(assessment.draft.answers).toEqual(savedAnswers);
      expect(assessment.result).toEqual({ score: 50, level: "Pemula", correct: 1, total: 2 });
      expect(assessment.successfulSubmissions).toBe(1);
      expect(unexpected).toEqual([]);
    });
  }

  test("jawaban tetap tersedia dan submit dapat diulang setelah jaringan gagal", async ({ page }) => {
    const assessment = {
      started: null, checks: [], submissions: [], submitted: false,
      successfulSubmissions: 0, failFirstSubmit: true,
    };
    const unexpected = await installAuthenticatedFixture(page, { assessment });
    await page.goto("/assessment");
    await page.getByRole("button", { name: "Mulai Assessment" }).click();

    await expect(page.getByRole("heading", { name: assessmentQuestions[0].question_text })).toBeVisible();
    await page.getByRole("button", { name: /Dokumen legalitas/ }).click();
    await page.getByRole("button", { name: "Selanjutnya" }).click();
    await expect(page.getByRole("heading", { name: assessmentQuestions[1].question_text })).toBeVisible();
    await page.getByRole("button", { name: /Lewati evaluasi/ }).click();
    await page.getByRole("button", { name: "Review Jawaban" }).click();
    await expect(page.getByRole("heading", { name: "Review Jawaban" })).toBeVisible();

    await page.getByRole("button", { name: "Selesai & Lihat Hasil" }).click();
    await expect(page.getByText("Gagal mengirim assessment.")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Review Jawaban" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Selesai & Lihat Hasil" })).toBeEnabled();
    await expect(page.getByRole("heading", { name: "Assessment Selesai!" })).toHaveCount(0);
    expect(assessment.submissions).toHaveLength(1);
    expect(assessment.successfulSubmissions).toBe(0);

    await page.getByRole("button", { name: "Kembali ke Soal" }).click();
    await expect(page.getByRole("heading", { name: assessmentQuestions[0].question_text })).toBeVisible();
    await expect(page.getByRole("button", { name: /Dokumen legalitas/ })).toBeDisabled();
    await page.getByRole("button", { name: "Selanjutnya" }).click();
    await expect(page.getByRole("heading", { name: assessmentQuestions[1].question_text })).toBeVisible();
    await expect(page.getByRole("button", { name: /Lewati evaluasi/ })).toBeDisabled();
    await page.getByRole("button", { name: "Review Jawaban" }).click();

    await page.getByRole("button", { name: "Selesai & Lihat Hasil" }).click();
    await expect(page.getByRole("heading", { name: "Assessment Selesai!" })).toHaveCount(1);
    await expect(page.getByText("Skor: 50")).toBeVisible();
    expect(assessment.submissions).toEqual([
      {
        _pre_test_id: ASSESSMENT_ID,
        _answers: assessmentQuestions.map((q) => ({ question_id: q.id, selected_answer: 0 })),
      },
      {
        _pre_test_id: ASSESSMENT_ID,
        _answers: assessmentQuestions.map((q) => ({ question_id: q.id, selected_answer: 0 })),
      },
    ]);
    expect(assessment.successfulSubmissions).toBe(1);
    expect(unexpected).toEqual([]);
  });

  test("draf assessment dipulihkan pada soal dan review tanpa membuat pre-test baru", async ({ page }) => {
    const assessment = { started: null, checks: [], submissions: [], submitted: false };
    const unexpected = await installAuthenticatedFixture(page, { assessment });
    await page.goto("/assessment");
    await page.getByRole("button", { name: "Mulai Assessment" }).click();
    await expect(page.getByRole("heading", { name: assessmentQuestions[0].question_text })).toBeVisible();
    await page.getByRole("button", { name: /Dokumen legalitas/ }).click();
    await expect(page.getByText("Penjelasan soal uji.")).toBeVisible();
    await page.getByRole("button", { name: "Selanjutnya" }).click();
    await expect(page.getByRole("heading", { name: assessmentQuestions[1].question_text })).toBeVisible();
    await page.reload();

    await expect(page.getByRole("heading", { name: assessmentQuestions[1].question_text })).toBeVisible();
    await expect(page.getByText("Soal 2/2")).toBeVisible();
    await page.getByRole("button", { name: "Sebelumnya" }).click();
    await expect(page.getByRole("button", { name: /Dokumen legalitas/ })).toBeDisabled();
    await page.getByRole("button", { name: "Selanjutnya" }).click();
    await page.getByRole("button", { name: /Periksa kesiapan/ }).click();
    await expect(page.getByText("Penjelasan soal uji.")).toBeVisible();
    await page.getByRole("button", { name: "Review Jawaban" }).click();
    await expect(page.getByRole("heading", { name: "Review Jawaban" })).toBeVisible();
    await page.reload();

    await expect(page.getByRole("heading", { name: "Review Jawaban" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Selesai & Lihat Hasil" })).toBeEnabled();
    await page.getByRole("button", { name: "Selesai & Lihat Hasil" }).click();
    await expect(page.getByRole("heading", { name: "Assessment Selesai!" })).toBeVisible();
    expect(assessment.starts).toBe(1);
    expect(assessment.recoveryChecks).toBe(2);
    expect(assessment.submissions).toEqual([{
      _pre_test_id: ASSESSMENT_ID,
      _answers: assessmentQuestions.map((q, i) => ({ question_id: q.id, selected_answer: i })),
    }]);
    await expect.poll(() => page.evaluate((id) =>
      localStorage.getItem(`pub_assessment_draft_v1:${id}`), MEMBER_ID)).toBeNull();
    await page.reload();
    await expect(page.getByRole("button", { name: "Mulai Assessment" })).toBeEnabled();
    expect(assessment.starts).toBe(1);
    expect(unexpected).toEqual([]);
  });

  test("draf lama yang sudah selesai tidak dipulihkan", async ({ page }) => {
    const assessment = { started: { user_id: MEMBER_ID, total_questions: 2 }, submitted: true,
      result: { score: 50, level: "Pemula" }, checks: [] };
    const unexpected = await installAuthenticatedFixture(page, { assessment });
    await page.addInitScript(({ id, question }) => {
      localStorage.setItem(`pub_assessment_draft_v1:${id}`, JSON.stringify({
        version: 1, preTestId: "00000000-0000-4000-8000-000000000032",
        questions: [question], answers: {}, answerResults: {},
        currentQ: 0, phase: "test", timeLeft: 90, timedOut: false,
      }));
    }, { id: MEMBER_ID, question: assessmentQuestions[0] });
    await page.goto("/assessment");
    await expect(page.getByRole("button", { name: "Mulai Assessment" })).toBeEnabled();
    await expect(page.getByRole("heading", { name: assessmentQuestions[0].question_text })).toHaveCount(0);
    expect(assessment.recoveryChecks).toBe(1);
    expect(assessment.legacyRecoveryChecks).toBe(1);
    await expect(page.getByText("Skor: 50")).toBeVisible();
    expect(assessment.starts ?? 0).toBe(0);
    expect(unexpected).toEqual([]);
  });

  for (const { scenario, answerFirst, expectedScore } of [
    { scenario: "sebagian dijawab", answerFirst: true, expectedScore: 50 },
    { scenario: "tidak ada jawaban", answerFirst: false, expectedScore: 0 },
  ]) {
    test(`waktu habis: ${scenario} dikirim dan hasil sesuai jumlah soal`, async ({ page }) => {
      const assessment = {
        started: null, checks: [], submissions: [], submitted: false,
        durationMs: 8_000, liveCountdown: true,
      };
      const unexpected = await installAuthenticatedFixture(page, { assessment });
      await page.goto("/assessment");
      await page.getByRole("button", { name: "Mulai Assessment" }).click();
      await expect(page.getByRole("heading", { name: assessmentQuestions[0].question_text })).toBeVisible();

      if (answerFirst) {
        await page.getByRole("button", { name: /Dokumen legalitas/ }).click();
        await expect(page.getByText("Penjelasan soal uji.")).toBeVisible();
        await expect(page.getByRole("button", { name: "Selanjutnya" })).toBeEnabled();
      } else {
        await expect(page.getByRole("button", { name: "Selanjutnya" })).toBeDisabled();
      }

      // Keep browser monotonic time, async submission, and server time aligned.
      // A temporary performance.now override expires only the rendered timer,
      // not the subsequent save/submit work, and can wrongly renew the draft.
      const deadline = assessment.deadlineAt;
      const expectedAnswers = answerFirst ? { [assessmentQuestions[0].id]: 0 } : {};
      await expect.poll(() => assessment.draft?.answers).toEqual(expectedAnswers);
      expect(Date.now()).toBeLessThan(Date.parse(deadline));
      expect(assessment.submissions).toEqual([]);
      await expect(page.getByRole("heading", { name: "Assessment Selesai!" })).toBeVisible({ timeout: 12_000 });
      expect(Date.now()).toBeGreaterThanOrEqual(Date.parse(deadline));
      expect(assessment.deadlineAt).toBe(deadline);
      expect(assessment.draft.answers).toEqual(expectedAnswers);
      await expect(page.getByText(`Skor: ${expectedScore}`)).toBeVisible();
      await expect(page.getByText(`${answerFirst ? 1 : 0} dari 2 jawaban benar`)).toBeVisible();
      expect(assessment.submissions).toEqual([{
        _pre_test_id: ASSESSMENT_ID,
        _answers: [
          { question_id: assessmentQuestions[0].id, selected_answer: answerFirst ? 0 : -1 },
          { question_id: assessmentQuestions[1].id, selected_answer: -1 },
        ],
      }]);
      expect(assessment.checks).toHaveLength(answerFirst ? 1 : 0);
      expect(assessment.successfulSubmissions).toBe(1);
      expect(unexpected).toEqual([]);
    });
  }

  test("pengiriman saat waktu habis dapat dicoba lagi tanpa menjawab ulang", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    const assessment = {
      started: null, checks: [], submissions: [], submitted: false,
      successfulSubmissions: 0, failFirstSubmit: true, durationMs: 15_000, liveCountdown: true,
    };
    const unexpected = await installAuthenticatedFixture(page, { assessment });
    await page.goto("/assessment");
    await page.getByRole("button", { name: "Mulai Assessment" }).click();
    await expect(page.getByRole("heading", { name: assessmentQuestions[0].question_text })).toBeVisible();
    await page.getByRole("button", { name: /Dokumen legalitas/ }).click();
    await expect(page.getByText("Penjelasan soal uji.")).toBeVisible();

    // Real ticks keep expiry checks inside asynchronous submission consistent.
    await expect(page.getByRole("heading", { name: "Review Jawaban" })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("Gagal mengirim assessment.")).toBeVisible();
    await expect(page.getByText("Sisa waktu: 0:00")).toBeVisible();
    await expect(page.getByText("Waktu hampir habis. Segera kirim jawaban Anda.")).toHaveCount(0);
    await expect(page.getByRole("status")).toContainText("soal lain dihitung salah");
    await expect(page.getByRole("button", { name: "Kembali ke Soal" })).toBeDisabled();
    const retry = page.getByRole("button", { name: "Selesai & Lihat Hasil" });
    await expect(retry).toBeEnabled();
    await retry.click();
    await expect(page.getByRole("heading", { name: "Assessment Selesai!" })).toBeVisible();
    await expect(page.getByText("Skor: 50")).toBeVisible();
    expect(assessment.submissions).toHaveLength(2);
    expect(assessment.submissions[0]).toEqual(assessment.submissions[1]);
    expect(assessment.submissions[1]._answers.map(({ selected_answer }) => selected_answer)).toEqual([0, -1]);
    expect(assessment.successfulSubmissions).toBe(1);
    expect(unexpected).toEqual([]);
  });

  test("review setelah reload melanjutkan deadline server dan dapat mengulang pengiriman saat waktu habis", async ({ page }) => {
    const assessment = {
      started: null, checks: [], submissions: [], submitted: false,
      serverTimeOffset: 0, durationMs: 15_000, liveCountdown: true, failFirstSubmit: true,
    };
    const unexpected = await installAuthenticatedFixture(page, { assessment });
    await page.goto("/assessment");
    await page.getByRole("button", { name: "Mulai Assessment" }).click();
    await expect(page.getByRole("heading", { name: assessmentQuestions[0].question_text })).toBeVisible();
    await page.getByRole("button", { name: /Dokumen legalitas/ }).click();
    await page.getByRole("button", { name: "Selanjutnya" }).click();
    await page.getByRole("button", { name: /Periksa kesiapan/ }).click();
    await page.getByRole("button", { name: "Review Jawaban" }).click();
    await expect(page.getByRole("heading", { name: "Review Jawaban" })).toBeVisible();

    const countdown = page.getByText(/^Sisa waktu: \d:\d\d$/);
    const secondsLeft = async () => {
      const [, minutes, seconds] = (await countdown.innerText()).match(/(\d):(\d\d)$/);
      return Number(minutes) * 60 + Number(seconds);
    };
    await expect(countdown).toHaveText(/Sisa waktu: 0:\d\d/);
    await expect.poll(() => assessment.draft?.phase).toBe("review");
    expect(assessment.draft.answers).toEqual({
      [assessmentQuestions[0].id]: 0, [assessmentQuestions[1].id]: 1,
    });
    const beforeReload = await secondsLeft();
    expect(beforeReload).toBeGreaterThan(5);
    expect(beforeReload).toBeLessThan(15);
    const deadline = assessment.deadlineAt;
    const revision = assessment.draft.revision;

    // No local fallback: recovery must use the RPC envelope, not the stale
    // timeLeft/deadlineAt inside its saved draft. Also simulate time away.
    await page.evaluate((id) => localStorage.removeItem(`pub_assessment_draft_v1:${id}`), MEMBER_ID);
    assessment.draft = { ...assessment.draft, timeLeft: 180, deadlineAt: Date.parse(deadline) + 180_000 };
    assessment.serverTimeOffset += 3_000;
    await page.reload();
    await expect(page.getByRole("heading", { name: "Review Jawaban" })).toBeVisible();
    await expect(countdown).toHaveText(/Sisa waktu: 0:\d\d/);
    const afterReload = await secondsLeft();
    expect(afterReload).toBeGreaterThan(0);
    expect(afterReload).toBeLessThan(beforeReload);
    expect(Math.abs(afterReload - (beforeReload - 3))).toBeLessThanOrEqual(2);
    expect(assessment.deadlineAt).toBe(deadline);
    expect(assessment.starts).toBe(1);
    expect(assessment.recoveryChecks).toBe(1);
    await expect.poll(() => assessment.draft.revision).toBeGreaterThan(revision);
    expect(assessment.submissions).toEqual([]);

    // Use real ticks after reload so the expiry and async submit observe the
    // same monotonic clock, without interfering with transition animations.
    await expect(countdown).toHaveText("Sisa waktu: 0:00", { timeout: 15_000 });
    await expect(page.getByText("Gagal mengirim assessment.")).toBeVisible();
    await expect(page.getByRole("status").filter({ hasText: "Waktu habis." }))
      .toContainText("Jika pengiriman gagal, pilih Selesai & Lihat Hasil untuk mencoba lagi.");
    await expect(page.getByText("Waktu hampir habis. Segera kirim jawaban Anda.")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Kembali ke Soal" })).toBeDisabled();
    expect(assessment.submissions).toHaveLength(1);
    const retry = page.getByRole("button", { name: "Selesai & Lihat Hasil" });
    await expect(retry).toBeEnabled();
    await retry.click();
    await expect(page.getByRole("heading", { name: "Assessment Selesai!" })).toBeVisible();
    const expectedSubmission = {
      _pre_test_id: ASSESSMENT_ID,
      _answers: assessmentQuestions.map((q, i) => ({ question_id: q.id, selected_answer: i })),
    };
    expect(assessment.submissions).toEqual([expectedSubmission, expectedSubmission]);
    expect(assessment.successfulSubmissions).toBe(1);
    expect(assessment.starts).toBe(1);
    expect(assessment.recoveryChecks).toBe(1);
    expect(unexpected).toEqual([]);
  });

  test("review yang dibuka setelah deadline server langsung nol dan mengirim jawaban tersimpan sekali", async ({ page }) => {
    // The fixture suspends one-second intervals: expiry must be recognized
    // during recovery itself, not by a countdown tick after reopening.
    const assessment = {
      started: null, checks: [], submissions: [], submitted: false,
      serverTimeOffset: 0,
    };
    const unexpected = await installAuthenticatedFixture(page, { assessment });
    await page.goto("/assessment");
    await page.getByRole("button", { name: "Mulai Assessment" }).click();
    await expect(page.getByRole("heading", { name: assessmentQuestions[0].question_text })).toBeVisible();
    await page.getByRole("button", { name: /Dokumen legalitas/ }).click();
    await page.getByRole("button", { name: "Selanjutnya" }).click();
    await page.getByRole("button", { name: /Periksa kesiapan/ }).click();
    await page.getByRole("button", { name: "Review Jawaban" }).click();
    await expect(page.getByRole("heading", { name: "Review Jawaban" })).toBeVisible();
    const savedAnswers = { [assessmentQuestions[0].id]: 0, [assessmentQuestions[1].id]: 1 };
    await expect.poll(() => assessment.draft?.phase).toBe("review");
    await expect.poll(() => assessment.draft?.answers).toEqual(savedAnswers);
    expect(assessment.submissions).toEqual([]);
    const deadline = assessment.deadlineAt;

    // Leave before moving server time, so the old page cannot submit.
    await page.goto("/dashboard");
    await expect(page.getByRole("button", { name: "Review Jawaban" })).toHaveCount(0);
    await page.evaluate((id) => localStorage.removeItem(`pub_assessment_draft_v1:${id}`), MEMBER_ID);
    assessment.serverTimeOffset = Date.parse(deadline) - Date.now() + 5_000;
    expect(Date.now() + assessment.serverTimeOffset).toBeGreaterThan(Date.parse(deadline));
    // Stale time fields in the saved draft must not override the RPC envelope.
    assessment.draft = { ...assessment.draft, timeLeft: 180, deadlineAt: Date.parse(deadline) + 180_000 };

    const attempts = [];
    let releaseSubmission;
    const submissionGate = new Promise((resolve) => { releaseSubmission = resolve; });
    await page.route(`https://${SUPABASE_HOST}/rest/v1/rpc/submit_assessment`, async (route) => {
      attempts.push(route.request().postDataJSON());
      await submissionGate;
      await route.fallback();
    });
    const expectedSubmission = {
      _pre_test_id: ASSESSMENT_ID,
      _answers: assessmentQuestions.map((q, i) => ({ question_id: q.id, selected_answer: i })),
    };
    try {
      await page.goto("/assessment");
      await expect(page.getByRole("heading", { name: "Review Jawaban" })).toBeVisible();
      await expect(page.getByText(/^Sisa waktu:/)).toHaveText("Sisa waktu: 0:00");
      await expect(page.getByRole("status").filter({ hasText: "Waktu habis." }))
        .toContainText("Hanya jawaban yang tersimpan di server sebelum batas waktu yang dinilai");
      await expect(page.getByText("Waktu hampir habis. Segera kirim jawaban Anda.")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Kembali ke Soal" })).toBeDisabled();
      await expect.poll(() => attempts).toEqual([expectedSubmission]);
      expect(assessment.starts).toBe(1);
      expect(assessment.recoveryChecks).toBe(1);
      expect(assessment.deadlineAt).toBe(deadline);
      expect(assessment.draft.answers).toEqual(savedAnswers);
    } finally {
      releaseSubmission();
    }
    await expect(page.getByRole("heading", { name: "Assessment Selesai!" })).toBeVisible();
    expect(attempts).toEqual([expectedSubmission]);
    expect(assessment.submissions).toEqual([expectedSubmission]);
    expect(assessment.successfulSubmissions).toBe(1);
    expect(assessment.starts).toBe(1);
    expect(assessment.recoveryChecks).toBe(1);
    expect(unexpected).toEqual([]);
  });

  test("batas waktu tetap berjalan saat review dan hanya mengirim sekali", async ({ page }) => {
    test.setTimeout(90_000);
    await page.emulateMedia({ reducedMotion: "reduce" });
    // Start above the real 60-second warning threshold and cross it naturally.
    const assessment = {
      started: null, checks: [], submissions: [], submitted: false,
      durationMs: 70_000, liveCountdown: true,
    };
    const unexpected = await installAuthenticatedFixture(page, { assessment });
    await page.goto("/assessment");
    await page.getByRole("button", { name: "Mulai Assessment" }).click();
    await expect(page.getByRole("heading", { name: assessmentQuestions[0].question_text })).toBeVisible();
    await page.getByRole("button", { name: /Dokumen legalitas/ }).click();
    await page.getByRole("button", { name: "Selanjutnya" }).click();
    await page.getByRole("button", { name: /Periksa kesiapan/ }).click();
    await page.getByRole("button", { name: "Review Jawaban" }).click();
    await expect(page.getByRole("heading", { name: "Review Jawaban" })).toBeVisible();
    const countdown = page.getByText(/^Sisa waktu: \d:\d\d$/);
    await expect(countdown).toBeVisible();
    await expect(page.getByText("Waktu hampir habis. Segera kirim jawaban Anda.")).toHaveCount(0);
    const initialCountdown = await countdown.innerText();
    await expect(countdown).not.toHaveText(initialCountdown);
    await expect(countdown).toHaveText(/Sisa waktu: (1:00|0:\d\d)/, { timeout: 15_000 });
    await expect(countdown.locator("..")).toHaveClass(/text-destructive/);
    await expect(page.getByRole("status").filter({ hasText: "Waktu hampir habis" })).toBeVisible();

    await expect(page.getByRole("heading", { name: "Assessment Selesai!" })).toBeVisible({ timeout: 65_000 });
    await expect(countdown).toHaveCount(0);
    expect(assessment.submissions).toEqual([{
      _pre_test_id: ASSESSMENT_ID,
      _answers: assessmentQuestions.map((q, i) => ({ question_id: q.id, selected_answer: i })),
    }]);
    expect(assessment.successfulSubmissions).toBe(1);
    expect(unexpected).toEqual([]);
  });

  test("tab yang ditinggalkan tidak mendapat tambahan waktu dari interval tertunda", async ({ page }) => {
    const assessment = {
      started: null, checks: [], submissions: [], submitted: false, durationMs: 12_000,
    };
    const unexpected = await installAuthenticatedFixture(page, { assessment });
    // The shared fixture suspends one-second intervals. Let real monotonic time
    // elapse: returning to the tab must reconcile without any countdown ticks.
    await page.goto("/assessment");
    await page.getByRole("button", { name: "Mulai Assessment" }).click();
    await expect(page.getByRole("heading", { name: assessmentQuestions[0].question_text })).toBeVisible();
    const countdown = page.getByText(/^Sisa waktu:/);
    const deadline = assessment.deadlineAt;
    const initialCountdown = await countdown.innerText();
    await expect.poll(() => Date.now(), { timeout: 5_000 })
      .toBeGreaterThanOrEqual(Date.parse(deadline) - 9_000);
    await expect(countdown).toHaveText(initialCountdown);
    expect(assessment.submissions).toEqual([]);
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await expect(countdown).toHaveText(/Sisa waktu: 0:0[1-9]$/);
    const reconciledCountdown = await countdown.innerText();
    expect(Date.now()).toBeLessThan(Date.parse(deadline));
    expect(assessment.submissions).toEqual([]);

    await expect.poll(() => Date.now(), { timeout: 12_000 })
      .toBeGreaterThanOrEqual(Date.parse(deadline) + 100);
    // No periodic update or early submission occurred while the tab was away.
    await expect(countdown).toHaveText(reconciledCountdown);
    expect(assessment.submissions).toEqual([]);
    await page.evaluate(() => {
      document.dispatchEvent(new Event("visibilitychange"));
      window.dispatchEvent(new Event("focus"));
    });
    await expect(page.getByRole("heading", { name: "Assessment Selesai!" })).toBeVisible();
    expect(assessment.deadlineAt).toBe(deadline);
    expect(assessment.starts).toBe(1);
    expect(assessment.successfulSubmissions).toBe(1);
    expect(assessment.submissions).toEqual([{
      _pre_test_id: ASSESSMENT_ID,
      _answers: assessmentQuestions.map((q) => ({ question_id: q.id, selected_answer: -1 })),
    }]);
    expect(unexpected).toEqual([]);
  });

  test("peta kompetensi memuat hasil kesiapan anggota", async ({ page }) => {
    const unexpected = await installAuthenticatedFixture(page);
    await page.goto("/siap-kompetensi");
    await expect(page).toHaveURL(/\/siap-kompetensi$/);
    await expect(page.getByRole("heading", { name: "Peta kesiapan usaha" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Legalitas" })).toBeVisible();
    expect(unexpected).toEqual([]);
  });

  test("LMS menampilkan katalog pembelajaran untuk anggota", async ({ page }) => {
    const unexpected = await installAuthenticatedFixture(page);
    await page.goto("/aspekindo-lms");
    await expect(page).toHaveURL(/\/aspekindo-lms$/);
    await expect(page.getByRole("heading", { name: "Katalog pembelajaran ASPEKINDO" })).toBeVisible();
    await expect(page.getByRole("heading", { name: course.title })).toBeVisible();
    expect(unexpected).toEqual([]);
  });

  test("anggota membuka materi pelajaran setelah memilih dan mendaftar kursus dari katalog", async ({ page }) => {
    const lms = { enrolled: false, startedLesson: null };
    const unexpected = await installAuthenticatedFixture(page, { lms });
    await page.goto("/aspekindo-lms");
    await expect(page.getByRole("heading", { name: course.title })).toBeVisible();
    await page.getByRole("link", { name: "Daftar" }).click();

    await expect(page).toHaveURL(new RegExp(`/aspekindo-lms/kursus/${COURSE_ID}$`));
    await expect(page.getByRole("heading", { name: course.title, level: 1 })).toBeVisible();
    await expect(page.getByText("Daftar kursus untuk membuka materi dan kuis.")).toBeVisible();
    await page.getByRole("button", { name: "Daftar kursus" }).click();

    await expect(page.getByRole("heading", { name: lesson.title })).toBeVisible();
    await expect(page.getByText("dokumen legalitas BUJK", { exact: false })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Materi pendukung" })).toBeVisible();
    await expect(page.getByText(material.title)).toBeVisible();
    await expect(page.getByText(material.content_markdown)).toBeVisible();
    await expect.poll(() => lms.startedLesson?.lesson_id).toBe(LESSON_ID);
    expect(unexpected).toEqual([]);
  });

  test("anggota terdaftar menerima URL bertanda tangan untuk video privat tanpa mengambil berkas nyata", async ({ page }) => {
    const lms = { enrolled: true, video: true, signRequests: [], videoRequests: [] };
    const unexpected = await installAuthenticatedFixture(page, { lms });
    try {
      await page.goto(`/aspekindo-lms/kursus/${COURSE_ID}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: lesson.title })).toBeVisible();
      await expect(page.getByText(videoMaterial.title)).toBeVisible();
      await expect(page.locator("video source")).toHaveCount(0);
      expect(lms.signRequests).toEqual([]);
      await page.getByRole("button", { name: "Putar video" }).click();
      const video = page.locator("video").filter({ has: page.locator("source[type='video/mp4']") });
      await expect(video).toBeVisible();
      await expect(video.locator("source")).toHaveAttribute("src", VIDEO_SIGNED_URL);
      await expect.poll(() => lms.videoRequests).toContain(VIDEO_SIGNED_URL);
      expect(lms.signRequests).toEqual([{ path: VIDEO_SIGN_PATH, body: { expiresIn: 1800 } }]);
      expect(unexpected).toEqual([]);
    } finally {
      lms.releaseVideoResponse?.();
    }
  });

  for (const expired of [false, true]) {
    test(`anggota dapat memutar ulang video selesai dengan tautan ${expired ? "kedaluwarsa" : "segar"}`, async ({ page }) => {
      const lms = { enrolled: true, video: true, rotateVideoTokens: true, signRequests: [], videoRequests: [] };
      const unexpected = await installAuthenticatedFixture(page, { lms });
      await installControlledVideo(page);
      const now = Date.now();
      await page.clock.setFixedTime(now);
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      try {
        await page.goto(`/aspekindo-lms/kursus/${COURSE_ID}`, { waitUntil: "domcontentloaded" });
        await page.getByRole("button", { name: "Putar video", exact: true }).click();
        const video = page.locator("video");
        await expect(video).toBeVisible();
        await expect.poll(() => lms.videoRequests.length).toBe(1);
        await signalVideo(video, "loadedmetadata");
        await expect(video).toHaveJSProperty("paused", false);

        await signalVideo(video, "timeupdate", { currentTime: 120 });
        await signalVideo(video, "ended", { currentTime: 120, paused: true, ended: true });
        const replay = page.getByRole("button", { name: "Putar ulang video", exact: true });
        await expect(replay).toBeVisible();
        await expect(replay).toBeEnabled();
        await expect(video).toHaveJSProperty("controls", false);
        expect(await page.evaluate(() => window.controlledVideo.playSources.length)).toBe(1);
        expect(lms.signRequests).toHaveLength(1);

        if (expired) await page.clock.setFixedTime(now + 26 * 60 * 1000);
        await replay.click();
        if (expired) {
          await expect.poll(() => lms.signRequests.length).toBe(2);
          await expect.poll(() => lms.videoRequests.length).toBe(2);
          await signalVideo(video, "loadedmetadata");
        }
        await expect.poll(() => page.evaluate(() => window.controlledVideo.playSources.length)).toBe(2);
        await expect(video).toHaveJSProperty("currentTime", 0);
        await expect(video).toHaveJSProperty("paused", false);
        await expect(video).toHaveJSProperty("controls", true);
        await expect(replay).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Lanjutkan video", exact: true })).toHaveCount(0);
        expect(lms.signRequests).toHaveLength(expired ? 2 : 1);
        expect(pageErrors).toEqual([]);
        expect(unexpected).toEqual([]);
      } finally {
        lms.releaseVideoResponses?.forEach((release) => release());
      }
    });
  }

  test("anggota dapat melanjutkan video secara manual saat autoplay setelah metadata ditolak", async ({ page }) => {
    const lms = { enrolled: true, video: true, signRequests: [], videoRequests: [] };
    const unexpected = await installAuthenticatedFixture(page, { lms });
    await installControlledVideo(page);
    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    try {
      await page.goto(`/aspekindo-lms/kursus/${COURSE_ID}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText(videoMaterial.title)).toBeVisible();
      await page.getByRole("button", { name: "Putar video" }).click();
      const video = page.locator("video").filter({ has: page.locator("source[type='video/mp4']") });
      await expect(video).toBeVisible();
      await expect.poll(() => lms.videoRequests.length).toBe(1);

      // Start playing first so the rejection must restore a previously hidden
      // resume button. Metadata events are simulated; media bytes stay pending.
      await signalVideo(video, "loadedmetadata");
      const resume = page.getByRole("button", { name: "Lanjutkan video", exact: true });
      await expect(resume).toHaveCount(0);
      await expect.poll(() => page.evaluate(() => window.controlledVideo.playSources.length)).toBe(1);

      await page.evaluate(() => { window.controlledVideo.rejectNextPlay = true; });
      await signalVideo(video, "loadedmetadata");
      await expect(resume).toBeVisible();
      await expect(resume).toBeEnabled();
      await expect.poll(() => video.evaluate((element) => element.paused)).toBe(true);
      expect(await page.evaluate(() => window.controlledVideo.playSources.length)).toBe(2);
      await expect(page.getByRole("button", { name: "Muat ulang video" })).toHaveCount(0);

      // A real user click, not a synthetic DOM click, retries play().
      await resume.click();
      await expect.poll(() => page.evaluate(() => window.controlledVideo.playSources.length)).toBe(3);
      await expect.poll(() => video.evaluate((element) => element.paused)).toBe(false);
      await expect(video).toHaveJSProperty("controls", true);
      await expect(resume).toHaveCount(0);
      expect(lms.signRequests).toHaveLength(1);
      expect(pageErrors).toEqual([]);
      expect(unexpected).toEqual([]);
    } finally {
      lms.releaseVideoResponses?.forEach((release) => release());
    }
  });

  test("anggota dapat memuat ulang video setelah pembuatan tautan privat gagal", async ({ page }) => {
    const lms = { enrolled: true, video: true, failFirstSign: true, signRequests: [], videoRequests: [] };
    const unexpected = await installAuthenticatedFixture(page, { lms });
    try {
      await page.goto(`/aspekindo-lms/kursus/${COURSE_ID}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByText(videoMaterial.title)).toBeVisible();
      await page.getByRole("button", { name: "Putar video" }).click();
      await expect(page.getByText("Video belum dapat diputar")).toBeVisible();
      const reload = page.getByRole("button", { name: "Muat ulang video" });
      await expect(reload).toBeVisible();
      await expect(page.locator("video source")).toHaveCount(0);
      expect(lms.signRequests).toEqual([{ path: VIDEO_SIGN_PATH, body: { expiresIn: 1800 } }]);
      expect(lms.videoRequests).toEqual([]);

      await reload.click();
      const video = page.locator("video").filter({ has: page.locator("source[type='video/mp4']") });
      await expect(video).toBeVisible();
      await expect(video.locator("source")).toHaveAttribute("src", VIDEO_SIGNED_URL);
      await expect.poll(() => lms.videoRequests).toContain(VIDEO_SIGNED_URL);
      expect(lms.signRequests).toEqual([
        { path: VIDEO_SIGN_PATH, body: { expiresIn: 1800 } },
        { path: VIDEO_SIGN_PATH, body: { expiresIn: 1800 } },
      ]);
      expect(unexpected).toEqual([]);
    } finally {
      lms.releaseVideoResponse?.();
    }
  });

  test("player mempertahankan posisi saat pause, resume, gagal menyegarkan storage, lalu mengganti sumber", async ({ page }) => {
    test.setTimeout(60_000);
    const lms = { enrolled: true, video: true, rotateVideoTokens: true, signRequests: [], videoRequests: [] };
    const unexpected = await installAuthenticatedFixture(page, { lms });
    await page.addInitScript(() => {
      const positions = new WeakMap();
      const paused = new WeakMap();
      let offset = 0;
      const realNow = Date.now.bind(Date);
      Date.now = () => realNow() + offset;
      window.advanceVideoClock = (milliseconds) => { offset += milliseconds; };
      Object.defineProperty(HTMLMediaElement.prototype, "currentTime", {
        configurable: true,
        get() { return positions.get(this) ?? 0; },
        set(value) { positions.set(this, value); },
      });
      Object.defineProperty(HTMLMediaElement.prototype, "paused", {
        configurable: true,
        get() { return paused.get(this) ?? true; },
      });
      HTMLMediaElement.prototype.play = function () {
        paused.set(this, false);
        this.dispatchEvent(new Event("playing"));
        return Promise.resolve();
      };
      HTMLMediaElement.prototype.pause = function () {
        paused.set(this, true);
        this.dispatchEvent(new Event("pause"));
      };
    });
    const video = page.locator("video").filter({ has: page.locator("source[type='video/mp4']") });
    const url = (n) => `https://${SUPABASE_HOST}${VIDEO_SIGN_PATH}?token=video-test-${n}`;
    try {
      await page.goto(`/aspekindo-lms/kursus/${COURSE_ID}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: lesson.title })).toBeVisible({ timeout: 20_000 });
      await expect(page.getByText(videoMaterial.title)).toBeVisible();
      await page.getByRole("button", { name: "Putar video" }).click();
      await expect(video.locator("source")).toHaveAttribute("src", url(1));
      await video.evaluate((element) => element.dispatchEvent(new Event("loadedmetadata")));
      await expect(page.getByRole("button", { name: "Lanjutkan video" })).toHaveCount(0);

      await video.evaluate((element) => {
        element.currentTime = 83.5;
        element.dispatchEvent(new Event("timeupdate"));
        element.pause();
      });
      await expect(page.getByRole("button", { name: "Lanjutkan video" })).toBeVisible();
      await page.getByRole("button", { name: "Lanjutkan video" }).click();
      await expect(page.getByRole("button", { name: "Lanjutkan video" })).toHaveCount(0);
      expect(lms.signRequests).toHaveLength(1);
      await expect(video.locator("source")).toHaveAttribute("src", url(1));
      expect(await video.evaluate((element) => element.currentTime)).toBe(83.5);

      await video.evaluate((element) => element.pause());
      await expect(page.getByRole("button", { name: "Lanjutkan video" })).toBeVisible();
      await page.evaluate(() => window.advanceVideoClock(25 * 60 * 1000 + 1000));
      await page.getByRole("button", { name: "Lanjutkan video" }).click();
      await expect(video.locator("source")).toHaveAttribute("src", url(2));
      await video.evaluate((element) => element.dispatchEvent(new Event("loadedmetadata")));
      expect(await video.evaluate((element) => element.currentTime)).toBe(83.5);
      await expect(page.getByRole("button", { name: "Lanjutkan video" })).toHaveCount(0);
      expect(lms.signRequests).toHaveLength(2);

      await video.evaluate((element) => element.pause());
      await expect(page.getByRole("button", { name: "Lanjutkan video" })).toBeVisible();
      await page.evaluate(() => window.advanceVideoClock(25 * 60 * 1000 + 1000));
      lms.failSignAt = 3;
      await page.getByRole("button", { name: "Lanjutkan video" }).click();
      await expect(page.getByText("Video belum dapat diputar")).toBeVisible();
      await expect(page.locator("video source")).toHaveCount(0);
      expect(lms.signRequests).toHaveLength(3);

      lms.failSignAt = null;
      // A pending media request can keep Playwright's click navigation wait open;
      // trigger the same DOM click without waiting for unrelated media network idle.
      await page.getByRole("button", { name: "Muat ulang video" }).evaluate((button) => button.click());
      await expect(video.locator("source")).toHaveAttribute("src", url(4));
      await video.evaluate((element) => element.dispatchEvent(new Event("loadedmetadata")));
      await expect(page.getByRole("button", { name: "Lanjutkan video" })).toHaveCount(0);
      expect(await video.evaluate((element) => element.currentTime)).toBe(83.5);
      expect(lms.signRequests).toHaveLength(4);
      expect(unexpected).toEqual([]);
    } finally {
      lms.releaseVideoResponses?.forEach((release) => release());
    }
  });

  test.describe("pemulihan otomatis video privat", () => {
    const freshMs = 25 * 60 * 1000;
    const signedUrl = (n) => `https://${SUPABASE_HOST}${VIDEO_SIGN_PATH}?token=video-test-${n}`;
    let lms;
    let unexpected;
    let video;
    let originalVideo;
    let issuedAt;

    test.beforeEach(async ({ page }) => {
      lms = { enrolled: true, video: true, secondVideo: true, rotateVideoTokens: true, signRequests: [], videoRequests: [] };
      unexpected = await installAuthenticatedFixture(page, { lms });
      await installControlledVideo(page);
      await page.goto(`/aspekindo-lms/kursus/${COURSE_ID}`, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: lesson.title })).toBeVisible();
      await expect(page.getByText(videoMaterial.title)).toBeVisible();
      await freezeVideoClock(page);
      // The paused browser clock, not the Node runner's wall clock, timestamps
      // React Query's signed URL result. No virtual time elapses during fetch.
      issuedAt = await page.evaluate(() => Date.now());
      await page.getByRole("button", { name: "Putar video" }).click();
      video = page.locator("video").filter({ has: page.locator("source[type='video/mp4']") });
      await expect(video.locator("source")).toHaveAttribute("src", signedUrl(1));
      await expect.poll(() => lms.videoRequests).toContain(signedUrl(1));
      await signalVideo(video, "loadedmetadata");
      await expect(page.getByRole("button", { name: "Lanjutkan video" })).toHaveCount(0);
      originalVideo = await video.elementHandle();
    });

    test.afterEach(async () => {
      lms.releaseSignResponse?.();
      lms.releaseVideoResponses?.forEach((release) => release());
      await originalVideo?.dispose();
      expect(unexpected).toEqual([]);
    });

    async function expectOriginalStream(page) {
      expect(lms.signRequests).toHaveLength(1);
      await expect(video.locator("source")).toHaveAttribute("src", signedUrl(1));
      expect(await originalVideo.evaluate((element) => element.isConnected)).toBe(true);
      expect(await page.evaluate(() => window.controlledVideo.playSources)).toEqual([signedUrl(1)]);
    }

    async function unlockSecondLesson(page) {
      await page.getByRole("button", { name: "Tandai pelajaran selesai" }).click();
      await expect.poll(() => lms.progress.find((item) => item.lesson_id === LESSON_ID)?.status).toBe("completed");
      // React Query batches the progress refresh on a timer. Let that finish
      // while the clock is paused, before starting the stall under test.
      await expect.poll(async () => {
        await page.clock.runFor(100);
        return page.getByRole("button", { name: new RegExp(secondLesson.title) }).getAttribute("class");
      })
        .not.toMatch(/cursor-not-allowed/);
    }

    async function switchToSecondVideo(page, signNumber) {
      await page.getByRole("button", { name: new RegExp(secondLesson.title) }).click();
      await expect(page.getByRole("heading", { name: secondLesson.title })).toBeVisible();
      await expect(page.getByText(secondVideoMaterial.title, { exact: true })).toBeVisible();
      await expect(page.getByText(videoMaterial.title, { exact: true })).toHaveCount(0);
      expect(await originalVideo.evaluate((element) => element.isConnected)).toBe(false);
      await page.getByRole("button", { name: "Putar video" }).click();
      const secondUrl = `https://${SUPABASE_HOST}${SECOND_VIDEO_SIGN_PATH}?token=video-test-${signNumber}`;
      await expect(video.locator("source")).toHaveAttribute("src", secondUrl);
      await expect.poll(() => lms.videoRequests).toContain(secondUrl);
      await signalVideo(video, "loadedmetadata");
      await resumeControlledVideo(video, 7);
      return secondUrl;
    }

    async function expectSecondStreamUnaffected(page, secondUrl, paths) {
      await expect(page.getByRole("heading", { name: secondLesson.title })).toBeVisible();
      await expect(page.getByText("pemeriksaan kelengkapan dokumen", { exact: false })).toBeVisible();
      await expect(page.getByText(secondVideoMaterial.title, { exact: true })).toBeVisible();
      await expect(video).toHaveCount(1);
      await expect(video.locator("source")).toHaveAttribute("src", secondUrl);
      expect(await video.evaluate((element) => ({ time: element.currentTime, paused: element.paused })))
        .toEqual({ time: 7, paused: false });
      expect(await originalVideo.evaluate((element) => element.isConnected)).toBe(false);
      expect(lms.signRequests.map(({ path }) => path)).toEqual(paths);
      expect(lms.videoRequests).toEqual([signedUrl(1), secondUrl]);
      expect(await page.evaluate(() => window.controlledVideo.playSources)).toEqual([signedUrl(1), secondUrl]);
      await expect(page.getByText("Video belum dapat diputar")).toHaveCount(0);
      await expect(page.getByText("Mencoba memulihkan video… Maksimal 3 percobaan.")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Muat ulang video" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Lanjutkan video" })).toHaveCount(0);
    }

    for (const event of ["waiting", "stalled"]) {
      test(`pindah pelajaran sebelum empat detik membatalkan timer ${event} video lama`, async ({ page }) => {
        await unlockSecondLesson(page);
        await page.clock.fastForward(freshMs + 1000);
        await signalVideo(video, event, { currentTime: 42, readyState: 2 });
        await expect(page.getByText("Mencoba memulihkan video… Maksimal 3 percobaan.")).toBeVisible();
        await page.clock.runFor(2000);
        expect(lms.signRequests).toHaveLength(1);

        const secondUrl = await switchToSecondVideo(page, 2);
        // Cross the old four-second deadline and subsequent retry backoffs.
        await page.clock.runFor(30_000);
        await expectSecondStreamUnaffected(page, secondUrl, [VIDEO_SIGN_PATH, SECOND_VIDEO_SIGN_PATH]);
      });
    }

    for (const failResponse of [false, true]) {
      test(`pindah pelajaran mengabaikan respons tautan video lama yang terlambat ${failResponse ? "gagal" : "berhasil"}`, async ({ page }) => {
        await unlockSecondLesson(page);
        lms.holdSignAt = 2;
        if (failResponse) lms.failSignAt = 2;
        await page.clock.fastForward(freshMs + 1000);
        await signalVideo(video, "waiting", { currentTime: 42, readyState: 2 });
        await page.clock.runFor(4000);
        await expect.poll(() => lms.signRequests.length).toBe(2);
        await expect.poll(() => typeof lms.releaseSignResponse).toBe("function");

        const secondUrl = await switchToSecondVideo(page, 3);
        const secondElement = await video.elementHandle();
        try {
          const response = page.waitForResponse((response) =>
            new URL(response.url()).pathname === VIDEO_SIGN_PATH && response.request().method() === "POST");
          lms.releaseSignResponse();
          const signResponse = await response;
          expect(signResponse.status()).toBe(failResponse ? 500 : 200);
          await signResponse.finished();
          await page.clock.runFor(30_000);

          await expectSecondStreamUnaffected(page, secondUrl,
            [VIDEO_SIGN_PATH, VIDEO_SIGN_PATH, SECOND_VIDEO_SIGN_PATH]);
          expect(await secondElement.evaluate((element) => element.isConnected)).toBe(true);
        } finally {
          await secondElement.dispose();
        }
      });
    }

    for (const event of ["waiting", "stalled"]) {
      test(`${event} yang bertahan setelah tautan menua meminta sumber baru dan memutar otomatis`, async ({ page }) => {
        await page.clock.fastForward(freshMs + 1000);
        await expectOriginalStream(page); // Age alone must not replace a playing source.
        await signalVideo(video, event, { currentTime: 42, readyState: 2 });
        // A second signal must not create a parallel refresh or shorten the grace period.
        await page.clock.runFor(2000);
        await signalVideo(video, event === "waiting" ? "stalled" : "waiting");
        await page.clock.runFor(1999);
        await expectOriginalStream(page);
        await page.clock.runFor(1);

        await expect(video.locator("source")).toHaveAttribute("src", signedUrl(2));
        expect(lms.signRequests).toHaveLength(2);
        expect(lms.signRequests[1]).toEqual({
          path: VIDEO_SIGN_PATH,
          body: { expiresIn: 1800 },
        });
        await expect.poll(() => lms.videoRequests).toContain(signedUrl(2));
        expect(await originalVideo.evaluate((element) => element.isConnected)).toBe(false);
        await signalVideo(video, "loadedmetadata");
        await expect.poll(() => page.evaluate(() => window.controlledVideo.playSources))
          .toEqual([signedUrl(1), signedUrl(2)]);
        expect(await video.evaluate((element) => element.paused)).toBe(false);
        await expect(page.getByRole("button", { name: "Lanjutkan video" })).toHaveCount(0);
        await expect(page.getByText("Video belum dapat diputar")).toHaveCount(0);
        await page.clock.runFor(8000);
        expect(lms.signRequests).toHaveLength(2);
      });
    }

    test("macet yang mulai sebelum batas kesegaran baru menyegarkan tautan saat batas terlewati", async ({ page }) => {
      await page.clock.fastForward(freshMs - 10_000);
      await signalVideo(video, "waiting", { readyState: 2 });
      await page.clock.runFor(4000);
      await expectOriginalStream(page);
      await page.clock.runFor(5999);
      expect(await page.evaluate(() => Date.now())).toBe(issuedAt + freshMs - 1);
      await expectOriginalStream(page);
      await page.clock.runFor(1);
      expect(await page.evaluate(() => Date.now())).toBe(issuedAt + freshMs);
      await expect(video.locator("source")).toHaveAttribute("src", signedUrl(2));
      expect(lms.signRequests).toHaveLength(2);
    });

    test("sumber kedaluwarsa yang masih maju atau punya buffer tidak diganti", async ({ page }) => {
      await page.clock.fastForward(freshMs + 1000);
      await signalVideo(video, "timeupdate", { currentTime: 10, readyState: 4 });
      await page.clock.runFor(8000);
      await expectOriginalStream(page);

      // Even without a playing event, advancing playback cancels recovery.
      await signalVideo(video, "waiting", { readyState: 2 });
      await signalVideo(video, "timeupdate", { currentTime: 11 });
      await page.clock.runFor(4000);
      await expectOriginalStream(page);

      // A full buffer is also sufficient, even if currentTime has not advanced.
      await signalVideo(video, "stalled", { readyState: 4 });
      await page.clock.runFor(4000);
      await expectOriginalStream(page);

      // The normal playing event must cancel the timer too.
      await signalVideo(video, "waiting", { readyState: 2 });
      await page.clock.runFor(2000);
      await signalVideo(video, "playing");
      await page.clock.runFor(4000);
      await expectOriginalStream(page);
    });

    for (const failResponse of [false, true]) {
      test(`video yang pulih saat tautan baru diminta mempertahankan sumber lama saat respons ${failResponse ? "gagal" : "berhasil"}`, async ({ page }) => {
        lms.holdSignAt = 2;
        if (failResponse) lms.failSignAt = 2;
        await page.clock.fastForward(freshMs + 1000);
        await signalVideo(video, "waiting", { currentTime: 20, readyState: 2 });
        await page.clock.runFor(4000);
        await expect.poll(() => lms.signRequests.length).toBe(2);
        await expect.poll(() => typeof lms.releaseSignResponse).toBe("function");
        await expect(video.locator("source")).toHaveAttribute("src", signedUrl(1));
        await resumeControlledVideo(video, 21);
        await expect(page.getByText("Mencoba memulihkan video… Maksimal 3 percobaan.")).toHaveCount(0);
        const response = page.waitForResponse((response) =>
          response.url().includes(VIDEO_SIGN_PATH) && response.request().method() === "POST");
        lms.releaseSignResponse();
        const signResponse = await response;
        expect(signResponse.status()).toBe(failResponse ? 500 : 200);
        await signResponse.finished();
        await page.clock.runFor(100);
        // Keep advancing the same media after preparePlayback has settled. A
        // late failure must not detach it, pause it, or display a retry overlay.
        await signalVideo(video, "timeupdate", { currentTime: 22 });
        await page.clock.runFor(8000);
        await expect(video.locator("source")).toHaveAttribute("src", signedUrl(1));
        expect(await originalVideo.evaluate((element) => element.isConnected)).toBe(true);
        expect(await video.evaluate((element) => element.paused)).toBe(false);
        expect(await video.evaluate((element) => element.currentTime)).toBe(22);
        await expect(page.getByText("Video belum dapat diputar")).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Muat ulang video" })).toHaveCount(0);
        await expect(page.getByRole("button", { name: "Lanjutkan video" })).toHaveCount(0);
        await expect(page.getByText("Mencoba memulihkan video… Maksimal 3 percobaan.")).toHaveCount(0);
        expect(lms.videoRequests).toEqual([signedUrl(1)]);
        expect(await page.evaluate(() => window.controlledVideo.playSources)).toEqual([signedUrl(1)]);
        expect(lms.signRequests).toHaveLength(2);
      });
    }
  });

  test("pelajaran kedua terbuka dan dapat dibuka setelah pelajaran pertama selesai", async ({ page }) => {
    const lms = { enrolled: true, startedLesson: null };
    const unexpected = await installAuthenticatedFixture(page, { lms });
    await page.goto(`/aspekindo-lms/kursus/${COURSE_ID}`);

    const secondButton = page.getByRole("button", { name: new RegExp(secondLesson.title) });
    await expect(page.getByRole("heading", { name: lesson.title })).toBeVisible();
    await expect(secondButton).toHaveClass(/cursor-not-allowed/);
    await secondButton.click();
    await expect(page.getByRole("heading", { name: secondLesson.title })).toHaveCount(0);
    await expect.poll(() => lms.progress.find((item) => item.lesson_id === LESSON_ID)?.status).toBe("in_progress");

    await page.getByRole("button", { name: "Tandai pelajaran selesai" }).click();
    await expect.poll(() => lms.progress.find((item) => item.lesson_id === LESSON_ID)?.status).toBe("completed");
    await expect(secondButton).not.toHaveClass(/cursor-not-allowed/);
    await expect(page.getByText("Pelajaran ini sudah selesai")).toBeVisible();

    const progressAfterReload = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.hostname === SUPABASE_HOST &&
        url.pathname === "/rest/v1/aspekindo_lms_lesson_progress" &&
        response.request().method() === "GET";
    });
    await page.reload();
    const reloadedProgress = await (await progressAfterReload).json();
    expect(reloadedProgress).toEqual(expect.arrayContaining([
      expect.objectContaining({ lesson_id: LESSON_ID, status: "completed" }),
    ]));
    await expect(page.getByRole("heading", { name: course.title, level: 1 })).toBeVisible();
    await expect(secondButton).not.toHaveClass(/cursor-not-allowed/);
    await page.getByRole("button", { name: new RegExp(lesson.title) }).click();
    await expect(page.getByRole("heading", { name: lesson.title })).toBeVisible();
    await expect(page.getByText("Pelajaran ini sudah selesai")).toBeVisible();
    await secondButton.click();

    await expect(page.getByRole("heading", { name: secondLesson.title })).toBeVisible();
    await expect(page.getByText("pemeriksaan kelengkapan dokumen", { exact: false })).toBeVisible();
    await expect.poll(() => lms.progress.find((item) => item.lesson_id === SECOND_LESSON_ID)?.status).toBe("in_progress");
    expect(unexpected).toEqual([]);
  });

  test("pelajaran kedua tetap terbuka pada perangkat baru dari progres anggota yang tersimpan", async ({ page, browser }) => {
    const lms = { enrolled: true, startedLesson: null };
    const firstUnexpected = await installAuthenticatedFixture(page, { lms });
    await page.goto(`/aspekindo-lms/kursus/${COURSE_ID}`);
    await expect(page.getByRole("heading", { name: lesson.title })).toBeVisible();
    await expect.poll(() => lms.progress.find((item) => item.lesson_id === LESSON_ID)?.status).toBe("in_progress");
    await page.getByRole("button", { name: "Tandai pelajaran selesai" }).click();
    await expect.poll(() => lms.progress.find((item) => item.lesson_id === LESSON_ID)?.status).toBe("completed");
    expect(firstUnexpected).toEqual([]);

    const otherContext = await browser.newContext();
    try {
      expect(await otherContext.storageState()).toEqual({ cookies: [], origins: [] });
      const otherPage = await otherContext.newPage();
      const secondUnexpected = await installAuthenticatedFixture(otherPage, { lms, preserveLmsState: true });
      const loadedProgress = otherPage.waitForResponse((response) => {
        const url = new URL(response.url());
        return url.hostname === SUPABASE_HOST &&
          url.pathname === "/rest/v1/aspekindo_lms_lesson_progress" &&
          response.request().method() === "GET";
      });
      await otherPage.goto(page.url());
      expect(await (await loadedProgress).json()).toEqual(expect.arrayContaining([
        expect.objectContaining({ lesson_id: LESSON_ID, status: "completed" }),
      ]));
      await expect(otherPage.getByRole("heading", { name: course.title, level: 1 })).toBeVisible();
      const secondButton = otherPage.getByRole("button", { name: new RegExp(secondLesson.title) });
      await expect(secondButton).not.toHaveClass(/cursor-not-allowed/);
      await secondButton.click();
      await expect(otherPage.getByRole("heading", { name: secondLesson.title })).toBeVisible();
      await expect(otherPage.getByText("pemeriksaan kelengkapan dokumen", { exact: false })).toBeVisible();
      await expect.poll(() => lms.progress.find((item) => item.lesson_id === SECOND_LESSON_ID)?.status).toBe("in_progress");
      expect(lms.progress.find((item) => item.lesson_id === LESSON_ID)?.status).toBe("completed");
      expect(secondUnexpected).toEqual([]);
    } finally {
      await otherContext.close();
    }
  });

  test("progres akun pertama tidak membuka pelajaran kedua bagi akun lain di konteks baru", async ({ page, browser }) => {
    const firstLms = { enrolled: true };
    const secondLms = { enrolled: true, enrollmentId: "00000000-0000-4000-8000-000000000061" };
    const lmsAccounts = new Map([[member.id, firstLms], [secondMember.id, secondLms]]);
    const firstUnexpected = await installAuthenticatedFixture(page, { lmsAccounts });
    await page.goto(`/aspekindo-lms/kursus/${COURSE_ID}`);
    await expect(page.getByRole("heading", { name: lesson.title })).toBeVisible();
    await expect.poll(() => firstLms.progress.find((item) => item.lesson_id === LESSON_ID)?.status).toBe("in_progress");
    await page.getByRole("button", { name: "Tandai pelajaran selesai" }).click();
    await expect(page.getByText("Pelajaran ini sudah selesai")).toBeVisible();
    await expect.poll(() => firstLms.progress.find((item) => item.lesson_id === LESSON_ID)?.status).toBe("completed");
    await expect(page.getByRole("button", { name: new RegExp(secondLesson.title) })).not.toHaveClass(/cursor-not-allowed/);
    const firstProgress = structuredClone(firstLms.progress);

    const otherContext = await browser.newContext();
    try {
      expect(await otherContext.storageState()).toEqual({ cookies: [], origins: [] });
      const otherPage = await otherContext.newPage();
      const secondUnexpected = await installAuthenticatedFixture(otherPage, { user: secondMember, lmsAccounts });
      const loadedProgress = otherPage.waitForResponse((response) => {
        const url = new URL(response.url());
        return url.hostname === SUPABASE_HOST &&
          url.pathname === "/rest/v1/aspekindo_lms_lesson_progress" &&
          response.request().method() === "GET";
      });
      await otherPage.goto(page.url());
      const response = await loadedProgress;
      expect(new URL(response.url()).searchParams.get("user_id")).toBe(`eq.${secondMember.id}`);
      expect(await response.json()).toEqual([]);
      await expect(otherPage.getByRole("heading", { name: lesson.title })).toBeVisible();
      await expect.poll(() => secondLms.progress.find((item) => item.lesson_id === LESSON_ID)?.status).toBe("in_progress");
      expect(secondLms.progress).toEqual([
        expect.objectContaining({
          user_id: secondMember.id, enrollment_id: secondLms.enrollmentId,
          lesson_id: LESSON_ID, status: "in_progress",
        }),
      ]);
      const secondButton = otherPage.getByRole("button", { name: new RegExp(secondLesson.title) });
      await expect(secondButton).toHaveClass(/cursor-not-allowed/);
      await secondButton.click();
      await expect(otherPage.getByRole("heading", { name: secondLesson.title })).toHaveCount(0);
      await expect(otherPage.getByRole("heading", { name: lesson.title })).toBeVisible();
      await expect(otherPage.getByText("Pelajaran ini sudah selesai")).toHaveCount(0);
      expect(secondLms.progress.some((item) => item.lesson_id === SECOND_LESSON_ID)).toBe(false);
      expect(secondLms.completionRequests).toEqual([]);
      expect(firstLms.progress).toEqual(firstProgress);
      expect(firstUnexpected).toEqual([]);
      expect(secondUnexpected).toEqual([]);
    } finally {
      await otherContext.close();
    }
  });

  test("kuis gagal menahan penyelesaian dan pelajaran berikutnya sampai percobaan lulus", async ({ page }) => {
    const lms = { enrolled: true, quiz: true };
    const unexpected = await installAuthenticatedFixture(page, { lms });
    await page.goto(`/aspekindo-lms/kursus/${COURSE_ID}`);

    const completeButton = page.getByRole("button", { name: "Tandai pelajaran selesai" });
    const secondButton = page.getByRole("button", { name: new RegExp(secondLesson.title) });
    await expect(page.getByRole("heading", { name: "Kuis pelajaran" })).toBeVisible();
    await expect(page.getByText("Nilai lulus minimal 75%", { exact: false })).toBeVisible();
    await expect(completeButton).toBeDisabled();
    await expect(secondButton).toHaveClass(/cursor-not-allowed/);
    await page.getByRole("button", { name: "Mulai kuis" }).click();
    await page.getByLabel("Dokumen legalitas").check();
    await page.getByLabel("Abaikan pemeriksaan").check();
    await page.getByRole("button", { name: "Kirim jawaban" }).click();

    await expect(page.getByText("Kuis belum lulus · Skor 50%")).toBeVisible();
    expect(lms.attempts.map(({ score, passed }) => ({ score, passed }))).toEqual([{ score: 50, passed: false }]);
    await expect(completeButton).toBeDisabled();
    await secondButton.click();
    await expect(page.getByRole("heading", { name: secondLesson.title })).toHaveCount(0);
    expect(lms.completionRequests).toEqual([]);

    await page.getByRole("button", { name: "Coba lagi" }).click();
    await page.getByLabel("Dokumen legalitas").check();
    await page.getByLabel("Periksa kelengkapan").check();
    await page.getByRole("button", { name: "Kirim jawaban" }).click();

    await expect(page.getByText("Kuis lulus · Skor 100%")).toBeVisible();
    expect(lms.attempts.map(({ score, passed }) => ({ score, passed }))).toEqual([
      { score: 50, passed: false }, { score: 100, passed: true },
    ]);
    await expect(completeButton).toBeEnabled();
    await expect(secondButton).toHaveClass(/cursor-not-allowed/);
    await completeButton.click();
    await expect(page.getByText("Pelajaran ini sudah selesai")).toBeVisible();
    await expect(secondButton).not.toHaveClass(/cursor-not-allowed/);
    expect(lms.completionRequests).toEqual([LESSON_ID]);
    await secondButton.click();
    await expect(page.getByRole("heading", { name: secondLesson.title })).toBeVisible();
    await expect.poll(() => lms.progress.find((item) => item.lesson_id === SECOND_LESSON_ID)?.status).toBe("in_progress");
    expect(unexpected).toEqual([]);
  });

  test("pelajaran wajib kuis tidak dapat diselesaikan selama soal masih dimuat", async ({ page }) => {
    let releaseQuestions;
    const lms = {
      enrolled: true, quiz: true,
      waitForQuestions: new Promise((resolve) => { releaseQuestions = resolve; }),
    };
    const unexpected = await installAuthenticatedFixture(page, { lms });
    try {
      await page.goto(`/aspekindo-lms/kursus/${COURSE_ID}`);
      await expect.poll(() => lms.questionRequests).toBeGreaterThan(0);
      await expect(page.getByText("Menyiapkan kuis...")).toBeVisible();
      await expect(page.getByRole("button", { name: "Tandai pelajaran selesai" })).toBeDisabled();
      expect(lms.completionRequests).toEqual([]);
      releaseQuestions();
      await expect(page.getByRole("heading", { name: "Kuis pelajaran" })).toBeVisible();
      await expect(page.getByRole("button", { name: "Tandai pelajaran selesai" })).toBeDisabled();
      expect(unexpected).toEqual([]);
    } finally {
      releaseQuestions();
    }
  });

  test("kegagalan memuat soal terlihat dan anggota dapat mencoba lagi", async ({ page }) => {
    const lms = { enrolled: true, quiz: true, failQuestions: true };
    const unexpected = await installAuthenticatedFixture(page, { lms });
    await page.goto(`/aspekindo-lms/kursus/${COURSE_ID}`);
    const completeButton = page.getByRole("button", { name: "Tandai pelajaran selesai" });
    await expect(page.getByRole("alert").filter({ hasText: "Soal kuis belum dapat dimuat." })).toBeVisible();
    await expect(completeButton).toBeDisabled();
    expect(lms.completionRequests).toEqual([]);

    lms.failQuestions = false;
    await page.getByRole("button", { name: "Coba muat ulang soal" }).click();
    await expect(page.getByRole("heading", { name: "Kuis pelajaran" })).toBeVisible();
    await expect(completeButton).toBeDisabled();
    expect(lms.questionRequests).toBe(2);
    expect(unexpected).toEqual([]);
  });

  test("soal kosong tidak membuka penyelesaian pelajaran wajib kuis", async ({ page }) => {
    const lms = { enrolled: true, quiz: true };
    const unexpected = await installAuthenticatedFixture(page, { lms });
    await page.route(`**/rest/v1/aspekindo_lms_quiz_questions?*`, async (route) => {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
    });
    await page.goto(`/aspekindo-lms/kursus/${COURSE_ID}`);
    await expect(page.getByRole("alert").filter({ hasText: "Soal kuis belum dapat dimuat." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Tandai pelajaran selesai" })).toBeDisabled();
    expect(lms.completionRequests).toEqual([]);
    expect(unexpected).toEqual([]);
  });
});

test.describe("halaman admin dengan sesi tiruan", () => {
  test("diagnostik AI menerjemahkan kode aman dan masa cache tanpa respons mentah", async ({ page }) => {
    const unexpected = await installAuthenticatedFixture(page, { asAdmin: true });
    let reason = "key_missing";
    const requests = [];
    await page.route(/\/api\/(?:helpdesk\/status|ruang-simpan\/ai-status)\?diagnostics=true$/, async route => {
      requests.push(route.request());
      await route.fulfill({ contentType: "application/json", body: JSON.stringify({
        state: "unknown", message: "PRIVATE_PROVIDER_BODY",
        checkedAt: "2026-11-02T01:00:00.000Z", recheckAt: "2026-11-02T01:00:30.000Z",
        diagnostics: { reason, key: "PRIVATE_KEY", label: "PRIVATE_LABEL", balance: 987.65 },
      }) });
    });
    await page.goto("/admin");
    await expect(page.getByText("Konfigurasi belum tersedia", { exact: true })).toHaveCount(2);
    for (const [code, title] of [
      ["metadata_rejected", "Pemeriksaan metadata ditolak"],
      ["provider_credit_limit", "Batas penggunaan penyedia terindikasi"],
      ["provider_rate_limit", "Terlalu banyak permintaan"],
      ["key_budget_exhausted", "Batas penggunaan konfigurasi tercapai"],
      ["metadata_unreachable", "Gangguan koneksi atau waktu tunggu"],
      ["metadata_invalid", "Metadata tidak dapat dibaca"],
      ["metadata_available", "Metadata berhasil diperiksa"],
      ["PRIVATE_UNKNOWN_CODE", "Status belum dikenali"],
    ]) {
      reason = code;
      await page.getByRole("button", { name: "Periksa kembali layanan AI", exact: true }).click();
      await expect(page.getByText(title, { exact: true })).toHaveCount(2);
      await expect(page.getByText("Cache server hingga:", { exact: true })).toHaveCount(2);
      await expect(page.getByText("Diperiksa:", { exact: true })).toHaveCount(2);
      await expect(page.locator("body")).not.toContainText("PRIVATE_");
      await expect(page.locator("body")).not.toContainText("987.65");
    }
    expect(requests.length).toBeGreaterThanOrEqual(18);
    for (const request of requests) {
      expect(request.headers().authorization).toBe(`Bearer ${fixtureSession(member).access_token}`);
    }
    expect(unexpected).toEqual([]);
  });

  test("diagnostik AI menutup kedua hasil saat izin dicabut dan mengabaikan respons lama", async ({ page }) => {
    const unexpected = await installAuthenticatedFixture(page, { asAdmin: true });
    await page.goto("/admin");
    await expect(page.getByText("Metadata berhasil diperiksa", { exact: true })).toHaveCount(2);
    let release;
    const held = new Promise(resolve => { release = resolve; });
    let hold = true, denied = false, heldRequests = 0;
    await page.route(/\/api\/(?:helpdesk\/status|ruang-simpan\/ai-status)\?diagnostics=true$/, async route => {
      const old = hold;
      if (old) { heldRequests++; await held; }
      await route.fulfill({ status: !old && denied ? 403 : 200, contentType: "application/json",
        body: JSON.stringify(!old && denied ? { error: "PRIVATE_RAW_ERROR" } : {
          state: "configured", message: "PRIVATE_BODY",
          checkedAt: "2026-11-02T01:00:00.000Z", recheckAt: "2026-11-02T01:01:00.000Z",
          diagnostics: { reason: "metadata_available" },
        }) }).catch(() => {});
    });
    await page.getByRole("button", { name: "Periksa kembali layanan AI", exact: true }).click();
    await expect.poll(() => heldRequests).toBe(2);
    await expect(page.getByText("Metadata berhasil diperiksa", { exact: true })).toHaveCount(0);
    hold = false; denied = true;
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("alert").filter({ hasText: "Akses diagnostik ditutup" })).toBeVisible();
    release();
    await expect(page.getByText("Metadata berhasil diperiksa", { exact: true })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("PRIVATE_");
    await page.reload();
    await expect(page.getByRole("alert").filter({ hasText: "Akses diagnostik ditutup" })).toBeVisible();
    await expect(page.getByText("Cache server hingga:", { exact: true })).toHaveCount(0);
    expect(unexpected).toEqual([]);
  });

  test("diagnostik AI gagal tertutup saat sesi atau koneksi gagal dan tersembunyi ketika tidak aktif", async ({ page }) => {
    await installAuthenticatedFixture(page, { asAdmin: true });
    await page.goto("/admin");
    await expect(page.getByText("Metadata berhasil diperiksa", { exact: true })).toHaveCount(2);
    await page.evaluate(() => window.dispatchEvent(new Event("blur")));
    await expect(page.getByText("Metadata berhasil diperiksa", { exact: true })).toHaveCount(0);
    await page.route(/\/api\/(?:helpdesk\/status|ruang-simpan\/ai-status)\?diagnostics=true$/, route => route.abort());
    await page.evaluate(() => window.dispatchEvent(new Event("focus")));
    await expect(page.getByRole("alert").filter({ hasText: "Status belum dapat dibaca." })).toHaveCount(2);
    await page.route(/\/api\/(?:helpdesk\/status|ruang-simpan\/ai-status)\?diagnostics=true$/, route =>
      route.fulfill({ status: 401, contentType: "application/json", body: '{"error":"PRIVATE_RAW"}' }));
    await page.getByRole("button", { name: "Periksa kembali layanan AI", exact: true }).click();
    await expect(page.getByRole("alert").filter({ hasText: "Sesi tidak dapat diverifikasi." })).toBeVisible();
    await expect(page.getByText("Cache server hingga:", { exact: true })).toHaveCount(0);
    await expect(page.locator("body")).not.toContainText("PRIVATE_");
  });

  test("admin membuka panel dan pengelolaan pengguna", async ({ page }) => {
    const unexpected = await installAuthenticatedFixture(page, { asAdmin: true });

    for (const path of ["/admin", "/admin/users"]) {
      const companyResponse = page.waitForResponse(response =>
        new URL(response.url()).pathname === "/api/ruang-simpan/company-names" &&
        response.request().method() === "POST");
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      if (path === "/admin") {
        await expect(page.getByRole("heading", { name: "Panel Admin" })).toBeVisible();
      }
      await expect(page.getByRole("heading", { name: "Data Pengguna" })).toBeVisible();
      const response = await companyResponse;
      expect(response.status()).toBe(200);
      expect(response.request().postDataJSON()).toEqual({ userIds: [MEMBER_ID] });
      expect(response.request().headers().authorization).toBe(`Bearer ${fixtureSession(member).access_token}`);
      expect(await response.json()).toEqual({ companies: [{ userId: MEMBER_ID, name: "BUJK Uji" }] });
      const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: "Anggota Uji", exact: true }) });
      await expect(row).toHaveCount(1);
      await expect(row.getByRole("cell", { name: "BUJK Uji", exact: true })).toBeVisible();
      await expect(page.getByRole("cell", { name: "Perusahaan Profil Lama", exact: true })).toHaveCount(0);
    }
    expect(unexpected).toEqual([]);
  });

  test("anggota biasa dialihkan dari panel dan pengelolaan pengguna", async ({ page }) => {
    await installAuthenticatedFixture(page);

    for (const path of ["/admin", "/admin/users"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/dashboard$/);
      await expect(page.getByRole("heading", { name: "Panel Admin" })).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Data Pengguna" })).toHaveCount(0);
    }
  });
});

test.describe("halaman khusus super-admin dengan sesi tiruan", () => {
  const restrictedPages = [
    { path: "/admin/akses", heading: "Kelola Akses Admin" },
    { path: "/admin/permintaan", heading: "Permintaan Akses Admin" },
  ];

  test("super-admin dapat melihat isi kedua halaman", async ({ page }) => {
    const unexpected = await installAuthenticatedFixture(page, { asSuperAdmin: true });

    for (const { path, heading } of restrictedPages) {
      await page.goto(path);
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      await expect(page.getByRole("cell", { name: "Anggota Uji" })).toBeVisible();
    }
    expect(unexpected).toEqual([]);
  });

  for (const { path, heading } of restrictedPages) {
    test(`respons izin lama true tidak membuka kembali ${path} setelah pemeriksaan baru menolak`, async ({ page }) => {
      const allowedResponse = { status: 200, contentType: "application/json", body: "true" };
      const deniedResponse = { status: 200, contentType: "application/json", body: "false" };
      const roleCheck = { response: allowedResponse, requests: 0 };
      const unexpected = await installAuthenticatedFixture(page, { asSuperAdmin: true, roleCheck });
      await page.goto(path);
      const protectedHeading = page.getByRole("heading", { name: heading });
      const protectedCell = page.getByRole("cell", { name: "Anggota Uji" });
      await expect(protectedHeading).toBeVisible();
      await expect(protectedCell).toBeVisible();
      const restrictedLinks = page.locator('a[href="/admin/akses"], a[href="/admin/permintaan"]');
      await expect(restrictedLinks).toHaveCount(2);

      let releaseOld;
      roleCheck.waitForRelease = new Promise((resolve) => { releaseOld = resolve; });
      const previousRequests = roleCheck.requests;
      // Both the sidebar and route guard own a hook instance. Hold the old
      // request from each, then let both newer checks deny independently.
      try {
        await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        await expect.poll(() => roleCheck.requests).toBe(previousRequests + 2);
        await expect(protectedHeading).toHaveCount(0);
        await expect(protectedCell).toHaveCount(0);
        await expect(restrictedLinks).toHaveCount(0);
        await expect(page).toHaveURL(new RegExp(`${path}$`));

        roleCheck.response = deniedResponse;
        roleCheck.waitForRelease = Promise.resolve();
        await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        await expect.poll(() => roleCheck.requests).toBe(previousRequests + 4);
        await expect(page).toHaveURL(/\/dashboard$/);
        await expect(protectedHeading).toHaveCount(0);
        await expect(protectedCell).toHaveCount(0);
        await expect(restrictedLinks).toHaveCount(0);

        // Watch for even a transient restoration, not just the final DOM state.
        await page.evaluate((restrictedHeading) => {
          window.__staleRoleContentRestored = false;
          const inspect = (node) => {
            if (node.nodeType !== Node.ELEMENT_NODE) return;
            const restrictedLink = 'a[href="/admin/akses"], a[href="/admin/permintaan"]';
            const headings = 'h1, h2, h3, [role="heading"]';
            const cells = 'td, [role="cell"]';
            const elements = [node, ...node.querySelectorAll(`${restrictedLink}, ${headings}, ${cells}`)];
            if (elements.some((element) =>
              element.matches(restrictedLink) ||
              (element.matches(headings) && element.textContent.trim() === restrictedHeading) ||
              (element.matches(cells) && element.textContent.trim() === "Anggota Uji"))) {
              window.__staleRoleContentRestored = true;
            }
          };
          new MutationObserver((records) => {
            for (const record of records) {
              if (record.type === "characterData") inspect(record.target.parentElement);
              for (const node of record.addedNodes) inspect(node);
            }
          }).observe(document.body, { childList: true, subtree: true, characterData: true });
        }, heading);
        const oldResponses = [];
        page.on("response", (response) => {
          if (new URL(response.url()).pathname === "/rest/v1/rpc/current_user_is_super_admin") {
            oldResponses.push(response);
          }
        });
        releaseOld();
        await expect.poll(() => oldResponses.length).toBe(2);
        for (const response of oldResponses) {
          expect(await response.text()).toBe("true");
          expect(await response.finished()).toBeNull();
        }
        // Let the fetch continuation and React updates settle before assertions.
        await page.evaluate(() => new Promise((resolve) =>
          requestAnimationFrame(() => requestAnimationFrame(resolve))));
        await expect(page).toHaveURL(/\/dashboard$/);
        await expect(protectedHeading).toHaveCount(0);
        await expect(protectedCell).toHaveCount(0);
        await expect(restrictedLinks).toHaveCount(0);
        expect(await page.evaluate(() => window.__staleRoleContentRestored)).toBe(false);
        expect(unexpected).toEqual([]);
      } finally {
        releaseOld();
      }
    });

    test(`pencabutan super-admin saat ${path} terbuka menyembunyikan isi dan mengalihkan`, async ({ page }) => {
      const roleCheck = {
        response: { status: 200, contentType: "application/json", body: "true" },
        requests: 0,
        waitForRelease: Promise.resolve(),
      };
      const unexpected = await installAuthenticatedFixture(page, { asSuperAdmin: true, roleCheck });
      await page.goto(path);
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      await expect(page.getByRole("cell", { name: "Anggota Uji" })).toBeVisible();

      const previousRequests = roleCheck.requests;
      roleCheck.response = { status: 200, contentType: "application/json", body: "false" };
      roleCheck.waitForRelease = new Promise((resolve) => { roleCheck.release = resolve; });
      try {
        await page.evaluate(() => window.dispatchEvent(new Event("focus")));
        await expect.poll(() => roleCheck.requests).toBeGreaterThan(previousRequests);
        await expect(page.getByRole("heading", { name: heading })).toHaveCount(0);
        roleCheck.release();
        await expect(page).toHaveURL(/\/dashboard$/);
        await expect(page.getByRole("heading", { name: heading })).toHaveCount(0);
        expect(unexpected).toEqual([]);
      } finally {
        roleCheck.release();
      }
    });
  }

  for (const { path, heading } of restrictedPages) {
    test(`RPC super-admin macet saat ${path} terbuka ditutup oleh batas waktu fetch asli`, async ({ page }) => {
      const roleCheck = {
        response: { status: 200, contentType: "application/json", body: "true" },
        requests: 0,
        waitForRelease: Promise.resolve(),
      };
      const unexpected = await installAuthenticatedFixture(page, { asSuperAdmin: true, roleCheck });
      await page.clock.install();
      await page.goto(path);
      const protectedHeading = page.getByRole("heading", { name: heading });
      const protectedCell = page.getByRole("cell", { name: "Anggota Uji" });
      await expect(protectedHeading).toBeVisible();
      await expect(protectedCell).toBeVisible();
      expect(await page.evaluate(() => document.visibilityState)).toBe("visible");

      await page.clock.pauseAt(await page.evaluate(() => Date.now()));
      await page.evaluate(() => {
        window.__roleCheckEvents = [];
        window.addEventListener("focus", () => window.__roleCheckEvents.push("focus"));
        document.addEventListener("visibilitychange", () => window.__roleCheckEvents.push("visibilitychange"));
      });
      const failedRoleRequests = [];
      page.on("requestfailed", (request) => {
        if (new URL(request.url()).pathname === "/rest/v1/rpc/current_user_is_super_admin") {
          failedRoleRequests.push(request.failure()?.errorText);
        }
      });
      const previousRequests = roleCheck.requests;
      roleCheck.waitForRelease = new Promise((resolve) => { roleCheck.release = resolve; });
      try {
        // Only the periodic check starts this RPC. Keep the fixture unresolved:
        // do not abort/fulfill it or replace fetch/AbortController in the browser.
        await page.clock.fastForward(30_000);
        await expect.poll(() => roleCheck.requests).toBeGreaterThan(previousRequests);
        await expect(protectedHeading).toHaveCount(0);
        await expect(protectedCell).toHaveCount(0);
        await expect(page).toHaveURL(new RegExp(`${path}$`));

        // Exercise SUPABASE_REQUEST_TIMEOUT_MS = 15_000 from the real client.ts,
        // including the boundary before its AbortController cancels the fetch.
        await page.clock.runFor(14_999);
        await expect(page).toHaveURL(new RegExp(`${path}$`));
        await expect(protectedHeading).toHaveCount(0);
        await expect(protectedCell).toHaveCount(0);
        expect(failedRoleRequests).toEqual([]);

        await page.clock.runFor(1);
        await expect(page).toHaveURL(/\/dashboard$/);
        await expect.poll(() => failedRoleRequests.length).toBeGreaterThan(0);
        await expect(protectedHeading).toHaveCount(0);
        await expect(protectedCell).toHaveCount(0);
        expect(await page.evaluate(() => window.__roleCheckEvents)).toEqual([]);
        expect(unexpected).toEqual([]);
      } finally {
        // Release only for cleanup, after the application's own timeout fired.
        roleCheck.release();
      }
    });
  }

  for (const { scenario, response, abortError } of [
    {
      scenario: "pencabutan super-admin",
      response: { status: 200, contentType: "application/json", body: "false" },
    },
    {
      scenario: "kegagalan RPC super-admin",
      response: {
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ code: "XX000", message: "Role lookup unavailable" }),
      },
    },
    {
      scenario: "kegagalan jaringan pemeriksaan super-admin",
      abortError: "failed",
    },
  ]) {
    for (const { path, heading } of restrictedPages) {
      test(`${scenario} saat ${path} tetap terlihat terdeteksi oleh pemeriksaan berkala`, async ({ page }) => {
        const roleCheck = {
          response: { status: 200, contentType: "application/json", body: "true" },
          requests: 0,
          waitForRelease: Promise.resolve(),
        };
        const unexpected = await installAuthenticatedFixture(page, { asSuperAdmin: true, roleCheck });
        await page.clock.install();
        await page.goto(path);
        await expect(page.getByRole("heading", { name: heading })).toBeVisible();
        await expect(page.getByRole("cell", { name: "Anggota Uji" })).toBeVisible();
        expect(await page.evaluate(() => document.visibilityState)).toBe("visible");

        const previousRequests = roleCheck.requests;
        if (response) roleCheck.response = response;
        roleCheck.abortError = abortError;
        roleCheck.waitForRelease = new Promise((resolve) => { roleCheck.release = resolve; });
        try {
          // Do not dispatch focus or visibilitychange: only the 30-second interval can recheck.
          await page.clock.fastForward(30_000);
          await expect.poll(() => roleCheck.requests).toBeGreaterThan(previousRequests);
          await expect(page.getByRole("heading", { name: heading })).toHaveCount(0);
          await expect(page.getByRole("cell", { name: "Anggota Uji" })).toHaveCount(0);
          roleCheck.release();
          await expect(page).toHaveURL(/\/dashboard$/);
          await expect(page.getByRole("heading", { name: heading })).toHaveCount(0);
          await expect(page.getByRole("cell", { name: "Anggota Uji" })).toHaveCount(0);
          expect(unexpected).toEqual([]);
        } finally {
          roleCheck.release();
        }
      });
    }
  }

  for (const { role, options } of [
    { role: "admin biasa", options: { asAdmin: true } },
    { role: "anggota", options: {} },
  ]) {
    test(`${role} dialihkan dari kedua halaman tanpa melihat isinya`, async ({ page }) => {
      const unexpected = await installAuthenticatedFixture(page, options);

      for (const { path, heading } of restrictedPages) {
        await page.goto(path);
        await expect(page).toHaveURL(/\/dashboard$/);
        await expect(page.getByRole("heading", { name: heading })).toHaveCount(0);
      }
      expect(unexpected).toEqual([]);
    });
  }

  for (const { scenario, response } of [
    {
      scenario: "RPC mengembalikan error",
      response: {
        status: 500,
        contentType: "application/json",
        body: JSON.stringify({ code: "XX000", message: "Role lookup unavailable" }),
      },
    },
    {
      scenario: "RPC mengembalikan hasil tak valid",
      response: { status: 200, contentType: "application/json", body: JSON.stringify("true") },
    },
  ]) {
    for (const { path, heading } of restrictedPages) {
      test(`${scenario} tidak membuka ${path} dan mengalihkan ke dashboard`, async ({ page }) => {
        const roleCheck = { response, requests: 0 };
        roleCheck.waitForRelease = new Promise((resolve) => { roleCheck.release = resolve; });
        const unexpected = await installAuthenticatedFixture(page, { asAdmin: true, roleCheck });

        try {
          await page.goto(path, { waitUntil: "domcontentloaded" });
          await expect.poll(() => roleCheck.requests).toBeGreaterThan(0);
          await expect(page.getByRole("heading", { name: heading })).toHaveCount(0);
          roleCheck.release();
          await expect(page).toHaveURL(/\/dashboard$/);
          await expect(page.getByRole("heading", { name: heading })).toHaveCount(0);
          expect(unexpected).toEqual([]);
        } finally {
          roleCheck.release();
        }
      });
    }
  }
});