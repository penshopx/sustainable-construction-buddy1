import { test, expect } from "@playwright/test";
import { installSupabaseSession } from "./helpers/supabase-session.js";
const ADMIN_ID = "00000000-0000-4000-8000-000000000901";
const COURSE_ID = "00000000-0000-4000-8000-000000000902";
const LESSON_ID = "00000000-0000-4000-8000-000000000904";

async function installAdminSession(page) {
  const user = {
    id: ADMIN_ID,
    aud: "authenticated",
    role: "authenticated",
    email: "admin-lms@example.test",
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
  const state = {
    courses: [{
      id: COURSE_ID,
      course_code: "ASPEKINDO-LMS-ADMIN-01",
      slug: "fondasi-siap-proyek",
      title: "Fondasi SIAP Proyek",
      description_markdown: "Pembelajaran awal untuk admin.",
      audience: "Anggota BUJK",
      status: "draft",
      siap_focus: "proyek",
      member_only: true,
      agenda_id: null,
      created_by: ADMIN_ID,
      published_at: null,
      created_at: "2026-09-01T00:00:00.000Z",
      updated_at: "2026-09-01T00:00:00.000Z",
      public_landing_enabled: false,
    }],
  };

  await installSupabaseSession(page, session);

  await page.route("**/auth/v1/**", async (route) => {
    if (route.request().url().endsWith("/user")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const endpoint = new URL(request.url()).pathname.split("/").pop();
    const objectRequested = request.headers().accept?.includes("vnd.pgrst.object");

    if (endpoint === "user_roles") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ role: "admin" }]) });
      return;
    }
    if (endpoint === "profiles") {
      const profile = { user_id: ADMIN_ID, full_name: "Admin LMS", company: "PUB ASPEKINDO" };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(objectRequested ? profile : [profile]) });
      return;
    }
    if (endpoint === "aspekindo_lms_courses") {
      if (request.method() === "POST") {
        const body = request.postDataJSON();
        state.courses.unshift({
          ...body,
          id: "00000000-0000-4000-8000-000000000903",
          course_code: "ASPEKINDO-LMS-ADMIN-02",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify({ id: "00000000-0000-4000-8000-000000000903" }),
        });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(state.courses) });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { "content-range": "*/0" },
      contentType: "application/json",
      body: request.method() === "HEAD" ? "" : "[]",
    });
  });
}

test("admin keeps access to the incoming native LMS course manager", async ({ page }) => {
  await installAdminSession(page);
  await page.goto("/admin/lms-aspekindo");

  await expect(page.getByRole("heading", { name: "Kelola LMS ASPEKINDO" })).toBeVisible();
  await expect(page.getByText("Terpisah dari Operasi Kegiatan PUB legacy")).toBeVisible();
  await expect(page.getByText("Fondasi SIAP Proyek").first()).toBeVisible();

  await page.getByRole("button", { name: "Tambah kursus" }).click();
  await page.getByLabel("Judul kursus *").fill("Manajemen Risiko Tender");
  await expect(page.getByLabel("Slug *")).toHaveValue("manajemen-risiko-tender");
  await page.getByText("SIAP Sertifikasi", { exact: true }).click();
  await page.getByRole("option", { name: "SIAP Tender" }).click();
  await page.getByRole("button", { name: "Simpan kursus" }).click();

  await expect(page.getByText("Manajemen Risiko Tender").first()).toBeVisible();
  await expect(page.getByText("ASPEKINDO-LMS-ADMIN-02").first()).toBeVisible();
  await page.getByRole("button", { name: "Pratinjau" }).click();
  await expect(page.getByRole("dialog")).toContainText("SIAP Tender");
});

