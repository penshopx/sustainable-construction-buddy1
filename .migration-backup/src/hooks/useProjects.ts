import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { computeComplexityScore, type ProjectInput } from "@/lib/complexity";
import { toast } from "@/components/ui/sonner-toast";
import type { TablesUpdate } from "@/integrations/supabase/types";

export interface Project {
  id: string;
  user_id: string;
  bujk_name: string;
  name: string;
  contract_type: string;
  value_amount: number;
  duration_months: number;
  multidiscipline: boolean;
  risk_class: string;
  complexity_score: number;
  location: string;
  description: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export type ProjectInsert = Omit<Project, 'id' | 'created_at' | 'updated_at' | 'complexity_score' | 'user_id'>;

export function useProjects() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const projectsQuery = useQuery({
    queryKey: ['projects', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Project[];
    },
    enabled: !!user,
  });

  const createProject = useMutation({
    mutationFn: async (input: ProjectInsert) => {
      const complexity_score = computeComplexityScore(input as ProjectInput);
      const { data, error } = await supabase
        .from('projects')
        .insert({ ...input, user_id: user!.id, complexity_score })
        .select()
        .single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Proyek berhasil dibuat');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateProject = useMutation({
    mutationFn: async ({ id, ...input }: Partial<Project> & { id: string }) => {
      const updates: TablesUpdate<'projects'> = { ...input };
      // Recalculate complexity if relevant fields changed
      if (input.value_amount !== undefined || input.duration_months !== undefined || input.contract_type !== undefined || input.risk_class !== undefined || input.multidiscipline !== undefined) {
        const existing = projectsQuery.data?.find(p => p.id === id);
        if (existing) {
          const merged = { ...existing, ...input };
          updates.complexity_score = computeComplexityScore(merged as ProjectInput);
        }
      }
      const { data, error } = await supabase
        .from('projects')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Proyek berhasil diperbarui');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteProject = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      toast.success('Proyek berhasil dihapus');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return { projects: projectsQuery.data ?? [], isLoading: projectsQuery.isLoading, createProject, updateProject, deleteProject };
}

export function useProject(id: string | undefined) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['project', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('*')
        .eq('id', id!)
        .single();
      if (error) throw error;
      return data as Project;
    },
    enabled: !!user && !!id,
  });
}
