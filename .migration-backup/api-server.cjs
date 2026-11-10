const express = require("express");
const cors = require("cors");
const { KEPDIRJEN_281_AI_CONTEXT } = require("./chatbot-knowledge.cjs");
const { createPublicChatRateLimiter } = require("./public-chat-rate-limit.cjs");

const app = express();
app.set("trust proxy", 1);
app.use(cors());
app.use(express.json());

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini";

const WEB_SOURCES = [
  "aspekindo.id",
  "lsbukonstruksi.co.id",
  "lpjk.pu.go.id",
  "pu.go.id",
  "lkpp.go.id",
  "spse.inaproc.id",
  "konstruksimedia.com",
  "indokontraktor.com",
  "mediakonstruksi.id",
  "konstruksinews.id",
  "cnbcindonesia.com",
  "topkonstruksi.com",
  "infoinfrastruktur.com",
  "tekniksipil.id",
];

const SYSTEM_PROMPT = `Kamu adalah PUB HelpDesk — asisten virtual platform PUB ASPEKINDO (aspekindo-pub.com).

Tugasmu adalah membantu pengguna memahami dan menggunakan fitur-fitur platform PUB ASPEKINDO, serta menjawab pertanyaan seputar regulasi dan kebijakan konstruksi Indonesia.

Sumber informasi prioritas:
1. aspekindo.id — website resmi ASPEKINDO
2. lsbukonstruksi.co.id — Lembaga Sertifikasi Badan Usaha Konstruksi
3. lpjk.pu.go.id — Lembaga Pengembangan Jasa Konstruksi
4. pu.go.id — Kementerian PUPR
5. lkpp.go.id — Lembaga Kebijakan Pengadaan Barang/Jasa Pemerintah

Konteks platform:
- PUB (Pengembangan Usaha Berkelanjutan) adalah program ekosistem kompetensi digital ASPEKINDO
- Pengguna adalah Personil Manajerial BUJK (Badan Usaha Jasa Konstruksi) Indonesia

Fitur-fitur utama platform:
1. Assessment / Pre-test — ujian kompetensi awal untuk mengetahui level kemampuan
2. E-Course — modul pembelajaran digital dengan kuis dan sertifikat
3. AI Mentor — asisten AI untuk mendampingi belajar modul (3 mode: learning, expert, project)
4. Gustafta Socratic Dialog — AI khusus untuk memetakan problem BUJK dan menghasilkan Blue Print Potensi Diri
5. LKUT — Laporan Kegiatan Usaha Tahunan (Permen PUPR No. 7/2024), laporan wajib tahunan BUJK mencakup keuangan, kegiatan usaha, tenaga kerja, dan kinerja proyek
6. PANCEK — Penilaian Akhir Capaian Kompetensi personil manajerial
7. SMAP — Sistem Manajemen Anti Penyuapan (ISO 37001)
8. Proyek Saya — kelola proyek konstruksi, evidence, dan dokumentasi
9. Risk Register — identifikasi dan mitigasi risiko proyek
10. Budget Tracker — monitor anggaran vs realisasi proyek
11. K3 Checklist — keselamatan dan kesehatan kerja proyek
12. Performance Grade — nilai kinerja BUJK berdasarkan kompetensi dan keaktifan
13. Leaderboard — peringkat anggota berdasarkan poin dan capaian
14. Sertifikat — unduh sertifikat penyelesaian modul
15. Marketplace — template dokumen konstruksi, RAB, spesifikasi teknis
16. Direktori BUJK — profil perusahaan anggota ASPEKINDO
17. Innovation Hub / Inovasi PUB — berbagi inovasi dan praktik terbaik
18. Program & Kegiatan — jadwal program ASPEKINDO

Sistem poin & level:
- Poin dari: selesaikan modul (+10), lulus kuis (+5), isi LKUT (+20), dsb
- Level: Pemula (0-40), Berkembang (41-60), Kompeten (61-80), Ahli (81-100)

${KEPDIRJEN_281_AI_CONTEXT}

Panduan menjawab:
1. Jawab dalam Bahasa Indonesia yang ramah dan profesional
2. Jika konteks web disediakan, gunakan informasi itu sebagai dasar jawaban dan sebutkan sumbernya
3. Berikan langkah-langkah konkret dan jelas
4. Jawaban ringkas dan langsung ke poin (maksimal 200 kata kecuali diminta detail)
5. Jika tidak yakin, sarankan pengguna cek langsung ke sumber resmi`;

