import type { GapTargetTab, Project, ReadinessGap } from "../model/types";
import type { Playbook } from "../../content/playbook/types";

/**
 * Playbook-parameterized readiness-gap collection — verbatim 1:1 copy of
 * the legacy `src/lib/project.ts` `addGap`/`collectReadinessGaps` (D-04),
 * only the checklist iteration source changes from the legacy global
 * item-list module to `playbook.items`. The `ReadinessGap.targetTab`/
 * `targetField`/`checklistItemId`/`followUpId` contract is UNCHANGED
 * (D-08 fixGap-compatibility).
 *
 * Domain-purity rule: this file must never import from rxdb/dexie/react or
 * any adapters/features module.
 */

function hasText(value: string | null | undefined): boolean {
  return Boolean(value?.trim());
}

function addGap(
  gaps: ReadinessGap[],
  severity: ReadinessGap["severity"],
  category: string,
  message: string,
  nextStep: string,
  target: {
    targetTab: GapTargetTab;
    targetField?: string;
    checklistItemId?: number;
    followUpId?: string;
  }
): void {
  gaps.push({ severity, category, message, nextStep, ...target });
}

export function collectReadinessGaps(project: Project, playbook: Playbook): ReadinessGap[] {
  const gaps: ReadinessGap[] = [];
  const hasContact =
    hasText(project.contactPhone) || hasText(project.contactEmail) || hasText(project.contactOther);

  if (!hasText(project.customerOrOrganization)) {
    addGap(
      gaps,
      "Fontos",
      "Alapadatok",
      "Nincs megadva ügyfél vagy szervezet.",
      "Rögzítsd, melyik üzleti területhez vagy szervezethez tartozik az igény.",
      { targetTab: "overview", targetField: "customerOrOrganization" }
    );
  }

  if (!hasContact) {
    addGap(
      gaps,
      "Fontos",
      "Kapcsolat",
      "Nincs megadva elérhetőség.",
      "Adj meg telefonszámot, e-mailt vagy egyéb kapcsolati pontot.",
      { targetTab: "overview", targetField: "contactEmail" }
    );
  }

  if (!hasText(project.productOwner)) {
    addGap(
      gaps,
      "Kritikus",
      "Felelősök",
      "Nincs Product Owner vagy üzleti felelős.",
      "Jelöld ki az üzleti döntésekért és elfogadásért felelős személyt.",
      { targetTab: "overview", targetField: "productOwner" }
    );
  }

  if (!hasText(project.businessProblem)) {
    addGap(
      gaps,
      "Kritikus",
      "Üzleti cél",
      "Hiányzik a rövid üzleti probléma.",
      "Fogalmazd meg, milyen problémát old meg a projekt.",
      { targetTab: "overview", targetField: "businessProblem" }
    );
  }

  if (!hasText(project.expectedBusinessOutcome)) {
    addGap(
      gaps,
      "Kritikus",
      "Üzleti érték",
      "Hiányzik az elvárt üzleti eredmény.",
      "Rögzíts mérhető vagy egyértelműen validálható eredményt.",
      { targetTab: "overview", targetField: "expectedBusinessOutcome" }
    );
  }

  if (!hasText(project.firstMvpGoal)) {
    addGap(
      gaps,
      "Fontos",
      "MVP scope",
      "Nincs leírva az első MVP cél.",
      "Határozd meg, mi legyen az első szállítható működő verzió.",
      { targetTab: "overview", targetField: "firstMvpGoal" }
    );
  }

  if (!hasText(project.deadline)) {
    addGap(
      gaps,
      "Pontosítás",
      "Határidő",
      "Nincs megadva határidő.",
      "Add meg a cél- vagy döntési dátumot, ha van üzleti időkorlát.",
      { targetTab: "overview", targetField: "deadline" }
    );
  }

  for (const item of playbook.items) {
    const status = project.checklistAnswers[item.id]?.status ?? "Nincs meg";
    const isMissing = status === "Nincs meg" || status === "Részben megvan";

    if (item.requiredForEstimate && item.blockingIfMissing && isMissing) {
      addGap(
        gaps,
        item.requiredForMvp ? "Kritikus" : "Fontos",
        item.category,
        `${item.id}. ${item.controlPoint}`,
        item.exampleQuestion,
        { targetTab: "checklist", checklistItemId: item.id }
      );
    }
  }

  project.followUps
    .filter((followUp) => ["Nyitott", "Folyamatban", "Blokkolt"].includes(followUp.status))
    .forEach((followUp) => {
      addGap(
        gaps,
        followUp.status === "Blokkolt" ? "Kritikus" : "Pontosítás",
        followUp.category || "Follow-up",
        followUp.question || "Nyitott follow-up kérdés.",
        followUp.nextStep || "Zárd le vagy jelölj ki felelőst és határidőt.",
        { targetTab: "followups", followUpId: followUp.id }
      );
    });

  const severityRank = {
    Kritikus: 0,
    Fontos: 1,
    Pontosítás: 2
  };

  return gaps.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);
}
