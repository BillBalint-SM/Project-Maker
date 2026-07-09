import type { CompletionState, Project, ProjectCompletion } from "../model/types";
import type { Playbook } from "../../content/playbook/types";
import { calculateReadinessPercent, readinessState } from "./readiness";
import {
  calculateDecisionScore,
  decisionLabel,
  decisionRecommendation,
  nextRecommendedAction
} from "./decisionScore";
import { collectReadinessGaps } from "./gaps";

/**
 * Playbook-parameterized completion aggregation — verbatim 1:1 copy of the
 * legacy `src/lib/project.ts` `calculateCompletion`/`emptyCompletion`
 * (D-04), only the checklist iteration source changes from the legacy
 * global item-list module to `playbook.items`.
 *
 * Domain-purity rule: this file must never import from rxdb/dexie/react or
 * any adapters/features module.
 */

export function calculateCompletion(project: Project, playbook: Playbook): ProjectCompletion {
  const answers = project.checklistAnswers;
  const totalItems = playbook.items.length;
  let doneItems = 0;
  let partialItems = 0;
  let missingItems = 0;
  let notRelevantItems = 0;
  let mvpCriticalMissing = 0;
  let estimateBlockingMissing = 0;

  for (const item of playbook.items) {
    const status = answers[item.id]?.status ?? "Nincs meg";

    if (status === "Kész") {
      doneItems += 1;
    }

    if (status === "Részben megvan") {
      partialItems += 1;
    }

    if (status === "Nincs meg") {
      missingItems += 1;
    }

    if (status === "Nem releváns") {
      notRelevantItems += 1;
    }

    if (item.requiredForMvp && status === "Nincs meg") {
      mvpCriticalMissing += 1;
    }

    if (
      item.requiredForEstimate &&
      item.blockingIfMissing &&
      (status === "Nincs meg" || status === "Részben megvan")
    ) {
      estimateBlockingMissing += 1;
    }
  }

  const relevantItems = Math.max(totalItems - notRelevantItems, 1);
  const percent = Math.round((doneItems / relevantItems) * 100);
  const openFollowUps = project.followUps.filter((item) =>
    ["Nyitott", "Folyamatban", "Blokkolt"].includes(item.status)
  ).length;
  const readinessGaps = collectReadinessGaps(project, playbook);
  const criticalGaps = readinessGaps.filter((gap) => gap.severity === "Kritikus").length;
  const readinessPercent = calculateReadinessPercent(project, playbook);
  const decisionScore = calculateDecisionScore(project, playbook, readinessPercent);
  const recommendation = decisionRecommendation(
    decisionScore,
    readinessPercent,
    criticalGaps,
    estimateBlockingMissing
  );

  const hasBlockingGap = mvpCriticalMissing > 0 || estimateBlockingMissing > 0;
  const allRelevantDone = doneItems === relevantItems;
  const state: CompletionState = hasBlockingGap
    ? "Pontosítás szükséges"
    : allRelevantDone
      ? "Kész"
      : "Folyamatban";

  return {
    percent,
    state,
    readinessPercent,
    readinessState: readinessState(readinessPercent, criticalGaps),
    totalItems,
    doneItems,
    partialItems,
    missingItems,
    notRelevantItems,
    mvpCriticalMissing,
    estimateBlockingMissing,
    openFollowUps,
    estimateReadiness:
      estimateBlockingMissing === 0
        ? "Igen"
        : estimateBlockingMissing <= 2
          ? "Feltételes / sávos becslés"
          : "Nem, további tisztázás kell",
    developmentReadiness:
      mvpCriticalMissing === 0 && estimateBlockingMissing === 0
        ? "Igen"
        : mvpCriticalMissing === 0 && estimateBlockingMissing <= 2
          ? "Feltételes Go"
          : "No-Go / tisztázás szükséges",
    decisionScore,
    decisionScoreLabel: decisionLabel(decisionScore),
    decisionRecommendation: recommendation,
    nextRecommendedAction: nextRecommendedAction(recommendation, readinessGaps),
    readinessGaps
  };
}

/**
 * FIGYELEM (deviation from the legacy 0-parameter signature): the legacy
 * `emptyCompletion()` used the length of the legacy global item-list module
 * for `totalItems`/`missingItems`. Since that count is now
 * playbook-specific, `emptyCompletion` takes a `playbook` parameter here.
 */
export function emptyCompletion(playbook: Playbook): ProjectCompletion {
  return {
    percent: 0,
    state: "Folyamatban",
    readinessPercent: 0,
    readinessState: "Pontosítás szükséges",
    totalItems: playbook.items.length,
    doneItems: 0,
    partialItems: 0,
    missingItems: playbook.items.length,
    notRelevantItems: 0,
    mvpCriticalMissing: 0,
    estimateBlockingMissing: 0,
    openFollowUps: 0,
    estimateReadiness: "Nem, további tisztázás kell",
    developmentReadiness: "No-Go / tisztázás szükséges",
    decisionScore: 0,
    decisionScoreLabel: "Alacsony",
    decisionRecommendation: "Pontosítás szükséges",
    nextRecommendedAction: "Töltsd ki az alapadatokat és a kritikus checklist pontokat.",
    readinessGaps: []
  };
}
