import { Router, type IRouter, type Request, type Response } from "express";
import {
  GetPublicChatbotParams,
  GetPublicChatbotResponse,
  SendHelpdeskMessageBody,
  SendHelpdeskMessageResponse,
  SendPublicChatbotMessageParams,
  SendPublicChatbotMessageBody,
  SendPublicChatbotMessageResponse,
  GetHelpdeskAiStatusResponse,
} from "@workspace/api-zod";
import { ChatServiceError, createChatService } from "../lib/chat-service";
import { createWindowLimiter } from "../lib/chat-limits";
import { chatModel } from "../lib/chat-engines";

export function createChatRouter(
  options: Parameters<typeof createChatService>[0] & { now?: () => number } = {},
): IRouter {
  const router = Router();
  const service = createChatService(options);
  const now = options.now ?? Date.now;
  const metadataLimit = createWindowLimiter(60_000, 60);
  const messageLimit = createWindowLimiter(5 * 60_000, 20);
  const globalLimit = createWindowLimiter(60 * 60_000, 200, 1);
  const memberLimit = createWindowLimiter(60 * 60_000, 20);
  const analysisLimit = createWindowLimiter(60 * 60_000, 5);
  let activeRequests = 0;
  const localQuota = (memberId: string) => [
    { scope: "helpdesk", ...memberLimit.inspect(memberId, now()) },
    { scope: "claude", ...analysisLimit.inspect(memberId, now()) },
  ];

  function limited(req: Request, res: Response, chat: boolean): boolean {
    res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
    // Do not trust arbitrary X-Forwarded-For headers. Under a shared ingress this
    // deliberately groups visitors until a verified proxy trust policy is set.
    const ip = req.ip || req.socket.remoteAddress || "unknown";
    const wait = (chat ? messageLimit : metadataLimit)(ip, now()) ||
      (chat ? globalLimit("all", now()) : 0) ||
      (activeRequests >= 4 ? 5 : 0);
    if (!wait) return false;
    res.set("Retry-After", String(wait));
    res.status(429).json({ error: "Terlalu banyak permintaan. Silakan coba lagi nanti." });
    return true;
  }

  async function run(req: Request, res: Response, action: (signal: AbortSignal) => Promise<void>): Promise<void> {
    activeRequests += 1;
    const controller = new AbortController();
    const disconnected = () => { if (!res.writableEnded) controller.abort(); };
    res.once("close", disconnected);
    try {
      await action(controller.signal);
    } catch (error) {
      const safeError = error instanceof ChatServiceError
        ? error
        : new ChatServiceError(503, "chat_unavailable", "Layanan chatbot sedang tidak tersedia. Silakan coba lagi nanti.");
      // Only bounded internal codes; never provider bodies, URLs, prompts, or exceptions.
      req.log?.warn({ code: safeError.code }, "Chat request failed");
      if (!res.destroyed && !res.headersSent) res.status(safeError.status).json({ error: safeError.message });
    } finally {
      activeRequests -= 1;
      res.off("close", disconnected); controller.abort();
    }
  }

  router.get("/helpdesk/status", async (req, res): Promise<void> => {
    if (limited(req, res, false)) return;
    await run(req, res, async () => {
      const diagnostics = req.query.diagnostics === "true";
      const memberId = diagnostics
        ? await service.requireAdmin(req.get("authorization"))
        : req.get("authorization") ? await service.requireMember(req.get("authorization")) : undefined;
      const readiness = await service.readiness.get(diagnostics);
      res.json(GetHelpdeskAiStatusResponse.parse({
        ...readiness, ...(memberId ? { localQuota: localQuota(memberId) } : {}),
      }));
    });
  });

  router.get("/public-chatbots/:token", async (req, res): Promise<void> => {
    if (limited(req, res, false)) return;
    const params = GetPublicChatbotParams.safeParse(req.params);
    if (!params.success) {
      res.status(404).json({ error: "Chatbot tidak ditemukan atau link sudah dicabut." });
      return;
    }
    await run(req, res, async () => {
      const bot = await service.findBot(params.data.token);
      // The generated schema strips persona and any other non-public fields.
      res.json(GetPublicChatbotResponse.parse(bot));
    });
  });

  for (const path of ["/helpdesk", "/public-chatbots/:token/chat"]) {
    router.post(path, async (req, res): Promise<void> => {
      if (limited(req, res, true)) return;
      const isPublicBot = path !== "/helpdesk";
      const params = isPublicBot ? SendPublicChatbotMessageParams.safeParse(req.params) : null;
      if (params && !params.success) {
        res.status(404).json({ error: "Chatbot tidak ditemukan atau link sudah dicabut." });
        return;
      }
      const parsed = (isPublicBot ? SendPublicChatbotMessageBody : SendHelpdeskMessageBody)
        .strict().safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: "Pesan tidak valid. Kirim maksimal 10 pesan, masing-masing hingga 4000 karakter." });
        return;
      }
      const messages = parsed.data.messages.map(({ role, content }) => ({ role, content: content.trim() }));
      if (messages.some((m) => !m.content) ||
          messages.reduce((total, m) => total + m.content.length, 0) > 20_000 ||
          messages.at(-1)?.role !== "user") {
        res.status(400).json({ error: "Pesan harus berakhir dengan pertanyaan pengguna dan tidak boleh kosong atau terlalu panjang." });
        return;
      }
      await run(req, res, async signal => {
        const settings = isPublicBot ? undefined : SendHelpdeskMessageBody.parse(parsed.data);
        let memberId: string | undefined;
        if (settings?.engine || settings?.mode || settings?.custom_persona || settings?.scheme_code || settings?.audience || settings?.explanation_depth || settings?.use_vault_context) {
          memberId = await service.requireMember(req.get("authorization"));
          const rejected = memberLimit(memberId, now()) ||
            (settings.engine === "claude" ? analysisLimit(memberId, now()) : 0);
          if (rejected) {
            const wait = Math.max(...localQuota(memberId)
              .filter(quota => quota.scope === "helpdesk" || settings.engine === "claude")
              .map(quota => quota.retryAfterSeconds));
            res.set("Retry-After", String(wait));
            res.status(429).json({
              error: `Kuota AI akun untuk periode ini telah tercapai. Coba lagi dalam ${wait} detik.`,
              localQuota: localQuota(memberId), retryAfterSeconds: wait,
            });
            return;
          }
        }
        // Resolve the capability again on every send; deleted/rotated links stop working.
        const bot = params?.success ? await service.findBot(params.data.token) : undefined;
        let vault;
        if (!isPublicBot && settings?.use_vault_context && memberId) {
          const [{ pubVaultContext }, { ensurePubWorkspace }] = await Promise.all([
            import("../lib/vault-context"), import("../lib/vault-pub-auth"),
          ]);
          await ensurePubWorkspace(memberId, req.get("authorization")!);
          vault = await pubVaultContext(memberId, messages.at(-1)!.content);
        }
        const reply = await service.reply(messages, bot, settings, signal, vault?.prompt);
        const schema = isPublicBot ? SendPublicChatbotMessageResponse : SendHelpdeskMessageResponse;
        res.json(schema.parse({
          reply,
          ...(vault ? { vault_sources: vault.sources } : {}),
          ...(settings?.scheme_code ? { scheme_code: settings.scheme_code } : {}),
          ...(settings?.engine ? { engine: settings.engine, model: chatModel(settings.engine, options.env ?? process.env) } : {}),
        }));
      });
    });
  }
  return router;
}

export default createChatRouter();
