import { expect, test } from "@playwright/test";
import { installSupabaseSession } from "./helpers/supabase-session.js";
const userId = "00000000-0000-4000-8000-000000000701";
const courseId = "00000000-0000-4000-8000-000000000702";
const sessionId = "00000000-0000-4000-8000-000000000703";
const lessonId = "00000000-0000-4000-8000-000000000704";
const enrollmentId = "00000000-0000-4000-8000-000000000705";
const agendaId = "00000000-0000-4000-8000-000000000706";

const course = {
  id: courseId,
  agenda_id: agendaId,
  audience: "Anggota BUJK ASPEKINDO",
  course_code: "PUB-LMS-001",
  created_at: "2026-09-01T00:00:00.000Z",
  created_by: userId,
  description_markdown: "Kursus internal untuk **persiapan dokumen LKUT**.",
  member_only: true,
  published_at: "2026-09-01T01:00:00.000Z",
  slug: "persiapan-lkut",
  status: "published",
  siap_focus: "sertifikasi",
  title: "Persiapan Dokumen LKUT",
  updated_at: "2026-09-01T01:00:00.000Z",
};

async function installAdminSession(page) {
  const user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: "lms-admin@example.test",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: "Admin LMS" },
    created_at: "2026-09-01T00:00:00.000Z",
  };
  const session = {
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  };

  await installSupabaseSession(page, session);

  await page.route("**/auth/v1/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: route.request().url().endsWith("/user") ? JSON.stringify(user) : "{}",
    });
  });
}

async function installAdminApi(page) {
  const rows = {
    aspekindo_lms_courses: [course],
    aspekindo_lms_sessions: [{
      id: sessionId,
      course_id: courseId,
      title: "Sesi internal ASPEKINDO",
      description_markdown: "Sesi pembekalan.",
      delivery_mode: "internal",
      source_type: "native",
      source_name: "PUB ASPEKINDO",
      source_url: "",
      status: "published",
      starts_at: "2026-09-10T02:00:00.000Z",
      ends_at: "2026-09-10T05:00:00.000Z",
      sort_order: 0,
      created_by: userId,
      created_at: "2026-09-01T00:00:00.000Z",
      updated_at: "2026-09-01T00:00:00.000Z",
    }],
    aspekindo_lms_lessons: [{
      id: lessonId,
      course_id: courseId,
      session_id: sessionId,
      title: "Memeriksa kelengkapan dokumen",
      slug: "kelengkapan-dokumen",
      content_markdown: "Materi utama.",
      passing_score: 70,
      is_published: true,
      sort_order: 0,
      created_by: userId,
      created_at: "2026-09-01T00:00:00.000Z",
      updated_at: "2026-09-01T00:00:00.000Z",
    }],
    aspekindo_lms_materials: [],
    aspekindo_lms_quiz_questions: [],
    aspekindo_lms_quiz_answer_keys: [],
    aspekindo_lms_enrollments: [{
      id: enrollmentId,
      course_id: courseId,
      user_id: userId,
      status: "active",
      notes: "",
      enrolled_at: "2026-09-01T02:00:00.000Z",
      last_activity_at: "2026-09-01T02:10:00.000Z",
      completed_at: null,
    }],
    aspekindo_lms_lesson_progress: [{
      id: "00000000-0000-4000-8000-000000000707",
      enrollment_id: enrollmentId,
      lesson_id: lessonId,
      status: "completed",
      score: 90,
      completed_at: "2026-09-01T03:00:00.000Z",
      created_at: "2026-09-01T02:00:00.000Z",
      updated_at: "2026-09-01T03:00:00.000Z",
    }],
    aspekindo_lms_completion_records: [{
      id: "00000000-0000-4000-8000-000000000708",
      record_number: "PUB-LMS-2026-001",
      export_schema_version: "aspekindo-pub-lms-v1",
      enrollment_id: enrollmentId,
      course_id: courseId,
      session_id: null,
      user_id: userId,
      record_type: "completion",
      status: "ready_for_review",
      evidence_title: "Penyelesaian Persiapan LKUT",
      evidence_description: "Bukti persiapan.",
      evidence_url: "",
      metadata: {},
      issued_at: "2026-09-01T03:00:00.000Z",
      export_batch_id: null,
      exported_at: null,
      created_by: userId,
      created_at: "2026-09-01T03:00:00.000Z",
      updated_at: "2026-09-01T03:00:00.000Z",
    }],
  };

  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const table = requestUrl.pathname.split("/").pop();

    if (table === "user_roles") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ role: "admin" }]) });
      return;
    }
    if (table === "profiles") {
      const profile = { user_id: userId, full_name: "Admin LMS", company: "PUB ASPEKINDO" };
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: request.headers().accept?.includes("vnd.pgrst.object") ? JSON.stringify(profile) : JSON.stringify([profile]),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { "content-range": "0-0/1" },
      contentType: "application/json",
      body: request.method() === "HEAD" ? "" : JSON.stringify(rows[table] ?? []),
    });
  });
}