async function searchWebSources(query) {
  const siteFilter = WEB_SOURCES.map(s => `site:${s}`).join(" OR ");
  const q = encodeURIComponent(`${query} (${siteFilter})`);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);

  try {
    const res = await fetch(`https://html.duckduckgo.com/html/?q=${q}`, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; PUBHelpDesk/1.0)",
        "Accept": "text/html,application/xhtml+xml",
        "Accept-Language": "id-ID,id;q=0.9,en;q=0.8",
      },
    });
    clearTimeout(timeoutId);

    if (!res.ok) return null;

    const html = await res.text();

    const results = [];

    // Extract result URLs + snippets from DuckDuckGo HTML
    const resultBlockRegex = /<div class="result[^"]*"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/g;
    const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([\s\S]*?)<\/a>/;
    const titleRegex = /<a[^>]*class="result__a"[^>]*>([\s\S]*?)<\/a>/;
    const urlRegex = /result__url[^>]*>([\s\S]*?)<\/a>/;

    let block;
    while ((block = resultBlockRegex.exec(html)) !== null && results.length < 5) {
      const snippetMatch = snippetRegex.exec(block[1]);
      const titleMatch = titleRegex.exec(block[1]);
      const urlMatch = urlRegex.exec(block[1]);

      const snippet = snippetMatch ? snippetMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      const title = titleMatch ? titleMatch[1].replace(/<[^>]+>/g, "").trim() : "";
      const url = urlMatch ? urlMatch[1].replace(/<[^>]+>/g, "").trim() : "";

      if (snippet.length > 30 && url) {
        results.push({ title, snippet, url });
      }
    }

    // Fallback: simpler regex if block regex found nothing
    if (results.length === 0) {
      const simpleSnippetRegex = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
      let m;
      while ((m = simpleSnippetRegex.exec(html)) !== null && results.length < 5) {
        const text = m[1].replace(/<[^>]+>/g, "").trim();
        if (text.length > 30) results.push({ snippet: text, url: "", title: "" });
      }
    }

    if (results.length === 0) return null;

    const context = results
      .map((r, i) => `[${i + 1}] ${r.title ? r.title + " — " : ""}${r.snippet}${r.url ? "\nSumber: " + r.url : ""}`)
      .join("\n\n");

    return context;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name !== "AbortError") console.error("Web search error:", err.message);
    return null;
  }
}

const PUBLIC_CHATBOT_SELECT = "id,name,description,avatar_url,mode,welcome_message,is_public,persona";
const publicChatRateLimiter = createPublicChatRateLimiter();

function isValidShareToken(token) {
  return typeof token === "string" && /^[A-Za-z0-9_-]{8,80}$/.test(token);
}

function exceedsPublicChatRateLimit(req) {
  return publicChatRateLimiter.exceedsLimit(req.ip);
}

async function findSharedChatbot(token) {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Konfigurasi server chatbot publik belum tersedia.");
  }

  const query = new URLSearchParams({
    select: PUBLIC_CHATBOT_SELECT,
    share_token: `eq.${token}`,
    limit: "1",
  });
  const response = await fetch(`${SUPABASE_URL}/rest/v1/custom_chatbots?${query}`, {
    headers: {
      apikey: SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
    },
  });
  if (!response.ok) {
    console.error("Public chatbot lookup error:", response.status, await response.text());
    throw new Error("Gagal memuat chatbot.");
  }
  const rows = await response.json();
  return Array.isArray(rows) ? rows[0] : null;
}

