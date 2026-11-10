import { Router } from "express";
import { RunHermesLocalCheckBody, RunHermesLocalCheckResponse, RunHermesBg001CheckResponse, RunHermesBg001ChatBody, RunHermesBg001ChatResponse } from "@workspace/api-zod";
import { runHermesLocalCheck } from "../lib/hermes-local-check";
import { runHermesBg001Check } from "../lib/hermes-bg001-check";
import { runHermesBg001Chat } from "../lib/hermes-bg001-chat";
import { createOperatorPreviewAccess, OperatorPreviewError } from "../lib/operator-preview-access";
import { createWindowLimiter } from "../lib/chat-limits";
import { HermesBillingError } from "../lib/hermes-billing-error";
import { PilotError } from "../lib/smap-pilot-data";

export function createHermesLocalCheckRouter(options: {
  env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch; run?: typeof runHermesLocalCheck; runBg001?: typeof runHermesBg001Check;
  runBg001Chat?: typeof runHermesBg001Chat;
} = {}) {
  const router = Router(), env = options.env ?? process.env;
  const requireOperator = createOperatorPreviewAccess(env, options.fetchImpl);
  const reads = createWindowLimiter(60_000, 60), budget = createWindowLimiter(3_600_000, 3);
  let busy = false;
  const variants = [
    { path: "/operator/hermes/local-check", body: RunHermesLocalCheckBody,
      run: (signal: AbortSignal, _body: { consent: true; question?: string }) => (options.run ?? runHermesLocalCheck)(signal),
      parse: RunHermesLocalCheckResponse.parse },
    { path: "/operator/hermes/bg001-check", body: RunHermesLocalCheckBody,
      run: (signal: AbortSignal, _body: { consent: true; question?: string }) => (options.runBg001 ?? runHermesBg001Check)(signal),
      parse: RunHermesBg001CheckResponse.parse },
    { path: "/operator/hermes/bg001-chat", body: RunHermesBg001ChatBody,
      run: (signal: AbortSignal, body: { consent: true; question?: string }) =>
        (options.runBg001Chat ?? runHermesBg001Chat)(body.question ?? "", env, signal, options.fetchImpl),
      parse: RunHermesBg001ChatResponse.parse },
  ];
  for (const variant of variants) router.post(variant.path, async (req, res): Promise<void> => {
    res.set({ "Cache-Control": "no-store", Vary: "Authorization" });
    const controller = new AbortController();
    res.once("close", () => { if (!res.writableEnded) controller.abort(); });
    let acquired = false;
    const deadline = setTimeout(() => controller.abort(), 90_000);
    try {
      if (env.NODE_ENV !== "development")
        throw new OperatorPreviewError(404, "hermes_preview_disabled", "Uji Hermes hanya tersedia di preview.");
      if (reads(req.ip ?? "unknown")) throw new OperatorPreviewError(429, "hermes_read_limit", "Terlalu banyak permintaan.");
      const owner = await requireOperator(req.headers.authorization, controller.signal);
      const input = variant.body.strict().safeParse(req.body);
      if (!input.success || !input.data.consent || ("question" in input.data &&
          (typeof input.data.question !== "string" || input.data.question.trim().length < 5)) || Object.keys(req.query).length)
        throw new OperatorPreviewError(400, "hermes_invalid_input", "Pertanyaan tidak valid atau persetujuan belum diberikan.");
      if (controller.signal.aborted) return;
      if (busy) throw new OperatorPreviewError(429, "hermes_local_busy", "Uji Hermes lokal sedang berjalan.");
      const wait = budget(owner);
      if (wait) {
        res.setHeader("Retry-After", wait);
        throw new OperatorPreviewError(429, "hermes_local_budget", "Batas uji lokal tercapai: tiga kali per jam.");
      }
      busy = acquired = true;
      const result = variant.parse(await variant.run(controller.signal, input.data));
      // Permission may have changed while the worker was running.
      await requireOperator(req.headers.authorization, controller.signal);
      if (!controller.signal.aborted && !res.destroyed) res.json(result);
    } catch (error) {
      const safe = error instanceof OperatorPreviewError || error instanceof HermesBillingError ? error :
        error instanceof PilotError && error.status === 504 && error.code === "pilot_timeout"
          ? new OperatorPreviewError(504, "hermes_timeout", "Analisis melewati batas waktu. Tidak ada pengiriman ulang otomatis.")
          : new OperatorPreviewError(
        controller.signal.aborted ? 504 : 503, "hermes_local_unavailable",
        controller.signal.aborted ? "Uji dihentikan atau melewati batas waktu. Tidak ada pengiriman ulang otomatis."
          : "Runtime Hermes lokal belum dapat menyelesaikan uji. Tidak ada pengganti atau pengiriman ulang otomatis.");
      req.log?.warn({ code: safe.code }, "Local Hermes check rejected");
      if (!res.destroyed && !res.headersSent) res.status(safe.status).json({ error: safe.message, code: safe.code });
    } finally {
      clearTimeout(deadline);
      controller.abort();
      if (acquired) busy = false;
    }
  });
  return router;
}
export default createHermesLocalCheckRouter();
