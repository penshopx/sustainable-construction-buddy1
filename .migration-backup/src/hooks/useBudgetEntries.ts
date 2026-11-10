import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/sonner-toast";
import type { TablesUpdate } from "@/integrations/supabase/types";

export interface BudgetEntry {
  id: string;
  user_id: string;
  project_id: string | null;
  category: string;
  period_month: string;
  planned_amount: number;
  actual_amount: number;
  deviation_percent: number | null;
  mitigation_plan: string;
  notes: string;
  created_at: string;
  updated_at: string;
}

export type BudgetInsert = Omit<BudgetEntry, 'id' | 'created_at' | 'updated_at' | 'user_id' | 'deviation_percent'>;

function computeDeviation(planned: number, actual: number): number | null {
  if (planned === 0) return null;
  return Math.round(((actual - planned) / planned) * 100 * 100) / 100;
}

export function computeBudgetCompleteness(entry: Partial<BudgetInsert>): number {
  let filled = 0;
  const total = 5;
  if (entry.category && entry.category.length > 0) filled++;
  if (entry.period_month && entry.period_month.length > 0) filled++;
  if (entry.planned_amount && entry.planned_amount > 0) filled++;
  if (entry.actual_amount !== undefined && entry.actual_amount >= 0) filled++;
  if (entry.mitigation_plan && entry.mitigation_plan.length > 5) filled++;
  return Math.round((filled / total) * 100);
}

function computePoints(completeness: number): number {
  if (completeness >= 80) return 5;
  if (completeness >= 60) return 3;
  if (completeness >= 40) return 2;
  return 1;
}

export type DeviationSeverity = 'normal' | 'warning' | 'danger';

export function getDeviationSeverity(deviation: number | null): DeviationSeverity {
  if (deviation === null) return 'normal';
  const abs = Math.abs(deviation);
  if (abs >= 15) return 'danger';
  if (abs >= 5) return 'warning';
  return 'normal';
}

export const BUDGET_CATEGORIES = [
  'Material',
  'Tenaga Kerja',
  'Peralatan',
  'Subkontraktor',
  'Overhead',
  'Lain-lain',
];

export function useBudgetEntries(projectId: string | undefined) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const entriesQuery = useQuery({
    queryKey: ['budget_entries', projectId],
    queryFn: async () => {
      let query = supabase.from('budget_entries').select('*').order('period_month', { ascending: true });
      if (projectId) query = query.eq('project_id', projectId);
      const { data, error } = await query;
      if (error) throw error;
      return data as BudgetEntry[];
    },
    enabled: !!user,
  });

  const createEntry = useMutation({
    mutationFn: async (input: BudgetInsert) => {
      const { data, error } = await supabase
        .from('budget_entries')
        .insert({ ...input, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;

      const completeness = computeBudgetCompleteness(input);
      const points = computePoints(completeness);
      await supabase.from('toolkit_activities').insert({
        user_id: user!.id,
        project_id: input.project_id,
        tool_type: 'budget_tracker',
        entity_id: data.id,
        completeness,
        points_awarded: points,
      });

      return data as BudgetEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget_entries'] });
      queryClient.invalidateQueries({ queryKey: ['toolkit_activities'] });
      toast.success('Entri anggaran berhasil ditambahkan');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateEntry = useMutation({
    mutationFn: async ({ id, ...input }: Partial<BudgetEntry> & { id: string }) => {
      const updates: TablesUpdate<'budget_entries'> = { ...input };
      delete updates.user_id;
      delete updates.created_at;
      delete updates.updated_at;
      delete updates.deviation_percent;
      const { data, error } = await supabase
        .from('budget_entries')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as BudgetEntry;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget_entries'] });
      toast.success('Entri anggaran berhasil diperbarui');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteEntry = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('budget_entries').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget_entries'] });
      toast.success('Entri anggaran berhasil dihapus');
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Summary calculations
  const entries = entriesQuery.data ?? [];
  const totalPlanned = entries.reduce((s, e) => s + e.planned_amount, 0);
  const totalActual = entries.reduce((s, e) => s + e.actual_amount, 0);
  const overallDeviation = computeDeviation(totalPlanned, totalActual);
  const warningCount = entries.filter(e => getDeviationSeverity(e.deviation_percent) !== 'normal').length;

  return {
    entries,
    isLoading: entriesQuery.isLoading,
    createEntry,
    updateEntry,
    deleteEntry,
    summary: { totalPlanned, totalActual, overallDeviation, warningCount },
  };
}
