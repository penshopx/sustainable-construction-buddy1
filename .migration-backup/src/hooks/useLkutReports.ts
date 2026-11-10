import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type LkutReport = Tables<"lkut_reports">;

export function useLkutReports() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [reports, setReports] = useState<LkutReport[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("lkut_reports")
      .select("*")
      .eq("user_id", user.id)
      .order("report_year", { ascending: false });
    if (error) {
      toast({ title: "Gagal memuat laporan", description: error.message, variant: "destructive" });
    } else {
      setReports(data || []);
    }
    setLoading(false);
  }, [user, toast]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const createReport = async (year: number) => {
    if (!user) return null;
    const { data, error } = await supabase
      .from("lkut_reports")
      .insert({ user_id: user.id, report_year: year } satisfies TablesInsert<"lkut_reports">)
      .select()
      .single();
    if (error) {
      toast({
        title: "Gagal membuat laporan",
        description: error.code === "23505"
          ? `LKUT ${year} sudah ada. Pilih tahun laporan yang lain.`
          : error.message,
        variant: "destructive",
      });
      return null;
    }
    toast({ title: `LKUT ${year} dibuat` });
    await fetchReports();
    return data;
  };

  const updateReport = async (id: string, updates: TablesUpdate<"lkut_reports">) => {
    const { error } = await supabase
      .from("lkut_reports")
      .update(updates)
      .eq("id", id);
    if (error) {
      toast({ title: "Gagal menyimpan", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Data tersimpan" });
    await fetchReports();
    return true;
  };

  const submitReport = async (id: string) => {
    const { error } = await supabase
      .from("lkut_reports")
      .update({ status: "submitted", submitted_at: new Date().toISOString() } satisfies TablesUpdate<"lkut_reports">)
      .eq("id", id);
    if (error) {
      toast({ title: "Gagal mengirim", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "LKUT berhasil dikirim! 🎉" });
    await fetchReports();
    return true;
  };

  const deleteReport = async (id: string) => {
    const { error } = await supabase
      .from("lkut_reports")
      .delete()
      .eq("id", id);
    if (error) {
      toast({ title: "Gagal menghapus", description: error.message, variant: "destructive" });
      return false;
    }
    toast({ title: "Laporan dihapus" });
    await fetchReports();
    return true;
  };

  return { reports, loading, fetchReports, createReport, updateReport, submitReport, deleteReport };
}
