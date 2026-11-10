import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/sonner-toast";
import type { TablesUpdate } from "@/integrations/supabase/types";

export interface RiskRegister {
  id: string;
  user_id: string;
  project_id: string | null;
  risk_description: string;
  probability_score: number;
  impact_score: number;
  risk_level: string | null;
  mitigation_action: string;
  owner: string;
  status: string;
  due_date: string | null;
  created_at: string;
  updated_at: string;
}

export type RiskInsert = Omit<RiskRegister, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'risk_level'>;

function computeRiskLevel(probability: number, impact: number): string {
  const score = probability * impact;
  if (score >= 15) return 'critical';
  if (score >= 10) return 'high';
  if (score >= 5) return 'medium';
  return 'low';
}

export function computeCompleteness(risk: Partial<RiskInsert>): number {
  let filled = 0;
  const total = 5;
  if (risk.risk_description && risk.risk_description.length > 5) filled++;
  if (risk.probability_score && risk.probability_score > 0) filled++;
  if (risk.impact_score && risk.impact_score > 0) filled++;
  if (risk.mitigation_action && risk.mitigation_action.length > 5) filled++;
  if (risk.owner && risk.owner.length > 0) filled++;
  return Math.round((filled / total) * 100);
}

function computePoints(completeness: number): number {
  if (completeness >= 80) return 5;
  if (completeness >= 60) return 3;
  if (completeness >= 40) return 2;
  return 1;
}

export const RISK_LEVEL_CONFIG: Record<string, { label: string; color: string }> = {
  critical: { label: 'Kritikal', color: 'destructive' },
  high: { label: 'Tinggi', color: 'destructive' },
  medium: { label: 'Sedang', color: 'default' },
  low: { label: 'Rendah', color: 'secondary' },
};

export function useRiskRegisters(projectId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const risksQuery = useQuery({
    queryKey: ['risk_registers', projectId],
    queryFn: async () => {
      let query = supabase.from('risk_registers').select('*').order('created_at', { ascending: false });
      if (projectId) query = query.eq('project_id', projectId);
      const { data, error } = await query;
      if (error) throw error;
      return data as RiskRegister[];
    },
    enabled: !!user,
  });

  const createRisk = useMutation({
    mutationFn: async (input: RiskInsert) => {
      const { data, error } = await supabase
        .from('risk_registers')
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;

      // Track toolkit activity for points
      const completeness = computeCompleteness(input);
      const points = computePoints(completeness);
      await supabase.from('toolkit_activities').insert({
        user_id: user!.id,
        project_id: input.project_id,
        tool_type: 'risk_register',
        entity_id: data.id,
        completeness,
        points_awarded: points,
      });

      return data as RiskRegister;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk_registers'] });
      queryClient.invalidateQueries({ queryKey: ['toolkit_activities'] });
      toast.success('Risiko berhasil ditambahkan');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateRisk = useMutation({
    mutationFn: async ({ id, risk_level: _rl, ...input }: Partial<RiskRegister> & { id: string }) => {
      const updates: TablesUpdate<'risk_registers'> = { ...input };
      // risk_level is a generated column — don't include it
      const { data, error } = await supabase
        .from('risk_registers')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as RiskRegister;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk_registers'] });
      toast.success('Risiko berhasil diperbarui');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteRisk = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('risk_registers').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk_registers'] });
      toast.success('Risiko berhasil dihapus');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    risks: risksQuery.data ?? [],
    isLoading: risksQuery.isLoading,
    createRisk,
    updateRisk,
    deleteRisk,
  };
}
