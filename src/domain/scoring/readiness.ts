import type { Project } from "../model/types";
import type { Playbook } from "../../content/playbook/types";

/**
 * Playbook-parameterized readiness scoring. The formula structure is a
 * verbatim 1:1 copy of the legacy `src/lib/project.ts`
 * `checklistWeightedRatio`/`followUpResolutionRatio`/`calculateReadinessPercent`
 * (D-04) — only the item source (`playbook.items` instead of the legacy
 * global item-list module) and the weight source (`playbook.weights.*`
 * instead of hardcoded literals) change.
 *
 * Domain-purity rule: this file must never import from rxdb/dexie/react or
 * any adapters/features module.
 */

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function scoreTextFields(values: string[]): number {
  if (values.length === 0) return 1;
  return values.filter(hasText).length / values.length;
}

export function checklistWeightedRatio(project: Project, playbook: Playbook): number {
  const relevantItems = playbook.items.filter((item) => {
    const status = project.checklistAnswers[item.id]?.status ?? "Nincs meg";
    return status !== "Nem releváns";
  });

  if (relevantItems.length === 0) return 1;

  const score = relevantItems.reduce((sum, item) => {
    const status = project.checklistAnswers[item.id]?.status ?? "Nincs meg";
    if (status === "Kész") return sum + 1;
    if (status === "Részben megvan") return sum + 0.5;
    return sum;
  }, 0);

  return score / relevantItems.length;
}

/**
 * NOT playbook-dependent — follow-ups are attached to the project, not to a
 * specific playbook item list.
 */
export function followUpResolutionRatio(project: Project): number {
  if (project.followUps.length === 0) return 1;

  const closed = project.followUps.filter((followUp) =>
    ["Megválaszolva", "Nem releváns"].includes(followUp.status)
  ).length;

  return closed / project.followUps.length;
}

export function calculateReadinessPercent(project: Project, playbook: Playbook): number {
  const baseInfoScore = scoreTextFields([
    project.name,
    project.customerOrOrganization,
    project.deadline,
    project.contactPhone || project.contactEmail || project.contactOther
  ]);
  const businessScore = scoreTextFields([
    project.businessProblem,
    project.expectedBusinessOutcome,
    project.firstMvpGoal
  ]);
  const ownershipScore = scoreTextFields([
    project.projectManager,
    project.productOwner,
    project.businessAnalyst || project.techLead
  ]);

  return Math.round(
    (baseInfoScore * playbook.weights.baseInfo +
      businessScore * playbook.weights.business +
      ownershipScore * playbook.weights.ownership +
      checklistWeightedRatio(project, playbook) * playbook.weights.checklist +
      followUpResolutionRatio(project) * playbook.weights.followUpResolution) *
      100
  );
}

export function readinessState(readinessPercent: number, criticalGaps: number): string {
  if (criticalGaps > 0 || readinessPercent < 55) return "Pontosítás szükséges";
  if (readinessPercent < 75) return "Becslésre előkészíthető";
  if (readinessPercent < 90) return "Becslésre kész";
  return "Fejlesztésre kész";
}
