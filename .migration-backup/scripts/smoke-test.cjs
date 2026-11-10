const { createConnection } = require("node:net");
const { spawn, spawnSync } = require("node:child_process");

const STARTUP_TIMEOUT_MS = 30_000;
const POLL_INTERVAL_MS = 250;
const frontendPort = Number(process.env.SMOKE_FRONTEND_PORT || 5000);
const apiPort = Number(process.env.SMOKE_API_PORT || 3001);

if (!Number.isInteger(frontendPort) || !Number.isInteger(apiPort)) {
  throw new Error("SMOKE_FRONTEND_PORT and SMOKE_API_PORT must be integer ports");
}

const endpoints = {
  frontend: {
    name: `frontend on port ${frontendPort}`,
    port: frontendPort,
    url: `http://127.0.0.1:${frontendPort}/`,
    readyPattern: new RegExp(`Local:\\s+http:\\/\\/localhost:${frontendPort}\\/`),
  },
  api: {
    name: `API health on port ${apiPort}`,
    port: apiPort,
    url: `http://127.0.0.1:${apiPort}/api/health`,
    readyPattern: new RegExp(`API server running on port ${apiPort}`),
  },
};

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
let devProcess = null;
let stdout = "";
let stderr = "";
let spawnError = null;
let stopping = false;

function startDevProcess() {
  devProcess = spawn(npmCommand, ["run", "dev"], {
    cwd: process.cwd(),
    detached: process.platform !== "win32",
    env: {
      ...process.env,
      FRONTEND_PORT: String(frontendPort),
      API_PORT: String(apiPort),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  devProcess.stdout.setEncoding("utf8");
  devProcess.stderr.setEncoding("utf8");
  devProcess.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  devProcess.stderr.on("data", (chunk) => {
    stderr += chunk;
  });
  devProcess.on("error", (error) => {
    spawnError = error;
  });
}

function checkPortInUse(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    let settled = false;

    const finish = (inUse) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(inUse);
    };

    socket.once("connect", () => finish(true));
    socket.once("error", (error) => {
      if (error.code === "ECONNREFUSED") {
        finish(false);
      } else {
        finish(true);
      }
    });
    socket.setTimeout(1_000, () => finish(true));
  });
}

async function assertPortsAvailable() {
  const occupied = (
    await Promise.all(
      Object.values(endpoints).map(async (endpoint) =>
        (await checkPortInUse(endpoint.port))
          ? `${endpoint.name} is already in use`
          : null,
      ),
    )
  ).filter(Boolean);

  if (occupied.length > 0) {
    throw new Error(
      `startup smoke test requires exclusive ports; ${occupied.join("; ")}`,
    );
  }
}

function stopDevProcess() {
  if (stopping || !devProcess) {
    return Promise.resolve();
  }

  stopping = true;

  if (devProcess.exitCode !== null || devProcess.signalCode !== null) {
    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(devProcess.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } else {
      try {
        process.kill(-devProcess.pid, "SIGTERM");
      } catch (error) {
        if (error.code !== "ESRCH") return Promise.reject(error);
      }
    }
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const forceKillTimer = setTimeout(() => {
      if (process.platform === "win32") {
        spawn("taskkill", ["/pid", String(devProcess.pid), "/T", "/F"], {
          stdio: "ignore",
        });
      } else {
        try {
          process.kill(-devProcess.pid, "SIGKILL");
        } catch (error) {
          if (error.code !== "ESRCH") reject(error);
        }
      }
    }, 5_000);

    devProcess.once("exit", () => {
      clearTimeout(forceKillTimer);
      resolve();
    });

    if (process.platform === "win32") {
      spawn("taskkill", ["/pid", String(devProcess.pid), "/T", "/F"], {
        stdio: "ignore",
      });
    } else {
      try {
        process.kill(-devProcess.pid, "SIGTERM");
      } catch (error) {
        if (error.code === "ESRCH") {
          clearTimeout(forceKillTimer);
          resolve();
        } else {
          clearTimeout(forceKillTimer);
          reject(error);
        }
      }
    }
  });
}

async function checkFrontend() {
  try {
    const response = await fetch(endpoints.frontend.url);
    if (response.status !== 200) {
      return `${endpoints.frontend.name} returned HTTP ${response.status}`;
    }
    return null;
  } catch (error) {
    return `${endpoints.frontend.name} is unavailable: ${error.message}`;
  }
}

async function checkApi() {
  try {
    const response = await fetch(endpoints.api.url);
    if (response.status !== 200) {
      return `${endpoints.api.name} returned HTTP ${response.status}`;
    }

    const healthBody = await response.json();
    if (healthBody.status !== "ok") {
      return `${endpoints.api.name} returned ${JSON.stringify(healthBody)}`;
    }
    return null;
  } catch (error) {
    return `${endpoints.api.name} is unavailable: ${error.message}`;
  }
}

async function verifyDevProcess() {
  await new Promise((resolve) => setTimeout(resolve, 100));

  if (spawnError) {
    throw new Error(`could not start dev server: ${spawnError.message}`);
  }
  if (devProcess.exitCode !== null || devProcess.signalCode !== null) {
    throw new Error(
      `npm run dev exited after endpoints became ready; ${endpoints.frontend.name} and ${endpoints.api.name} were checked`,
    );
  }

  const missingReadiness = Object.values(endpoints)
    .filter((endpoint) => !endpoint.readyPattern.test(stdout))
    .map((endpoint) => `${endpoint.name} did not confirm readiness in dev output`);
  if (missingReadiness.length > 0) {
    throw new Error(missingReadiness.join("; "));
  }
}

async function checkEndpoints() {
  const deadline = Date.now() + STARTUP_TIMEOUT_MS;
  let lastErrors = [
    `${endpoints.frontend.name} is still starting`,
    `${endpoints.api.name} is still starting`,
  ];

  while (Date.now() < deadline) {
    if (spawnError) {
      throw new Error(
        `could not start dev server; ${endpoints.frontend.name} and ${endpoints.api.name} could not be checked: ${spawnError.message}`,
      );
    }

    if (devProcess.exitCode !== null || devProcess.signalCode !== null) {
      throw new Error(
        `npm run dev exited before startup completed; ${lastErrors.join("; ")}`,
      );
    }

    const errors = (await Promise.all([checkFrontend(), checkApi()])).filter(
      Boolean,
    );
    if (errors.length === 0) {
      await verifyDevProcess();
      return;
    }

    lastErrors = errors;
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  throw new Error(
    `startup smoke test timed out: ${lastErrors.join("; ")}`,
  );
}

function runBrowserTests() {
  const result = spawnSync(npmCommand, ["run", "test:e2e"], {
    cwd: process.cwd(),
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    throw new Error(`browser tests could not start: ${result.error.message}`);
  }

  if (result.status !== 0) {
    throw new Error(`browser tests failed with exit code ${result.status}`);
  }
}

async function main() {
  try {
    await assertPortsAvailable();
    startDevProcess();
    await checkEndpoints();
    console.log(
      `Startup smoke test passed: frontend 200 on port ${frontendPort}; API health ok on port ${apiPort}.`,
    );
    await stopDevProcess();
    runBrowserTests();
    console.log("Browser flow tests passed.");
  } catch (error) {
    console.error(`Startup smoke test failed: ${error.message}`);
    if (stdout.trim()) {
      console.error("\n--- npm run dev stdout ---\n" + stdout.trim());
    }
    if (stderr.trim()) {
      console.error("\n--- npm run dev stderr ---\n" + stderr.trim());
    }
    process.exitCode = 1;
  } finally {
    await stopDevProcess();
  }
}

main();