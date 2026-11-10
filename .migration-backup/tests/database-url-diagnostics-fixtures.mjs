import assert from "node:assert/strict";

// None of these credentials is registered as a secret in the subprocess env.
const username = "synthetic-db-reader";
const password = "synthetic-db-private-739";
const assertion = "AssertionError: database connection refused";
export const databaseSchemes = ["postgres", "postgresql", "mongodb", "mongodb+srv", "redis", "rediss"];
export const databaseJsonEncoders = [
  { name: "escaped slashes", encode: (url) => url.replaceAll("/", "\\/") },
  {
    name: "Unicode delimiters",
    encode: (url) => url.replace(/[:/@]/g, (character) =>
      `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`),
  },
  {
    name: "mixed delimiters",
    encode: (url) => url.replaceAll("/", "\\/").replaceAll(":", "\\u003A").replaceAll("@", "\\u0040"),
  },
];

export function databaseUrlDetail(scheme, encode, truncated, overlap) {
  const url = `${scheme}://${username}:${password}@database.example.test:1234/insight?mode=debug`;
  const suffix = ` {"url":"${encode(url)}","message":"connection failed"} ${assertion}`;
  if (!truncated) return suffix.trimStart();

  const prefix = `{"url":"${encode(url)}`;
  const cutoff = prefix.indexOf(password) + "synthetic-db-".length;
  const captureBytes = 16 * 1024 + overlap;
  const padding = captureBytes - (prefix.length - cutoff) - suffix.length - 1;
  assert.ok(padding > 0);
  const detail = `${prefix}${"x".repeat(padding)}${suffix}`;
  // The fake subprocess adds a newline; capture starts inside the DB password.
  assert.equal(Buffer.byteLength(`${detail}\n`) - captureBytes, cutoff);
  return detail;
}

export function assertDatabaseUrlDiagnostics(result, scheme, truncated) {
  assert.notEqual(result.status, 0);
  assert.equal(result.signal, null);
  assert.equal(result.stdout, "");
  const failure = JSON.parse(result.stderr);
  const safeJson = JSON.stringify({
    url: `${scheme}://[REDACTED]@database.example.test:1234/insight?mode=debug`,
    message: "connection failed",
  });
  for (const [stream, diagnostic] of Object.entries(failure.diagnostics).filter(
    ([name]) => name === "stdout" || name === "stderr",
  )) {
    assert.equal(diagnostic.includes(safeJson), true, `${stream} must retain the safe URL and JSON message`);
    assert.equal(diagnostic.endsWith(assertion), true, `${stream} must retain the final assertion`);
    assert.equal(diagnostic.startsWith("[earlier output truncated]"), truncated);
    assert.ok(Buffer.byteLength(diagnostic) < 17 * 1024);
  }
  // Check the entire emitted log, including any password tail at the cutoff.
  for (const credential of [username, password, "private-739"]) {
    assert.equal(result.stderr.includes(credential), false, `${credential} must not appear in the JSON log`);
  }
  assert.equal(typeof failure.diagnostics.stdout, "string");
  assert.equal(typeof failure.diagnostics.stderr, "string");
  return failure;
}
