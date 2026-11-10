import assert from "node:assert/strict";
import test from "node:test";
import { calculateProjectEvm } from "./projectEvm.ts";

test("EVM calculates an over-budget, behind-schedule snapshot", () => {
  assert.deepEqual(calculateProjectEvm({ bac: 1000, pv: 600, ev: 400, ac: 500 }), {
    cpi: 0.8, spi: 2 / 3, eac: 1250, etc: 750, vac: -250, tcpi: 1.2,
  });
});

test("zero denominators are unavailable, not artificial zero performance", () => {
  assert.deepEqual(calculateProjectEvm({ bac: 1000, pv: 0, ev: 0, ac: 0 }), {
    cpi: null, spi: null, eac: null, etc: null, vac: null, tcpi: 1,
  });
  assert.equal(calculateProjectEvm({ bac: 1000, pv: 500, ev: 0, ac: 500 }).eac, null);
  assert.equal(calculateProjectEvm({ bac: 1000, pv: 1000, ev: 900, ac: 1100 }).tcpi, null);
});

test("completed project has no remaining forecast cost", () => {
  const result = calculateProjectEvm({ bac: 1000, pv: 1000, ev: 1000, ac: 800 });
  assert.equal(result.etc, 0);
  assert.equal(result.vac, 200);
  assert.equal(result.tcpi, 0);
});

test("invalid and nonfinite inputs are rejected", () => {
  for (const input of [
    { bac: 0, pv: 0, ev: 0, ac: 0 },
    { bac: 100, pv: -1, ev: 0, ac: 0 },
    { bac: 100, pv: 101, ev: 0, ac: 0 },
    { bac: 100, pv: 0, ev: 101, ac: 0 },
    { bac: Infinity, pv: 0, ev: 0, ac: 0 },
    { bac: 100, pv: 0, ev: 0, ac: NaN },
  ]) assert.throws(() => calculateProjectEvm(input));
});
