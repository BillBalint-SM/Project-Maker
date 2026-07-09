import type { FollowUpQuestion, Project } from "../model/types";
import type { Playbook } from "../../content/playbook/types";

/**
 * Playbook-parameterized follow-up factory — verbatim 1:1 copy of the
 * legacy `src/lib/project.ts` `createFollowUpFromChecklist` (D-04), only
 * the checklist item lookup source changes from the legacy global
 * item-list module to `playbook.items`.
 *
 * Domain-purity rule: this file must never import from rxdb/dexie/react or
 * any adapters/features module.
 */

const defaultOwner = "TBD";

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createFollowUpFromChecklist(
  project: Project,
  playbook: Playbook,
  checklistItemId: number
): FollowUpQuestion {
  const template = playbook.items.find((item) => item.id === checklistItemId);
  const answer = project.checklistAnswers[checklistItemId];

  return {
    id: makeId(),
    sourceChecklistItemId: checklistItemId,
    category: template?.category ?? "",
    question: answer?.openQuestion || template?.exampleQuestion || "",
    owner: answer?.owner || defaultOwner,
    dueDate: answer?.dueDate || "",
    status: "Nyitott",
    decisionOrAnswer: "",
    nextStep: answer?.nextStep || ""
  };
}
