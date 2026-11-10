export class AiHarnessError extends Error {
  constructor(public readonly code: "aborted" | "model_budget" | "model_incomplete" | "model_invalid") {
    super("Harness belum dapat menyelesaikan permintaan.");
  }
}

type ModelRequest = <T>(request: (signal: AbortSignal) => Promise<T>) => Promise<T>;

/**
 * Application orchestration, not an OS sandbox. Adapters are trusted server code.
 * No tools, credentials, logging, persistent memory, retry or model fallback here.
 */
export async function runReadOnlyHarness<Plan extends { model: string }, Raw, Result>(options: {
  signal?: AbortSignal;
  prepare: () => Plan;
  execute: (plan: Plan, requestModel: ModelRequest) => Promise<Raw>;
  verify: (raw: Raw, plan: Plan) => Result;
}): Promise<Result> {
  const controller = new AbortController();
  const signal = options.signal ? AbortSignal.any([controller.signal, options.signal]) : controller.signal;
  let open = true, attempts = 0, completed = false;
  const check = () => { if (signal.aborted) throw new AiHarnessError("aborted"); };
  const requestModel: ModelRequest = async request => {
    if (!open || ++attempts !== 1) throw new AiHarnessError("model_budget");
    check();
    const value = await request(signal);
    check(); completed = true;
    return value;
  };
  try {
    check();
    const plan = options.prepare();
    if (!plan || typeof plan.model !== "string" || plan.model.includes("://") ||
        !/^[a-zA-Z0-9/_.:-]{1,120}$/.test(plan.model))
      throw new AiHarnessError("model_invalid");
    check();
    const raw = await options.execute(plan, requestModel);
    check();
    if (attempts !== 1 || !completed) throw new AiHarnessError("model_incomplete");
    const result = options.verify(raw, plan);
    check();
    return result;
  } finally {
    open = false; controller.abort();
  }
}
