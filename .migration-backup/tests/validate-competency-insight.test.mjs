import assert from "node:assert/strict";
import { chmod, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import test from "node:test";
import { signedUrlDetail, assertSignedUrlDiagnostics, jsonUrlEncoders, nestedUrlCases, assertNestedUrlDiagnostics } from "./signed-url-diagnostics-fixtures.mjs";
import { databaseSchemes, databaseJsonEncoders, databaseUrlDetail, assertDatabaseUrlDiagnostics } from "./database-url-diagnostics-fixtures.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const validatorPath = path.join(rootDir, "scripts", "validate-competency-insight.mjs");
const terminalUrl = "https://terminal-user:terminal-password-789@diagnostics.example.test/check?mode=debug&code=one-time-code-789";
const databaseUrls = [
  "postgres://db-user:db-password-789@db.example.test:5432/insight",
  "mongodb+srv://mongo-user:mongo-password-789@cluster.example.test/insight",
];
const terminalDetail = `\x1b[31m${terminalUrl}\x1b[0m ${databaseUrls.join(" ")} \x1b]0;hidden-terminal-title\x07\x01\x08\x7f\x9b AssertionError: terminal diagnostic retained`;
const cutoffUrl = "https://cutoff-user:cutoff-password-789@cutoff.example.test/check";
const cutoffIndex = cutoffUrl.indexOf("password") + 4;
const validationOverlap = Math.max(...[
  "sensitive-test-value-123",
  "privileged-service-key-value-123",
  "validation-project-ref-123",
].map((value) => Buffer.byteLength(value)));

function cutoffDetail(assertion) {
  const captureBytes = 16 * 1024 + validationOverlap;
  const padding = captureBytes - (cutoffUrl.length - cutoffIndex) - assertion.length - 2;
  assert.ok(padding > 0);
  const detail = `${cutoffUrl}${"x".repeat(padding)} ${assertion}`;
  // The fake subprocess adds one newline. The retained tail begins inside "password".
  assert.equal(Buffer.byteLength(`${detail}\n`) - captureBytes, cutoffIndex);
  return detail;
}

async function createFakeNpm(t) {
  const directory = await mkdtemp(path.join(tmpdir(), "validate-competency-insight-"));
  t.after(() => rm(directory, { recursive: true, force: true }));

  const tracePath = path.join(directory, "trace.log");
  const npmPath = path.join(directory, "npm");
  await writeFile(
    npmPath,
    `#!/bin/sh
printf '%s\\n' "$*" >> "$VALIDATION_TRACE_FILE"
if [ "$FAKE_VALIDATION_SCENARIO" = "publication-failure" ] && [ "$*" = "run --silent test:insight:publish" ]; then
  printf '%s\\n' "not ok 1 - publication gate assertion" "AssertionError: expected published function" >&2
  printf '%s\\n' "token=$VALIDATION_TEST_SECRET" "Bearer $VALIDATION_TEST_SECRET" "project=$SUPABASE_PROJECT_REF" >&2
  printf '%s\\n' "publication stdout diagnostic" "secret: $VALIDATION_TEST_SECRET"
  exit 23
fi
if [ "$FAKE_VALIDATION_SCENARIO" = "contract-failure" ] && [ "$*" = "run --silent test:insight" ]; then
  printf '%s\\n' "not ok 1 - contract assertion" "at contract.test.mjs:42:7" >&2
  exit 17
fi
if [ "$FAKE_VALIDATION_SCENARIO" = "terminal-url-failure" ] && [ "$*" = "run --silent test:insight" ]; then
  printf '%s\\n' "$FAKE_TERMINAL_DETAIL" >&2
  printf '%s\\n' "stdout diagnostic $FAKE_TERMINAL_DETAIL"
  exit 17
fi
if [ "$FAKE_VALIDATION_SCENARIO" = "url-cutoff-failure" ] && [ "$*" = "run --silent test:insight" ]; then
  printf '%s\\n' "$FAKE_CUTOFF_URL_DETAIL" >&2
  printf '%s\\n' "$FAKE_CUTOFF_URL_DETAIL"
  exit 17
fi
if [ "$FAKE_VALIDATION_SCENARIO" = "long-failure" ] && [ "$*" = "run --silent test:insight" ]; then
  count=0
  while [ "$count" -lt 1000 ]; do
    printf '%s\\n' "repeated diagnostic line with lots of output" >&2
    printf '%s\\n' "repeated stdout diagnostic with lots of output"
    count=$((count + 1))
  done
  printf '%s\\n' "stdout final useful detail"
  printf '%s\\n' "AssertionError: final useful detail" >&2
  exit 17
fi
if [ "$FAKE_VALIDATION_SCENARIO" = "key-failure" ] && [ "$*" = "run --silent test:insight" ]; then
  printf '%s\\n' "AssertionError: $SUPABASE_SERVICE_ROLE_KEY did not match" >&2
  exit 17
fi
if [ "$FAKE_VALIDATION_SCENARIO" = "cutoff-failure" ] && [ "$*" = "run --silent test:insight" ]; then
  printf '%s' "$SUPABASE_SERVICE_ROLE_KEY" >&2
  printf '%16375s' '' | tr ' ' 'x' >&2
  printf '%s\\n' " final assertion" >&2
  exit 17
fi
if [ "$FAKE_VALIDATION_SCENARIO" = "repeated-key-failure" ] && [ "$*" = "run --silent test:insight" ]; then
  count=0
  while [ "$count" -lt 1000 ]; do
    printf '%s\\n' "$SUPABASE_SERVICE_ROLE_KEY" >&2
    count=$((count + 1))
  done
  printf '%s\\n' "AssertionError: repeated key output" >&2
  exit 17
fi
if [ "$FAKE_VALIDATION_SCENARIO" = "success" ]; then
  printf '%s\\n' "passing test output"
fi
exit 0
`,
    "utf8",
  );
  await chmod(npmPath, 0o755);

  return { directory, npmPath, tracePath };
}

function runValidator({ npmPath, tracePath, scenario, detail = terminalDetail }) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [validatorPath], {
      cwd: rootDir,
      env: {
        PATH: `${path.dirname(npmPath)}${path.delimiter}${process.env.PATH ?? ""}`,
        VALIDATION_TRACE_FILE: tracePath,
        FAKE_VALIDATION_SCENARIO: scenario,
        FAKE_TERMINAL_DETAIL: detail,
        FAKE_CUTOFF_URL_DETAIL: cutoffDetail("AssertionError: final contract assertion"),
        VALIDATION_TEST_SECRET: "sensitive-test-value-123",
        SUPABASE_SERVICE_ROLE_KEY: "privileged-service-key-value-123",
        SUPABASE_PROJECT_REF: "validation-project-ref-123",
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

test("standard validator runs every local insight check in order", async (t) => {
  const fakeNpm = await createFakeNpm(t);
  const result = await runValidator({ ...fakeNpm, scenario: "success" });

  assert.equal(result.status, 0);
  assert.equal(result.signal, null);
  assert.equal(result.stderr, "");
  assert.deepEqual(await readTrace(fakeNpm.tracePath), [
    "run --silent test:insight",
    "run --silent test:insight:publish",
  ]);
  assert.deepEqual(JSON.parse(result.stdout), {
    status: "passed",
    checks: ["contract", "publication_gate"],
  });
});

test("publication failure includes bounded, sanitized subprocess diagnostics", async (t) => {
  const fakeNpm = await createFakeNpm(t);
  const result = await runValidator({ ...fakeNpm, scenario: "publication-failure" });

  assert.notEqual(result.status, 0);
  assert.equal(result.signal, null);
  assert.equal(result.stdout, "");
  const failure = JSON.parse(result.stderr);
  assert.equal(failure.status, "failed");
  assert.equal(failure.step, "publication_gate");
  assert.equal(failure.reason, "competency_insight_validation_failed");
  assert.equal(failure.diagnostics.exitCode, 23);
  assert.match(failure.diagnostics.stderr, /not ok 1 - publication gate assertion/);
  assert.match(failure.diagnostics.stderr, /AssertionError: expected published function/);
  assert.match(failure.diagnostics.stdout, /publication stdout diagnostic/);
  assert.match(failure.diagnostics.stdout, /\[REDACTED\]/);
  assert.match(failure.diagnostics.stderr, /\[REDACTED\]/);
  assert.equal(result.stderr.includes("sensitive-test-value-123"), false);
  assert.equal(result.stderr.includes("validation-project-ref-123"), false);
  assert.deepEqual(await readTrace(fakeNpm.tracePath), [
    "run --silent test:insight",
    "run --silent test:insight:publish",
  ]);
});

test("contract failure reports its assertion and skips publication gate", async (t) => {
  const fakeNpm = await createFakeNpm(t);
  const result = await runValidator({ ...fakeNpm, scenario: "contract-failure" });

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  const failure = JSON.parse(result.stderr);
  assert.equal(failure.step, "contract");
  assert.equal(failure.diagnostics.exitCode, 17);
  assert.match(failure.diagnostics.stderr, /not ok 1 - contract assertion/);
  assert.match(failure.diagnostics.stderr, /at contract\.test\.mjs:42:7/);
  assert.deepEqual(await readTrace(fakeNpm.tracePath), ["run --silent test:insight"]);
});

test("contract subprocess strips URL credentials and terminal controls from JSON diagnostics", async (t) => {
  const fakeNpm = await createFakeNpm(t);
  const result = await runValidator({ ...fakeNpm, scenario: "terminal-url-failure" });

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  const failure = JSON.parse(result.stderr);
  assert.equal(failure.step, "contract");
  assert.equal(failure.diagnostics.exitCode, 17);
  for (const diagnostic of [failure.diagnostics.stdout, failure.diagnostics.stderr]) {
    assert.match(diagnostic, /https:\/\/\[REDACTED\]@diagnostics\.example\.test\/check\?mode=debug&code=\[REDACTED\]/);
    assert.match(diagnostic, /postgres:\/\/\[REDACTED\]@db\.example\.test:5432\/insight/);
    assert.match(diagnostic, /mongodb\+srv:\/\/\[REDACTED\]@cluster\.example\.test\/insight/);
    assert.match(diagnostic, /AssertionError: terminal diagnostic retained/);
    assert.doesNotMatch(diagnostic, /[\x00-\x09\x0b-\x1f\x7f-\x9f]/);
  }
  for (const secret of ["terminal-user", "terminal-password-789", "one-time-code-789", "db-user", "db-password-789", "mongo-user", "mongo-password-789", "hidden-terminal-title"]) {
    assert.equal(result.stderr.includes(secret), false, `${secret} must not appear in the JSON log`);
  }
  assert.deepEqual(await readTrace(fakeNpm.tracePath), ["run --silent test:insight"]);
});

test("contract failure drops URL password fragments when capture starts inside a subprocess-only URL", async (t) => {
  const fakeNpm = await createFakeNpm(t);
  const result = await runValidator({ ...fakeNpm, scenario: "url-cutoff-failure" });

  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  const failure = JSON.parse(result.stderr);
  assert.equal(failure.step, "contract");
  assert.equal(failure.diagnostics.exitCode, 17);
  for (const diagnostic of [failure.diagnostics.stdout, failure.diagnostics.stderr]) {
    assert.match(diagnostic, /^\[earlier output truncated\]/);
    assert.match(diagnostic, /AssertionError: final contract assertion$/);
  }
  for (const fragment of ["cutoff-user", "cutoff-password-789", "word-789@", "cutoff.example.test"]) {
    assert.equal(result.stderr.includes(fragment), false, `${fragment} must not appear in the JSON log`);
  }
  assert.deepEqual(await readTrace(fakeNpm.tracePath), ["run --silent test:insight"]);
});

test("validator redacts JSON-escaped database userinfo in short and truncated stdout and stderr", async (t) => {
  const fakeNpm = await createFakeNpm(t);
  for (const scheme of databaseSchemes) {
    for (const { name, encode } of databaseJsonEncoders) {
      for (const truncated of [false, true]) {
        await t.test(`${scheme}, ${name}, ${truncated ? "truncated" : "short"}`, async () => {
          const result = await runValidator({
            ...fakeNpm,
            scenario: "terminal-url-failure",
            detail: databaseUrlDetail(scheme, encode, truncated, validationOverlap),
          });
          const failure = assertDatabaseUrlDiagnostics(result, scheme, truncated);
          assert.equal(failure.step, "contract");
          assert.equal(failure.diagnostics.exitCode, 17);
        });
      }
    }
  }
});

test("validator redacts JSON-escaped URLs in short and truncated stdout and stderr", async (t) => {
  for (const encode of jsonUrlEncoders) {
    for (const truncated of [false, true]) {
      const fakeNpm = await createFakeNpm(t);
      const result = await runValidator({
        ...fakeNpm,
        scenario: "terminal-url-failure",
        detail: signedUrlDetail(truncated, validationOverlap, encode),
      });
      const failure = assertSignedUrlDiagnostics(result, truncated);
      assert.equal(failure.step, "contract");
      assert.equal(failure.diagnostics.exitCode, 17);
    }
  }
});

test("validator redacts percent-encoded nested URLs in short and truncated JSON diagnostics", async (t) => {
  const fakeNpm = await createFakeNpm(t);
  for (const { url, expected } of nestedUrlCases) {
    for (const truncated of [false, true]) {
      const result = await runValidator({
        ...fakeNpm,
        scenario: "terminal-url-failure",
        detail: signedUrlDetail(truncated, validationOverlap, jsonUrlEncoders[3], url),
      });
      const failure = assertNestedUrlDiagnostics(result, truncated, expected);
      assert.equal(failure.step, "contract");
      assert.equal(failure.diagnostics.exitCode, 17);
    }
  }
});

test("validator redacts signed URL parameters in short and truncated JSON diagnostics", async (t) => {
  for (const truncated of [false, true]) {
    const fakeNpm = await createFakeNpm(t);
    const result = await runValidator({
      ...fakeNpm,
      scenario: "terminal-url-failure",
      detail: signedUrlDetail(truncated, validationOverlap),
    });
    const failure = assertSignedUrlDiagnostics(result, truncated);
    assert.equal(failure.step, "contract");
    assert.equal(failure.diagnostics.exitCode, 17);
    assert.deepEqual(await readTrace(fakeNpm.tracePath), ["run --silent test:insight"]);
  }
});

test("long failures keep the final assertion without flooding logs", async (t) => {
  const fakeNpm = await createFakeNpm(t);
  const result = await runValidator({ ...fakeNpm, scenario: "long-failure" });

  assert.notEqual(result.status, 0);
  const { diagnostics } = JSON.parse(result.stderr);
  assert.match(diagnostics.stderr, /^\[earlier output truncated\]/);
  assert.match(diagnostics.stderr, /AssertionError: final useful detail$/);
  assert.ok(Buffer.byteLength(diagnostics.stderr) < 17 * 1024);
  assert.match(diagnostics.stdout, /^\[earlier output truncated\]/);
  assert.match(diagnostics.stdout, /stdout final useful detail$/);
  assert.ok(Buffer.byteLength(diagnostics.stdout) < 17 * 1024);
});

test("a service role key in plain assertion output is redacted", async (t) => {
  const fakeNpm = await createFakeNpm(t);
  const result = await runValidator({ ...fakeNpm, scenario: "key-failure" });

  assert.notEqual(result.status, 0);
  assert.match(JSON.parse(result.stderr).diagnostics.stderr, /AssertionError: \[REDACTED\] did not match/);
  assert.equal(result.stderr.includes("privileged-service-key-value-123"), false);
});

test("a service role key crossing the output cutoff cannot leak its suffix", async (t) => {
  const fakeNpm = await createFakeNpm(t);
  const result = await runValidator({ ...fakeNpm, scenario: "cutoff-failure" });

  assert.notEqual(result.status, 0);
  const diagnostic = JSON.parse(result.stderr).diagnostics.stderr;
  assert.match(diagnostic, /final assertion$/);
  assert.equal(diagnostic.includes("service-key-value-123"), false);
  assert.equal(diagnostic.includes("privileged-service-key-value-123"), false);
});

test("repeated credentials cannot expose a fragment from the capture boundary", async (t) => {
  const fakeNpm = await createFakeNpm(t);
  const result = await runValidator({ ...fakeNpm, scenario: "repeated-key-failure" });

  assert.notEqual(result.status, 0);
  const diagnostic = JSON.parse(result.stderr).diagnostics.stderr;
  assert.match(diagnostic, /AssertionError: repeated key output$/);
  assert.equal(diagnostic.includes("service-key-value-123"), false);
  assert.equal(diagnostic.includes("privileged-service-key-value-123"), false);
  assert.match(diagnostic, /\[REDACTED\]/);
});