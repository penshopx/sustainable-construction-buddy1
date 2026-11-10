import fs from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { installSupabaseSession } from "./helpers/supabase-session.js";
import { revealLandingSection } from "./helpers/landing-readiness.js";

const agendas = [
  {
    id: "00000000-0000-4000-8000-000000000101",
    title: "Agenda WIB titik",
    category: "Sesi pembelajaran",
    description: "Pembekalan praktik usaha untuk anggota.",
    audience: "Anggota ASPEKINDO",
    status: "published",
    start_date: "2026-09-10",
    end_date: null,
    schedule: "09.00–12.00 WIB",
    location: "Gedung ASPEKINDO Jakarta",
    registration_url: "https://aspekindo.id/daftar-wib",
    registration_details: "Pendaftaran ditutup 8 September.",
    created_at: "2026-08-28T00:00:00.000Z",
    updated_at: "2026-08-28T00:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000102",
    title: "Agenda WITA titik dua",
    category: "Klinik pendampingan",
    description: "Klinik pendampingan sertifikasi BUJK.",
    audience: "BUJK anggota",
    status: "published",
    start_date: "2026-09-11",
    end_date: null,
    schedule: "13:15–16:45 WITA",
    location: "Ruang Rapat ASPEKINDO Makassar",
    registration_url: "https://aspekindo.id/daftar-wita",
    registration_details: "Bawa dokumen legalitas perusahaan.",
    created_at: "2026-08-28T00:00:00.000Z",
    updated_at: "2026-08-28T00:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000103",
    title: "Agenda WIT titik",
    category: "Forum berbagi",
    description: "Forum berbagi pengalaman proyek.",
    audience: "Pelaku usaha konstruksi",
    status: "published",
    start_date: "2026-09-12",
    end_date: null,
    schedule: "08.30–10.00 WIT",
    location: "Hotel ASPEKINDO Jayapura",
    registration_url: "https://aspekindo.id/daftar-wit",
    registration_details: "Kapasitas terbatas.",
    created_at: "2026-08-28T00:00:00.000Z",
    updated_at: "2026-08-28T00:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000104",
    title: "Agenda lintas tengah malam",
    category: "Sesi pembelajaran",
    description: "Sesi intensif untuk persiapan tender.",
    audience: "Anggota ASPEKINDO",
    status: "published",
    start_date: "2026-09-13",
    end_date: null,
    schedule: "22:00–01:30 WIB",
    location: "Online",
    registration_url: "https://aspekindo.id/daftar-malam",
    registration_details: "Tautan konferensi dikirim setelah pendaftaran.",
    created_at: "2026-08-28T00:00:00.000Z",
    updated_at: "2026-08-28T00:00:00.000Z",
  },
  {
    id: "00000000-0000-4000-8000-000000000105",
    title: "Agenda sehari penuh",
    category: "Forum berbagi",
    description: "Lokakarya tahunan ASPEKINDO.",
    audience: "Seluruh anggota",
    status: "published",
    start_date: "2026-09-14",
    end_date: null,
    schedule: "Sehari penuh",
    location: "Balai Sidang Jakarta",
    registration_url: "https://aspekindo.id/daftar-sehari",
    registration_details: "Registrasi ulang mulai pukul 08.00.",
    created_at: "2026-08-28T00:00:00.000Z",
    updated_at: "2026-08-28T00:00:00.000Z",
  },
];

const expectedCalendarDates = {
  "Agenda WIB titik": {
    google: "20260910T020000Z/20260910T050000Z",
    icsStart: "DTSTART:20260910T020000Z",
    icsEnd: "DTEND:20260910T050000Z",
  },
  "Agenda WITA titik dua": {
    google: "20260911T051500Z/20260911T084500Z",
    icsStart: "DTSTART:20260911T051500Z",
    icsEnd: "DTEND:20260911T084500Z",
  },
  "Agenda WIT titik": {
    google: "20260911T233000Z/20260912T010000Z",
    icsStart: "DTSTART:20260911T233000Z",
    icsEnd: "DTEND:20260912T010000Z",
  },
  "Agenda lintas tengah malam": {
    google: "20260913T150000Z/20260913T183000Z",
    icsStart: "DTSTART:20260913T150000Z",
    icsEnd: "DTEND:20260913T183000Z",
  },
  "Agenda sehari penuh": {
    google: "20260914/20260915",
    icsStart: "DTSTART;VALUE=DATE:20260914",
    icsEnd: "DTEND;VALUE=DATE:20260915",
  },
};

