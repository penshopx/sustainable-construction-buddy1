import assert from "node:assert/strict";
import { chmod, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import test from "node:test";
import { parse as parseToml } from "@iarna/toml";
import { signedUrlDetail, assertSignedUrlDiagnostics, jsonUrlEncoders, nestedUrlCases, assertNestedUrlDiagnostics } from "./signed-url-diagnostics-fixtures.mjs";
import { databaseSchemes, databaseJsonEncoders, databaseUrlDetail, assertDatabaseUrlDiagnostics } from "./database-url-diagnostics-fixtures.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const workspaceDir = path.resolve(rootDir, "..");
const publisherPath = path.join(rootDir, "scripts", "publish-competency-insight.mjs");
const packageJsonPath = path.join(rootDir, "package.json");
const replitConfigPath = path.join(rootDir, ".replit");
const projectRef = "abcdefghijklmnopqrst";
const otherProjectRef = "zyxwvutsrqponmlkjihg";
const sensitiveValues = [
  "publication-gate-secret",
  '{"identity":"probe-user@example.test","payload":"private-probe-payload"}',
  "probe-user@example.test",
  "https://provider.example.test/recommendations",
  "privileged-service-key-value-123",
];
const terminalUrl = "https://terminal-user:terminal-password-789@diagnostics.example.test/check?mode=debug&code=one-time-code-789";
const databaseUrls = [
  "postgresql://db-user:db-password-789@db.example.test:5432/insight",
  "redis://cache-user:cache-password-789@cache.example.test:6379/0",
];
const terminalDetail = `\x1b[31m${terminalUrl}\x1b[0m ${databaseUrls.join(" ")} \x1b]0;hidden-terminal-title\x07\x01\x08\x7f\x9b AssertionError: published function did not respond`;
const cutoffUrl = "https://cutoff-user:cutoff-password-789@cutoff.example.test/check";
const cutoffIndex = cutoffUrl.indexOf("password") + 4;
const publicationOverlap = Math.max(...[...sensitiveValues, projectRef].map((value) => Buffer.byteLength(value)));

function cutoffDetail(assertion) {
  const captureBytes = 16 * 1024 + publicationOverlap;
  const padding = captureBytes - (cutoffUrl.length - cutoffIndex) - assertion.length - 2;
  assert.ok(padding > 0);
  const detail = `${cutoffUrl}${"x".repeat(padding)} ${assertion}`;
  // The fake subprocess adds one newline. The retained tail begins inside "password".
  assert.equal(Buffer.byteLength(`${detail}\n`) - captureBytes, cutoffIndex);
  return detail;
}

async function createFakeNpm(t) {
  const directory = await mkdtemp(path.join(tmpdir(), "publish-competency-insight-"));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const tracePath = path.join(directory, "trace.log");
  const npmPath = path.join(directory, "npm");
  await writeFile(
    npmPath,
    `#!/bin/sh
printf '%s\\n' "$*" >> "$PUBLISH_TRACE_FILE"
if [ "$1" = "exec" ] && [ "$FAKE_PUBLISH_SCENARIO" = "deployment-failure" ]; then
  printf '%s\\n' "deployment stdout diagnostic" "$FAKE_STDOUT_DETAIL"
  printf '%s\\n' "$FAKE_FAILURE_DETAIL" >&2
  exit 17
fi
if [ "$1" = "run" ] && [ "$FAKE_PUBLISH_SCENARIO" = "probe-failure" ]; then
  printf '%s\\n' "probe stdout diagnostic" "$FAKE_STDOUT_DETAIL"
  printf '%s\\n' "$FAKE_FAILURE_DETAIL" >&2
  exit 23
fi
printf '%s\\n' "successful child output should stay hidden"
printf '%s\\n' "successful child stderr should stay hidden" >&2
exit 0
`,
    "utf8",
  );
  await chmod(npmPath, 0o755);

  return { directory, npmPath, tracePath };
}

function runPublisher({ npmPath, tracePath, scenario, detail = "", stdoutDetail = "", scriptPath = publisherPath, override = projectRef, supabaseUrl = `https://${projectRef}.supabase.co`, isolatedEnvironment = true, args = [] }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath, ...args], {
      cwd: rootDir,
      env: {
        ...(!isolatedEnvironment ? process.env : {}),
        PATH: `${path.dirname(npmPath)}${path.delimiter}${process.env.PATH ?? ""}`,
        PUBLISH_TRACE_FILE: tracePath,
        FAKE_PUBLISH_SCENARIO: scenario,
        FAKE_FAILURE_DETAIL: detail,
        FAKE_STDOUT_DETAIL: stdoutDetail,
        SUPABASE_URL: supabaseUrl ?? undefined,
        ...(override === null ? { SUPABASE_PROJECT_REF: undefined } : { SUPABASE_PROJECT_REF: override }),
        PUBLISH_TEST_SECRET: sensitiveValues[0],
        PUBLISH_TEST_TOKEN: sensitiveValues[1],
        PUBLISH_TEST_PASSWORD: sensitiveValues[2],
        PUBLISH_TEST_CREDENTIAL: sensitiveValues[3],
        PUBLISH_TEST_API_KEY: sensitiveValues[4],
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = [];
    const stderr = [];

    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (status, signal) => {
      resolve({
        status,
        signal,
        stdout: Buffer.concat(stdout).toString("utf8"),
        stderr: Buffer.concat(stderr).toString("utf8"),
      });
    });
  });
}

