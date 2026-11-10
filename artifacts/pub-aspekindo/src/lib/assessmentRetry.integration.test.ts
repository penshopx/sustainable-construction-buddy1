import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { create, act, type ReactTestRenderer } from "react-test-renderer";
import { createServer, type ViteDevServer } from "vite";

let server: ViteDevServer;
let Assessment: any;
let AuthContext: any;
const api: any = {};
const events = new EventTarget();
const storage = new Map<string, string>();
type StorageFailure = "security-access" | "security-methods" | "quota";
const storageAttempts = { access: 0, read: 0, write: 0, remove: 0 };
const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");

function installStorage(failure?: StorageFailure) {
  storageAttempts.access = storageAttempts.read = storageAttempts.write = storageAttempts.remove = 0;
  const denied = () => { throw new DOMException("Browser storage is blocked", "SecurityError"); };
  if (failure === "security-access") {
    Object.defineProperty(globalThis, "localStorage", { configurable: true, get() {
      storageAttempts.access++;
      return denied();
    } });
    return;
  }
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem(key: string) {
      storageAttempts.read++;
      if (failure === "security-methods") return denied();
      return storage.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      storageAttempts.write++;
      if (failure === "security-methods") return denied();
      if (failure === "quota") throw new DOMException("Browser storage is full", "QuotaExceededError");
      storage.set(key, value);
    },
    removeItem(key: string) {
      storageAttempts.remove++;
      if (failure === "security-methods") return denied();
      storage.delete(key);
    },
  } });
}

const question = { id: "q1", question_text: "Pilih jawaban", options: ["A", "B"], difficulty: "Pemula" };
let calls = 0;
let fail = true;
let hold: (() => void) | null = null;
let saved: any;
let root: ReactTestRenderer;
let rpcNames: string[] = [];
let startPayload: any;

test.before(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as any).__assessmentRetryApi = api;
  (globalThis as any).window = events;
  (globalThis as any).document = new EventTarget();
  installStorage();
  process.env.PORT ||= "4173";
  process.env.BASE_PATH ||= "/";
  server = await createServer({
    configFile: new URL("../../vite.config.ts", import.meta.url).pathname,
    cacheDir: "node_modules/.vite-assessment-retry-tests",
    ssr: { noExternal: ["framer-motion", "recharts"] },
    optimizeDeps: { noDiscovery: true, include: [] },
    plugins: [{
      name: "assessment-retry-stubs", enforce: "pre",
      resolveId(id) {
        if (/\/integrations\/supabase\/client(?:\.ts)?$/.test(id)) return "\0retry-api";
        if (id === "recharts") return "\0retry-charts";
        if (/\/components\/ui\/sonner-toast(?:\.ts)?$/.test(id)) return "\0retry-toast";
        if (id === "framer-motion") return "\0retry-motion";
      },
      load(id) {
        if (id === "\0retry-api") return "export const supabase = globalThis.__assessmentRetryApi;";
        if (id === "\0retry-toast") return "export const toast = { error() {}, warning() {} };";
        if (id === "\0retry-motion") return "import React from 'react'; export const AnimatePresence = ({children}) => children; export const motion = new Proxy({}, { get: (_, tag) => tag });";
        if (id === "\0retry-charts") return "export const BarChart = () => null; export const Bar = BarChart, XAxis = BarChart, YAxis = BarChart, Tooltip = BarChart, ResponsiveContainer = BarChart, Cell = BarChart;";
      },
    }],
    server: { middlewareMode: true }, appType: "custom",
  });
  Assessment = (await server.ssrLoadModule("/src/pages/Assessment.tsx")).default;
  AuthContext = (await server.ssrLoadModule("/src/hooks/useAuth.tsx")).AuthContext;
});

test.after(async () => {
  await server.close();
  delete (globalThis as any).__assessmentRetryApi;
  if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
  else delete (globalThis as any).localStorage;
});

