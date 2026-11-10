import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { createServer, type ViteDevServer } from "vite";

let server: ViteDevServer;
const course = { id: "course-1", title: "Kursus uji", course_code: "UJI", status: "draft", description_markdown: "", focus_areas: [], siap_focus: [], audience: "" };
const lesson = { id: "lesson-1", course_id: course.id, title: "Pelajaran uji", slug: "pelajaran-uji", content_markdown: "Materi", passing_score: 70, is_published: false, sort_order: 0, session_id: null };
const question = { id: "q1", lesson_id: lesson.id, question_text: "Soal", options: ["A", "B"], points: 1 };
const key = { question_id: question.id, correct_option: 0 };
let questions: unknown[] = [];
let keys: unknown[] = [];
let rpcError: { message: string } | null = null;
const writes: unknown[] = [];
const messages: { title: string; description?: string }[] = [];
const toast = (message: any) => messages.push(message);

const client = {
  rpc(name: string, args: unknown) {
    writes.push({ rpc: name, args });
    return Promise.resolve({ data: rpcError ? null : question, error: rpcError });
  },
  from(table: string) {
    let mutation: unknown;
    let single = false;
    const query: any = {
      select: () => query,
      order: () => query,
      eq: () => query,
      in: () => query,
      limit: () => query,
      single: () => { single = true; return query; },
      delete: () => { mutation = { delete: table }; return query; },
      update: (payload: unknown) => { mutation = payload; return query; },
      insert: (payload: unknown) => { mutation = payload; return query; },
      then(resolve: (result: unknown) => unknown) {
        if (mutation) {
          writes.push(mutation);
          return Promise.resolve(resolve({ data: [], error: null }));
        }
        const rows: Record<string, unknown[]> = {
          aspekindo_lms_courses: [course],
          aspekindo_lms_lessons: [lesson],
          aspekindo_lms_quiz_questions: questions,
          aspekindo_lms_quiz_answer_keys: keys,
        };
        const data = rows[table] ?? [];
        return Promise.resolve(resolve({ data: single ? data[0] : data, error: null }));
      },
    };
    return query;
  },
};

test.before(async () => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  (globalThis as any).__lmsPublish = { client, toast };
  process.env.PORT ||= "4173";
  process.env.BASE_PATH ||= "/";
  server = await createServer({
    configFile: new URL("../../vite.config.ts", import.meta.url).pathname,
    cacheDir: "node_modules/.vite-lms-publication-tests",
    optimizeDeps: { noDiscovery: true, include: [] },
    server: { middlewareMode: true },
    appType: "custom",
    plugins: [{
      name: "lms-publication-fixtures",
      enforce: "pre",
      resolveId(id) {
        if (/\/integrations\/supabase\/client(?:\.ts)?$/.test(id) || id === "./client") return "\0lms-db";
        if (id.endsWith("/lib/ruang-simpan")) return "\0lms-companies";
        if (id.endsWith("/hooks/useAuth")) return "\0lms-auth";
        if (id.endsWith("/hooks/use-toast")) return "\0lms-toast";
        if (id.includes("/components/ui/")) return "\0lms-ui";
      },
      load(id) {
        if (id === "\0lms-db") return "export const supabase = globalThis.__lmsPublish.client;";
        if (id === "\0lms-companies") return "export const canonicalCompanies = async () => [];";
        if (id === "\0lms-auth") return "export const useAuth = () => ({user: {id:'admin'}});";
        if (id === "\0lms-toast") return "export const useToast = () => ({toast: globalThis.__lmsPublish.toast});";
        if (id === "\0lms-ui") return `
          import React from "react";
          const Box = ({children, ...props}) => React.createElement("div", props, children);
          export const Button = ({children, ...props}) => React.createElement("button", props, children);
          export const Input = props => React.createElement("input", props);
          export const Textarea = props => React.createElement("textarea", props);
          export const Switch = props => React.createElement("switch", props);
          export const Dialog = ({open, children}) => open ? React.createElement("div", null, children) : null;
          export const Select = Box, SelectContent = Box, SelectItem = Box, SelectTrigger = Box, SelectValue = Box;
          export const Badge = Box, Card = Box, CardContent = Box, CardDescription = Box, CardHeader = Box, CardTitle = Box;
          export const DialogContent = Box, DialogFooter = Box, DialogHeader = Box, DialogTitle = Box;
          export const Label = Box, Progress = Box, Tabs = Box, TabsContent = Box, TabsList = Box, TabsTrigger = Box;
          export const Table = Box, TableBody = Box, TableCell = Box, TableHead = Box, TableHeader = Box, TableRow = Box;
          export const MarkdownRenderer = Box;
        `;
      },
    }],
  });
});