test("admin sees reliable upload progress for MP4 and WebM lesson videos", async ({ page }) => {
  await installAdminSession(page);

  const courses = [{
    id: COURSE_ID,
    course_code: "ASPEKINDO-LMS-ADMIN-01",
    slug: "fondasi-siap-proyek",
    title: "Fondasi SIAP Proyek",
    description_markdown: "Pembelajaran awal untuk admin.",
    audience: "Anggota BUJK",
    status: "draft",
    siap_focus: "proyek",
    member_only: true,
    agenda_id: null,
    created_by: ADMIN_ID,
    published_at: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    public_landing_enabled: false,
  }];
  const lessons = [{
    id: LESSON_ID,
    course_id: COURSE_ID,
    session_id: null,
    title: "Video pengantar",
    slug: "video-pengantar",
    content_markdown: "Materi utama.",
    passing_score: 70,
    is_published: false,
    sort_order: 0,
    created_by: ADMIN_ID,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
  }];
  const materials = [];
  let savedMaterial = null;
  let uploadAttempts = 0;
  let releaseFirstUpload;
  const firstUploadGate = new Promise((resolve) => {
    releaseFirstUpload = resolve;
  });
  let releaseWebmUpload;
  const webmUploadGate = new Promise((resolve) => {
    releaseWebmUpload = resolve;
  });
  let releaseMaterialInsert;
  const materialInsertGate = new Promise((resolve) => {
    releaseMaterialInsert = resolve;
  });

  await page.route("**/auth/v1/**", async (route) => {
    if (route.request().url().endsWith("/user")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({
        id: ADMIN_ID,
        aud: "authenticated",
        role: "authenticated",
        email: "admin-lms@example.test",
        app_metadata: { provider: "email", providers: ["email"] },
        user_metadata: { full_name: "Admin LMS" },
        created_at: "2026-09-01T00:00:00.000Z",
      }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.route("**/storage/v1/object/**", async (route) => {
    if (route.request().method() === "POST") {
      uploadAttempts += 1;
      if (uploadAttempts === 1) {
        await firstUploadGate;
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Simulasi koneksi upload terputus" }),
        });
        return;
      }
      if (uploadAttempts === 3) {
        await webmUploadGate;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ Key: "native/video.mp4" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
  });

  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const endpoint = requestUrl.pathname.split("/").pop();
    const objectRequested = request.headers().accept?.includes("vnd.pgrst.object");

    if (endpoint === "user_roles") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ role: "admin" }]) });
      return;
    }
    if (endpoint === "profiles") {
      const profile = { user_id: ADMIN_ID, full_name: "Admin LMS", company: "PUB ASPEKINDO" };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(objectRequested ? profile : [profile]) });
      return;
    }
    if (endpoint === "aspekindo_lms_courses") {
      if (request.method() === "PATCH") {
        const body = request.postDataJSON();
        courses[0] = { ...courses[0], ...body, public_landing_enabled: body.public_landing_enabled };
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(courses) });
      return;
    }
    if (endpoint === "aspekindo_lms_lessons") {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(lessons) });
      return;
    }
    if (endpoint === "aspekindo_lms_materials") {
      if (request.method() === "POST") {
        savedMaterial = request.postDataJSON();
        await materialInsertGate;
        materials.push({ ...savedMaterial, id: "00000000-0000-4000-8000-000000000905" });
        await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify([]) });
        return;
      }
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(materials) });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { "content-range": "*/0" },
      contentType: "application/json",
      body: request.method() === "HEAD" ? "" : "[]",
    });
  });

  await page.goto("/admin/lms-aspekindo");
  await expect(page.getByRole("heading", { name: "Kelola LMS ASPEKINDO" })).toBeVisible();
  await page.getByRole("button", { name: "Edit" }).first().click();
  await page.getByLabel("Landing publik").click();
  await page.getByRole("button", { name: "Simpan kursus" }).click();
  await expect(page.getByText("Landing publik aktif")).toBeVisible();

  await page.getByRole("button", { name: "Materi" }).click();
  await page.getByLabel("Judul materi *").fill("Video pengantar");
  await page.getByRole("combobox").last().click();
  await page.getByRole("option", { name: "Video privat" }).click();
  await page.locator("#native-material-video").setInputFiles({
    name: "pengantar.mp4",
    mimeType: "video/mp4",
    buffer: Buffer.from("fake-mp4-content"),
  });
  await expect(page.getByText("pengantar.mp4")).toBeVisible();
  await page.getByRole("button", { name: "Simpan materi" }).click();
  await expect(page.getByTestId("video-upload-progress")).toBeVisible();
  await expect(page.getByTestId("video-upload-progress")).toContainText("0%");
  await expect(page.getByTestId("video-upload-progress")).toContainText("0 B dari 16 B terkirim");
  await expect(page.getByRole("button", { name: "Mengunggah 0%" })).toBeDisabled();

  releaseFirstUpload();
  await expect(page.getByText("Video gagal diunggah", { exact: true })).toBeVisible();
  await expect(page.getByText("Simulasi koneksi upload terputus", { exact: true })).toBeVisible();
  expect(savedMaterial).toBeNull();
  await expect(page.getByTestId("video-upload-progress")).toHaveCount(0);

  await page.getByRole("button", { name: "Simpan materi" }).click();
  await expect(page.getByTestId("video-upload-progress")).toContainText("100%");
  await expect(page.getByTestId("video-upload-progress")).toContainText("16 B dari 16 B terkirim");
  await expect(page.getByRole("button", { name: "Mengunggah 100%" })).toBeDisabled();
  releaseMaterialInsert();

  await expect.poll(() => savedMaterial).toMatchObject({
    material_type: "video",
    file_name: "pengantar.mp4",
    mime_type: "video/mp4",
    file_size_bytes: 16,
  });
  expect(savedMaterial.storage_path).toMatch(/^native\//);

  await page.getByRole("button", { name: "Materi", exact: true }).click();
  await page.getByLabel("Judul materi *").fill("Video lanjutan");
  await page.getByRole("combobox").last().click();
  await page.getByRole("option", { name: "Video privat" }).click();
  await page.locator("#native-material-video").setInputFiles({
    name: "lanjutan.webm",
    mimeType: "video/webm",
    buffer: Buffer.from("fake-webm-content"),
  });
  await page.getByRole("button", { name: "Simpan materi" }).click();
  await expect(page.getByTestId("video-upload-progress")).toContainText("0%");
  await expect(page.getByTestId("video-upload-progress")).toContainText("0 B dari 17 B terkirim");
  await expect(page.getByRole("button", { name: "Mengunggah 0%" })).toBeDisabled();
  releaseWebmUpload();

  await expect.poll(() => savedMaterial).toMatchObject({
    material_type: "video",
    file_name: "lanjutan.webm",
    mime_type: "video/webm",
    file_size_bytes: 17,
  });
});