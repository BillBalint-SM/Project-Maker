import type { Project, ReadinessGap } from "../model/types";
import type { Playbook } from "../../content/playbook/types";

/**
 * Playbook-parameterized decision scoring — verbatim 1:1 copy of the legacy
 * `src/lib/project.ts` `scaleToPercent`/`inverseScaleToPercent`/
 * `calculateDecisionScore`/`decisionLabel`/`decisionRecommendation`/
 * `nextRecommendedAction` (D-04), only the weight source changes to
 * `playbook.weights.*`.
 *
 * Domain-purity rule: this file must never import from rxdb/dexie/react or
 * any adapters/features module.
 */

/** Playbook-independent helper. */
export function scaleToPercent(value: number): number {
  return Math.max(1, Math.min(5, value)) * 20;
}

/** Playbook-independent helper. */
export function inverseScaleToPercent(value: number): number {
  return (6 - Math.max(1, Math.min(5, value))) * 20;
}

export function calculateDecisionScore(
  project: Project,
  playbook: Playbook,
  readinessPercent: number
): number {
  const scores = project.decisionScores;

  return Math.round(
    scaleToPercent(scores.businessValue) * playbook.weights.businessValue +
      scaleToPercent(scores.strategicAlignment) * playbook.weights.strategicAlignment +
      scaleToPercent(scores.urgency) * playbook.weights.urgency +
      scaleToPercent(scores.confidence) * playbook.weights.confidence +
      inverseScaleToPercent(scores.complexity) * playbook.weights.complexity +
      inverseScaleToPercent(scores.risk) * playbook.weights.risk +
      readinessPercent * playbook.weights.readiness
  );
}

export function decisionLabel(score: number): "Magas" | "Közepes" | "Alacsony" {
  if (score >= 75) return "Magas";
  if (score >= 55) return "Közepes";
  return "Alacsony";
}

export function decisionRecommendation(
  score: number,
  readinessPercent: number,
  criticalGaps: number,
  estimateBlockingMissing: number
): string {
  if (criticalGaps > 0 || estimateBlockingMissing > 2 || readinessPercent < 55) {
    return "Pontosítás szükséges";
  }

  if (score >= 75 && readinessPercent >= 75 && estimateBlockingMissing === 0) {
    return "Becslésre vihető";
  }

  if (score >= 55 && readinessPercent >= 65) {
    return "Feltételes becslés";
  }

  return "Alacsony prioritás / későbbi kör";
}

export function nextRecommendedAction(recommendation: string, gaps: ReadinessGap[]): string {
  if (recommendation === "Becslésre vihető") {
    return "Küldhető becslésre vagy technikai előkészítésre.";
  }

  if (recommendation === "Feltételes becslés") {
    return "Sávos becslés kérhető, a fontos hiányok párhuzamos pontosításával.";
  }

  const firstGap = gaps[0];
  return firstGap?.nextStep ?? "Érdemes újrapriorizálni vagy későbbi körbe tenni.";
}