test.afterEach(async () => {
  if (root) await act(async () => { root.unmount(); });
  installStorage();
});

async function mount(options: {
  storageFailure?: StorageFailure; unanswered?: boolean;
  browserOnly?: boolean; duplicate?: boolean; completedBackup?: boolean;
  expired?: boolean; submitResponse?: unknown; startFails?: boolean;
} = {}) {
  calls = 0; fail = true; hold = null; storage.clear();
  rpcNames = []; startPayload = null;
  installStorage(options.storageFailure);
  const now = Date.now();
  const deadline = now + (options.expired ? -1000 : 90000);
  saved = {
    version: 1, preTestId: "assessment-a", questions: [question], answers: options.unanswered ? {} : { q1: 1 },
    answerResults: {}, currentQ: 0, phase: options.unanswered ? "test" : "review", timeLeft: 90, timedOut: false,
    deadlineAt: deadline, revision: 0,
  };
  if (options.duplicate) saved.questions = [question, question];
  if (options.browserOnly) storage.set("pub_assessment_draft_v1:owner", JSON.stringify(saved));
  api.rpc = async (name: string, args: any) => {
    rpcNames.push(name);
    if (name === "get_active_assessment_draft") return { data: options.browserOnly ? null : {
      preTestId: saved.preTestId, draft: saved, totalQuestions: saved.questions.length,
      deadlineAt: new Date(deadline).toISOString(), serverNow: new Date(now).toISOString(),
    } };
    if (name === "get_questions_safe") return { data: [{ ...question, domain_id: "d1" }] };
    if (name === "start_assessment_draft") {
      startPayload = args._draft;
      if (options.startFails) return { error: { message: "Network unavailable" } };
      saved = { ...args._draft, preTestId: "assessment-new", deadlineAt: now + 90000, revision: 0 };
      return { data: { preTestId: saved.preTestId, deadlineAt: new Date(now + 90000).toISOString(), serverNow: new Date(now).toISOString() } };
    }
    if (name === "save_assessment_draft") {
      calls++;
      if (hold) await new Promise<void>(resolve => { hold = resolve; });
      if (fail) return { error: { message: "Network unavailable" } };
      saved = { ...args._draft, revision: saved.revision + 1 };
      return { data: { saved: true, draft: saved } };
    }
    if (name === "check_question_answer") return { data: null };
    if (name === "submit_assessment") return { data: options.submitResponse ?? { score: 100, correct: 1, total: 1, level: "Utama" } };
    throw new Error(`Unexpected RPC: ${name}`);
  };
  api.from = (table: string) => {
    const query: any = {};
    for (const method of ["select", "eq"]) query[method] = () => query;
    query.order = () => ({ ...query, order: async () => ({ data: [] }) });
    query.maybeSingle = async () => ({ data: { id: saved.preTestId, status: options.completedBackup ? "completed" : "in_progress" } });
    query.then = (resolve: any) => Promise.resolve({
      data: table === "competency_domains" ? [{ id: "d1", name: "Manajemen" }] : [],
    }).then(resolve);
    return query;
  };
  await renderAssessment();
}

// Render a fresh component without resetting the server fixture or browser storage.
// Reload tests must retain the RPC closure, saved draft, and storage failure.
async function renderAssessment() {
  await act(async () => {
    root = create(React.createElement(AuthContext.Provider, { value: {
      user: { id: "owner" }, refreshProfile: async () => undefined,
    } }, React.createElement(Assessment)));
  });
}
const text = () => JSON.stringify(root.toJSON());
const childText = (children: any): string => React.Children.toArray(children).map(child =>
  typeof child === "string" ? child : React.isValidElement<{ children?: React.ReactNode }>(child)
    ? childText(child.props.children) : "").join("");
