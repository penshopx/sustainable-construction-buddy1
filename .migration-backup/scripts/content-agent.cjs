const crypto = require("node:crypto");
const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const force = process.argv.includes("--force");

if (!supabaseUrl || !serviceRoleKey) {
  console.error("[content-agent] SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib tersedia.");
  process.exit(1);
}

class DisabledRealtimeTransport {}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { transport: DisabledRealtimeTransport },
});

const MAX_LINKS_PER_SOURCE = 5;
const MAX_TEXT_LENGTH = 12000;
const FETCH_TIMEOUT_MS = 15000;
const NEWS_PATH_PATTERN = /(berita|news|siaran-pers|pengumuman|regulasi|informasi|publikasi|artikel|agenda|kegiatan)/i;

function decodeEntities(value) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

function cleanText(value) {
  return decodeEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  ).slice(0, MAX_TEXT_LENGTH);
}

function extractMeta(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=[\"']${escaped}[\"'][^>]+content=[\"']([^\"']+)[\"']`, "i"),
    new RegExp(`<meta[^>]+content=[\"']([^\"']+)[\"'][^>]+(?:property|name)=[\"']${escaped}[\"']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match) return cleanText(match[1]);
  }
  return "";
}

function extractTitle(html) {
  return extractMeta(html, "og:title") || cleanText(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || "");
}

function extractDescription(html) {
  const description = extractMeta(html, "description") || extractMeta(html, "og:description");
  if (description.length >= 50) return description.slice(0, 700);
  const text = cleanText(html);
  return text.slice(0, 700);
}

function extractPublishedAt(html) {
  const value = extractMeta(html, "article:published_time")
    || extractMeta(html, "datePublished")
    || extractMeta(html, "date");
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function isAllowedUrl(value, domain) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && (url.hostname === domain || url.hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

function canonicalize(value) {
  const url = new URL(value);
  url.hash = "";
  ["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"].forEach((key) => url.searchParams.delete(key));
  return url.toString().replace(/\/$/, "");
}

function discoverLinks(html, baseUrl, domain) {
  const candidates = [];
  const hrefPattern = /<a[^>]+href=[\"']([^\"'#]+)[\"']/gi;
  let match;
  while ((match = hrefPattern.exec(html))) {
    try {
      const url = canonicalize(new URL(match[1], baseUrl).toString());
      if (isAllowedUrl(url, domain) && NEWS_PATH_PATTERN.test(new URL(url).pathname)) candidates.push(url);
    } catch {
      // Invalid links are ignored; source content is treated strictly as data.
    }
  }
  return Array.from(new Set(candidates)).slice(0, MAX_LINKS_PER_SOURCE);
}

function hash(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function slugify(value, suffix) {
  const base = value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 78) || "informasi";
  return `${base}-${suffix.slice(0, 8)}`;
}

function classifyTopic(value) {
  const text = value.toLowerCase();
  if (/(tender|pengadaan|lelang|lkpp)/.test(text)) return "Tender";
  if (/(sertifikasi|sbu|skk|kompetensi|lpjk)/.test(text)) return "Sertifikasi";
  if (/(k3|keselamatan|kesehatan kerja)/.test(text)) return "K3";
  if (/(digital|teknologi|bim|inovasi)/.test(text)) return "Teknologi";
  if (/(peraturan|regulasi|undang-undang|permen|keputusan)/.test(text)) return "Regulasi";
  return "Kebijakan";
}

async function fetchWithRetry(url, allowedDomain) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      let currentUrl = canonicalize(url);
      for (let redirectCount = 0; redirectCount <= 5; redirectCount += 1) {
        if (!isAllowedUrl(currentUrl, allowedDomain)) throw new Error("Redirect keluar dari domain sumber yang diizinkan");
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
        const response = await fetch(currentUrl, {
          signal: controller.signal,
          redirect: "manual",
          headers: {
            "user-agent": "PUB-ASPEKINDO-Information-Monitor/1.0 (+https://aspekindo-pub.com/informasi)",
            accept: "text/html,application/xhtml+xml",
          },
        });
        clearTimeout(timer);
        if (response.status >= 300 && response.status < 400) {
          const location = response.headers.get("location");
          if (!location) throw new Error(`Redirect HTTP ${response.status} tanpa tujuan`);
          currentUrl = canonicalize(new URL(location, currentUrl).toString());
          continue;
        }
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const contentType = response.headers.get("content-type") || "";
        if (!contentType.includes("text/html")) throw new Error(`Tipe konten tidak didukung: ${contentType}`);
        return { html: await response.text(), finalUrl: currentUrl };
      }
      throw new Error("Terlalu banyak redirect");
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 1200));
    }
  }
  throw lastError;
}

async function createRun(agentName, values = {}) {
  const { data, error } = await supabase
    .from("information_agent_runs")
    .insert({ agent_name: agentName, status: "running", ...values })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

async function finishRun(id, status, values = {}) {
  const { error } = await supabase
    .from("information_agent_runs")
    .update({ status, completed_at: new Date().toISOString(), ...values })
    .eq("id", id);
  if (error) throw error;
}

async function logCompletedStage(agentName, found, created, metadata = {}) {
  const id = await createRun(agentName);
  await finishRun(id, "completed", { items_found: found, items_created: created, metadata });
}

async function processCandidate(source, url, html, runId) {
  const title = extractTitle(html).slice(0, 220);
  const excerpt = extractDescription(html);
  if (title.length < 12 || excerpt.length < 50) return { skipped: true };

  const fetchedContent = cleanText(html);
  const contentHash = hash(`${title}\n${excerpt}\n${fetchedContent.slice(0, 6000)}`);
  const { data: existing } = await supabase
    .from("information_candidates")
    .select("id, content_hash, article_id")
    .eq("canonical_url", url)
    .maybeSingle();

  if (existing?.content_hash === contentHash) {
    await supabase
      .from("information_candidates")
      .update({ status: "duplicate", last_fetched_at: new Date().toISOString(), agent_run_id: runId })
      .eq("id", existing.id);
    return { duplicate: true };
  }

  const topic = classifyTopic(`${title} ${excerpt}`);
  const publishedAt = extractPublishedAt(html);
  const body = [
    "## Ringkasan sumber",
    "",
    excerpt,
    "",
    "## Dampak bagi BUJK",
    "",
    "Kandidat ini dikumpulkan dari sumber resmi dan perlu diperiksa editor PUB sebelum dipublikasikan. Pastikan implikasi, tanggal berlaku, dan langkah tindak lanjut telah sesuai dengan dokumen sumber.",
    "",
    "## Rujukan",
    "",
    `[Buka sumber resmi](${url})`,
  ].join("\n");

  const articlePayload = {
      channel: "industry",
      title,
      slug: slugify(title, contentHash),
      summary: excerpt,
      body,
      topic,
      source_id: source.id,
      source_url: url,
      source_title: source.name,
      source_published_at: publishedAt,
      source_updated_at: new Date().toISOString(),
      status: "review",
      agent_run_id: runId,
      content_hash: contentHash,
  };

  const articleResult = existing?.article_id
    ? await supabase
      .from("information_articles")
      .update({
        ...articlePayload,
        approved_by: null,
        approved_at: null,
        scheduled_at: null,
        published_at: null,
      })
      .eq("id", existing.article_id)
      .select("id")
      .single()
    : await supabase
      .from("information_articles")
      .insert(articlePayload)
      .select("id")
      .single();

  if (articleResult.error) {
    if (articleResult.error.code === "23505") return { duplicate: true };
    throw articleResult.error;
  }
  const article = articleResult.data;

  const candidatePayload = {
    source_id: source.id,
    canonical_url: url,
    title,
    excerpt,
    fetched_content: fetchedContent,
    content_hash: contentHash,
    status: "drafted",
    article_id: article.id,
    last_fetched_at: new Date().toISOString(),
    last_error: null,
    agent_run_id: runId,
  };

  const candidateResult = existing
    ? await supabase.from("information_candidates").update(candidatePayload).eq("id", existing.id)
    : await supabase.from("information_candidates").insert(candidatePayload);
  if (candidateResult.error) throw candidateResult.error;
  return { created: true, changed: Boolean(existing) };
}

async function main() {
  const scoutRunId = await createRun("scout", { metadata: { mode: force ? "force" : "scheduled" } });
  let found = 0;
  let created = 0;
  let duplicates = 0;
  let changed = 0;
  let failures = 0;

  try {
    const { data: sources, error } = await supabase
      .from("information_sources")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (error) throw error;

    for (const source of sources) {
      const dueAt = source.last_checked_at
        ? new Date(source.last_checked_at).getTime() + source.check_interval_minutes * 60000
        : 0;
      if (!force && dueAt > Date.now()) continue;

      try {
        if (source.domain === "aspekindo.id") {
          await supabase
            .from("information_sources")
            .update({
              last_checked_at: new Date().toISOString(),
              last_success_at: new Date().toISOString(),
              last_error: null,
            })
            .eq("id", source.id);
          continue;
        }
        const homepageResponse = await fetchWithRetry(source.base_url, source.domain);
        const links = discoverLinks(homepageResponse.html, homepageResponse.finalUrl, source.domain);
        found += links.length;
        for (const link of links) {
          try {
            const pageResponse = await fetchWithRetry(link, source.domain);
            const result = await processCandidate(source, pageResponse.finalUrl, pageResponse.html, scoutRunId);
            if (result.created) created += 1;
            if (result.changed) changed += 1;
            if (result.duplicate) duplicates += 1;
          } catch (candidateError) {
            failures += 1;
            const { error: auditError } = await supabase
              .from("information_candidates")
              .upsert({
                source_id: source.id,
                canonical_url: link,
                status: "failed",
                last_fetched_at: new Date().toISOString(),
                last_error: candidateError.message.slice(0, 1000),
                agent_run_id: scoutRunId,
              }, { onConflict: "canonical_url" });
            if (auditError) console.error(`[content-agent] audit ${link}: ${auditError.message}`);
            console.error(`[content-agent] ${link}: ${candidateError.message}`);
          }
        }
        await supabase
          .from("information_sources")
          .update({
            last_checked_at: new Date().toISOString(),
            last_success_at: new Date().toISOString(),
            last_error: null,
          })
          .eq("id", source.id);
      } catch (sourceError) {
        failures += 1;
        await supabase
          .from("information_sources")
          .update({ last_checked_at: new Date().toISOString(), last_error: sourceError.message.slice(0, 500) })
          .eq("id", source.id);
        console.error(`[content-agent] ${source.name}: ${sourceError.message}`);
      }
    }

    await finishRun(scoutRunId, failures > 0 ? "partial" : "completed", {
      items_found: found,
      items_created: created,
      metadata: { duplicates, failures },
    });
    await logCompletedStage("verifier", found, Math.max(0, found - failures), { allowed_sources_only: true });
    await logCompletedStage("editor", created, created, { publication_status: "review" });
    await logCompletedStage("curator", created, created, { topics_assigned: true });
    const { data: publishedCount, error: publishError } = await supabase.rpc("publish_due_information_articles");
    if (publishError) throw publishError;
    await logCompletedStage("publisher", publishedCount || 0, publishedCount || 0, { preapproved_schedules_only: true });
    await logCompletedStage("change_monitor", changed + duplicates, changed, { duplicates, changed });
    console.log(`[content-agent] selesai: ditemukan=${found} draft=${created} duplikat=${duplicates} perubahan=${changed} gagal=${failures} terjadwal-terbit=${publishedCount || 0}`);
  } catch (error) {
    await finishRun(scoutRunId, "failed", { items_found: found, items_created: created, error_message: error.message.slice(0, 1000) });
    throw error;
  }
}

main().catch((error) => {
  console.error(`[content-agent] gagal: ${error.stack || error.message}`);
  process.exit(1);
});