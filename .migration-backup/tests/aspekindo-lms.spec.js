import { expect, test } from "@playwright/test";
import { installSupabaseSession } from "./helpers/supabase-session.js";
const USER_ID = "00000000-0000-4000-8000-000000000801";
const COURSE_ID = "00000000-0000-4000-8000-000000000811";
const DRAFT_ID = "00000000-0000-4000-8000-000000000812";
const LESSON_ONE_ID = "00000000-0000-4000-8000-000000000821";
const LESSON_TWO_ID = "00000000-0000-4000-8000-000000000822";
const QUESTION_ID = "00000000-0000-4000-8000-000000000831";
const AGENDA_ID = "00000000-0000-4000-8000-000000000832";

const linkedAgenda = {
  id: AGENDA_ID,
  title: "Klinik Persiapan Tender ASPEKINDO",
  start_date: "2026-09-15",
  status: "published",
};

const publishedCourse = {
  id: COURSE_ID,
  course_code: "ASPEKINDO-LMS-SIAP-01",
  slug: "persiapan-bujk-siap",
  title: "Persiapan BUJK SIAP",
  description_markdown: "## Tujuan\nMemahami bukti kegiatan dan menyiapkan penerapan pada BUJK.",
  audience: "Anggota dan pengelola BUJK",
  status: "published",
  member_only: false,
  agenda_id: AGENDA_ID,
  created_by: null,
  published_at: "2026-08-31T00:00:00.000Z",
  created_at: "2026-08-31T00:00:00.000Z",
  updated_at: "2026-08-31T00:00:00.000Z",
};

const draftCourse = { ...publishedCourse, id: DRAFT_ID, title: "Kursus Draft Rahasia", slug: "kursus-draft-rahasia", status: "draft" };

const sessions = [
  {
    id: "00000000-0000-4000-8000-000000000841",
    session_code: "ASPEKINDO-SESSION-01",
    course_id: COURSE_ID,
    title: "Orientasi internal",
    description_markdown: "Sesi pengantar yang dikelola PUB ASPEKINDO.",
    delivery_mode: "internal",
    source_type: "native",
    source_name: "PUB ASPEKINDO",
    source_url: "",
    source_activity_id: null,
    evidence_requirement: {},
    status: "published",
    starts_at: "2026-09-10T02:00:00.000Z",
    ends_at: "2026-09-10T04:00:00.000Z",
    sort_order: 0,
    created_by: null,
    created_at: "2026-08-31T00:00:00.000Z",
    updated_at: "2026-08-31T00:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000842",
    session_code: "ASPEKINDO-SESSION-02",
    course_id: COURSE_ID,
    title: "Praktik pada platform asal",
    description_markdown: "Jalur sementara untuk praktik eksternal.",
    delivery_mode: "external",
    source_type: "external",
    source_name: "Penyedia pelatihan eksternal",
    source_url: "https://example.com/pelatihan",
    source_activity_id: null,
    evidence_requirement: {},
    status: "published",
    starts_at: null,
    ends_at: null,
    sort_order: 1,
    created_by: null,
    created_at: "2026-08-31T00:00:00.000Z",
    updated_at: "2026-08-31T00:00:00.000Z",
  },
];

const lessons = [
  {
    id: LESSON_ONE_ID,
    course_id: COURSE_ID,
    session_id: sessions[0].id,
    slug: "mengenali-bukti",
    title: "Mengenali bukti kegiatan",
    content_markdown: "### Materi\nBukti kegiatan harus dapat ditelusuri dan ditinjau.",
    passing_score: 70,
    sort_order: 0,
    is_published: true,
    created_by: null,
    created_at: "2026-08-31T00:00:00.000Z",
    updated_at: "2026-08-31T00:00:00.000Z",
  },
  {
    id: LESSON_TWO_ID,
    course_id: COURSE_ID,
    session_id: sessions[0].id,
    slug: "rencana-penerapan",
    title: "Rencana penerapan BUJK",
    content_markdown: "### Materi\nSusun langkah penerapan yang dapat diverifikasi.",
    passing_score: 70,
    sort_order: 1,
    is_published: true,
    created_by: null,
    created_at: "2026-08-31T00:00:00.000Z",
    updated_at: "2026-08-31T00:00:00.000Z",
  },
];

