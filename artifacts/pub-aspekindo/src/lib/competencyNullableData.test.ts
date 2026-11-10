import assert from "node:assert/strict";
import test from "node:test";

import {
  assessmentLevel,
  formatAssessmentDate,
} from "./competencyFallbacks.ts";
import {
  buildSiapCompetencyMap,
  type SiapCompetencySnapshot,
} from "./siapCompetencyEngine.ts";
import { mapAssessmentResponse } from "./assessmentResponse.ts";
import {
  orderAssessmentsChronologically,
  selectLatestAssessment,
} from "./assessmentOrdering.ts";

function emptySnapshot(): SiapCompetencySnapshot {
  return {
    member: null,
    obligations: [],
    activities: [],
    enrollments: [],
    evidence: [],
    modules: [],
    certificates: [],
    pancek: null,
    lkut: null,
    smapDocuments: [],
    projects: [],
    projectEvidenceCount: 0,
    assessment: null,
    competencyScore: null,
    nativeLms: {
      published_courses: 0,
      enrolled_courses: 0,
      completed_courses: 0,
      lesson_progress_records: 0,
      completed_lessons: 0,
      quiz_attempts: 0,
      passed_quizzes: 0,
      completion_records: 0,
    },
    operationalCounts: { risks: 0, budgets: 0, k3: 0 },
  };
}

test("Analytics memakai fallback stabil saat level dan tanggal assessment null", () => {
  assert.equal(assessmentLevel(null, "Pemula"), "Pemula");
  assert.equal(formatAssessmentDate(null, "short"), "Tanggal belum tersedia");
});

test("Assessment menjelaskan level dan tanggal yang belum tersedia", () => {
  assert.equal(
    assessmentLevel(null, "Belum ditentukan"),
    "Belum ditentukan",
  );
  assert.equal(formatAssessmentDate(null, "long"), "Tanggal belum tersedia");
});

test("peta kompetensi tetap terbentuk saat level dan tanggal assessment null", () => {
  const snapshot = emptySnapshot();
  snapshot.assessment = {
    score: 72,
    level: null,
    completed_at: null,
  };

  const map = buildSiapCompetencyMap(snapshot, "2026-09-10T00:00:00.000Z");
  const certification = map.dimensions.find(
    (dimension) => dimension.focus === "sertifikasi",
  );
  const assessment = certification?.indicators.find(
    (indicator) => indicator.id === "sertifikasi-assessment",
  );

  assert.equal(assessment?.available, true);
  assert.equal(assessment?.progress, 72);
  assert.equal(
    assessment?.detail,
    "Assessment terakhir 72% pada level Belum ditentukan.",
  );
  assert.equal(assessment?.updatedAt, null);
});

test("useSiapCompetencyMap mempertahankan assessment nullable dari respons database", () => {
  assert.deepEqual(
    mapAssessmentResponse({
      score: 72,
      determined_level: null,
      completed_at: null,
    }),
    {
      score: 72,
      level: null,
      completed_at: null,
    },
  );
  assert.deepEqual(
    mapAssessmentResponse({
      score: null,
      determined_level: null,
      completed_at: null,
    }),
    {
      score: 0,
      level: null,
      completed_at: null,
    },
  );
  assert.equal(mapAssessmentResponse(null), null);
});

test("assessment bertanggal dipilih sebagai terbaru meski record tanpa tanggal ikut tersedia", () => {
  const rows = [
    { id: "tanpa-tanggal", completed_at: null },
    { id: "lama", completed_at: "2026-08-01T00:00:00.000Z" },
    { id: "terbaru", completed_at: "2026-09-01T00:00:00.000Z" },
  ];

  assert.equal(selectLatestAssessment(rows)?.id, "terbaru");
  assert.deepEqual(
    orderAssessmentsChronologically(rows).map((row) => row.id),
    ["lama", "terbaru", "tanpa-tanggal"],
  );
});

test("assessment pertama menjadi fallback konsisten jika semua tanggal kosong", () => {
  const rows = [
    { id: "fallback-query", completed_at: null },
    { id: "record-lain", completed_at: null },
  ];

  assert.equal(selectLatestAssessment(rows)?.id, "fallback-query");
});