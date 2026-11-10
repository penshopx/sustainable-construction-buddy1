import assert from "node:assert/strict";

// These values deliberately do not exist in the subprocess environment as secrets.
const parameters = [
  "X-Amz-Signature", "x-amz-credential", "X-Amz-Security-Token",
  "X-Goog-Signature", "X-Goog-Credential", "GoogleAccessId", "AWSAccessKeyId",
  "Signature", "sig", "Policy", "Key-Pair-Id", "token", "signed_token",
  "access_token", "refresh-token", "id_token", "jwt", "X%2DAmz%2DSignature",
  "SIGNATURE", "sig",
];
const secrets = parameters.map((_, index) => `signed-value-${index}-private%2Fpart%3D`);
export const signedUrl = `https://storage.example.test/private/video.mp4?mode=debug&${parameters.map((name, index) => `${name}=${secrets[index]}`).join("&")}&expires=3600#sig=fragment-private-value&section=details`;
export const signedAssertion = "AssertionError: signed URL request failed";

export const jsonUrlEncoders = [
  (url) => url.replaceAll("/", "\\/"),
  (url) => url.replaceAll("&", "\\u0026"),
  (url) => url.replaceAll("/", "\\/").replaceAll("&", "\\u0026"),
  (url) => url.replace(/[:/?=&#]/g, (character) =>
    `\\u${character.charCodeAt(0).toString(16).padStart(4, "0")}`),
];

export function signedUrlDetail(truncated, overlap, encode, url = signedUrl) {
  const suffix = encode
    ? ` {"url":"${encode(url)}"} ${signedAssertion}`
    : ` ${url} ${signedAssertion}`;
  if (!truncated) return suffix.trimStart();
  const rawPrefix = "https://cutoff.example.test/video?X-Amz-Signature=cutoff-private-value";
  const prefix = encode ? `{"url":"${encode(rawPrefix)}` : rawPrefix;
  const cutoff = prefix.indexOf("cutoff-private-value") + 7;
  const captureBytes = 16 * 1024 + overlap;
  const padding = captureBytes - (prefix.length - cutoff) - suffix.length - 1;
  assert.ok(padding > 0);
  const detail = `${prefix}${"x".repeat(padding)}${suffix}`;
  // Force the raw capture boundary into a signature absent from the environment.
  assert.equal(Buffer.byteLength(`${detail}\n`) - captureBytes, cutoff);
  return detail;
}

export function assertSignedUrlDiagnostics(result, truncated) {
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  const failure = JSON.parse(result.stderr);
  for (const diagnostic of [failure.diagnostics.stdout, failure.diagnostics.stderr]) {
    assert.equal(diagnostic.includes("https://storage.example.test/private/video.mp4?mode=debug&"), true);
    for (const name of parameters) {
      assert.equal(diagnostic.includes(`${name}=[REDACTED]`), true, `${name} must be redacted`);
    }
    assert.equal(diagnostic.includes("&expires=3600#sig=[REDACTED]&section=details"), true);
    assert.equal(diagnostic.endsWith(signedAssertion), true);
    assert.equal(diagnostic.startsWith("[earlier output truncated]"), truncated);
    assert.ok(Buffer.byteLength(diagnostic) < 17 * 1024);
  }
  for (const secret of [...secrets, "fragment-private-value", "cutoff-private-value", "private-value", "cutoff.example.test"]) {
    assert.equal(result.stderr.includes(secret), false, `${secret} must not appear in the JSON log`);
  }
  return failure;
}

const nestedSecret = "nested-private-signature/part=hidden";
const nestedUrl = `https://storage.example.test/private/video.mp4?mode=debug&X-Amz-Signature=${encodeURIComponent(nestedSecret)}&expires=3600#section=details`;
const sanitizedNestedUrl = nestedUrl.replace(encodeURIComponent(nestedSecret), "[REDACTED]");
const gateway = (value) => `https://gateway.example.test/error?view=summary&redirect=${value}&attempt=2`;
const relay = (value) => `https://relay.example.test/continue?mode=preview&url=${value}&page=3`;
const encodeTwice = (value) => encodeURIComponent(encodeURIComponent(value));

export const nestedUrlCases = [
  { url: gateway(encodeURIComponent(nestedUrl)), expected: gateway(encodeURIComponent(sanitizedNestedUrl)) },
  {
    url: gateway(encodeURIComponent(nestedUrl.replace("/private/", "/owner's/"))),
    expected: gateway(encodeURIComponent(sanitizedNestedUrl.replace("/private/", "/owner's/"))),
  },
  ...["'", '"', " ", "<", "\n"].map((character) => {
    const withPath = (url) => url.replace("/private/", `/owner${character}s/`);
    return {
      url: gateway(encodeURIComponent(withPath(nestedUrl)).replaceAll("'", "%27")),
      expected: gateway(encodeURIComponent(withPath(sanitizedNestedUrl))),
    };
  }),
  { url: gateway(encodeTwice(nestedUrl)), expected: gateway(encodeTwice(sanitizedNestedUrl)) },
  {
    url: gateway(encodeURIComponent(relay(encodeURIComponent(nestedUrl)))),
    expected: gateway(encodeURIComponent(relay(encodeURIComponent(sanitizedNestedUrl)))),
  },
  {
    url: gateway(`${encodeURIComponent(nestedUrl)}%ZZ`),
    expected: gateway("[REDACTED]"),
  },
  {
    url: gateway(Array.from({ length: 5 }).reduce(encodeURIComponent, nestedUrl)),
    expected: gateway("[REDACTED]"),
  },
  {
    url: Array.from({ length: 6 }).reduce((url) => gateway(encodeURIComponent(url)), nestedUrl),
    expected: null, // Nesting limit: the uninspected destination is removed.
  },
];

export function assertNestedUrlDiagnostics(result, truncated, expected) {
  assert.notEqual(result.status, 0);
  assert.equal(result.stdout, "");
  const failure = JSON.parse(result.stderr);
  for (const diagnostic of [failure.diagnostics.stdout, failure.diagnostics.stderr]) {
    assert.equal(diagnostic.includes("https://gateway.example.test/error?view=summary&redirect="), true);
    if (expected) assert.equal(diagnostic.includes(expected), true, "safe URL structure must be retained");
    assert.equal(diagnostic.includes("&attempt=2"), true);
    assert.equal(diagnostic.endsWith(signedAssertion), true);
    assert.equal(diagnostic.startsWith("[earlier output truncated]"), truncated);
    assert.ok(Buffer.byteLength(diagnostic) < 17 * 1024);
    // Check every encoding layer, not just the raw synthetic credential.
    let decoded = diagnostic;
    for (let layer = 0; layer < 12; layer += 1) {
      assert.equal(decoded.includes("nested-private-signature"), false);
      assert.equal(decoded.includes("cutoff-private-value"), false);
      decoded = decodeURIComponent(decoded);
    }
  }
  assert.equal(result.stderr.includes("cutoff.example.test"), false);
  return failure;
}
