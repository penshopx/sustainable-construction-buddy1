import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { differenceInDays, parseISO } from "date-fns";

export function useSbuReminder() {
  const { user } = useAuth();
  const checked = useRef(false);

  useEffect(() => {
    if (!user || checked.current) return;
    checked.current = true;

    (async () => {
      // Get latest LKUT with SBU expiry
      const { data: reports } = await supabase
        .from("lkut_reports")
        .select("sbu_expiry_date, sbu_number")
        .eq("user_id", user.id)
        .order("report_year", { ascending: false })
        .limit(1);

      const report = reports?.[0];
      if (!report?.sbu_expiry_date) return;

      const daysLeft = differenceInDays(parseISO(report.sbu_expiry_date), new Date());
      if (daysLeft > 30 || daysLeft < 0) return;

      // Check if reminder already sent today
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", user.id)
        .eq("type", "sbu_expiry")
        .gte("created_at", today)
        .limit(1);

      if (existing && existing.length > 0) return;

      // Insert reminder notification
      await supabase.from("notifications").insert({
        user_id: user.id,
        type: "sbu_expiry",
        title: "⚠️ SBU Akan Kadaluarsa",
        message: `SBU ${report.sbu_number || ""} akan kadaluarsa dalam ${daysLeft} hari. Segera perpanjang sebelum masa berlaku habis.`,
      });
    })();
  }, [user]);
}
