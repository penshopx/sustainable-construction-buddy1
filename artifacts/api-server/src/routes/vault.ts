import { Router, raw, type Request, type Response, type NextFunction } from "express";
import { vaultPubMiddleware, openPubSession, closePubSession } from "../lib/vault-pub-auth";
import { pubAuthorization } from "../lib/vault-pub-auth";
import { visibleCompanyNames } from "../lib/vault-company-names";
import { randomBytes, randomUUID } from "node:crypto";
import {
  CreateVaultFolderBody, UpdateVaultProfileBody, UpdateVaultDocumentBody,
  CreateVaultAssistantBody, CreateVaultConnectionBody, AskVaultQuestionBody,
  ResolveVaultCompaniesBody,
  ProcessVaultOcrBody, ProcessVaultOcrParams, ProcessVaultOcrResponse,
  ImportVaultDocumentBody, ImportVaultDocumentResponse,
} from "@workspace/api-zod";
import { workspace, publicWorkspace, ownDocument, ownFolder, activity, fail, tokenHash, VaultError, QUOTA } from "../lib/vault-store";
import { privateFile } from "../lib/vault-files";
import { startVaultOcr, expireOcrJobs } from "../lib/vault-ocr";
import { vaultSourceWindows } from "../lib/vault-sources";
import { requestVaultAnswer, vaultAiReadiness } from "../lib/vault-ai";
import { createChatService, ChatServiceError } from "../lib/chat-service";
import { GetVaultAiStatusResponse } from "@workspace/api-zod";
import { vaultExternalRouter, uploadDocument, streamDocument, importDocument } from "./vault-external";
import { documentAnalysisRouter } from "./document-analysis";
import { createSlidingLimiter } from "../lib/chat-limits";
import { workspaceSummary } from "../lib/vault-summary";

const aiRequests = createSlidingLimiter(60_000, 5);
const ownerQuota = (req: Request) => [{ scope: "vault", ...aiRequests.inspect(req.res!.locals.vaultOwner as string) }];

