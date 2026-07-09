import type { Envelope } from "../model/envelope";
import type { Project, ProjectListItem } from "../model/types";

/**
 * Storage port — the hexagon's persistence seam. This plan (01-01) declared
 * list/get/put. `softDelete` is added here by 01-02 (tombstone soft-delete,
 * DATA-03). `exportBackup`/`importBackup` are added by this plan (01-03,
 * DATA-06) — interface-first, incremental extension.
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
  /**
   * Serializes ALL envelopes (including tombstoned/deleted ones) into a
   * single JSON Blob — a faithful full dump, so restoring it never loses
   * deletion state (DATA-06).
   */
  exportBackup(): Promise<Blob>;
  /**
   * Validates every entry in `blob` BEFORE writing anything. If any single
   * entry fails Zod validation, the whole import is rejected with zero
   * writes (atomic, all-or-nothing) — this is the user's own,
   * previously-exported data, not third-party legacy data to be triaged
   * (DATA-06).
   *
   * This "zero writes" guarantee covers validation failures only. It does
   * NOT extend to failures during the write phase itself (e.g. a storage
   * schema constraint the Zod schema doesn't also enforce, or an
   * IndexedDB-level write/quota error) — those can still throw partway
   * through the write loop, after some earlier entries in the same
   * `blob` have already been persisted. There is no write-phase
   * transaction/rollback.
   */
  importBackup(blob: Blob): Promise<void>;
}
