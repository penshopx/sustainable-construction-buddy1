import type { VaultDocument } from "@workspace/api-zod";

// OCR windows never cross page boundaries; labels are derived from the saved
// page map, not from page numbers that happen to appear inside document text.
export function vaultSourceWindows(doc: VaultDocument) {
  const sections = doc.ocrPages?.length
    ? doc.ocrPages.map(p => ({ start: p.start, end: p.end, name: `${doc.name} — halaman ${p.page}` }))
    : [{ start: 0, end: doc.text.length, name: doc.name }];
  return sections.flatMap(section => {
    const result = [];
    for (let i = section.start; i < section.end; i += 1800) {
      result.push({ id: doc.id, name: section.name, quote: doc.text.slice(i, Math.min(i + 2200, section.end)) });
    }
    return result;
  });
}
