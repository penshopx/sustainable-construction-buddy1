import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function callAI(apiKey: string, prompt: string, maxTokens = 1500): Promise<string> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.3,
    }),
  });
  if (!resp.ok) return "";
  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "";
}

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

    const userClient = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { knowledgeBaseId } = await req.json();
    if (!knowledgeBaseId) {
      return new Response(JSON.stringify({ error: "Missing knowledgeBaseId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    const { data: kb, error: kbError } = await adminClient
      .from("mentor_knowledge_bases")
      .select("*")
      .eq("id", knowledgeBaseId)
      .eq("user_id", user.id)
      .single();

    if (kbError || !kb) {
      return new Response(JSON.stringify({ error: "Knowledge base not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await adminClient.from("mentor_knowledge_bases").update({ status: "processing" }).eq("id", knowledgeBaseId);

    // Download file
    const filePath = kb.file_url.replace(/^.*\/storage\/v1\/object\/public\//, "").replace(/^mentor-uploads\//, "");
    const { data: fileData, error: dlError } = await adminClient.storage.from("mentor-uploads").download(filePath);

    if (dlError || !fileData) {
      await adminClient.from("mentor_knowledge_bases").update({ status: "error" }).eq("id", knowledgeBaseId);
      return new Response(JSON.stringify({ error: "Failed to download file" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract text
    let textContent = "";
    const fileType = kb.file_type || "";

    if (fileType.includes("text") || kb.file_name.endsWith(".txt") || kb.file_name.endsWith(".md")) {
      textContent = await fileData.text();
    } else if (apiKey) {
      // Use AI for non-text files (PDF, DOC, etc.)
      const arrayBuffer = await fileData.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
      const base64 = btoa(binary);

      textContent = await callAI(apiKey,
        `Ekstrak seluruh teks dari dokumen ini secara lengkap dan terstruktur. Pertahankan heading, sub-heading, dan struktur paragraf. Jangan tambahkan komentar apapun, kembalikan hanya konten dokumen.\n\n[Dokumen dalam format ${fileType}, nama file: ${kb.file_name}]`,
        8000
      );

      // If AI extraction failed, try as text
      if (!textContent) {
        try { textContent = await new Response(fileData).text(); } catch { textContent = ""; }
      }
    }

    if (!textContent) {
      await adminClient.from("mentor_knowledge_bases").update({ status: "error" }).eq("id", knowledgeBaseId);
      return new Response(JSON.stringify({ error: "Gagal mengekstrak teks dari dokumen" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Chunk the text
    const chunks = chunkText(textContent, 800, 100);

    // Delete existing chunks
    await adminClient.from("mentor_chunks").delete().eq("knowledge_base_id", knowledgeBaseId);

    // Generate summaries and keywords per chunk using AI
    const chunkRows = [];
    
    if (apiKey && chunks.length > 0) {
      // Process chunks in batches of 5 for efficiency
      for (let batchStart = 0; batchStart < chunks.length; batchStart += 5) {
        const batch = chunks.slice(batchStart, batchStart + 5);
        const batchPromises = batch.map(async (content, batchIdx) => {
          const idx = batchStart + batchIdx;
          const aiResult = await callAI(apiKey,
            `Analisis teks berikut dan berikan output dalam format TEPAT ini:

RINGKASAN: [Ringkasan 1-2 kalimat padat dari isi teks]
KATA_KUNCI: [5-10 kata kunci utama, dipisahkan koma]

Teks:
"""
${content.slice(0, 2000)}
"""`,
            300
          );

          let summary = "";
          let keywords = "";

          if (aiResult) {
            const summaryMatch = aiResult.match(/RINGKASAN:\s*(.+?)(?:\n|KATA_KUNCI)/s);
            const keywordsMatch = aiResult.match(/KATA_KUNCI:\s*(.+)/s);
            summary = summaryMatch?.[1]?.trim() || "";
            keywords = keywordsMatch?.[1]?.trim() || "";
          }

          return {
            knowledge_base_id: knowledgeBaseId,
            user_id: user.id,
            chunk_index: idx,
            content,
            summary,
            keywords,
            metadata: { source: kb.file_name, index: idx, total: chunks.length },
          };
        });

        const results = await Promise.all(batchPromises);
        chunkRows.push(...results);
      }
    } else {
      // Fallback without AI summaries
      for (let i = 0; i < chunks.length; i++) {
        chunkRows.push({
          knowledge_base_id: knowledgeBaseId,
          user_id: user.id,
          chunk_index: i,
          content: chunks[i],
          summary: "",
          keywords: "",
          metadata: { source: kb.file_name, index: i, total: chunks.length },
        });
      }
    }

    // Insert chunks
    if (chunkRows.length > 0) {
      await adminClient.from("mentor_chunks").insert(chunkRows);
    }

    // Generate overall document summary
    let overallSummary = "";
    if (apiKey) {
      const chunkSummaries = chunkRows
        .filter(c => c.summary)
        .map((c, i) => `Bagian ${i + 1}: ${c.summary}`)
        .join("\n");

      const summaryInput = chunkSummaries || textContent.slice(0, 4000);

      overallSummary = await callAI(apiKey,
        `Buatkan ringkasan komprehensif dari dokumen "${kb.title}" berdasarkan informasi berikut. Ringkasan harus mencakup:
1. Tema/topik utama dokumen
2. Poin-poin kunci (3-7 poin)
3. Kesimpulan atau takeaway utama

Format dalam Bahasa Indonesia yang jelas dan terstruktur dengan markdown.

Informasi dokumen:
${summaryInput}`,
        1000
      );
    }

    // Update KB status
    await adminClient.from("mentor_knowledge_bases").update({
      status: "ready",
      chunk_count: chunks.length,
      summary: overallSummary,
    }).eq("id", knowledgeBaseId);

    return new Response(JSON.stringify({ success: true, chunkCount: chunks.length, hasSummary: !!overallSummary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("mentor-extract error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function chunkText(text: string, chunkSize: number, overlap: number): string[] {
  if (!text || text.length === 0) return [];

  const chunks: string[] = [];
  const paragraphs = text.split(/\n\n+/);
  let current = "";

  for (const para of paragraphs) {
    if (current.length + para.length > chunkSize && current.length > 0) {
      chunks.push(current.trim());
      const overlapText = current.slice(-overlap);
      current = overlapText + "\n\n" + para;
    } else {
      current += (current ? "\n\n" : "") + para;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  // Split oversized single chunks by sentences
  if (chunks.length === 1 && chunks[0].length > chunkSize * 2) {
    const sentences = chunks[0].split(/(?<=[.!?])\s+/);
    const newChunks: string[] = [];
    let cur = "";
    for (const s of sentences) {
      if (cur.length + s.length > chunkSize && cur) {
        newChunks.push(cur.trim());
        cur = cur.slice(-overlap) + " " + s;
      } else {
        cur += (cur ? " " : "") + s;
      }
    }
    if (cur.trim()) newChunks.push(cur.trim());
    return newChunks;
  }

  return chunks;
}
