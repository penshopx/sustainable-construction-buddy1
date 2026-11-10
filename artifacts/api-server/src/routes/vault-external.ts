import { Router, raw, type Response } from "express";
import { pool } from "@workspace/db";
import { UpdateVaultProfileBody } from "@workspace/api-zod";
import {
  workspace, publicWorkspace, ownDocument, ownFolder, fail, activity, tokenHash, sameHash, QUOTA,
  type StoredDocument, type StoredConnection, type VaultState,
} from "../lib/vault-store";
import { objectPath, privateFile, validateFile, extractText } from "../lib/vault-files";
import { randomUUID } from "node:crypto";
import { fetchPublicFile, importFileName } from "../lib/vault-link";
import type { VaultExtraction } from "@workspace/api-zod";

const activeImports = new Set<string>();
export async function importDocument(owner: string, input: { url: string; name: string; folderId: string }) {
  const name = importFileName(input.name);
  if (activeImports.has(owner) || activeImports.size >= 4)
    fail(429, "Impor sedang berjalan. Tunggu sampai selesai, lalu coba lagi.");
  activeImports.add(owner);
  try {
    // Reject foreign folders and full workspaces before making any network request.
    // uploadDocument checks these again under the same row lock when saving.
    await workspace(owner, state => {
      ownFolder(state, input.folderId);
      if (state.documents.length >= 100) fail(400, "Maksimal 100 dokumen per ruang simpan.");
      if (state.documents.reduce((n, d) => n + d.size, 0) >= QUOTA) fail(413, "Kuota 50 MiB penuh.");
    });
    const bytes = await fetchPublicFile(input.url);
    return await uploadDocument(owner, bytes, name, input.folderId);
  } finally { activeImports.delete(owner); }
}

