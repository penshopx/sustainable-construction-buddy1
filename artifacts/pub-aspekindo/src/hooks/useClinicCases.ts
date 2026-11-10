import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listClinicCases, createClinicCase, listClinicOperatorCases, updateClinicCase, listClinicCaseHistory,
  type ClinicCase, type ClinicCaseInput, type ClinicCaseUpdate,
} from "@workspace/api-client-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type { ClinicCase, ClinicCaseInput, ClinicCaseUpdate };

const ROOT = "clinic-cases";

export function clinicErrorStatus(error: unknown): number | undefined {
  return error && typeof error === "object" && "status" in error ? Number(error.status) : undefined;
}

async function authOptions(expectedUserId: string, signal?: AbortSignal): Promise<RequestInit> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token || session.user.id !== expectedUserId) {
    throw new Error("Sesi tidak valid. Silakan login kembali.");
  }
  return { headers: { Authorization: `Bearer ${session.access_token}` }, signal };
}

/** Sanitized message from the server, or a neutral fallback. */
export function clinicErrorMessage(error: unknown, fallback = "Permintaan belum berhasil. Silakan coba lagi."): string {
  if (error && typeof error === "object" && "data" in error) {
    const data = (error as { data: unknown }).data;
    if (data && typeof data === "object" && "error" in data && typeof (data as { error: unknown }).error === "string") {
      return (data as { error: string }).error;
    }
  }
  if (error instanceof Error && error.message.startsWith("Sesi")) return error.message;
  return fallback;
}

function useAccountCleanup(userId: string | undefined) {
  const qc = useQueryClient();
  useEffect(() => {
    qc.removeQueries({ queryKey: [ROOT], predicate: q => q.queryKey[2] !== userId });
  }, [qc, userId]);
}

export function useMyClinicCases() {
  const { user } = useAuth();
  const userId = user?.id;
  useAccountCleanup(userId);
  return useQuery({
    queryKey: [ROOT, "mine", userId],
    enabled: !!userId,
    queryFn: async ({ signal }) => listClinicCases(await authOptions(userId!, signal)),
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
  });
}

export function useCreateClinicCase() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: ClinicCaseInput) => {
      if (!user) throw new Error("Sesi tidak valid. Silakan login kembali.");
      return createClinicCase(data, await authOptions(user.id));
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: [ROOT, "mine", user?.id] }),
  });
}

export function useOperatorClinicCases() {
  const { user } = useAuth();
  const userId = user?.id;
  useAccountCleanup(userId);
  const query = useQuery({
    queryKey: [ROOT, "operator", userId],
    enabled: !!userId,
    queryFn: async ({ signal }) => listClinicOperatorCases(await authOptions(userId!, signal)),
    refetchOnWindowFocus: true,
    refetchInterval: 30_000,
    retry: false,
  });
  // Never show previously fetched privileged data once the server refuses.
  return { ...query, data: [401, 403].includes(clinicErrorStatus(query.error) ?? 0) ? undefined : query.data };
}

export function useClinicCaseHistory(id: string, enabled = true) {
  const { user } = useAuth();
  const userId = user?.id;
  useAccountCleanup(userId);
  const query = useQuery({
    queryKey: [ROOT, "history", userId, id],
    enabled: !!userId && enabled,
    queryFn: async ({ signal }) => listClinicCaseHistory(id, await authOptions(userId!, signal)),
    refetchOnWindowFocus: true,
    refetchInterval: enabled ? 30_000 : false,
    retry: false,
  });
  return { ...query, data: query.isError ? undefined : query.data };
}

export function useUpdateClinicCase() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: ClinicCase["id"]; data: ClinicCaseUpdate }) => {
      if (!user) throw new Error("Sesi tidak valid. Silakan login kembali.");
      return updateClinicCase(id, data, await authOptions(user.id));
    },
    onSuccess: (_saved, { id }) => {
      void qc.invalidateQueries({ queryKey: [ROOT, "history", user?.id, id] });
      void qc.invalidateQueries({ queryKey: [ROOT, "operator", user?.id] });
      void qc.invalidateQueries({ queryKey: [ROOT, "mine", user?.id] });
    },
    onError: error => {
      if ([401, 403].includes(clinicErrorStatus(error) ?? 0)) {
        qc.removeQueries({ queryKey: [ROOT, "history", user?.id] });
        void qc.invalidateQueries({ queryKey: [ROOT, "operator", user?.id] });
      }
    },
  });
}
