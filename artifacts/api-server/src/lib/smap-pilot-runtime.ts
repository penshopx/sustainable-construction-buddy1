import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { mkdtemp, mkdir, readFile, realpath, rm } from "node:fs/promises";
import path from "node:path";
import type { SmapPilotDocument } from "@workspace/api-zod";
import { PilotError, pilotJson, unavailable } from "./smap-pilot-data";
import { chatModel } from "./chat-engines";
import { chatSystemPrompt } from "./chat-policy";
import { HermesBillingError } from "./hermes-billing-error";

const commit = "4d04303818b61bf3aa09278af48356315515965b";
const assetKeys = [
  "HERMES_NODE", "HERMES_REVISION", "HERMES_PYTHON", "HERMES_INSTALL_ROOT",
  "HERMES_BUNDLED_LOCALES", "HERMES_OPTIONAL_MCPS", "HERMES_OPTIONAL_SKILLS",
  "HERMES_BUNDLED_PLUGINS", "HERMES_BUNDLED_SKILLS", "HERMES_TUI_DIR", "HERMES_WEB_DIST",
];
export function pilotPaths() {
  const cwd = process.cwd();
  const artifact = path.basename(cwd) === "api-server" ? cwd : path.join(cwd, "artifacts/api-server");
  return { artifact, output: path.resolve(artifact, "../../generated-artifacts/hermes") };
}
async function runtimeInfo() {
  const runtime = await realpath(path.join(pilotPaths().output, "runtime")).catch(() => { throw unavailable(); });
  if (!runtime.startsWith("/nix/store/")) throw unavailable();
  const map = JSON.parse(await readFile(path.join(runtime, "command-map.json"), "utf8"));
  if (map.env?.HERMES_REVISION !== commit) throw unavailable();
  const entry = await readFile(map.commands.hermes.source, "utf8");
  const interpreter = entry.split("\n")[0].slice(2);
  if (!/^\/nix\/store\/[^/]+\/bin\/python3(?:\.\d+)?$/.test(interpreter)) throw unavailable();
  return { interpreter, assets: Object.fromEntries(assetKeys
    .filter(key => typeof map.env[key] === "string").map(key => [key, map.env[key] as string])) };
}
export async function assertPilotRuntime() { await runtimeInfo(); }

export function pilotAnswer(value: unknown, model: string): string {
  const data = value as {
    model?: unknown; choices?: { finish_reason?: unknown; message?: { content?: unknown } }[];
  } | null;
  const choice = data?.choices?.[0];
  if (data?.model !== model || choice?.finish_reason !== "stop" ||
      typeof choice.message?.content !== "string" || !choice.message.content.trim() ||
      choice.message.content.length > 12000) throw unavailable();
  return choice.message.content.trim();
}

type LocalSchemeFixture = { question: string; context: string; reply: string };
type SchemeTask = (LocalSchemeFixture & { kind: "local" }) |
  { kind: "claude"; question: string; context: string; systemPrompt: string };

