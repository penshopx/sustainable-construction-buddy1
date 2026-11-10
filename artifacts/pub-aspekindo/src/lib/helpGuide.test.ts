import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  contextualHelpRoutes,
  getHelpHrefForPath,
  getHelpSectionForPath,
  getHelpSectionFromHash,
  helpSections,
  publicHelpRoutePolicy,
} from "./helpGuide.ts";

const mainRouteExpectations = {
  "/dashboard": "dashboard",
  "/assessment": "assessment",
  "/courses": "belajar",
  "/aspekindo-lms": "belajar",
  "/aspekindo-aktivitas": "belajar",
  "/mentor": "layanan",
  "/analytics": "belajar",
  "/siap-kompetensi": "empat-siap",
  "/profile": "akun",
  "/certificates": "belajar",
  "/leaderboard": "belajar",
  "/notifications": "layanan",
  "/projects": "proyek",
  "/risk-register": "proyek",
  "/budget-tracker": "proyek",
  "/k3-checklist": "proyek",
  "/generator": "proyek",
  "/brain-project": "proyek",
  "/konsultasi": "proyek",
  "/lkut": "lkut",
  "/grading": "empat-siap",
  "/compliance": "empat-siap",
  "/simulator-sbu": "empat-siap",
  "/simulator-lkut": "empat-siap",
  "/smap": "smap-pancek",
  "/pancek": "smap-pancek",
  "/informasi": "layanan",
  "/agenda-pub": "belajar",
  "/kursus/kursus-publik": "belajar",
  "/inovasi": "layanan",
  "/program-kegiatan": "layanan",
  "/marketplace": "layanan",
  "/direktori": "layanan",
  "/helpdesk": "layanan",
  "/bedah-dokumen": "layanan",
  "/klinik-konsultasi": "layanan",
  "/pesanan": "layanan",
  "/produk-saya": "layanan",
} as const;

test("setiap rute utama membuka bagian panduan yang terkait", () => {
  for (const [pathname, expectedSection] of Object.entries(mainRouteExpectations)) {
    assert.equal(getHelpSectionForPath(pathname), expectedSection, pathname);
  }
});

test("setiap rute publik diklasifikasikan dan rute wajib memiliki panduan", () => {
  const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const publicRoutePaths = appSource
    .split("\n")
    .filter((line) => line.includes("<Route path=") && !line.includes("<DashboardLayout>"))
    .flatMap((line) => {
      const match = line.match(/path="([^"]+)"/);
      return match && match[1] !== "*" ? [match[1]] : [];
    });
  const requiredPaths = new Set<string>(publicHelpRoutePolicy.required);
  const classifiedPaths = new Set<string>([
    ...publicHelpRoutePolicy.required,
    ...publicHelpRoutePolicy.exempt,
  ]);

  assert.ok(publicRoutePaths.length > 0, "Daftar rute publik dari App.tsx tidak boleh kosong");
  for (const routePath of publicRoutePaths) {
    assert.ok(
      classifiedPaths.has(routePath),
      `${routePath} belum diklasifikasikan sebagai rute publik wajib panduan atau bebas panduan`,
    );
  }

  for (const routePath of requiredPaths) {
    assert.ok(publicRoutePaths.includes(routePath), `${routePath} tidak ditemukan di App.tsx`);
    const representativePath = routePath.replace(/:[^/]+/g, "contoh");
    assert.notEqual(
      getHelpSectionForPath(representativePath),
      "mulai",
      `${routePath} wajib memiliki pemetaan panduan kontekstual`,
    );
  }
});

test("setiap rute fitur anggota di aplikasi tercakup oleh pemetaan panduan", () => {
  const appSource = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
  const memberRouteLines = appSource
    .split("\n")
    .filter((line) => line.includes("<Route path=") && line.includes("<DashboardLayout>"))
    .filter((line) => !line.includes("<AdminGuard>") && !line.includes("<SuperAdminGuard>"));

  const memberPaths = memberRouteLines.flatMap((line) => {
    const match = line.match(/path="([^"]+)"/);
    return match ? [match[1]] : [];
  });

  assert.ok(memberPaths.length > 0, "Daftar rute anggota dari App.tsx tidak boleh kosong");
  for (const routePath of memberPaths) {
    if (routePath === "/bantuan") continue;
    const representativePath = routePath.replace(/:[^/]+/g, "contoh");
    assert.notEqual(
      getHelpSectionForPath(representativePath),
      "mulai",
      `${routePath} belum memiliki pemetaan panduan`,
    );
  }
});

test("rute detail mengikuti panduan modul induknya", () => {
  const detailRoutes = {
    "/aspekindo-lms/kursus/kursus-123": "belajar",
    "/projects/proyek-123": "proyek",
    "/informasi/pembaruan-regulasi": "layanan",
    "/inovasi/proposal/proposal-123": "layanan",
    "/program-kegiatan/kegiatan-123": "layanan",
    "/direktori/perusahaan-123": "layanan",
    "/klinik-konsultasi/sbu": "layanan",
  } as const;

  for (const [pathname, expectedSection] of Object.entries(detailRoutes)) {
    assert.equal(getHelpSectionForPath(pathname), expectedSection, pathname);
  }
});

test("Bedah Dokumen dan loket klinik menautkan petunjuk layanan yang relevan", () => {
  for (const pathname of ["/bedah-dokumen", "/klinik-konsultasi", "/klinik-konsultasi/sbu"]) {
    assert.equal(getHelpHrefForPath(pathname), "/bantuan#layanan", pathname);
  }

  const services = helpSections.find(({ id }) => id === "layanan");
  assert.ok(services?.steps.some((step) => step.includes("Bedah Dokumen") && step.includes("persetujuan")));
  assert.ok(services?.steps.some((step) => step.includes("Klinik Konsultasi") && step.includes("loket")));
});

test("rute yang tidak dikenal aman mengarah ke panduan mulai", () => {
  assert.equal(getHelpSectionForPath("/fitur-baru"), "mulai");
  assert.equal(getHelpSectionForPath("/projects-lama/detail"), "mulai");
  assert.equal(getHelpHrefForPath("/fitur-baru"), "/bantuan#mulai");
});

test("semua pemetaan dan tautan hash menunjuk ke bagian yang tersedia", () => {
  const availableSections = new Set(helpSections.map(({ id }) => id));

  for (const { paths, section } of contextualHelpRoutes) {
    assert.ok(availableSections.has(section), `Bagian ${section} untuk ${paths.join(", ")} tidak tersedia`);
    for (const pathname of paths) {
      const hash = getHelpHrefForPath(pathname).split("#")[1];
      assert.ok(availableSections.has(getHelpSectionFromHash(hash)));
    }
  }

  assert.equal(getHelpSectionFromHash("#bagian-tidak-ada"), "mulai");
});