test.after(async () => {
  await server.close();
  delete (globalThis as any).__lmsPublish;
});

function text(node: any): string {
  if (typeof node === "string") return node;
  return (node.children ?? []).map(text).join("");
}

for (const manager of ["Quiz", "Courses"]) {
  test(`${manager}: opsi/kunci invalid tidak ditulis; perubahan opsi dan kunci valid dikirim atomik`, async () => {
    questions = [{ ...question, options: ["A", "B", "C"] }];
    keys = [{ ...key, correct_option: 2 }];
    writes.length = messages.length = 0;
    lesson.is_published = true;
    let root!: ReactTestRenderer;
    if (manager === "Quiz") {
      const { default: Component } = await server.ssrLoadModule("/src/components/aspekindo/AdminAspekindoLmsQuiz.tsx");
      await act(async () => { root = create(React.createElement(Component, { course, lessons: [lesson], userId: "admin" })); });
    } else {
      const { default: Page } = await server.ssrLoadModule("/src/pages/admin/AdminAspekindoLmsCourses.tsx");
      await act(async () => { root = create(React.createElement(Page)); });
      await act(async () => button(root, "Kuis (1)").props.onClick());
      const bankText = text(root.toJSON());
      assert.match(bankText, /Poin adalah bobot nilai soal/);
      assert.match(bankText, /Bobot: 1 poin/);
      assert.match(bankText, /25%.*75%/);
    }
    try {
      await act(async () => root.root.findAllByType("button").filter((node) => text(node).trim() === "Edit").at(-1)!.props.onClick());
      const save = () => button(root, manager === "Quiz" ? "Simpan pertanyaan" : "Simpan perubahan");
      const change = async (node: any, value: string) => {
        await act(async () => node.props.onChange({ target: { value } }));
      };
      if (manager === "Quiz") {
        await change(root.root.findByProps({ id: "native-quiz-options" }), "A");
      } else {
        await change(root.root.findByProps({ value: "B", placeholder: "Opsi 2" }), "");
        await change(root.root.findByProps({ value: "C", placeholder: "Opsi 3" }), "");
      }
      await act(async () => { await save().props.onClick(); });
      assert.equal(writes.length, 0);
      if (manager === "Quiz") {
        await change(root.root.findByProps({ id: "native-quiz-options" }), "A\nB");
      } else {
        await change(root.root.findByProps({ value: "", placeholder: "Opsi 2" }), "B");
      }
      // Selected key still points at removed option C.
      await act(async () => { await save().props.onClick(); });
      assert.equal(writes.length, 0);
      if (manager === "Quiz") {
        await change(root.root.findByProps({ id: "native-quiz-correct" }), "0");
      } else {
        await act(async () => root.root.findByProps({ "aria-label": "Jawaban benar opsi 1" }).props.onChange());
      }
      rpcError = { message: "Penyimpanan gagal" };
      await act(async () => { await save().props.onClick(); });
      assert.equal(writes.length, 1);
      assert.match(messages.at(-1)!.title, /gagal/);
      assert.equal(save().props.disabled, false);
      rpcError = null;
      await act(async () => { await save().props.onClick(); });
      assert.equal(writes.length, 2);
      for (const write of writes as any[]) {
        assert.equal(write.rpc, "save_aspekindo_lms_quiz_question");
        assert.deepEqual(write.args._options, ["A", "B"]);
        assert.equal(write.args._correct_option, 0);
      }
    } finally {
      lesson.is_published = false;
      rpcError = null;
      await act(async () => root.unmount());
    }
  });

  test(`${manager}: penghapusan soal terakhir ditolak meski status layar masih draf; soal valid lain mengizinkan hapus`, async () => {
    questions = [question];
    keys = [key];
    writes.length = messages.length = 0;
    const staleLesson = { ...lesson, is_published: false };
    // The UI loads a draft, but the next operation must read the new published status.
    let root!: ReactTestRenderer;
    if (manager === "Quiz") {
      const { default: Component } = await server.ssrLoadModule("/src/components/aspekindo/AdminAspekindoLmsQuiz.tsx");
      await act(async () => { root = create(React.createElement(Component, { course, lessons: [staleLesson], userId: "admin" })); });
    } else {
      const { default: Page } = await server.ssrLoadModule("/src/pages/admin/AdminAspekindoLmsCourses.tsx");
      await act(async () => { root = create(React.createElement(Page)); });
      await act(async () => button(root, "Kuis (1)").props.onClick());
    }
    lesson.is_published = true;
    const previousWindow = globalThis.window;
    (globalThis as any).window = { confirm: () => true };
    try {
      const remove = () => manager === "Quiz"
        ? root.root.findAllByType("button").find((node) => node.props.className === "text-destructive")!
        : button(root, "Hapus");
      await act(async () => { await remove().props.onClick(); });
      assert.equal(writes.length, 0);
      assert.match(messages.at(-1)!.description!, /soal valid lain.*draf/);
      // No UI refresh: a fresh bank read must find this new valid question.
      questions = [question, { ...question, id: "q2" }];
      keys = [key, { ...key, question_id: "q2" }];
      await act(async () => { await remove().props.onClick(); });
      assert.deepEqual(writes, [{ delete: "aspekindo_lms_quiz_questions" }]);
    } finally {
      lesson.is_published = false;
      (globalThis as any).window = previousWindow;
      await act(async () => root.unmount());
    }
  });
}

