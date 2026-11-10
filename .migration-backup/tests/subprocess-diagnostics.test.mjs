import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { safeDiagnostic } from "../scripts/subprocess-diagnostics.mjs";

// The module snapshots sensitive environment values on import. A fresh process
// makes overlap sizes deterministic without inheriting real workspace secrets.
for (const credential of [
  "ENVHEAD-private-middle-ENVTAIL",
  `ENVHEAD-${"private-middle-".repeat(40)}ENVTAIL`,
  "ENVHEAD-rahasia-密碼-🔐-ENVTAIL",
]) {
  test(`Buffer chunk, UTF-8 and encoded destination boundary matrix with ${Buffer.byteLength(credential)} bytes of secret overlap`, () => {
    const result = spawnSync(process.execPath, [
      "--test",
      fileURLToPath(new URL("./fixtures/subprocess-diagnostics-stream.mjs", import.meta.url)),
    ], {
      env: { DIAGNOSTIC_TEST_API_KEY: credential },
      encoding: "utf8",
      timeout: 30_000,
      maxBuffer: 1024 * 1024,
    });
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  });
}

test("redacts URL credentials without hiding harmless query parameters", () => {
  const text = [
    "GET https://example.test/path?view=summary&access_token=unlisted-credential-1&apikey=unlisted-credential-2#code=unlisted-credential-3",
    "GET https://example.test/next?PASSWORD=unlisted-credential-4&refresh_token=unlisted-credential-5",
  ].join("\n");
  const result = safeDiagnostic({ text, truncated: false });

  for (const value of ["unlisted-credential-1", "unlisted-credential-2", "unlisted-credential-3", "unlisted-credential-4", "unlisted-credential-5"]) {
    assert.equal(result.includes(value), false);
  }
  assert.match(result, /path\?view=summary&access_token=\[REDACTED\]&apikey=\[REDACTED\]#code=\[REDACTED\]/);
  assert.match(result, /next\?PASSWORD=\[REDACTED\]&refresh_token=\[REDACTED\]/);
});

test("strips terminal hyperlink, title, and color controls", () => {
  const text = "\x1b]8;;https://example.test/?access_token=hidden-in-control\x07click\x1b]8;;\x07 " +
    "\x1b]0;secret-title\x1b\\\x1b[31mAssertionError: safe message\x1b[0m";
  const result = safeDiagnostic({ text, truncated: false });

  assert.equal(result, "click AssertionError: safe message");
  assert.equal(result.includes("\x1b"), false);
  assert.equal(result.includes("hidden-in-control"), false);
  assert.equal(result.includes("secret-title"), false);
});

test("bounded nested URL decoding preserves harmless values and encoding boundaries", () => {
  const inner = "https://inner.example.test/video?view=summary&X-Amz-Signature=unlisted-nested-value&label=caf%C3%A9";
  const sanitized = inner.replace("unlisted-nested-value", "[REDACTED]");
  const encode = (value, layers) => {
    for (let layer = 0; layer < layers; layer += 1) value = encodeURIComponent(value);
    return value;
  };
  for (const layers of [1, 2, 3, 4]) {
    const text = `https://outer.example.test/error?url=${encode(inner, layers)}&label=a%20b&next=${encodeURIComponent("https://safe.example.test/path?view=summary")}`;
    assert.equal(
      safeDiagnostic({ text, truncated: false }),
      text.replace(encode(inner, layers), encode(sanitized, layers)),
    );
  }
  const tooDeep = `https://outer.example.test/error?url=${encode(inner, 5)}&view=summary`;
  assert.equal(
    safeDiagnostic({ text: tooDeep, truncated: false }),
    "https://outer.example.test/error?url=[REDACTED]&view=summary",
  );
});

test("nested destinations cannot decode controls or quotes into the surrounding diagnostic", () => {
  const inner = "https://inner.example.test/video?sig=unlisted-nested-value&label=%22%0A%1B";
  const text = `{"url":"https://outer.example.test/?redirect=${encodeURIComponent(inner)}","message":"keep this error"}`;
  const result = safeDiagnostic({ text, truncated: false });
  const parsed = JSON.parse(result);
  assert.equal(parsed.message, "keep this error");
  assert.equal(parsed.url.includes(encodeURIComponent(inner.replace("unlisted-nested-value", "[REDACTED]"))), true);
  assert.equal(result.includes("unlisted-nested-value"), false);
  assert.doesNotMatch(result, /[\x00-\x1f]/);
});

test("inspects the complete decoded URL even with quotes or whitespace before the signature", () => {
  for (const path of ["owner's", 'owner"s', "owner s", "owner<s", "owner\ns"]) {
    const inner = `https://storage.example.test/${path}/video?X-Amz-Signature=private-value&mode=debug`;
    const text = `https://gateway.example.test/error?redirect=${encodeURIComponent(inner).replaceAll("'", "%27")}&view=summary`;
    const result = safeDiagnostic({ text, truncated: false });
    assert.equal(decodeURIComponent(result).includes("private-value"), false);
    assert.equal(result, `https://gateway.example.test/error?redirect=${encodeURIComponent(inner.replace("private-value", "[REDACTED]"))}&view=summary`);
  }
});

test("literal apostrophes from encodeURIComponent do not hide a nested signature or consume surrounding log text", () => {
  for (const path of ["owner's", "owner''s", "owner'", "'s"]) {
    const inner = `https://storage.example.test/${path}/video?X-Amz-Signature=private-value&mode=debug`;
    const url = `https://gateway.example.test/error?redirect=${encodeURIComponent(inner)}&view=summary`;
    const expected = url.replace(encodeURIComponent(inner), encodeURIComponent(inner.replace("private-value", "[REDACTED]")));
    for (const [prefix, suffix] of [
      ["", " AssertionError: keep this error"],
      ['{"url":"', '","message":"keep this error"}'],
      ["{'url':'", "','message':'keep this error'}"],
      ["request '", "' AssertionError: keep this error"],
    ]) {
      const result = safeDiagnostic({ text: `${prefix}${url}${suffix}`, truncated: false });
      assert.equal(decodeURIComponent(result).includes("private-value"), false);
      assert.equal(result, `${prefix}${expected}${suffix}`);
    }
  }
});

// Enumerate the boundary cross-product rather than sampling randomly. The case
// ID is sufficient to reproduce a failure; no environment value supplies data.
const generatedBoundaryValues = [3, 4, 5];
const generatedHexStyles = ["upper", "lower", "alternating"];
const generatedJsonDelimiters = [":", "/", "?", "=", "&", "#", "@"];

function generatedHexCase(value, style) {
  let index = 0;
  return value.replace(/%[0-9a-f]{2}/gi, (escape) => {
    const lower = style === "lower" || (style === "alternating" && index++ % 2 === 0);
    return lower ? escape.toLowerCase() : escape.toUpperCase();
  });
}

function generatedEncode(value, layers, style) {
  for (let layer = 0; layer < layers; layer += 1) value = encodeURIComponent(value);
  return generatedHexCase(value, style);
}

function generatedJsonUrl(url, mask, style) {
  return url.replace(/[:/?=&#@]/g, (character, offset) => {
    if (!(mask & (1 << generatedJsonDelimiters.indexOf(character)))) return character;
    // Include both JSON solidus forms in addition to every delimiter subset.
    if (character === "/" && offset % 2 === 0) return "\\/";
    const hex = character.charCodeAt(0).toString(16).padStart(4, "0");
    return `\\u${style === "lower" ? hex : hex.toUpperCase()}`;
  });
}

function generatedUrlCase(layers, nesting, style, mask) {
  const id = `percent=${layers},nesting=${nesting},hex=${style},json=${mask}`;
  const serial = `${layers}${nesting}${generatedHexStyles.indexOf(style)}${mask}`;
  const secrets = Array.from({ length: 3 }, (_, index) => `SYNTHETIC_PRIVATE_${serial}_${index}/part=value`);
  // Encode every byte, including normally literal letters, so a raw substring
  // assertion alone cannot detect a leak of these unknown URL credentials.
  const encodedSecrets = secrets.map((secret) => generatedHexCase(
    [...secret].map((character) => `%${character.charCodeAt(0).toString(16).padStart(2, "0")}`).join(""),
    style,
  ));
  const name = generatedHexCase("X%2dAmz%2dSignature", style);
  const leaf = (values) =>
    `https://storage.example.test/asset@${serial}?view=first&${name}=${values[0]}` +
    `&view=second&${name}=${values[1]}&label=caf%C3%A9#section=details&sig=${values[2]}&section=end`;
  const wrap = (value, level) =>
    `https://relay${level}.example.test/asset@${serial}?view=first&view=second` +
    // Alternate destinations between query and fragment positions.
    `${level % 2 === 0 ? "&redirect=" : "#redirect="}${value}&attempt=${level}`;

  let url = leaf(encodedSecrets);
  for (let level = nesting - 1; level >= 0; level -= 1) {
    url = wrap(generatedEncode(url, layers, style), level);
  }

  // Independent expected structure from the documented limits, not the
  // implementation's redaction or decoding helpers. Values beyond a percent
  // limit disappear at the first edge; a nesting limit removes only the fifth
  // destination, retaining the root and four inspected nested relay levels.
  let expected;
  if (layers > 4) {
    expected = wrap("[REDACTED]", 0);
  } else {
    expected = nesting > 4 ? "[REDACTED]" : leaf(secrets.map(() => "[REDACTED]"));
    for (let level = Math.min(nesting - 1, 4); level >= 0; level -= 1) {
      // Changed destinations are canonically re-encoded with uppercase hex.
      expected = wrap(generatedEncode(expected, layers, "upper"), level);
    }
  }
  return { id, url, expected, secrets };
}

function assertNoGeneratedSecrets(value, secrets, maxLayers, id) {
  let decoded = value;
  for (let layer = 0; layer <= maxLayers; layer += 1) {
    for (const secret of secrets) {
      assert.equal(decoded.includes(secret), false, `${id}: secret after decoding layer ${layer}`);
      assert.equal(
        decoded.includes(secret.split("/")[0]), false,
        `${id}: private marker after decoding layer ${layer}`,
      );
    }
    const next = decodeURIComponent(decoded);
    if (next === decoded) return;
    decoded = next;
  }
  assert.fail(`${id}: inspection did not reach a fully decoded value`);
}

for (const layers of generatedBoundaryValues) {
  for (const nesting of generatedBoundaryValues) {
    for (const style of generatedHexStyles) {
      test(`generated URL boundaries: ${layers} percent layers, ${nesting} nested URLs, ${style} hex`, () => {
        const seen = new Set();
        for (let mask = 0; mask < 2 ** generatedJsonDelimiters.length; mask += 1) {
          const { id, url, expected, secrets } = generatedUrlCase(layers, nesting, style, mask);
          seen.add(id);
          const message = `AssertionError: preserve detail ${mask}`;
          // Escape only the URL; non-URL JSON escape sequences must stay intact.
          const context = String.raw`literal \u0026 \/ ?=#@`;
          const text = `{"url":"${generatedJsonUrl(url, mask, style)}","message":${JSON.stringify(message)},"context":${JSON.stringify(context)}}`;
          assert.equal(JSON.parse(text).url, url, `${id}: valid input JSON`);
          const result = safeDiagnostic({ text, truncated: false });
          const parsed = JSON.parse(result);
          assert.equal(parsed.message, message, `${id}: error detail retained`);
          assert.equal(parsed.context, context, `${id}: non-URL context retained`);
          assert.equal(parsed.url, expected, `${id}: exact safe structure and fail-closed boundary`);
          assert.equal(result.includes("[earlier output truncated]"), false, `${id}: not a truncation test`);
          assert.ok(Buffer.byteLength(text) < 16 * 1024, `${id}: input fits diagnostic budget`);
          assert.ok(Buffer.byteLength(result) < 16 * 1024, `${id}: result fits diagnostic budget`);
          // Allow more than the generated total layers and require a fixed
          // point. Check both the raw JSON log and its parsed URL independently.
          const maxLayers = layers * nesting + 2;
          assertNoGeneratedSecrets(result, secrets, maxLayers, id);
          assertNoGeneratedSecrets(parsed.url, secrets, maxLayers, id);
          // A leaking fixture must actually expose each private marker after
          // decoding; this prevents an inert generator from giving false safety.
          let original = url;
          for (let layer = 0; layer < maxLayers; layer += 1) original = decodeURIComponent(original);
          for (const secret of secrets) assert.ok(original.includes(secret), `${id}: secret was embedded`);
        }
        assert.equal(seen.size, 128, "every JSON delimiter subset has a reproducible case");
      });
    }
  }
}

test("drops a partial URL at a truncated capture boundary but keeps the final error", () => {
  const result = safeDiagnostic({
    text: "partial-unknown-credential".repeat(1000) + "\nGET https://example.test/?access_token=another-unknown-credential\nAssertionError: final detail",
    truncated: true,
  });
  assert.match(result, /^\[earlier output truncated\]/);
  assert.match(result, /AssertionError: final detail$/);
  assert.equal(result.includes("partial-unknown-credential"), false);
  assert.equal(result.includes("another-unknown-credential"), false);
});