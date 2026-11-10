import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PubProgramParticipant {
  id: string;
  program_id: string;
  full_name: string;
  company: string;
  position: string;
  email: string;
  phone: string;
  attendance_status: string;
  notes: string;
  registered_at: string;
  attended_at: string | null;
  created_at: string;
}

export function useParticipants(programId?: string) {
  return useQuery({
    queryKey: ["pub-program-participants", programId],
    queryFn: async () => {
      let q = supabase
        .from("pub_program_participants")
        .select("*")
        .order("created_at", { ascending: false });
      if (programId) q = q.eq("program_id", programId);
      const { data, error } = await q;
      if (error) throw error;
      return data as PubProgramParticipant[];
    },
  });
}

export function useCreateParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: Omit<PubProgramParticipant, "id" | "created_at" | "registered_at" | "attended_at">) => {
      const { error } = await supabase
        .from("pub_program_participants")
        .insert(p);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pub-program-participants"] }),
  });
}

export function useUpdateParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PubProgramParticipant> & { id: string }) => {
      const { error } = await supabase
        .from("pub_program_participants")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pub-program-participants"] }),
  });
}

export function useDeleteParticipant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pub_program_participants")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pub-program-participants"] }),
  });
}
