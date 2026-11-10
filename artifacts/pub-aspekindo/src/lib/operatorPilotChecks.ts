import type { OperatorPilotInput, OperatorPilotJob } from "@workspace/api-client-react";

export interface PilotCheckApi {
  create(input: OperatorPilotInput, signal: AbortSignal): Promise<OperatorPilotJob>;
  get(id: string, signal: AbortSignal): Promise<OperatorPilotJob>;
  cancel(id: string, signal: AbortSignal): Promise<OperatorPilotJob>;
}
export interface PilotCheckResult {
  name: "cancellation" | "timeout";
  id: string;
  state: OperatorPilotJob["state"];
  passed: boolean;
  pollLimitReached: boolean;
}

const active = (job: OperatorPilotJob) => job.state === "queued" || job.state === "running";
const states = ["queued", "running", "completed", "failed", "cancelled", "timed_out"];
function validate(job: OperatorPilotJob, requestId: string, id?: string) {
  if (job.mode !== "synthetic-only" || job.operation !== "service_health" ||
      job.requestId.toLowerCase() !== requestId.toLowerCase() || (id && id !== job.id) ||
      !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(job.id) || !states.includes(job.state)) {
    throw new Error("Invalid synthetic check response");
  }
  return job;
}

function pause(signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    signal.throwIfAborted();
    const abort = () => { clearTimeout(timer); reject(signal.reason); };
    const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 350);
    signal.addEventListener("abort", abort, { once: true });
  });
}

/** Exactly two synthetic submissions per explicit run; never retries a POST automatically. */
export async function runOperatorPilotChecks(
  api: PilotCheckApi,
  requestIds: readonly [string, string],
  signal: AbortSignal,
  onResult: (result: PilotCheckResult) => void,
  wait = pause,
) {
  const results: PilotCheckResult[] = [];
  const create = async (requestId: string) => {
    signal.throwIfAborted();
    const job = await api.create({ requestId, operation: "service_health", scenario: "hang" }, signal);
    signal.throwIfAborted();
    return validate(job, requestId);
  };
  const first = await create(requestIds[0]);
  signal.throwIfAborted();
  const cancelled = validate(await api.cancel(first.id, signal), requestIds[0], first.id);
  signal.throwIfAborted();
  results.push({ name: "cancellation", id: first.id, state: cancelled.state,
    passed: cancelled.state === "cancelled", pollLimitReached: false });
  onResult(results[0]);

  let timed = await create(requestIds[1]);
  for (let reads = 0; active(timed) && reads < 8; reads++) {
    if (reads > 0) await wait(signal);
    signal.throwIfAborted();
    timed = validate(await api.get(timed.id, signal), requestIds[1], timed.id);
    signal.throwIfAborted();
  }
  results.push({ name: "timeout", id: timed.id, state: timed.state,
    passed: timed.state === "timed_out", pollLimitReached: active(timed) });
  onResult(results[1]);
  return results;
}
