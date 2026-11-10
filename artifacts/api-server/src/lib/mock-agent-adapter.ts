import { randomUUID } from "node:crypto";

/**
 * Offline developer fixture, NOT an OpenClaw client or an authentication layer.
 * No routes, member data, model SDKs, credentials, network or database access.
 */
export type MockActor = "operator-a" | "operator-b";
export type MockState = "queued" | "running" | "completed" | "failed" | "cancelled" | "timed_out";
type Scenario = "success" | "failure" | "hang";
type Input = { requestId: string; operation: "service_health"; scenario?: Scenario };
type Result = { mode: "synthetic-only"; openclaw: "simulated"; hermes: "simulated" };
export type MockJob = {
  id: string; requestId: string; operation: "service_health"; state: MockState;
  mode: "synthetic-only"; createdAt: number; startedAt?: number; finishedAt?: number;
  result?: Result; code?: "synthetic_failure" | "deadline_exceeded" | "cancelled";
};
type StoredJob = MockJob & {
  actor: MockActor; scenario: Scenario; execution?: ReturnType<typeof setTimeout>;
  deadline?: ReturnType<typeof setTimeout>;
};
export class MockAdapterError extends Error {
  constructor(public code: "preview_only" | "forbidden" | "invalid_input" | "not_found" |
    "idempotency_conflict" | "capacity" | "closed") {
    super(code);
  }
}
const terminal = (state: MockState) => state !== "queued" && state !== "running";
const uuid = /^[a-f\d]{8}-[a-f\d]{4}-4[a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;

export function createMockAgentAdapter(options: {
  environment?: string; maxJobs?: number; maxConcurrent?: number; runMs?: number;
  timeoutMs?: number; retentionMs?: number; now?: () => number;
} = {}) {
  const environment = options.environment ?? process.env.NODE_ENV;
  if (environment !== "development" && environment !== "test") throw new MockAdapterError("preview_only");
  const maxJobs = options.maxJobs ?? 100, maxConcurrent = options.maxConcurrent ?? 1;
  const runMs = options.runMs ?? 20, timeoutMs = options.timeoutMs ?? 2000;
  const retentionMs = options.retentionMs ?? 300000, now = options.now ?? Date.now;
  for (const [value, min, max] of [
    [maxJobs, 1, 200], [maxConcurrent, 1, 4], [runMs, 0, 1000],
    [timeoutMs, 1, 30000], [retentionMs, 1, 300000],
  ]) if (!Number.isInteger(value) || value! < min! || value! > max!) throw new MockAdapterError("invalid_input");
  const jobs = new Map<string, StoredJob>(), requests = new Map<string, string>();
  let active = 0, closed = false, executions = 0;
  let scheduled: ReturnType<typeof setTimeout> | undefined;

  const requireActor = (actor: unknown): MockActor => {
    if (actor !== "operator-a" && actor !== "operator-b") throw new MockAdapterError("forbidden");
    return actor;
  };
  const key = (actor: MockActor, requestId: string) => `${actor}:${requestId}`;
  function prune() {
    const time = now();
    for (const [id, job] of jobs) {
      if (terminal(job.state) && time - job.finishedAt! >= retentionMs) {
        jobs.delete(id);
        requests.delete(key(job.actor, job.requestId));
      }
    }
  }
  function snapshot(job: StoredJob): MockJob {
    return {
      id: job.id, requestId: job.requestId, operation: job.operation, state: job.state,
      mode: job.mode, createdAt: job.createdAt,
      ...(job.startedAt === undefined ? {} : { startedAt: job.startedAt }),
      ...(job.finishedAt === undefined ? {} : { finishedAt: job.finishedAt }),
      ...(job.result ? { result: { ...job.result } } : {}),
      ...(job.code ? { code: job.code } : {}),
    };
  }
  function schedule() {
    if (closed || scheduled !== undefined) return;
    scheduled = setTimeout(() => { scheduled = undefined; drain(); }, 0);
  }
  function finish(job: StoredJob, state: Exclude<MockState, "queued" | "running">) {
    if (terminal(job.state)) return;
    if (job.state === "running") active--;
    clearTimeout(job.execution); clearTimeout(job.deadline);
    job.execution = job.deadline = undefined;
    job.state = state; job.finishedAt = now();
    if (state === "completed") {
      job.result = { mode: "synthetic-only", openclaw: "simulated", hermes: "simulated" };
    } else {
      job.code = state === "failed" ? "synthetic_failure" :
        state === "timed_out" ? "deadline_exceeded" : "cancelled";
    }
    schedule();
  }
  function drain() {
    if (closed) return;
    for (const job of jobs.values()) {
      if (active >= maxConcurrent) break;
      if (job.state !== "queued") continue;
      job.state = "running"; job.startedAt = now(); active++; executions++;
      job.deadline = setTimeout(() => finish(job, "timed_out"), timeoutMs);
      if (job.scenario !== "hang") {
        job.execution = setTimeout(() => finish(job, job.scenario === "failure" ? "failed" : "completed"), runMs);
      }
    }
  }
  function find(actor: unknown, id: string) {
    const owner = requireActor(actor);
    prune();
    const job = jobs.get(id);
    if (!job || job.actor !== owner) throw new MockAdapterError("not_found");
    return job;
  }
  return {
    submit(actor: MockActor, input: Input): { job: MockJob; reused: boolean } {
      const owner = requireActor(actor);
      if (closed) throw new MockAdapterError("closed");
      if (!input || typeof input !== "object" || Array.isArray(input) ||
          Object.keys(input).some(name => !["requestId", "operation", "scenario"].includes(name)) ||
          typeof input.requestId !== "string" || !uuid.test(input.requestId) ||
          input.operation !== "service_health" ||
          (input.scenario !== undefined && !["success", "failure", "hang"].includes(input.scenario))) {
        throw new MockAdapterError("invalid_input");
      }
      prune();
      const requestId = input.requestId.toLowerCase(), scenario = input.scenario ?? "success";
      const prior = jobs.get(requests.get(key(owner, requestId)) ?? "");
      if (prior) {
        if (prior.scenario !== scenario) throw new MockAdapterError("idempotency_conflict");
        return { job: snapshot(prior), reused: true };
      }
      if (jobs.size >= maxJobs) throw new MockAdapterError("capacity");
      const job: StoredJob = {
        id: randomUUID(), requestId, operation: "service_health", state: "queued",
        mode: "synthetic-only", actor: owner, scenario, createdAt: now(),
      };
      jobs.set(job.id, job); requests.set(key(owner, requestId), job.id);
      schedule();
      return { job: snapshot(job), reused: false };
    },
    get(actor: MockActor, id: string) { return snapshot(find(actor, id)); },
    cancel(actor: MockActor, id: string) {
      const job = find(actor, id);
      finish(job, "cancelled");
      return snapshot(job);
    },
    stats() {
      prune();
      return { mode: "synthetic-only" as const, retained: jobs.size, active,
        queued: [...jobs.values()].filter(job => job.state === "queued").length, executions, closed };
    },
    dispose() {
      closed = true; clearTimeout(scheduled); scheduled = undefined;
      for (const job of jobs.values()) finish(job, "cancelled");
    },
  };
}
