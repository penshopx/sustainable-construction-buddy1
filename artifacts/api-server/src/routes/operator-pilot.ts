import { Router } from "express";
import {
  CreateOperatorPilotJobBody, CreateOperatorPilotJobResponse,
  GetOperatorPilotJobParams, GetOperatorPilotJobResponse,
  CancelOperatorPilotJobParams, CancelOperatorPilotJobResponse,
} from "@workspace/api-zod";
import { createMockAgentAdapter, MockAdapterError } from "../lib/mock-agent-adapter";
import { createOperatorPreviewAccess, OperatorPreviewError, operatorUnavailable } from "../lib/operator-preview-access";
import { createWindowLimiter } from "../lib/chat-limits";

export function createOperatorPilotRouter(options: {
  env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch;
  adapterOptions?: { runMs?: number; timeoutMs?: number };
} = {}) {
  const env = options.env ?? process.env, router = Router();
  const requireOperator = createOperatorPreviewAccess(env, options.fetchImpl);
  const owners = new Map<string, { adapter: ReturnType<typeof createMockAgentAdapter>; seen: number }>();
  const reads = createWindowLimiter(60000, 60), submissions = createWindowLimiter(60000, 10);
  const base = "/operator/pilot/jobs";
  for (const action of ["create", "get", "cancel"] as const) {
    router[action === "get" ? "get" : "post"](
      action === "create" ? base : `${base}/:jobId${action === "cancel" ? "/cancel" : ""}`,
      async (req, res) => {
        res.setHeader("Cache-Control", "no-store");
        const controller = new AbortController();
        res.once("close", () => { if (!res.writableEnded) controller.abort(); });
        try {
          if (env.NODE_ENV !== "development") throw new OperatorPreviewError(404, "operator_preview_disabled", "Pilot hanya tersedia di preview.");
          if (reads(req.ip ?? "unknown")) throw new OperatorPreviewError(429, "operator_rate_limit", "Terlalu banyak permintaan. Coba lagi nanti.");
          const owner = await requireOperator(req.headers.authorization, controller.signal);
          const input = action === "create" ? CreateOperatorPilotJobBody.strict().safeParse(req.body) : null;
          const params = action === "get" ? GetOperatorPilotJobParams.safeParse(req.params) :
            action === "cancel" ? CancelOperatorPilotJobParams.safeParse(req.params) : null;
          if ((action === "create" && !input?.success) || (action !== "create" && !params?.success) ||
              Object.keys(req.query).length || (action !== "create" && req.body !== undefined)) {
            throw new OperatorPreviewError(400, "operator_invalid_input", "Permintaan simulasi tidak valid.");
          }
          if (controller.signal.aborted) return;
          for (const [id, entry] of owners) {
            if (Date.now() - entry.seen > 600000 && entry.adapter.stats().retained === 0) {
              entry.adapter.dispose(); owners.delete(id);
            }
          }
          let entry = owners.get(owner);
          if (action === "create") {
            const wait = submissions(owner);
            if (wait) {
              res.setHeader("Retry-After", wait);
              throw new OperatorPreviewError(429, "operator_submit_limit", "Batas simulasi tercapai. Coba lagi nanti.");
            }
            if (!entry) {
              if (owners.size >= 32) throw new OperatorPreviewError(429, "operator_capacity", "Kapasitas pilot penuh.");
              entry = { adapter: createMockAgentAdapter({
                ...options.adapterOptions, environment: "development", maxJobs: 20,
              }), seen: Date.now() };
              owners.set(owner, entry);
            }
          }
          if (!entry) throw new OperatorPreviewError(404, "operator_job_missing", "Simulasi tidak ditemukan.");
          entry.seen = Date.now();
          // One private instance per verified UUID; fixture actors are never accepted over HTTP.
          if (input?.success) {
            res.json(CreateOperatorPilotJobResponse.parse(entry.adapter.submit("operator-a", input.data)));
          } else if (params?.success && action === "get") {
            res.json(GetOperatorPilotJobResponse.parse(entry.adapter.get("operator-a", params.data.jobId)));
          } else if (params?.success) {
            res.json(CancelOperatorPilotJobResponse.parse(entry.adapter.cancel("operator-a", params.data.jobId)));
          }
        } catch (error) {
          let safe = error instanceof OperatorPreviewError ? error : operatorUnavailable();
          if (error instanceof MockAdapterError) {
            const status = error.code === "not_found" ? 404 : error.code === "idempotency_conflict" ? 409 :
              error.code === "capacity" ? 429 : 400;
            safe = new OperatorPreviewError(status, `operator_${error.code}`,
              status === 404 ? "Simulasi tidak ditemukan." : status === 409 ?
                "ID permintaan sudah digunakan dengan skenario berbeda." : "Permintaan simulasi ditolak.");
          }
          req.log?.warn({ code: safe.code }, "Operator preview request rejected");
          if (!res.destroyed && !res.headersSent) res.status(safe.status).json({ error: safe.message, code: safe.code });
        }
      },
    );
  }
  return router;
}
export default createOperatorPilotRouter();
