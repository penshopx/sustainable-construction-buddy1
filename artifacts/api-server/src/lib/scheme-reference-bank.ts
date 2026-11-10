import { GetSchemeReferencesResponse } from "@workspace/api-zod";
import { buildSchemeAnswerBank } from "../../scripts/scheme-answer-bank.mjs";
import matrix from "../data/construction-scheme-matrix.json";
import corpus from "../data/lpjk-knowledge.json";
import { readSchemeRequirementSection } from "./scheme-requirement-evidence";
import { schemeKnowledgeContext } from "./scheme-chat";

let cached: ReturnType<typeof GetSchemeReferencesResponse.parse> | undefined;

export function getSchemeReferenceBank() {
  if (!cached) {
    const policyText = schemeKnowledgeContext({ scheme_code: "BG001" }, "ruang lingkup")
      .split("DATA_SKEMA_TIDAK_TEPERCAYA=")[0];
    cached = GetSchemeReferencesResponse.parse(buildSchemeAnswerBank({
      matrix, corpus, policyText, readSection: readSchemeRequirementSection,
    }));
    const ids = new Set(cached.cases.map(item => item.id));
    if (ids.size !== cached.cases.length || cached.cases.some(item =>
      item.evidenceIds.some(id => !cached!.evidence[id]))) {
      cached = undefined;
      throw new Error("Reference bank integrity check failed");
    }
  }
  return cached;
}
