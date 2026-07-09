import type { SyncPort } from "../../domain/ports/SyncPort";

/**
 * Null Object default for SyncPort (PREP-02). Does nothing of substance —
 * the real dirty-flag bookkeeping already happens inside
 * `RxdbStorageAdapter.put()`/`softDelete()` (01-01/01-02). `markDirty()` is
 * a no-op resolved Promise (never throws), `pending()` always resolves to
 * an empty array — there is no outbox data to report yet.
 */
// TODO(RED): placeholder implementation, intentionally not yet correct —
// GREEN commit replaces this with the true no-op Null Object.
export const NoopSyncAdapter: SyncPort = {
  async markDirty() {
    // no-op
  },
  async pending() {
    return [{ id: "placeholder", changedAt: new Date().toISOString() }];
  }
};
