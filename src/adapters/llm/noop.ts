import type { LlmPort } from "../../domain/ports/LlmPort";

/**
 * Null Object default for LlmPort (PREP-01). No live LLM call, no network
 * traffic, no API key handling — this is the app's default and stays the
 * default until a future `LiveLlmAdapter` is wired behind
 * `app/container.ts`'s `config.llmEnabled` flag. `enrichSpec` is an
 * identity function: the deterministic pipeline's output is already
 * complete without the LLM, so "enrichment" here is a no-op passthrough.
 */
export const NoopLlmAdapter: LlmPort = {
  async rateAnswer() {
    return { level: "unknown" };
  },
  async suggestFollowups() {
    return [];
  },
  async enrichSpec<T>(spec: T): Promise<T> {
    return spec;
  }
};