async function runHermesPilot(
  documents: SmapPilotDocument[], env: NodeJS.ProcessEnv, signal: AbortSignal, fetchImpl: typeof fetch = fetch,
  scheme?: SchemeTask,
) {
  const info = await runtimeInfo();
  if (signal.aborted) throw unavailable();
  const local = scheme?.kind === "local";
  if (!local && !env.OPENROUTER_API_KEY) throw unavailable();
  const model = local ? "hermes-scheme-local-fixture" : chatModel("claude", env);
  // Re-index each selection. Never send member/document IDs or raw field values.
  const metadata = scheme
    ? { scheme_code: "BG001", question: scheme.question, referenceContext: scheme.context }
    : documents.map(({ type, checks }, i) => ({ document: i + 1, type, checks }));
  const capability = randomBytes(32).toString("hex");
  const home = await mkdtemp(path.join(pilotPaths().output, "job-"));
  await mkdir(path.join(home, "tmp"), { mode: 0o700 });
  const controller = new AbortController();
  const cancel = () => controller.abort();
  signal.addEventListener("abort", cancel, { once: true });
  const deadline = setTimeout(cancel, 85_000);
  let used = false, answer = "", proxyError: unknown;
  let child: ReturnType<typeof spawn> | undefined;
  let forcedKill: NodeJS.Timeout | undefined;
  const kill = () => {
    if (!child?.pid || child.exitCode !== null || child.signalCode !== null) return;
    try { process.kill(-child.pid, "SIGTERM"); } catch {}
    forcedKill ??= setTimeout(() => {
      try { process.kill(-child!.pid!, "SIGKILL"); } catch {}
    }, 2000);
    forcedKill.unref();
  };
  controller.signal.addEventListener("abort", kill, { once: true });
  const server = createServer(async (req, res) => {
    try {
      if (req.method !== "POST" || req.url !== "/v1/chat/completions" ||
          req.headers.authorization !== `Bearer ${capability}` || used || controller.signal.aborted) {
        res.writeHead(403).end(); return;
      }
      used = true; // Includes invalid requests and provider failures; no paid retry.
      let text = "";
      for await (const chunk of req) {
        text += chunk.toString();
        if (Buffer.byteLength(text) > 131072) throw unavailable();
      }
      const body = JSON.parse(text);
      if (body.model !== "pilot-claude" || body.tools?.length) throw unavailable();
      if (scheme && !Array.isArray(body.messages)) throw unavailable();
      if (scheme && !body.messages.some((message: { role?: unknown; content?: unknown }) => {
        if (message.role !== "user" || typeof message.content !== "string") return false;
        try {
          const received = JSON.parse(message.content);
          return received.scheme_code === "BG001" && received.question === scheme.question &&
            received.referenceContext === scheme.context;
        } catch { return false; }
      })) throw unavailable();
      // The scheme fixture branch has no model-network call, regardless of host credentials.
      // For SMAP, SDK context still never goes to the provider.
      const upstream = scheme?.kind === "local" ? Response.json({ model, choices: [{
        finish_reason: "stop", message: { content: scheme.reply },
      }] }) : await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST", redirect: "error",
        headers: { Authorization: `Bearer ${env.OPENROUTER_API_KEY}`, "Content-Type": "application/json" },
        signal: AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]),
        body: JSON.stringify({
          model, stream: false, max_tokens: 1800, temperature: 0.1,
          provider: { allow_fallbacks: false, data_collection: "deny" },
          messages: [
            { role: "system", content: chatSystemPrompt() + (scheme?.kind === "claude" ? "\n" + scheme.systemPrompt :
              "\nTugas tetap: periksa indikator keterisian metadata SMAP saja. Beri draf dalam Bahasa Indonesia, " +
              "urutkan per nomor dokumen, sebutkan indikator belum terisi dan saran melengkapinya. " +
              "Indikator ini bukan daftar kewajiban hukum. Jangan menilai isi, keaslian, masa berlaku, " +
              "sertifikasi, kelulusan, atau menyatakan telah membaca lampiran. Jangan memberi skor kelayakan. " +
              "Semua indikator terisi pun bukan bukti kepatuhan. Jangan meminta data pribadi atau tautan berkas.") },
            { role: "user", content: JSON.stringify(metadata) },
          ],
        }),
      });
      if (!upstream.ok) throw unavailable();
      answer = pilotAnswer(await pilotJson(upstream, 128 * 1024), model);
      if (controller.signal.aborted) throw unavailable();
      if (body.stream) {
        const chunk = { id: "pilot", object: "chat.completion.chunk", created: 0, model: "pilot-claude",
          choices: [{ index: 0, delta: { role: "assistant", content: answer }, finish_reason: null }] };
        res.writeHead(200, { "Content-Type": "text/event-stream" });
        res.end(`data: ${JSON.stringify(chunk)}\n\ndata: ${JSON.stringify({
          ...chunk, choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
        })}\n\ndata: [DONE]\n\n`);
        return;
      }
      res.writeHead(200, { "Content-Type": "application/json" }).end(JSON.stringify({
        id: "pilot", object: "chat.completion", created: 0, model: "pilot-claude",
        choices: [{ index: 0, message: { role: "assistant", content: answer }, finish_reason: "stop" }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      }));
    } catch (error) {
      proxyError = error;
      if (!res.destroyed) res.writeHead(503).end();
      kill();
    }
  });
  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject); server.listen(0, "127.0.0.1", resolve);
    });
    if (signal.aborted) controller.abort();
    if (controller.signal.aborted) throw unavailable();
    const address = server.address();
    if (!address || typeof address === "string") throw unavailable();
    child = spawn(info.interpreter, ["-I", "-B", path.join(pilotPaths().artifact, "scripts/hermes-worker.py")], {
      detached: true, cwd: home, stdio: ["pipe", "pipe", "pipe"],
      env: { ...info.assets, PATH: "/usr/bin:/bin", HOME: home, HERMES_HOME: path.join(home, "hermes"),
        XDG_CONFIG_HOME: path.join(home, "config"), XDG_CACHE_HOME: path.join(home, "cache"),
        TMPDIR: path.join(home, "tmp"), LANG: "C.UTF-8" },
    });
    let stdout = "", bytes = 0, overflow = false;
    child.stdout!.on("data", (chunk: Buffer) => {
      bytes += chunk.length;
      if (bytes > 65536) { overflow = true; kill(); } else stdout += chunk.toString();
    });
    child.stderr!.on("data", (chunk: Buffer) => { bytes += chunk.length; if (bytes > 65536) { overflow = true; kill(); } });
    child.stdin!.on("error", () => {}); // A failed worker may exit before accepting its input.
    child.stdin!.end(JSON.stringify({
      endpoint: `http://127.0.0.1:${address.port}/v1`, capability, metadata,
    }));
    const code = await new Promise<number | null>(resolve => {
      child!.once("error", () => resolve(1)); child!.once("close", resolve);
    });
    if (controller.signal.aborted) throw new PilotError(504, "pilot_timeout", "Analisis dihentikan atau melewati batas waktu. Tidak ada pengiriman ulang otomatis.");
    if (proxyError) {
      if (scheme?.kind === "claude" && proxyError instanceof HermesBillingError) throw new HermesBillingError();
      throw unavailable();
    }
    const lines = stdout.split("\n").filter(line => line.startsWith("PUB_PILOT_RESULT:"));
    if (code !== 0 || overflow || lines.length !== 1 || !used || !answer) throw unavailable();
    const result = JSON.parse(lines[0]!.slice("PUB_PILOT_RESULT:".length));
    if (result.completed !== true || result.analysis?.trim() !== answer) throw unavailable();
    return { analysis: answer, model, documentCount: documents.length, runtime: "hermes" as const };
  } finally {
    clearTimeout(deadline); signal.removeEventListener("abort", cancel);
    controller.abort();
    kill();
    await new Promise<void>(resolve => {
      server.close(() => resolve()); server.closeAllConnections();
    });
    // Fetches and worker receive cancellation even after the HTTP response has closed.
    if (forcedKill) clearTimeout(forcedKill);
    await rm(home, { recursive: true, force: true });
  }
}

