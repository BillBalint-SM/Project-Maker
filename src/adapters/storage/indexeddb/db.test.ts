import { addRxPlugin, createRxDatabase } from "rxdb";
import type { RxDatabase, RxJsonSchema } from "rxdb";
import { RxDBMigrationSchemaPlugin } from "rxdb/plugins/migration-schema";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, describe, expect, it } from "vitest";

/**
 * DATA-04: proves that RxDB's version-keyed `migrationStrategies` mechanism
 * actually runs and upgrades an older-version document — WITHOUT touching
 * the production `projectEnvelopeSchema` (db.ts), which intentionally stays
 * at `version: 0` / `migrationStrategies: {}` (this is a brand-new web app;
 * there is no real prior version to migrate yet — see 01-02-PLAN.md Task 2).
 *
 * This uses its own minimal, synthetic two-field schema (`{ id, label }`),
 * entirely self-contained in this test file.
 *
 * Migration is a separate RxDB plugin (`rxdb/plugins/migration-schema`) —
 * it is NOT bundled into the `rxdb` core entry point used by db.ts, so it
 * must be registered explicitly via `addRxPlugin` before it can run.
 *
 * Approach: two SEPARATE `createRxDatabase()` calls with the SAME database
 * `name`, backed by `getRxStorageMemory()`. Confirmed by 01-01's
 * StorageAdapter.test.ts (see its `afterEach` comment): the memory storage
 * plugin keeps documents in a module-level pool keyed by database name that
 * SURVIVES a plain `db.close()` — only `db.remove()` wipes it. That is
 * exactly the persistence behavior a real migration needs: close the v0
 * database (keep its data), then open a v1 database with the same name so
 * RxDB's migration-schema plugin can find the old collection meta and
 * migrate its documents forward.
 */

addRxPlugin(RxDBMigrationSchemaPlugin);

const DB_NAME = "db-test-migration-proof";
const COLLECTION_NAME = "docs";

const schemaV0: RxJsonSchema<Record<string, unknown>> = {
  title: "migration proof schema v0",
  version: 0,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    label: { type: "string" }
  },
  required: ["id", "label"]
};

const schemaV1: RxJsonSchema<Record<string, unknown>> = {
  title: "migration proof schema v1",
  version: 1,
  primaryKey: "id",
  type: "object",
  properties: {
    id: { type: "string", maxLength: 100 },
    label: { type: "string" },
    note: { type: "string" }
  },
  required: ["id", "label", "note"]
};

describe("RxDB migrationStrategies mechanism (synthetic schema, not the production one)", () => {
  let dbV0: RxDatabase | undefined;
  let dbV1: RxDatabase | undefined;

  afterEach(async () => {
    // Fully wipe the shared memory-storage pool after each test so this
    // suite never leaks state into (or picks up state from) any other
    // test file that happens to reuse the same storage engine.
    if (dbV1 && !dbV1.closed) {
      await dbV1.remove();
    } else if (dbV0 && !dbV0.closed) {
      await dbV0.remove();
    }
    dbV0 = undefined;
    dbV1 = undefined;
  });

  it("migrates a v0 document forward through migrationStrategies to v1, adding the new required field", async () => {
    // 1. Open a v0 database, insert a document, then CLOSE it (not
    //    remove() — remove() would wipe the data this test is about to
    //    migrate).
    dbV0 = await createRxDatabase({ name: DB_NAME, storage: getRxStorageMemory() });
    await dbV0.addCollections({
      [COLLECTION_NAME]: { schema: schemaV0, migrationStrategies: {} }
    });
    await (dbV0[COLLECTION_NAME] as import("rxdb").RxCollection).insert({
      id: "doc-1",
      label: "Első bejegyzés"
    });
    await dbV0.close();

    // 2. Open a SECOND database instance, same name, with the v1 schema and
    //    a real migration strategy. RxDB's `addCollections()` runs the
    //    migration AUTOMATICALLY (RxDB's default `autoMigrate: true` —
    //    verified against the installed rxdb@17.3.0 source,
    //    `rx-collection.js`'s `createRxCollection()`: "if (autoMigrate &&
    //    collection.schema.version !== 0) { await collection.migratePromise();
    //    }" runs BEFORE `addCollections()`'s returned promise resolves) — by
    //    the time this `await` below completes, the migration has already
    //    run to completion.
    dbV1 = await createRxDatabase({ name: DB_NAME, storage: getRxStorageMemory() });
    await dbV1.addCollections({
      [COLLECTION_NAME]: {
        schema: schemaV1,
        migrationStrategies: {
          1: (oldDoc: Record<string, unknown>) => ({ ...oldDoc, note: "default" })
        }
      }
    });

    const collection = dbV1[COLLECTION_NAME] as import("rxdb").RxCollection;

    // 3. The migrated document must now carry the new `note` field with the
    //    value the migration strategy assigned, and the original `label`
    //    field must have survived the migration untouched.
    const migratedDoc = await collection.findOne("doc-1").exec();
    expect(migratedDoc).not.toBeNull();
    const migratedData = migratedDoc?.toJSON() as Record<string, unknown>;
    expect(migratedData.note).toBe("default");
    expect(migratedData.label).toBe("Első bejegyzés");

    // 4. With the migration already complete, RxDB correctly reports no
    //    further migration is pending — a second confirmation that the
    //    mechanism (not just the schema declaration) actually ran.
    expect(await collection.migrationNeeded()).toBe(false);
  });
});
