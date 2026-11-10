import { expect, test } from "@playwright/test";
import { installSupabaseSession } from "./helpers/supabase-session.js";
import { revealLandingSection } from "./helpers/landing-readiness.js";

test.describe("public and unauthenticated user flows", () => {
  test("loads the public landing page and opens authentication", async ({ page }) => {
    await page.goto("/");
    const joinCta = page
      .getByRole("button", {
        name: "Bergabung & Jadilah Kontraktor Berdaya Saing",
        exact: true,
      })
      .first();

    await expect(page).toHaveTitle(/PUB ASPEKINDO/);
    await expect(
      page.getByRole("heading", {
        name: /Industri Konstruksi Berubah Cepat/,
      }),
    ).toBeVisible();
    await expect(joinCta).toBeVisible();
    await expect(
      page.getByText("Kep Dirjen PU No. 281 Tahun 2026", { exact: true }),
    ).toBeVisible();

    await joinCta.click();

    await expect(page).toHaveURL(/\/auth$/);
    await expect(
      page.getByRole("heading", { name: "Masuk ke Akun" }),
    ).toBeVisible();
  });

  test("connects 4 SIAP readiness to project services with guarded tender access", async ({ page }) => {
    await page.goto("/");

    await revealLandingSection(page, page.getByTestId("section-project-ecosystem"));
    await expect(page.getByTestId("section-project-ecosystem")).toBeVisible();
    await expect(page.getByTestId("text-project-ecosystem-heading")).toContainText("4 SIAP bukan garis akhir");
    await expect(page.getByTestId("list-readiness-tracks")).toContainText("Siap Legalitas");
    await expect(page.getByTestId("list-readiness-tracks")).toContainText("Siap Sertifikasi");
    await expect(page.getByTestId("list-readiness-tracks")).toContainText("Siap Tender");
    await expect(page.getByTestId("list-readiness-tracks")).toContainText("Siap Proyek");

    const externalLinks = [
      ["link-project-management-system", "https://sistem-manajemen-proyek-konstruksi.replit.app/"],
      ["link-project-work", "https://tukanghub.dokumenproyek.com"],
      ["link-design-build", "https://rancang.dokumenproyek.com"],
    ];
    for (const [testId, href] of externalLinks) {
      const link = page.getByTestId(testId);
      await expect(link).toHaveAttribute("href", href);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }

    await expect(page.getByTestId("link-tender-readiness-map")).toHaveAttribute("href", "/siap-kompetensi");
    await expect(page.getByTestId("text-tender-login-required")).toContainText("masuk diperlukan");
    await revealLandingSection(page, page.locator("#siap-pub"));
    await expect(page.getByTestId("link-lkpm-legalitas")).toHaveAttribute(
      "href",
      "https://lkpm.dokumenproyek.com/",
    );
    await expect(page.getByTestId("link-lkpm-legalitas")).toHaveAttribute("target", "_blank");
    await expect(page.getByTestId("link-lkpm-legalitas")).toHaveAttribute(
      "rel",
      "noopener noreferrer",
    );
    await page.getByTestId("link-tender-readiness-map").click();
    await expect(page).toHaveURL(/\/auth$/);
  });

  test("connects quality, LKUT, anti-bribery, and legal services", async ({ page }) => {
    await page.goto("/");

    await revealLandingSection(page, page.getByTestId("section-quality-governance"));
    await expect(page.getByTestId("section-quality-governance")).toBeVisible();
    await expect(page.getByTestId("text-quality-governance-narrative")).toContainText("PUB ASPEKINDO berkomitmen");
    await expect(page.getByTestId("text-quality-governance-narrative")).toContainText("Rujukan ISO");
    await expect(page.getByTestId("text-quality-governance-narrative")).toContainText("ISO bukan klaim sertifikasi otomatis");

    const externalLinks = [
      ["link-lkut-annual-report", "https://konstruksi-laporan-tahunan.replit.app/landing-page/"],
      ["link-iso-quality-standards", "https://iso.dokumenproyek.com"],
      ["link-anti-bribery-compliance", "https://smap.dokumenproyek.com"],
      ["link-legal-compliance-session", "https://lexcom.dokumenproyek.com/"],
    ];
    for (const [testId, href] of externalLinks) {
      const link = page.getByTestId(testId);
      await expect(link).toHaveAttribute("href", href);
      await expect(link).toHaveAttribute("target", "_blank");
      await expect(link).toHaveAttribute("rel", "noopener noreferrer");
    }

    await expect(page.getByTestId("link-anti-bribery-compliance")).toContainText("Kepatuhan Anti Penyuapan");
    await expect(page.getByTestId("link-legal-compliance-session")).toContainText("Sesi Hukum");
    await expect(page.getByTestId("link-lkut-annual-report")).toContainText("Laporan Kegiatan Usaha Tahunan");
  });

  test("shows confirmation success after the email redirect", async ({ page }) => {
    await page.goto("/auth?confirmed=1");

    await expect(page).toHaveURL(/\/auth\?confirmed=1$/);
    await expect(
      page.getByRole("status"),
    ).toContainText("Email berhasil dikonfirmasi. Silakan masuk untuk melanjutkan.");
  });

  test("redirects an empty dashboard session to a usable auth state", async ({ page }) => {
    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/auth$/);
    await expect(
      page.getByRole("heading", { name: "Masuk ke Akun" }),
    ).toBeVisible();
    await expect(page.getByPlaceholder("email@perusahaan.com")).toBeVisible();
    await expect(page.getByPlaceholder("Minimal 6 karakter")).toBeVisible();
    await expect(page.locator('input[type="email"]')).toHaveAttribute("autocomplete", "username");
    await expect(page.locator('input[type="password"]')).toHaveAttribute("autocomplete", "current-password");

    await page.getByRole("button", { name: "Lupa password?" }).click();

    await expect(
      page.getByRole("heading", { name: "Lupa Password" }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Kirim Link Reset" }),
    ).toBeVisible();
    await expect(page.locator('input[type="email"]')).toHaveAttribute("autocomplete", "email");

    await page.getByRole("button", { name: "Kembali ke login" }).click();
    await expect(
      page.getByRole("heading", { name: "Masuk ke Akun" }),
    ).toBeVisible();

    await page.getByRole("button", { name: "Daftar sekarang" }).click();
    await expect(
      page.getByRole("heading", { name: "Daftar Akun Baru" }),
    ).toBeVisible();
    await expect(page.locator('input[type="text"]')).toHaveAttribute("autocomplete", "name");
    await expect(page.locator('input[type="email"]')).toHaveAttribute("autocomplete", "username");
    await expect(page.locator('input[type="password"]')).toHaveAttribute("autocomplete", "new-password");
  });

  test("uses new-password autocomplete tokens when setting a reset password", async ({ page }) => {
    await page.goto("/reset-password#type=recovery");

    await expect(
      page.getByRole("heading", { name: "Atur Password Baru" }),
    ).toBeVisible();

    await expect(page.locator('input[autocomplete="username"]')).toHaveCount(1);
    const passwordInputs = page.locator('input[type="password"]');
    await expect(passwordInputs).toHaveCount(2);
    await expect(passwordInputs.nth(0)).toHaveAttribute("autocomplete", "new-password");
    await expect(passwordInputs.nth(1)).toHaveAttribute("autocomplete", "new-password");
  });

  test("renders a safe dashboard for a new user without operational data", async ({ page }) => {
    const userId = "00000000-0000-4000-8000-000000000010";
    const fakeUser = {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      email: "new-user-without-data@example.test",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      created_at: "2026-08-25T00:00:00.000Z",
    };
    const fakeSession = {
      access_token: "test-access-token",
      refresh_token: "test-refresh-token",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: fakeUser,
    };

    await installSupabaseSession(page, fakeSession);

    await page.route("**/auth/v1/**", async (route) => {
      const requestUrl = route.request().url();
      if (requestUrl.endsWith("/user")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(fakeUser),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    await page.route("**/rest/v1/**", async (route) => {
      const requestUrl = new URL(route.request().url());
      const table = requestUrl.pathname.split("/").pop();

      if (table === "profiles" && requestUrl.searchParams.has("user_id")) {
        await route.fulfill({
          status: 406,
          contentType: "application/json",
          body: JSON.stringify({
            code: "PGRST116",
            message: "JSON object requested, multiple (or no) rows returned",
            details: "The result contains 0 rows",
            hint: null,
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: { "content-range": "*/0" },
        contentType: "application/json",
        body: route.request().method() === "HEAD" ? "" : "[]",
      });
    });

    const pageErrors = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));

    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { name: "User" })).toBeVisible();
    await expect(page.getByText("Pilih Jabatan Anda")).toBeVisible();
    await expect(page.getByRole("button", { name: /Proyek Aktif/ }).first()).toContainText("0");
    await expect(page.getByRole("button", { name: /Modul Selesai/ }).first()).toContainText("0/0");
    await expect(page.getByRole("button", { name: /Risk Register/ }).first()).toContainText("0");
    await expect(page.getByRole("button", { name: /Budget Warning/ }).first()).toContainText("0");
    await expect(page.getByText("Belum ada progres domain")).toBeVisible();
    await expect(page.getByText("Belum ada asesmen")).toBeVisible();
    await expect(page.getByText("Belum ada laporan")).toBeVisible();
    await expect(page.getByText("0 produk")).toBeVisible();
    await expect(page.getByText("0 order")).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test("lets a user without a profile save a dashboard role", async ({ page }) => {
    const userId = "00000000-0000-4000-8000-000000000011";
    const fakeUser = {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      email: "role-recovery-user@example.test",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      created_at: "2026-08-25T00:00:00.000Z",
    };
    const fakeSession = {
      access_token: "test-access-token",
      refresh_token: "test-refresh-token",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: fakeUser,
    };

    await installSupabaseSession(page, fakeSession);

    await page.route("**/auth/v1/**", async (route) => {
      const requestUrl = route.request().url();
      if (requestUrl.endsWith("/user")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(fakeUser),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    let savedProfile = null;
    let profileSaveRequest = null;
    await page.route("**/rest/v1/**", async (route) => {
      const request = route.request();
      const requestUrl = new URL(request.url());
      const table = requestUrl.pathname.split("/").pop();

      if (table === "profiles" && request.method() === "POST") {
        const body = request.postDataJSON();
        const profileData = Array.isArray(body) ? body[0] : body;
        savedProfile = {
          avatar_url: null,
          bujk_qualification: "menengah",
          company: "",
          created_at: "2026-08-25T00:00:00.000Z",
          current_level: "Pemula",
          full_name: "",
          id: "00000000-0000-4000-8000-000000000012",
          position: profileData.position,
          total_score: 0,
          updated_at: "2026-08-25T00:00:00.000Z",
          user_id: profileData.user_id,
        };
        profileSaveRequest = profileData;
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(savedProfile),
        });
        return;
      }

      if (table === "profiles" && requestUrl.searchParams.has("user_id")) {
        if (savedProfile) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(savedProfile),
          });
          return;
        }

        await route.fulfill({
          status: 406,
          contentType: "application/json",
          body: JSON.stringify({
            code: "PGRST116",
            message: "JSON object requested, multiple (or no) rows returned",
            details: "The result contains 0 rows",
            hint: null,
          }),
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

    await page.goto("/dashboard");

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText("Pilih Jabatan Anda")).toBeVisible();

    await page.getByRole("button", { name: "PJT", exact: true }).click();

    await expect(page.getByText("Jabatan berhasil disimpan!")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Dashboard PJT" }),
    ).toBeVisible();
    await expect(page.getByText("Pilih Jabatan Anda")).not.toBeVisible();
    expect(profileSaveRequest).toEqual({
      user_id: userId,
      position: "Penanggung Jawab Teknik (PJT)",
    });
    expect(savedProfile.position).toBe("Penanggung Jawab Teknik (PJT)");
  });

  test("lets a user without a profile save all profile details", async ({ page }) => {
    const userId = "00000000-0000-4000-8000-000000000013";
    const fakeUser = {
      id: userId,
      aud: "authenticated",
      role: "authenticated",
      email: "profile-recovery-user@example.test",
      app_metadata: { provider: "email", providers: ["email"] },
      user_metadata: {},
      created_at: "2026-08-25T00:00:00.000Z",
    };
    const fakeSession = {
      access_token: "test-access-token",
      refresh_token: "test-refresh-token",
      token_type: "bearer",
      expires_in: 3600,
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      user: fakeUser,
    };

    await installSupabaseSession(page, fakeSession);

    await page.route("**/auth/v1/**", async (route) => {
      const requestUrl = route.request().url();
      if (requestUrl.endsWith("/user")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(fakeUser),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    });

    const accessibilityConsoleMessages = [];
    page.on("console", (message) => {
      if (/accessib|form field|label.*control|autocomplete|aria-/i.test(message.text())) {
        accessibilityConsoleMessages.push(message.text());
      }
    });

    let savedProfile = null;
    let profileSaveRequest = null;
    await page.route("**/rest/v1/**", async (route) => {
      const request = route.request();
      const requestUrl = new URL(request.url());
      const table = requestUrl.pathname.split("/").pop();

      if (table === "profiles" && request.method() === "POST") {
        const body = request.postDataJSON();
        const profileData = Array.isArray(body) ? body[0] : body;
        profileSaveRequest = profileData;
        savedProfile = {
          avatar_url: null,
          bujk_qualification: "menengah",
          company: "",
          created_at: "2026-08-25T00:00:00.000Z",
          current_level: "Pemula",
          full_name: "",
          id: "00000000-0000-4000-8000-000000000013",
          position: "",
          total_score: 0,
          updated_at: "2026-08-25T00:00:00.000Z",
          user_id: userId,
          ...profileData,
        };
        await route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify(savedProfile),
        });
        return;
      }

      if (table === "profiles" && requestUrl.searchParams.has("user_id")) {
        if (savedProfile) {
          await route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(savedProfile),
          });
          return;
        }

        await route.fulfill({
          status: 406,
          contentType: "application/json",
          body: JSON.stringify({
            code: "PGRST116",
            message: "JSON object requested, multiple (or no) rows returned",
            details: "The result contains 0 rows",
            hint: null,
          }),
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

    await page.goto("/profile");

    const fullNameInput = page.getByLabel("Nama Lengkap", { exact: true });
    const companyInput = page.getByLabel("Perusahaan", { exact: true });
    const qualificationSelect = page.getByRole("combobox", { name: "Kualifikasi BUJK", exact: true });
    const positionSelect = page.getByRole("combobox", { name: "Jabatan Personil Manajerial", exact: true });

    await expect(fullNameInput).toHaveAttribute("autocomplete", "name");
    await expect(companyInput).toHaveAttribute("autocomplete", "organization");
    await expect(qualificationSelect).toHaveAttribute("id", "profile-bujk-qualification");
    await expect(positionSelect).toHaveAttribute("id", "profile-position");
    await expect(page.locator('select[name="bujkQualification"]')).toHaveAttribute("autocomplete", "off");
    await expect(page.locator('select[name="position"]')).toHaveAttribute("autocomplete", "organization-title");

    await fullNameInput.fill("Siti Rahma");
    await companyInput.fill("PT Nusantara Konstruksi");

    await qualificationSelect.click();
    await page.getByRole("option", { name: "Besar" }).click();
    await positionSelect.click();
    await page.getByRole("option", { name: "Penanggung Jawab Teknik (PJT)" }).click();

    await page.getByRole("button", { name: "Simpan Profil" }).click();

    await expect(page.getByText("Profil berhasil disimpan!")).toBeVisible();
    expect(profileSaveRequest).toEqual({
      user_id: userId,
      full_name: "Siti Rahma",
      company: "PT Nusantara Konstruksi",
      position: "Penanggung Jawab Teknik (PJT)",
      bujk_qualification: "besar",
    });
    expect(savedProfile).toMatchObject(profileSaveRequest);
    expect(accessibilityConsoleMessages).toEqual([]);
  });
});