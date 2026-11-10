import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getVaultWorkspace, getVaultWorkspaceSummary } from "@workspace/api-client-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const ROOT = "pub-workspace";
const SUMMARY_ROOT = "pub-workspace-summary";
export const pubWorkspaceKey = (userId?: string) => [ROOT, userId] as const;
export const pubWorkspaceSummaryKey = (userId?: string) => [SUMMARY_ROOT, userId] as const;

function useOwnerWorkspace<T>(root: string, load: (options: RequestInit) => Promise<T>) {
  const { user } = useAuth();
  const userId = user?.id;
  const qc = useQueryClient();
  useEffect(() => {
    void qc.cancelQueries({ queryKey: [root], predicate: q => q.queryKey[1] !== userId });
    qc.removeQueries({ queryKey: [root], predicate: q => q.queryKey[1] !== userId });
  }, [qc, userId, root]);
  const query = useQuery({
    queryKey: [root, userId], enabled: !!userId,
    queryFn: async ({ signal }) => {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error || !session || session.user.id !== userId) throw new Error("Sesi tidak valid. Silakan masuk kembali.");
      signal.throwIfAborted();
      return load({ headers: { Authorization: `Bearer ${session.access_token}` }, signal });
    },
    staleTime: 5_000, refetchInterval: 15_000, refetchOnWindowFocus: true, retry: false,
  });
  // A failed refresh must not present stale private data as an authorized current view.
  return { ...query, data: userId && !query.isError ? query.data : undefined, userId };
}

/** Full document list is needed only for Bedah Dokumen. */
export function usePubWorkspace() {
  return useOwnerWorkspace(ROOT, getVaultWorkspace);
}

/** Helpdesk/Klinik polling must never download private document contents. */
export function usePubWorkspaceSummary() {
  return useOwnerWorkspace(SUMMARY_ROOT, getVaultWorkspaceSummary);
}
