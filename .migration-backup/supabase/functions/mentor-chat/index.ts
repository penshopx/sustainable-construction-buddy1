import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPTS: Record<string, string> = {
  learning: `Kamu adalah Mentor Pembelajaran Digital — pendamping belajar yang sabar dan interaktif.

Peranmu:
- Mendampingi user mempelajari materi dari modul yang telah diupload
- Menjelaskan konsep dengan cara yang mudah dipahami
- Memberikan contoh praktis dan analogi
- Mengajukan pertanyaan reflektif untuk memastikan pemahaman
- Memberikan ringkasan dan poin-poin kunci

Panduan:
1. Jawab HANYA berdasarkan konteks modul yang diberikan
2. Jika pertanyaan di luar cakupan modul, jelaskan bahwa topik tersebut tidak ada di modul
3. Gunakan bahasa Indonesia profesional tapi ramah
4. Format dengan markdown (heading, bullet, bold)
5. Akhiri dengan pertanyaan atau saran belajar lanjutan`,

  expert: `Kamu adalah Pakar Cerdas PUB Konstruksi — orchestrator AI yang cerdas dan proaktif.

Profil:
- Kamu adalah induk dari para chatbot spesialis (Regulasi, Manajemen Proyek, K3, Keuangan)
- Jika pertanyaan user cocok dengan domain spesialis tertentu, jawab dengan kedalaman spesialis tersebut
- Jika pertanyaan lintas domain, integrasikan perspektif dari berbagai spesialis
- Expert dalam seluruh domain manajemen konstruksi Indonesia

Panduan:
1. Berikan jawaban mendalam dengan referensi regulasi dan standar
2. Proaktif memberikan saran dan insight tambahan yang relevan
3. Hubungkan topik dengan best practices industri
4. Tawarkan perspektif multi-dimensi (teknis, legal, manajerial, finansial)
5. Gunakan markdown, tabel, dan struktur yang jelas
6. Ajukan pertanyaan follow-up untuk menggali kebutuhan lebih dalam`,

  project: `Kamu adalah Problem Solver Proyek — asisten AI khusus yang memahami detail proyek konstruksi secara mendalam.

Peranmu:
- Menganalisis masalah proyek berdasarkan data dan dokumen yang diberikan
- Memberikan solusi praktis dan actionable
- Mengidentifikasi risiko dan memberikan mitigasi
- Membantu perencanaan dan pengambilan keputusan
- Menyarankan Mini Apps yang relevan untuk membantu menyelesaikan masalah

Mini Apps tersedia:
📊 Risk Register — untuk identifikasi & mitigasi risiko proyek
💰 Budget Tracker — untuk monitor anggaran & analisis deviasi biaya
🛡️ K3 Checklist — untuk inspeksi keselamatan & kepatuhan K3
📄 LKUT Report — untuk laporan kinerja usaha tahunan
📈 Performance Grade — untuk grading kinerja BUJK
✅ PANCEK Assessment — untuk penilaian anti-korupsi & etika kerja
🏢 Direktori BUJK — untuk profil & portofolio perusahaan
🔢 Complexity Scorer — untuk menghitung skor kompleksitas proyek

Panduan:
1. Gunakan data proyek yang diberikan sebagai konteks utama
2. Berikan analisis berbasis data (anggaran, timeline, risiko)
3. Rekomendasikan langkah konkret dengan prioritas
4. Pertimbangkan regulasi dan standar Indonesia
5. Format output dengan jelas: masalah → analisis → rekomendasi
6. Proaktif identifikasi potensi masalah yang belum ditanyakan
7. Jika relevan, sarankan Mini App tertentu yang bisa membantu user mendalami atau menyelesaikan masalah. Contoh: "💡 Gunakan **Risk Register** untuk mendokumentasikan risiko ini secara terstruktur."`,
};

