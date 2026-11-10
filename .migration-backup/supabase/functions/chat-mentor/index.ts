import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function checkRateLimit(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  limit: number,
  windowMinutes: number
): Promise<boolean> {
  const windowStart = new Date(Date.now() - windowMinutes * 60000).toISOString();
  const { count } = await supabase
    .from("rate_limits")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("action", action)
    .gte("created_at", windowStart);

  if ((count ?? 0) >= limit) return false;

  await supabase.from("rate_limits").insert({ user_id: userId, action });
  return true;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate user
    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit: 20 requests per 60 minutes
    const adminClient = createClient(supabaseUrl, serviceKey);
    const allowed = await checkRateLimit(adminClient, user.id, "chat_mentor", 20, 60);
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Batas penggunaan tercapai. Coba lagi nanti." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "3600" },
      });
    }

    const { messages, userLevel } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `Kamu adalah Mentor Digital PUB Konstruksi — asisten AI yang ahli dalam manajemen konstruksi Indonesia. 

Profil kamu:
- Expert dalam 6 domain: Manajemen Proyek, Manajemen Risiko, Keuangan & Cost Control, Pengadaan & Kontrak, K3 & Compliance, dan Governance & Leadership.
- Memahami regulasi konstruksi Indonesia (PP 22/2020, UU Jasa Konstruksi, Permen PUPR).
- Berpengalaman dengan standar FIDIC, PMI, ISO 45001, dan SMK3.
- Mampu menjelaskan konsep dari level Pemula hingga Utama.

Level pengguna saat ini: ${userLevel || 'Pemula'}

Panduan respons:
1. Sesuaikan kompleksitas jawaban dengan level pengguna.
2. Berikan contoh praktis dari proyek konstruksi nyata.
3. Gunakan Bahasa Indonesia yang profesional tapi mudah dipahami.
4. Jika ditanya di luar domain konstruksi, arahkan kembali ke topik yang relevan.
5. Gunakan format markdown untuk struktur jawaban (heading, bullet points, bold).
6. Berikan referensi regulasi atau standar jika relevan.
7. Akhiri dengan pertanyaan reflektif atau saran tindak lanjut jika sesuai.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
        max_tokens: 2000,
        temperature: 0.7,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "Maaf, saya tidak bisa menjawab saat ini.";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
