const { randomUUID } = require("node:crypto");
const { writeFileSync } = require("node:fs");
const path = require("node:path");

const projectRef = process.env.VITE_SUPABASE_PROJECT_ID;
const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const accessToken = process.env.SUPABASE_ACCESS_TOKEN;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const devDomain = process.env.REPLIT_DEV_DOMAIN;

const requiredEnvironment = {
  VITE_SUPABASE_PROJECT_ID: projectRef,
  SUPABASE_URL: supabaseUrl,
  SUPABASE_ACCESS_TOKEN: accessToken,
  SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
  REPLIT_DEV_DOMAIN: devDomain,
};

const missingEnvironment = Object.entries(requiredEnvironment)
  .filter(([, value]) => !value)
  .map(([key]) => key);

if (missingEnvironment.length > 0) {
  throw new Error(`Missing required environment: ${missingEnvironment.join(", ")}`);
}

if (!accessToken.startsWith("sbp_")) {
  throw new Error("SUPABASE_ACCESS_TOKEN does not use the expected sbp_ format");
}

const activeOrigin = `https://${devDomain}`;
const confirmationRedirect = `${activeOrigin}/auth?confirmed=1`;
const recoveryRedirect = `${activeOrigin}/reset-password`;
const managementEndpoint = `https://api.supabase.com/v1/projects/${projectRef}/config/auth`;
const verificationReportPath = path.resolve(
  __dirname,
  "../supabase/auth-redirect-verification.json",
);

function parseAllowList(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== "string") return [];
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

async function readJson(response, label) {
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`${label} returned a non-JSON response (${response.status})`);
  }

  if (!response.ok) {
    const message = body?.message || body?.error || body?.msg || response.statusText;
    throw new Error(`${label} failed (${response.status}): ${message}`);
  }

  return body;
}

async function fetchAuthConfig() {
  const response = await fetch(managementEndpoint, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
  });
  return readJson(response, "Reading Supabase Auth config");
}

async function updateAuthConfig(currentConfig) {
  const currentAllowList = parseAllowList(
    currentConfig.uri_allow_list ?? currentConfig.URI_ALLOW_LIST,
  );
  const mergedAllowList = [
    ...new Set([
      ...currentAllowList,
      activeOrigin,
      confirmationRedirect,
      recoveryRedirect,
    ]),
  ];

  const response = await fetch(managementEndpoint, {
    method: "PATCH",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      site_url: activeOrigin,
      uri_allow_list: mergedAllowList.join(","),
    }),
  });

  return readJson(response, "Updating Supabase Auth config");
}

function getRedirectFromActionLink(actionLink) {
  const actionUrl = new URL(actionLink);
  return actionUrl.searchParams.get("redirect_to");
}

async function probeGeneratedLinks() {
  const email = `auth-redirect-probe-${Date.now()}@example.com`;
  const password = `P9!${randomUUID()}`;
  let userId = null;

  const requestAuthAdmin = async (path, init, label) => {
    const response = await fetch(`${supabaseUrl}/auth/v1/admin${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    return readJson(response, label);
  };

  const generateLink = async (type, redirectTo, details = {}) =>
    requestAuthAdmin(
      "/generate_link",
      {
        method: "POST",
        body: JSON.stringify({
          type,
          email,
          redirect_to: redirectTo,
          ...details,
        }),
      },
      `Generating ${type} link`,
    );

  try {
    const signup = await generateLink("signup", confirmationRedirect, {
      password,
    });
    userId = signup.user?.id ?? signup.id ?? null;
    const signupRedirect = getRedirectFromActionLink(
      signup.properties?.action_link ?? signup.action_link,
    );

    const recovery = await generateLink("recovery", recoveryRedirect);
    const recoveryRedirectResult = getRedirectFromActionLink(
      recovery.properties?.action_link ?? recovery.action_link,
    );

    return {
      confirmation: {
        requested: confirmationRedirect,
        generatedRedirect: signupRedirect,
        preserved: signupRedirect === confirmationRedirect,
        usesLocalhost: signupRedirect
          ? new URL(signupRedirect).hostname === "localhost"
          : null,
      },
      recovery: {
        requested: recoveryRedirect,
        generatedRedirect: recoveryRedirectResult,
        preserved: recoveryRedirectResult === recoveryRedirect,
        usesLocalhost: recoveryRedirectResult
          ? new URL(recoveryRedirectResult).hostname === "localhost"
          : null,
      },
    };
  } finally {
    if (userId) {
      await requestAuthAdmin(
        `/users/${userId}`,
        { method: "DELETE" },
        "Removing Auth probe user",
      );
    }
  }
}

(async () => {
  const currentConfig = await fetchAuthConfig();
  await updateAuthConfig(currentConfig);
  const verifiedConfig = await fetchAuthConfig();

  const siteUrl = verifiedConfig.site_url ?? verifiedConfig.SITE_URL ?? null;
  const allowList = parseAllowList(
    verifiedConfig.uri_allow_list ?? verifiedConfig.URI_ALLOW_LIST,
  );
  const probe = await probeGeneratedLinks();

  const result = {
    verifiedAt: new Date().toISOString(),
    projectRef,
    activeOrigin,
    authConfig: {
      siteUrl,
      siteUrlMatches: siteUrl === activeOrigin,
      includesActiveOrigin: allowList.includes(activeOrigin),
      includesConfirmationRedirect: allowList.includes(confirmationRedirect),
      includesRecoveryRedirect: allowList.includes(recoveryRedirect),
    },
    probe,
  };

  console.log(`[auth-redirect-config] ${JSON.stringify(result)}`);

  const successful =
    result.authConfig.siteUrlMatches &&
    result.authConfig.includesActiveOrigin &&
    result.authConfig.includesConfirmationRedirect &&
    result.authConfig.includesRecoveryRedirect &&
    result.probe.confirmation.preserved &&
    result.probe.confirmation.usesLocalhost === false &&
    result.probe.recovery.preserved &&
    result.probe.recovery.usesLocalhost === false;

  if (!successful) {
    throw new Error("Supabase Auth redirect verification did not pass");
  }

  writeFileSync(
    verificationReportPath,
    `${JSON.stringify(result, null, 2)}\n`,
    "utf8",
  );
})().catch((error) => {
  console.error(`[auth-redirect-config] ${error.message}`);
  process.exitCode = 1;
});