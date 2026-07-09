import type { Envelope } from "../model/envelope";
import type { Project, ProjectListItem } from "../model/types";

/**
 * Storage port — the hexagon's persistence seam. This plan (01-01) declared
 * list/get/put. `softDelete` is added here by 01-02 (tombstone soft-delete,
 * DATA-03). `exportBackup`/`importBackup` (01-03) are added to this
 * interface — and its adapter — by a later plan (interface-first,
 * incremental extension). Do NOT declare them here as stubs.
 *
 * Domain-purity rule: this file must never import from rxdb/dexie/react or
 * any adapters/features module.
 */
export interface StoragePort {
  list(): Promise<ProjectListItem[]>;
  get(id: string): Promise<Envelope<Project> | null>;
  put(record: Envelope<Project>): Promise<void>;
  /**
   * Tombstones the record (sets `deletedAt`, bumps `revision`/`updatedAt`).
   * This is NEVER a physical delete — the record remains reachable via
   * `get()`, only `list()` hides it (DATA-03). Throws if `id` does not
   * exist.
   */
  softDelete(id: string): Promise<void>;
}
