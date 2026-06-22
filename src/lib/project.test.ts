import { describe, expect, it } from "vitest";
import { checklistTemplate } from "../data/checklist";
import type { ChecklistAnswer } from "../data/types";
import {
  createDefaultChecklistAnswers,
  createDraftProject,
  createFollowUpFromChecklist,
  recalculateProject
} from "./project";
import { makeProject } from "../test/builders";

describe("project domain", () => {
  it("creates a draft project with default checklist answers and calculated completion", () => {
    const project = createDraftProject();

    expect(project.name).toMatch(/^Névtelen projekt - /);
    expect(Object.keys(project.checklistAnswers)).toHaveLength(checklistTemplate.length);
    expect(project.completion.totalItems).toBe(checklistTemplate.length);
    expect(project.completion.decisionRecommendation).toBe("Pontosítás szükséges");
  });

  it("recalculates readiness and estimate state from checklist answers", () => {
    const doneAnswers = Object.fromEntries(
      checklistTemplate.map((item) => [
        item.id,
        {
          ...createDefaultChecklistAnswers()[item.id],
          status: "Kész"
        } satisfies ChecklistAnswer
      ])
    ) as Record<number, ChecklistAnswer>;
    const project = recalculateProject(
      makeProject({
        checklistAnswers: doneAnswers,
        projectManager: "PM User",
        businessAnalyst: "BA User"
      })
    );

    expect(project.completion.percent).toBe(100);
    expect(project.completion.estimateReadiness).toBe("Igen");
    expect(project.completion.developmentReadiness).toBe("Igen");
    expect(project.completion.readinessGaps.every((gap) => gap.severity !== "Kritikus")).toBe(
      true
    );
  });

  it("creates follow-up questions from checklist context", () => {
    const project = makeProject({
      checklistAnswers: {
        1: {
          ...createDefaultChecklistAnswers()[1],
          openQuestion: "Ki validálja az üzleti célt?",
          owner: "PO User",
          nextStep: "Interjú egyeztetés"
        }
      }
    });

    const followUp = createFollowUpFromChecklist(project, 1);

    expect(followUp.category).toBe("Üzleti cél");
    expect(followUp.question).toBe("Ki validálja az üzleti célt?");
    expect(followUp.owner).toBe("PO User");
    expect(followUp.status).toBe("Nyitott");
  });
});