export async function uploadDocument(owner: string, bytes: Buffer, rawName: unknown, rawFolder: unknown, connectionId?: string) {
  if (typeof rawName !== "string" || !rawName.trim() || rawName.length > 200 || /[\\/\0]/.test(rawName)) fail(400, "Nama file tidak valid.");
  if (typeof rawFolder !== "string") fail(400, "Pilih folder tujuan.");
  if (bytes.length > QUOTA) fail(413, "Ukuran file melebihi 50 MB.");
  const name = rawName.trim();
  const { type, mime } = validateFile(name, bytes);
  let text = "", status: StoredDocument["status"] = "stored";
  let extraction: VaultExtraction | undefined;
  try { text = await extractText(bytes, type, value => { extraction = value; }); status = text.trim() ? "ready" : "stored"; }
  catch { status = "failed"; }
  const path = objectPath(owner);
  let uploaded = false;
  try {
    return await workspace(owner, async state => {
      if (connectionId) assertConnection(state, connectionId, "documents:upload", undefined, rawFolder);
      ownFolder(state, rawFolder);
      if (state.documents.length >= 100) fail(400, "Maksimal 100 dokumen per ruang simpan.");
      if (state.documents.reduce((n, d) => n + d.size, 0) + bytes.length > QUOTA) fail(413, "Kuota 50 MB penuh. Hapus dokumen yang tidak diperlukan.");
      await privateFile(path).save(bytes, { resumable: false, contentType: mime });
      uploaded = true;
      const doc: StoredDocument = {
        id: randomUUID(), name, folderId: rawFolder, type, size: bytes.length,
        createdAt: new Date().toISOString(), starred: false, status, text, objectPath: path,
        ...(extraction ? { extraction } : {}),
      };
      state.documents.unshift(doc); activity(state, `Dokumen diunggah: ${name}${connectionId ? " (aplikasi eksternal)" : ""}`);
      const { objectPath: _path, ...safe } = doc; return safe;
    });
  } catch (err) {
    if (uploaded) await privateFile(path).delete({ ignoreNotFound: true }).catch(() => undefined);
    throw err;
  }
}
export async function streamDocument(doc: StoredDocument, res: Response) {
  const file = privateFile(doc.objectPath);
  const [exists] = await file.exists();
  if (!exists) fail(404, "Isi file tidak tersedia.");
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
  res.setHeader("Content-Type", "application/octet-stream");
  res.attachment(doc.name);
  file.createReadStream().on("error", () => { if (!res.headersSent) res.status(503); res.end(); }).pipe(res);
}
function assertConnection(state: VaultState, id: string, scope: string, documentId?: string, folderId?: string) {
  const c = state.connections.find(c => c.id === id);
  if (!c || c.revoked || Date.parse(c.expiresAt) <= Date.now()) fail(401, "Token tidak aktif atau sudah kedaluwarsa.");
  if (!(c.scopes as string[]).includes(scope)) fail(403, "Izin tidak mencukupi.");
  if (documentId && !c.documentIds.includes(documentId)) fail(403, "Dokumen tidak diizinkan.");
  if (folderId && !c.folderIds.includes(folderId)) fail(403, "Folder tidak diizinkan.");
  return c;
}
export const vaultExternalRouter = Router();
vaultExternalRouter.use(async (req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  const token = req.headers.authorization?.match(/^Bearer (rs_[A-Za-z0-9_-]{43})$/)?.[1];
  if (!token) fail(401, "Token aplikasi diperlukan.");
  const hash = tokenHash(token);
  const { rows } = await pool.query("SELECT owner_id,state FROM rs_workspaces WHERE state->'connections' @> $1::jsonb LIMIT 1",
    [JSON.stringify([{ tokenHash: hash }])]);
  if (!rows.length) fail(401, "Token tidak valid.");
  const state = rows[0].state as VaultState;
  const connection = state.connections.find(c => sameHash(c.tokenHash, hash)) as StoredConnection | undefined;
  if (!connection || connection.revoked || Date.parse(connection.expiresAt) <= Date.now()) fail(401, "Token tidak aktif atau kedaluwarsa.");
  res.locals.vaultOwner = rows[0].owner_id;
  res.locals.vaultConnection = connection.id;
  next();
});
vaultExternalRouter.get("/profile", async (_req, res) => {
  res.json(await workspace(res.locals.vaultOwner, state => {
    const c = assertConnection(state, res.locals.vaultConnection, "profile:read");
    activity(state, `Profil dibaca aplikasi: ${c.name}`); return state.profile;
  }));
});
vaultExternalRouter.put("/profile", async (req, res) => {
  const data = UpdateVaultProfileBody.parse(req.body);
  res.json(await workspace(res.locals.vaultOwner, state => {
    const c = assertConnection(state, res.locals.vaultConnection, "profile:write");
    if (data.version !== state.profile.version) fail(409, "Versi profil berubah. Baca ulang data sebelum mengubah.");
    state.profile = { ...data, version: data.version + 1 };
    activity(state, `Profil diubah aplikasi: ${c.name}`); return state.profile;
  }));
});
vaultExternalRouter.get("/documents", async (_req, res) => {
  res.json(await workspace(res.locals.vaultOwner, state => {
    const c = assertConnection(state, res.locals.vaultConnection, "documents:read");
    // External metadata does not expose extracted content, private paths or all folders.
    return publicWorkspace(state).documents.filter(d => c.documentIds.includes(d.id)).map(({ text: _text, ...d }) => d);
  }));
});
vaultExternalRouter.get("/documents/:id/download", async (req, res) => {
  const doc = await workspace(res.locals.vaultOwner, state => {
    const c = assertConnection(state, res.locals.vaultConnection, "documents:read", String(req.params.id));
    const doc = ownDocument(state, String(req.params.id));
    activity(state, `Dokumen diunduh aplikasi ${c.name}: ${doc.name}`); return doc;
  });
  await streamDocument(doc, res);
});
vaultExternalRouter.post("/documents", raw({ type: "application/octet-stream", limit: QUOTA }), async (req, res) => {
  if (!Buffer.isBuffer(req.body)) fail(400, "Kirim isi file sebagai application/octet-stream.");
  res.json(await uploadDocument(res.locals.vaultOwner, req.body, req.query.name, req.query.folderId, res.locals.vaultConnection));
});
