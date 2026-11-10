import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(amount);
}

interface ProjectContext {
  name: string;
  description?: string | null;
  bujk_name?: string | null;
  location?: string | null;
  value_amount?: number | null;
  contract_type?: string | null;
  duration_months?: number | null;
  risk_class?: string | null;
  multidiscipline?: boolean | null;
  complexity_score?: number | null;
  status?: string | null;
}

interface RiskContext {
  risk_description?: string | null;
  probability_score?: number | null;
  impact_score?: number | null;
  risk_level?: string | null;
  mitigation_action?: string | null;
  owner?: string | null;
  status?: string | null;
}

interface BudgetContext {
  category?: string | null;
  period_month?: string | null;
  planned_amount?: number | null;
  actual_amount?: number | null;
  deviation_percent?: number | null;
  notes?: string | null;
}

function buildProjectContext(project: ProjectContext | null): string {
  if (!project) return "";
  const lines = [
    `## Data Proyek (Auto-filled)`,
    `- **Nama Proyek**: ${project.name}`,
    `- **Deskripsi**: ${project.description || "-"}`,
    `- **BUJK**: ${project.bujk_name || "-"}`,
    `- **Lokasi**: ${project.location || "-"}`,
    `- **Nilai Kontrak**: ${formatCurrency(project.value_amount || 0)}`,
    `- **Tipe Kontrak**: ${project.contract_type || "-"}`,
    `- **Durasi**: ${project.duration_months || 0} bulan`,
    `- **Kelas Risiko**: ${project.risk_class || "-"}`,
    `- **Multi-disiplin**: ${project.multidiscipline ? "Ya" : "Tidak"}`,
    `- **Skor Kompleksitas**: ${project.complexity_score || 0}`,
    `- **Status**: ${project.status || "-"}`,
  ];
  return lines.join("\n");
}

function buildRiskContext(risks: RiskContext[]): string {
  if (!risks || risks.length === 0) return "";
  const lines = [
    `\n## Data Risk Register (Auto-filled) — ${risks.length} risiko`,
    `| No | Deskripsi Risiko | Probabilitas | Dampak | Level | Mitigasi | Owner | Status |`,
    `|----|-----------------|-------------|--------|-------|----------|-------|--------|`,
  ];
  risks.forEach((r, i) => {
    lines.push(
      `| ${i + 1} | ${r.risk_description || "-"} | ${r.probability_score}/5 | ${r.impact_score}/5 | ${r.risk_level || "-"} | ${r.mitigation_action || "-"} | ${r.owner || "-"} | ${r.status || "-"} |`
    );
  });
  return lines.join("\n");
}

