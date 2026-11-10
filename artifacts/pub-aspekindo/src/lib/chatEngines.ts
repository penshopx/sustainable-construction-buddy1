import type { ChatEngine, ChatMessage } from "@workspace/api-client-react";

export const CHAT_ENGINES: { id: ChatEngine; label: string }[] = [
  { id: "claude", label: "Claude Sonnet — analisis utama" },
  { id: "gpt", label: "GPT — chat harian" },
  { id: "deepseek", label: "DeepSeek — chat harian" },
  { id: "nvidia", label: "NVIDIA Nemotron — opsi gratis sesuai kuota" },
  { id: "gemini", label: "Gemini — chat harian" },
];

// Keep the most recent context within the server's message/count/size limits.
// Old answers can be longer than an input message; do not silently drop the
// newest question or send an unbounded conversation on long-lived threads.
export function helpdeskContext(messages: ChatMessage[]): ChatMessage[] {
  const context = messages.slice(-10).map(({ role, content }) => ({
    role, content: content.slice(0, 4000),
  }));
  while (context.length > 1 &&
    context.reduce((total, message) => total + message.content.length, 0) > 20_000) {
    context.shift();
  }
  return context;
}
