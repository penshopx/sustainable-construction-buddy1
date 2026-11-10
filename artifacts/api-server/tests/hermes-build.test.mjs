import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const pinned = "4d04303818b61bf3aa09278af48356315515965b";
const script = await readFile(new URL("../scripts/build-hermes-preview.mjs", import.meta.url), "utf8");

async function fixture(t, { commit = pinned, dirty = false, exit = 0 } = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "hermes-build-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const bin = path.join(root, "bin");
  const source = path.join(root, "sdk");
  const scripts = path.join(root, "artifacts/api-server/scripts");
  await Promise.all([bin, source, scripts].map(p => mkdir(p, { recursive: true })));
  const entry = path.join(scripts, "build-hermes-preview.mjs");
  await writeFile(entry, script);
  await writeFile(path.join(bin, "git"), `#!${process.execPath}
process.stdout.write(process.argv.includes("status") ? ${JSON.stringify(dirty ? " M setup.py\n" : "")} : ${JSON.stringify(commit + "\n")});
`, { mode: 0o755 });
  await writeFile(path.join(bin, "nix"), `#!${process.execPath}
const fs = require("node:fs");
const path = require("node:path");
fs.writeFileSync(path.join(process.env.HOME, "invocation.json"), JSON.stringify({
  args: process.argv.slice(2), keys: Object.keys(process.env), home: process.env.HOME
}));
process.exit(${exit});
`, { mode: 0o755 });
  const result = spawnSync(process.execPath, [entry, source], {
    encoding: "utf8", timeout: 10_000,
    env: {
      PATH: bin,
      HOME: path.join(root, "original-home"),
      USER: "synthetic-test",
      NIX_REMOTE: "synthetic-nix-connection",
      NIX_CONFIG: "# synthetic config, no credentials",
      OPENROUTER_API_KEY: "synthetic-do-not-forward",
      SUPABASE_SERVICE_ROLE_KEY: "synthetic-do-not-forward",
      SESSION_SECRET: "synthetic-do-not-forward",
      UNKNOWN_SECRET: "synthetic-do-not-forward",
    },
  });
  const invocation = path.join(root, "generated-artifacts/hermes/build-home/invocation.json");
  return { result, invocation, root };
}

test("Hermes builder retains Nix connection settings but excludes application secrets", async t => {
  const { result, invocation, root } = await fixture(t);
  assert.equal(result.status, 0, result.stderr);
  const request = JSON.parse(await readFile(invocation, "utf8"));
  assert.ok(request.keys.includes("NIX_REMOTE"));
  assert.ok(request.keys.includes("NIX_CONFIG"));
  for (const key of ["OPENROUTER_API_KEY", "SUPABASE_SERVICE_ROLE_KEY", "SESSION_SECRET", "UNKNOWN_SECRET"]) {
    assert.ok(!request.keys.includes(key), `${key} must not reach Nix`);
  }
  assert.equal(request.home, path.join(root, "generated-artifacts/hermes/build-home"));
  assert.ok(request.args.includes("--no-write-lock-file"));
  assert.match(request.args.at(-1), new RegExp(`\\?rev=${pinned}#minimal$`));
  assert.equal(request.args[request.args.indexOf("--max-jobs") + 1], "2");
});

test("Hermes builder rejects a different source commit before running Nix", async t => {
  const { result, invocation } = await fixture(t, { commit: "0".repeat(40) });
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(invocation), false);
});

test("Hermes builder rejects modified source before running Nix", async t => {
  const { result, invocation } = await fixture(t, { dirty: true });
  assert.notEqual(result.status, 0);
  assert.equal(existsSync(invocation), false);
});

test("Hermes builder reports Nix failure instead of claiming success", async t => {
  const { result } = await fixture(t, { exit: 7 });
  assert.equal(result.status, 7);
  assert.match(result.stdout, /exited with code 7/);
});
