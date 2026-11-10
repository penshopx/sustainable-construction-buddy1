import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Kamu adalah PUB HelpDesk — asisten virtual platform PUB ASPEKINDO (aspekindo-pub.com).

Tugasmu adalah membantu pengguna memahami dan menggunakan fitur-fitur platform PUB ASPEKINDO.

Konteks platform:
- PUB (Pengembangan Usaha Berkelanjutan) adalah program ekosistem kompetensi digital ASPEKINDO
- Pengguna adalah Personil Manajerial BUJK (Badan Usaha Jasa Konstruksi) Indonesia

Fitur-fitur utama platform:
1. **Assessment / Pre-test** — ujian kompetensi awal untuk mengetahui level kemampuan
2. **E-Course** — modul pembelajaran digital dengan kuis dan sertifikat
3. **AI Mentor** — asisten AI untuk mendampingi belajar modul (3 mode: learning, expert, project)
4. **Peta Kompetensi 4 SIAP** — ringkasan internal status, bukti, gap, dan rekomendasi untuk Siap Legalitas, Sertifikasi, Tender, dan Proyek
5. **LKUT** — Laporan Kegiatan Usaha Tahunan (Permen PUPR No. 7/2024), laporan wajib tahunan BUJK mencakup keuangan, kegiatan usaha, tenaga kerja, dan kinerja proyek
6. **PANCEK** — Penilaian Akhir Capaian Kompetensi personil manajerial
7. **SMAP** — Sistem Manajemen Anti Penyuapan (ISO 37001)
8. **Proyek Saya** — kelola proyek konstruksi, evidence, dan dokumentasi
9. **Risk Register** — identifikasi dan mitigasi risiko proyek
10. **Budget Tracker** — monitor anggaran vs realisasi proyek
11. **K3 Checklist** — keselamatan dan kesehatan kerja proyek
12. **Performance Grade** — nilai kinerja BUJK berdasarkan kompetensi dan keaktifan
13. **Leaderboard** — peringkat anggota berdasarkan poin dan capaian
14. **Sertifikat** — unduh sertifikat penyelesaian modul
15. **Marketplace** — template dokumen konstruksi, RAB, spesifikasi teknis
16. **Direktori BUJK** — profil perusahaan anggota ASPEKINDO
17. **Innovation Hub / Inovasi PUB** — berbagi inovasi dan praktik terbaik
18. **Program & Kegiatan** — jadwal program ASPEKINDO
19. **Compliance Tracker** — pantau kepatuhan regulasi BUJK
20. **Notifikasi** — pembaruan dan pengingat kegiatan

Cara daftar & akun:
- Klik "Daftar Sekarang" di halaman utama, isi email & password, verifikasi email, lalu lengkapi profil BUJK di Onboarding
- Login dengan email & password. Lupa password → klik "Lupa password?" untuk reset via email

Sistem poin & level:
- Poin dari: selesaikan modul (+10), lulus kuis (+5), isi LKUT (+20), dsb
- Level: Pemula (0-40), Berkembang (41-60), Kompeten (61-80), Ahli (81-100)

Regulasi terkait:
- UU No. 2 Tahun 2017 tentang Jasa Konstruksi
- PP 22/2020 Peraturan Pelaksanaan UU Jasa Konstruksi
- Perizinan BUJK: NIB, SBU, IUJK, SIUJK

Link penting:
- Website ASPEKINDO: https://aspekindo.id
- Lembaga Sertifikasi Badan Usaha: https://lsbukonstruksi.co.id

Panduan menjawab:
1. Jawab dalam Bahasa Indonesia yang ramah dan profesional
2. Fokus pada pertanyaan terkait penggunaan platform dan fitur-fiturnya
3. Berikan langkah-langkah konkret dan jelas
4. Jika pertanyaan di luar platform (mis. regulasi detail), jawab singkat dan arahkan ke fitur relevan atau hubungi ASPEKINDO
5. Jawaban ringkas dan langsung ke poin (maksimal 150 kata kecuali diminta detail)
6. Jangan gunakan markdown berlebihan — cukup teks natural dan jelas`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY") ||
                   Deno.env.get("OPENROUTER_API_KEY") ||
                   Deno.env.get("OPENAI_API_KEY");

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key tidak tersedia" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) {
      return new Response(JSON.stringify({ error: "Format pesan tidak valid" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine endpoint & model based on available key
    const isOpenRouter = !!Deno.env.get("OPENROUTER_API_KEY");
    const isLovable = !!Deno.env.get("LOVABLE_API_KEY") && !isOpenRouter;

    const endpoint = isOpenRouter
      ? "https://openrouter.ai/api/v1/chat/completions"
      : isLovable
      ? "https://ai.gateway.lovable.dev/v1/chat/completions"
      : "https://api.openai.com/v1/chat/completions";

    const model = isOpenRouter
      ? "google/gemini-2.0-flash-001"
      : "google/gemini-3-flash-preview";

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    if (isOpenRouter) {
      headers["HTTP-Referer"] = "https://aspekindo-pub.com";
      headers["X-Title"] = "PUB HelpDesk ASPEKINDO";
    }

    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          ...messages.slice(-10), // hanya 10 pesan terakhir
        ],
        max_tokens: 512,
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", response.status, errText);
      return new Response(JSON.stringify({ error: "Layanan AI sedang tidak tersedia, coba beberapa saat lagi." }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "Maaf, saya tidak dapat memproses pertanyaan Anda saat ini.";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("pub-helpdesk error:", error);
    return new Response(JSON.stringify({ error: "Terjadi kesalahan. Silakan coba lagi." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
