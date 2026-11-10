export const ENGINE_SCHEMA_VERSION = "pub-siap-v1";
export const ENGINE_TIMEOUT_MS = 8_000;
export const MAX_RECOMMENDATIONS = 3;
const HEALTH_FAILURE_REASONS = new Set([
  "none",
  "not_configured",
  "authentication",
  "timeout",
  "invalid_contract",
  "unavailable",
  "source_unavailable",
]);

export class CompetencyInsightError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "CompetencyInsightError";
    this.code = code;
  }
}

export const recommendationCatalog = {
  "legalitas-member": {
    focus: "legalitas",
    text: "Lengkapi status dan identitas keanggotaan BUJK.",
    href: "/pancek",
    label: "Lengkapi profil",
  },
  "legalitas-pancek": {
    focus: "legalitas",
    text: "Lengkapi identitas badan usaha, NIB, dan NPWP melalui PANCEK.",
    href: "/pancek",
    label: "Buka PANCEK",
  },
  "legalitas-lkut": {
    focus: "legalitas",
    text: "Lengkapi data KTA, SBU, perizinan, dan administrasi pada LKUT.",
    href: "/lkut",
    label: "Buka LKUT",
  },
  "sertifikasi-assessment": {
    focus: "sertifikasi",
    text: "Selesaikan pre-test untuk memetakan level kompetensi awal.",
    href: "/assessment",
    label: "Mulai assessment",
  },
  "sertifikasi-lms": {
    focus: "sertifikasi",
    text: "Lanjutkan E-Course, kuis, dan completion record di LMS ASPEKINDO.",
    href: "/aspekindo-lms",
    label: "Buka LMS",
  },
  "sertifikasi-evidence": {
    focus: "sertifikasi",
    text: "Tambahkan bukti penyelesaian dari sertifikat, PANCEK, atau SMAP.",
    href: "/certificates",
    label: "Lihat bukti",
  },
  "tender-learning": {
    focus: "tender",
    text: "Pelajari pengadaan, kontrak, dokumen penawaran, dan risiko tender.",
    href: "/courses",
    label: "Buka E-Course",
  },
  "tender-team": {
    focus: "tender",
    text: "Tinjau kesiapan tim menggunakan assessment dan scoring 4 Pilar.",
    href: "/analytics",
    label: "Buka Analytics",
  },
  "tender-risk": {
    focus: "tender",
    text: "Petakan risiko tender, supplier, dan rencana mitigasinya.",
    href: "/risk-register",
    label: "Buka workspace",
  },
  "proyek-workspace": {
    focus: "proyek",
    text: "Catat proyek aktif atau selesai beserta status dan kompleksitasnya.",
    href: "/projects",
    label: "Buka proyek",
  },
  "proyek-evidence": {
    focus: "proyek",
    text: "Lengkapi evidence pengalaman proyek pada data proyek dan LKUT.",
    href: "/lkut",
    label: "Buka LKUT",
  },
  "proyek-controls": {
    focus: "proyek",
    text: "Lengkapi kontrol K3, risiko, dan biaya pada workspace proyek.",
    href: "/k3-checklist",
    label: "Buka kontrol proyek",
  },
};

export function toRecommendation(key) {
  const item = recommendationCatalog[key];
  return item ? { text: item.text, href: item.href, label: item.label } : null;
}

export function deterministicKeys(missingKeys) {
  const focusOrder = ["legalitas", "sertifikasi", "tender", "proyek"];
  return [...new Set(missingKeys)]
    .filter((key) => Boolean(recommendationCatalog[key]))
    .sort((left, right) =>
      focusOrder.indexOf(recommendationCatalog[left].focus)
      - focusOrder.indexOf(recommendationCatalog[right].focus)
    )
    .slice(0, MAX_RECOMMENDATIONS);
}

export function parseRecommendationKeys(payload, availableKeys) {
  if (!payload || typeof payload !== "object") return [];
  const recommendationKeys = payload.recommendationKeys;
  if (!Array.isArray(recommendationKeys)) return [];

  const allowed = new Set(availableKeys.filter((key) => Boolean(recommendationCatalog[key])));
  return [...new Set(recommendationKeys)]
    .filter((key) => typeof key === "string" && allowed.has(key))
    .slice(0, MAX_RECOMMENDATIONS);
}

function failureReasonFromError(error) {
  const code = error instanceof CompetencyInsightError ? error.code : "unavailable";
  return HEALTH_FAILURE_REASONS.has(code) ? code : "unavailable";
}

export function toInsightHealth(outcome) {
  return {
    status: outcome.source,
    failureReason: outcome.failureReason,
  };
}

export function healthRequestStatus(admin) {
  return admin === true ? 200 : 403;
}

export async function resolveInsight({
  missingKeys,
  engineUrl,
  engineApiKey,
  requestKeys = requestRecommendationKeys,
}) {
  const fallbackKeys = deterministicKeys(missingKeys);
  const deterministicOutcome = (failureReason) => ({
    source: "deterministic",
    recommendationKeys: fallbackKeys,
    failureReason,
  });

  if (missingKeys.length === 0) return deterministicOutcome("none");
  if (!engineUrl || !engineApiKey) return deterministicOutcome("not_configured");

  try {
    const recommendationKeys = await requestKeys(engineUrl, engineApiKey, missingKeys);
    if (recommendationKeys.length === 0) {
      return deterministicOutcome("invalid_contract");
    }
    return {
      source: "connected",
      recommendationKeys,
      failureReason: "none",
    };
  } catch (error) {
    return deterministicOutcome(failureReasonFromError(error));
  }
}

function parseRecommendationKeysStrict(payload, availableKeys) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new CompetencyInsightError("invalid_contract", "Insight response must be an object");
  }
  if (!Array.isArray(payload.recommendationKeys)) {
    throw new CompetencyInsightError(
      "invalid_contract",
      "Insight response is missing recommendation keys",
    );
  }
  return parseRecommendationKeys(payload, availableKeys);
}

export async function requestRecommendationKeys(
  engineUrl,
  engineApiKey,
  availableKeys,
  fetchImpl = fetch,
  timeoutMs = ENGINE_TIMEOUT_MS,
) {
  let url;
  try {
    url = new URL(engineUrl);
  } catch {
    throw new CompetencyInsightError("unavailable", "Insight URL is invalid");
  }
  if (url.protocol !== "https:") {
    throw new CompetencyInsightError("unavailable", "Insight URL must use HTTPS");
  }

  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${engineApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        schemaVersion: ENGINE_SCHEMA_VERSION,
        availableRecommendationKeys: deterministicKeys(availableKeys),
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error?.name === "TimeoutError" || error?.name === "AbortError") {
      throw new CompetencyInsightError("timeout", "Insight request timed out");
    }
    throw new CompetencyInsightError("unavailable", "Insight request failed");
  }

  if (!response.ok) {
    if (response.status === 401 || response.status === 403) {
      throw new CompetencyInsightError("authentication", "Insight authentication failed");
    }
    if (response.status === 408 || response.status === 504) {
      throw new CompetencyInsightError("timeout", "Insight request timed out");
    }
    throw new CompetencyInsightError("unavailable", "Insight service returned an error");
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new CompetencyInsightError("invalid_contract", "Insight response is not valid JSON");
  }
  const recommendationKeys = parseRecommendationKeysStrict(payload, availableKeys);
  if (deterministicKeys(availableKeys).length > 0 && recommendationKeys.length === 0) {
    throw new CompetencyInsightError(
      "invalid_contract",
      "Insight response has no usable recommendation keys",
    );
  }
  return recommendationKeys;
}