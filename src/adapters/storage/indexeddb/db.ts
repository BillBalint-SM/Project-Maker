import { createRxDatabase } from "rxdb";
import type { RxDatabase, RxJsonSchema, RxStorage } from "rxdb";

/**
 * RxDB JSON schema for the `projects` collection. This is the RxDB
 * collection's OWN internal schema `version` (starts at 0) — it is
 * INDEPENDENT from the domain-level `CURRENT_APP_SCHEMA_VERSION`
 * (see src/domain/model/envelope.ts). Never conflate the two.
 *
 * The full Project payload is stored as a single nested `data` object
 * WITHOUT a field-by-field JSON-schema declaration, because Zod validation
 * (in StorageAdapter.ts) is the actual validation authority, not the RxDB
 * schema.
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
  version: 0,
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
 * DATA-04: the collection starts with an empty migration chain
 * (`migrationStrategies: {}`) — see 01-02-PLAN.md Task 2 for the first
 * real migration step.
 */
export async function createProjectDatabase(storage: RxStorage<unknown, unknown>): Promise<RxDatabase> {
  const db = await createRxDatabase({
    name: "project-maker",
    storage
  });

  await db.addCollections({
    projects: {
      schema: projectEnvelopeSchema,
      migrationStrategies: {}
    }
  });

  return db;
}