const defaultMaterials = [{
  id: "00000000-0000-4000-8000-000000000851",
  lesson_id: LESSON_ONE_ID,
  title: "Panduan bukti",
  material_type: "link",
  content_markdown: "Gunakan panduan ini sebagai referensi.",
  external_url: "https://example.com/panduan",
  storage_path: "",
  file_name: "",
  mime_type: "",
  file_size_bytes: 0,
  sort_order: 0,
  is_published: true,
  created_by: null,
  created_at: "2026-08-31T00:00:00.000Z",
  updated_at: "2026-08-31T00:00:00.000Z",
}];

function responseRows(route, rows, { object = false, status = 200 } = {}) {
  return route.fulfill({
    status,
    headers: { "content-range": rows.length ? `0-${rows.length - 1}/${rows.length}` : "*/0" },
    contentType: "application/json",
    body: JSON.stringify(object ? rows[0] ?? null : rows),
  });
}

async function installLmsMock(page, {
  courses = [publishedCourse, draftCourse],
  materials = defaultMaterials,
} = {}) {
  const user = {
    id: USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: "peserta-lms@example.test",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: "Peserta LMS" },
    created_at: "2026-08-31T00:00:00.000Z",
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
    enrollments: [],
    progress: [],
    attempts: [],
    completionRecords: [],
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
    const url = new URL(request.url());
    const endpoint = url.pathname.split("/").pop();
    const objectRequested = request.headers().accept?.includes("vnd.pgrst.object");

    if (url.pathname.includes("/rpc/")) {
      const body = request.postDataJSON();
      if (endpoint === "enroll_aspekindo_lms_course") {
        if (!state.enrollments.length) {
          state.enrollments.push({
            id: "00000000-0000-4000-8000-000000000861",
            course_id: COURSE_ID,
            user_id: USER_ID,
            status: "enrolled",
            enrolled_at: new Date().toISOString(),
            completed_at: null,
            last_activity_at: null,
            notes: "",
          });
        }
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(state.enrollments[0]) });
        return;
      }
      if (endpoint === "submit_aspekindo_lms_quiz") {
        const selected = body._answers[QUESTION_ID];
        const attempt = {
          id: `00000000-0000-4000-8000-00000000087${state.attempts.length + 1}`,
          enrollment_id: state.enrollments[0].id,
          course_id: COURSE_ID,
          lesson_id: LESSON_ONE_ID,
          user_id: USER_ID,
          attempt_number: state.attempts.length + 1,
          score: selected === 1 ? 100 : 0,
          total_questions: 1,
          correct_answers: selected === 1 ? 1 : 0,
          passed: selected === 1,
          submitted_at: new Date().toISOString(),
        };
        state.attempts.unshift(attempt);
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(attempt) });
        return;
      }
      if (endpoint === "complete_aspekindo_lms_lesson") {
        const lessonId = body._lesson_id;
        const row = {
          id: `00000000-0000-4000-8000-00000000086${lessonId === LESSON_ONE_ID ? "1" : "2"}`,
          enrollment_id: state.enrollments[0].id,
          course_id: COURSE_ID,
          lesson_id: lessonId,
          user_id: USER_ID,
          status: "completed",
          progress_percent: 100,
          started_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        state.progress = [...state.progress.filter((item) => item.lesson_id !== lessonId), row];
        state.enrollments[0].status = "in_progress";
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(row) });
        return;
      }
      if (endpoint === "complete_aspekindo_lms_course") {
        state.enrollments[0] = { ...state.enrollments[0], status: "completed", completed_at: new Date().toISOString(), last_activity_at: new Date().toISOString() };
        state.completionRecords = [{
          id: "00000000-0000-4000-8000-000000000891",
          record_number: "PUB-LMS-2026-TEST",
          export_schema_version: "aspekindo-pub-lms-v1",
          enrollment_id: state.enrollments[0].id,
          course_id: COURSE_ID,
          session_id: null,
          user_id: USER_ID,
          record_type: "completion",
          status: "ready_for_review",
          evidence_title: "Persiapan BUJK SIAP — Completion Record PUB",
          evidence_description: "Bukti penyelesaian.",
          evidence_url: "",
          metadata: {},
          issued_at: new Date().toISOString(),
          export_batch_id: null,
          exported_at: null,
          created_by: USER_ID,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }];
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(state.enrollments[0]) });
        return;
      }
    }

    if (endpoint === "aspekindo_lms_courses") {
      const requestedId = url.searchParams.get("id")?.replace("eq.", "");
      const rows = courses.filter((course) => course.status === "published" && (!requestedId || course.id === requestedId));
      if (requestedId && !rows.length && objectRequested) {
        await route.fulfill({ status: 406, contentType: "application/json", body: JSON.stringify({ code: "PGRST116", message: "JSON object requested, multiple (or no) rows returned" }) });
        return;
      }
      await responseRows(route, rows, { object: objectRequested });
      return;
    }
    if (endpoint === "aspekindo_learning_agendas") {
      await responseRows(route, [linkedAgenda], { object: objectRequested });
      return;
    }
    if (endpoint === "aspekindo_lms_sessions") {
      await responseRows(route, sessions.filter((item) => item.status === "published"));
      return;
    }
    if (endpoint === "aspekindo_lms_lessons") {
      await responseRows(route, lessons.filter((item) => item.is_published));
      return;
    }
    if (endpoint === "aspekindo_lms_materials") {
      await responseRows(route, materials);
      return;
    }
    if (endpoint === "aspekindo_lms_enrollments") {
      if (request.method() === "POST") {
        if (!state.enrollments.length) {
          state.enrollments.push({
            id: "00000000-0000-4000-8000-000000000861",
            course_id: COURSE_ID,
            user_id: USER_ID,
            status: "enrolled",
            enrolled_at: new Date().toISOString(),
            completed_at: null,
            last_activity_at: null,
            notes: "",
          });
        }
        await responseRows(route, state.enrollments, { object: true, status: 201 });
        return;
      }
      await responseRows(route, state.enrollments);
      return;
    }
    if (endpoint === "aspekindo_lms_lesson_progress") {
      if (request.method() === "POST") {
        const body = request.postDataJSON();
        const existing = state.progress.find((item) => item.lesson_id === body.lesson_id);
        const row = {
          id: existing?.id ?? `00000000-0000-4000-8000-00000000086${state.progress.length + 1}`,
          completed_at: null,
          updated_at: new Date().toISOString(),
          ...existing,
          ...body,
        };
        state.progress = [...state.progress.filter((item) => item.lesson_id !== body.lesson_id), row];
        await responseRows(route, [row], { object: true, status: 201 });
        return;
      }
      await responseRows(route, state.progress);
      return;
    }
    if (endpoint === "aspekindo_lms_quiz_questions") {
      const lessonId = url.searchParams.get("lesson_id")?.replace("eq.", "");
      await responseRows(route, lessonId === LESSON_ONE_ID ? [{
        id: QUESTION_ID,
        lesson_id: LESSON_ONE_ID,
        question_text: "Di mana jawaban kuis dinilai?",
        options: ["Di katalog publik", "Di server LMS"],
        points: 1,
        sort_order: 0,
        created_by: null,
        created_at: "2026-08-31T00:00:00.000Z",
      }] : []);
      return;
    }
    if (endpoint === "aspekindo_lms_quiz_attempts") {
      const lessonId = url.searchParams.get("lesson_id")?.replace("eq.", "");
      await responseRows(route, state.attempts.filter((item) => !lessonId || item.lesson_id === lessonId));
      return;
    }
    if (endpoint === "aspekindo_lms_completion_records") {
      await responseRows(route, state.completionRecords);
      return;
    }
    if (endpoint === "profiles" && objectRequested) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: USER_ID, user_id: USER_ID, full_name: "Peserta LMS", current_level: "Pemula", company: "BUJK Uji" }) });
      return;
    }
    if (endpoint === "user_roles") {
      await responseRows(route, []);
      return;
    }
    await responseRows(route, []);
  });

  return state;
}