test("admin can review native LMS authoring, progress, evidence, and mobile layout", async ({ page }) => {
  await installAdminSession(page);
  await installAdminApi(page);
  await page.goto("/admin/aspekindo-lms/kursus");

  await expect(page.getByRole("heading", { name: "Authoring & operasi LMS" })).toBeVisible();
  await expect(page.getByText("Persiapan Dokumen LKUT").first()).toBeVisible();
  await expect(page.getByText("Sesi internal ASPEKINDO")).toBeVisible();
  await expect(page.getByText("Memeriksa kelengkapan dokumen")).toBeVisible();

  await page.getByRole("button", { name: "Preview" }).click();
  await expect(page.getByRole("dialog")).toContainText("persiapan dokumen LKUT");
  await page.getByRole("button", { name: "Close" }).click();

  await page.getByRole("tab", { name: "Peserta & evidence" }).click();
  await expect(page.getByText("100%")).toBeVisible();
  await expect(page.getByText("PUB-LMS-2026-001")).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByRole("heading", { name: "Authoring & operasi LMS" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("published agenda exposes Masuk LMS while preserving external registration", async ({ page }) => {
  await page.route("**/rest/v1/**", async (route) => {
    const table = new URL(route.request().url()).pathname.split("/").pop();
    const data = table === "aspekindo_learning_agendas" ? [{
      id: agendaId,
      title: "Klinik Persiapan LKUT",
      category: "Klinik pendampingan",
      description: "Kegiatan PUB internal.",
      audience: "Anggota ASPEKINDO",
      status: "published",
      start_date: "2026-09-10",
      end_date: null,
      schedule: "09.00–12.00 WIB",
      location: "Jakarta",
      registration_url: "https://aspekindo.id/daftar",
      registration_details: "Registrasi kegiatan.",
      created_at: "2026-09-01T00:00:00.000Z",
      updated_at: "2026-09-01T00:00:00.000Z",
    }] : table === "get_public_aspekindo_lms_agenda_links"
      ? [{ id: course.id, agenda_id: course.agenda_id, title: course.title, course_code: course.course_code }]
      : [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });

  await page.goto("/agenda-pub");
  await expect(page.getByRole("link", { name: "Masuk LMS" })).toHaveAttribute("href", `/aspekindo-lms/kursus/${courseId}`);
  await expect(page.getByRole("link", { name: "Daftar kegiatan" })).toHaveAttribute("href", "https://aspekindo.id/daftar");
});

test("non-admin cannot open native LMS authoring", async ({ page }) => {
  await installAdminSession(page);
  await page.route("**/rest/v1/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const table = requestUrl.pathname.split("/").pop();
    if (table === "profiles" && route.request().headers().accept?.includes("vnd.pgrst.object")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ user_id: userId, full_name: "Anggota Biasa" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });
  await page.goto("/admin/aspekindo-lms/kursus");
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByRole("heading", { name: "Authoring & operasi LMS" })).not.toBeVisible();
});