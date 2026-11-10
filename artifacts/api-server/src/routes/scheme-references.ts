import { Router, type IRouter } from "express";
import { createChatService, ChatServiceError } from "../lib/chat-service";
import { getSchemeReferenceBank } from "../lib/scheme-reference-bank";
import { createWindowLimiter } from "../lib/chat-limits";

export function createSchemeReferenceRouter(options: Parameters<typeof createChatService>[0] = {}): IRouter {
  const router = Router();
  const service = createChatService(options);
  const limit = createWindowLimiter(60_000, 60);
  router.get("/scheme-references", async (req, res): Promise<void> => {
    res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "Vary": "Authorization" });
    const wait = limit(req.ip ?? "unknown", Date.now());
    if (wait) {
      res.set("Retry-After", String(wait));
      res.status(429).json({ error: "Terlalu banyak permintaan. Silakan coba lagi." });
      return;
    }
    try {
      await service.requireMember(req.get("authorization"));
      res.json(getSchemeReferenceBank());
    } catch (error) {
      const unauthorized = error instanceof ChatServiceError && error.status === 401;
      req.log?.warn({ code: unauthorized ? "member_required" : "reference_unavailable" }, "Reference request failed");
      res.status(unauthorized ? 401 : 503).json({ error: unauthorized
        ? "Silakan masuk kembali untuk membaca referensi."
        : "Referensi belum dapat dimuat. Silakan coba lagi." });
    }
  });
  return router;
}

export default createSchemeReferenceRouter();
