import { expect, test } from "@playwright/test";
import { installSupabaseSession } from "./helpers/supabase-session.js";

const USER_ID = "00000000-0000-4000-8000-000000000081";
const PROFILE_ID = "00000000-0000-4000-8000-000000000082";

function reportFor(year) {
  return {
    id: `00000000-0000-4000-8000-${String(year).padStart(12, "0")}`,
    user_id: USER_ID,
    report_year: year,
    status: "draft",
    sbu_number: "",
    sbu_type: "baru",
    sbu_expiry_date: null,
    tkk_replacement: false,
    tkk_replacement_date: null,
    tkk_replacement_notes: "",
    equipment_commitment_fulfilled: false,
    equipment_fulfillment_date: null,
    smap_fulfilled: false,
    smap_report_date: null,
    experience_records_complete: false,
    experience_pending_list: "",
    asset_value_current: 0,
    asset_value_previous: 0,
    sales_value: 0,
    gross_profit: 0,
    current_assets: 0,
    short_term_liabilities: 0,
    total_liabilities: 0,
    total_equity: 0,
    gcg_applied: false,
    gcg_first_year: null,
    certifications: "",
    awards: "",
    smk3_applied: false,
    smk3_first_year: null,
    total_employees: 0,
    trained_employees: 0,
    contract_experts: 0,
    permanent_experts: 0,
    submitted_at: null,
    notes: "",
    created_at: "2026-09-02T00:00:00.000Z",
    updated_at: "2026-09-02T00:00:00.000Z",
  };
}

async function installSession(page) {
  const user = {
    id: USER_ID,
    aud: "authenticated",
    role: "authenticated",
    email: "lkut-create@example.test",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: "Penguji LKUT" },
    created_at: "2026-09-02T00:00:00.000Z",
  };

  await installSupabaseSession(page, {
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user,
  });

  await page.route("**/auth/v1/**", async (route) => {
    if (route.request().url().endsWith("/user")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });
}

async function installRestMocks(page, initialReports) {
  let reports = [...initialReports];
  let createdYear;

  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const table = requestUrl.pathname.split("/").pop();
    const isSingle = request.headers().accept?.includes("application/vnd.pgrst.object+json");

    if (table === "profiles") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: PROFILE_ID,
          user_id: USER_ID,
          full_name: "Penguji LKUT",
          company: "BUJK Uji",
          position: "PJT",
          current_level: "Pemula",
          total_score: 0,
          avatar_url: null,
          created_at: "2026-09-02T00:00:00.000Z",
          updated_at: "2026-09-02T00:00:00.000Z",
        }),
      });
      return;
    }

    if (table === "lkut_reports") {
      if (request.method() === "POST") {
        const payload = request.postDataJSON();
        createdYear = payload.report_year;
        const created = reportFor(createdYear);
        reports = [...reports, created];
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(isSingle ? created : [created]),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(reports),
      });
      return;
    }

    if (table === "lkut_documents") {
      await route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(isSingle ? null : []),
    });
  });

  return {
    getCreatedYear: () => createdYear,
  };
}

test("membuat LKUT menyediakan tahun 2022 sampai 2026", async ({ page }) => {
  await installSession(page);
  const mock = await installRestMocks(page, []);

  await page.goto("/lkut");
  await expect(page.getByRole("heading", { name: "Laporan Kegiatan Usaha Tahunan" })).toBeVisible();
  await page.getByRole("button", { name: /Buat LKUT/ }).first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await dialog.getByRole("combobox").click();
  for (const year of [2022, 2023, 2024, 2025, 2026]) {
    await expect(page.getByRole("option", { name: String(year), exact: true })).toBeVisible();
  }

  await page.getByRole("option", { name: "2026", exact: true }).click();
  await dialog.getByRole("button", { name: "Buat Laporan" }).click();
  await expect(page.getByRole("dialog", { name: /LKUT 2026 Draft/ })).toBeVisible();
  expect(mock.getCreatedYear()).toBe(2026);
});

test("pilihan tahun berpindah dari 2025 jika laporan N-1 sudah ada", async ({ page }) => {
  await installSession(page);
  const mock = await installRestMocks(page, [reportFor(2025)]);

  await page.goto("/lkut");
  await expect(page.getByText("LKUT 2025", { exact: true }).first()).toBeVisible();
  await page.getByRole("button", { name: /Buat LKUT/ }).first().click();

  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("combobox")).toHaveText("2026");
  await dialog.getByRole("button", { name: "Buat Laporan" }).click();
  await expect(page.getByRole("dialog", { name: /LKUT 2026 Draft/ })).toBeVisible();
  expect(mock.getCreatedYear()).toBe(2026);
});