function toPublicChatbot(bot) {
  if (!bot) return null;
  return {
    id: bot.id,
    name: bot.name,
    description: bot.description,
    avatar_url: bot.avatar_url,
    mode: bot.mode,
    welcome_message: bot.welcome_message,
  };
}

function extractAiReply(rawBody) {
  let reply = "";
  for (const line of rawBody.split(/\r?\n/)) {
    if (!line.startsWith("data: ")) continue;
    const json = line.slice(6).trim();
    if (!json || json === "[DONE]") continue;
    try {
      const parsed = JSON.parse(json);
      const content = parsed?.choices?.[0]?.delta?.content;
      if (typeof content === "string") reply += content;
    } catch {
      // Ignore incomplete or non-JSON SSE lines.
    }
  }
  if (reply) return reply;
  try {
    const parsed = JSON.parse(rawBody);
    return parsed?.choices?.[0]?.message?.content || parsed?.reply || "";
  } catch {
    return "";
  }
}

async function requestPublicChatbotAi(bot, messages) {
  if (!OPENROUTER_API_KEY) {
    return { reply: "", error: "OPENROUTER_API_KEY belum dikonfigurasi di server." };
  }

  const persona = typeof bot.persona === "string" ? bot.persona.trim().slice(0, 6000) : "";
  const systemContent = [
    SYSTEM_PROMPT,
    `\nKamu sekarang berbicara sebagai chatbot publik bernama "${bot.name || "Chatbot"}".`,
    bot.description ? `Deskripsi chatbot: ${String(bot.description).slice(0, 1000)}` : "",
    `Mode chatbot: ${bot.mode || "pembelajaran"}.`,
    persona ? `Persona dan instruksi pemilik chatbot:\n${persona}` : "",
    "\nJangan mengaku memiliki akses ke data privat, riwayat dashboard, atau identitas pengunjung. Jawab hanya berdasarkan konteks yang tersedia.",
  ].filter(Boolean).join("\n");

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENROUTER_API_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://aspekindo-pub.com",
      "X-Title": "PUB ASPEKINDO Public Chatbot",
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [{ role: "system", content: systemContent }, ...messages],
      temperature: 0.3,
      max_tokens: 500,
    }),
  });
  const rawBody = await response.text();
  if (!response.ok) {
    return { reply: "", error: `OpenRouter ${response.status}: ${rawBody.slice(0, 500)}` };
  }
  return { reply: extractAiReply(rawBody), error: "" };
}

app.get("/api/public-chatbots/:token", async (req, res) => {
  const { token } = req.params;
  if (!isValidShareToken(token)) return res.status(404).json({ error: "Chatbot tidak ditemukan." });

  try {
    const bot = await findSharedChatbot(token);
    if (!bot) return res.status(404).json({ error: "Chatbot tidak ditemukan atau link sudah tidak berlaku." });
    res.json(toPublicChatbot(bot));
  } catch (error) {
    console.error("Public chatbot error:", error);
    res.status(503).json({ error: "Layanan chatbot publik belum tersedia." });
  }
});

