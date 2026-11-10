import assert from "node:assert/strict";
import { PassThrough } from "node:stream";
import test from "node:test";
import { captureOutput, safeDiagnostic } from "../../scripts/subprocess-diagnostics.mjs";

const credential = process.env.DIAGNOSTIC_TEST_API_KEY;
assert.ok(credential, "run through subprocess-diagnostics.test.mjs with a synthetic environment");
const diagnosticBytes = 16 * 1024;
const captureBytes = diagnosticBytes + Buffer.byteLength(credential);
const marker = "[earlier output truncated]\n";
const finalMessage = "AssertionError: pesan akhir café 中文 🔐 tetap terbaca";
const fragments = ["ENVHEAD", "private-middle", "ENVTAIL", "rahasia", "密碼",
  "USERHEAD", "USERTAIL", "PASSHEAD", "PASSTAIL", "TOKENHEAD", "TOKENTAIL"];
const url = "https://USERHEAD-user-USERTAIL:PASSHEAD-pass-PASSTAIL@example.test/check?access_token=TOKENHEAD-token-TOKENTAIL&view=summary";
const escapedUrl = url.replaceAll(":", "\\u003a").replaceAll("/", "\\/")
  .replaceAll("?", "\\u003f").replaceAll("=", "\\u003d").replaceAll("&", "\\u0026");
const percentUrl = `https://gateway.example.test/?redirect=${encodeURIComponent(url)}&mode=debug`;

function capture(bytes, cuts) {
  const stream = new PassThrough();
  const snapshot = captureOutput(stream);
  const lengths = [];
  stream.on("data", (chunk) => lengths.push(chunk.length));
  let offset = 0;
  for (const end of [...cuts, bytes.length]) {
    assert.ok(end >= offset && end <= bytes.length);
    if (end > offset) stream.write(bytes.subarray(offset, end));
    offset = end;
  }
  stream.end();
  // Prove the stream actually delivered the boundaries requested by the test.
  assert.deepEqual(lengths, [...cuts, bytes.length]
    .map((end, index, ends) => end - (ends[index - 1] ?? 0)).filter(Boolean));
  return snapshot();
}

function fixedCuts(length, chunkBytes) {
  const cuts = [];
  for (let end = chunkBytes; end < length; end += chunkBytes) cuts.push(end);
  return cuts;
}

function variedCuts(length) {
  const sizes = [1, 2, 3, 5, 8, 13, 64, 257];
  const cuts = [];
  for (let end = 0, index = 0; ; index += 1) {
    end += sizes[index % sizes.length];
    if (end >= length) return cuts;
    cuts.push(end);
  }
}

function assertSafe(result, truncated) {
  for (const fragment of fragments) {
    assert.equal(result.includes(fragment), false, `leaked credential fragment: ${fragment}`);
  }
  assert.ok(result.endsWith(finalMessage), "the final multilingual assertion must remain readable");
  assert.equal(result.includes("\uFFFD"), false, "chunk boundaries must not corrupt UTF-8");
  assert.equal(result.startsWith(marker), truncated);
  assert.ok(Buffer.byteLength(result) <= diagnosticBytes + (truncated ? Buffer.byteLength(marker) : 0));
}

// These values are deliberately absent from the synthetic child environment.
// Exact expected output catches percent-encoded fragments as well as plaintext.
const multilingualUrl = "https://USERHEAD-é密🔐-USERTAIL:PASSHEAD-ö碼🔑-PASSTAIL@example.test/資料" +
  "?access_token=TOKENHEAD-é密🔒-TOKENTAIL&view=summary";
