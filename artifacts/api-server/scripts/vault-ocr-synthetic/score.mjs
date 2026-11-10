import reference from "./reference.json" with { type: "json" };

// Ignore casing, whitespace and table markup, but retain letters and all digits.
export const normalize = text => text.normalize("NFKC").toLocaleLowerCase("id")
  .replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
export function distance(a, b) {
  let row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 0; i < a.length; i++) {
    const next = [i + 1];
    for (let j = 0; j < b.length; j++) {
      next[j + 1] = Math.min(next[j] + 1, row[j + 1] + 1, row[j] + (a[i] === b[j] ? 0 : 1));
    }
    row = next;
  }
  return row[b.length];
}
export function evaluate(oracle, observed, sources, id) {
  const expected = oracle.pages.map(p => p.from ? { ...reference[p.from].pages[0], page: p.page } : p);
  const errors = [];
  const map = observed.pages;
  if (expected[0].page !== null) {
    if (!Array.isArray(map) || map.length !== expected.length
      || map.some((p, i) => p.page !== expected[i].page || !Number.isInteger(p.start) || !Number.isInteger(p.end)
        || p.start < 0 || p.end < p.start || p.end > observed.text.length
        || (i > 0 && p.start < map[i - 1].end))) errors.push("invalid-page-map");
  } else if (map?.length) errors.push("unexpected-page-map");
  const pages = expected.map((p, i) => {
    const actual = p.page === null ? observed.text : observed.text.slice(map?.[i]?.start ?? 0, map?.[i]?.end ?? 0);
    const a = normalize(p.text), b = normalize(actual);
    const cer = distance([...a], [...b]) / Math.max(1, [...a].length);
    const wer = distance(a.split(" "), b.split(" ")) / Math.max(1, a.split(" ").length);
    const missingEvidence = p.evidence.filter(e => !(` ${b} `).includes(` ${normalize(e)} `));
    const label = p.page === null ? id : `${id} — halaman ${p.page}`;
    const missingQuotes = p.evidence.filter(e => !sources.some(s =>
      s.id === id && s.name === label && actual.includes(s.quote)
      && (` ${normalize(s.quote)} `).includes(` ${normalize(e)} `)));
    return { page: p.page, cer, wer, missingEvidence, missingQuotes,
      pass: cer <= 0.05 && wer <= 0.10 && !missingEvidence.length && !missingQuotes.length };
  });
  return { pass: !errors.length && pages.every(p => p.pass), errors, pages };
}
