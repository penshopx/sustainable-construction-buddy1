import { readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";
import TOML from "@iarna/toml";
import { captureOutput, safeDiagnostic } from "./subprocess-diagnostics.mjs";
import { validateProbeTarget } from "./insight-probe-target.mjs";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const functionName = "competency-insight";

class PublishStepError extends Error {
  constructor(step, diagnostics) {
    super(step);
    this.step = step;
    this.diagnostics = diagnostics;
  }
}

function invalidConfig() {
  return new PublishStepError("configuration", {
    code: "config_invalid",
    message: "Invalid supabase/config.toml; expected one valid project_id",
  });
}

function hasNestedProjectId(value) {
  if (value === null || typeof value !== "object") return false;
  return Object.values(value).some((child) =>
    child !== null && typeof child === "object" &&
    (Object.hasOwn(child, "project_id") || hasNestedProjectId(child))
  );
}

async function readProjectRef() {
  const configPath = path.join(rootDir, "supabase", "config.toml");
  let config;
  try {
    config = await readFile(configPath, "utf8");
  } catch {
    throw new PublishStepError("configuration", {
      code: "config_unreadable",
      message: "Cannot read supabase/config.toml",
    });
  }
  let parsed;
  try {
    parsed = TOML.parse(config);
  } catch {
    // Parser errors can contain source text. Never include them in diagnostics.
    throw invalidConfig();
  }
  if (!Object.hasOwn(parsed, "project_id")) {
    if (hasNestedProjectId(parsed)) throw invalidConfig();
    throw new PublishStepError("configuration", {
      code: "project_id_missing",
      message: "Missing project_id in supabase/config.toml",
    });
  }
  if (typeof parsed.project_id !== "string" || !/^[a-z0-9]{20}$/.test(parsed.project_id)) {
    throw invalidConfig();
  }

  const projectRef = parsed.project_id;
  const expectedRef = process.env.SUPABASE_PROJECT_REF;
  if (expectedRef === undefined) {
    throw new PublishStepError("configuration", {
      code: "project_ref_missing",
      message: "SUPABASE_PROJECT_REF must be set in the release environment",
    });
  }
  if (!/^[a-z0-9]{20}$/.test(expectedRef)) {
    throw new PublishStepError("configuration", {
      code: "project_ref_invalid",
      message: "SUPABASE_PROJECT_REF must be a valid project reference",
    });
  }
  if (expectedRef !== projectRef) {
    throw new PublishStepError("configuration", {
      code: "project_ref_mismatch",
      message: "SUPABASE_PROJECT_REF does not match supabase/config.toml",
    });
  }
  return expectedRef;
}

function runQuiet(command, args, step) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const stdout = captureOutput(child.stdout);
    const stderr = captureOutput(child.stderr);

    child.on("error", (error) => reject(new PublishStepError(step, {
      spawnError: error.code ?? "unknown",
    })));
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new PublishStepError(step, {
          exitCode: code,
          ...(signal ? { signal } : {}),
          stdout: safeDiagnostic(stdout()),
          stderr: safeDiagnostic(stderr()),
        }));
      }
    });
  });
}

async function publishAndVerify() {
  const projectRef = await readProjectRef();
  try {
    validateProbeTarget(process.env.SUPABASE_URL, projectRef);
  } catch {
    throw new PublishStepError("configuration", {
      code: "probe_target_invalid",
      message: "SUPABASE_URL must be the HTTPS project origin for SUPABASE_PROJECT_REF",
    });
  }

  await runQuiet(
    "npm",
    [
      "exec",
      "--yes",
      "--",
      "supabase",
      "functions",
      "deploy",
      functionName,
      "--project-ref",
      projectRef,
      "--use-api",
    ],
    "deployment",
  );

  await runQuiet(
    "npm",
    ["run", "--silent", "test:insight:live"],
    "live_probe",
  );
}

try {
  const args = process.argv.slice(2);
  if (args.length && (args.length !== 1 || args[0] !== "--check-config")) {
    throw new PublishStepError("configuration", {
      code: "arguments_invalid",
      message: "Expected no arguments or --check-config",
    });
  }
  if (args[0] === "--check-config") {
    await readProjectRef();
    console.log(JSON.stringify({
      status: "passed",
      step: "configuration",
      deployment: "not_started",
      liveProbe: "not_run",
    }));
  } else {
    await publishAndVerify();
    console.log(JSON.stringify({
      status: "passed",
      function: functionName,
      deployment: "active",
      liveProbe: "passed",
    }));
  }
} catch (error) {
  const step = error instanceof PublishStepError ? error.step : "configuration";
  console.error(JSON.stringify({
    status: "failed",
    step,
    reason: "competency_insight_publication_not_verified",
    ...(error instanceof PublishStepError ? { diagnostics: error.diagnostics } : {}),
  }));
  process.exitCode = 1;
}