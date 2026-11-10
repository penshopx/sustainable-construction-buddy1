import assert from "node:assert/strict";
import test from "node:test";
import {
  CompetencyInsightError,
  ENGINE_SCHEMA_VERSION,
  deterministicKeys,
  healthRequestStatus,
  parseRecommendationKeys,
  requestRecommendationKeys,
  resolveInsight,
  toInsightHealth,
} from "../supabase/functions/competency-insight/contract.js";
import {
  FALLBACK_ALERT_AFTER_MS,
  FALLBACK_ALERT_AFTER_PROBES,
  createCompetencyInsightHandler,
  nextInsightHealthState,
  sourceUnavailableOutcome,
} from "../supabase/functions/competency-insight/handler.js";

test("success sends only bounded recommendation keys and accepts allowlisted output", async () => {
  const availableKeys = [
    "tender-risk",
    "legalitas-pancek",
    "proyek-controls",
    "sertifikasi-lms",
  ];
  let request;
  const fakeFetch = async (input, init) => {
    request = { input: String(input), init };
    return new Response(JSON.stringify({
      recommendationKeys: [
        "sertifikasi-lms",
        "unknown-key",
        "sertifikasi-lms",
        "tender-risk",
      ],
    }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const keys = await requestRecommendationKeys(
    "https://insight.example.test/v1/recommendations",
    "test-api-key",
    availableKeys,
    fakeFetch,
  );

  assert.deepEqual(keys, ["sertifikasi-lms", "tender-risk"]);
  assert.equal(request.input, "https://insight.example.test/v1/recommendations");
  assert.deepEqual(JSON.parse(request.init.body), {
    schemaVersion: ENGINE_SCHEMA_VERSION,
    availableRecommendationKeys: [
      "legalitas-pancek",
      "sertifikasi-lms",
      "tender-risk",
    ],
  });
  assert.deepEqual(Object.keys(JSON.parse(request.init.body)).sort(), [
    "availableRecommendationKeys",
    "schemaVersion",
  ]);
  assert.equal(request.init.headers.Authorization, "Bearer test-api-key");
});

test("timeout rejects and lets the function use deterministic fallback", async () => {
  const neverResolvingFetch = (_input, init) =>
    new Promise((_resolve, reject) => {
      const keepEventLoopAlive = setTimeout(() => {
        reject(new Error("Timeout signal did not fire"));
      }, 100);
      init.signal.addEventListener(
        "abort",
        () => {
          clearTimeout(keepEventLoopAlive);
          reject(init.signal.reason);
        },
        { once: true },
      );
    });

  await assert.rejects(
    requestRecommendationKeys(
      "https://insight.example.test/v1/recommendations",
      "test-api-key",
      ["legalitas-pancek"],
      neverResolvingFetch,
      10,
    ),
    (error) => error instanceof CompetencyInsightError && error.code === "timeout",
  );
  assert.deepEqual(deterministicKeys(["legalitas-pancek"]), ["legalitas-pancek"]);
});

test("invalid, unknown, and excessive output is bounded to the internal catalog", () => {
  const availableKeys = [
    "legalitas-member",
    "sertifikasi-assessment",
    "tender-risk",
    "proyek-workspace",
  ];

  assert.deepEqual(parseRecommendationKeys(null, availableKeys), []);
  assert.deepEqual(parseRecommendationKeys({ recommendationKeys: "tender-risk" }, availableKeys), []);
  assert.deepEqual(
    parseRecommendationKeys({
      recommendationKeys: [
        "unknown-key",
        "proyek-workspace",
        "tender-risk",
        "sertifikasi-assessment",
        "legalitas-member",
      ],
    }, availableKeys),
    ["proyek-workspace", "tender-risk", "sertifikasi-assessment"],
  );
});

test("authentication failures and invalid contracts are classified safely", async () => {
  const responseFor = (body, status = 200) => async () => new Response(
    body === undefined ? "" : JSON.stringify(body),
    { status, headers: { "Content-Type": "application/json" } },
  );

  await assert.rejects(
    requestRecommendationKeys(
      "https://insight.example.test/recommendations",
      "test-api-key",
      ["legalitas-pancek"],
      responseFor({ error: "unauthorized" }, 401),
    ),
    (error) => error instanceof CompetencyInsightError && error.code === "authentication",
  );
  await assert.rejects(
    requestRecommendationKeys(
      "https://insight.example.test/recommendations",
      "test-api-key",
      ["legalitas-pancek"],
      responseFor({ recommendationKeys: "not-an-array" }),
    ),
    (error) => error instanceof CompetencyInsightError && error.code === "invalid_contract",
  );
  await assert.rejects(
    requestRecommendationKeys(
      "https://insight.example.test/recommendations",
      "test-api-key",
      ["legalitas-pancek"],
      responseFor({ recommendationKeys: ["unknown-key"] }),
    ),
    (error) => error instanceof CompetencyInsightError && error.code === "invalid_contract",
  );
});

const INSIGHT_ENV = {
  SUPABASE_URL: "https://supabase.example.test",
  SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_SERVICE_ROLE_KEY: "service-key",
  GUSTAFTA_ENGINE_URL: "https://insight.example.test/recommendations",
};

function createFakeSupabase({
  admin = false,
  initialHealth = null,
  healthWriteError = null,
  adminIds = ["admin-1", "admin-2"],
} = {}) {
  const persistedHealth = { current: initialHealth };
  const healthWrites = [];
  const notifications = [];
  const user = { id: "member-1" };

  function resultFor(table) {
    if (table === "aspekindo_members") return { data: { id: "member-record-1" }, error: null };
    if (table === "competency_insight_health") return { data: persistedHealth.current, error: null };
    if (table === "user_roles") {
      return { data: adminIds.map((userId) => ({ user_id: userId })), error: null };
    }
    return { data: [], error: null };
  }

  function queryFor(table) {
    const query = {
      select() {
        return query;
      },
      eq() {
        return query;
      },
      limit() {
        return Promise.resolve(resultFor(table));
      },
      maybeSingle() {
        return Promise.resolve(resultFor(table));
      },
      upsert(payload) {
        if (healthWriteError) {
          return Promise.resolve({ data: null, error: { message: healthWriteError } });
        }
        persistedHealth.current = {
          status: payload.status,
          failure_reason: payload.failure_reason,
          last_probe_at: payload.last_probe_at,
          consecutive_failure_count: payload.consecutive_failure_count,
          fallback_started_at: payload.fallback_started_at,
          alert_active: payload.alert_active,
        };
        healthWrites.push(payload);
        return Promise.resolve({ data: null, error: null });
      },
      insert(payload) {
        const rows = Array.isArray(payload) ? payload : [payload];
        notifications.push(...rows.map((row) => ({ ...row, is_read: false })));
        return Promise.resolve({ data: null, error: null });
      },
      update(payload) {
        if (table === "notifications" && payload.is_read === true) {
          notifications.forEach((notification) => {
            notification.is_read = true;
          });
        }
        return query;
      },
      then(resolve, reject) {
        return Promise.resolve(resultFor(table)).then(resolve, reject);
      },
    };
    return query;
  }

  const userClient = {
    auth: {
      getUser: async () => ({ data: { user }, error: null }),
    },
    from: queryFor,
    rpc: async (functionName, args) => {
      if (functionName === "has_role") return { data: admin, error: null };
      if (functionName === "record_competency_insight_health") {
        if (healthWriteError) return { data: null, error: { message: healthWriteError } };
        const transition = nextInsightHealthState(
          persistedHealth.current,
          args.p_status,
          args.p_failure_reason,
          args.p_probe_at,
        );
        persistedHealth.current = {
          status: transition.row.status,
          failure_reason: transition.row.failure_reason,
          last_probe_at: transition.row.last_probe_at,
          consecutive_failure_count: transition.row.consecutive_failure_count,
          fallback_started_at: transition.row.fallback_started_at,
          alert_active: transition.row.alert_active,
        };
        healthWrites.push(persistedHealth.current);
        if (transition.shouldNotifyAdmins) {
          notifications.push(...adminIds.map((userId) => ({
            user_id: userId,
            type: "competency_insight_fallback",
            is_read: false,
          })));
        }
        if (transition.shouldResolveAdminAlert) {
          notifications
            .filter((notification) => notification.type === "competency_insight_fallback")
            .forEach((notification) => {
              notification.is_read = true;
            });
        }
        return { data: transition.row, error: null };
      }
      return { data: null, error: null };
    },
  };
  const createClient = (_url, key) => {
    assert.ok(key === INSIGHT_ENV.SUPABASE_ANON_KEY || key === INSIGHT_ENV.SUPABASE_SERVICE_ROLE_KEY);
    return userClient;
  };

  return { createClient, healthWrites, notifications, persistedHealth };
}

function responseBody(response) {
  return response.json();
}

function requestFor(body = {}) {
  return new Request("https://supabase.example.test/functions/v1/competency-insight", {
    method: "POST",
    headers: { Authorization: "Bearer member-token", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createEngineFetch(scenario) {
  let calls = 0;
  const fetchImpl = async (_input, init) => {
    calls += 1;
    if (scenario === "timeout") {
      return new Promise((_resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("fake timeout")), 100);
        init.signal.addEventListener("abort", () => {
          clearTimeout(timeout);
          reject(new DOMException("The operation timed out", "TimeoutError"));
        }, { once: true });
      });
    }
    if (scenario === "authentication") {
      return new Response(JSON.stringify({ error: "invalid key" }), { status: 401 });
    }
    if (scenario === "invalid-json") {
      return new Response("{not-json", { status: 200 });
    }
    return new Response(JSON.stringify({ recommendationKeys: ["tender-risk"] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  fetchImpl.calls = () => calls;
  return fetchImpl;
}

async function runIsolatedScenario({ name, envOverrides = {}, engineScenario = "connected", expected }) {
  const fakeSupabase = createFakeSupabase();
  const env = { ...INSIGHT_ENV, GUSTAFTA_ENGINE_API_KEY: "known-key", ...envOverrides };
  const fetchImpl = createEngineFetch(engineScenario);
  const getEnv = (key) => env[key];
  const memberHandler = createCompetencyInsightHandler({
    createClient: fakeSupabase.createClient,
    getEnv,
    fetchImpl,
    timeoutMs: 10,
    now: () => "2026-09-01T00:00:00.000Z",
    logger: { error() {} },
  });

  const memberResponse = await memberHandler(requestFor());
  const memberBody = await responseBody(memberResponse);
  assert.equal(memberResponse.status, 200, `${name}: member response status`);
  assert.equal(memberBody.source, expected.source, `${name}: member source`);
  assert.ok(memberBody.recommendations.length > 0, `${name}: member recommendations`);

  const memberHealthResponse = await memberHandler(requestFor({ action: "health" }));
  assert.equal(memberHealthResponse.status, 403, `${name}: member health access`);

  const adminClient = {
    ...fakeSupabase.createClient(INSIGHT_ENV.SUPABASE_URL, INSIGHT_ENV.SUPABASE_ANON_KEY),
    rpc: async () => ({ data: true, error: null }),
  };
  const adminHandlerWithRole = createCompetencyInsightHandler({
    createClient: (_url, key) => key === INSIGHT_ENV.SUPABASE_SERVICE_ROLE_KEY
      ? fakeSupabase.createClient(_url, key)
      : adminClient,
    getEnv,
    fetchImpl,
    timeoutMs: 10,
    now: () => "2026-09-01T00:00:00.000Z",
    logger: { error() {} },
  });
  const adminHealthResponse = await adminHandlerWithRole(requestFor({ action: "health" }));
  const adminHealthBody = await responseBody(adminHealthResponse);
  assert.equal(adminHealthResponse.status, 200, `${name}: admin health access`);
  assert.deepEqual(adminHealthBody.health, {
    status: expected.healthStatus,
    failureReason: expected.failureReason,
    lastProbeAt: "2026-09-01T00:00:00.000Z",
  }, `${name}: saved health matches member source`);
  assert.equal(adminHealthBody.health.status, memberBody.source, `${name}: source and health status are aligned`);
  assert.equal(fetchImpl.calls(), expected.engineCalls, `${name}: fake engine call count`);
  assert.equal(fakeSupabase.healthWrites.at(-1)?.status, expected.healthStatus, `${name}: persisted status`);
  assert.equal(fakeSupabase.healthWrites.at(-1)?.failure_reason, expected.failureReason, `${name}: persisted reason`);
}

test("isolated Edge Function keeps member source and admin health aligned on every engine path", async (t) => {
  const scenarios = [
    {
      name: "connected",
      expected: { source: "connected", healthStatus: "connected", failureReason: "none", engineCalls: 1 },
    },
    {
      name: "authentication rejected",
      engineScenario: "authentication",
      expected: { source: "deterministic", healthStatus: "deterministic", failureReason: "authentication", engineCalls: 1 },
    },
    {
      name: "timeout",
      engineScenario: "timeout",
      expected: { source: "deterministic", healthStatus: "deterministic", failureReason: "timeout", engineCalls: 1 },
    },
    {
      name: "invalid JSON",
      engineScenario: "invalid-json",
      expected: { source: "deterministic", healthStatus: "deterministic", failureReason: "invalid_contract", engineCalls: 1 },
    },
    {
      name: "empty engine key",
      envOverrides: { GUSTAFTA_ENGINE_API_KEY: "" },
      expected: { source: "deterministic", healthStatus: "deterministic", failureReason: "not_configured", engineCalls: 0 },
    },
    {
      name: "unknown engine key",
      engineScenario: "authentication",
      envOverrides: { GUSTAFTA_ENGINE_API_KEY: "unknown-key" },
      expected: { source: "deterministic", healthStatus: "deterministic", failureReason: "authentication", engineCalls: 1 },
    },
    {
      name: "missing engine configuration",
      envOverrides: { GUSTAFTA_ENGINE_URL: undefined, GUSTAFTA_ENGINE_API_KEY: undefined },
      expected: { source: "deterministic", healthStatus: "deterministic", failureReason: "not_configured", engineCalls: 0 },
    },
  ];

  for (const scenario of scenarios) {
    await t.test(scenario.name, () => runIsolatedScenario(scenario));
  }
});

test("health status remains admin-only without calling the insight service", () => {
  assert.equal(healthRequestStatus(false), 403);
  assert.equal(healthRequestStatus(undefined), 403);
  assert.equal(healthRequestStatus(true), 200);
});

test("fallback alert waits for repeated failures or duration threshold and resolves on recovery", () => {
  const firstProbeAt = "2026-09-01T00:00:00.000Z";
  const first = nextInsightHealthState(null, "deterministic", "timeout", firstProbeAt);
  assert.equal(first.row.consecutive_failure_count, 1);
  assert.equal(first.row.alert_active, false);
  assert.equal(first.shouldNotifyAdmins, false);

  const second = nextInsightHealthState(
    first.row,
    "deterministic",
    "timeout",
    "2026-09-01T00:01:00.000Z",
  );
  assert.equal(second.row.consecutive_failure_count, FALLBACK_ALERT_AFTER_PROBES - 1);
  assert.equal(second.shouldNotifyAdmins, false);

  const third = nextInsightHealthState(
    second.row,
    "deterministic",
    "timeout",
    "2026-09-01T00:02:00.000Z",
  );
  assert.equal(third.row.alert_active, true);
  assert.equal(third.shouldNotifyAdmins, true);

  const repeated = nextInsightHealthState(
    third.row,
    "deterministic",
    "unavailable",
    "2026-09-01T00:03:00.000Z",
  );
  assert.equal(repeated.shouldNotifyAdmins, false);

  const durationThreshold = nextInsightHealthState(
    first.row,
    "deterministic",
    "timeout",
    new Date(Date.parse(firstProbeAt) + FALLBACK_ALERT_AFTER_MS).toISOString(),
  );
  assert.equal(durationThreshold.row.alert_active, true);
  assert.equal(durationThreshold.shouldNotifyAdmins, true);

  const recovered = nextInsightHealthState(
    third.row,
    "connected",
    "none",
    "2026-09-01T00:04:00.000Z",
  );
  assert.equal(recovered.row.consecutive_failure_count, 0);
  assert.equal(recovered.row.fallback_started_at, null);
  assert.equal(recovered.row.alert_active, false);
  assert.equal(recovered.shouldResolveAdminAlert, true);

  const neutral = nextInsightHealthState(
    third.row,
    "deterministic",
    "none",
    "2026-09-01T00:03:00.000Z",
  );
  assert.equal(neutral.row.alert_active, true);
  assert.equal(neutral.row.consecutive_failure_count, third.row.consecutive_failure_count);
  assert.equal(neutral.shouldNotifyAdmins, false);
  assert.equal(neutral.shouldResolveAdminAlert, false);
});

test("handler notifies admins only once after threshold and resolves the alert on recovery", async () => {
  const fakeSupabase = createFakeSupabase();
  const fallbackEnv = {
    ...INSIGHT_ENV,
    GUSTAFTA_ENGINE_URL: undefined,
    GUSTAFTA_ENGINE_API_KEY: undefined,
  };
  let seconds = 0;
  const handler = createCompetencyInsightHandler({
    createClient: fakeSupabase.createClient,
    getEnv: (key) => fallbackEnv[key],
    fetchImpl: async () => {
      throw new Error("The unconfigured engine must not be called");
    },
    now: () => `2026-09-01T00:00:0${seconds++}.000Z`,
    logger: { error() {} },
  });

  await handler(requestFor());
  await handler(requestFor());
  assert.equal(fakeSupabase.notifications.length, 0);

  await handler(requestFor());
  assert.deepEqual(
    fakeSupabase.notifications.map((notification) => notification.user_id),
    ["admin-1", "admin-2"],
  );
  assert.equal(
    fakeSupabase.notifications.some((notification) => notification.user_id === "member-1"),
    false,
  );

  await handler(requestFor());
  assert.equal(fakeSupabase.notifications.length, 2);

  const connectedEnv = { ...INSIGHT_ENV, GUSTAFTA_ENGINE_API_KEY: "known-key" };
  const recoveredHandler = createCompetencyInsightHandler({
    createClient: fakeSupabase.createClient,
    getEnv: (key) => connectedEnv[key],
    fetchImpl: createEngineFetch("connected"),
    now: () => "2026-09-01T00:01:00.000Z",
    logger: { error() {} },
  });
  await recoveredHandler(requestFor());
  assert.equal(
    fakeSupabase.notifications.every((notification) => notification.is_read),
    true,
  );
  assert.equal(fakeSupabase.persistedHealth.current.alert_active, false);
});

test("source query failures return 500 and replace stale health with source_unavailable", () => {
  const outcome = sourceUnavailableOutcome();

  assert.deepEqual(outcome, {
    httpStatus: 500,
    response: { error: "Unable to read competency sources" },
    health: {
      status: "deterministic",
      failureReason: "source_unavailable",
    },
  });
  assert.notEqual(outcome.health.status, "connected");
  assert.equal(outcome.response.recommendations, undefined);
});

test("contract derives admin health from every member insight outcome", async () => {
  const availableKeys = ["legalitas-pancek", "tender-risk"];
  const scenarios = [
    {
      name: "connected",
      engineUrl: "https://insight.example.test/recommendations",
      engineApiKey: "test-api-key",
      requestKeys: async () => ["tender-risk"],
      expected: { source: "connected", failureReason: "none", recommendationKeys: ["tender-risk"] },
    },
    {
      name: "authentication",
      engineUrl: "https://insight.example.test/recommendations",
      engineApiKey: "test-api-key",
      requestKeys: async () => {
        throw new CompetencyInsightError("authentication", "denied");
      },
      expected: { source: "deterministic", failureReason: "authentication", recommendationKeys: availableKeys },
    },
    {
      name: "timeout",
      engineUrl: "https://insight.example.test/recommendations",
      engineApiKey: "test-api-key",
      requestKeys: async () => {
        throw new CompetencyInsightError("timeout", "timed out");
      },
      expected: { source: "deterministic", failureReason: "timeout", recommendationKeys: availableKeys },
    },
    {
      name: "invalid contract",
      engineUrl: "https://insight.example.test/recommendations",
      engineApiKey: "test-api-key",
      requestKeys: async () => {
        throw new CompetencyInsightError("invalid_contract", "invalid response");
      },
      expected: { source: "deterministic", failureReason: "invalid_contract", recommendationKeys: availableKeys },
    },
    {
      name: "configuration missing",
      engineUrl: "",
      engineApiKey: "",
      expected: { source: "deterministic", failureReason: "not_configured", recommendationKeys: availableKeys },
    },
    {
      name: "no missing recommendations",
      engineUrl: "https://insight.example.test/recommendations",
      engineApiKey: "test-api-key",
      missingKeys: [],
      expected: { source: "deterministic", failureReason: "none", recommendationKeys: [] },
    },
  ];

  for (const scenario of scenarios) {
    const outcome = await resolveInsight({
      missingKeys: scenario.missingKeys ?? availableKeys,
      engineUrl: scenario.engineUrl,
      engineApiKey: scenario.engineApiKey,
      requestKeys: scenario.requestKeys,
    });
    assert.deepEqual(outcome, scenario.expected, scenario.name);
    assert.deepEqual(toInsightHealth(outcome), {
      status: outcome.source,
      failureReason: outcome.failureReason,
    }, scenario.name);
  }
});

test("global admin health follows the latest persisted probe during interleaved requests", async () => {
  const fakeSupabase = createFakeSupabase();
  let releaseConnectedEngine;
  let markConnectedEngineStarted;
  const connectedEngineStarted = new Promise((resolve) => {
    markConnectedEngineStarted = resolve;
  });
  const connectedEngineReleased = new Promise((resolve) => {
    releaseConnectedEngine = resolve;
  });
  const connectedFetch = async () => {
    markConnectedEngineStarted();
    await connectedEngineReleased;
    return new Response(JSON.stringify({ recommendationKeys: ["tender-risk"] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  const connectedEnv = { ...INSIGHT_ENV, GUSTAFTA_ENGINE_API_KEY: "known-key" };
  const connectedHandler = createCompetencyInsightHandler({
    createClient: fakeSupabase.createClient,
    getEnv: (key) => connectedEnv[key],
    fetchImpl: connectedFetch,
    now: () => "2026-09-01T00:00:02.000Z",
    logger: { error() {} },
  });
  const fallbackEnv = {
    ...INSIGHT_ENV,
    GUSTAFTA_ENGINE_URL: undefined,
    GUSTAFTA_ENGINE_API_KEY: undefined,
  };
  const fallbackHandler = createCompetencyInsightHandler({
    createClient: fakeSupabase.createClient,
    getEnv: (key) => fallbackEnv[key],
    fetchImpl: async () => {
      throw new Error("The unconfigured engine must not be called");
    },
    now: () => "2026-09-01T00:00:01.000Z",
    logger: { error() {} },
  });

  const connectedResponsePromise = connectedHandler(requestFor());
  await connectedEngineStarted;

  const fallbackResponse = await fallbackHandler(requestFor());
  assert.equal((await responseBody(fallbackResponse)).source, "deterministic");
  assert.deepEqual(fakeSupabase.persistedHealth.current, {
    status: "deterministic",
    failure_reason: "not_configured",
    last_probe_at: "2026-09-01T00:00:01.000Z",
    consecutive_failure_count: 1,
    fallback_started_at: "2026-09-01T00:00:01.000Z",
    alert_active: false,
  });

  releaseConnectedEngine();
  const connectedResponse = await connectedResponsePromise;
  assert.equal((await responseBody(connectedResponse)).source, "connected");
  assert.deepEqual(fakeSupabase.persistedHealth.current, {
    status: "connected",
    failure_reason: "none",
    last_probe_at: "2026-09-01T00:00:02.000Z",
    consecutive_failure_count: 0,
    fallback_started_at: null,
    alert_active: false,
  });
  assert.deepEqual(
    fakeSupabase.healthWrites.map(({ status, failure_reason }) => ({ status, failure_reason })),
    [
      { status: "deterministic", failure_reason: "not_configured" },
      { status: "connected", failure_reason: "none" },
    ],
  );
});

test("member insight is not returned successfully when matching admin health cannot be stored", async (t) => {
  const staleHealth = {
    status: "connected",
    failure_reason: "none",
    last_probe_at: "2026-08-31T23:59:00.000Z",
  };
  const sensitiveBackendDetail = "https://provider.example.test user@example.test secret-token";
  const scenarios = [
    {
      name: "service role key missing",
      fakeOptions: { initialHealth: staleHealth },
      envOverrides: { SUPABASE_SERVICE_ROLE_KEY: undefined },
    },
    {
      name: "health upsert rejected",
      fakeOptions: { initialHealth: staleHealth, healthWriteError: sensitiveBackendDetail },
      envOverrides: {},
    },
  ];

  for (const scenario of scenarios) {
    await t.test(scenario.name, async () => {
      const fakeSupabase = createFakeSupabase(scenario.fakeOptions);
      const logs = [];
      const env = {
        ...INSIGHT_ENV,
        GUSTAFTA_ENGINE_URL: undefined,
        GUSTAFTA_ENGINE_API_KEY: undefined,
        ...scenario.envOverrides,
      };
      const handler = createCompetencyInsightHandler({
        createClient: fakeSupabase.createClient,
        getEnv: (key) => env[key],
        fetchImpl: async () => {
          throw new Error("The unconfigured engine must not be called");
        },
        now: () => "2026-09-01T00:00:00.000Z",
        logger: { error: (...args) => logs.push(args) },
      });

      const response = await handler(requestFor());
      assert.equal(response.status, 500);
      assert.deepEqual(await responseBody(response), {
        error: "Unable to create competency insight",
      });
      assert.deepEqual(fakeSupabase.persistedHealth.current, staleHealth);
      assert.equal(JSON.stringify(logs).includes(sensitiveBackendDetail), false);
      assert.equal(logs.every((entry) => entry.length === 1), true);
    });
  }
});
