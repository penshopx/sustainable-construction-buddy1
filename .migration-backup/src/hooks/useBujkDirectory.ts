import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import type { TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export interface BujkEntry {
  id: string;
  user_id: string;
  company_name: string;
  nib: string;
  npwp: string;
  address: string;
  city: string;
  province: string;
  phone: string;
  email: string;
  website: string;
  qualification: string;
  sub_classification: string;
  sbu_number: string;
  sbu_expiry: string | null;
  description: string;
  logo_url: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export function useBujkDirectory() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const directoryQuery = useQuery({
    queryKey: ["bujk-directory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bujk_directory")
        .select("*")
        .order("company_name");
      if (error) throw error;
      return (data || []) as unknown as BujkEntry[];
    },
    enabled: !!user,
  });

  const myEntryQuery = useQuery({
    queryKey: ["bujk-directory-mine"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bujk_directory")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as BujkEntry | null;
    },
    enabled: !!user,
  });

  const upsertMutation = useMutation({
    mutationFn: async (entry: TablesUpdate<"bujk_directory">) => {
      if (myEntryQuery.data?.id) {
        const { error } = await supabase
          .from("bujk_directory")
          .update(entry)
          .eq("id", myEntryQuery.data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("bujk_directory")
          .insert({ ...entry, user_id: user!.id } satisfies TablesInsert<"bujk_directory">);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bujk-directory"] });
      qc.invalidateQueries({ queryKey: ["bujk-directory-mine"] });
      toast({ title: "Berhasil", description: "Data perusahaan disimpan." });
    },
    onError: (error: unknown) => {
      const description = error instanceof Error ? error.message : "Gagal menyimpan data perusahaan.";
      toast({ title: "Error", description, variant: "destructive" });
    },
  });

  return { directoryQuery, myEntryQuery, upsertMutation };
}
