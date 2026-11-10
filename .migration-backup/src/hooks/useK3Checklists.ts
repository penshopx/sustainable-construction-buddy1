import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const DEFAULT_K3_ITEMS = [
  { category: "APD", item_text: "Pekerja menggunakan helm keselamatan", sort_order: 1 },
  { category: "APD", item_text: "Pekerja menggunakan sepatu safety", sort_order: 2 },
  { category: "APD", item_text: "Pekerja menggunakan rompi reflektor", sort_order: 3 },
  { category: "APD", item_text: "Tersedia sarung tangan kerja", sort_order: 4 },
  { category: "Area Kerja", item_text: "Rambu peringatan terpasang", sort_order: 5 },
  { category: "Area Kerja", item_text: "Barricade/pagar pengaman terpasang", sort_order: 6 },
  { category: "Area Kerja", item_text: "Jalur evakuasi bebas hambatan", sort_order: 7 },
  { category: "Area Kerja", item_text: "Pencahayaan area kerja memadai", sort_order: 8 },
  { category: "Peralatan", item_text: "Alat berat dalam kondisi layak operasi", sort_order: 9 },
  { category: "Peralatan", item_text: "APAR tersedia dan belum kadaluarsa", sort_order: 10 },
  { category: "Peralatan", item_text: "P3K tersedia dan lengkap", sort_order: 11 },
  { category: "Dokumentasi", item_text: "SOP K3 tersedia di lokasi", sort_order: 12 },
  { category: "Dokumentasi", item_text: "Toolbox meeting dilaksanakan", sort_order: 13 },
  { category: "Dokumentasi", item_text: "Izin kerja (work permit) tersedia", sort_order: 14 },
];

export function useK3Checklists(projectId?: string) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const checklists = useQuery({
    queryKey: ["k3-checklists", user?.id, projectId],
    enabled: !!user,
    queryFn: async () => {
      let query = supabase
        .from("k3_checklists")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (projectId) query = query.eq("project_id", projectId);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    },
  });

  const createChecklist = useMutation({
    mutationFn: async (input: { project_id?: string; inspector_name: string; location: string; checkedItems?: Record<number, boolean> }) => {
      const checkedItems = input.checkedItems || {};
      const completedCount = Object.values(checkedItems).filter(Boolean).length;
      const scorePercent = DEFAULT_K3_ITEMS.length > 0 ? Math.round((completedCount / DEFAULT_K3_ITEMS.length) * 100) : 0;

      // Create checklist
      const { data: checklist, error } = await supabase
        .from("k3_checklists")
        .insert({
          user_id: user!.id,
          project_id: input.project_id || null,
          inspector_name: input.inspector_name,
          location: input.location,
          total_items: DEFAULT_K3_ITEMS.length,
          completed_items: completedCount,
          score_percent: scorePercent,
          status: completedCount === DEFAULT_K3_ITEMS.length ? "completed" : completedCount > 0 ? "in_progress" : "draft",
        })
        .select()
        .single();
      if (error) throw error;

      // Create items with initial compliance state
      const items = DEFAULT_K3_ITEMS.map((item) => ({
        checklist_id: checklist.id,
        ...item,
        is_compliant: !!checkedItems[item.sort_order],
      }));
      const { error: itemErr } = await supabase.from("k3_checklist_items").insert(items);
      if (itemErr) throw itemErr;

      return checklist;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["k3-checklists"] }),
  });

  const deleteChecklist = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("k3_checklists").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["k3-checklists"] }),
  });

  return {
    checklists: checklists.data || [],
    isLoading: checklists.isLoading,
    createChecklist,
    deleteChecklist,
  };
}

export function useK3ChecklistDetail(checklistId: string) {
  const qc = useQueryClient();

  const items = useQuery({
    queryKey: ["k3-items", checklistId],
    enabled: !!checklistId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("k3_checklist_items")
        .select("*")
        .eq("checklist_id", checklistId)
        .order("sort_order");
      if (error) throw error;
      return data || [];
    },
  });

  const toggleItem = useMutation({
    mutationFn: async ({ itemId, is_compliant }: { itemId: string; is_compliant: boolean }) => {
      const { error } = await supabase
        .from("k3_checklist_items")
        .update({ is_compliant })
        .eq("id", itemId);
      if (error) throw error;

      // Recount completed items
      const allItems = items.data || [];
      const newCompleted = allItems.filter((i) =>
        i.id === itemId ? is_compliant : i.is_compliant
      ).length;
      await supabase
        .from("k3_checklists")
        .update({ completed_items: newCompleted, status: newCompleted === allItems.length ? "completed" : "in_progress" })
        .eq("id", checklistId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["k3-items", checklistId] });
      qc.invalidateQueries({ queryKey: ["k3-checklists"] });
    },
  });

  const updateItemFinding = useMutation({
    mutationFn: async ({ itemId, finding, corrective_action }: { itemId: string; finding: string; corrective_action: string }) => {
      const { error } = await supabase
        .from("k3_checklist_items")
        .update({ finding, corrective_action })
        .eq("id", itemId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["k3-items", checklistId] }),
  });

  return {
    items: items.data || [],
    isLoading: items.isLoading,
    toggleItem,
    updateItemFinding,
  };
}
