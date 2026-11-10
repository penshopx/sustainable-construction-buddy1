import { spawn } from "node:child_process";
import { mkdir, mkdtemp, readFile, realpath, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

// Startup/local-fixture probes only: no external AI, member documents, or app session.
const root = fileURLToPath(new URL("../../../", import.meta.url));
const commit = "4d04303818b61bf3aa09278af48356315515965b";
const runtime = await realpath(path.join(root, "generated-artifacts/hermes/runtime"));
if (!runtime.startsWith("/nix/store/")) throw new Error("Expected a Nix-built runtime.");
const manifest = JSON.parse(await readFile(path.join(runtime, "command-map.json"), "utf8"));
if (manifest.env?.HERMES_REVISION !== commit) {
  throw new Error("Runtime provenance does not match the pinned source.");
}
const home = await mkdtemp(path.join(root, "generated-artifacts/hermes/probe-"));
await mkdir(path.join(home, "tmp"), { mode: 0o700 });
const env = {
  PATH: "/usr/bin:/bin",
  HOME: home,
  HERMES_HOME: path.join(home, "hermes"),
  XDG_CONFIG_HOME: path.join(home, "config"),
  XDG_CACHE_HOME: path.join(home, "cache"),
  TMPDIR: path.join(home, "tmp"),
  LANG: "C.UTF-8",
};
const fixture = process.argv.includes("--fixture");
let command = path.join(runtime, "bin/hermes");
let args = ["--version"];
if (fixture) {
  const entry = await readFile(manifest.commands.hermes.source, "utf8");
  command = entry.split("\n")[0].slice(2);
  if (!/^\/nix\/store\/[^/]+\/bin\/python3(?:\.\d+)?$/.test(command)) {
    throw new Error("Unrecognized runtime interpreter.");
  }
  for (const key of [
    "HERMES_NODE", "HERMES_REVISION", "HERMES_PYTHON", "HERMES_INSTALL_ROOT",
    "HERMES_BUNDLED_LOCALES", "HERMES_OPTIONAL_MCPS", "HERMES_OPTIONAL_SKILLS",
    "HERMES_BUNDLED_PLUGINS", "HERMES_BUNDLED_SKILLS", "HERMES_TUI_DIR", "HERMES_WEB_DIST",
  ]) {
    if (typeof manifest.env[key] === "string") env[key] = manifest.env[key];
  }
  args = ["-I", "-B", path.join(root, "artifacts/api-server/scripts/hermes-fixture.py")];
}
let output = "";
let overflow = false;
let timer, killTimer;
try {
  const child = spawn(command, args, {
    env, cwd: home, detached: true, stdio: ["ignore", "pipe", "pipe"],
  });
  let timedOut = false;
  const stop = () => {
    try { process.kill(-child.pid, "SIGTERM"); } catch {}
    killTimer = setTimeout(() => {
      try { process.kill(-child.pid, "SIGKILL"); } catch {}
    }, 2000);
    killTimer.unref();
  };
  const collect = chunk => {
    if (overflow) return;
    output += chunk.toString();
    if (Buffer.byteLength(output) > 64 * 1024) {
      overflow = true;
      stop();
      output = "";
    }
  };
  child.stdout.on("data", collect);
  child.stderr.on("data", collect);
  timer = setTimeout(() => { timedOut = true; stop(); }, fixture ? 45_000 : 20_000);
  const code = await new Promise(resolve => {
    child.once("error", () => resolve(1));
    child.once("close", result => resolve(result ?? 1));
  });
  const fixtureLine = fixture && output.split("\n").find(line => line.startsWith('{"hermesFixture":'));
  const fixtureResult = fixtureLine ? JSON.parse(fixtureLine) : null;
  if (timedOut || overflow || code !== 0 || (fixture ? fixtureResult?.ok !== true :
      !/hermes/i.test(output) || !/\b\d+\.\d+\.\d+\b/.test(output))) {
    if (fixtureResult) console.log(JSON.stringify(fixtureResult));
    throw new Error("Hermes startup probe failed; read-only agent execution remains unverified.");
  }
  console.log(JSON.stringify(fixture ? fixtureResult : {
    probe: "version-only", sourceCommit: commit, startup: "passed",
    agentExecution: "not-tested", applicationData: "not-used",
  }));
} finally {
  clearTimeout(timer);
  clearTimeout(killTimer);
  await rm(home, { recursive: true, force: true });
}
