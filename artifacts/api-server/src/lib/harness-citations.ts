type Pair = { id: string; page: number };

/** Only mapping metadata and excerpts actually included in this request count. */
export function schemeCitationPairs(context: string): Pair[] {
  const start = context.indexOf("DATA_SKEMA_TIDAK_TEPERCAYA=");
  const end = context.lastIndexOf("\nAKHIR_DATA_SKEMA");
  if (start < 0 || end < start) throw new Error("Missing scheme evidence packet");
  const packet = JSON.parse(context.slice(start + "DATA_SKEMA_TIDAK_TEPERCAYA=".length, end));
  const refs = new Map<string, Pair>();
  const add = (item: Record<string, unknown>) => {
    const id = item.id;
    if (typeof id === "string" && /^KB\d+$/.test(id) && Number.isInteger(item.page) && Number(item.page) > 0)
      refs.set(`${id}:${item.page}`, { id, page: Number(item.page) });
  };
  if (packet.mappingReference) add(packet.mappingReference);
  const walk = (value: unknown) => {
    if (!value || typeof value !== "object") return;
    const item = value as Record<string, unknown>;
    if ((typeof item.excerpt === "string" && item.excerpt.trim()) ||
        (typeof item.text === "string" && item.text.trim())) add(item);
    Object.values(item).forEach(walk);
  };
  // Section-start metadata can also contain id/page/text. A title is not
  // substantive evidence; only walk explicitly designated excerpt fields.
  walk([
    packet.subclassificationScope?.references,
    packet.kbli2025?.references,
    packet.additionalSchemeExcerpts,
  ]);
  if (!refs.size) throw new Error("No scheme evidence in context");
  return [...refs.values()];
}

/** Verifies identifiers/pages, not semantic support for every AI statement. */
export function checkCitationLinks(answer: string, allowed: Pair[]): number {
  const markers = answer.match(/\[KB\d+[^\]]*\]/gi) ?? [];
  for (const marker of markers) {
    const match = /^\[(KB\d+),\s*(?:halaman PDF|hlm\.)\s*(\d+)\]$/i.exec(marker);
    if (!match || !allowed.some(ref => ref.id === match[1]!.toUpperCase() && ref.page === Number(match[2])))
      throw new Error("Unlisted source/page");
  }
  return markers.length;
}
