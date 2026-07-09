import { z } from "zod";

/**
 * Playbook content model. A playbook is a STATIC, build-time/version-tracked
 * TS module — never a per-project RxDB-persisted record. Only the chosen
 * `Playbook.id` (as `Project.playbookId`) is stored on a project.
 *
 * D-02: a playbook carries its OWN item list AND its OWN weight
 * configuration — not just weights layered on a shared item list. This
 * keeps a future playbook (e.g. "Belső IT") free to define an entirely
 * different set of items.
 *
 * D-11: the `hint` field from the legacy `ChecklistTemplateItem`
 * (src/data/types.ts) is DELIBERATELY OMITTED here — coaching content
 * (miért/mit/hogyan/etikett) moves to a separate `content/coaching/*`
 * module in 02-04, keyed by item id, independently versioned.
 *
 * Pitfall 4 (item-id collision across future playbooks): `PlaybookItem.id`
 * is only unique WITHIN a single playbook's `items` array. It is NOT
 * globally namespaced, because `Project.checklistAnswers: Record<number,
 * ChecklistAnswer>` keys globally by numeric id, not by
 * `${playbookId}:${itemId}`. This is harmless today (only the "general"
 * playbook exists, ids 1-30), but a FUTURE second playbook (deferred, D-01)
 * MUST either (a) use a disjoint numeric id range (e.g. 1000+), or (b) wait
 * for a later migration that rekeys `checklistAnswers` to a playbook-scoped
 * string key (e.g. "general:7"). Do not silently reuse ids 1-30 in a new
 * playbook without one of those two mitigations.
 *
 * Domain-purity rule: this file must never import from rxdb/dexie/react or
 * any adapters/features module — only `zod`.
 */

export interface PlaybookItem {
  id: number;
  category: string;
  controlPoint: string;
  exampleQuestion: string;
  requiredForMvp: boolean;
  requiredForEstimate: boolean;
  blockingIfMissing: boolean;
}

export interface PlaybookWeights {
  // calculateReadinessPercent components (D-04: formula unchanged, only the
  // weight value now comes from the playbook instead of being hardcoded)
  baseInfo: number; // legacy: 0.2
  business: number; // legacy: 0.2
  ownership: number; // legacy: 0.15
  checklist: number; // legacy: 0.3
  followUpResolution: number; // legacy: 0.15
  // calculateDecisionScore components
  businessValue: number; // legacy: 0.25
  strategicAlignment: number; // legacy: 0.15
  urgency: number; // legacy: 0.15
  confidence: number; // legacy: 0.15
  complexity: number; // legacy: 0.1 (inverted scale)
  risk: number; // legacy: 0.1 (inverted scale)
  readiness: number; // legacy: 0.1
}

export interface Playbook {
  id: string;
  name: string;
  version: number;
  items: PlaybookItem[];
  weights: PlaybookWeights;
}

export const PlaybookItemSchema = z.object({
  id: z.number(),
  category: z.string(),
  controlPoint: z.string(),
  exampleQuestion: z.string(),
  requiredForMvp: z.boolean(),
  requiredForEstimate: z.boolean(),
  blockingIfMissing: z.boolean()
});

export const PlaybookWeightsSchema = z.object({
  baseInfo: z.number(),
  business: z.number(),
  ownership: z.number(),
  checklist: z.number(),
  followUpResolution: z.number(),
  businessValue: z.number(),
  strategicAlignment: z.number(),
  urgency: z.number(),
  confidence: z.number(),
  complexity: z.number(),
  risk: z.number(),
  readiness: z.number()
});

export const PlaybookSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  version: z.number().int().nonnegative(),
  items: z.array(PlaybookItemSchema),
  weights: PlaybookWeightsSchema
});