async function readTrace(tracePath) {
  const trace = await readFile(tracePath, "utf8");
  return trace.trim().split("\n").filter(Boolean);
}

async function isolatedPublisher(t, config) {
  const directory = await mkdtemp(path.join(tmpdir(), "publish-config-test-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(path.join(directory, "scripts"));
  const scriptPath = path.join(directory, "scripts", "publish-competency-insight.mjs");
  await writeFile(scriptPath, await readFile(publisherPath));
  await writeFile(
    path.join(directory, "scripts", "insight-probe-target.mjs"),
    await readFile(path.join(rootDir, "scripts", "insight-probe-target.mjs")),
  );
  await writeFile(
    path.join(directory, "scripts", "subprocess-diagnostics.mjs"),
    await readFile(path.join(rootDir, "scripts", "subprocess-diagnostics.mjs")),
  );
  await symlink(path.join(rootDir, "node_modules"), path.join(directory, "node_modules"), "dir");
  if (config !== undefined) {
    await mkdir(path.join(directory, "supabase"));
    await writeFile(path.join(directory, "supabase", "config.toml"), config);
  }
  return scriptPath;
}

function assertConfigurationFailure(result, code, message) {
  assert.equal(result.status, 1);
  assert.equal(result.signal, null);
  assert.equal(result.stdout, "");
  const output = result.stderr;
  for (const value of [...sensitiveValues, projectRef, otherProjectRef]) {
    assert.equal(output.includes(value), false, "configuration error must not expose sensitive values");
  }
  assert.deepEqual(JSON.parse(output), {
    status: "failed",
    step: "configuration",
    reason: "competency_insight_publication_not_verified",
    diagnostics: { code, message },
  });
}

// Production builds belong to service manifests when router=application.
// Keep this separate from the archived, explicitly invoked npm release below.
function assertApplicationReleaseConfig({ deployment, frontend, api, packages }) {
  assert.equal(deployment?.router, "application");
  assert.equal(deployment.deploymentTarget, "autoscale");
  for (const [manifest, packageName, serviceName, servicePath] of [
    [frontend, "@workspace/pub-aspekindo", "web", "/"],
    [api, "@workspace/api-server", "API Server", "/api"],
  ]) {
    const service = manifest.services?.find(({ name }) => name === serviceName);
    assert.ok(service, `${packageName} must define its production service`);
    assert.deepEqual(service.paths, [servicePath]);
    const production = service.production;
    assert.ok(production, `${packageName} must define production configuration`);
    const build = production.build;
    // Both command encodings are valid in artifact.toml.
    assert.deepEqual(Array.isArray(build) ? build : build?.args,
      ["pnpm", "--filter", packageName, "run", "build"],
      `${packageName} must build the intended workspace package`);
    const scripts = packages[packageName]?.scripts;
    assert.ok(scripts?.build?.trim(), `${packageName} must provide its build script`);
    assert.ok(scripts?.typecheck?.trim(), `${packageName} must provide its typecheck script`);
    if (manifest === frontend) {
      assert.equal(production.serve, "static");
      assert.equal(production.publicDir, "artifacts/pub-aspekindo/dist/public");
      assert.deepEqual(production.rewrites, [{ from: "/*", to: "/index.html" }]);
    } else {
      const run = production.run;
      assert.deepEqual(Array.isArray(run) ? run : run?.args,
        ["node", "--enable-source-maps", "artifacts/api-server/dist/index.mjs"]);
      assert.equal(production.health?.startup?.path, "/api/healthz");
    }
  }
}

function assertSanitizedOutput(result, expectedStep, exitCode) {
  assert.notEqual(result.status, 0);
  assert.equal(result.signal, null);
  const output = result.stdout + result.stderr;
  for (const value of sensitiveValues) {
    assert.equal(output.includes(value), false, `publisher output contains sensitive value: ${value}`);
  }
  assert.equal(output.includes(projectRef), false);
  const failure = JSON.parse(result.stderr);
  assert.equal(failure.status, "failed");
  assert.equal(failure.step, expectedStep);
  assert.equal(failure.reason, "competency_insight_publication_not_verified");
  assert.equal(failure.diagnostics.exitCode, exitCode);
  assert.match(failure.diagnostics.stderr, /AssertionError: published function did not respond/);
  assert.match(failure.diagnostics.stderr, /\[REDACTED\]/);
  assert.match(failure.diagnostics.stdout, /stdout diagnostic/);
  assert.match(failure.diagnostics.stdout, /\[REDACTED\]/);
  assert.equal(result.stdout, "");
}

test("archived npm release keeps validation, build, and the insight publication gate", async () => {
  const [packageJsonSource, replitConfig] = await Promise.all([
    readFile(packageJsonPath, "utf8"),
    readFile(replitConfigPath, "utf8"),
  ]);
  const packageJson = JSON.parse(packageJsonSource);
  const releaseScript = packageJson.scripts?.release;
  const insightValidationScript = packageJson.scripts?.["test:insight:validate"];
  const validationAlias = packageJson.scripts?.["validate:insight"];
  const deployment = parseToml(replitConfig).deployment;
  const releaseSteps = releaseScript?.split("&&").map((step) => step.trim());

  assert.ok(releaseScript, "package.json must define a release script");
  assert.equal(
    insightValidationScript,
    "node scripts/validate-competency-insight.mjs",
    "the standard insight validation must run both insight checks and stop on failure",
  );
  assert.equal(
    validationAlias,
    "npm run test:insight:validate",
    "the legacy validation command must point to the standard insight validation",
  );
  assert.equal(
    packageJson.scripts?.["test:insight:publish"],
    "node --test tests/publish-competency-insight.test.mjs tests/verify-competency-insight.test.mjs tests/subprocess-diagnostics.test.mjs",
    "the publication gate must include probe destination and controlled diagnostic stream checks",
  );
  assert.deepEqual(deployment?.build, ["npm", "run", "release"],
    "the archived single-app configuration must retain its guarded release command");
  assert.deepEqual(
    releaseSteps,
    ["npm run test:insight:validate", "npm run build", "npm run publish:insight"],
    "the release script must run validation and propagate the insight publication result",
  );
});

test("active application release validates service manifests without requiring deployment.build", async (t) => {
  const [replit, frontend, api, frontendPackage, apiPackage] = await Promise.all([
    readFile(path.join(workspaceDir, ".replit"), "utf8"),
    readFile(path.join(workspaceDir, "artifacts/pub-aspekindo/.replit-artifact/artifact.toml"), "utf8"),
    readFile(path.join(workspaceDir, "artifacts/api-server/.replit-artifact/artifact.toml"), "utf8"),
    readFile(path.join(workspaceDir, "artifacts/pub-aspekindo/package.json"), "utf8"),
    readFile(path.join(workspaceDir, "artifacts/api-server/package.json"), "utf8"),
  ]);
  const config = {
    deployment: parseToml(replit).deployment,
    frontend: parseToml(frontend),
    api: parseToml(api),
    packages: {
      "@workspace/pub-aspekindo": JSON.parse(frontendPackage),
      "@workspace/api-server": JSON.parse(apiPackage),
    },
  };
  assertApplicationReleaseConfig(config);
  await t.test("both manifest command forms work without a top-level build", () => {
    const alternative = structuredClone(config);
    delete alternative.deployment.build;
    const frontendProduction = alternative.frontend.services[0].production;
    frontendProduction.build = Array.isArray(frontendProduction.build)
      ? { args: frontendProduction.build } : frontendProduction.build.args;
    const apiProduction = alternative.api.services[0].production;
    apiProduction.build = Array.isArray(apiProduction.build)
      ? { args: apiProduction.build } : apiProduction.build.args;
    apiProduction.run = Array.isArray(apiProduction.run)
      ? { args: apiProduction.run } : apiProduction.run.args;
    assertApplicationReleaseConfig(alternative);
  });
  for (const [name, mutate] of [
    ["missing frontend production", (c) => { delete c.frontend.services[0].production; }],
    ["missing frontend build", (c) => { delete c.frontend.services[0].production.build; }],
    ["wrong frontend build target", (c) => { c.frontend.services[0].production.build = ["pnpm", "run", "build"]; }],
    ["wrong static output", (c) => { c.frontend.services[0].production.publicDir = "dist"; }],
    ["missing SPA rewrite", (c) => { delete c.frontend.services[0].production.rewrites; }],
    ["missing API service", (c) => { c.api.services = []; }],
    ["missing API build", (c) => { delete c.api.services[0].production.build; }],
    ["missing API run", (c) => { delete c.api.services[0].production.run; }],
    ["missing package build", (c) => { delete c.packages["@workspace/pub-aspekindo"].scripts.build; }],
    ["missing package typecheck", (c) => { delete c.packages["@workspace/api-server"].scripts.typecheck; }],
  ]) {
    await t.test(`rejects ${name}`, () => {
      const broken = structuredClone(config);
      mutate(broken);
      assert.throws(() => assertApplicationReleaseConfig(broken), assert.AssertionError);
    });
  }
});

test("unreadable configuration fails before deployment with a safe diagnosis", async (t) => {
  const fakeNpm = await createFakeNpm(t);
  const scriptPath = await isolatedPublisher(t);
  const result = await runPublisher({ ...fakeNpm, scriptPath });

  assertConfigurationFailure(result, "config_unreadable", "Cannot read supabase/config.toml");
  await assert.rejects(readFile(fakeNpm.tracePath), { code: "ENOENT" });
});

test("missing project_id fails before deployment without showing configuration contents", async (t) => {
  const fakeNpm = await createFakeNpm(t);
  const scriptPath = await isolatedPublisher(t, `other_setting = "${sensitiveValues[0]}"\n# ${sensitiveValues[4]}\n`);
  const result = await runPublisher({ ...fakeNpm, scriptPath });

  assertConfigurationFailure(result, "project_id_missing", "Missing project_id in supabase/config.toml");
  await assert.rejects(readFile(fakeNpm.tracePath), { code: "ENOENT" });
});

test("invalid, duplicate, nested, and damaged project configuration never starts deployment", async (t) => {
  for (const config of [
    'project_id = "invalid-ref"',
    `project_id = "${projectRef}"\nproject_id = "zyxwvutsrqponmlkjihg"`,
    `[other]\nproject_id = "${projectRef}"`,
    `[other.subsection]\nproject_id = "${projectRef}"`,
    `project_id = "${projectRef}"\nnot valid toml`,
    `project_id = "${projectRef}`,
    `project_id = "${projectRef}"\n[other]\nsecret = "${sensitiveValues[0]}"\ninvalid =`,
    `project_id = "${projectRef}"\n[other]\nsecret = "${sensitiveValues[0]}"\nsecret = "duplicate"`,
  ]) {
    const fakeNpm = await createFakeNpm(t);
    const scriptPath = await isolatedPublisher(t, config);
    const result = await runPublisher({ ...fakeNpm, scriptPath });
    assertConfigurationFailure(result, "config_invalid", "Invalid supabase/config.toml; expected one valid project_id");
    await assert.rejects(readFile(fakeNpm.tracePath), { code: "ENOENT" });
  }
});

test("a nested project_id cannot override or supply the deployment destination", async (t) => {
  const fakeNpm = await createFakeNpm(t);
  const scriptPath = await isolatedPublisher(t, `[other]\nproject_id = "${projectRef}"\nsecret = "${sensitiveValues[0]}"\n`);
  const result = await runPublisher({ ...fakeNpm, scriptPath, override: null });
  assertConfigurationFailure(result, "config_invalid", "Invalid supabase/config.toml; expected one valid project_id");
  await assert.rejects(readFile(fakeNpm.tracePath), { code: "ENOENT" });
});

test("an absent release ref blocks deployment even with a valid config", async (t) => {
  const fakeNpm = await createFakeNpm(t);
  const scriptPath = await isolatedPublisher(t, `project_id = "${projectRef}"\nsecret = "${sensitiveValues[0]}"\n`);
  const result = await runPublisher({ ...fakeNpm, scriptPath, override: null });

  assertConfigurationFailure(result, "project_ref_missing", "SUPABASE_PROJECT_REF must be set in the release environment");
  await assert.rejects(readFile(fakeNpm.tracePath), { code: "ENOENT" });
});

test("an invalid or mismatched release ref cannot redirect deployment", async (t) => {
  for (const override of [otherProjectRef, "not-a-valid-project-ref", ""]) {
    const fakeNpm = await createFakeNpm(t);
    const scriptPath = await isolatedPublisher(t, `project_id = "${projectRef}"\n`);
    const result = await runPublisher({ ...fakeNpm, scriptPath, override });
    if (override === otherProjectRef) {
      assertConfigurationFailure(result, "project_ref_mismatch", "SUPABASE_PROJECT_REF does not match supabase/config.toml");
    } else {
      assertConfigurationFailure(result, "project_ref_invalid", "SUPABASE_PROJECT_REF must be a valid project reference");
    }
    await assert.rejects(readFile(fakeNpm.tracePath), { code: "ENOENT" });
  }
});

test("a valid but wrong config cannot redirect deployment away from the expected release project", async (t) => {
  const fakeNpm = await createFakeNpm(t);
  const scriptPath = await isolatedPublisher(t, `project_id = "${otherProjectRef}"\nsecret = "${sensitiveValues[0]}"\n`);
  const result = await runPublisher({ ...fakeNpm, scriptPath, override: projectRef });

  assertConfigurationFailure(result, "project_ref_mismatch", "SUPABASE_PROJECT_REF does not match supabase/config.toml");
  await assert.rejects(readFile(fakeNpm.tracePath), { code: "ENOENT" });
});

test("a valid config deploys only to the matching release project", async (t) => {
  const fakeNpm = await createFakeNpm(t);
  const scriptPath = await isolatedPublisher(t, `# Publication destination\nproject_id = '${projectRef}' # confirmed\n[api]\nenabled = true\n`);
  const result = await runPublisher({ ...fakeNpm, scriptPath, override: projectRef });
  assert.equal(result.status, 0);
  assert.deepEqual(await readTrace(fakeNpm.tracePath), [
    `exec --yes -- supabase functions deploy competency-insight --project-ref ${projectRef} --use-api`,
    "run --silent test:insight:live",
  ]);
});

test("configuration-only mode accepts matching refs without invoking deploy or live probe", async (t) => {
  const fakeNpm = await createFakeNpm(t);
  const scriptPath = await isolatedPublisher(t, `project_id = "${projectRef}"\n`);
  const result = await runPublisher({ ...fakeNpm, scriptPath, args: ["--check-config"] });
  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(JSON.parse(result.stdout), {
    status: "passed", step: "configuration", deployment: "not_started", liveProbe: "not_run",
  });
  await assert.rejects(readFile(fakeNpm.tracePath), { code: "ENOENT" });
});

test("configuration-only mode rejects wrong or missing release refs before any subprocess", async (t) => {
  for (const override of [otherProjectRef, null]) {
    const fakeNpm = await createFakeNpm(t);
    const scriptPath = await isolatedPublisher(t, `project_id = "${projectRef}"\n`);
    const result = await runPublisher({ ...fakeNpm, scriptPath, override, args: ["--check-config"] });
    assertConfigurationFailure(result, override === null ? "project_ref_missing" : "project_ref_mismatch",
      override === null ? "SUPABASE_PROJECT_REF must be set in the release environment" :
        "SUPABASE_PROJECT_REF does not match supabase/config.toml");
    await assert.rejects(readFile(fakeNpm.tracePath), { code: "ENOENT" });
  }
});

test("unknown or combined flags fail closed instead of accidentally deploying", async (t) => {
  for (const args of [["--check-confg"], ["--check-config", "--deploy"]]) {
    const fakeNpm = await createFakeNpm(t);
    const result = await runPublisher({ ...fakeNpm, args });
    assertConfigurationFailure(result, "arguments_invalid", "Expected no arguments or --check-config");
    await assert.rejects(readFile(fakeNpm.tracePath), { code: "ENOENT" });
  }
});

test("live probe runs only after a successful deployment", async (t) => {
  const fakeNpm = await createFakeNpm(t);
  const scriptPath = await isolatedPublisher(t, `project_id = "${projectRef}"\n`);
  const result = await runPublisher({ ...fakeNpm, scriptPath, scenario: "success" });

  assert.equal(result.status, 0);
  assert.equal(result.stderr, "");
  assert.deepEqual(await readTrace(fakeNpm.tracePath), [
    `exec --yes -- supabase functions deploy competency-insight --project-ref ${projectRef} --use-api`,
    "run --silent test:insight:live",
  ]);
  assert.deepEqual(JSON.parse(result.stdout), {
    status: "passed",
    function: "competency-insight",
    deployment: "active",
    liveProbe: "passed",
  });
});

test("invalid probe destinations stop publication before any subprocess", async (t) => {
  for (const supabaseUrl of [
    undefined,
    "",
    `https://${otherProjectRef}.supabase.co`,
    `https://user:private-url-password@${projectRef}.supabase.co?token=private-url-token`,
    `https://${projectRef}.supabase.co.attacker.test`,
  ]) {
    const fakeNpm = await createFakeNpm(t);
    const scriptPath = await isolatedPublisher(t, `project_id = "${projectRef}"\n`);
    // Use null to omit the variable rather than invoke the helper's default.
    const result = await runPublisher({ ...fakeNpm, scriptPath, supabaseUrl: supabaseUrl ?? null });
    assertConfigurationFailure(result, "probe_target_invalid",
      "SUPABASE_URL must be the HTTPS project origin for SUPABASE_PROJECT_REF");
    assert.doesNotMatch(result.stderr, /private-url-password|private-url-token|attacker\.test/);
    await assert.rejects(readFile(fakeNpm.tracePath), { code: "ENOENT" });
  }
});

test("deployment failure stops before the live probe and stays sanitized", async (t) => {
  const fakeNpm = await createFakeNpm(t);
  const scriptPath = await isolatedPublisher(t, `project_id = "${projectRef}"\n`);
  const result = await runPublisher({
    ...fakeNpm,
    scriptPath,
    scenario: "deployment-failure",
    detail: `AssertionError: published function did not respond ${sensitiveValues.join(" ")} ${projectRef}`,
    stdoutDetail: `Bearer ${sensitiveValues[4]} ${sensitiveValues[0]}`,
  });

  assertSanitizedOutput(result, "deployment", 17);
  assert.deepEqual(await readTrace(fakeNpm.tracePath), [
    `exec --yes -- supabase functions deploy competency-insight --project-ref ${projectRef} --use-api`,
  ]);
});

test("live probe failure fails publication and stays sanitized", async (t) => {
  const fakeNpm = await createFakeNpm(t);
  const scriptPath = await isolatedPublisher(t, `project_id = "${projectRef}"\n`);
  const result = await runPublisher({
    ...fakeNpm,
    scriptPath,
    scenario: "probe-failure",
    detail: `AssertionError: published function did not respond ${sensitiveValues.join(" ")} ${projectRef}`,
    stdoutDetail: `authorization: ${sensitiveValues[4]} ${sensitiveValues[0]}`,
  });

  assertSanitizedOutput(result, "live_probe", 23);
  assert.deepEqual(await readTrace(fakeNpm.tracePath), [
    `exec --yes -- supabase functions deploy competency-insight --project-ref ${projectRef} --use-api`,
    "run --silent test:insight:live",
  ]);
});

test("deployment and probe subprocesses strip URL credentials and terminal controls from JSON diagnostics", async (t) => {
  for (const [scenario, step, exitCode] of [
    ["deployment-failure", "deployment", 17],
    ["probe-failure", "live_probe", 23],
  ]) {
    const fakeNpm = await createFakeNpm(t);
    const scriptPath = await isolatedPublisher(t, `project_id = "${projectRef}"\n`);
    const result = await runPublisher({
      ...fakeNpm,
      scriptPath,
      scenario,
      detail: terminalDetail,
      stdoutDetail: terminalDetail,
    });

    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
    const failure = JSON.parse(result.stderr);
    assert.equal(failure.step, step);
    assert.equal(failure.diagnostics.exitCode, exitCode);
    for (const diagnostic of [failure.diagnostics.stdout, failure.diagnostics.stderr]) {
      assert.match(diagnostic, /https:\/\/\[REDACTED\]@diagnostics\.example\.test\/check\?mode=debug&code=\[REDACTED\]/);
      assert.match(diagnostic, /postgresql:\/\/\[REDACTED\]@db\.example\.test:5432\/insight/);
      assert.match(diagnostic, /redis:\/\/\[REDACTED\]@cache\.example\.test:6379\/0/);
      assert.match(diagnostic, /AssertionError: published function did not respond/);
      assert.doesNotMatch(diagnostic, /[\x00-\x09\x0b-\x1f\x7f-\x9f]/);
    }
    for (const secret of ["terminal-user", "terminal-password-789", "one-time-code-789", "db-user", "db-password-789", "cache-user", "cache-password-789", "hidden-terminal-title"]) {
      assert.equal(result.stderr.includes(secret), false, `${secret} must not appear in the JSON log`);
    }
  }
});

test("deployment and probe failures drop URL password fragments at the capture cutoff", async (t) => {
  const detail = cutoffDetail("AssertionError: final publication assertion");
  for (const [scenario, step, exitCode] of [
    ["deployment-failure", "deployment", 17],
    ["probe-failure", "live_probe", 23],
  ]) {
    const fakeNpm = await createFakeNpm(t);
    const scriptPath = await isolatedPublisher(t, `project_id = "${projectRef}"\n`);
    const result = await runPublisher({
      ...fakeNpm,
      scriptPath,
      scenario,
      detail,
      stdoutDetail: detail,
      isolatedEnvironment: true,
    });

    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
    const failure = JSON.parse(result.stderr);
    assert.equal(failure.step, step);
    assert.equal(failure.diagnostics.exitCode, exitCode);
    for (const diagnostic of [failure.diagnostics.stdout, failure.diagnostics.stderr]) {
      assert.match(diagnostic, /^\[earlier output truncated\]/);
      assert.match(diagnostic, /AssertionError: final publication assertion$/);
    }
    for (const fragment of ["cutoff-user", "cutoff-password-789", "word-789@", "cutoff.example.test"]) {
      assert.equal(result.stderr.includes(fragment), false, `${fragment} must not appear in the JSON log`);
    }
  }
});

test("long failure output preserves final details without leaking a secret across the capture cutoff", async (t) => {
  const fakeNpm = await createFakeNpm(t);
  const scriptPath = await isolatedPublisher(t, `project_id = "${projectRef}"\n`);
  const result = await runPublisher({
    ...fakeNpm,
    scriptPath,
    scenario: "probe-failure",
    detail: `${"x".repeat(18_000)}${sensitiveValues[4]}${"y".repeat(16_380)}\nAssertionError: published function did not respond`,
    stdoutDetail: sensitiveValues[4].repeat(2_000),
  });

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  const output = result.stderr;
  for (const value of sensitiveValues) {
    assert.equal(output.includes(value), false);
  }
  assert.equal(output.includes("service-key-value-123"), false);
  const { diagnostics } = JSON.parse(output);
  assert.equal(diagnostics.exitCode, 23);
  assert.match(diagnostics.stderr, /^\[earlier output truncated\]/);
  assert.match(diagnostics.stderr, /AssertionError: published function did not respond$/);
  assert.ok(Buffer.byteLength(diagnostics.stderr) < 17 * 1024);
  assert.ok(Buffer.byteLength(diagnostics.stdout) < 17 * 1024);
});

test("deployment and probe redact JSON-escaped database userinfo in short and truncated stdout and stderr", async (t) => {
  const fakeNpm = await createFakeNpm(t);
  const scriptPath = await isolatedPublisher(t, `project_id = "${projectRef}"\n`);
  for (const [scenario, step, exitCode] of [
    ["deployment-failure", "deployment", 17],
    ["probe-failure", "live_probe", 23],
  ]) {
    for (const scheme of databaseSchemes) {
      for (const { name, encode } of databaseJsonEncoders) {
        for (const truncated of [false, true]) {
          await t.test(`${step}, ${scheme}, ${name}, ${truncated ? "truncated" : "short"}`, async () => {
            const detail = databaseUrlDetail(scheme, encode, truncated, publicationOverlap);
            const result = await runPublisher({
              ...fakeNpm, scriptPath, scenario, detail, stdoutDetail: detail,
            });
            const failure = assertDatabaseUrlDiagnostics(result, scheme, truncated);
            assert.equal(failure.step, step);
            assert.equal(failure.diagnostics.exitCode, exitCode);
          });
        }
      }
    }
  }
});

test("deployment and probe redact JSON-escaped URLs in short and truncated stdout and stderr", async (t) => {
  for (const [scenario, step, exitCode] of [
    ["deployment-failure", "deployment", 17],
    ["probe-failure", "live_probe", 23],
  ]) {
    for (const encode of jsonUrlEncoders) {
      for (const truncated of [false, true]) {
        const fakeNpm = await createFakeNpm(t);
        const scriptPath = await isolatedPublisher(t, `project_id = "${projectRef}"\n`);
        const detail = signedUrlDetail(truncated, publicationOverlap, encode);
        const result = await runPublisher({
          ...fakeNpm, scriptPath, scenario, detail, stdoutDetail: detail,
        });
        const failure = assertSignedUrlDiagnostics(result, truncated);
        assert.equal(failure.step, step);
        assert.equal(failure.diagnostics.exitCode, exitCode);
      }
    }
  }
});

test("deployment and probe redact percent-encoded nested URLs in short and truncated JSON diagnostics", async (t) => {
  const fakeNpm = await createFakeNpm(t);
  const scriptPath = await isolatedPublisher(t, `project_id = "${projectRef}"\n`);
  for (const [scenario, step, exitCode] of [
    ["deployment-failure", "deployment", 17],
    ["probe-failure", "live_probe", 23],
  ]) {
    for (const { url, expected } of nestedUrlCases) {
      for (const truncated of [false, true]) {
        const detail = signedUrlDetail(truncated, publicationOverlap, jsonUrlEncoders[3], url);
        const result = await runPublisher({
          ...fakeNpm, scriptPath, scenario, detail, stdoutDetail: detail,
        });
        const failure = assertNestedUrlDiagnostics(result, truncated, expected);
        assert.equal(failure.step, step);
        assert.equal(failure.diagnostics.exitCode, exitCode);
      }
    }
  }
});

test("deployment and probe redact signed URL parameters in short and truncated JSON diagnostics", async (t) => {
  for (const [scenario, step, exitCode] of [
    ["deployment-failure", "deployment", 17],
    ["probe-failure", "live_probe", 23],
  ]) {
    for (const truncated of [false, true]) {
      const fakeNpm = await createFakeNpm(t);
      const scriptPath = await isolatedPublisher(t, `project_id = "${projectRef}"\n`);
      const detail = signedUrlDetail(truncated, publicationOverlap);
      const result = await runPublisher({
        ...fakeNpm, scriptPath, scenario, detail, stdoutDetail: detail,
      });
      const failure = assertSignedUrlDiagnostics(result, truncated);
      assert.equal(failure.step, step);
      assert.equal(failure.diagnostics.exitCode, exitCode);
    }
  }
});