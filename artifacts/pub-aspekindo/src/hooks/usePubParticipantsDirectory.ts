import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

export interface PubParticipantEntry {
  id: string;
  full_name: string;
  company: string;
  position: string;
  email: string;
  phone: string;
  kta_number: string;
  attendance_status: string;
  registered_at: string;
  checked_in_at: string | null;
  checked_out_at: string | null;
  notes: string;
  program_id: string;
  program_title?: string;
  program_category?: string;
  program_location?: string;
  program_start_date?: string | null;
}

type ParticipantWithProgram = Tables<"pub_program_participants"> & {
  pub_programs: Pick<Tables<"pub_programs">, "title" | "category" | "location" | "start_date"> | null;
};

export function usePubParticipantsDirectory() {
  return useQuery({
    queryKey: ["pub-participants-directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pub_program_participants")
        .select("*, pub_programs!pub_program_participants_program_id_fkey(title, category, location, start_date)")
        .order("registered_at", { ascending: false });
      if (error) throw error;
      return ((data || []) as unknown as ParticipantWithProgram[]).map((d) => ({
        id: d.id,
        full_name: d.full_name,
        company: d.company,
        position: d.position,
        email: d.email,
        phone: d.phone,
        kta_number: d.kta_number || "",
        attendance_status: d.attendance_status,
        registered_at: d.registered_at,
        checked_in_at: d.checked_in_at,
        checked_out_at: d.checked_out_at,
        notes: d.notes,
        program_id: d.program_id,
        program_title: d.pub_programs?.title || "-",
        program_category: d.pub_programs?.category || "-",
        program_location: d.pub_programs?.location || "-",
        program_start_date: d.pub_programs?.start_date,
      })) as PubParticipantEntry[];
    },
  });
}
