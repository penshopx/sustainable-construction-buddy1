import { Router } from "express";
import {
  AnalyzeVaultDocumentBody, ChatDocumentAnalysisParams, ChatDocumentAnalysisBody,
  DeleteDocumentAnalysisParams, AnalyzeVaultDocumentResponse,
} from "@workspace/api-zod";
import { analyzeDocument, chatAnalysis, listAnalyses, removeAnalysis } from "../lib/document-analysis";

// Mounted AFTER vaultPubMiddleware; identity never comes from the request body.
export const documentAnalysisRouter = Router();
documentAnalysisRouter.get("/", async (_req, res) => {
  res.json(await listAnalyses(res.locals.vaultOwner));
});
documentAnalysisRouter.post("/", async (req, res) => {
  const input = AnalyzeVaultDocumentBody.parse(req.body);
  res.json(AnalyzeVaultDocumentResponse.parse(await analyzeDocument(res.locals.vaultOwner, input.documentId, input.partIndex)));
});
documentAnalysisRouter.post("/:id/chat", async (req, res) => {
  const { id } = ChatDocumentAnalysisParams.parse(req.params);
  const input = ChatDocumentAnalysisBody.parse(req.body);
  res.json(AnalyzeVaultDocumentResponse.parse(await chatAnalysis(res.locals.vaultOwner, id, input.question, input.compareRegulations)));
});
documentAnalysisRouter.delete("/:id", async (req, res) => {
  const { id } = DeleteDocumentAnalysisParams.parse(req.params);
  await removeAnalysis(res.locals.vaultOwner, id);
  res.sendStatus(204);
});
