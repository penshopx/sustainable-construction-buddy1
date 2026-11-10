type Source = { name: string; quote: string };
const plain = (text: string) => text.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
const escape = (text: string) => text.replace(/[\\`*_[\]{}()<>#+.!|~:/-]/g, "\\$&");

export function vaultCitationText(sources: Source[]) {
  if (!sources.length) return "";
  return "\n\n**Sumber konteks Ruang Simpan:**\n" + sources.slice(0, 6).map((source, i) => {
    const name = escape(plain(source.name).slice(0, 240));
    const quote = plain(source.quote);
    const excerpt = escape(quote.slice(0, 450)) + (quote.length > 450 ? "…" : "");
    return `\n[RS${i + 1}] ${name}\n\n> ${excerpt}\n`;
  }).join("\n");
}
