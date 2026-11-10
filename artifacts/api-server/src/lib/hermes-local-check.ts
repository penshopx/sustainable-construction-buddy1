import type { HermesLocalCheckResult, SmapPilotDocument } from "@workspace/api-zod";
import { runSmapPilot } from "./smap-pilot-runtime";

const reply = "Uji sintetis: indikator nomor dokumen belum terisi. Ini bukan penilaian dokumen.";
export async function runHermesLocalCheck(signal: AbortSignal): Promise<HermesLocalCheckResult> {
  const start = Date.now();
  // Construct the fixture here; callers cannot submit member documents or model settings.
  const documents: SmapPilotDocument[] = [{
    id: "11111111-1111-4111-8111-111111111111", type: "surat_pernyataan",
    checks: [{ name: "Nomor dokumen", complete: false }],
  }];
  let calls = 0;
  const result = await runSmapPilot(documents, {
    NODE_ENV: "development", OPENROUTER_API_KEY: "local-fixture-not-a-provider-key",
    AI_CLAUDE_MODEL: "anthropic/claude-local-fixture",
  }, signal, async (url, init) => {
    // This replaces fetch completely. Never delegates to a network/model client.
    calls++;
    const body = JSON.parse(String(init?.body));
    if (calls !== 1 || String(url) !== "https://openrouter.ai/api/v1/chat/completions" ||
        body.model !== "anthropic/claude-local-fixture" || body.messages.length !== 2 ||
        body.messages[1].content !== JSON.stringify([{ document: 1, type: documents[0]!.type, checks: documents[0]!.checks }])) {
      throw new Error("Local fixture request mismatch");
    }
    return Response.json({
      model: "anthropic/claude-local-fixture",
      choices: [{ finish_reason: "stop", message: { content: reply } }],
    });
  });
  if (calls !== 1 || result.runtime !== "hermes" || result.analysis !== reply)
    throw new Error("Real Hermes did not complete the expected local fixture");
  return { status: "completed", runtime: "hermes", provider: "local-mock",
    dataScope: "synthetic-only", toolCount: 0, localProviderRequests: 1,
    externalModelRequests: 0, documentCount: 1, elapsedMs: Date.now() - start, fixtureReply: reply };
}