app.post("/api/public-chatbots/:token/chat", async (req, res) => {
  const { token } = req.params;
  if (!isValidShareToken(token)) return res.status(404).json({ error: "Chatbot tidak ditemukan." });
  const incomingMessages = req.body?.messages;
  if (!Array.isArray(incomingMessages) || incomingMessages.length === 0) {
    return res.status(400).json({ error: "Format pesan tidak valid." });
  }
  const messages = incomingMessages
    .filter((message) =>
      message &&
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string" &&
      message.content.trim().length > 0
    )
    .slice(-10)
    .map((message) => ({ role: message.role, content: message.content.trim().slice(0, 4000) }));
  if (!messages.length) return res.status(400).json({ error: "Pesan tidak valid." });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(503).json({ error: "Layanan chatbot publik belum tersedia." });
  }

  try {
    const bot = await findSharedChatbot(token);
    if (!bot) return res.status(404).json({ error: "Chatbot tidak ditemukan atau link sudah tidak berlaku." });
    if (exceedsPublicChatRateLimit(req)) {
      return res.status(429).json({ error: "Terlalu banyak pesan. Silakan coba lagi beberapa menit lagi." });
    }

    const aiResult = await requestPublicChatbotAi(bot, messages);
    if (aiResult.error) {
      console.error("Public chatbot AI error:", aiResult.error);
      return res.status(503).json({
        error: "Layanan AI chatbot sedang tidak tersedia. Silakan coba lagi nanti.",
        degraded: true,
      });
    }
    const reply = aiResult.reply;
    if (!reply) {
      return res.status(503).json({
        error: "Layanan AI chatbot tidak mengembalikan jawaban. Silakan coba lagi nanti.",
        degraded: true,
      });
    }
    res.json({ reply });
  } catch (error) {
    console.error("Public chatbot chat error:", error);
    res.status(502).json({ error: "Gagal memproses pesan. Silakan coba lagi." });
  }
});

app.post("/api/helpdesk", async (req, res) => {
  try {
    const apiKey = process.env.OPENROUTER_API_KEY ||
                   process.env.OPENAI_API_KEY ||
                   process.env.DEEPSEEK_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "API key tidak tersedia di server." });
    }

    const { messages } = req.body;
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Format pesan tidak valid." });
    }

    // Ambil pertanyaan terakhir dari user untuk web search
    const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
    const userQuery = lastUserMsg?.content || "";

    // Cari di web sumber resmi dulu
    let webContext = null;
    if (userQuery.length > 5) {
      webContext = await searchWebSources(userQuery);
      if (webContext) console.log(`[web] Found ${webContext.split("\n\n").length} result(s) for: "${userQuery.slice(0,50)}"`);
    }

    // Buat system prompt — sisipkan konteks web jika ada
    const systemContent = webContext
      ? `${SYSTEM_PROMPT}\n\n---\nINFORMASI DARI SUMBER WEB RESMI (gunakan sebagai referensi utama jawaban):\n${webContext}\n---`
      : SYSTEM_PROMPT;

    const isOpenRouter = !!process.env.OPENROUTER_API_KEY;
    const isDeepSeek = !!process.env.DEEPSEEK_API_KEY && !isOpenRouter;

    const endpoint = isOpenRouter
      ? "https://openrouter.ai/api/v1/chat/completions"
      : isDeepSeek
      ? "https://api.deepseek.com/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";

    const model = isOpenRouter
      ? "openai/gpt-4o-mini"
      : isDeepSeek
      ? "deepseek-chat"
      : "gpt-4o-mini";

    const headers = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (isOpenRouter) {
      headers["HTTP-Referer"] = "https://aspekindo-pub.com";
      headers["X-Title"] = "PUB HelpDesk ASPEKINDO";
    }

    const aiRes = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemContent },
          ...messages.slice(-10),
        ],
        max_tokens: 600,
        temperature: 0.4,
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("AI error:", aiRes.status, errText);
      return res.status(500).json({ error: "Layanan AI sedang tidak tersedia, coba beberapa saat lagi." });
    }

    const data = await aiRes.json();
    const reply = data.choices?.[0]?.message?.content ||
      "Maaf, saya tidak dapat memproses pertanyaan Anda saat ini.";

    res.json({ reply, webUsed: !!webContext });
  } catch (err) {
    console.error("helpdesk error:", err);
    res.status(500).json({ error: "Terjadi kesalahan. Silakan coba lagi." });
  }
});

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));

const PORT = process.env.API_PORT || 3001;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`API server running on port ${PORT}`);
  console.log(`Web sources: ${WEB_SOURCES.join(", ")}`);
});
