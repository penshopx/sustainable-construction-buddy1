import { pool } from "@workspace/db";
import { GetVaultWorkspaceSummaryResponse } from "@workspace/api-zod";
import { fail } from "./vault-errors";

/** Project metadata in PostgreSQL: do not load, lock or rewrite private document text. */
export async function workspaceSummary(owner: string) {
  const { rows } = await pool.query(`
    SELECT jsonb_build_object(
      'name', state->'profile'->>'name',
      'version', state->'profile'->'version'
    ) AS profile,
    jsonb_array_length(state->'documents') AS "documentCount",
    (SELECT count(*)::integer FROM jsonb_array_elements(state->'documents') AS doc
      WHERE doc->>'status' = 'ready') AS "readyDocumentCount"
    FROM rs_workspaces WHERE owner_id = $1
  `, [owner]);
  if (!rows[0]) fail(503, "Acuan belum tersedia. Silakan muat ulang.");
  return GetVaultWorkspaceSummaryResponse.parse({
    profile: rows[0].profile,
    documentCount: rows[0].documentCount,
    readyDocumentCount: rows[0].readyDocumentCount,
    checkedAt: new Date().toISOString(),
  });
}
