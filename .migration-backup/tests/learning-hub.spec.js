import { expect, test } from "@playwright/test";
import { installSupabaseSession } from "./helpers/supabase-session.js";

async function installSession(page) {
  const user = {
    id: "00000000-0000-4000-8000-000000000040",
    aud: "authenticated",
    role: "authenticated",
    email: "learning-hub@example.test",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: "Learning Hub User" },
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

  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    await route.fulfill({
      status: 200,
      headers: { "content-range": "*/0" },
      contentType: "application/json",
      body: request.method() === "HEAD" ? "" : "[]",
    });
  });
}

test("authenticated users can move between the unified learning hub tabs @pr-auth", async ({ page }) => {
  await installSession(page);
  await page.goto("/courses");

  await expect(page).toHaveURL(/\/courses$/);
  await expect(page.getByRole("heading", { name: "Pusat Pembelajaran PUB" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "E-Course umum" })).toBeVisible();
  await expect(page.getByRole("tab", { name: "LMS ASPEKINDO" })).toBeVisible();

  await page.getByRole("tab", { name: "LMS ASPEKINDO" }).click();
  await expect(page).toHaveURL(/\/aspekindo-lms$/);
  await expect(page.getByRole("heading", { name: "Kegiatan & pembelajaran anggota" })).toBeVisible();

  await page.getByRole("tab", { name: "E-Course umum" }).click();
  await expect(page).toHaveURL(/\/courses$/);
  await expect(page.getByRole("heading", { name: "Pusat Pembelajaran PUB" })).toBeVisible();
});