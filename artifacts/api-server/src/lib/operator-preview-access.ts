import { ChatServiceError, createChatService } from "./chat-service";
import { pilotJson } from "./smap-pilot-data";

export class OperatorPreviewError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}
export const operatorUnavailable = () => new OperatorPreviewError(503, "operator_check_unavailable",
  "Pemeriksaan akses operator belum tersedia. Akses ditutup; silakan coba lagi nanti.");

/** Authoritative, fresh role check. Never trusts request roles, JWT metadata or UI state. */
export function createOperatorPreviewAccess(env: NodeJS.ProcessEnv, fetchImpl: typeof fetch = fetch) {
  const publicEnv = {
    SUPABASE_URL: env.SUPABASE_URL, VITE_SUPABASE_URL: env.VITE_SUPABASE_URL,
    SUPABASE_PUBLISHABLE_KEY: env.SUPABASE_PUBLISHABLE_KEY,
    VITE_SUPABASE_PUBLISHABLE_KEY: env.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
  const auth = createChatService({ env: publicEnv, fetchImpl });
  return async function requireOperator(authorization?: string, signal?: AbortSignal): Promise<string> {
    if (env.NODE_ENV !== "development") {
      throw new OperatorPreviewError(404, "operator_preview_disabled", "Pilot operator hanya tersedia di preview.");
    }
    try {
      const owner = await auth.requireMember(authorization);
      const url = new URL(publicEnv.SUPABASE_URL || publicEnv.VITE_SUPABASE_URL!);
      const key = publicEnv.SUPABASE_PUBLISHABLE_KEY || publicEnv.VITE_SUPABASE_PUBLISHABLE_KEY;
      url.pathname = "/rest/v1/rpc/current_user_is_super_admin";
      const response = await fetchImpl(url, {
        method: "POST", redirect: "error",
        headers: { apikey: key!, Authorization: authorization!, "Content-Type": "application/json" },
        body: "{}",
        signal: AbortSignal.any([AbortSignal.timeout(5000), ...(signal ? [signal] : [])]),
      });
      if (response.status === 401) throw new OperatorPreviewError(401, "login_required", "Sesi berakhir. Silakan login kembali.");
      if (!response.ok) throw operatorUnavailable();
      const allowed = await pilotJson(response, 64);
      if (allowed === false) throw new OperatorPreviewError(403, "operator_forbidden", "Pilot ini khusus Super Admin.");
      if (allowed !== true || signal?.aborted) throw operatorUnavailable();
      return owner;
    } catch (error) {
      if (error instanceof OperatorPreviewError) throw error;
      if (error instanceof ChatServiceError && error.status === 401) {
        throw new OperatorPreviewError(401, "login_required", "Silakan login kembali untuk mengakses pilot operator.");
      }
      throw operatorUnavailable();
    }
  };
}
