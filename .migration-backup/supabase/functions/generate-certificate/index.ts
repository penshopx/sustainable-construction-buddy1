import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing authorization");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // User client for auth
    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { level, module_name } = await req.json();
    if (!level) throw new Error("Level is required");
    if (!module_name) throw new Error("Module name is required");

    // Service client for admin operations
    const adminClient = createClient(supabaseUrl, serviceKey);

    // Check if certificate already exists
    const { data: existing } = await adminClient
      .from("certificates")
      .select("id")
      .eq("user_id", user.id)
      .eq("level", level)
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ error: "Sertifikat untuk level ini sudah diterbitkan" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get all modules for this level
    const { data: modules } = await adminClient
      .from("e_course_modules")
      .select("id")
      .eq("level", level);

    if (!modules || modules.length === 0) {
      return new Response(JSON.stringify({ error: "Tidak ada modul untuk level ini" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check completion
    const moduleIds = modules.map((m) => m.id);
    const { data: progress } = await adminClient
      .from("module_progress")
      .select("module_id, status")
      .eq("user_id", user.id)
      .in("module_id", moduleIds)
      .eq("status", "completed");

    const completedIds = new Set((progress || []).map((p) => p.module_id));
    const allCompleted = moduleIds.every((id) => completedIds.has(id));

    if (!allCompleted) {
      return new Response(
        JSON.stringify({
          error: "Belum semua modul diselesaikan",
          completed: completedIds.size,
          total: moduleIds.length,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user profile
    const { data: profile } = await adminClient
      .from("profiles")
      .select("full_name, company, position")
      .eq("user_id", user.id)
      .single();

    // Generate certificate number
    const certNumber = `PUB-${level.toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

    // Insert certificate
    const { data: cert, error: insertError } = await adminClient
      .from("certificates")
      .insert({
        user_id: user.id,
        level,
        certificate_number: certNumber,
        full_name: profile?.full_name || "",
        company: profile?.company || "",
        position: profile?.position || "",
        module_name,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    return new Response(JSON.stringify({ certificate: cert }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
