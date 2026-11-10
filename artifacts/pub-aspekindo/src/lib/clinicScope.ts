export function clinicPrefix(topic?: string): string {
  if (!topic) return "";
  if (!/^[a-z0-9-]{2,60}$/.test(topic)) throw new Error("Loket tidak valid");
  return `[Klinik/${topic}] `;
}
export function clinicConversationTitle(title: string): string {
  return title.replace(/^\[Klinik\/[a-z0-9-]+\] /, "").replace(/^\[claude\] /, "");
}
