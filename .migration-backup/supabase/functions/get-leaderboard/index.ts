import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the user is authenticated
    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Fetch all profiles
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("user_id, full_name, company, current_level, total_score");

    // Fetch all completed module progress
    const { data: allProgress } = await adminClient
      .from("module_progress")
      .select("user_id, status");

    // Fetch total modules count
    const { data: modules } = await adminClient
      .from("e_course_modules")
      .select("id");

    const totalModules = modules?.length || 0;

    // Build progress map
    const progressMap: Record<string, { completed: number; in_progress: number }> = {};
    for (const p of allProgress || []) {
      if (!progressMap[p.user_id]) progressMap[p.user_id] = { completed: 0, in_progress: 0 };
      if (p.status === "completed") progressMap[p.user_id].completed++;
      else if (p.status === "in_progress") progressMap[p.user_id].in_progress++;
    }

    // Build leaderboard
    const leaderboard = (profiles || [])
      .map((p) => {
        const progress = progressMap[p.user_id] || { completed: 0, in_progress: 0 };
        return {
          user_id: p.user_id,
          full_name: p.full_name || "Anonim",
          company: p.company || "-",
          current_level: p.current_level,
          total_score: p.total_score,
          modules_completed: progress.completed,
          modules_in_progress: progress.in_progress,
          total_modules: totalModules,
          // Composite score: assessment score + (completed modules * 10)
          composite_score: p.total_score + progress.completed * 10,
        };
      })
      .sort((a, b) => b.composite_score - a.composite_score)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));

    return new Response(JSON.stringify({ leaderboard, current_user_id: user.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
