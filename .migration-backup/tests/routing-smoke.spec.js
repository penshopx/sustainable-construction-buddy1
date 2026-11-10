import { expect, test } from "@playwright/test";

const REACT_ROUTER_FUTURE_WARNING = /React Router (?:Future Flag Warning|will begin wrapping|future behavior)|relative route resolution within Splat routes/i;

function collectReactRouterFutureWarnings(page) {
  const warnings = [];

  page.on("console", (message) => {
    if (REACT_ROUTER_FUTURE_WARNING.test(message.text())) {
      warnings.push(`${message.type()}: ${message.text()}`);
    }
  });

  return warnings;
}

test("routing smoke covers public, alias, protected, and missing routes", async ({ page }) => {
  const futureWarnings = collectReactRouterFutureWarnings(page);

  await page.goto("/");
  await expect(page).toHaveTitle(/PUB ASPEKINDO/);
  await expect(
    page.getByRole("heading", { name: /Industri Konstruksi Berubah Cepat/ }),
  ).toBeVisible();

  await page.goto("/ai-helpdesk");
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByRole("heading", { name: "Masuk ke Akun" })).toBeVisible();

  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/auth$/);
  await expect(page.getByRole("heading", { name: "Masuk ke Akun" })).toBeVisible();

  await page.goto("/route-yang-tidak-tersedia");
  await expect(page).toHaveURL(/\/route-yang-tidak-tersedia$/);
  await expect(page.getByRole("heading", { name: "404" })).toBeVisible();
  await expect(page.getByText("Oops! Page not found")).toBeVisible();

  expect(
    futureWarnings,
    "React Router future-behavior warnings must stay absent across the routing smoke flow",
  ).toEqual([]);
});