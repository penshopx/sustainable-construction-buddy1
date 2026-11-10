import { expect, test } from "@playwright/test";

test("LKUT floating chatbot exposes Kepdirjen 281 references", async ({ page }) => {
  await page.goto("/");

  await page.getByTitle("Chatbot LKUT-PUB-LSBUKI").click();
  await expect(page.getByTestId("lkut-app-link")).toBeVisible();
  await expect(page.getByTestId("pub-app-link")).toContainText("Login ke dashboard LMS.");
  await expect(page.getByTestId("pub-app-link")).toHaveAttribute("href", "https://lms.dokumenproyek.com");
  await expect(page.getByTestId("pub-app-link")).toHaveAttribute("target", "_blank");
  await expect(page.getByTestId("pub-app-link")).toHaveAttribute("rel", "noopener noreferrer");
  await expect(page.getByTestId("lsbuki-app-link")).toHaveAttribute("href", "https://lsbukonstruksi.co.id");
  await expect(page.getByTestId("lsbuki-app-link")).toHaveAttribute("target", "_blank");
  await expect(page.getByTestId("lsbuki-app-link")).toHaveAttribute("rel", "noopener noreferrer");
  const referencesButton = page.getByRole("button", {
    name: /Pahami rujukan/,
  });
  await expect(referencesButton).toBeVisible();
  await referencesButton.click();

  await expect(page.getByText("Rujukan chatbot", { exact: true })).toBeVisible();
  await expect(page.getByText("Kepdirjen BK No. 281/KPTS/DK/2026", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Apa itu Kepdirjen Bina Konstruksi Nomor 281/KPTS/DK/2026?", { exact: true }),
  ).toBeVisible();

  await page.getByText("Apa itu Kepdirjen Bina Konstruksi Nomor 281/KPTS/DK/2026?", { exact: true }).click();
  await expect(page.getByText(/Keputusan Direktur Jenderal Bina Konstruksi Nomor 281\/KPTS\/DK\/2026 tanggal 26 Agustus 2026/)).toBeVisible();
});