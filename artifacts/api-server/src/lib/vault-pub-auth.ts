import type { Request, Response, NextFunction } from "express";
import { pool } from "@workspace/db";
import { createChatService, ChatServiceError } from "./chat-service";
import { fail, initialWorkspace } from "./vault-store";

const auth = createChatService();
const COOKIE = "rs_pub_session";
export function checkVaultOrigin(req: Request) {
  const origin = req.get("origin");
  const host = req.get("x-forwarded-host")?.split(",")[0]?.trim() || req.get("host");
  if (origin) {
    try { if (new URL(origin).host === host) return; } catch { /* Reject malformed origins too. */ }
    fail(403, "Asal permintaan tidak diizinkan.");
  }
}
export function pubAuthorization(req: Request) {
  if (req.get("authorization")) return req.get("authorization");
  try {
    const value = req.headers.cookie?.split(";").map(s => s.trim()).find(s => s.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    return value ? `Bearer ${decodeURIComponent(value)}` : undefined;
  } catch { return undefined; }
}
export async function verifyPub(authorization?: string) {
  try { return await auth.requireMember(authorization); }
  catch (e) {
    if (e instanceof ChatServiceError) fail(e.status, e.message);
    throw e;
  }
}
// One-time import, never a two-way sync. Subsequent company edits live in RS.
export async function ensurePubWorkspace(owner: string, authorization: string) {
  const exists = await pool.query("SELECT 1 FROM rs_workspaces WHERE owner_id=$1", [owner]);
  if (exists.rowCount) return;
  const url = new URL(process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "");
  url.pathname = "/rest/v1/profiles";
  url.search = new URLSearchParams({ select: "company", user_id: `eq.${owner}`, limit: "1" }).toString();
  const response = await fetch(url, {
    headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "", Authorization: authorization },
    signal: AbortSignal.timeout(7000), redirect: "error",
  });
  if (!response.ok) fail(503, "Profil awal PUB belum dapat dimuat. Silakan coba lagi.");
  const rows = await response.json();
  const state = initialWorkspace();
  if (Array.isArray(rows) && typeof rows[0]?.company === "string") state.profile.name = rows[0].company;
  await pool.query("INSERT INTO rs_workspaces(owner_id,state) VALUES($1,$2) ON CONFLICT DO NOTHING", [owner, JSON.stringify(state)]);
}
export async function vaultPubMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.method !== "GET") checkVaultOrigin(req);
    const authorization = pubAuthorization(req);
    const owner = await verifyPub(authorization);
    await ensurePubWorkspace(owner, authorization!);
    res.locals.vaultOwner = owner;
    next();
  } catch (e) { next(e); }
}
export async function openPubSession(req: Request, res: Response) {
  checkVaultOrigin(req);
  // Only an explicit PUB bearer token may establish a browser cookie.
  const authorization = req.get("authorization");
  const owner = await verifyPub(authorization);
  res.cookie(COOKIE, authorization!.slice(7), {
    httpOnly: true, secure: req.secure || req.get("x-forwarded-proto") === "https",
    sameSite: "lax", path: "/api/ruang-simpan", maxAge: 65 * 60 * 1000,
  });
  res.set("Cache-Control", "no-store").json({ userId: owner });
}
export function closePubSession(req: Request, res: Response) {
  checkVaultOrigin(req);
  res.clearCookie(COOKIE, { path: "/api/ruang-simpan" });
  res.sendStatus(204);
}
