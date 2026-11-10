import { randomUUID, createHash, timingSafeEqual } from "node:crypto";
import { pool } from "@workspace/db";
import type { VaultWorkspace, VaultDocument, VaultConnection } from "@workspace/api-zod";
import { fail } from "./vault-errors";
import type { AnalysisState } from "./document-analysis";
export { VaultError, fail } from "./vault-errors";

export const QUOTA = 50 * 1024 * 1024;
export type StoredDocument = VaultDocument & { objectPath: string; ocrJob?: string };
export type StoredConnection = VaultConnection & { tokenHash: string };
export type VaultState = Omit<VaultWorkspace, "documents" | "connections" | "usedBytes" | "limitBytes"> & AnalysisState & {
  documents: StoredDocument[];
  connections: StoredConnection[];
};
export function initialWorkspace(): VaultState {
  return {
    folders: ["Legalitas", "Teknis", "Penawaran & RAB", "SDM & Sertifikasi", "Tender", "Proyek", "Umum"]
      .map((name, i) => ({ id: `default-${i}`, name, count: 0 })),
    documents: [], connections: [], assistants: [], activities: [],
    profile: { name: "", nib: "", address: "", version: 0 },
  };
}
export function activity(state: VaultState, action: string) {
  state.activities.unshift({ id: randomUUID(), action, createdAt: new Date().toISOString() });
  state.activities = state.activities.slice(0, 100);
}
export function publicWorkspace(state: VaultState): VaultWorkspace {
  const { documentAnalyses: _analyses, ...visible } = state;
  return {
    ...visible,
    folders: state.folders.map(f => ({ ...f, count: state.documents.filter(d => d.folderId === f.id).length })),
    documents: state.documents.map(({ objectPath: _path, ocrJob: _job, ...d }) => d),
    connections: state.connections.map(({ tokenHash: _hash, ...c }) => c),
    usedBytes: state.documents.reduce((n, d) => n + d.size, 0), limitBytes: QUOTA,
  };
}
// A row lock serializes profile edits, uploads/quota checks, and token revocation.
export async function workspace<T>(owner: string, action: (state: VaultState) => Promise<T> | T): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("INSERT INTO rs_workspaces(owner_id,state) VALUES($1,$2) ON CONFLICT DO NOTHING",
      [owner, JSON.stringify(initialWorkspace())]);
    const { rows } = await client.query("SELECT state FROM rs_workspaces WHERE owner_id=$1 FOR UPDATE", [owner]);
    const state = rows[0].state as VaultState;
    const result = await action(state);
    await client.query("UPDATE rs_workspaces SET state=$2,updated_at=now() WHERE owner_id=$1",
      [owner, JSON.stringify(state)]);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally { client.release(); }
}
export const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");
export function sameHash(a: string, b: string) {
  return a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));
}
export function ownDocument(state: VaultState, id: string) {
  return state.documents.find(d => d.id === id) ?? fail(404, "Dokumen tidak ditemukan.");
}
export function ownFolder(state: VaultState, id: string) {
  return state.folders.find(f => f.id === id) ?? fail(400, "Folder tidak ditemukan.");
}
