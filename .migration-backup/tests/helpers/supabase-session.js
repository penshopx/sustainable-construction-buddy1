import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function readDotEnvValue(name) {
  try {
    const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
    const envFile = fs.readFileSync(path.join(projectRoot, ".env"), "utf8");
    const line = envFile.split(/\r?\n/).find((entry) => entry.startsWith(`${name}=`));
    return line?.slice(name.length + 1).replace(/^['"]|['"]$/g, "");
  } catch {
    return undefined;
  }
}

export function getSupabaseProjectRef() {
  const configuredProjectRef =
    process.env.PLAYWRIGHT_SUPABASE_PROJECT_REF ||
    process.env.VITE_SUPABASE_PROJECT_ID ||
    readDotEnvValue("VITE_SUPABASE_PROJECT_ID");
  if (configuredProjectRef) {
    return configuredProjectRef;
  }

  const configuredUrl =
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    readDotEnvValue("VITE_SUPABASE_URL") ||
    readDotEnvValue("SUPABASE_URL");
  if (!configuredUrl) {
    throw new Error("VITE_SUPABASE_PROJECT_ID atau VITE_SUPABASE_URL wajib tersedia untuk mock sesi E2E.");
  }

  const hostname = new URL(configuredUrl).hostname;
  const projectRef = hostname.match(/^([a-z0-9]+)\.supabase\.co$/i)?.[1];
  if (!projectRef) {
    throw new Error(`Tidak dapat menentukan project ref Supabase dari hostname ${hostname}.`);
  }
  return projectRef;
}

export async function installSupabaseSession(page, session) {
  const projectRef = getSupabaseProjectRef();
  await page.addInitScript(({ authSession, activeProjectRef }) => {
    localStorage.setItem(`sb-${activeProjectRef}-auth-token`, JSON.stringify(authSession));
    localStorage.setItem("pub_onboarding_done", "1");
  }, { authSession: session, activeProjectRef: projectRef });
}