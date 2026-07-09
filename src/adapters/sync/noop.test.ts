import { describe, expect, it } from "vitest";
import { NoopSyncAdapter } from "./noop";

describe("NoopSyncAdapter", () => {
  it("pending() always resolves to an empty array (the StorageAdapter already owns dirty-bookkeeping)", async () => {
    const result = await NoopSyncAdapter.pending();
    expect(result).toEqual([]);
  });

  it("markDirty() resolves without throwing and does nothing of substance", async () => {
    await expect(NoopSyncAdapter.markDirty("some-id")).resolves.toBeUndefined();
  });
});
