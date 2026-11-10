import { spawn, spawnSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { mkdir, realpath } from "node:fs/promises";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

// Build only. This does not launch Hermes, configure a provider, or deploy.
const commit = "4d04303818b61bf3aa09278af48356315515965b";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const source = await realpath(process.argv[2] ??
  path.join(root, ".cache/uv/git-v1/checkouts/d9298bd508be397d/4d04303818"));
const output = path.join(root, "generated-artifacts/hermes");
await mkdir(path.join(output, "build-home"), { recursive: true, mode: 0o700 });

// Retain the host's Nix connection settings, not application credentials.
// In this environment dropping NIX_REMOTE/NIX_CONFIG selects an inaccessible store.
const allowed = [
  "PATH", "USER", "LANG", "SSL_CERT_FILE", "SSL_CERT_DIR",
  "NIX_REMOTE", "NIX_CONFIG", "NIX_PATH", "NIX_CONF_DIR",
  "NIX_SSL_CERT_FILE", "NIXPKGS_ALLOW_UNFREE", "REPLIT_NIX_PACKAGE_STORE_ROOT",
];
const env = Object.fromEntries(allowed.flatMap(key =>
  process.env[key] === undefined ? [] : [[key, process.env[key]]]));
env.HOME = path.join(output, "build-home");
const git = args => spawnSync("git", ["-C", source, ...args], {
  env, encoding: "utf8", timeout: 15_000, maxBuffer: 64 * 1024,
});
const identity = git(["rev-parse", "HEAD"]);
const changes = git(["status", "--porcelain", "--untracked-files=normal"]);
if (identity.status !== 0 || identity.stdout.trim() !== commit ||
    changes.status !== 0 || changes.stdout.trim()) {
  throw new Error("Hermes source must be a clean checkout of the pinned commit.");
}

const target = `git+${pathToFileURL(source)}?rev=${commit}#minimal`;
const log = createWriteStream(path.join(output, "build.log"), { mode: 0o600 });
const child = spawn("nix", [
  "--extra-experimental-features", "nix-command flakes",
  "build", "--no-write-lock-file", "--max-jobs", "2", "--cores", "2",
  "--out-link", path.join(output, "runtime"), target,
], { env, stdio: ["ignore", "pipe", "pipe"], detached: true });
child.stdout.pipe(log, { end: false });
child.stderr.pipe(log, { end: false });
let timedOut = false;
let forceKill;
const stop = () => {
  if (!child.pid) return;
  try { process.kill(-child.pid, "SIGTERM"); } catch {}
  forceKill = setTimeout(() => {
    try { process.kill(-child.pid, "SIGKILL"); } catch {}
  }, 5000);
  forceKill.unref();
};
const deadline = setTimeout(() => { timedOut = true; stop(); }, 600_000);
process.once("SIGTERM", stop);
process.once("SIGINT", stop);
const result = await new Promise(resolve => {
  child.once("error", () => resolve(1));
  child.once("close", code => resolve(code ?? 1));
});
clearTimeout(deadline);
clearTimeout(forceKill);
await new Promise(resolve => log.end(
  `\nHermes build exit: ${timedOut ? 124 : result}\n`, resolve));
console.log(timedOut ? "Hermes build reached its ten-minute limit."
  : `Hermes build exited with code ${result}.`);
console.log("Build log: generated-artifacts/hermes/build.log");
process.exitCode = timedOut ? 124 : result;