function button(root: ReactTestRenderer, label: string) {
  return root.root.findAllByType("button").find((node) => text(node).trim() === label)!;
}

test("tombol Terbitkan langsung menahan kuis kosong, lalu lolos setelah soal dan kunci dilengkapi", async () => {
  questions = [];
  keys = [];
  writes.length = messages.length = 0;
  const { default: Page } = await server.ssrLoadModule("/src/pages/admin/AdminAspekindoLmsNative.tsx");
  let root!: ReactTestRenderer;
  await act(async () => { root = create(React.createElement(Page)); });
  // The course and lesson each have a publish button; the lesson is last.
  const publish = () => root.root.findAllByType("button").filter((node) => text(node).trim() === "Terbitkan").at(-1)!;
  await act(async () => { await publish().props.onClick(); });
  assert.equal(writes.length, 0);
  assert.match(messages.at(-1)!.description!, /draf.*Bank soal/);
  questions = [question];
  keys = [key];
  await act(async () => { await publish().props.onClick(); });
  assert.deepEqual(writes, [{ is_published: true }]);
  await act(async () => root.unmount());
});

for (const page of ["AdminAspekindoLmsNative", "AdminAspekindoLmsCourses"]) {
  test(`${page}: simpan edit tidak menerbitkan tanpa soal, tetapi menerima soal valid`, async () => {
    questions = [];
    keys = [];
    writes.length = messages.length = 0;
    const { default: Page } = await server.ssrLoadModule(`/src/pages/admin/${page}.tsx`);
    let root!: ReactTestRenderer;
    await act(async () => { root = create(React.createElement(Page)); });
    const edit = page.endsWith("Courses")
      ? root.root.findAllByType("button").find((node) => node.props["aria-label"] === "Edit pelajaran Pelajaran uji")!
      : root.root.findAllByType("button").filter((node) => text(node).trim() === "Edit").at(-1)!;
    await act(async () => edit.props.onClick());
    const publishSwitch = root.root.findAllByType("switch").find((node) => node.props.id === "native-lesson-published")!;
    await act(async () => publishSwitch.props.onCheckedChange(true));
    await act(async () => { await button(root, "Simpan pelajaran").props.onClick(); });
    assert.equal(writes.length, 0);
    assert.match(messages.at(-1)!.description!, /draf.*Bank soal/);
    assert.equal(button(root, "Simpan pelajaran").props.disabled, false);
    questions = [question];
    keys = [key];
    await act(async () => { await button(root, "Simpan pelajaran").props.onClick(); });
    assert.equal(writes.length, 1);
    assert.equal((writes[0] as any).is_published, true);
    await act(async () => root.unmount());
  });
}
