import { test, expect } from "@playwright/test";
import { installSupabaseSession } from "./helpers/supabase-session.js";

async function installSession(page, { email, userId }) {
  const user = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email,
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: { full_name: email === "penshopx@gmail.com" ? "Super Admin" : "Admin Operasional" },
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

  return user;
}

test.describe("super admin access management @pr-auth", () => {
  test("super admin grants and revokes operational admin access", async ({ page }) => {
    const superAdminId = "00000000-0000-4000-8000-000000000030";
    const targetUserId = "00000000-0000-4000-8000-000000000031";
    const superAdmin = await installSession(page, { email: "penshopx@gmail.com", userId: superAdminId });
    let targetIsAdmin = false;
    const roleChanges = [];

    await page.route("**/rest/v1/**", async (route) => {
      const request = route.request();
      const requestUrl = new URL(request.url());
      const path = requestUrl.pathname;

      if (path.endsWith("/rpc/current_user_is_super_admin")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: "true" });
        return;
      }
      if (path.endsWith("/rpc/list_admin_directory")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify([
            {
              user_id: superAdminId,
              email: superAdmin.email,
              full_name: "Super Admin",
              company: "PUB ASPEKINDO",
              is_admin: false,
              is_super_admin: true,
            },
            {
              user_id: targetUserId,
              email: "operator@example.test",
              full_name: "Operator LMS",
              company: "BUJK Contoh",
              is_admin: targetIsAdmin,
              is_super_admin: false,
            },
          ]),
        });
        return;
      }
      if (path.endsWith("/rpc/grant_admin_role")) {
        targetIsAdmin = true;
        roleChanges.push({ action: "grant", body: request.postDataJSON() });
        await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
        return;
      }
      if (path.endsWith("/rpc/revoke_admin_role")) {
        targetIsAdmin = false;
        roleChanges.push({ action: "revoke", body: request.postDataJSON() });
        await route.fulfill({ status: 200, contentType: "application/json", body: "null" });
        return;
      }
      if (path.endsWith("/profiles") && requestUrl.searchParams.has("user_id")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "00000000-0000-4000-8000-000000000032",
            user_id: superAdminId,
            full_name: "Super Admin",
            company: "PUB ASPEKINDO",
            position: "Direktur",
            current_level: "Utama",
            total_score: 100,
            avatar_url: null,
            created_at: "2026-08-31T00:00:00.000Z",
            updated_at: "2026-08-31T00:00:00.000Z",
          }),
        });
        return;
      }
      if (path.endsWith("/user_roles")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ role: "super_admin" }]) });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: { "content-range": "*/0" },
        contentType: "application/json",
        body: request.method() === "HEAD" ? "" : "[]",
      });
    });

    await page.goto("/admin/akses");

    await expect(page.getByRole("heading", { name: "Kelola Akses Admin" })).toBeVisible();
    await expect(page.getByText("penshopx@gmail.com").first()).toBeVisible();
    await expect(page.getByText("Akses permanen")).toBeVisible();

    await page.getByRole("button", { name: "Jadikan admin" }).click();
    await expect(page.getByRole("alertdialog")).toContainText("operator@example.test");
    await page.getByRole("button", { name: "Berikan akses", exact: true }).click();
    await expect(page.getByText("Admin Operasional").last()).toBeVisible();

    await page.getByRole("button", { name: "Cabut akses" }).click();
    await page.getByRole("button", { name: "Cabut akses", exact: true }).last().click();
    await expect(page.getByRole("button", { name: "Jadikan admin" })).toBeVisible();

    expect(roleChanges).toEqual([
      { action: "grant", body: { _target_user: targetUserId } },
      { action: "revoke", body: { _target_user: targetUserId } },
    ]);
  });

  test("operational admin cannot open super admin role management", async ({ page }) => {
    const adminId = "00000000-0000-4000-8000-000000000033";
    await installSession(page, { email: "admin@example.test", userId: adminId });

    await page.route("**/rest/v1/**", async (route) => {
      const request = route.request();
      const requestUrl = new URL(request.url());
      const path = requestUrl.pathname;

      if (path.endsWith("/rpc/current_user_is_super_admin")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: "false" });
        return;
      }
      if (path.endsWith("/profiles") && requestUrl.searchParams.has("user_id")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "00000000-0000-4000-8000-000000000034",
            user_id: adminId,
            full_name: "Admin Operasional",
            company: "BUJK Contoh",
            position: "Admin",
            current_level: "Pemula",
            total_score: 0,
            avatar_url: null,
            created_at: "2026-08-31T00:00:00.000Z",
            updated_at: "2026-08-31T00:00:00.000Z",
          }),
        });
        return;
      }
      if (path.endsWith("/user_roles")) {
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ role: "admin" }]) });
        return;
      }
      await route.fulfill({
        status: 200,
        headers: { "content-range": "*/0" },
        contentType: "application/json",
        body: request.method() === "HEAD" ? "" : "[]",
      });
    });

    await page.goto("/admin/akses");
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "Kelola Akses Admin" })).not.toBeVisible();
  });
});