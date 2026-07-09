import type { Project } from "./types";

/**
 * Pure ID generator, mirroring src/lib/project.ts `makeId()` — re-implemented
 * here (not imported) because this file is domain-pure/IO-free and must not
 * depend on the legacy `src/lib/` tree.
 */
function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Builds a Zod-schema-valid, minimally-defaulted Project — everything blank
 * or zeroed, no readiness/decision computation.
 *
 * EXPLICIT NON-GOAL: this factory does NOT compute readiness/decision
 * scores — that is the full checklist/scoring engine's job (Phase 2). It
 * only produces schema-valid, zeroed defaults.
 */
export function createEmptyProject(overrides?: Partial<Project>): Project {
  const timestamp = nowIso();

  const base: Project = {
    id: makeId(),
    name: "",
    customerOrOrganization: "",
    projectManager: "",
    businessAnalyst: "",
    productOwner: "",
    techLead: "",
    affectedTeams: [],
    contactPhone: "",
    contactEmail: "",
    contactOther: "",
    kickoffDate: "",
    plannedDecisionDate: "",
    status: "Előkészítés",
    priority: "Alap",
    deadline: "",
    businessProblem: "",
    expectedBusinessOutcome: "",
    firstMvpGoal: "",
    finalDecision: "",
    decisionDate: "",
    decisionMaker: "",
    decisionNote: "",
    decisionScores: {
      businessValue: 3,
      strategicAlignment: 3,
      urgency: 3,
      confidence: 3,
      complexity: 3,
      risk: 3
    },
    checklistAnswers: {},
    followUps: [],
    completion: {
      percent: 0,
      state: "Folyamatban",
      readinessPercent: 0,
      readinessState: "Pontosítás szükséges",
      totalItems: 0,
      doneItems: 0,
      partialItems: 0,
      missingItems: 0,
      notRelevantItems: 0,
      mvpCriticalMissing: 0,
      estimateBlockingMissing: 0,
      openFollowUps: 0,
      estimateReadiness: "Nem, további tisztázás kell",
      developmentReadiness: "No-Go / tisztázás szükséges",
      decisionScore: 0,
      decisionScoreLabel: "Alacsony",
      decisionRecommendation: "Pontosítás szükséges",
      nextRecommendedAction: "",
      readinessGaps: []
    },
    archivedAt: null,
    createdAt: timestamp,
    updatedAt: timestamp
  };

  return {
    ...base,
    ...overrides
  };
}
