import { addRxPlugin, createRxDatabase } from "rxdb";
import type { RxDatabase, RxJsonSchema, RxStorage } from "rxdb";
import { RxDBMigrationSchemaPlugin } from "rxdb/plugins/migration-schema";

/**
 * Migration is a separate RxDB plugin (`rxdb/plugins/migration-schema`) —
 * it is NOT bundled into the `rxdb` core entry point. It must be registered
 * here (not only in test files) for the production migration (version 0 ->
 * 1, playbookId backfill) to actually run against real browser/IndexedDB
 * usage, not just under test.
 */
addRxPlugin(RxDBMigrationSchemaPlugin);

/**
 * RxDB JSON schema for the `projects` collection. This is the RxDB
 * collection's OWN internal schema `version` (starts at 0, now 1) — it is
 * INDEPENDENT from the domain-level `CURRENT_APP_SCHEMA_VERSION`
 * (see src/domain/model/envelope.ts). Never conflate the two.
 *
 * The full Project payload is stored as a single nested `data` object
 * WITHOUT a field-by-field JSON-schema declaration, because Zod validation
 * (in StorageAdapter.ts) is the actual validation authority, not the RxDB
 * schema. This means `data` stays untyped (`type: "object"`) even for this
 * migration — the SAME "any new field risk" noted below for `deletedAt`
 * would apply to any field added directly to `data.properties`, so we
 * deliberately never declare one there; `playbookId` is validated only by
 * `ProjectSchema` (Zod), not by an RxDB-level `data` sub-schema.
 *
 * CRITICAL: RxDB applies `additionalProperties: false` at the schema's top
 * level by default (https://rxdb.info/rx-schema.html#non-allowed-properties).
 * `deletedAt` MUST be declared in `properties` (even though it is optional,
 * not in `required`) — otherwise ANY document carrying that key (even with
 * a `null` value) would be rejected on the first `collection.upsert()`,
 * because the domain `Envelope.deletedAt: string | null` field is ALWAYS
 * present. The null<->missing-key mapping between the domain envelope and
 * this RxDB schema is handled in StorageAdapter.ts get()/put().
 */
export const projectEnvelopeSchema: RxJsonSchema<Record<string, unknown>> = {
  title: "project envelope schema",
  version: 1,
  primaryKey: "id",
  type: "object",
  properties: {
    id: {
      type: "string",
      maxLength: 100
    },
    schemaVersion: {
      type: "number"
    },
    data: {
      type: "object"
    },
    revision: {
      type: "number"
    },
    updatedAt: {
      type: "string",
      maxLength: 30
    },
    updatedBy: {
      type: "string"
    },
    dirty: {
      type: "boolean"
    },
    // Intentionally optional — NOT in `required`. Absence means "not deleted".
    deletedAt: {
      type: "string",
      maxLength: 30
    }
  },
  required: ["id", "schemaVersion", "data", "revision", "updatedAt", "updatedBy", "dirty"],
  indexes: ["updatedAt"]
};

/**
 * Opens (or creates) the `project-maker` RxDB database and its `projects`
 * collection. The `storage` engine is injected by the caller — browser code
 * passes `getRxStorageDexie()`, tests pass `getRxStorageMemory()` — so this
 * function stays testable without real IndexedDB (jsdom has none).
 *
 * DATA-04: version 0 -> 1 is this collection's FIRST real migration step
 * (see 02-02-PLAN.md Task 2) — every Phase-1 document persisted before
 * `Project.playbookId` existed is backfilled to `playbookId: "general"`
 * here. This mirrors the SEPARATE backfill in legacyImport.ts (Task 3),
 * which applies the same default to legacy MIG-01 JSON-blob rows that
 * never went through RxDB at all — two different data entry points, same
 * default, because each entry point needs its own fix.
 */
export async function createProjectDatabase(storage: RxStorage<unknown, unknown>): Promise<RxDatabase> {
  const db = await createRxDatabase({
    name: "project-maker",
    storage
  });

  await db.addCollections({
    projects: {
      schema: projectEnvelopeSchema,
      migrationStrategies: { 1: (oldDoc: Record<string, unknown>) => ({
        ...oldDoc,
        data: { ...(oldDoc.data as Record<string, unknown>), playbookId: "general" }
      }) }
    }
  });

  return db;
}
