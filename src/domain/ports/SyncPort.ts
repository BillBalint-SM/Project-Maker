/**
 * Sync port — the hexagon's sync-preparation seam (PREP-02). This plan
 * records ONLY the outbox/change-log contract; `push()`/`pull()` are
 * EXPLICITLY absent — a future sync milestone adds them. The dirty-flag
 * bookkeeping itself already happens inside the StorageAdapter's
 * put()/softDelete() (01-01/01-02) — this port does not duplicate it.
 *
 * Domain-purity rule: this file must never import from rxdb/dexie/react or
 * any adapters/features module.
 */
export interface ChangeLogEntry {
  id: string;
  changedAt: string;
}

export interface SyncPort {
  markDirty(id: string): Promise<void>;
  pending(): Promise<ChangeLogEntry[]>;
}
