// Always evaluate the caller's current role using their own verified PUB JWT.
// A service key may be the gateway apikey, never the Authorization identity.
export async function clinicAdmin(owner: string, authorization: string): Promise<boolean> {
  const url = new URL(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "");
  url.pathname = "/rest/v1/user_roles";
  url.search = new URLSearchParams({ select: "role", user_id: `eq.${owner}`, role: "eq.admin" }).toString();
  const response = await fetch(url, {
    headers: {
      apikey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "",
      Authorization: authorization,
    },
    redirect: "error", signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) throw new Error("Role unavailable");
  const rows: unknown = await response.json();
  if (!Array.isArray(rows)) throw new Error("Role response invalid");
  return rows.some(row => row && typeof row === "object" && row.role === "admin");
}