const online = async () => { await act(async () => { events.dispatchEvent(new Event("online")); }); };
const buttonNamed = (name: string) => {
  const button = root.root.findAllByType("button").find(button => childText(button.props.children).includes(name));
  assert.ok(button, `Missing button: ${name}`);
  return button;
};

for (const duplicate of [false, true]) {
  test(`draf browser-only${duplicate ? " dengan ID duplikat" : ""} menawarkan sesi baru tanpa mengirim daftar soal lama`, async () => {
    await mount({ browserOnly: true, duplicate });
    assert.match(text(), /Assessment lama perlu dimulai ulang/);
    assert.deepEqual(rpcNames, ["get_active_assessment_draft"]);
    assert.equal(storage.size, 1, "backup stays until a new session is accepted");
    await online();
    assert.equal(calls, 0);
    fail = false;
    await act(async () => { await buttonNamed("Mulai Ulang Assessment").props.onClick(); });
    assert.equal(startPayload.preTestId, "pending");
    assert.deepEqual(startPayload.answers, {});
    assert.equal(startPayload.questions.length, 1);
    assert.equal(saved.preTestId, "assessment-new");
    assert.doesNotMatch(text(), /Assessment lama perlu dimulai ulang/);
    assert.match(text(), /Progres tersimpan di server/);
    assert.equal(storage.size, 0);
  });
}

test("draf server ber-ID duplikat menawarkan mulai ulang, bukan retry pemulihan", async () => {
  await mount({ duplicate: true });
  assert.match(text(), /Assessment lama perlu dimulai ulang/);
  assert.doesNotMatch(text(), /Draf assessment belum dapat diperiksa/);
  await online();
  assert.equal(calls, 0);
});

test("kegagalan mulai ulang mempertahankan penjelasan dan cadangan; hasil selesai bukan draf untuk dimulai ulang", async () => {
  await mount({ browserOnly: true, startFails: true });
  await act(async () => { await buttonNamed("Mulai Ulang Assessment").props.onClick(); });
  assert.match(text(), /Assessment lama perlu dimulai ulang/);
  assert.equal(storage.size, 1);
  assert.equal(calls, 0);
  await act(async () => { root.unmount(); });
  await mount({ browserOnly: true, completedBackup: true });
  assert.doesNotMatch(text(), /Assessment lama perlu dimulai ulang/);
  assert.equal(buttonNamed("Mulai Assessment").props.disabled, false);
  assert.deepEqual(rpcNames, ["get_active_assessment_draft"]);
});

for (const error of ["Invalid assessment questions", "Assessment draft unavailable; restart assessment"]) {
  for (const expired of [false, true]) {
    test(`${error}: ${expired ? "submit otomatis" : "submit manual"} berhenti dan menawarkan mulai ulang`, async (t) => {
      t.mock.timers.enable({ apis: ["setTimeout"] });
      await mount({ submitResponse: { error }, expired });
      if (!expired) {
        fail = false;
        await online();
        await act(async () => { await buttonNamed("Selesai & Lihat Hasil").props.onClick(); });
      }
      assert.match(text(), /Assessment lama perlu dimulai ulang/);
      assert.equal(rpcNames.filter(name => name === "submit_assessment").length, 1);
      const saves = calls;
      await online();
      await act(async () => { t.mock.timers.tick(60000); });
      assert.equal(calls, saves);
      assert.equal(rpcNames.filter(name => name === "submit_assessment").length, 1);
      assert.equal(startPayload, null, "restart requires a member's explicit choice");
      await act(async () => { root.unmount(); });
      t.mock.timers.reset();
    });
  }
}

test("kesalahan submit sementara tetap di review dan assessment valid dapat dikirim ulang", async () => {
  await mount({ submitResponse: { error: "Network unavailable" } });
  fail = false;
  await online();
  await act(async () => { await buttonNamed("Selesai & Lihat Hasil").props.onClick(); });
  assert.match(text(), /Review Jawaban/);
  assert.doesNotMatch(text(), /Assessment lama perlu dimulai ulang/);
  const originalRpc = api.rpc;
  api.rpc = async (name: string, args: any) => name === "submit_assessment"
    ? { data: { score: 100, correct: 1, total: 1, level: "Utama" } }
    : originalRpc(name, args);
  await act(async () => { await buttonNamed("Selesai & Lihat Hasil").props.onClick(); });
  assert.match(text(), /Assessment Selesai/);
});

