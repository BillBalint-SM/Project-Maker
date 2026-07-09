import { describe, expect, it } from "vitest";
import { NoopLlmAdapter } from "./noop";

describe("NoopLlmAdapter", () => {
  it("enrichSpec() returns the input deeply unchanged (identity — the deterministic pipeline never depends on the LLM)", async () => {
    const spec = { foo: 1 };
    const result = await NoopLlmAdapter.enrichSpec(spec);
    expect(result).toEqual({ foo: 1 });
  });

  it("suggestFollowups() always resolves to an empty array", async () => {
    const result = await NoopLlmAdapter.suggestFollowups({ any: "context" });
    expect(result).toEqual([]);
  });

  it("rateAnswer() always resolves to { level: 'unknown' }", async () => {
    const result = await NoopLlmAdapter.rateAnswer("q", "a");
    expect(result).toEqual({ level: "unknown" });
  });
});
