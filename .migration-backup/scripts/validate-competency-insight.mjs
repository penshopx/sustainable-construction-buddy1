import { spawn } from "node:child_process";
import { captureOutput, safeDiagnostic } from "./subprocess-diagnostics.mjs";

const validationSteps = [
  {
    name: "contract",
    args: ["run", "--silent", "test:insight"],
  },
  {
    name: "publication_gate",
    args: ["run", "--silent", "test:insight:publish"],
  },
];

class ValidationStepError extends Error {
  constructor(step, diagnostics) {
    super(step);
    this.step = step;
    this.diagnostics = diagnostics;
  }
}

function runNpm(args, step) {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env,
    });
    const stdout = captureOutput(child.stdout);
    const stderr = captureOutput(child.stderr);

    child.on("error", (error) => reject(new ValidationStepError(step, {
      spawnError: error.code ?? "unknown",
    })));
    child.on("close", (code, signal) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new ValidationStepError(step, {
          exitCode: code,
          ...(signal ? { signal } : {}),
          stdout: safeDiagnostic(stdout()),
          stderr: safeDiagnostic(stderr()),
        }));
      }
    });
  });
}

try {
  for (const step of validationSteps) {
    await runNpm(step.args, step.name);
  }

  console.log(JSON.stringify({
    status: "passed",
    checks: validationSteps.map(({ name }) => name),
  }));
} catch (error) {
  console.error(JSON.stringify({
    status: "failed",
    step: error instanceof ValidationStepError ? error.step : "configuration",
    reason: "competency_insight_validation_failed",
    ...(error instanceof ValidationStepError ? { diagnostics: error.diagnostics } : {}),
  }));
  process.exitCode = 1;
}