test("gagal simpan lalu pulih tanpa interaksi; backoff dan online tidak menggandakan simpan", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  await mount();
  try {
    assert.equal(calls, 1);
    assert.match(text(), /Penyimpanan tertunda/);
    assert.equal(storage.size, 1);
    await act(async () => { t.mock.timers.tick(2000); });
    assert.equal(calls, 2);
    fail = false;
    await online();
    assert.equal(calls, 3);
    assert.match(text(), /Progres tersimpan di server/);
    assert.equal(storage.size, 0);
    await act(async () => { t.mock.timers.tick(30000); });
    assert.equal(calls, 3);
  } finally {
    await act(async () => { root.unmount(); });
    t.mock.timers.reset();
  }
});

test("kejadian online saat simpan berjalan digabung; selesai dan unmount menghentikan retry", async () => {
  await mount();
  fail = false;
  hold = () => undefined;
  await online();
  assert.equal(calls, 2);
  await online();
  assert.equal(calls, 2);
  await act(async () => { hold!(); hold = null; });
  const submit = root.root.findAllByType("button").find(button =>
    childText(button.props.children).includes("Selesai & Lihat Hasil"));
  assert.ok(submit, root.root.findAllByType("button").map(button => childText(button.props.children)).join("|"));
  await act(async () => { await submit.props.onClick(); });
  assert.match(text(), /Assessment Selesai/);
  const completedCalls = calls;
  await online();
  assert.equal(calls, completedCalls);
  await act(async () => { root.unmount(); });
  await online();
  assert.equal(calls, completedCalls);
});

test("server menutup assessment dari perangkat lain menghentikan semua retry", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  await mount();
  const originalRpc = api.rpc;
  api.rpc = async (name: string, args: any) => {
    if (name !== "save_assessment_draft") return originalRpc(name, args);
    calls++;
    return { error: { message: "Assessment unavailable" } };
  };
  await online();
  assert.equal(calls, 2);
  assert.match(text(), /Assessment sudah berakhir/);
  await online();
  await act(async () => { t.mock.timers.tick(60000); });
  assert.equal(calls, 2);
});

test("perubahan ketika simpan berjalan ikut disimpan sebelum indikator tersimpan", async () => {
  await mount();
  fail = false;
  hold = () => undefined;
  await online();
  const back = root.root.findAllByType("button").find(button =>
    childText(button.props.children).includes("Kembali ke Soal"))!;
  assert.ok(back, root.root.findAllByType("button").map(button => childText(button.props.children)).join("|"));
  await act(async () => { back.props.onClick(); });
  assert.equal(calls, 2);
  await act(async () => { hold!(); hold = null; });
  assert.equal(calls, 3);
  assert.equal(saved.phase, "test");
  assert.match(text(), /Progres tersimpan di server/);
  assert.equal(storage.size, 0);
});

