import type { AiReadiness } from "@workspace/api-zod";

type Snapshot = AiReadiness & { diagnostics: NonNullable<AiReadiness["diagnostics"]> };
type Options = { env?: NodeJS.ProcessEnv; fetchImpl?: typeof fetch; now?: () => number; timeoutMs?: number };
const TTL = 60_000;
const FAILURE_TTL = 30_000;
const messages: Record<AiReadiness["state"], string> = {
  configured: "Konfigurasi AI tersedia. Metadata berhasil diperiksa, tetapi tidak menjamin biaya semua prompt atau batas token tercukupi.",
  limit_indicated: "Batas penggunaan AI terindikasi. Pesan dapat gagal dijawab; coba lagi nanti atau hubungi admin. Model dan panjang jawaban tidak diubah otomatis.",
  unknown: "Status AI tidak dapat diperiksa saat ini. Pengiriman tetap dapat dicoba, tetapi jawaban belum terjamin.",
  not_configured: "Layanan AI belum dikonfigurasi. Hubungi admin sebelum mengirim pesan.",
};

// Official metadata-only API: https://openrouter.ai/docs/api/reference/limits
// limit_remaining concerns the key cap, NOT all account credit / in-flight costs.
// Never estimate prompt affordability, invoke inference, or retain raw metadata.
export function createAiReadiness(options: Options = {}) {
  const env = options.env ?? process.env;
  const now = options.now ?? Date.now;
  let cache: Snapshot | undefined;
  let cachedKey: string | undefined;
  let pending: Promise<Snapshot> | undefined;
  function snapshot(state: AiReadiness["state"], reason: string, providerStatus?: number): Snapshot {
    const time = now();
    return {
      state, message: messages[state], checkedAt: new Date(time),
      recheckAt: new Date(time + (state === "unknown" ? FAILURE_TTL : TTL)),
      diagnostics: { reason, ...(providerStatus === undefined ? {} : { providerStatus }) },
    };
  }
  async function inspect(key: string): Promise<Snapshot> {
    try {
      const response = await (options.fetchImpl ?? fetch)("https://openrouter.ai/api/v1/key", {
        method: "GET", redirect: "error",
        signal: AbortSignal.timeout(options.timeoutMs ?? 5000),
        headers: { Authorization: `Bearer ${key}` },
      });
      if (response.status === 402 || response.status === 429) {
        return snapshot("limit_indicated", response.status === 402 ? "provider_credit_limit" : "provider_rate_limit", response.status);
      }
      if (!response.ok) return snapshot("unknown", "metadata_rejected", response.status);
      const body: unknown = await response.json();
      const data = (body as { data?: Record<string, unknown> } | null)?.data;
      if (!data || typeof data !== "object" || Array.isArray(data) ||
          !(data.limit_remaining === null || (typeof data.limit_remaining === "number" && Number.isFinite(data.limit_remaining)))) {
        return snapshot("unknown", "metadata_invalid", response.status);
      }
      const exhausted = typeof data.limit_remaining === "number" && data.limit_remaining <= 0;
      const budgetExhausted = [data.effective_budget, ...(Array.isArray(data.budgets) ? data.budgets : [])]
        .some(b => b && typeof b === "object" && "remaining_usd" in b &&
          typeof b.remaining_usd === "number" && Number.isFinite(b.remaining_usd) && b.remaining_usd <= 0);
      return snapshot(exhausted || budgetExhausted ? "limit_indicated" : "configured",
        exhausted || budgetExhausted ? "key_budget_exhausted" : "metadata_available", response.status);
    } catch {
      // Cache failures too; never expose/log thrown errors or provider bodies.
      return snapshot("unknown", "metadata_unreachable");
    }
  }
  return {
    async get(diagnostics = false): Promise<AiReadiness> {
      const key = env.OPENROUTER_API_KEY;
      if (key !== cachedKey) { cachedKey = key; cache = undefined; pending = undefined; }
      let result: Snapshot;
      if (!key) result = snapshot("not_configured", "key_missing");
      else if (cache && now() < cache.recheckAt.getTime()) result = cache;
      else {
        const request = pending ??= inspect(key);
        result = await request;
        if (cachedKey === key) {
          cache = result;
          if (pending === request) pending = undefined;
        }
      }
      // Projection happens AFTER the shared cache, so admin data never leaks.
      const { diagnostics: details, ...safe } = result;
      return diagnostics ? { ...safe, diagnostics: { ...details } } : safe;
    },
  };
}

export const aiReadiness = createAiReadiness();