const EXPERT_SPECIALIST_PROMPTS: Record<string, string> = {
  regulasi: `Kamu adalah Pakar Regulasi Konstruksi Indonesia — spesialis hukum dan perizinan jasa konstruksi.

Keahlian utama:
- PP 22/2020 tentang Peraturan Pelaksanaan UU Jasa Konstruksi
- UU No. 2 Tahun 2017 tentang Jasa Konstruksi
- Permen PUPR terkait SBU, SBUJK, klasifikasi & kualifikasi
- Perizinan BUJK: NIB, SBU, IUJK, SIUJK
- LPJK, LKUT, PANCEK, dan persyaratan kepatuhan
- Kontrak konstruksi: FIDIC, standar kontrak Indonesia

Panduan:
1. Selalu sebutkan pasal/ayat regulasi spesifik yang relevan
2. Jelaskan implikasi praktis dari regulasi
3. Bandingkan regulasi lama vs baru jika relevan
4. Berikan contoh kasus penerapan
5. Format: regulasi → penjelasan → implikasi → saran praktis`,

  manpro: `Kamu adalah Pakar Manajemen Proyek Konstruksi — spesialis perencanaan dan pengendalian proyek.

Keahlian utama:
- Work Breakdown Structure (WBS) dan perencanaan proyek
- Scheduling: CPM, PERT, Gantt Chart, milestone
- Earned Value Management (EVM): CPI, SPI, EAC, ETC
- Cost control dan RAB (Rencana Anggaran Biaya)
- Manajemen mutu proyek konstruksi
- PMI PMBOK dan standar manajemen proyek Indonesia
- Pengadaan dan manajemen subkontraktor

Panduan:
1. Gunakan rumus dan kalkulasi konkret (EVM, produktivitas)
2. Berikan template dan framework yang bisa langsung digunakan
3. Sertakan contoh numerik dan studi kasus
4. Rekomendasikan tools dan teknik spesifik
5. Format: analisis situasi → metode → perhitungan → rekomendasi`,

  k3: `Kamu adalah Pakar K3 & Safety Konstruksi — spesialis keselamatan dan kesehatan kerja.

Keahlian utama:
- SMK3 (Sistem Manajemen K3) PP 50/2012
- ISO 45001:2018 Occupational Health and Safety
- Inspeksi keselamatan dan audit K3
- Identifikasi bahaya, penilaian risiko (HIRADC/IBPR)
- APD, prosedur kerja aman, permit to work
- Investigasi kecelakaan dan near-miss
- Regulasi K3 konstruksi: Permen PU, Permenaker

Panduan:
1. Prioritaskan keselamatan pekerja di atas segalanya
2. Berikan checklist dan SOP yang actionable
3. Sebutkan regulasi K3 spesifik yang berlaku
4. Jelaskan hierarki pengendalian risiko
5. Format: identifikasi bahaya → penilaian risiko → pengendalian → monitoring`,

  keuangan: `Kamu adalah Pakar Keuangan BUJK — spesialis manajemen keuangan badan usaha jasa konstruksi.

Keahlian utama:
- Laporan keuangan BUJK: neraca, laba/rugi, arus kas
- LKUT (Laporan Kinerja Usaha Tahunan) dan persyaratannya
- Rasio keuangan: likuiditas, solvabilitas, profitabilitas
- Perpajakan konstruksi: PPh Final 1.75%, PPN, PPh 23
- Cash flow proyek dan working capital management
- Audit keuangan dan kepatuhan BUJK
- Sumber pendanaan: bank garansi, surety bond, KMK

Panduan:
1. Gunakan contoh perhitungan numerik konkret
2. Berikan template analisis keuangan
3. Jelaskan implikasi pajak dari setiap keputusan
4. Hubungkan dengan persyaratan kualifikasi BUJK
5. Format: data keuangan → analisis rasio → interpretasi → rekomendasi`,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Rate limit
    const adminClient = createClient(supabaseUrl, serviceKey);
    const windowStart = new Date(Date.now() - 60 * 60000).toISOString();
    const { count } = await adminClient
      .from("rate_limits")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("action", "mentor_chat")
      .gte("created_at", windowStart);

    if ((count ?? 0) >= 30) {
      return new Response(JSON.stringify({ error: "Batas penggunaan tercapai. Coba lagi nanti." }), {
        status: 429, headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "3600" },
      });
    }
    await adminClient.from("rate_limits").insert({ user_id: user.id, action: "mentor_chat" });

    const { messages, mentorType, knowledgeBaseId, projectId, expertBotId } = await req.json();
    let systemPrompt = SYSTEM_PROMPTS[mentorType] || SYSTEM_PROMPTS.expert;
    
    // Use specialist prompt if expert bot selected
    if (mentorType === "expert" && expertBotId && expertBotId !== "orchestrator" && EXPERT_SPECIALIST_PROMPTS[expertBotId]) {
      systemPrompt = EXPERT_SPECIALIST_PROMPTS[expertBotId];
    }

    // Extract user's latest question for smart retrieval
    const lastUserMsg = [...(messages as Array<{ role: string; content: string }>)]
      .reverse()
      .find((message) => message.role === "user")?.content || "";
    const queryWords = lastUserMsg.toLowerCase().replace(/[^\w\s]/g, "").split(/\s+/).filter((w: string) => w.length > 2);

    // Build context based on mentor type
    let contextText = "";

    if ((mentorType === "learning" || mentorType === "project") && knowledgeBaseId) {
      // Fetch KB summary
      const { data: kb } = await adminClient
        .from("mentor_knowledge_bases")
        .select("summary, title")
        .eq("id", knowledgeBaseId)
        .single();

      // Fetch all chunks with summaries and keywords
      const { data: allChunks } = await adminClient
        .from("mentor_chunks")
        .select("content, summary, keywords, chunk_index")
        .eq("knowledge_base_id", knowledgeBaseId)
        .order("chunk_index", { ascending: true });

      if (allChunks?.length) {
        // Smart retrieval: score each chunk by keyword relevance
        const scored = allChunks.map(chunk => {
          const searchable = `${chunk.content} ${chunk.summary} ${chunk.keywords}`.toLowerCase();
          let score = 0;
          for (const word of queryWords) {
            if (searchable.includes(word)) score++;
          }
          // Boost chunks whose keywords match
          const kws = chunk.keywords.toLowerCase();
          for (const word of queryWords) {
            if (kws.includes(word)) score += 2;
          }
          return { ...chunk, score };
        });

        // Sort by relevance, take top 8
        scored.sort((a, b) => b.score - a.score);
        const relevant = scored.filter(c => c.score > 0).slice(0, 8);
        // If no keyword match, include first and last chunks for context
        const selected = relevant.length > 0
          ? relevant
          : allChunks.slice(0, 4);

        const label = mentorType === "learning" ? "KONTEN MODUL PEMBELAJARAN" : "DOKUMEN PROYEK";
        contextText = `\n\n=== ${label}: ${kb?.title || ""} ===\n`;

        // Include overall summary first
        if (kb?.summary) {
          contextText += `\n📋 RINGKASAN DOKUMEN:\n${kb.summary}\n\n`;
        }

        // Include chunk summaries overview
        const allSummaries = allChunks.filter(c => c.summary).map((c, i) => `${i + 1}. ${c.summary}`);
        if (allSummaries.length > 0) {
          contextText += `📑 OVERVIEW BAGIAN-BAGIAN:\n${allSummaries.join("\n")}\n\n`;
        }

        // Include detailed content of relevant chunks
        contextText += `📖 DETAIL KONTEN RELEVAN:\n`;
        for (const chunk of selected) {
          contextText += `\n--- Bagian ${chunk.chunk_index + 1} ---\n${chunk.content}\n`;
        }

        contextText += `\n=== AKHIR ${label} ===\n`;
      }
    }

    if (mentorType === "project" && projectId) {
      // Fetch project data
      const { data: project } = await adminClient
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .single();

      const { data: risks } = await adminClient
        .from("risk_registers")
        .select("*")
        .eq("project_id", projectId)
        .limit(10);

      const { data: budgets } = await adminClient
        .from("budget_entries")
        .select("*")
        .eq("project_id", projectId)
        .limit(10);

      const { data: k3 } = await adminClient
        .from("k3_checklists")
        .select("*")
        .eq("project_id", projectId)
        .limit(5);

      if (project) {
        contextText += `\n\n=== DATA PROYEK ===\nNama: ${project.name}\nLokasi: ${project.location}\nNilai: Rp ${Number(project.value_amount).toLocaleString("id-ID")}\nDurasi: ${project.duration_months} bulan\nStatus: ${project.status}\nKompleksitas: ${project.complexity_score}/100\nKelas Risiko: ${project.risk_class}\nTipe Kontrak: ${project.contract_type}\nBUJK: ${project.bujk_name}\n`;
      }

      if (risks?.length) {
        contextText += `\n--- RISIKO PROYEK ---\n` +
          risks.map(r => `• ${r.risk_description} (P:${r.probability_score} I:${r.impact_score}) - ${r.status} - Mitigasi: ${r.mitigation_action}`).join("\n");
      }

      if (budgets?.length) {
        contextText += `\n--- ANGGARAN ---\n` +
          budgets.map(b => `• ${b.category} [${b.period_month}]: Rencana ${Number(b.planned_amount).toLocaleString("id-ID")} vs Aktual ${Number(b.actual_amount).toLocaleString("id-ID")}`).join("\n");
      }

      if (k3?.length) {
        contextText += `\n--- K3 ---\n` +
          k3.map(c => `• ${c.location} [${c.inspection_date}]: ${c.completed_items}/${c.total_items} (${c.status})`).join("\n");
      }

      // Project brain documents are handled by the shared KB retrieval block above

      contextText += "\n=== AKHIR DATA PROYEK ===\n";
    }

    const fullSystemPrompt = systemPrompt + contextText;

    // Stream response
    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: fullSystemPrompt },
          ...messages,
        ],
        stream: true,
        max_tokens: 3000,
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, coba lagi nanti." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Kredit AI habis." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("mentor-chat error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
