import type { Project } from "../data/types";
import { createDraftProject, recalculateProject } from "../lib/project";

export function makeProject(overrides: Partial<Project> = {}): Project {
  const base = createDraftProject();

  return recalculateProject({
    ...base,
    id: "project-1",
    name: "Alpha projekt",
    customerOrOrganization: "Demo szervezet",
    productOwner: "PO User",
    contactEmail: "po@example.com",
    businessProblem: "Manuális projektindítás túl lassú.",
    expectedBusinessOutcome: "Rövidebb előkészítési idő.",
    firstMvpGoal: "Strukturált intake mentéssel.",
    updatedAt: "2026-06-22T10:00:00.000Z",
    ...overrides,
    decisionScores: {
      ...base.decisionScores,
      ...(overrides.decisionScores ?? {})
    },
    checklistAnswers: {
      ...base.checklistAnswers,
      ...(overrides.checklistAnswers ?? {})
    },
    followUps: overrides.followUps ?? base.followUps
  });
}

export function makeMemoryStorage(initialValue = "") {
  const store = new Map<string, string>();

  if (initialValue) {
    store.set("project-maker.projects.v1", initialValue);
  }

  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    dump: () => Object.fromEntries(store)
  };
}
