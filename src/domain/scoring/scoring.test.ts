import { describe, expect, it } from "vitest";
import { createEmptyProject } from "../model/factory";
import type { ChecklistAnswer, Project } from "../model/types";
import { general } from "../../content/playbook/general";
import { calculateCompletion } from "./completion";
import { calculateReadinessPercent } from "./readiness";
import { calculateDecisionScore } from "./decisionScore";
import { collectReadinessGaps } from "./gaps";
import { createFollowUpFromChecklist } from "./followups";

/**
 * Local, domain-pure test fixture builder. Deliberately NOT importing the
 * legacy src/test/builders.ts `makeProject` (which is built on
 * src/data/types + src/lib/project) — this scoring engine lives under
 * domain/, so its fixture must be built only from domain/model/factory +
 * domain/model/types, keeping the domain-purity rule intact.
 */
function defaultAnswers(): Record<number, ChecklistAnswer> {
  return Object.fromEntries(
    general.items.map((item) => [
      item.id,
      {
        status: "Nincs meg",
        owner: "",
        dueDate: "",
        answer: "",
        openQuestion: "",
        nextStep: "",
        updatedAt: ""
      } satisfies ChecklistAnswer
    ])
  );
}

function makeProject(overrides: Partial<Project> = {}): Project {
  const base = createEmptyProject("general", { checklistAnswers: defaultAnswers() });

  return {
    ...base,
    ...overrides,
    checklistAnswers: { ...base.checklistAnswers, ...(overrides.checklistAnswers ?? {}) },
    decisionScores: { ...base.decisionScores, ...(overrides.decisionScores ?? {}) },
    followUps: overrides.followUps ?? base.followUps
  };
}

describe("domain/scoring", () => {
  it("calculateCompletion egy teljesen kitöltött projektre 100%-os percent-et és Kész state-et ad", () => {
    const answers = defaultAnswers();
    for (const item of general.items) {
      answers[item.id] = { ...answers[item.id], status: "Kész" };
    }
    const project = makeProject({ checklistAnswers: answers });

    const completion = calculateCompletion(project, general);

    expect(completion.percent).toBe(100);
    expect(completion.state).toBe("Kész");
  });

  it("calculateReadinessPercent/calculateDecisionScore a general playbook súlyaival megegyezik a legacy hardcoded képlet eredményével", () => {
    const answers = defaultAnswers();
    general.items.forEach((item, index) => {
      if (index < 10) answers[item.id] = { ...answers[item.id], status: "Kész" };
      else if (index < 15) answers[item.id] = { ...answers[item.id], status: "Részben megvan" };
    });

    const project = makeProject({
      name: "X",
      customerOrOrganization: "Y",
      businessProblem: "B",
      expectedBusinessOutcome: "O",
      productOwner: "PO",
      checklistAnswers: answers,
      followUps: [
        {
          id: "f1",
          sourceChecklistItemId: null,
          category: "Kategória",
          question: "Kérdés",
          owner: "",
          dueDate: "",
          status: "Megválaszolva",
          decisionOrAnswer: "",
          nextStep: ""
        },
        {
          id: "f2",
          sourceChecklistItemId: null,
          category: "Kategória",
          question: "Kérdés 2",
          owner: "",
          dueDate: "",
          status: "Nyitott",
          decisionOrAnswer: "",
          nextStep: ""
        }
      ],
      decisionScores: {
        businessValue: 4,
        strategicAlignment: 3,
        urgency: 2,
        confidence: 5,
        complexity: 2,
        risk: 4
      }
    });

    const readinessPercent = calculateReadinessPercent(project, general);
    expect(readinessPercent).toBe(48);

    const decisionScore = calculateDecisionScore(project, general, readinessPercent);
    expect(decisionScore).toBe(67);
  });

  it("collectReadinessGaps a ReadinessGap.targetTab/targetField/checklistItemId/followUpId szerződést adja vissza (D-08)", () => {
    const project = makeProject({
      followUps: [
        {
          id: "f1",
          sourceChecklistItemId: null,
          category: "Follow-up kategória",
          question: "Nyitott kérdés",
          owner: "",
          dueDate: "",
          status: "Nyitott",
          decisionOrAnswer: "",
          nextStep: ""
        }
      ]
    });

    const gaps = collectReadinessGaps(project, general);

    const overviewGap = gaps.find((gap) => gap.targetField === "customerOrOrganization");
    expect(overviewGap?.targetTab).toBe("overview");

    const checklistGap = gaps.find((gap) => gap.checklistItemId === 1);
    expect(checklistGap?.targetTab).toBe("checklist");

    const followUpGap = gaps.find((gap) => gap.followUpId === "f1");
    expect(followUpGap?.targetTab).toBe("followups");
  });

  it("createFollowUpFromChecklist a playbook megfelelő tételéből tölti a category/question mezőket", () => {
    const project = makeProject();

    const followUp = createFollowUpFromChecklist(project, general, 5);

    const sourceItem = general.items.find((item) => item.id === 5);
    expect(followUp.category).toBe(sourceItem?.category);
    expect(followUp.question).toBe(sourceItem?.exampleQuestion);
    expect(followUp.sourceChecklistItemId).toBe(5);
  });
});
