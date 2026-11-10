import corpus from "../data/lpjk-knowledge.json";

type Reference = { clause: string; page: number };
const documents = new Map<string, { pages: readonly { page: number; text: string }[] }>(
  corpus.documents.map(doc => [doc.id, doc]),
);
const TOPICS = [
  { pattern: /keuangan|modal|ekuitas|neraca|aset/iu, clauses: ["3.2", "5.1.3"] },
  { pattern: /penjualan|omzet|omset|pendapatan/iu, clauses: ["3.1", "5.1.2"] },
  { pattern: /tenaga|pjtbu|pjkbu|pjbu|\bskk\b|jenjang/iu, clauses: ["3.3", "5.1.4"] },
  { pattern: /peralatan|\balat\b|mesin/iu, clauses: ["3.4", "5.1.5"] },
  { pattern: /administrasi|akta|npwp|\bnib\b|dokumen\s+(?:legal|pendirian)/iu, clauses: ["5.1.1"] },
  { pattern: /anti\s*penyuapan|anti\s*suap|\bsmap\b/iu, clauses: ["3.5"] },
];
const PRIMARY = ["3.1", "3.2", "3.3", "3.4", "3.5", "5.1.1"];
const outline = () => /(?:^|\n)[ \t]*(\d{1,2}(?:\.\d{1,2}){0,3})\.[ \t]*(?:\r?\n[ \t]*)?[\p{Lu}]/gu;
const afterSection = (candidate: string, section: string) => {
  const a = candidate.split(".").map(Number), b = section.split(".").map(Number);
  if (a.length > b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] > b[i];
  }
  return false;
};

export function readSchemeRequirementSection(id: string, refs: Reference[], clause: string) {
  const doc = documents.get(id);
  if (!doc) throw new Error("Scheme source not found");
  const ref = refs.find(item => item.clause === clause);
  const pieces: { page: number; text: string; start: number }[] = [];
  if (!ref) return { pieces, ended: false };
  const next = refs.find(item => afterSection(item.clause, clause));
  let ended = false;
  // Scan to the next known anchor; for the last tracked section, find its actual
  // boundary rather than assuming that four pages contain the whole section.
  for (const page of doc.pages.filter(item => item.page >= ref.page && item.page <= (next?.page ?? Infinity))) {
    let start = 0;
    if (page.page === ref.page) {
      const heading = [...page.text.matchAll(outline())].find(match => match[1] === clause);
      if (!heading) break;
      start = heading.index!;
    }
    const boundary = [...page.text.slice(start).matchAll(outline())].find(match => afterSection(match[1], clause));
    const end = boundary ? start + boundary.index! : page.text.length;
    if (end > start) pieces.push({ page: page.page, text: page.text.slice(start, end), start });
    if (boundary) { ended = true; break; }
  }
  return { pieces, ended };
}

export function schemeRequirementEvidence(id: string, code: string, refs: Reference[], question: string,
  options: { maxChars?: number } = {}) {
  const matched = TOPICS.filter(topic => topic.pattern.test(question));
  const clauses = [...new Set(matched.flatMap(topic => topic.clauses))];
  if (!clauses.length && /persyaratan|kriteria|kelengkapan|daftar\s*periksa/iu.test(question)) clauses.push(...PRIMARY);
  if (!clauses.length) return undefined;
  const result: { id: string; page: number; section: string; text: string; truncated: boolean;
    startOffset: number; endOffset: number }[] = [];
  const missing: string[] = [], partial = new Set<string>();
  // Budget serialized JSON, not only plain text: escaped PDF line breaks also consume context.
  const budget = Number.isFinite(options.maxChars) ? Math.max(0, Math.min(12000, Math.floor(options.maxChars!))) : 6200;
  const sections = clauses.map(clause => {
    const source = readSchemeRequirementSection(id, refs, clause);
    const full = source.pieces.map(piece => ({ id, page: piece.page, section: clause, text: piece.text,
      truncated: !source.ended, startOffset: piece.start, endOffset: piece.start + piece.text.length }));
    return { clause, ...source, full, cost: JSON.stringify(full).length - 2 };
  }).sort((a, b) => a.cost - b.cost || clauses.indexOf(a.clause) - clauses.indexOf(b.clause));
  let available = Math.max(0, budget - 2);
  for (let index = 0; index < sections.length; index++) {
    const { clause, pieces, ended, full, cost } = sections[index];
    if (!pieces.length) { missing.push(clause); continue; }
    const share = Math.floor(available / (sections.length - index));
    // Complete short sections first; redistribute unused space to longer ones.
    // Never truncate a page simply because its neighbour received a fixed half.
    if (cost + 1 <= share) {
      result.push(...full);
      available -= cost + 1;
      if (!ended) partial.add(clause);
      continue;
    }
    const perSection = Math.max(0, share - pieces.length * 180);
    // Keep the actual section start, then prioritise a selected-code row if the table spans pages.
    const ordered = [...pieces].sort((a, b) => {
      if (a === b) return 0;
      if (a === pieces[0]) return -1;
      if (b === pieces[0]) return 1;
      return Number(b.text.includes(code)) - Number(a.text.includes(code)) || a.page - b.page;
    });
    let used = 0;
    const kept = [];
    for (const piece of ordered) {
      const remaining = perSection - used;
      if (remaining < 120) break;
      const allowance = Math.floor(remaining / (kept.length === 0 && ordered.length > 1 ? 2 : 1));
      const at = piece.text.indexOf(code);
      const start = piece !== pieces[0] && at > allowance ? Math.max(0, at - 100) : 0;
      let text = piece.text.slice(start, start + allowance);
      while (JSON.stringify(text).length > allowance) text = text.slice(0, -20);
      const item = { id, page: piece.page, section: clause, text, truncated: start > 0 || text.length < piece.text.length,
        startOffset: piece.start + start, endOffset: piece.start + start + text.length };
      kept.push(item);
      used += JSON.stringify(text).length;
    }
    const isPartial = !ended || kept.length < pieces.length || kept.some(item => item.truncated);
    if (isPartial) partial.add(clause);
    if (!kept.length) missing.push(clause);
    result.push(...kept.map(item => ({ ...item, truncated: isPartial })));
    available = Math.max(0, budget - JSON.stringify(result).length);
  }
  // Metadata overhead is included in the hard cap. Mark every removed section as incomplete.
  while (result.length && JSON.stringify(result).length > budget) {
    const removed = result.pop()!;
    partial.add(removed.section);
    if (!result.some(item => item.section === removed.section) && !missing.includes(removed.section)) missing.push(removed.section);
  }
  result.sort((a, b) => clauses.indexOf(a.section) - clauses.indexOf(b.section) || a.page - b.page || a.startOffset - b.startOffset);
  return { excerpts: result.map(item => ({ ...item, truncated: partial.has(item.section) })),
    requestedSections: clauses, missingSections: missing, partialSections: [...partial] };
}