function buildBudgetContext(budgets: BudgetContext[]): string {
  if (!budgets || budgets.length === 0) return "";
  const totalPlanned = budgets.reduce((s, b) => s + (b.planned_amount || 0), 0);
  const totalActual = budgets.reduce((s, b) => s + (b.actual_amount || 0), 0);
  const avgDeviation = budgets.length > 0
    ? (budgets.reduce((s, b) => s + Math.abs(b.deviation_percent || 0), 0) / budgets.length).toFixed(1)
    : "0";

  const lines = [
    `\n## Data Budget Tracker (Auto-filled) — ${budgets.length} entri`,
    `- **Total Rencana**: ${formatCurrency(totalPlanned)}`,
    `- **Total Realisasi**: ${formatCurrency(totalActual)}`,
    `- **Rata-rata Deviasi**: ${avgDeviation}%`,
    ``,
    `| Kategori | Periode | Rencana | Realisasi | Deviasi | Catatan |`,
    `|----------|---------|---------|-----------|---------|---------|`,
  ];
  budgets.forEach((b) => {
    lines.push(
      `| ${b.category || "-"} | ${b.period_month || "-"} | ${formatCurrency(b.planned_amount || 0)} | ${formatCurrency(b.actual_amount || 0)} | ${b.deviation_percent ?? 0}% | ${b.notes || "-"} |`
    );
  });
  return lines.join("\n");
}

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
    return new Response(null, { headers: corsHeaders });
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

    // Rate limit: 10 requests per 60 minutes
    const adminClient = createClient(supabaseUrl, serviceKey);
    const allowed = await checkRateLimit(adminClient, user.id, "generate_document", 10, 60);
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Batas penggunaan tercapai. Coba lagi nanti." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "3600" },
      });
    }

    const { documentType, context, projectData, riskData, budgetData } = await req.json();
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build auto-filled context
    let autoFilledContext = "";
    if (projectData) autoFilledContext += buildProjectContext(projectData);
    if (riskData) autoFilledContext += buildRiskContext(riskData);
    if (budgetData) autoFilledContext += buildBudgetContext(budgetData);

    const fullContext = autoFilledContext
      ? `${autoFilledContext}\n\n## Konteks Tambahan dari User\n${context || "(tidak ada)"}`
      : context || "";

    const prompts: Record<string, string> = {
      sop: `Buatkan Standard Operating Procedure (SOP) untuk perusahaan jasa konstruksi (BUJK) dengan data berikut:\n\n${fullContext}\n\nFormat: 1.Tujuan 2.Ruang Lingkup 3.Referensi 4.Definisi 5.Prosedur detail 6.Diagram Alir 7.Dokumentasi 8.Catatan Revisi`,
      rab: `Buatkan Rencana Anggaran Biaya (RAB) berdasarkan data berikut:\n\n${fullContext}\n\nGunakan data budget tracker yang tersedia untuk menyusun RAB. Format: 1.Info Proyek 2.Uraian Pekerjaan 3.Volume&Satuan 4.Harga Satuan 5.Jumlah per Item 6.Rekapitulasi 7.Overhead&Profit 8.Total RAB 9.Catatan`,
      rkk: `Buatkan Rencana Keselamatan Konstruksi (RKK) berdasarkan data berikut:\n\n${fullContext}\n\nFormat: 1.Kebijakan K3 2.Identifikasi Bahaya 3.Sasaran K3 4.Organisasi K3 5.Prosedur Kerja Aman 6.Tanggap Darurat 7.Pelatihan 8.Inspeksi 9.Pelaporan 10.Evaluasi`,
      risk_plan: `Buatkan Risk Management Plan berdasarkan data risk register berikut:\n\n${fullContext}\n\nGunakan data risk register yang tersedia untuk menyusun dokumen. Format: 1.Pendahuluan 2.Metodologi 3.Identifikasi Risiko 4.Analisis (matrix) 5.Strategi Respons 6.Monitoring 7.Peran&Tanggung Jawab 8.Jadwal Review`,
      laporan_proyek: `Buatkan Laporan Progress Proyek berdasarkan data berikut:\n\n${fullContext}\n\nGunakan data proyek, budget, dan risk register untuk menyusun laporan komprehensif. Format: 1.Ringkasan Eksekutif 2.Status Progress 3.Pencapaian 4.Rencana Berikutnya 5.Isu&Kendala 6.Tindakan Korektif 7.Permintaan 8.Lampiran`,
    };

    const systemPrompt = `Kamu adalah konsultan manajemen konstruksi berpengalaman di Indonesia yang expert dalam membuat dokumen-dokumen manajerial BUJK. Buatkan dokumen yang profesional, detail, dan sesuai standar industri konstruksi Indonesia. Gunakan Bahasa Indonesia formal dan teknis. Format output menggunakan Markdown.

ATURAN FORMAT PENTING:
- Gunakan tabel Markdown standar GFM (GitHub Flavored Markdown) untuk data tabular
- Tabel HARUS menggunakan format: | Header1 | Header2 | diikuti | --- | --- | lalu baris data
- JANGAN gunakan garis pemisah "---" atau "====" berulang di luar tabel
- JANGAN buat tabel dengan terlalu banyak kolom (maksimal 6 kolom)
- Untuk pemisah section, gunakan heading ## atau ### saja, BUKAN garis horizontal ---
- Jika data proyek, risk register, atau budget tracker disediakan, WAJIB gunakan data tersebut sebagai basis dokumen — jangan buat data fiktif. Masukkan data nyata ke dalam dokumen yang dihasilkan.`;

    const userPrompt = prompts[documentType] || prompts.sop;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 6000,
        temperature: 0.5,
      }),
    });

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || "Gagal menghasilkan dokumen.";

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
