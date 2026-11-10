import test from "node:test";
import assert from "node:assert/strict";
import { runOperatorPilotChecks, type PilotCheckApi, type PilotCheckResult } from "./operatorPilotChecks.ts";
import type { OperatorPilotJob } from "@workspace/api-client-react";

const IDS = ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"] as const;
const JOBS = ["33333333-3333-4333-8333-333333333333", "44444444-4444-4444-8444-444444444444"];
const immediate = async (signal: AbortSignal) => { signal.throwIfAborted(); };
function fixture(cancelState: OperatorPilotJob["state"] = "cancelled", readState: OperatorPilotJob["state"] = "timed_out") {
  const calls: { action: string; input: unknown }[] = [];
  const jobs = new Map<string, OperatorPilotJob>();
  const api: PilotCheckApi = {
    create: async input => {
      calls.push({ action: "create", input });
      const job: OperatorPilotJob = { id: JOBS[jobs.size], requestId: input.requestId,
        operation: "service_health", mode: "synthetic-only", createdAt: 0, state: "running" };
      jobs.set(job.id, job); return job;
    },
    get: async id => { calls.push({ action: "get", input: id }); return { ...jobs.get(id)!, state: readState }; },
    cancel: async id => { calls.push({ action: "cancel", input: id }); return { ...jobs.get(id)!, state: cancelState }; },
  };
  return { calls, api };
}

test("one explicit run uses two hang jobs and verifies cancellation/timeout from actual response states", async () => {
  const { api, calls } = fixture(), results: PilotCheckResult[] = [];
  const returned = await runOperatorPilotChecks(api, IDS, new AbortController().signal,
    value => results.push(value), immediate);
  assert.deepEqual(calls.map(value => value.action), ["create", "cancel", "create", "get"]);
  assert.deepEqual(calls.filter(value => value.action === "create").map(value => value.input), IDS.map(requestId => ({
    requestId, operation: "service_health", scenario: "hang",
  })));
  assert.deepEqual(returned.map(value => value.passed), [true, true]);
  assert.deepEqual(results, returned);
});

test("a timeout winning the cancellation race is not counted as a successful cancellation", async () => {
  const { api } = fixture("timed_out");
  const results = await runOperatorPilotChecks(api, IDS, new AbortController().signal, () => {}, immediate);
  assert.equal(results[0].passed, false);
  assert.equal(results[0].state, "timed_out");
  assert.equal(results[1].passed, true);
});

test("eight status reads are the maximum and client exhaustion is not fabricated as a server timeout", async () => {
  const { api, calls } = fixture("cancelled", "running");
  const results = await runOperatorPilotChecks(api, IDS, new AbortController().signal, () => {}, immediate);
  assert.equal(calls.filter(value => value.action === "get").length, 8);
  assert.equal(results[1].state, "running");
  assert.equal(results[1].passed, false);
  assert.equal(results[1].pollLimitReached, true);
});

test("revocation or a failed cancellation stops the sequence without another submission or automatic retry", async () => {
  const { api, calls } = fixture();
  api.cancel = async () => { throw { status: 403 }; };
  await assert.rejects(runOperatorPilotChecks(api, IDS, new AbortController().signal, () => {}, immediate),
    (failure: any) => failure.status === 403);
  assert.equal(calls.length, 1);
});

test("abort before starting or after submission prevents later mutations", async () => {
  const { api, calls } = fixture(), controller = new AbortController();
  controller.abort();
  await assert.rejects(runOperatorPilotChecks(api, IDS, controller.signal, () => {}, immediate));
  assert.equal(calls.length, 0);
  const next = new AbortController(), originalCreate = api.create;
  api.create = async (...args) => { const job = await originalCreate(...args); next.abort(); return job; };
  await assert.rejects(runOperatorPilotChecks(api, IDS, next.signal, () => {}, immediate));
  assert.deepEqual(calls.map(value => value.action), ["create"]);
});

test("a response from a different job/request or a non-synthetic mode fails closed", async () => {
  for (const change of [{ requestId: IDS[1] }, { id: JOBS[1] }, { mode: "live" }, { state: "unknown" }]) {
    const { api, calls } = fixture(), originalCancel = api.cancel;
    api.cancel = async (...args) => ({ ...await originalCancel(...args), ...change }) as OperatorPilotJob;
    await assert.rejects(runOperatorPilotChecks(api, IDS, new AbortController().signal, () => {}, immediate),
      /Invalid synthetic check response/);
    assert.equal(calls.filter(value => value.action === "create").length, 1);
  }
});
