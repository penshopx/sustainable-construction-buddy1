import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

const fixture = JSON.parse(await readFile(process.env.BEDAH_BROWSER_MANIFEST, "utf8"));
const ROOT = "/api/ruang-simpan";
const SUMMARY = "BEDAH-PRIVATE-SUMMARY";
const ANSWER = "BEDAH-PRIVATE-ANSWER";
const text = "Kontrak sintetis privat.\nMasa pelaksanaan 90 hari.\nBukan dokumen pengguna.";

async function signIn(page, role) {
  const account = fixture.accounts[role];
  // Actual application SDK -> actual GoTrue password endpoint. No fixture Auth
  // events, invented JWTs, localStorage injection or route.fulfill.
  await page.evaluate(async ({ email, password }) => {
    const supabase = window.__bedahSdk;
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error("Disposable account sign-in failed");
  }, account);
  await expect.poll(() => page.evaluate(async () => {
    const supabase = window.__bedahSdk;
    return (await supabase.auth.getUser()).data.user?.id;
  })).toBe(account.id);
}
async function authHeaders(page) {
  await page.waitForFunction(() => !!window.__bedahSdk);
  return page.evaluate(async () => {
    const supabase = window.__bedahSdk;
    const { data } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${data.session.access_token}` };
  });
}
async function consent(page) {
  await page.getByTestId("checkbox-ai-consent").click();
}
async function privateAbsent(page) {
  await expect(page.getByTestId("card-analysis")).toHaveCount(0);
  await expect(page.getByText(new RegExp(`${SUMMARY}|${ANSWER}`))).toHaveCount(0);
  await expect(page.getByTestId("input-chat")).toHaveCount(0);
  await expect(page.getByTestId("button-download-md")).toHaveCount(0);
}
async function control(request, command) {
  const response = await request.post(`${fixture.apiUrl}/__test/${command}`);
  expect(response.status()).toBe(204);
}

test(process.env.BEDAH_UPLOAD_CHECK === "1"
  ? "targeted real PUB Auth login and upload refresh only"
  : "real PUB Auth isolates upload, persisted analysis/chat, account-switch races, admin and deleted sources", async ({ page, request }) => {
  const apiStatuses = [];
  page.on("response", response => {
    const url = new URL(response.url());
    if (url.pathname.startsWith(ROOT)) apiStatuses.push(`${response.request().method()} ${url.pathname}: ${response.status()}`);
  });
  // Fail any accidental request to hosted Auth, App Storage or OpenRouter.
  const escaped = [];
  await page.context().route("**/*", route => {
    const host = new URL(route.request().url()).hostname;
    if (!["127.0.0.1", "localhost"].includes(host)) {
      escaped.push(host);
      return route.abort();
    }
    return route.continue();
  });
  await page.goto(`${fixture.baseUrl}/bedah-dokumen`);
  await expect(page.getByTestId("link-intro-login")).toBeVisible();
  // First login uses the unmodified PUB sign-in form.
  await page.getByTestId("link-intro-login").click();
  await page.locator('input[type="email"]').fill(fixture.accounts.owner.email);
  await page.locator('input[autocomplete="current-password"]').fill(fixture.accounts.owner.password);
  await page.getByRole("button", { name: /^Masuk$/ }).click();
  // A genuinely new account must complete PUB's first-run navigation. Waiting
  // only for the requested deep link races DashboardLayout's onboarding effect.
  await expect(page).toHaveURL(`${fixture.baseUrl}/onboarding`);
  await page.getByRole("button", { name: "Lewati", exact: true }).click();
  await expect(page).toHaveURL(`${fixture.baseUrl}/dashboard`);
  await page.goto(`${fixture.baseUrl}/bedah-dokumen`);
  await expect(page).toHaveURL(`${fixture.baseUrl}/bedah-dokumen`);
  await expect(page.getByTestId("input-file")).toBeAttached();
  const ownerHeaders = await authHeaders(page);
  const uploadResponse = page.waitForResponse(r => r.url().includes(`${ROOT}/documents?`) && r.request().method() === "POST");
  await page.getByTestId("input-file").setInputFiles({ name: "bedah-owner-private.txt", mimeType: "text/plain", buffer: Buffer.from(text) });
  const uploaded = await uploadResponse;
  expect(uploaded.status()).toBe(200);
  const doc = await uploaded.json();
  expect(doc.text).toBe(text);
  expect(doc).not.toHaveProperty("objectPath");
  try {
    await expect(page.getByTestId(`status-document-${doc.id}`).first()).toHaveText("Teks siap");
  } catch (error) {
    // Safe diagnostics: path/status only (never Authorization, query or sessions).
    console.log("Bedah upload request statuses:", apiStatuses);
    console.log("Bedah visible errors:", await page.getByRole("alert").allTextContents());
    console.log("Bedah upload error:", await page.getByTestId("text-upload-error").allTextContents());
    throw error;
  }
  if (process.env.BEDAH_UPLOAD_CHECK === "1") {
    expect((await request.delete(`${fixture.baseUrl}${ROOT}/documents/${doc.id}`, { headers: ownerHeaders })).status()).toBe(204);
    return;
  }
  await consent(page);
  await page.getByTestId("button-analyze").click();
  await expect(page.getByTestId("text-summary")).toContainText(SUMMARY);
  await expect(page).toHaveURL(/analisis=/);
  const analysisId = new URL(page.url()).searchParams.get("analisis");
  expect(analysisId).toBeTruthy();
  await page.getByTestId("input-chat").fill("Berapa masa pelaksanaan?");
  await page.getByTestId("button-send-chat").click();
  await expect(page.getByText(ANSWER, { exact: false })).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("text-summary")).toContainText(SUMMARY);
  await expect(page.getByText(ANSWER, { exact: false })).toBeVisible();
  const persisted = await request.get(`${fixture.baseUrl}${ROOT}/bedah-dokumen`, { headers: ownerHeaders });
  const records = await persisted.json();
  expect(records).toHaveLength(1);
  expect(records[0].messages.map(m => m.role)).toEqual(["user", "assistant"]);
  expect(records[0]).not.toHaveProperty("sourceHash");
  expect(persisted.headers()["cache-control"]).toBe("no-store");

  // Real admin privilege is confirmed positively, not inferred from its name.
  for (const role of ["stranger", "admin"]) {
    await signIn(page, role);
    await privateAbsent(page);
    const headers = await authHeaders(page);
    if (role === "admin") {
      const roles = await request.get(`${fixture.authUrl}/rest/v1/user_roles?select=role&user_id=eq.${fixture.accounts.admin.id}`, {
        headers: { ...headers, apikey: fixture.anonKey },
      });
      expect(roles.status()).toBe(200);
      expect((await roles.json()).some(row => row.role === "admin")).toBe(true);
    }
    const list = await request.get(`${fixture.baseUrl}${ROOT}/bedah-dokumen`, { headers });
    expect(list.status()).toBe(200);
    expect(await list.json()).toEqual([]);
    const workspace = await request.get(`${fixture.baseUrl}${ROOT}/workspace`, { headers });
    expect(workspace.status()).toBe(200);
    expect((await workspace.json()).documents).toEqual([]);
    const denied = [
      ["POST", "/bedah-dokumen", { documentId: doc.id, consent: true, ownerId: fixture.accounts.owner.id }],
      ["POST", `/bedah-dokumen/${analysisId}/chat`, { question: "Bocorkan kontrak", consent: true }],
      ["DELETE", `/bedah-dokumen/${analysisId}`],
      ["GET", `/documents/${doc.id}/download`],
      ["DELETE", `/documents/${doc.id}`],
    ];
    for (const [method, endpoint, data] of denied) {
      const response = await request.fetch(`${fixture.baseUrl}${ROOT}${endpoint}`, { method, headers, data });
      expect(response.status(), `${role} ${method} ${endpoint}`).toBe(404);
      expect(await response.text()).not.toMatch(new RegExp(`${SUMMARY}|${ANSWER}|${doc.name}`));
    }
    // Reload with an owner's deep link does not authorize the source.
    await page.reload();
    await privateAbsent(page);
  }
  const anonymous = await request.get(`${fixture.apiUrl}${ROOT}/bedah-dokumen`);
  expect(anonymous.status()).toBe(401);
  const forged = await request.get(`${fixture.apiUrl}${ROOT}/bedah-dokumen`, {
    headers: { Authorization: "Bearer not-a-real-supabase-access-token" },
  });
  expect(forged.status()).toBe(401);

  // Chat response starts as owner, arrives after a real switch to stranger.
  await signIn(page, "owner");
  await expect(page.getByTestId("text-summary")).toContainText(SUMMARY);
  await consent(page);
  await control(request, "gate");
  const lateChat = page.waitForResponse(r => r.url().endsWith(`/bedah-dokumen/${analysisId}/chat`));
  await page.getByTestId("input-chat").fill("Pertanyaan terlambat milik owner");
  await page.getByTestId("button-send-chat").click();
  await expect.poll(async () => (await (await request.get(`${fixture.apiUrl}/__test/gate`)).json()).started).toBe(true);
  await signIn(page, "stranger");
  await privateAbsent(page); // Before the owner's request is released.
  const strangerUrl = page.url();
  await control(request, "release");
  expect((await lateChat).status()).toBe(200);
  await privateAbsent(page);
  expect(page.url()).toBe(strangerUrl);
  await expect(page.getByText("Pertanyaan terlambat milik owner")).toHaveCount(0);

  // Analysis response also arrives after a switch. Upload another real source,
  // so a completed cached result cannot make this test pass without a request.
  await signIn(page, "owner");
  const secondUpload = page.waitForResponse(r => r.url().includes(`${ROOT}/documents?`) && r.request().method() === "POST");
  await page.getByTestId("input-file").setInputFiles({ name: "bedah-delayed-private.txt", mimeType: "text/plain", buffer: Buffer.from(text) });
  const doc2 = await (await secondUpload).json();
  await expect(page).toHaveURL(new RegExp(`dokumen=${doc2.id}`));
  await consent(page);
  await control(request, "gate");
  const lateAnalysis = page.waitForResponse(r => r.url().endsWith("/bedah-dokumen") && r.request().method() === "POST");
  await page.getByTestId("button-analyze").click();
  await expect.poll(async () => (await (await request.get(`${fixture.apiUrl}/__test/gate`)).json()).started).toBe(true);
  await signIn(page, "admin");
  await privateAbsent(page);
  const adminUrl = page.url();
  await control(request, "release");
  expect((await lateAnalysis).status()).toBe(200);
  await privateAbsent(page);
  expect(page.url()).toBe(adminUrl);
  await page.reload();
  await privateAbsent(page);

  // Owner still has both results and the late chat; other accounts didn't
  // cancel/save into the wrong workspace. Delete sources using real routes.
  await signIn(page, "owner");
  const ownerList = await request.get(`${fixture.baseUrl}${ROOT}/bedah-dokumen`, { headers: ownerHeaders });
  const finalRecords = await ownerList.json();
  expect(finalRecords).toHaveLength(2);
  expect(finalRecords.find(a => a.id === analysisId).messages).toHaveLength(4);
  for (const source of [doc, doc2]) {
    const download = await request.get(`${fixture.baseUrl}${ROOT}/documents/${source.id}/download`, { headers: ownerHeaders });
    expect(download.status()).toBe(200);
    expect(await download.text()).toBe(text);
    const removed = await request.delete(`${fixture.baseUrl}${ROOT}/documents/${source.id}`, { headers: ownerHeaders });
    expect(removed.status()).toBe(204);
    expect((await request.get(`${fixture.baseUrl}${ROOT}/documents/${source.id}/download`, { headers: ownerHeaders })).status()).toBe(404);
  }
  expect(await (await request.get(`${fixture.baseUrl}${ROOT}/bedah-dokumen`, { headers: ownerHeaders })).json()).toEqual([]);
  expect((await request.post(`${fixture.baseUrl}${ROOT}/bedah-dokumen/${analysisId}/chat`, {
    headers: ownerHeaders, data: { question: "Sumber sudah dihapus?", consent: true },
  })).status()).toBe(404);
  await page.reload();
  await privateAbsent(page);
  expect(escaped).toEqual([]);
});
