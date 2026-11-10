import { test } from "node:test";
import assert from "node:assert/strict";
import { createLogoutRequest, LogoutTimeoutError } from "./logoutRequest.ts";

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("DELETE menggantung dibatalkan; respons terlambat tidak memulai logout SDK", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const deletion = deferred();
  let signal!: AbortSignal;
  let deletes = 0;
  let sdkCalls = 0;
  const request = createLogoutRequest(async (value) => {
    signal = value;
    deletes++;
    await deletion.promise; // Deliberately ignores cancellation.
  }, async () => { sdkCalls++; });
  const first = request.run();
  assert.equal(request.run(), first);
  const rejected = assert.rejects(first, LogoutTimeoutError);
  t.mock.timers.tick(10_000);
  await rejected;
  assert.equal(signal.aborted, true);
  assert.equal(request.pending, true);
  const retry = request.run();
  deletion.resolve();
  await assert.rejects(retry, LogoutTimeoutError);
  assert.equal(deletes, 1);
  assert.equal(sdkCalls, 0);
  assert.equal(request.pending, false);
});

test("SDK menggantung: setiap penantian dibatasi, retry bergabung dan tidak menggandakan request", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const sdk = deferred();
  let deletes = 0;
  let sdkCalls = 0;
  const request = createLogoutRequest(async () => { deletes++; }, async () => {
    sdkCalls++;
    await sdk.promise;
  });
  const first = request.run();
  const rejected = assert.rejects(first, LogoutTimeoutError);
  await Promise.resolve();
  t.mock.timers.tick(10_000);
  await rejected;
  const second = request.run();
  const secondRejected = assert.rejects(second, LogoutTimeoutError);
  t.mock.timers.tick(10_000);
  await secondRejected;
  assert.equal(request.pending, true);
  const third = request.run();
  assert.equal(request.run(), third);
  sdk.resolve();
  await third;
  assert.equal(deletes, 1);
  assert.equal(sdkCalls, 1);
  assert.equal(request.pending, false);
});

test("kegagalan SDK terlambat ditangani dan melepaskan kunci untuk percobaan baru", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const sdk = deferred();
  let sdkCalls = 0;
  const request = createLogoutRequest(async () => {}, async () => {
    sdkCalls++;
    if (sdkCalls === 1) await sdk.promise;
  });
  const rejected = assert.rejects(request.run(), LogoutTimeoutError);
  await Promise.resolve();
  t.mock.timers.tick(10_000);
  await rejected;
  sdk.reject(new Error("late failure"));
  await sdk.promise.catch(() => {});
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(request.pending, false);
  await request.run();
  assert.equal(sdkCalls, 2);
});

test("DELETE yang merespons abort membolehkan retry baru tanpa overlap", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  const request = createLogoutRequest(async (signal) => {
    calls++;
    if (calls === 1) await new Promise((_, reject) => {
      signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    });
  }, async () => {});
  const rejected = assert.rejects(request.run(), LogoutTimeoutError);
  t.mock.timers.tick(10_000);
  await rejected;
  await Promise.resolve();
  await request.run();
  assert.equal(calls, 2);
  assert.equal(request.pending, false);
});
