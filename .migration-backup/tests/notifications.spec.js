import { test, expect } from "@playwright/test";
import { installSupabaseSession } from "./helpers/supabase-session.js";

test("refresh dan fetch realtime yang berisi id sama hanya merender satu notifikasi per permukaan", async ({ page }) => {
  const userId = "00000000-0000-4000-8000-000000000071";
  const user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: "notification-test@example.test",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: "Penguji Notifikasi" },
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

  const insightNotification = {
    id: "00000000-0000-4000-8000-000000000072",
    user_id: userId,
    type: "competency_insight_fallback",
    title: "Insight kompetensi perlu diperiksa",
    message: "Fallback deterministik aktif.",
    is_read: false,
    created_at: "2026-09-02T02:00:00.000Z",
    competency_insight_incident_id: "00000000-0000-4000-8000-000000000073",
  };
  const generalNotification = {
    ...insightNotification,
    id: "00000000-0000-4000-8000-000000000074",
    type: "info",
    title: "Informasi akun",
    message: "Profil Anda berhasil diperbarui.",
    created_at: "2026-09-02T01:00:00.000Z",
    competency_insight_incident_id: null,
  };

  await page.route("**/auth/v1/**", async (route) => {
    if (route.request().url().endsWith("/user")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(user) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: "{}" });
  });

  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const requestUrl = new URL(request.url());
    const path = requestUrl.pathname;

    if (path.endsWith("/profiles") && requestUrl.searchParams.has("user_id")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "00000000-0000-4000-8000-000000000075",
          user_id: userId,
          full_name: "Penguji Notifikasi",
          company: "BUJK Test",
          position: "Admin",
          current_level: "Pemula",
          total_score: 0,
          avatar_url: null,
          created_at: "2026-09-02T00:00:00.000Z",
          updated_at: "2026-09-02T00:00:00.000Z",
        }),
      });
      return;
    }
    if (path.endsWith("/user_roles")) {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ role: "admin" }]) });
      return;
    }
    if (path.endsWith("/notifications")) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: request.method() === "GET"
          ? JSON.stringify([insightNotification, insightNotification, generalNotification, generalNotification])
          : "[]",
      });
      return;
    }
    await route.fulfill({
      status: 200,
      headers: { "content-range": "*/0" },
      contentType: "application/json",
      body: request.method() === "HEAD" ? "" : "[]",
    });
  });

  await page.goto("/notifications");

  await expect(page.getByRole("heading", { name: "Notifikasi" })).toBeVisible();
  await expect(page.getByText("Insight kompetensi perlu diperiksa", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Informasi akun", { exact: true })).toHaveCount(1);
  await expect(page.getByText("2 belum dibaca", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Buka notifikasi" }).click();
  const popover = page.locator("[data-radix-popper-content-wrapper]");
  await expect(popover.getByText("Insight kompetensi perlu diperiksa", { exact: true })).toHaveCount(1);
  await expect(popover.getByText("Informasi akun", { exact: true })).toHaveCount(1);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Notifikasi" })).toBeVisible();
  await expect(page.getByText("Insight kompetensi perlu diperiksa", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Informasi akun", { exact: true })).toHaveCount(1);
});