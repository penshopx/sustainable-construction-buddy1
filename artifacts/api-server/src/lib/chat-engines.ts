import type { ChatEngine } from "@workspace/api-zod";

// Only the server owns model IDs. Public callers cannot choose arbitrary models,
// endpoints, API keys, or upstream routing/fallback policies.
const ENGINES: Record<ChatEngine, { model: string; prefix: string; setting: string }> = {
  claude: { model: "anthropic/claude-sonnet-4.5", prefix: "anthropic/claude-", setting: "AI_CLAUDE_MODEL" },
  gpt: { model: "openai/gpt-4o-mini", prefix: "openai/gpt-", setting: "AI_GPT_MODEL" },
  deepseek: { model: "deepseek/deepseek-v4.1-flash", prefix: "deepseek/", setting: "AI_DEEPSEEK_MODEL" },
  nvidia: { model: "nvidia/nemotron-3.5-lightning:free", prefix: "nvidia/", setting: "AI_NVIDIA_MODEL" },
  gemini: { model: "google/gemini-3.5-flash-lite", prefix: "google/gemini-", setting: "AI_GEMINI_MODEL" },
};

export function chatModel(engine: ChatEngine, env: NodeJS.ProcessEnv): string {
  const config = ENGINES[engine];
  const model = env[config.setting] || config.model;
  if (!model.startsWith(config.prefix) || !/^[a-zA-Z0-9/_.:-]{1,120}$/.test(model)) {
    throw new Error("Invalid server model configuration");
  }
  return model;
}