test.describe("pengalaman peserta LMS ASPEKINDO @pr-auth", () => {
  test("menangani katalog kosong dan menolak akses kursus draft", async ({ page }) => {
    await installLmsMock(page, { courses: [draftCourse] });
    await page.goto("/aspekindo-lms");
    await expect(page.getByRole("heading", { name: "LMS ASPEKINDO" })).toBeVisible();
    await expect(page.getByText("Belum ada pembelajaran terbit")).toBeVisible();
    await expect(page.getByText("Kursus Draft Rahasia")).toHaveCount(0);

    await page.goto(`/aspekindo-lms/kursus/${DRAFT_ID}`);
    await expect(page.getByText("Pembelajaran tidak ditemukan")).toBeVisible();
  });

  test("menyimpan daftar, progres, kuis, penyelesaian, dan bukti setelah refresh", async ({ page }) => {
    await installLmsMock(page);
    await page.goto("/aspekindo-lms");
    await expect(page.getByRole("link", { name: "Agenda terkait: Klinik Persiapan Tender ASPEKINDO" })).toHaveAttribute("href", "/agenda-pub");
    await page.getByRole("link", { name: /Daftar/ }).click();
    await expect(page).toHaveURL(new RegExp(`/aspekindo-lms/kursus/${COURSE_ID}$`));
    await page.getByRole("button", { name: "Daftar kursus" }).click();
    await expect(page.getByText("Materi", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Buka platform asal" })).toHaveAttribute("href", "https://example.com/pelatihan");

    await page.getByRole("button", { name: "Mulai kuis" }).click();
    await page.getByText("Di katalog publik", { exact: true }).click();
    await page.getByRole("button", { name: "Kirim jawaban" }).click();
    await expect(page.getByText(/Kuis belum lulus · Skor 0%/)).toBeVisible();

    await page.getByRole("button", { name: "Coba lagi" }).click();
    await page.getByText("Di server LMS", { exact: true }).click();
    await page.getByRole("button", { name: "Kirim jawaban" }).click();
    await expect(page.getByText(/Kuis lulus · Skor 100%/)).toBeVisible();
    await page.getByRole("button", { name: "Tandai pelajaran selesai" }).click();
    await expect(page.getByText("Pelajaran ini sudah selesai")).toBeVisible();

    await page.reload();
    await expect(page.getByText("Progres kursus")).toBeVisible();
    await expect(page.getByText("50%")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Rencana penerapan BUJK" })).toBeVisible();
    await expect(page.getByText("Susun langkah penerapan yang dapat diverifikasi.")).toBeVisible();
    await page.getByRole("button", { name: "Tandai pelajaran selesai" }).click();
    await expect(page.getByRole("button", { name: "Buat catatan bukti" })).toBeEnabled();
    await page.getByRole("button", { name: "Buat catatan bukti" }).click();
    await page.getByRole("button", { name: "Kembali ke katalog" }).click();

    await expect(page.getByText("Persiapan BUJK SIAP — Completion Record PUB")).toBeVisible();
    await expect(page.getByText("Siap ditinjau", { exact: true })).toBeVisible();
    await expect(page.getByText("Selesai", { exact: true }).first()).toBeVisible();
  });

  test("tetap dapat digunakan pada viewport mobile", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await installLmsMock(page);
    await page.goto("/aspekindo-lms");
    await expect(page.getByRole("heading", { name: "LMS ASPEKINDO" })).toBeVisible();
    await expect(page.getByLabel("Cari pembelajaran ASPEKINDO")).toBeVisible();
    await expect(page.locator("body")).toHaveJSProperty("scrollWidth", 390);
  });

  test("meminta signed URL hanya setelah peserta terdaftar dan dapat mencoba ulang", async ({ page }) => {
    const videoMaterial = {
      ...defaultMaterials[0],
      id: "00000000-0000-4000-8000-000000000852",
      title: "Video pengantar kontrak",
      material_type: "video",
      content_markdown: "",
      external_url: "",
      storage_path: `native/${COURSE_ID}/${LESSON_ONE_ID}/video-pengantar.mp4`,
      file_name: "video-pengantar.mp4",
      mime_type: "video/mp4",
      file_size_bytes: 2048,
    };
    let signedUrlRequests = 0;
    let releaseVideoResponse;
    const videoResponseGate = new Promise((resolve) => {
      releaseVideoResponse = resolve;
    });

    await installLmsMock(page, { materials: [videoMaterial] });
    await page.route("**/storage/v1/object/sign/**", async (route) => {
      if (route.request().method() === "GET") {
        await videoResponseGate;
        await route.fulfill({ status: 200, contentType: "video/mp4", body: "" });
        return;
      }
      signedUrlRequests += 1;
      if (signedUrlRequests === 1) {
        await route.fulfill({
          status: 500,
          contentType: "application/json",
          body: JSON.stringify({ message: "Signed URL sementara gagal dibuat" }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          signedURL: `/storage/v1/object/sign/aspekindo-learning/${videoMaterial.storage_path}?token=test-signed-token`,
        }),
      });
    });

    await page.goto(`/aspekindo-lms/kursus/${COURSE_ID}`);
    await expect(page.getByRole("button", { name: "Daftar kursus" })).toBeVisible();
    expect(signedUrlRequests).toBe(0);

    await page.getByRole("button", { name: "Daftar kursus" }).click();
    await expect(page.getByText("Video belum dapat diputar")).toBeVisible();
    expect(signedUrlRequests).toBe(1);

    await page.getByRole("button", { name: "Muat ulang video" }).click();
    await expect.poll(() => signedUrlRequests).toBe(2);
    await expect(page.locator("video source")).toHaveAttribute("src", /test-signed-token/);
    releaseVideoResponse();
  });
});