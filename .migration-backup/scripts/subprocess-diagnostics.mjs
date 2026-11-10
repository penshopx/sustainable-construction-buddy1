const maxDiagnosticBytes = 16 * 1024;
// encodeURIComponent leaves apostrophes literal. Retain internal apostrophes
// followed by an encoded-value character, but not a closing log quote before
// whitespace, a comma, or another enclosing delimiter.
const diagnosticUrlPattern = /(?:https?|postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|rediss?|cockroachdb)(?::|\\u003a)(?:\/|\\\/|\\u002f){2}(?:[^\s"'<>]|'+(?=[a-z0-9%!*()._~-]))+/gi;
const nestedUrlStartPattern = /(?:https?|postgres(?:ql)?|mysql|mariadb|mongodb(?:\+srv)?|rediss?|cockroachdb):\/\//i;

function normalizeDiagnosticUrl(url) {
  // Decode URL delimiters only, not the surrounding JSON or arbitrary escapes.
  // This also exposes sensitive parameters following a JSON-escaped ampersand.
  return url.replace(/\\\//g, "/").replace(
    /\\u(002f|0026|003f|003d|0023|0040|003a)/gi,
    (_, code) => String.fromCharCode(parseInt(code, 16)),
  );
}
// Normalize parameter names only; leave the useful URL structure and values intact.
const sensitiveUrlParameters = new Set([
  "token", "accesstoken", "refreshtoken", "idtoken", "signedtoken", "jwt",
  "apikey", "password", "passwd", "secret", "clientsecret", "authorization",
  "authcode", "code", "signature", "sig",
  "xamzsignature", "xamzcredential", "xamzsecuritytoken",
  "xgoogsignature", "xgoogcredential", "googleaccessid", "awsaccesskeyid",
  "policy", "keypairid",
]);

const maxUrlNesting = 4;
const maxPercentDecodings = 4;

function redactNestedUrlValue(value, depth) {
  let decoded = value;
  for (let layers = 0; layers <= maxPercentDecodings; layers += 1) {
    const normalized = normalizeDiagnosticUrl(decoded);
    const urlStart = normalized.search(nestedUrlStartPattern);
    if (urlStart !== -1) {
      // A parameter is a complete value, not free-form log text. Quotes or
      // whitespace decoded within its path must not hide its later query.
      // Ambiguous text around a destination is not safe to inspect partially.
      if (urlStart !== 0) return "[REDACTED]";
      const sanitized = depth >= maxUrlNesting
        ? "[REDACTED]"
        : redactDiagnosticUrl(normalized, depth + 1, true);
      if (sanitized === decoded) return value;
      let encoded = sanitized;
      // Keep nested delimiters (and decoded quotes/controls) inside their value,
      // not in the enclosing URL or JSON message.
      for (let layer = 0; layer < layers; layer += 1) encoded = encodeURIComponent(encoded);
      return encoded;
    }
    if (!/%[0-9a-f]{2}/i.test(decoded)) return value;
    // Fail closed rather than emit an uninspected, deeply encoded destination.
    if (layers === maxPercentDecodings) return "[REDACTED]";
    try {
      decoded = decodeURIComponent(decoded);
    } catch {
      return "[REDACTED]";
    }
  }
}

function redactUrlParameter(match, prefix, name, value, depth) {
  let normalizedName;
  try {
    normalizedName = decodeURIComponent(name).replace(/[_-]/g, "").toLowerCase();
  } catch {
    // Malformed names cannot be classified safely.
    return `${prefix}${name}=[REDACTED]`;
  }
  return `${prefix}${name}=${sensitiveUrlParameters.has(normalizedName)
    ? "[REDACTED]"
    : redactNestedUrlValue(value, depth)}`;
}

function redactDiagnosticUrl(url, depth = 0, completeValue = false) {
  return normalizeDiagnosticUrl(url)
    .replace(
      completeValue
        ? /^([a-z][a-z0-9+.-]*:\/\/)[^/@]+:[^/@]+@/i
        : /^([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+:[^\s/@]+@/i,
      "$1[REDACTED]@",
    )
    .replace(
      completeValue
        ? /([?&#])([^=&#]+)=([^&#]*)/g
        : /([?&#])([^=&#\s"'<>]+)=((?:[^&#\s"'<>]|'+(?=[a-z0-9%!*()._~-]))*)/gi,
      (match, prefix, name, value) => redactUrlParameter(match, prefix, name, value, depth),
    );
}
const sensitiveValues = Object.entries(process.env)
  .filter(([name, value]) =>
    (/(?:SECRET|TOKEN|PASSWORD|PASSWD|KEY|CREDENTIAL|DATABASE_URL|AUTHORIZATION)/i.test(name) ||
      name === "SUPABASE_PROJECT_REF") &&
    value && value.length >= 4)
  .map(([, value]) => value)
  .sort((a, b) => b.length - a.length);
// Retain enough overlap to redact a value crossing the capture cutoff.
const maxSensitiveBytes = Math.max(0, ...sensitiveValues.map((value) => Buffer.byteLength(value)));
const maxCaptureBytes = maxDiagnosticBytes + maxSensitiveBytes;

export function captureOutput(stream) {
  const chunks = [];
  let size = 0;
  let truncated = false;

  stream.on("data", (chunk) => {
    chunks.push(chunk);
    size += chunk.length;
    while (size > maxCaptureBytes) {
      const excess = size - maxCaptureBytes;
      if (chunks[0].length <= excess) {
        size -= chunks.shift().length;
      } else {
        chunks[0] = chunks[0].subarray(excess);
        size -= excess;
      }
      truncated = true;
    }
  });

  return () => ({ text: Buffer.concat(chunks).toString("utf8"), truncated });
}

export function safeDiagnostic({ text, truncated }) {
  // Remove whole terminal control sequences, including OSC hyperlinks and titles.
  let output = text
    .replace(/\x1b\][\s\S]*?(?:\x07|\x1b\\|$)/g, "")
    .replace(/\x1b[P^_X][\s\S]*?(?:\x07|\x1b\\|$)/g, "")
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b[@-_]/g, "")
    .replace(/[\x00-\x08\x0b-\x1f\x7f-\x9f]/g, "");
  if (truncated) {
    // Drop the overlap on raw bytes, then the incomplete first token. This
    // protects unknown URL credentials too, without losing a later assertion
    // on the same line.
    output = Buffer.from(output).subarray(maxSensitiveBytes).toString("utf8");
    const nextBoundary = output.search(/\s/);
    output = nextBoundary === -1 ? "" : output.slice(nextBoundary + 1);
  }
  for (const value of sensitiveValues) {
    output = output.replaceAll(value, "[REDACTED]");
  }
  // A child process may print a URL with a credential not present in our environment.
  // Preserve the URL and harmless parameters so the failure remains actionable.
  output = output.replace(diagnosticUrlPattern, (url) => redactDiagnosticUrl(url));
  // Run generic redaction after URL normalization so an escaped separator cannot
  // make it consume harmless parameters or the rest of a JSON diagnostic.
  output = output
    .replace(/(Bearer\s+)[^\s"']+/gi, "$1[REDACTED]")
    .replace(/((?:password|token|secret|api[_-]?key|authorization)\s*[:=]\s*["']?)[^\s"',}&#]+/gi, "$1[REDACTED]");
  const bytes = Buffer.from(output);
  if (bytes.length > maxDiagnosticBytes) {
    output = bytes.subarray(-maxDiagnosticBytes).toString("utf8");
    truncated = true;
  }
  return `${truncated ? "[earlier output truncated]\n" : ""}${output.trim()}`;
}