export const vaultRouter = Router();
vaultRouter.use("/external", vaultExternalRouter);
vaultRouter.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
vaultRouter.post("/session", openPubSession);
vaultRouter.delete("/session", closePubSession);
vaultRouter.use(vaultPubMiddleware);
vaultRouter.use("/bedah-dokumen", documentAnalysisRouter);
const statusAuth = createChatService();
vaultRouter.get("/ai-status", async (req, res) => {
  const diagnostics = req.query.diagnostics === "true";
  if (diagnostics) {
    try { await statusAuth.requireAdmin(pubAuthorization(req)); }
    catch (error) {
      if (error instanceof ChatServiceError) fail(error.status, error.message);
      throw error;
    }
  }
  res.json(GetVaultAiStatusResponse.parse({
    ...await vaultAiReadiness.get(diagnostics), localQuota: ownerQuota(req),
  }));
});
vaultRouter.post("/company-names", async (req, res) => {
  const { userIds } = ResolveVaultCompaniesBody.parse(req.body);
  res.json(await visibleCompanyNames(userIds, pubAuthorization(req)!));
});
const owner = (req: Request) => req.res!.locals.vaultOwner as string;
const idParam = (req: Request) => String(req.params.id);
vaultRouter.get("/workspace/summary", async (req, res): Promise<void> => {
  res.json(await workspaceSummary(owner(req)));
});
vaultRouter.get("/workspace", async (req, res) => {
  res.json(await workspace(owner(req), state => { expireOcrJobs(state); return publicWorkspace(state); }));
});
vaultRouter.post("/folders", async (req, res) => {
  const input = CreateVaultFolderBody.parse(req.body);
  const name = input.name.trim();
  if (!name) fail(400, "Nama folder wajib diisi.");
  res.json(await workspace(owner(req), state => {
    if (state.folders.length >= 50) fail(400, "Maksimal 50 folder.");
    if (state.folders.some(f => f.name.toLowerCase() === name.toLowerCase())) fail(409, "Nama folder sudah digunakan.");
    const folder = { id: randomUUID(), name, count: 0 };
    state.folders.push(folder); activity(state, `Folder dibuat: ${name}`); return folder;
  }));
});
vaultRouter.delete("/folders/:id", async (req, res) => {
  await workspace(owner(req), state => {
    const folder = ownFolder(state, idParam(req));
    if (folder.id.startsWith("default-")) fail(400, "Folder bawaan tidak dapat dihapus.");
    if (state.documents.some(d => d.folderId === folder.id)) fail(409, "Pindahkan dokumen terlebih dahulu; folder harus kosong.");
    state.folders = state.folders.filter(f => f.id !== folder.id);
    activity(state, `Folder dihapus: ${folder.name}`);
  });
  res.sendStatus(204);
});
vaultRouter.put("/profile", async (req, res) => {
  const input = UpdateVaultProfileBody.parse(req.body);
  res.json(await workspace(owner(req), state => {
    if (input.version !== state.profile.version) fail(409, "Profil telah berubah. Muat ulang data sebelum menyimpan.");
    state.profile = { ...input, name: input.name.trim(), version: input.version + 1 };
    activity(state, "Profil perusahaan diperbarui"); return state.profile;
  }));
});
vaultRouter.post("/documents", raw({ type: "application/octet-stream", limit: QUOTA }), async (req, res) => {
  if (!Buffer.isBuffer(req.body)) fail(400, "Kirim isi file sebagai application/octet-stream.");
  res.json(await uploadDocument(owner(req), req.body, req.query.name, req.query.folderId));
});
vaultRouter.post("/documents/import", async (req, res) => {
  const input = ImportVaultDocumentBody.parse(req.body);
  res.json(ImportVaultDocumentResponse.parse(await importDocument(owner(req), input)));
});
vaultRouter.post("/documents/:id/ocr", async (req, res) => {
  const { id } = ProcessVaultOcrParams.parse(req.params);
  const body = ProcessVaultOcrBody.parse(req.body);
  res.status(202).json(ProcessVaultOcrResponse.parse(await startVaultOcr(owner(req), id, body.pageRange)));
});
vaultRouter.patch("/documents/:id", async (req, res) => {
  const input = UpdateVaultDocumentBody.parse(req.body);
  res.json(await workspace(owner(req), state => {
    const doc = ownDocument(state, idParam(req));
    if (input.folderId !== undefined) { ownFolder(state, input.folderId); doc.folderId = input.folderId; }
    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name || /[\\/\0]/.test(name)) fail(400, "Nama file tidak valid.");
      // Preserve extension so the file format and download MIME remain accurate.
      if (name.split(".").pop()?.toUpperCase() !== doc.name.split(".").pop()?.toUpperCase()) fail(400, "Ekstensi file tidak boleh diubah.");
      doc.name = name;
    }
    if (input.starred !== undefined) doc.starred = input.starred;
    activity(state, `Dokumen diperbarui: ${doc.name}`);
    const { objectPath: _path, ocrJob: _job, ...safe } = doc; return safe;
  }));
});
vaultRouter.delete("/documents/:id", async (req, res) => {
  const path = await workspace(owner(req), state => {
    const doc = ownDocument(state, idParam(req));
    state.documents = state.documents.filter(d => d.id !== doc.id);
    state.documentAnalyses = state.documentAnalyses?.filter(a => a.documentId !== doc.id);
    // Preserve scoped assistant IDs: deleting its last selected document must
    // not silently broaden an assistant to all documents.
    state.connections.forEach(c => { c.documentIds = c.documentIds.filter(id => id !== doc.id); });
    activity(state, `Dokumen dihapus: ${doc.name}`);
    return doc.objectPath;
  });
  // Access is revoked atomically with metadata removal, even if blob cleanup fails.
  try { await privateFile(path).delete({ ignoreNotFound: true }); }
  catch { req.log.warn("Private file cleanup needs retry"); }
  res.sendStatus(204);
});
vaultRouter.get("/documents/:id/download", async (req, res) => {
  const doc = await workspace(owner(req), state => {
    const doc = ownDocument(state, idParam(req));
    activity(state, `Dokumen diunduh: ${doc.name}`); return doc;
  });
  await streamDocument(doc, res);
});
vaultRouter.post("/assistants", async (req, res) => {
  const input = CreateVaultAssistantBody.parse(req.body);
  if (!input.name.trim()) fail(400, "Nama asisten wajib diisi.");
  res.json(await workspace(owner(req), state => {
    if (state.assistants.length >= 20) fail(400, "Maksimal 20 asisten.");
    input.documentIds.forEach(id => ownDocument(state, id));
    const assistant = { ...input, name: input.name.trim(), id: randomUUID() };
    state.assistants.push(assistant); activity(state, `Asisten dibuat: ${assistant.name}`); return assistant;
  }));
});
vaultRouter.delete("/assistants/:id", async (req, res) => {
  await workspace(owner(req), state => {
    const assistant = state.assistants.find(a => a.id === idParam(req)) ?? fail(404, "Asisten tidak ditemukan.");
    state.assistants = state.assistants.filter(a => a.id !== assistant.id);
    activity(state, `Asisten dihapus: ${assistant.name}`);
  });
  res.sendStatus(204);
});
vaultRouter.post("/connections", async (req, res) => {
  const input = CreateVaultConnectionBody.parse(req.body);
  if (!input.name.trim()) fail(400, "Nama aplikasi wajib diisi.");
  const token = `rs_${randomBytes(32).toString("base64url")}`;
  res.json(await workspace(owner(req), state => {
    if (state.connections.filter(c => !c.revoked).length >= 20) fail(400, "Maksimal 20 koneksi aktif.");
    input.documentIds.forEach(id => ownDocument(state, id));
    input.folderIds.forEach(id => ownFolder(state, id));
    if (input.scopes.includes("documents:read") && !input.documentIds.length) fail(400, "Pilih dokumen yang boleh dibaca.");
    if (input.scopes.includes("documents:upload") && !input.folderIds.length) fail(400, "Pilih folder tujuan unggahan.");
    const connection = {
      ...input, name: input.name.trim(), id: randomUUID(), createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 90 * 86400_000).toISOString(), revoked: false,
    };
    state.connections.push({ ...connection, tokenHash: tokenHash(token) });
    activity(state, `Izin aplikasi dibuat: ${connection.name}`);
    return { connection, token };
  }));
});
vaultRouter.delete("/connections/:id", async (req, res) => {
  await workspace(owner(req), state => {
    const connection = state.connections.find(c => c.id === idParam(req)) ?? fail(404, "Koneksi tidak ditemukan.");
    connection.revoked = true; activity(state, `Akses aplikasi dicabut: ${connection.name}`);
  });
  res.sendStatus(204);
});
vaultRouter.post("/questions", async (req, res) => {
  const input = AskVaultQuestionBody.parse(req.body);
  const user = owner(req);
  const wait = aiRequests(user);
  if (wait) {
    res.set("Retry-After", String(wait));
    res.status(429).json({
      error: `Maksimal 5 pertanyaan per menit. Coba lagi dalam ${wait} detik.`,
      localQuota: ownerQuota(req), retryAfterSeconds: wait,
    });
    return;
  }
  const context = await workspace(user, state => {
    const assistant = input.assistantId ? state.assistants.find(a => a.id === input.assistantId) ?? fail(404, "Asisten tidak ditemukan.") : undefined;
    let docs = state.documents.filter(d => d.status === "ready" && d.text);
    const allowed = assistant?.documentIds.length ? assistant.documentIds : input.documentIds;
    if (allowed?.length) docs = docs.filter(d => allowed.includes(d.id));
    if (!docs.length) fail(400, "Belum ada dokumen dengan teks terbaca. Selesaikan OCR foto/PDF scan atau unggah dokumen bertulisan terlebih dahulu.");
    const words = input.question.toLowerCase().split(/\W+/).filter(w => w.length > 2);
    // Select bounded text windows. Sources include the exact evidence sent to AI.
    const candidates = docs.flatMap(d => {
      return vaultSourceWindows(d).map(s => ({
        ...s, score: words.reduce((n, w) => n + Number(s.quote.toLowerCase().includes(w)), 0),
      }));
    }).sort((a, b) => b.score - a.score).slice(0, 8);
    return { sources: candidates.map(({ score: _score, ...s }) => s), instructions: assistant?.instructions ?? "" };
  });
  const answer = await requestVaultAnswer(input.question, context.instructions, context.sources);
  res.json({ answer, sources: context.sources });
});
vaultRouter.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
  const invalid = !!err && typeof err === "object" && "issues" in err;
  const tooLarge = !!err && typeof err === "object" && "type" in err && err.type === "entity.too.large";
  const status = err instanceof VaultError ? err.status : invalid ? 400 : tooLarge ? 413 : 500;
  req.log.warn({ status }, "Ruang Simpan request rejected");
  if (res.headersSent) { res.end(); return; }
  res.status(status).json({ error: err instanceof VaultError ? err.message : status === 400 ? "Periksa data yang Anda masukkan." : status === 413 ? "File melebihi batas 50 MB." : "Permintaan belum berhasil. Silakan coba lagi." });
});
