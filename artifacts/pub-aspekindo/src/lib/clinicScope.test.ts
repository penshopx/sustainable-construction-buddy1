import test from "node:test";
import assert from "node:assert/strict";
import { clinicPrefix, clinicConversationTitle } from "./clinicScope.ts";

test("clinic scopes cannot introduce SQL LIKE wildcards or another topic prefix", () => {
  assert.equal(clinicPrefix("sbu"), "[Klinik/sbu] ");
  assert.equal(clinicPrefix("skk-k3"), "[Klinik/skk-k3] ");
  assert.notEqual(clinicPrefix("sbu"), clinicPrefix("skk"));
  for (const invalid of ["%", "_", "sbu] %", "../sbu", "SBU"]) assert.throws(() => clinicPrefix(invalid));
  assert.equal(clinicPrefix(), "");
});
test("history label strips only known clinic/engine prefixes", () => {
  assert.equal(clinicConversationTitle("[Klinik/sbu] [claude] Persiapan SBU"), "Persiapan SBU");
  assert.equal(clinicConversationTitle("Pertanyaan biasa"), "Pertanyaan biasa");
});
