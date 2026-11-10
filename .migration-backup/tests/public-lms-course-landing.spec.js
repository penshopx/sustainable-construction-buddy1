import { expect, test } from "@playwright/test";

const courseId = "00000000-0000-4000-8000-000000000951";
const courseSlug = "kelas-pengelolaan-kontrak";

test("public course landing renders approved metadata without lesson or video leakage", async ({ page }) => {
  await page.route("**/rest/v1/rpc/get_public_aspekindo_lms_course", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{
        id: courseId,
        course_code: "ASPEKINDO-LMS-PUB-01",
        slug: courseSlug,
        title: "Kelas Pengelolaan Kontrak",
        description_markdown: "Kursus untuk **manajer BUJK** yang ingin menata pengelolaan kontrak.",
        audience: "Manajer BUJK",
        member_only: true,
        siap_focus: "proyek",
        published_at: "2026-09-01T00:00:00.000Z",
        public_landing_enabled: true,
      }]),
    });
  });

  await page.goto(`/kursus/${courseSlug}`);
  await expect(page.getByRole("heading", { name: "Kelas Pengelolaan Kontrak" })).toBeVisible();
  await expect(page.getByText("Untuk Manajer BUJK", { exact: true })).toBeVisible();
  await expect(page.getByText("SIAP Proyek")).toBeVisible();
  await expect(page.getByText("Materi lengkap, video, kuis, dan progres hanya tersedia di ruang belajar yang dilindungi.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Masuk untuk mendaftar" })).toHaveAttribute(
    "href",
    `/auth?next=${encodeURIComponent(`/aspekindo-lms/kursus/${courseId}`)}`,
  );

  const html = await page.locator("body").innerHTML();
  expect(html).not.toContain("storage_path");
  expect(html).not.toContain("lesson-body");
  expect(html).not.toContain(".mp4");
  expect(html).not.toContain(".webm");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});