const safeMultilingualUrl = "https://[REDACTED]@example.test/資料?access_token=[REDACTED]&view=summary";
const nestedCases = [1, 2, 3, 4].map((layers) => {
  let destination = multilingualUrl;
  let safeDestination = safeMultilingualUrl;
  for (let layer = 0; layer < layers; layer += 1) {
    destination = encodeURIComponent(destination);
    safeDestination = encodeURIComponent(safeDestination);
  }
  return {
    name: `destination encoded ${layers} times`,
    token: `https://gateway.example.test/?redirect=${destination}&mode=debug`,
    safe: `https://gateway.example.test/?redirect=${safeDestination}&mode=debug`,
  };
});
const multilingualCases = [
  { name: "environment credential", token: credential, safe: "[REDACTED]" },
  { name: "unknown multilingual URL credentials", token: multilingualUrl, safe: safeMultilingualUrl },
  ...nestedCases,
];

test("many Buffer chunks preserve multilingual destinations at every supported encoding depth", () => {
  for (const { name, token, safe } of multilingualCases) {
    const text = `café 中文 🔐 ${token} ${finalMessage}`;
    const bytes = Buffer.from(text);
    const expected = `café 中文 🔐 ${safe} ${finalMessage}`;
    for (const cuts of [fixedCuts(bytes.length, 1), fixedCuts(bytes.length, 7), variedCuts(bytes.length)]) {
      const captured = capture(bytes, cuts);
      assert.deepEqual(captured, { text, truncated: false }, name);
      const result = safeDiagnostic(captured);
      assertSafe(result, false);
      assert.equal(result, expected, name);
    }
  }
});

test("raw and diagnostic cutoffs before, inside and after multilingual encoded credentials fail closed", () => {
  for (const { name, token } of multilingualCases) {
    const tokenBytes = Buffer.from(token);
    // Every byte includes the middle of multibyte characters and percent
    // escapes, plus both endpoints and one byte on either side of the token.
    for (let cutoff = -1; cutoff <= tokenBytes.length + 1; cutoff += 1) {
      for (const budget of [captureBytes, diagnosticBytes]) {
        const id = `${name}, cutoff=${cutoff}, budget=${budget}`;
        const prefix = Buffer.from("p".repeat(captureBytes - budget + 17));
        const padding = budget - (tokenBytes.length - cutoff) - Buffer.byteLength(` ${finalMessage}`);
        const bytes = Buffer.concat([prefix, tokenBytes, Buffer.from(`${"x".repeat(padding)} ${finalMessage}`)]);
        const boundary = prefix.length + cutoff;
        assert.equal(bytes.length - budget, boundary, `${id}: intended byte boundary`);
        for (const cuts of [[boundary], variedCuts(bytes.length)]) {
          const captured = capture(bytes, cuts);
          const rawStart = bytes.length - captureBytes;
          assert.ok(rawStart > 0, `${id}: capture actually truncated`);
          const retained = bytes.subarray(rawStart);
          assert.equal(retained.length, captureBytes, `${id}: bounded retained bytes`);
          assert.deepEqual(captured, { text: retained.toString("utf8"), truncated: true }, id);
          const result = safeDiagnostic(captured);
          assertSafe(result, true);
          // No raw OR encoded part of the incomplete token may survive, but
          // preserve the assertion following it on the very same log line.
          assert.equal(result, `${marker}${finalMessage}`, id);
        }
      }
    }
  }
});

test("every byte split in URL escapes, credentials and multibyte text is equivalent to one chunk", () => {
  const text = `${credential}\n${url}\n${escapedUrl}\n${percentUrl}\n${finalMessage}`;
  const bytes = Buffer.from(text);
  const expected = safeDiagnostic({ text, truncated: false });
  assertSafe(expected, false);
  assert.match(expected, /https:\/\/\[REDACTED\]@example\.test/);
  assert.match(expected, /access_token=\[REDACTED\]&view=summary/);
  assert.match(expected, /mode=debug/);
  for (let cut = 1; cut < bytes.length; cut += 1) {
    const captured = capture(bytes, [cut]);
    assert.deepEqual(captured, { text, truncated: false }, `raw byte split ${cut}`);
    assert.equal(safeDiagnostic(captured), expected, `sanitized byte split ${cut}`);
  }
  const captured = capture(bytes, fixedCuts(bytes.length, 1));
  assert.equal(safeDiagnostic(captured), expected, "one-byte chunks must also preserve all escapes");
});

