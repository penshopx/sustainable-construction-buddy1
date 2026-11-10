import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PubProgram {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  publication_status: ProgramPublicationStatus;
  start_date: string | null;
  end_date: string | null;
  location: string;
  progress_percent: number;
  image_url: string;
  created_at: string;
  updated_at: string;
}

export type ProgramPublicationStatus = "draft" | "published" | "archived";

export interface PubProgramUpdate {
  id: string;
  program_id: string;
  title: string;
  content: string;
  published_at: string;
  created_at: string;
  pub_programs?: PubProgram;
}

export interface PubProgramGallery {
  id: string;
  program_id: string;
  image_url: string;
  caption: string;
  created_at: string;
  pub_programs?: PubProgram;
}

export function usePrograms({ publicOnly = false }: { publicOnly?: boolean } = {}) {
  return useQuery({
    queryKey: ["pub-programs", { publicOnly }],
    queryFn: async () => {
      let query = supabase
        .from("pub_programs")
        .select("*")
        .order("start_date", { ascending: false });
      if (publicOnly) query = query.eq("publication_status", "published");
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as PubProgram[];
    },
  });
}

export function useProgramUpdates({ publicOnly = false }: { publicOnly?: boolean } = {}) {
  return useQuery({
    queryKey: ["pub-program-updates", { publicOnly }],
    queryFn: async () => {
      let query = supabase
        .from("pub_program_updates")
        .select(publicOnly ? "*, pub_programs!inner(*)" : "*, pub_programs(*)")
        .order("published_at", { ascending: false });
      if (publicOnly) query = query.eq("pub_programs.publication_status", "published");
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as PubProgramUpdate[];
    },
  });
}

export function useProgramGallery({ publicOnly = false }: { publicOnly?: boolean } = {}) {
  return useQuery({
    queryKey: ["pub-program-gallery", { publicOnly }],
    queryFn: async () => {
      let query = supabase
        .from("pub_program_gallery")
        .select(publicOnly ? "*, pub_programs!inner(*)" : "*, pub_programs(*)")
        .order("created_at", { ascending: false });
      if (publicOnly) query = query.eq("pub_programs.publication_status", "published");
      const { data, error } = await query;
      if (error) throw error;
      return data as unknown as PubProgramGallery[];
    },
  });
}

export function useCreateProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (program: Omit<PubProgram, "id" | "created_at" | "updated_at">) => {
      const { data, error } = await supabase
        .from("pub_programs")
        .insert(program)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pub-programs"] }),
  });
}

export function useUpdateProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: Partial<PubProgram> & { id: string }) => {
      const { error } = await supabase
        .from("pub_programs")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pub-programs"] }),
  });
}

export function useDeleteProgram() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pub_programs")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pub-programs"] }),
  });
}

export function useCreateProgramUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (update: { program_id: string; title: string; content: string }) => {
      const { error } = await supabase
        .from("pub_program_updates")
        .insert(update);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pub-program-updates"] }),
  });
}

export function useUpdateProgramUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...updates }: { id: string; title?: string; content?: string }) => {
      const { error } = await supabase
        .from("pub_program_updates")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pub-program-updates"] }),
  });
}

export function useDeleteProgramUpdate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pub_program_updates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pub-program-updates"] }),
  });
}

export function useCreateGalleryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (item: { program_id: string; image_url: string; caption: string }) => {
      const { error } = await supabase
        .from("pub_program_gallery")
        .insert(item);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pub-program-gallery"] }),
  });
}

export function useDeleteGalleryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pub_program_gallery")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pub-program-gallery"] }),
  });
}