export async function runSmapPilot(
  documents: SmapPilotDocument[], env: NodeJS.ProcessEnv, signal: AbortSignal, fetchImpl: typeof fetch = fetch,
) {
  const result = await runHermesPilot(documents, env, signal, fetchImpl);
  return { ...result, dataScope: "presence-only" as const };
}

/** Fixed reference-only local fixture: no provider key or real fetch implementation. */
export async function runHermesSchemeFixture(fixture: LocalSchemeFixture, signal: AbortSignal) {
  if (!fixture.question || fixture.question.length > 2000 || !fixture.context ||
      fixture.context.length >= 16000 || !fixture.reply || fixture.reply.length > 12000 ||
      Buffer.byteLength(JSON.stringify({ scheme_code: "BG001", question: fixture.question, referenceContext: fixture.context })) > 30000)
    throw unavailable();
  return runHermesPilot([], {}, signal, async () => { throw unavailable(); }, { ...fixture, kind: "local" });
}

/** Only a server-owned question/reference packet; never SDK history, JWT or member files. */
export async function runHermesSchemeChat(
  task: { question: string; context: string; systemPrompt: string },
  env: NodeJS.ProcessEnv, signal: AbortSignal, fetchImpl: typeof fetch = fetch,
) {
  if (!task.question.trim() || task.question.length > 1000 ||
      Buffer.byteLength(JSON.stringify(task)) > 30000) throw unavailable();
  return runHermesPilot([], env, signal, fetchImpl, { ...task, kind: "claude" });
}
