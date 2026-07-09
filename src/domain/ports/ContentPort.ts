/**
 * Content port — the hexagon's coaching-content seam. Deliberately minimal
 * and forward-looking: the return type is `unknown` because the concrete
 * shape of coaching content is Phase 2-3's concern, not this plan's. Do not
 * invent a `CoachingContent` type here that would presume the future data
 * model.
 *
 * Domain-purity rule: this file must never import from rxdb/dexie/react or
 * any adapters/features module.
 */
export interface ContentPort {
  forQuestion(questionId: string): Promise<unknown | null>;
}
