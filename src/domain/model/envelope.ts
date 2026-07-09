/**
 * Sync-ready record envelope. Every persisted entity is wrapped in an
 * Envelope<T> so that future sync (v2) has the metadata it needs without
 * requiring a data migration later (stable UUID id, schema-version
 * discriminator, revision/updatedAt for LWW tie-breaking, deletedAt
 * tombstone instead of physical delete, dirty flag for the future outbox).
 *
 * Domain-purity rule: this file must never import from rxdb/dexie/react or
 * any adapters/features module.
 */
export interface Envelope<T> {
  /** Stable, client-generated UUID — sync-compatible key (never auto-increment). */
  id: string;
  /** Domain-level schema version discriminator for `data`. */
  schemaVersion: number;
  /** The wrapped domain payload. */
  data: T;
  /** Monotonic per-client revision counter (logical clock core). */
  revision: number;
  /** ISO timestamp — last-write-wins tie-breaker. */
  updatedAt: string;
  /** Actor stub — hardcoded "local-user" in this milestone (see D-06). */
  updatedBy: string;
  /** Tombstone for soft-delete; `null` means "not deleted". */
  deletedAt: string | null;
  /** Whether this record has unsynced local changes (Noop sync ignores this for now). */
  dirty: boolean;
}

/**
 * Domain-level app schema version for Envelope<T>.data.
 *
 * IMPORTANT: this is INDEPENDENT from the RxDB collection's own internal
 * `version` field (see src/adapters/storage/indexeddb/db.ts, which starts
 * at 0). Never conflate the two — this one drives domain/Zod-level
 * migrations of the `data` payload; the RxDB `version` drives the
 * IndexedDB collection's own schema migrations.
 */
export const CURRENT_APP_SCHEMA_VERSION = 1;
