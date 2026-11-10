import { expect, test } from "@playwright/test";
import { installSupabaseSession } from "./helpers/supabase-session.js";
const USER_ID = "00000000-0000-4000-8000-000000000061";
const MEMBER_ID = "00000000-0000-4000-8000-000000000062";

async function installSession(page) {
  const user = {
    id: USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: "siap-map@example.test",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: "Anggota SIAP" },
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

  await installSupabaseSession(page, session);

  await page.route("**/auth/v1/**", async (route) => {
    if (route.request().url().endsWith("/user")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

test("member can inspect an explainable 4 SIAP map without cross-member queries @pr-auth", async ({ page }) => {
  await installSession(page);
  const userOwnedRequests = [];
  const obligationRequests = [];
  let insightRequestBody;

  await page.route("**/functions/v1/competency-insight", async (route) => {
    insightRequestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        source: "connected",
        recommendations: [{
          text: "Tinjau kesiapan tim menggunakan assessment dan scoring 4 Pilar.",
          href: "/analytics",
          label: "Buka Analytics",
        }],
        generatedAt: "2026-09-01T00:00:00.000Z",
      }),
    });
  });

  await page.route("**/rest/v1/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const table = requestUrl.pathname.split("/").pop();
    const isSingle = route.request().headers().accept?.includes("application/vnd.pgrst.object+json");
    let body = [];

    if (table === "profiles") {
      body = {
        id: "00000000-0000-4000-8000-000000000063",
        user_id: USER_ID,
        full_name: "Anggota SIAP",
        company: "BUJK Uji",
        position: "PJT",
        current_level: "Muda",
        total_score: 72,
        bujk_qualification: "Menengah",
        avatar_url: null,
        created_at: "2026-08-31T00:00:00.000Z",
        updated_at: "2026-08-31T00:00:00.000Z",
      };
    } else if (table === "aspekindo_members") {
      body = {
        id: MEMBER_ID,
        membership_status: "active",
        membership_number: "KTA-TEST-001",
        expires_at: "2027-08-31",
      };
    } else if (table === "aspekindo_member_obligations") {
      obligationRequests.push(requestUrl);
      body = [{
        id: "00000000-0000-4000-8000-000000000064",
        title: "Validasi legalitas tahunan",
        siap_focus: "legalitas",
        status: "fulfilled",
        fulfilled_at: "2026-08-20T00:00:00.000Z",
      }];
    } else if (table === "aspekindo_pub_activities") {
      body = [{
        id: "00000000-0000-4000-8000-000000000065",
        title: "Klinik Legalitas BUJK",
        siap_focus: "legalitas",
      }];
    } else if (table === "aspekindo_activity_enrollments") {
      body = [{
        activity_id: "00000000-0000-4000-8000-000000000065",
        status: "completed",
        completed_at: "2026-08-20T00:00:00.000Z",
      }];
    } else if (table === "aspekindo_activity_evidence") {
      body = [{
        id: "00000000-0000-4000-8000-000000000066",
        activity_id: "00000000-0000-4000-8000-000000000065",
        title: "Bukti Klinik Legalitas",
        issued_at: "2026-08-20T00:00:00.000Z",
      }];
    } else if (table === "module_progress") {
      body = [{
        status: "completed",
        progress_percent: 100,
        e_course_modules: {
          title: "Dasar Pengadaan",
          competency_domains: { name: "Pengadaan & Kontrak" },
        },
      }];
    } else if (table === "certificates") {
      body = [{
        id: "00000000-0000-4000-8000-000000000067",
        module_name: "Dasar Pengadaan",
        level: "Muda",
        issued_at: "2026-08-21T00:00:00.000Z",
      }];
    } else if (table === "pancek_assessments") {
      body = {
        company_name: "BUJK Uji",
        nib: "1234567890",
        npwp: "00.000.000.0-000.000",
        completion_percent: 100,
        status: "verified",
        period_year: 2026,
      };
    } else if (table === "lkut_reports") {
      body = {
        report_year: 2026,
        status: "submitted",
        submitted_at: "2026-08-22T00:00:00.000Z",
        kta_number: "KTA-TEST-001",
        kta_expiry_date: "2027-08-31",
        sbu_number: "SBU-TEST-001",
        sbu_expiry_date: "2027-08-31",
        experience_records_complete: true,
        experience_pending_list: "",
      };
    } else if (table === "smap_documents") {
      body = [{
        id: "00000000-0000-4000-8000-000000000068",
        doc_type: "sertifikat_iso",
        status: "verified",
        verified_at: "2026-08-23T00:00:00.000Z",
      }];
    } else if (table === "projects") {
      body = [{
        id: "00000000-0000-4000-8000-000000000069",
        status: "active",
        contract_type: "Lump Sum",
        complexity_score: 80,
      }];
    } else if (table === "lkut_project_data") {
      body = [{ id: "00000000-0000-4000-8000-000000000073" }];
    } else if (table === "pre_tests") {
      body = {
        score: 68,
        determined_level: "Berkembang",
        completed_at: "2026-08-24T00:00:00.000Z",
      };
    } else if (table === "competency_scores") {
      body = {
        total_score: 72,
        learning_points: 70,
        toolkit_points: 75,
        project_points: 72,
        contribution_points: 71,
        computed_at: "2026-08-25T00:00:00.000Z",
      };
    } else if (table === "aspekindo_lms_courses") {
      body = [{ id: "course-1", title: "Tender Dasar" }];
    } else if (table === "aspekindo_lms_enrollments") {
      body = [{ course_id: "course-1", status: "completed" }];
    } else if (table === "aspekindo_lms_lesson_progress") {
      body = [{ status: "completed" }];
    } else if (table === "aspekindo_lms_quiz_attempts") {
      body = [{ passed: true }];
    } else if (table === "aspekindo_lms_completion_records") {
      body = [{ id: "completion-1" }];
    } else if (["risk_registers", "budget_entries", "k3_checklists"].includes(table)) {
      body = [{ id: `00000000-0000-4000-8000-0000000000${table === "risk_registers" ? "70" : table === "budget_entries" ? "71" : "72"}` }];
    }

    if ([
      "aspekindo_members",
      "aspekindo_activity_enrollments",
      "aspekindo_activity_evidence",
      "module_progress",
      "certificates",
      "pancek_assessments",
      "lkut_reports",
      "smap_documents",
      "projects",
      "lkut_project_data",
      "pre_tests",
      "competency_scores",
      "aspekindo_lms_enrollments",
      "aspekindo_lms_lesson_progress",
      "aspekindo_lms_quiz_attempts",
      "aspekindo_lms_completion_records",
      "risk_registers",
      "budget_entries",
      "k3_checklists",
    ].includes(table)) {
      userOwnedRequests.push(requestUrl);
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(isSingle && Array.isArray(body) ? (body[0] ?? null) : body),
    });
  });

  await page.goto("/siap-kompetensi");

  await expect(page.getByRole("heading", { name: "Peta kesiapan usaha" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "SIAP Legalitas" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "SIAP Sertifikasi" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "SIAP Tender" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "SIAP Proyek" })).toBeVisible();
  await expect(page.getByText("bukan keputusan sertifikasi resmi")).toBeVisible();
  await expect(page.getByText("KTA, SBU, dan LKUT")).toBeVisible();
  await expect(page.getByText("Rekam kontrak proyek")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rekomendasi prioritas" })).toBeVisible();
  await expect(page.getByText("Dirangkum dari konteks minimum yang tersedia.")).toBeVisible();
  await expect(page.getByText(/Gustafta/i)).toHaveCount(0);

  expect(userOwnedRequests.length).toBeGreaterThan(0);
  expect(userOwnedRequests.every((url) => url.searchParams.get("user_id") === `eq.${USER_ID}`)).toBe(true);
  expect(obligationRequests).toHaveLength(1);
  expect(obligationRequests[0].searchParams.get("member_id")).toBe(`eq.${MEMBER_ID}`);
  expect(insightRequestBody).toEqual({});
});

test("recorded zero assessment remains evidence instead of becoming no data", async ({ page }) => {
  await installSession(page);

  await page.route("**/functions/v1/competency-insight", async (route) => {
    await route.fulfill({
      status: 504,
      contentType: "application/json",
      body: JSON.stringify({ error: "Insight timeout" }),
    });
  });
  await page.route("**/rest/v1/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const table = requestUrl.pathname.split("/").pop();
    const isSingle = route.request().headers().accept?.includes("application/vnd.pgrst.object+json");
    let body = [];
    if (table === "pre_tests") {
      body = { score: 0, determined_level: "Pemula", completed_at: "2026-09-01T00:00:00.000Z" };
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(isSingle && Array.isArray(body) ? (body[0] ?? null) : body),
    });
  });

  await page.goto("/siap-kompetensi");
  await expect(page.getByText("Assessment terakhir 0% pada level Pemula.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "SIAP Sertifikasi" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Rekomendasi prioritas" })).toBeVisible();
  await expect(page.getByText("Dirangkum dengan aturan deterministik dari gap yang tersedia.")).toBeVisible();
});
