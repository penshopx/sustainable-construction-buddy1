type Document = { id: string; title: string; kind: string };
const normalize = (text: string) => text.normalize("NFKC").toLowerCase().replace(/\s+/g, " ");
export const expandKnowledgeTopic = (text: string) => text.replace(/\bpub\b/gi, "PUB pengembangan usaha berkelanjutan");

export function stripKnowledgeGreeting(query: string) {
  // Only remove a leading greeting, never greeting-like words inside a technical question.
  return query.slice(0, 8000).normalize("NFKC").trimStart().replace(
    /^(?:(?:halo|hallo|hai|hi|hello|selamat\s+(?:pagi|siang|sore|malam)|salam(?:\s+sejahtera)?|assalamu['’ ]?alaikum|terima\s+kasih|makasih|thanks)(?=$|[\s,.!?])[\s,.!?]*(?:(?:pak|bu|bapak|ibu|kak|admin|helpdesk)(?=$|[\s,.!?])[\s,.!?]*)?)+/iu,
    "",
  ).trim();
}

function legalReferences(text: string) {
  const pattern = /\b(perpres|peraturan\s+presiden|pp|peraturan\s+pemerintah|permendagri|permen(?:\s+pupr|\s+pu|\s+dalam\s+negeri)?|peraturan\s+menteri(?:\s+pekerjaan\s+umum(?:\s+dan\s+perumahan\s+rakyat)?|\s+dalam\s+negeri)?|peraturan\s+(?:lkpp|lembaga)(?:\s+lkpp)?)(?:\s+republik\s+indonesia)?\s*(?:nomor|no\.?)?\s*(\d{1,3})\s*(?:\/|\s+(?:tahun\s+)?)(20\d{2})\b/g;
  return [...normalize(text).matchAll(pattern)].map(match => {
    const prefix = match[1];
    const kind = /presiden|perpres/.test(prefix) ? "peraturan_presiden"
      : /menteri|permen/.test(prefix) ? "peraturan_menteri"
      : /lkpp|lembaga/.test(prefix) ? "peraturan_lembaga" : "peraturan_pemerintah";
    const issuer = /dagri|dalam\s+negeri/.test(prefix) ? "dagri"
      : /pupr|perumahan\s+rakyat/.test(prefix) ? "pupr"
      : /\bpu\b|pekerjaan\s+umum/.test(prefix) ? "pu" : "";
    return `${kind}:${Number(match[2])}:${match[3]}:${issuer}`;
  });
}

function matchesReference(references: string[], title: string) {
  const own = legalReferences(title)[0]?.split(":");
  return own && references.some(reference => {
    const requested = reference.split(":");
    return requested.slice(0, 3).every((part, i) => part === own[i]) &&
      (!requested[3] || requested[3] === own[3]);
  });
}

function sections(text: string) {
  const normalized = normalize(text);
  const result = new Set(normalized.match(/\b(?:iv|iii|ii|i)\.[a-z]\b/g) ?? []);
  for (const match of normalized.matchAll(/\bi\.([a-z])\s*[–-]\s*(?:i\.)?([a-z])\b/g)) {
    for (let code = match[1].charCodeAt(0); code <= match[2].charCodeAt(0) && code <= 122; code++) {
      result.add(`i.${String.fromCharCode(code)}`);
    }
  }
  return result;
}

export function printedPageReferences(text: string) {
  return [...normalize(text).matchAll(/\b((?:iv|iii|ii|i)\.[a-z])\s*\.\s*(\d{1,5})\b/g)]
    .map(match => `${match[1]}.${Number(match[2])}`);
}

export function printedPageLabels(text: string) {
  // A table may put its printed page label after its rows in extraction order.
  // Match standalone labels anywhere on the page, not cross-references in prose.
  return [...text.matchAll(/(?:^|\n)\s*((?:IV|III|II|I)\.[A-Z]\s*\.\s*\d{1,5})\s*(?=\n|$)/gi)]
    .flatMap(match => printedPageReferences(match[1]));
}

export function knowledgeSelectors(query: string, documents: Document[]) {
  const normalized = normalize(query.slice(0, 8000));
  const ids = [...normalized.matchAll(/\bkb\s*(\d{1,3})\b/g)].map(match => `KB${Number(match[1]).toString().padStart(2, "0")}`);
  const requestedSections = sections(normalized);
  const annexNumbers = [...normalized.matchAll(/\blampiran\s+(iv|iii|ii|i)\b/g)].map(match => match[1]);
  const references = legalReferences(normalized);
  let documentIds: Set<string> | null = null;
  if (ids.length) {
    documentIds = new Set(documents.filter(doc => ids.includes(doc.id)).map(doc => doc.id));
  } else if (requestedSections.size || annexNumbers.length) {
    documentIds = new Set(documents.filter(doc => {
      if (doc.kind !== "lampiran_peraturan") return false;
      const ownSections = sections(doc.title);
      if (requestedSections.size) return [...requestedSections].some(section => ownSections.has(section));
      const ownNumber = normalize(doc.title).match(/\blampiran\s+(iv|iii|ii|i)\b/)?.[1];
      return ownNumber && annexNumbers.includes(ownNumber);
    }).filter(doc => !references.length || matchesReference(references, doc.title)).map(doc => doc.id));
  } else if (references.length) {
    const wantsAnnex = /\blampiran\b/.test(normalized);
    const wantsDiscussion = /\b(?:materi\s+diskusi|paparan\s+implementasi|materi\s+implementasi)\b/.test(normalized);
    documentIds = new Set(documents.filter(doc => {
      if (wantsAnnex ? doc.kind !== "lampiran_peraturan"
        : wantsDiscussion ? doc.kind !== "paparan" : !doc.kind.startsWith("peraturan_")) return false;
      // An amendment mentioning an older regulation is not the older regulation's complete text.
      return matchesReference(references, doc.title);
    }).map(doc => doc.id));
  } else if (!/\b(?:bandingkan|perbedaan|dibandingkan)\b/.test(normalized)) {
    // An exact, multi-word regulation topic is stronger evidence than generic business terms.
    // This selects by the source's own title, not by a hard-coded source ID or a guessed version.
    const topicQuery = normalize(expandKnowledgeTopic(normalized));
    const matches = documents.filter(doc => {
      if (!doc.kind.startsWith("peraturan_")) return false;
      const topic = normalize(doc.title.split(/\s+[—–]\s+/)[1] ?? "");
      return topic.split(" ").length >= 3 && topicQuery.includes(topic);
    });
    if (matches.length) documentIds = new Set(matches.map(doc => doc.id));
  }
  const pdfPages = new Set([...normalized.matchAll(/\b(?:halaman\s+pdf|pdf\s+(?:halaman|hlm\.?))\s*(\d{1,5})\b/g)]
    .map(match => Number(match[1])));
  const textLineRanges = [...normalized.matchAll(/\bbaris\s+(\d{1,5})(?:\s*[-–]\s*(\d{1,5}))?\b/g)]
    .map(match => ({ start: Number(match[1]), end: Number(match[2] ?? match[1]) }));
  const wantsLastPage = /\b(?:halaman\s+(?:pdf\s+)?terakhir|batas\s+akhir|akhir\s+(?:file|berkas))\b/.test(normalized)
    && /\b(?:file|berkas|halaman)\b/.test(normalized);
  const wantsIdentity = /\b(?:judul|keberapa|naskah\s+konsolidasi|konsolidasi\s+lengkap|peraturan\s+apa|mengatur\s+apa|tentang\s+apa)\b/.test(normalized);
  return { documentIds, pdfPages, textLineRanges, printedPages: new Set(printedPageReferences(normalized)), wantsLastPage, wantsIdentity };
}
