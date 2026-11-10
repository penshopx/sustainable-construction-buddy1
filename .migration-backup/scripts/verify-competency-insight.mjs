import assert from "node:assert/strict";
import crypto from "node:crypto";
import { validateProbeTarget } from "./insight-probe-target.mjs";

let supabaseUrl;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const healthFailureReasons = new Set([
  "none",
  "not_configured",
  "authentication",
  "timeout",
  "invalid_contract",
  "unavailable",
  "source_unavailable",
]);

const email = `competency-insight-probe-${crypto.randomUUID()}@example.test`;
const password = `Probe-${crypto.randomUUID()}-A1!`;
let userId;
let verificationFailed = false;
let verificationSummary;

function assertBodyDoesNotContain(body, forbiddenValues, label) {
  const serialized = JSON.stringify(body);
  for (const value of forbiddenValues) {
    if (value) assert.equal(serialized.includes(value), false, `${label} contains probe data`);
  }
}

function assertPublicError(result, expectedStatus, forbiddenValues, label, expectedError) {
  assert.equal(result.response.status, expectedStatus);
  assert.ok(result.body && typeof result.body === "object" && !Array.isArray(result.body));
  if (expectedError) assert.equal(result.body.error, expectedError);
  assertBodyDoesNotContain(result.body, forbiddenValues, label);
}

function assertPublicInsight(body, forbiddenValues) {
  assertBodyDoesNotContain(body, forbiddenValues, "Insight response");
  assert.ok(["connected", "deterministic"].includes(body?.source));
  assert.ok(Array.isArray(body?.recommendations));
  assert.ok(body.recommendations.length > 0);
  assert.ok(body.recommendations.length <= 3);
  assert.equal("health" in body, false);
  assert.deepEqual(Object.keys(body).sort(), ["generatedAt", "recommendations", "source"]);
  assert.equal(typeof body.generatedAt, "string");
  assert.equal(Number.isNaN(Date.parse(body.generatedAt)), false);

  for (const recommendation of body.recommendations) {
    assert.deepEqual(Object.keys(recommendation).sort(), ["href", "label", "text"]);
    assert.equal(typeof recommendation.text, "string");
    assert.equal(typeof recommendation.label, "string");
    assert.equal(typeof recommendation.href, "string");
    assert.match(recommendation.href, /^\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/);
  }
}

function assertPublicHealth(body, forbiddenValues) {
  assertBodyDoesNotContain(body, forbiddenValues, "Health response");
  assert.ok(["connected", "deterministic"].includes(body?.health?.status));
  assert.ok(healthFailureReasons.has(body?.health?.failureReason));
  assert.equal(typeof body?.health?.lastProbeAt, "string");
  assert.equal(Number.isNaN(Date.parse(body.health.lastProbeAt)), false);
  assert.deepEqual(
    Object.keys(body.health).sort(),
    ["failureReason", "lastProbeAt", "status"],
  );
}

async function request(path, init) {
  const response = await fetch(`${supabaseUrl}${path}`, init);
  const text = await response.text();
  let body = null;

  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    // The assertions below report the relevant HTTP status without logging credentials.
  }

  return { response, body };
}

const probeSecrets = [email, password, process.env.SUPABASE_URL, serviceRoleKey, publishableKey];

async function verifyLiveContract() {
  // Validate before any request, including temporary-user creation or cleanup.
  supabaseUrl = validateProbeTarget(process.env.SUPABASE_URL, process.env.SUPABASE_PROJECT_REF);
  assert.ok(serviceRoleKey, "SUPABASE_SERVICE_ROLE_KEY is required");
  assert.ok(publishableKey, "VITE_SUPABASE_PUBLISHABLE_KEY is required");

  try {
  const unauthenticated = await request("/functions/v1/competency-insight", {
    method: "POST",
    headers: {
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  assertPublicError(unauthenticated, 401, probeSecrets, "Unauthenticated response");

  const unauthenticatedHealth = await request("/functions/v1/competency-insight", {
    method: "POST",
    headers: {
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "health" }),
  });
  assertPublicError(
    unauthenticatedHealth,
    401,
    probeSecrets,
    "Unauthenticated health response",
  );

  const created = await request("/auth/v1/admin/users", {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
    }),
  });
  assert.equal(created.response.status, 200);
  assert.equal(typeof created.body?.id, "string");
  userId = created.body.id;

  const signedIn = await request("/auth/v1/token?grant_type=password", {
    method: "POST",
    headers: {
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
  });
  assert.equal(signedIn.response.status, 200);
  assert.equal(typeof signedIn.body?.access_token, "string");

  const insight = await request("/functions/v1/competency-insight", {
    method: "POST",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${signedIn.body.access_token}`,
      "Content-Type": "application/json",
    },
    body: "{}",
  });

  assert.equal(insight.response.status, 200);
  assertPublicInsight(insight.body, probeSecrets.concat(userId));

  const memberHealth = await request("/functions/v1/competency-insight", {
    method: "POST",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${signedIn.body.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "health" }),
  });
  assertPublicError(
    memberHealth,
    403,
    probeSecrets.concat(userId),
    "Member health response",
    "Forbidden",
  );

  const adminRole = await request("/rest/v1/user_roles", {
    method: "POST",
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ user_id: userId, role: "admin" }),
  });
  assert.equal(adminRole.response.status, 201);

  const adminHealth = await request("/functions/v1/competency-insight", {
    method: "POST",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${signedIn.body.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action: "health" }),
  });
  assert.equal(adminHealth.response.status, 200);
  assertPublicHealth(adminHealth.body, probeSecrets.concat(userId));

  verificationSummary = {
    unauthenticatedStatus: unauthenticated.response.status,
    unauthenticatedHealthStatus: unauthenticatedHealth.response.status,
    authenticatedStatus: insight.response.status,
    memberHealthStatus: memberHealth.response.status,
    adminHealthStatus: adminHealth.response.status,
    source: insight.body.source,
    recommendationCount: insight.body.recommendations.length,
    healthStatus: adminHealth.body.health.status,
    healthFailureReason: adminHealth.body.health.failureReason,
  };
} catch {
  verificationFailed = true;
} finally {
  if (userId) {
    try {
      const deleted = await request(`/auth/v1/admin/users/${userId}`, {
        method: "DELETE",
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      });
      assert.ok(
        [200, 204].includes(deleted.response.status),
        "Probe user cleanup failed",
      );
    } catch {
      verificationFailed = true;
    }
  }
}

  if (verificationFailed) {
    console.error(JSON.stringify({
      status: "failed",
      reason: "competency_insight_contract_not_verified",
    }));
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(verificationSummary));
  }
}

try {
  await verifyLiveContract();
} catch {
  console.error(JSON.stringify({
    status: "failed",
    reason: "competency_insight_probe_configuration",
  }));
  process.exitCode = 1;
}