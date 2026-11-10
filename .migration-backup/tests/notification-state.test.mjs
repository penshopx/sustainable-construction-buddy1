import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

const sourcePath = new URL("../src/lib/notificationState.ts", import.meta.url);
const source = await readFile(sourcePath, "utf8");
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2020,
  },
}).outputText;
const notificationState = await import(`data:text/javascript,${encodeURIComponent(transpiled)}`);

const notification = (id, createdAt, overrides = {}) => ({
  id,
  type: "competency_insight_fallback",
  title: "Insight kompetensi perlu diperiksa",
  message: "Fallback deterministik aktif.",
  is_read: false,
  created_at: createdAt,
  ...overrides,
});

test("merges fetch and realtime snapshots without duplicate notification ids", () => {
  const realtimeFirst = [
    notification("incident-1", "2026-09-02T02:00:00.000Z"),
    notification("incident-2", "2026-09-02T01:00:00.000Z"),
  ];
  const fetchedLater = [
    notification("incident-1", "2026-09-02T02:00:00.000Z", { is_read: true }),
    notification("incident-3", "2026-09-02T03:00:00.000Z", { type: "info" }),
  ];

  const merged = notificationState.mergeNotifications(realtimeFirst, fetchedLater);

  assert.deepEqual(merged.map(({ id }) => id), ["incident-3", "incident-1", "incident-2"]);
  assert.equal(merged.filter(({ id }) => id === "incident-1").length, 1);
  assert.equal(merged.find(({ id }) => id === "incident-1").is_read, true);
});

test("keeps a notification read when a reconnect replays an older unread payload", () => {
  const readNotification = notification("incident-1", "2026-09-02T02:00:00.000Z", { is_read: true });
  const replayedNotification = notification("incident-1", "2026-09-02T02:00:00.000Z", { is_read: false });

  const merged = notificationState.mergeNotifications([readNotification], [replayedNotification]);

  assert.deepEqual(merged.map(({ id }) => id), ["incident-1"]);
  assert.equal(merged[0].is_read, true);
});

test("ignores malformed realtime payloads and applies the bell limit", () => {
  const current = Array.from({ length: 20 }, (_, index) =>
    notification(`incident-${index}`, `2026-09-02T00:${String(index).padStart(2, "0")}:00.000Z`));

  const merged = notificationState.mergeNotifications(
    current,
    [{ id: "incident-21" }, null, "not a notification"],
    20,
  );

  assert.equal(merged.length, 20);
  assert.equal(merged[0].id, "incident-19");
  assert.equal(merged.some(({ id }) => id === "incident-21"), false);
  assert.equal(notificationState.isAppNotification(current[0]), true);
  assert.equal(notificationState.isAppNotification({ id: "missing-fields" }), false);
});