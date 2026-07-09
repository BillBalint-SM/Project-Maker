/**
 * LLM port — the hexagon's optional-enrichment seam (PREP-01). The domain
 * core only knows this interface; it never assumes a live LLM exists. The
 * default binding (`app/container.ts`) is `NoopLlmAdapter`
 * (`adapters/llm/noop.ts`), which makes the port's contract satisfiable with
 * zero live LLM calls — the app must stay fully functional without AI.
 *
 * Domain-purity rule: this file must never import from rxdb/dexie/react or
 * any adapters/features module.
 */
export interface LlmPort {
  rateAnswer(question: unknown, answer: unknown): Promise<{ level: "unknown" | "weak" | "strong" }>;
  suggestFollowups(context: unknown): Promise<string[]>;
  /**
   * Enriches a spec draft. The Noop implementation MUST be the identity
   * function — the deterministic pipeline never depends on the LLM for a
   * complete, correct output; the LLM only ever enriches on top of it.
   */
  enrichSpec<T>(spec: T): Promise<T>;
}
