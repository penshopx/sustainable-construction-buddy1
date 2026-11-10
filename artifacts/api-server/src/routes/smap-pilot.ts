import { Router } from "express";
import { AnalyzeSmapPilotBody, AnalyzeSmapPilotResponse, ListSmapPilotDocumentsResponse } from "@workspace/api-zod";
import { createPilotData, PilotError, unavailable } from "../lib/smap-pilot-data";
import { ChatServiceError } from "../lib/chat-service";
import { createWindowLimiter } from "../lib/chat-limits";
import { assertPilotRuntime, runSmapPilot } from "../lib/smap-pilot-runtime";

export function createSmapPilotRouter(options: {
  env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch;
  ready?: typeof assertPilotRuntime; run?: typeof runSmapPilot;
} = {}) {
  const router = Router(), env = options.env ?? process.env;
  const data = createPilotData(env, options.fetchImpl);
  const memberBudget = createWindowLimiter(3600000, 3);
  const globalBudget = createWindowLimiter(3600000, 10);
  const reads = createWindowLimiter(300000, 60);
  let active = false;
  for (const method of ["get", "post"] as const) {
    router[method](method === "get" ? "/smap/pilot/documents" : "/smap/pilot/analyze", async (req, res) => {
      res.setHeader("Cache-Control", "no-store");
      const abort = new AbortController();
      res.once("close", () => { if (!res.writableEnded) abort.abort(); });
      let acquired = false;
      try {
        if (env.NODE_ENV !== "development") throw new PilotError(404, "pilot_disabled", "Pilot hanya tersedia di preview.");
        if (reads(req.ip ?? "unknown")) throw new PilotError(429, "pilot_rate_limit", "Terlalu banyak permintaan. Coba lagi beberapa menit.");
        const authorization = req.headers.authorization;
        const owner = await data.requireMember(authorization);
        const input = method === "post" ? AnalyzeSmapPilotBody.strict().safeParse(req.body) : null;
        if (method === "post" && (!input?.success || new Set(input.data.documentIds).size !== input.data.documentIds.length)) {
          throw new PilotError(400, "pilot_consent_required", "Pilih 1–5 catatan dan setujui pengiriman indikator metadata.");
        }
        await (options.ready ?? assertPilotRuntime)();
        const documents = await data.documents(authorization!, owner, input?.success ? input.data.documentIds : undefined, abort.signal);
        if (method === "get") {
          res.json(ListSmapPilotDocumentsResponse.parse({ documents })); return;
        }
        if (abort.signal.aborted) throw unavailable();
        if (active) throw new PilotError(429, "pilot_busy", "Pilot sedang digunakan. Silakan coba lagi nanti.");
        const wait = memberBudget(owner) || globalBudget("all");
        if (wait) {
          res.setHeader("Retry-After", wait);
          throw new PilotError(429, "pilot_budget", "Batas pilot tercapai: maksimum 3 analisis per anggota dan 10 total per jam.");
        }
        active = acquired = true;
        const result = await (options.run ?? runSmapPilot)(documents, env, abort.signal, options.fetchImpl);
        if (!res.destroyed) res.json(AnalyzeSmapPilotResponse.parse(result));
      } catch (error) {
        const safe = error instanceof PilotError || error instanceof ChatServiceError ? error : unavailable();
        req.log?.warn({ code: safe.code }, "SMAP preview pilot request rejected");
        if (!res.destroyed && !res.headersSent) res.status(safe.status).json({ error: safe.message, code: safe.code });
      } finally {
        if (acquired) active = false;
      }
    });
  }
  return router;
}
export default createSmapPilotRouter();
