import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { VideoRecovery } from "./lmsVideoRecovery.ts";

function fixture() {
  const state = { time: 42, wanted: true, healthy: false, failed: false };
  let retries = 0;
  let failures = 0;
  let recovered = 0;
  const recovery = new VideoRecovery({
    snapshot: () => state,
    retry: async () => { retries++; },
    exhausted: () => { failures++; },
    recovered: () => { recovered++; },
  });
  return { state, recovery, counts: () => ({ retries, failures, recovered }) };
}

async function tick(ms: number) {
  mock.timers.tick(ms);
  await Promise.resolve();
  await Promise.resolve();
}

test("gangguan segar dicoba tiga kali dengan backoff lalu berhenti, termasuk event berulang", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const { recovery, counts } = fixture();
    recovery.schedule();
    recovery.schedule();
    await tick(999);
    assert.equal(counts().retries, 0);
    await tick(1);
    assert.equal(counts().retries, 1);
    await tick(2999);
    assert.equal(counts().retries, 1);
    await tick(1);
    assert.equal(counts().retries, 2);
    await tick(6000);
    assert.equal(counts().retries, 3);
    await tick(6000);
    assert.equal(counts().failures, 1);
    recovery.schedule();
    await tick(60_000);
    assert.equal(counts().retries, 3);
  } finally { mock.timers.reset(); }
});

test("video yang pulih sendiri atau maju tidak dimuat ulang", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    for (const healthy of [true, false]) {
      const { state, recovery, counts } = fixture();
      recovery.schedule(4000);
      if (healthy) state.healthy = true;
      else state.time += 0.2;
      await tick(4000);
      assert.deepEqual(counts(), { retries: 0, failures: 0, recovered: 1 });
    }
  } finally { mock.timers.reset(); }
});

test("jeda dan pembongkaran membatalkan retry tertunda", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const { state, recovery, counts } = fixture();
    recovery.schedule();
    state.wanted = false;
    await tick(1000);
    assert.equal(counts().retries, 0);
    state.wanted = true;
    recovery.schedule();
    recovery.cancel();
    await tick(60_000);
    assert.equal(counts().retries, 0);
  } finally { mock.timers.reset(); }
});

test("pembatalan saat refresh berlangsung tidak menjadwalkan retry baru", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    let finish!: () => void;
    let retries = 0;
    const recovery = new VideoRecovery({
      snapshot: () => ({ time: 42, healthy: false, wanted: true, failed: true }),
      retry: () => { retries++; return new Promise<void>((resolve) => { finish = resolve; }); },
      exhausted: () => assert.fail("tidak boleh gagal setelah dibatalkan"),
      recovered: () => {},
    });
    recovery.schedule();
    await tick(1000);
    recovery.cancel();
    finish();
    await tick(0);
    await tick(60_000);
    assert.equal(retries, 1);
  } finally { mock.timers.reset(); }
});

test("kemajuan singkat tidak mengisi ulang anggaran; 10 detik lancar atau klik manual mengisinya", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const { state, recovery, counts } = fixture();
    for (let i = 0; i < 3; i++) {
      recovery.schedule();
      await tick(6000);
      recovery.progress(state.time);
      state.time += 1;
      recovery.progress(state.time);
    }
    recovery.schedule();
    await tick(6000);
    assert.equal(counts().retries, 3);
    assert.equal(counts().failures, 1);
    recovery.progress(50);
    recovery.progress(60);
    recovery.schedule();
    await tick(1000);
    assert.equal(counts().retries, 4);
    recovery.reset();
    recovery.schedule();
    await tick(1000);
    assert.equal(counts().retries, 5);
    recovery.cancel();
  } finally { mock.timers.reset(); }
});

test("kegagalan refresh juga memakai anggaran terbatas", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    let retries = 0;
    let failures = 0;
    const recovery = new VideoRecovery({
      snapshot: () => ({ time: 42, healthy: false, wanted: true, failed: true }),
      retry: async () => { retries++; throw new Error("offline"); },
      exhausted: () => { failures++; },
      recovered: () => {},
    });
    recovery.schedule();
    for (const delay of [1000, 3000, 6000, 6000]) await tick(delay);
    assert.equal(retries, 3);
    assert.equal(failures, 1);
  } finally { mock.timers.reset(); }
});

test("kemajuan singkat yang diikuti error baru tidak dianggap pulih", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const { state, recovery, counts } = fixture();
    recovery.schedule();
    state.time += 0.2;
    state.failed = true;
    await tick(1000);
    assert.equal(counts().retries, 1);
    assert.equal(counts().recovered, 0);
    recovery.cancel();
  } finally { mock.timers.reset(); }
});

test("sinyal baru saat retry berlangsung tetap memakai anggaran dan bisa dibatalkan", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    for (const pause of [false, true]) {
      let finish!: () => void;
      let retries = 0;
      const recovery = new VideoRecovery({
        snapshot: () => ({ time: 42, healthy: false, wanted: true, failed: true }),
        retry: async () => {
          retries++;
          if (retries === 1) await new Promise<void>((resolve) => { finish = resolve; });
        },
        exhausted: () => {},
        recovered: () => {},
      });
      recovery.schedule();
      await tick(1000);
      recovery.cancel(); // Brief playing event while refresh is pending.
      recovery.schedule(); // A new network error follows it.
      if (pause) recovery.cancel();
      finish();
      await tick(0);
      await tick(2999);
      assert.equal(retries, 1);
      await tick(1);
      assert.equal(retries, pause ? 1 : 2);
      recovery.cancel();
    }
  } finally { mock.timers.reset(); }
});
