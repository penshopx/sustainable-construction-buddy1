import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface InnovationCategory {
  id: string;
  slug: string;
  name: string;
  icon: string;
  description: string;
  concepts: string[];
  programs: string[];
  benefits: string[];
  stage: number;
  sort_order: number;
}

export interface InnovationProposal {
  id: string;
  user_id: string;
  category_id: string;
  title: string;
  description: string;
  scope: string;
  expected_impact: string;
  status: string;
  admin_notes: string;
  attachment_url: string;
  attachment_name: string;
  created_at: string;
  updated_at: string;
  innovation_categories?: InnovationCategory;
}

export function useInnovationCategories() {
  return useQuery({
    queryKey: ["innovation-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("innovation_categories")
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return data as unknown as InnovationCategory[];
    },
  });
}

export function useInnovationProposals() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["innovation-proposals", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("innovation_proposals")
        .select("*, innovation_categories(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as InnovationProposal[];
    },
    enabled: !!user,
  });
}

export function useCreateProposal() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async (proposal: {
      category_id: string;
      title: string;
      description: string;
      scope: string;
      expected_impact: string;
      attachment_url?: string;
      attachment_name?: string;
    }) => {
      const { data, error } = await supabase
        .from("innovation_proposals")
        .insert({ ...proposal, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["innovation-proposals"] });
    },
  });
}

export function useDeleteProposal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("innovation_proposals")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["innovation-proposals"] });
    },
  });
}

export function useAdminInnovationProposals() {
  return useQuery({
    queryKey: ["admin-innovation-proposals"],
    queryFn: async () => {
      const { data: proposals, error } = await supabase
        .from("innovation_proposals")
        .select("*, innovation_categories(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      
      const userIds = [...new Set((proposals || []).map((p) => p.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, company")
        .in("user_id", userIds);
      
      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
      return (proposals || []).map((p) => ({
        ...p,
        submitter_name: profileMap.get(p.user_id)?.full_name || "Unknown",
        submitter_company: profileMap.get(p.user_id)?.company || "",
      })) as unknown as (InnovationProposal & { submitter_name: string; submitter_company: string })[];
    },
  });
}

export function useUpdateProposalStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, admin_notes }: { id: string; status: string; admin_notes: string }) => {
      const { error } = await supabase
        .from("innovation_proposals")
        .update({ status, admin_notes, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-innovation-proposals"] });
      queryClient.invalidateQueries({ queryKey: ["innovation-proposals"] });
    },
  });
}

export interface ProposalLog {
  id: string;
  proposal_id: string;
  old_status: string;
  new_status: string;
  notes: string;
  changed_by: string | null;
  created_at: string;
}

export function useProposalDetail(id: string | undefined) {
  return useQuery({
    queryKey: ["innovation-proposal-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("innovation_proposals")
        .select("*, innovation_categories(*)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data as unknown as InnovationProposal;
    },
    enabled: !!id,
  });
}

export function useProposalLogs(proposalId: string | undefined) {
  return useQuery({
    queryKey: ["innovation-proposal-logs", proposalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("innovation_proposal_logs")
        .select("*")
        .eq("proposal_id", proposalId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as unknown as ProposalLog[];
    },
    enabled: !!proposalId,
  });
}

export interface InnovationComment {
  id: string;
  proposal_id: string;
  user_id: string;
  message: string;
  is_admin: boolean;
  created_at: string;
  author_name?: string;
}

export function useProposalComments(proposalId: string | undefined) {
  return useQuery({
    queryKey: ["innovation-comments", proposalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("innovation_comments")
        .select("*")
        .eq("proposal_id", proposalId!)
        .order("created_at", { ascending: true });
      if (error) throw error;

      const userIds = [...new Set((data || []).map((c) => c.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name")
        .in("user_id", userIds);
      const profileMap = new Map((profiles || []).map((p) => [p.user_id, p.full_name]));

      return (data || []).map((c) => ({
        ...c,
        author_name: profileMap.get(c.user_id) || "Unknown",
      })) as InnovationComment[];
    },
    enabled: !!proposalId,
  });
}

export function useAddComment() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ proposal_id, message, is_admin }: { proposal_id: string; message: string; is_admin: boolean }) => {
      const { error } = await supabase
        .from("innovation_comments")
        .insert({ proposal_id, user_id: user!.id, message, is_admin });
      if (error) throw error;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["innovation-comments", vars.proposal_id] });
    },
  });
}
