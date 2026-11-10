// Return only a canonical origin. Never interpolate environment values or URL
// parser errors into diagnostics: they may contain credentials.
export function validateProbeTarget(supabaseUrl, projectRef) {
  if (typeof projectRef !== "string" || !/^[a-z0-9]{20}$/.test(projectRef)) {
    throw new Error("SUPABASE_PROJECT_REF must be a valid project reference");
  }
  const origin = `https://${projectRef}.supabase.co`;
  if (supabaseUrl !== origin && supabaseUrl !== `${origin}/`) {
    throw new Error("SUPABASE_URL must be the HTTPS project origin for SUPABASE_PROJECT_REF");
  }
  return origin;
}