test("capture stays bounded just below, at and above its byte limit", () => {
  const tail = `\n${credential}\n${escapedUrl}\n${finalMessage}`;
  for (const delta of [-1, 0, 1, 2, 19]) {
    const bytes = Buffer.from("x".repeat(captureBytes + delta - Buffer.byteLength(tail)) + tail);
    for (const chunkBytes of [1, 7, 127, captureBytes - 1, captureBytes, captureBytes + 1]) {
      const captured = capture(bytes, fixedCuts(bytes.length, chunkBytes));
      assert.equal(captured.truncated, delta > 0);
      assert.equal(Buffer.byteLength(captured.text), Math.min(bytes.length, captureBytes));
      assert.equal(captured.text, bytes.subarray(-captureBytes).toString("utf8"));
      const result = safeDiagnostic(captured);
      assertSafe(result, delta > 0);
      assert.match(result, /view=summary/);
    }
  }
});

test("every capture cutoff inside a credential or escaped URL drops all partial fragments", () => {
  for (const token of [credential, url, escapedUrl, percentUrl]) {
    const tokenBytes = Buffer.from(token);
    for (let cutoff = 1; cutoff < tokenBytes.length; cutoff += 1) {
      // Place the retained raw tail exactly at each byte of the sensitive token,
      // including within a JSON escape, percent escape or UTF-8 character.
      const padding = captureBytes - (tokenBytes.length - cutoff) - Buffer.byteLength(` ${finalMessage}`);
      const bytes = Buffer.concat([tokenBytes, Buffer.from(`${"x".repeat(padding)} ${finalMessage}`)]);
      assert.equal(bytes.length - captureBytes, cutoff);
      for (const cuts of [
        [cutoff],
        [Math.min(cutoff + 1, bytes.length)],
        fixedCuts(bytes.length, 251),
      ]) {
        const captured = capture(bytes, cuts);
        assert.equal(captured.truncated, true);
        assert.equal(captured.text, bytes.subarray(cutoff).toString("utf8"));
        const result = safeDiagnostic(captured);
        assertSafe(result, true);
        assert.equal(result, `${marker}${finalMessage}`);
      }
    }
  }
});

test("the overlap protects credentials crossing the final diagnostic cutoff", () => {
  const overlapBytes = Buffer.byteLength(credential);
  for (const token of [credential, url, escapedUrl, percentUrl]) {
    const tokenBytes = Buffer.from(token);
    for (let cutoff = 1; cutoff < tokenBytes.length; cutoff += 1) {
      const prefix = Buffer.from("p".repeat(overlapBytes + 17));
      const padding = diagnosticBytes - (tokenBytes.length - cutoff) - Buffer.byteLength(` ${finalMessage}`);
      const bytes = Buffer.concat([prefix, tokenBytes, Buffer.from(`${"x".repeat(padding)} ${finalMessage}`)]);
      assert.equal(bytes.length - diagnosticBytes, prefix.length + cutoff);
      const captured = capture(bytes, fixedCuts(bytes.length, 113));
      assert.equal(captured.truncated, true);
      const result = safeDiagnostic(captured);
      assertSafe(result, true);
      assert.equal(result, `${marker}${finalMessage}`);
    }
  }
});

test("independent captures do not share chunks, snapshots or truncation state", () => {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const out = captureOutput(stdout);
  const err = captureOutput(stderr);
  assert.deepEqual(out(), { text: "", truncated: false });
  stdout.write(Buffer.from("x".repeat(captureBytes + 1)));
  const earlier = out();
  stderr.write(Buffer.from(`${credential} ${finalMessage}`));
  stdout.end(Buffer.from(` ${finalMessage}`));
  stderr.end();
  assert.equal(earlier.text, "x".repeat(captureBytes));
  assert.equal(earlier.truncated, true);
  assertSafe(safeDiagnostic(out()), true);
  assertSafe(safeDiagnostic(err()), false);
  assert.equal(err().truncated, false);
});