for (const storageFailure of ["security-access", "security-methods", "quota"] as const) {
  for (const useRemote of [false, true]) {
    test(`${storageFailure}: konflik wajib dipilih (${useRemote ? "perangkat lain" : "perangkat ini"}) dan dikonfirmasi server sebelum tersimpan atau dikirim`, async (t) => {
      t.mock.timers.enable({ apis: ["setTimeout"] });
      try {
        await mount({ storageFailure, unanswered: true });
        await act(async () => { await buttonNamed("AA").props.onClick(); });
        await act(async () => { buttonNamed("Review Jawaban").props.onClick(); });
        assert.deepEqual(saved.answers, {}, "the local answer has not been acknowledged");

        const originalRpc = api.rpc;
        let rejectStaleSave = true;
        const submittedAnswers: unknown[] = [];
        const resolutionWrites: any[] = [];
        api.rpc = async (name: string, args: any) => {
          if (name === "save_assessment_draft" && rejectStaleSave) {
            calls++;
            rejectStaleSave = false;
            assert.equal(args._draft.revision, 0);
            assert.deepEqual(args._draft.answers, { q1: 0 });
            // Another device answered the same previously unanswered question.
            // A successful RPC with saved:false is not a save acknowledgement.
            saved = { ...saved, revision: 1, answers: { q1: 1 } };
            return { data: { saved: false, draft: structuredClone(saved) } };
          }
          if (name === "save_assessment_draft") resolutionWrites.push(structuredClone(args._draft));
          if (name === "submit_assessment") {
            submittedAnswers.push(structuredClone(args._answers));
            assert.deepEqual(saved.answers, { q1: useRemote ? 1 : 0 },
              "the server must acknowledge the chosen alternative before submission");
          }
          return originalRpc(name, args);
        };
        await online();
        assert.match(text(), /Ada jawaban berbeda di perangkat lain/);
        assert.equal(childText(buttonNamed("Gunakan jawaban perangkat ini:").props.children),
          "Gunakan jawaban perangkat ini: A");
        assert.equal(childText(buttonNamed("Gunakan jawaban perangkat lain:").props.children),
          "Gunakan jawaban perangkat lain: B");
        assert.match(text(), /pilih jawaban yang berbeda terlebih dahulu/);
        assert.doesNotMatch(text(), /Progres tersimpan di server/);
        assert.equal(buttonNamed("Selesai & Lihat Hasil").props.disabled, true);
        assert.deepEqual(saved.answers, { q1: 1 }, "neither alternative may silently overwrite the other");
        const conflictCalls = calls;
        await online();
        await act(async () => { t.mock.timers.tick(30000); });
        // Exercise the submit guard as well as the disabled review button.
        await act(async () => { await buttonNamed("Selesai & Lihat Hasil").props.onClick(); });
        assert.equal(calls, conflictCalls, "retry and submit must wait for an explicit choice");
        assert.deepEqual(submittedAnswers, []);
        assert.match(text(), /Gunakan jawaban perangkat ini:/);
        assert.match(text(), /Gunakan jawaban perangkat lain:/);

        await act(async () => {
          buttonNamed(useRemote ? "Gunakan jawaban perangkat lain:" : "Gunakan jawaban perangkat ini:").props.onClick();
        });
        const expectedAnswers = { q1: useRemote ? 1 : 0 };
        assert.doesNotMatch(text(), /Ada jawaban berbeda di perangkat lain/);
        assert.match(text(), /Penyimpanan tertunda/);
        assert.doesNotMatch(text(), /Progres tersimpan di server/);
        assert.deepEqual(saved.answers, { q1: 1 }, "choosing alone is not a server confirmation");
        assert.ok(resolutionWrites.length > 0, "resolving must attempt a server save even without browser storage");
        assert.deepEqual(resolutionWrites.at(-1).answers, expectedAnswers);
        assert.equal(resolutionWrites.at(-1).revision, 1, "retry must use the remote concurrency token");
        await act(async () => { await buttonNamed("Selesai & Lihat Hasil").props.onClick(); });
        assert.deepEqual(submittedAnswers, [], "a failed resolution save must block final submission");
        assert.doesNotMatch(text(), /Assessment Selesai|Progres tersimpan di server/);

        fail = false;
        hold = () => undefined;
        await online();
        assert.match(text(), /Menyimpan progres/);
        assert.doesNotMatch(text(), /Progres tersimpan di server/);
        assert.deepEqual(submittedAnswers, []);
        const pendingCalls = calls;
        await online();
        assert.equal(calls, pendingCalls, "reconnect must not duplicate the in-flight resolution");
        await act(async () => { hold!(); hold = null; });
        assert.deepEqual(saved.answers, expectedAnswers);
        assert.equal(saved.revision, 2);
        assert.match(text(), /Progres tersimpan di server/);
        assert.equal(buttonNamed("Selesai & Lihat Hasil").props.disabled, false);
        assert.equal(storage.size, 0, "the entire conflict flow must work without a browser backup");
        if (storageFailure === "security-access") assert.ok(storageAttempts.access > 0);
        else {
          assert.ok(storageAttempts.read > 0);
          assert.ok(storageAttempts.write > 0);
        }
        await act(async () => { t.mock.timers.tick(30000); });
        assert.equal(calls, pendingCalls, "confirmation must stop retries despite failed browser storage");
        await act(async () => { await buttonNamed("Selesai & Lihat Hasil").props.onClick(); });
        assert.deepEqual(submittedAnswers, [[{ question_id: "q1", selected_answer: useRemote ? 1 : 0 }]]);
        assert.match(text(), /Assessment Selesai/);
      } finally {
        if (root) await act(async () => { root.unmount(); });
        t.mock.timers.reset();
      }
    });
  }

  for (const confirmed of [true, false]) {
    test(`${storageFailure}: setelah remount jawaban ${confirmed ? "terkonfirmasi pulih dari server" : "belum terkonfirmasi tidak dianggap tersimpan"}`, async (t) => {
      t.mock.timers.enable({ apis: ["setTimeout"] });
      try {
        await mount({ storageFailure, unanswered: true });
        const originalRpc = api.rpc;
        api.rpc = async (name: string, args: any) => name === "check_question_answer"
          ? { data: { is_correct: true, correct_answer: 0, explanation: "Jawaban A benar" } }
          : originalRpc(name, args);

        await act(async () => { await buttonNamed("AA").props.onClick(); });
        assert.equal(buttonNamed("AA").props.disabled, true);
        assert.match(buttonNamed("AA").props.className, /bg-pub-emerald\/5/);
        assert.equal(buttonNamed("Review Jawaban").props.disabled, false);
        assert.deepEqual(saved.answers, {}, "answer feedback is not a draft-save acknowledgement");
        assert.match(text(), /Penyimpanan tertunda/);
        assert.equal(storage.size, 0, "failed browser writes cannot provide a reload backup");

        if (confirmed) {
          fail = false;
          await online();
          assert.deepEqual(saved.answers, { q1: 0 });
          assert.equal(saved.answerResults.q1.selected, 0);
          assert.match(text(), /Progres tersimpan di server/);
        } else {
          assert.doesNotMatch(text(), /Progres tersimpan di server/);
        }
        const persistedDraft = structuredClone(saved);
        const savesBeforeReload = calls;
        const storageAttemptsBeforeReload = { ...storageAttempts };
        assert.equal(storage.size, 0);

        await act(async () => { root.unmount(); });
        // Block fresh saves so restoration cannot be mistaken for a new acknowledgement.
        fail = true;
        await renderAssessment();
        assert.equal(rpcNames.filter(name => name === "get_active_assessment_draft").length, 2);
        assert.equal(calls, savesBeforeReload + 1);
        assert.deepEqual(saved, persistedDraft, "remount must preserve the server's actual acknowledged snapshot");
        assert.equal(storage.size, 0);
        if (storageFailure === "security-access") {
          assert.ok(storageAttempts.access > storageAttemptsBeforeReload.access);
        } else {
          assert.ok(storageAttempts.read > storageAttemptsBeforeReload.read);
          assert.ok(storageAttempts.write > storageAttemptsBeforeReload.write);
        }
        assert.doesNotMatch(text(), /Assessment lama perlu dimulai ulang/);
        assert.doesNotMatch(text(), /Progres tersimpan di server/);
        assert.equal(buttonNamed("AA").props.disabled, confirmed);
        assert.equal(buttonNamed("BB").props.disabled, confirmed);
        assert.equal(buttonNamed("Review Jawaban").props.disabled, !confirmed);
        if (confirmed) {
          assert.match(buttonNamed("AA").props.className, /bg-pub-emerald\/5/);
          assert.doesNotMatch(buttonNamed("BB").props.className, /bg-pub-emerald\/5/);
        } else {
          assert.doesNotMatch(buttonNamed("AA").props.className, /bg-pub-emerald\/5/);
          assert.doesNotMatch(buttonNamed("BB").props.className, /bg-pub-emerald\/5/);
        }
      } finally {
        if (root) await act(async () => { root.unmount(); });
        t.mock.timers.reset();
      }
    });
  }

  test(`${storageFailure}: cadangan gagal tidak menghentikan retry atau mendahului konfirmasi jawaban terbaru`, async (t) => {
    t.mock.timers.enable({ apis: ["setTimeout"] });
    try {
      await mount({ storageFailure, unanswered: true });
      assert.equal(calls, 1);
      assert.match(text(), /Penyimpanan tertunda/);
      assert.doesNotMatch(text(), /Progres tersimpan di server/);
      assert.equal(storage.size, 0);
      if (storageFailure === "security-access") assert.ok(storageAttempts.access > 0);
      else {
        assert.ok(storageAttempts.read > 0);
        assert.ok(storageAttempts.write > 0);
      }

      // A failed local backup must not prevent the automatic server retry.
      await act(async () => { t.mock.timers.tick(2000); });
      assert.equal(calls, 2);
      assert.match(text(), /Penyimpanan tertunda/);

      // Reconnect, but keep the old snapshot's response in flight.
      fail = false;
      hold = () => undefined;
      await online();
      assert.equal(calls, 3);
      assert.match(text(), /Menyimpan progres/);
      const choice = root.root.findAllByType("button").find(button =>
        childText(button.props.children) === "AA");
      assert.ok(choice);
      assert.equal(choice.props.disabled, false);
      await act(async () => { await choice.props.onClick(); });
      assert.equal(calls, 3, "edits must not start a parallel save");
      assert.deepEqual(saved.answers, {});
      assert.doesNotMatch(text(), /Progres tersimpan di server/);

      // Acknowledge only the old snapshot; hold the newer answer's response too.
      await act(async () => {
        const release = hold!;
        hold = () => undefined;
        release();
      });
      assert.equal(calls, 4);
      assert.deepEqual(saved.answers, {});
      assert.doesNotMatch(text(), /Progres tersimpan di server/);
      assert.equal(storage.size, 0);
      const accessesBeforeAcknowledgement = storageAttempts.access;

      await act(async () => { hold!(); hold = null; });
      assert.deepEqual(saved.answers, { q1: 0 });
      assert.equal(saved.phase, "test");
      assert.match(text(), /Progres tersimpan di server/);
      assert.equal(storage.size, 0);
      if (storageFailure === "security-access") {
        assert.ok(storageAttempts.access > accessesBeforeAcknowledgement);
      } else assert.ok(storageAttempts.remove > 0);
      await act(async () => { t.mock.timers.tick(30000); });
      assert.equal(calls, 4, "confirmation must stop retry even when local cleanup fails");
    } finally {
      if (root) await act(async () => { root.unmount(); });
      t.mock.timers.reset();
    }
  });
}

test("respons yang terlambat setelah unmount tidak memulihkan cadangan atau mencoba lagi", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  await mount();
  hold = () => undefined;
  await online();
  assert.equal(calls, 2);
  await act(async () => { root.unmount(); });
  storage.clear();
  await act(async () => { hold!(); hold = null; });
  await online();
  t.mock.timers.tick(60000);
  assert.equal(calls, 2);
  assert.equal(storage.size, 0);
});