async function mockPublicAgenda(page, agendaRows = agendas) {
  await page.route("**/auth/v1/**", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname.endsWith("/user")) {
      await route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ message: "No active session" }),
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
    const request = route.request();
    const requestUrl = new URL(request.url());
    const table = requestUrl.pathname.split("/").pop();

    if (table === "aspekindo_learning_agendas") {
      let responseRows = [...agendaRows];
      const statusFilter = requestUrl.searchParams.get("status");
      const startDateFilter = requestUrl.searchParams.get("start_date");
      const limit = Number(requestUrl.searchParams.get("limit"));

      if (statusFilter?.startsWith("eq.")) {
        const status = statusFilter.slice(3);
        responseRows = responseRows.filter((agenda) => agenda.status === status);
      }
      if (startDateFilter?.startsWith("gte.")) {
        const startDate = startDateFilter.slice(4);
        responseRows = responseRows.filter((agenda) => agenda.start_date >= startDate);
      }
      responseRows.sort((left, right) => left.start_date.localeCompare(right.start_date));
      if (Number.isFinite(limit) && limit > 0) responseRows = responseRows.slice(0, limit);

      await route.fulfill({
        status: 200,
        headers: {
          "content-range": responseRows.length > 0
            ? `0-${responseRows.length - 1}/${responseRows.length}`
            : "*/0",
        },
        contentType: "application/json",
        body: JSON.stringify(responseRows),
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
}

async function mockAdminAgenda(page, initialAgendas = []) {
  const userId = "00000000-0000-4000-8000-000000000201";
  const fakeUser = {
    id: userId,
    aud: "authenticated",
    role: "authenticated",
    email: "agenda-admin@example.test",
    app_metadata: { provider: "email", providers: ["email"] },
    user_metadata: {},
    created_at: "2026-08-28T00:00:00.000Z",
  };
  const fakeSession = {
    access_token: "test-access-token",
    refresh_token: "test-refresh-token",
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + 3600,
    user: fakeUser,
  };
  const agendaMutations = [];

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
    const request = route.request();
    const requestUrl = new URL(request.url());
    const table = requestUrl.pathname.split("/").pop();

    if (table === "aspekindo_learning_agendas") {
      if (request.method() === "POST" || request.method() === "PATCH") {
        agendaMutations.push({
          method: request.method(),
          body: request.postDataJSON(),
        });
        await route.fulfill({
          status: request.method() === "POST" ? 201 : 204,
          contentType: "application/json",
          body: request.method() === "POST" ? JSON.stringify([]) : "",
        });
        return;
      }

      await route.fulfill({
        status: 200,
        headers: { "content-range": `0-${initialAgendas.length - 1}/${initialAgendas.length}` },
        contentType: "application/json",
        body: JSON.stringify(initialAgendas),
      });
      return;
    }

    if (table === "user_roles") {
      if (requestUrl.searchParams.get("role") === "eq.super_admin") {
        await route.fulfill({
          status: 406,
          contentType: "application/json",
          body: JSON.stringify({
            code: "PGRST116",
            message: "JSON object requested, multiple (or no) rows returned",
          }),
        });
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ role: "admin" }]),
      });
      return;
    }

    if (table === "profiles" && request.headers().accept?.includes("vnd.pgrst.object")) {
      await route.fulfill({
        status: 406,
        contentType: "application/json",
        body: JSON.stringify({
          code: "PGRST116",
          message: "JSON object requested, multiple (or no) rows returned",
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

  await page.goto("/admin/aspekindo-agenda");
  await expect(
    page.getByRole("heading", { name: "Agenda ASPEKINDO" }),
  ).toBeVisible();

  return agendaMutations;
}
async function readDownload(download) {
  const path = await download.path();
  if (!path) throw new Error("Calendar download did not produce a file path");
  return fs.readFile(path, "utf8");
}

test.describe("ASPEKINDO agenda calendar exports", () => {
  test("projects the canonical agenda into the public information center", async ({ page }) => {
    await mockPublicAgenda(page);
    await page.goto("/informasi");

    await expect(page.getByRole("heading", { name: "Agenda WITA titik dua" })).toBeVisible();
    await expect(page.getByText("Ditampilkan langsung dari agenda resmi, tanpa salinan data.")).toBeVisible();

    await page.getByRole("button", { name: "Kabar PUB" }).click();
    await expect(page).toHaveURL(/channel=pub/);
    await expect(page.getByRole("heading", { name: "Agenda WIB titik" })).toBeVisible();
  });

  test("keeps public agenda visible alongside published news", async ({ page }) => {
    await mockPublicAgenda(page);
    await page.route("**/rest/v1/information_articles**", async (route) => {
      await route.fulfill({
        status: 200,
        headers: { "content-range": "0-0/1" },
        contentType: "application/json",
        body: JSON.stringify([{
          id: "00000000-0000-4000-8000-000000000201",
          slug: "berita-regulasi-bujk",
          title: "Berita regulasi BUJK",
          summary: "Pembaruan regulasi untuk pelaku jasa konstruksi.",
          body: "Ringkasan regulasi.",
          channel: "industry",
          topic: "Regulasi",
          status: "published",
          source_url: "https://pu.go.id/regulasi",
          source_title: "Kementerian Pekerjaan Umum",
          source_published_at: "2026-08-29T00:00:00.000Z",
          published_at: "2026-08-30T00:00:00.000Z",
          updated_at: "2026-08-30T00:00:00.000Z",
          information_sources: { name: "Kementerian Pekerjaan Umum", domain: "pu.go.id", trust_level: "primary" },
        }]),
      });
    });
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Berita regulasi BUJK" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Agenda WITA titik dua" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Lihat semua agenda" }).first()).toBeVisible();
  });

  test("promotes the nearest upcoming PUB agenda with a clear registration path", async ({ page }) => {
    const agendaRequests = [];
    page.on("request", (request) => {
      const requestUrl = new URL(request.url());
      if (requestUrl.pathname.endsWith("/aspekindo_learning_agendas")) {
        agendaRequests.push(requestUrl);
      }
    });
    await mockPublicAgenda(page);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Kegiatan berikutnya untuk BUJK yang terus bergerak." })).toBeVisible();
    await expect(page.getByText("Agenda unggulan")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Agenda WIB titik" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "Daftar Agenda WIB titik" }).first()).toHaveAttribute(
      "href",
      "https://aspekindo.id/daftar-wib",
    );
    await expect(page.getByRole("link", { name: "Lihat semua agenda" }).first()).toHaveAttribute("href", "/agenda-pub");

    await expect.poll(() => {
      const promotionRequest = agendaRequests.find((requestUrl) => requestUrl.searchParams.get("limit") === "3");
      if (!promotionRequest) return false;
      return promotionRequest.searchParams.get("status") === "eq.published"
        && promotionRequest.searchParams.get("start_date")?.startsWith("gte.")
        && promotionRequest.searchParams.get("order")?.includes("start_date.asc");
    }).toBe(true);
  });

  test("hides draft and past agendas and keeps an unsafe registration link internal", async ({ page }) => {
    await mockPublicAgenda(page, [
      {
        ...agendas[0],
        id: "00000000-0000-4000-8000-000000000301",
        title: "Agenda Lampau",
        start_date: "2000-01-01",
      },
      {
        ...agendas[0],
        id: "00000000-0000-4000-8000-000000000302",
        title: "Agenda Draft Rahasia",
        status: "draft",
        start_date: "2099-01-01",
      },
      {
        ...agendas[0],
        id: "00000000-0000-4000-8000-000000000303",
        title: "Agenda Aman Tanpa Tautan Eksternal",
        start_date: "2099-02-01",
        registration_url: "http://example.com/tidak-aman",
      },
    ]);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Agenda Aman Tanpa Tautan Eksternal" }).first()).toBeVisible();
    await expect(page.getByText("Agenda Draft Rahasia")).toHaveCount(0);
    await expect(page.getByText("Agenda Lampau")).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Lihat detail agenda" }).first()).toHaveAttribute("href", "/agenda-pub");
  });

  test("keeps a useful agenda destination visible when no upcoming agenda exists", async ({ page }) => {
    await mockPublicAgenda(page, []);
    await page.goto("/");

    await expect(page.getByRole("heading", { name: "Agenda berikutnya sedang disiapkan." })).toBeVisible();
    await expect(page.getByRole("link", { name: "Buka halaman agenda" })).toHaveAttribute("href", "/agenda-pub");
  });

  test("does not turn ambiguous schedules into timed calendar events", async ({ page }) => {
    const ambiguousAgendas = [
      { ...agendas[0], id: "00000000-0000-4000-8000-000000000401", title: "Jam tanpa zona", schedule: "09:00–12:00" },
      { ...agendas[0], id: "00000000-0000-4000-8000-000000000402", title: "Jam tanpa rentang", schedule: "09:00 WIB" },
      { ...agendas[0], id: "00000000-0000-4000-8000-000000000403", title: "Jam tanpa menit", schedule: "09–12 WIB" },
      { ...agendas[0], id: "00000000-0000-4000-8000-000000000404", title: "Rentang nol durasi", schedule: "09:00–09:00 WIB" },
    ];
    await mockPublicAgenda(page, ambiguousAgendas);
    await page.goto("/agenda-pub");

    for (const agenda of ambiguousAgendas) {
      const [download] = await Promise.all([
        page.waitForEvent("download"),
        page.getByRole("button", {
          name: `Unduh file kalender ${agenda.title}`,
        }).click(),
      ]);
      const ics = await readDownload(download);

      expect(ics).toContain(`DTSTART;VALUE=DATE:${agenda.start_date.replace(/-/g, "")}`);
      expect(ics).not.toContain("DTSTART:");
      expect(ics).not.toContain("DTEND:");
    }
  });

  test("opens the full PUB agenda without requiring login", async ({ page }) => {
    await mockPublicAgenda(page);
    await page.goto("/agenda-pub");

    await expect(page.getByRole("heading", { name: "Belajar bersama, bertumbuh sebagai BUJK." })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Agenda WITA titik dua" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Daftar kegiatan" }).first()).toBeVisible();
    await expect(page.getByRole("link", { name: "LMS anggota" })).toHaveAttribute("href", "/aspekindo-lms");
    await expect(page.getByRole("link", { name: "Masuk / Daftar" })).toBeVisible();
  });

  test("preserves Indonesian time zones and formats in Google Calendar and ICS", async ({ page }) => {
    await mockPublicAgenda(page);
    await page.goto("/");

    const agendaSection = page.locator("#agenda-aspekindo");
    await revealLandingSection(page, agendaSection);
    await expect(
      agendaSection.getByRole("heading", { name: "Agenda WITA titik dua" }),
    ).toBeVisible();
    await expect(
      agendaSection.locator('[data-testid^="agenda-calendar-actions-"]'),
    ).toHaveCount(agendas.length);

    for (const agenda of agendas) {
      const expected = expectedCalendarDates[agenda.title];
      const googleLink = agendaSection.getByRole("link", {
        name: `Simpan ${agenda.title} ke Google Calendar`,
      });
      const googleUrl = new URL(await googleLink.getAttribute("href"));
      expect(googleUrl.searchParams.get("action")).toBe("TEMPLATE");
      expect(googleUrl.searchParams.get("text")).toBe(agenda.title);
      expect(googleUrl.searchParams.get("dates")).toBe(expected.google);
      expect(googleUrl.searchParams.get("location")).toBe(agenda.location);

      const details = googleUrl.searchParams.get("details");
      expect(details).toContain(agenda.description);
      expect(details).toContain(`Jadwal: ${agenda.schedule}`);
      expect(details).toContain(`Detail pendaftaran: ${agenda.registration_details}`);
      expect(details).toContain(`Daftar kegiatan: ${agenda.registration_url}`);

      const [download] = await Promise.all([
        page.waitForEvent("download"),
        agendaSection.getByRole("button", {
          name: `Unduh file kalender ${agenda.title}`,
        }).click(),
      ]);
      const ics = await readDownload(download);

      expect(ics).toContain(expected.icsStart);
      expect(ics).toContain(expected.icsEnd);
      expect(ics).toContain(`SUMMARY:${agenda.title}`);
      expect(ics).toContain(`DESCRIPTION:${agenda.description}`);
      expect(ics).toContain(`LOCATION:${agenda.location}`);
      expect(ics).toContain(`URL:${agenda.registration_url}`);
      if (agenda.title === "Agenda sehari penuh") {
        expect(ics).not.toContain("DTSTART:");
        expect(ics).not.toContain("DTEND:");
      }
    }
  });

  test("shows supported time formats in the admin panel and rejects ambiguous schedules", async ({ page }) => {
    const existingAgenda = {
      ...agendas[0],
      title: "Agenda untuk pengujian edit",
      id: "00000000-0000-4000-8000-000000000202",
    };
    const agendaMutations = await mockAdminAgenda(page, [existingAgenda]);

    await page.getByRole("button", { name: "Tambah kegiatan" }).click();
    await expect(page.locator("#agenda-schedule-help")).toContainText("Isi rentang lengkap");
    await page.locator("#agenda-title").fill("Agenda jam menyusul");
    await page.locator("#agenda-description").fill("Deskripsi agenda pengujian.");
    await page.locator("#agenda-audience").fill("Anggota ASPEKINDO");
    await page.locator("#agenda-start-date").fill("2026-09-15");
    await page.locator("#agenda-schedule").fill("menyusul");
    await page.getByRole("button", { name: "Simpan kegiatan", exact: true }).click();

    await expect(page.getByRole("status")).toContainText("Format jam belum dapat dipetakan");
    await expect(page.locator("#agenda-schedule-help")).toContainText("beserta zona");
    expect(agendaMutations).toHaveLength(0);

    await page.getByRole("button", { name: "Batal", exact: true }).click();
    await page.getByRole("button", { name: `Edit ${existingAgenda.title}` }).click();
    await page.locator("#agenda-schedule").fill("menyusul");
    await page.getByRole("button", { name: "Simpan perubahan", exact: true }).click();

    await expect(page.getByRole("status")).toContainText("Format jam belum dapat dipetakan");
    expect(agendaMutations).toHaveLength(0);
  });

  test("saves valid WIB, WITA, WIT, overnight, and all-day schedules through the mock API", async ({ page }) => {
    const agendaMutations = await mockAdminAgenda(page);
    const validSchedules = [
      "09.00–12.00 WIB",
      "13:15–16:45 WITA",
      "08.30–10.00 WIT",
      "22:00–01:30 WIB",
      "Sehari penuh",
    ];

    for (const [index, schedule] of validSchedules.entries()) {
      await page.getByRole("button", { name: "Tambah kegiatan" }).click();
      await page.locator("#agenda-title").fill(`Agenda valid ${index + 1}`);
      await page.locator("#agenda-description").fill("Deskripsi agenda valid.");
      await page.locator("#agenda-audience").fill("Anggota ASPEKINDO");
      await page.locator("#agenda-start-date").fill(`2026-09-${String(16 + index).padStart(2, "0")}`);
      await page.locator("#agenda-schedule").fill(schedule);
      await page.getByRole("button", { name: "Simpan kegiatan", exact: true }).click();
      await expect(page.getByRole("dialog")).not.toBeVisible();
    }

    expect(agendaMutations).toHaveLength(validSchedules.length);
    expect(agendaMutations.map(({ body }) => body.schedule)).toEqual(validSchedules);
  });
});
