import type { HermesSchemeLocalCheckResult } from "@workspace/api-zod";
import { getSchemeReferenceBank } from "./scheme-reference-bank";
import { schemeKnowledgeContext } from "./scheme-chat";
import { runHermesSchemeFixture } from "./smap-pilot-runtime";

export const bg001Question = "Menurut rujukan unggahan, BG001 dipetakan ke KBLI apa? Bedakan ruang lingkup subklasifikasi dan uraian KBLI BPS 2025, termasuk penyebutan pembongkaran. Cantumkan sumber dan halaman PDF; ini bukan konversi resmi atau keputusan sertifikasi.";

export function buildBg001Fixture() {
  const bank = getSchemeReferenceBank();
  const mapping = bank.cases.find(item => item.id === "BG001-mapping");
  const scope = bank.cases.find(item => item.id === "BG001-scope");
  const comparison = bank.cases.find(item => item.id === "boundary-scope-version");
  if (!mapping || !scope || !comparison) throw new Error("BG001 reference cases unavailable");
  const sources = [...new Set([...mapping.evidenceIds, ...scope.evidenceIds, ...comparison.evidenceIds])].map(key => {
    const item = bank.evidence[key];
    if (!item || item.kind !== "pdf" || !item.page) throw new Error("Invalid BG001 PDF evidence");
    return { id: item.id, title: item.title, page: item.page, quote: item.quote };
  });
  const expected = [{ id: "KB09", page: 21 }, { id: "KB19", page: 17 }, { id: "KB44", page: 573 }];
  if (sources.length !== 3 || expected.some(ref => !sources.some(item => item.id === ref.id && item.page === ref.page)))
    throw new Error("BG001 source drift requires review");
  const context = schemeKnowledgeContext({ scheme_code: "BG001", audience: "bujk", explanation_depth: "rinci" }, bg001Question);
  const packet = JSON.parse(context.split("DATA_SKEMA_TIDAK_TEPERCAYA=")[1].split("\nAKHIR_DATA_SKEMA")[0]);
  const pairs: { id: string; page: number }[] = [];
  function walk(value: unknown) {
    if (!value || typeof value !== "object") return;
    const item = value as { id?: unknown; page?: unknown };
    if (typeof item.id === "string" && typeof item.page === "number") pairs.push({ id: item.id, page: item.page });
    Object.values(value).forEach(walk);
  }
  walk(packet);
  const bps = sources.find(source => source.id === "KB44")!;
  const reply = `DRAF RESPONS TIRUAN LOKAL — bukan keluaran AI.\n\n${mapping.answer}\n\n${scope.answer}\n\nUraian KBLI 2025 (BPS), kutipan: “${bps.quote.trim()}” [KB44, halaman PDF 573]\n\nPerbandingan sumber: ${comparison.answer}\n\nIni bukan keputusan sertifikasi.`;
  const citations = [...reply.matchAll(/\[(KB\d{2}),\s*(?:hlm\.|halaman\s+PDF)\s*(\d+)\]/g)]
    .map(match => ({ id: match[1], page: Number(match[2]) }));
  if (expected.some(ref => !pairs.some(item => item.id === ref.id && item.page === ref.page) ||
      !citations.some(item => item.id === ref.id && item.page === ref.page)) ||
      citations.some(ref => !sources.some(item => item.id === ref.id && item.page === ref.page)))
    throw new Error("BG001 context or citation mismatch");
  return { context, reply, sources };
}

export async function runHermesBg001Check(signal: AbortSignal): Promise<HermesSchemeLocalCheckResult> {
  const start = Date.now(), fixture = buildBg001Fixture();
  const result = await runHermesSchemeFixture({ ...fixture, question: bg001Question }, signal);
  if (result.analysis !== fixture.reply || result.runtime !== "hermes")
    throw new Error("BG001 fixture did not complete");
  return { status: "completed", runtime: "hermes", provider: "local-mock", dataScope: "uploaded-reference-only",
    toolCount: 0, localProviderRequests: 1, externalModelRequests: 0, documentCount: 3,
    elapsedMs: Date.now() - start, fixtureReply: result.analysis, schemeCode: "BG001",
    contextVerified: true, citationsVerified: true, question: bg001Question, sources: fixture.sources };
}
