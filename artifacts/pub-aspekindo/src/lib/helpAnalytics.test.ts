import assert from "node:assert/strict";
import test from "node:test";
import { trackEvent } from "./analytics.ts";
import { trackHelpCenterOpened, trackHelpTopicSelected } from "./helpAnalytics.ts";
import { getHelpLocationForPath } from "./helpGuide.ts";

test.afterEach(() => {
  Reflect.deleteProperty(globalThis, "window");
});

test("event bantuan memakai nama dan payload anonim yang telah ditentukan", () => {
  const events: Array<{ name: string; data?: Record<string, unknown> }> = [];
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      umami: {
        track: (name: string, data?: Record<string, unknown>) => events.push({ name, data }),
      },
    },
  });

  trackHelpCenterOpened("/projects/project-private-123");
  trackHelpCenterOpened("/informasi/article-private-456");
  trackHelpCenterOpened("/simulator-sbu");
  trackHelpCenterOpened("/simulator-lkut");
  trackHelpTopicSelected("assessment");

  assert.deepEqual(events, [
    {
      name: "help_center_opened",
      data: { section: "proyek", location: "projects" },
    },
    {
      name: "help_center_opened",
      data: { section: "layanan", location: "informasi" },
    },
    {
      name: "help_center_opened",
      data: { section: "empat-siap", location: "simulator_sbu" },
    },
    {
      name: "help_center_opened",
      data: { section: "empat-siap", location: "simulator_lkut" },
    },
    {
      name: "help_topic_selected",
      data: { section: "assessment", location: "help_center" },
    },
  ]);
});

test("payload event tidak pernah membawa segmen dinamis atau teks bebas", () => {
  const events: Array<{ name: string; data?: Record<string, unknown> }> = [];
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      umami: {
        track: (name: string, data?: Record<string, unknown>) => events.push({ name, data }),
      },
    },
  });

  trackHelpCenterOpened("/direktori/company-private-123");
  trackHelpCenterOpened("/inovasi/proposal/proposal-private-456");
  trackHelpCenterOpened("/aspekindo-lms/kursus/course-private-789");
  trackHelpCenterOpened("/admin/program-kegiatan/program-private-012");

  assert.equal(getHelpLocationForPath("/projects/project-private-123"), "projects");
  assert.equal(getHelpLocationForPath("/not-mapped/private-text"), "other");
  assert.deepEqual(events, [
    { name: "help_center_opened", data: { section: "layanan", location: "direktori" } },
    { name: "help_center_opened", data: { section: "layanan", location: "inovasi" } },
    { name: "help_center_opened", data: { section: "belajar", location: "aspekindo_lms" } },
    { name: "help_center_opened", data: { section: "mulai", location: "other" } },
  ]);
});

test("analytics menjadi no-op jika tracker tidak tersedia atau gagal", () => {
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {},
  });
  assert.doesNotThrow(() => trackEvent("help_center_opened"));

  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      umami: {
        track: () => {
          throw new Error("tracker unavailable");
        },
      },
    },
  });
  assert.doesNotThrow(() => trackEvent("help_center_opened"));
});