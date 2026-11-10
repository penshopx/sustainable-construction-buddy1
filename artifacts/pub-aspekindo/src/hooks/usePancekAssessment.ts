import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/components/ui/sonner-toast";
import type { PancekAnswers } from "@/lib/pancekAnswerTypes";
import type { Json, Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type StoredPancekAnswers = Json & (PancekAnswers | Record<string, boolean>);

export type PancekAssessment = Omit<Tables<"pancek_assessments">, "answers"> & {
  answers: StoredPancekAnswers;
};

export function usePancekAssessment() {
  const { user } = useAuth();
  const [assessments, setAssessments] = useState<PancekAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAssessments = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase.from("pancek_assessments")
      .select("*")
      .eq("user_id", user.id)
      .order("period_year", { ascending: false });
    if (error) {
      console.error("Error fetching pancek:", error);
    } else {
      setAssessments((data || []).map((assessment) => ({
        ...assessment,
        answers: assessment.answers as StoredPancekAnswers,
      })));
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAssessments();
  }, [fetchAssessments]);

  const saveAssessment = async (
    periodYear: number,
    answers: PancekAnswers,
    pillarScores: Record<string, number>,
    meta: { company_name: string; npwp: string; nib: string }
  ) => {
    if (!user) return;

    const totalAnswered = Object.values(answers).filter(a => a.status === "ya" || a.status === "sebagian").length;
    const totalIndicators = 70;
    const completionPercent = Math.round((totalAnswered / totalIndicators) * 100);

    const payload: TablesInsert<"pancek_assessments"> = {
      user_id: user.id,
      period_year: periodYear,
      company_name: meta.company_name,
      npwp: meta.npwp,
      nib: meta.nib,
      komitmen_score: Math.round(pillarScores.komitmen || 0),
      perencanaan_score: Math.round(pillarScores.perencanaan || 0),
      pelaksanaan_score: Math.round(pillarScores.pelaksanaan || 0),
      evaluasi_score: Math.round(pillarScores.evaluasi || 0),
      perbaikan_score: Math.round(pillarScores.perbaikan || 0),
      respon_score: Math.round(pillarScores.respon || 0),
      total_answered: totalAnswered,
      completion_percent: completionPercent,
      answers: answers as PancekAnswers & Json,
    };

    const existing = assessments.find(a => a.period_year === periodYear);

    if (existing) {
      const updates: TablesUpdate<"pancek_assessments"> = payload;
      const { error } = await supabase.from("pancek_assessments")
        .update(updates)
        .eq("id", existing.id);
      if (error) {
        toast.error("Gagal menyimpan: " + error.message);
        return;
      }
    } else {
      const { error } = await supabase.from("pancek_assessments")
        .insert(payload);
      if (error) {
        toast.error("Gagal membuat: " + error.message);
        return;
      }
    }

    toast.success("PANCEK berhasil disimpan");
    fetchAssessments();
  };

  const submitAssessment = async (id: string) => {
    const { error } = await supabase.from("pancek_assessments")
      .update({ status: "submitted" })
      .eq("id", id);
    if (error) {
      toast.error("Gagal submit: " + error.message);
      return;
    }
    toast.success("PANCEK berhasil disubmit untuk verifikasi Asosiasi");
    fetchAssessments();
  };

  return { assessments, loading, saveAssessment, submitAssessment, refetch: fetchAssessments };
}
