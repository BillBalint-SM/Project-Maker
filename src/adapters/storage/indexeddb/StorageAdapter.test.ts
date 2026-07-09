import { addRxPlugin, createRxDatabase } from "rxdb";
import type { RxCollection, RxDatabase } from "rxdb";
import { RxDBMigrationSchemaPlugin } from "rxdb/plugins/migration-schema";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Envelope } from "../../../domain/model/envelope";
import { CURRENT_APP_SCHEMA_VERSION } from "../../../domain/model/envelope";
import { createEmptyProject } from "../../../domain/model/factory";
import type { Project } from "../../../domain/model/types";
import { createProjectDatabase, projectEnvelopeSchema } from "./db";
import { RxdbStorageAdapter } from "./StorageAdapter";

addRxPlugin(RxDBMigrationSchemaPlugin);

function buildEnvelope(overrides: Partial<Envelope<Project>> = {}): Envelope<Project> {
  const id = overrides.id ?? crypto.randomUUID();
  return {
    id,
    schemaVersion: CURRENT_APP_SCHEMA_VERSION,
    data: createEmptyProject("general", { id, name: "Teszt projekt" }),
    revision: 0,
    updatedAt: new Date().toISOString(),
    updatedBy: "someone-else",
    deletedAt: null,
    dirty: true,
    ...overrides
  };
}

describe("RxdbStorageAdapter (memory storage — no real IndexedDB needed)", () => {
  let db: RxDatabase;
  let adapter: RxdbStorageAdapter;

  beforeEach(async () => {
    // Real RxDB code path, exercised against the in-memory storage engine —
    // this is what makes the test runnable under jsdom (no IndexedDB there).
    db = await createProjectDatabase(getRxStorageMemory());
    adapter = new RxdbStorageAdapter(db);
  });

  afterEach(async () => {
    // The memory storage engine keeps its documents in a module-level pool
    // keyed by database name — a plain `close()` only frees the DB8
    // "name already used" registration, the DATA itself would still be
    // visible to the next test's fresh instance under the same name. Use
    // `remove()` (close + wipe storage) for a truly clean slate per test.
    await db.remove();
  });

  it("put() then get() with the same id returns the same data payload", async () => {
    const envelope = buildEnvelope();

    await adapter.put(envelope);
    const result = await adapter.get(envelope.id);

    expect(result).not.toBeNull();
    expect(result?.data).toEqual(envelope.data);
  });

  it("list() returns an empty array on an empty database", async () => {
    const result = await adapter.list();
    expect(result).toEqual([]);
  });

  it("put() with an incomplete object throws a Zod error and does not write partially", async () => {
    const envelope = buildEnvelope();
    const incomplete = {
      ...envelope,
      data: { ...envelope.data, name: undefined }
    } as unknown as Envelope<Project>;

    await expect(adapter.put(incomplete)).rejects.toThrow();

    const result = await adapter.list();
    expect(result).toEqual([]);
  });

  it("put()-in updatedBy is always overwritten to local-user, even if the caller passed something else", async () => {
    const envelope = buildEnvelope({ updatedBy: "someone-else" });

    await adapter.put(envelope);
    const result = await adapter.get(envelope.id);

    expect(result?.updatedBy).toBe("local-user");
  });

  it("put() with deletedAt: null does not throw an RxDB schema validation error, and get() returns deletedAt: null", async () => {
    const envelope = buildEnvelope({ deletedAt: null });

    await expect(adapter.put(envelope)).resolves.not.toThrow();

    const result = await adapter.get(envelope.id);
    expect(result?.deletedAt).toBeNull();

    // Direct plain-document check: the mapping must OMIT the key entirely,
    // never write a literal `null` (the RxDB schema field is `type: 'string'`,
    // not nullable).
    const rawDoc = await db.projects.findOne(envelope.id).exec();
    const plain = rawDoc?.toJSON() as Record<string, unknown>;
    expect(Object.prototype.hasOwnProperty.call(plain, "deletedAt")).toBe(false);
  });

  it("softDelete() removes the record from list() but get() still returns it with deletedAt set (tombstone, not physical delete)", async () => {
    const envelope = buildEnvelope();
    await adapter.put(envelope);

    const beforeDelete = await adapter.list();
    expect(beforeDelete).toHaveLength(1);

    await adapter.softDelete(envelope.id);

    const afterDelete = await adapter.list();
    expect(afterDelete).toHaveLength(0);

    const direct = await adapter.get(envelope.id);
    expect(direct).not.toBeNull();
    expect(direct?.deletedAt).not.toBeNull();
  });

  it("softDelete() throws when the id does not exist", async () => {
    await expect(adapter.softDelete("nonexistent-id")).rejects.toThrow(
      "Project not found: nonexistent-id"
    );
  });
});

describe("RxdbStorageAdapter — production migrationStrategies[1] (playbookId backfill)", () => {
  // Deliberately reuses the SAME database name ("project-maker") that
  // createProjectDatabase() always opens, so step 2 below exercises the
  // ACTUAL production function (not a duplicated/hand-rolled copy of its
  // migrationStrategies) — matching the pattern already used by every other
  // test in this file (their beforeEach/afterEach fully create/remove this
  // same-named database per test, so sequential reuse across describe
  // blocks in this file is safe).
  let dbV0: RxDatabase | undefined;
  let dbV1: RxDatabase | undefined;

  afterEach(async () => {
    // Same two-instance, same-name pattern as db.test.ts: only db.remove()
    // (not close()) wipes the shared memory-storage pool, so tear down via
    // whichever handle is still open to avoid leaking state into other
    // tests/files that reuse getRxStorageMemory().
    if (dbV1 && !dbV1.closed) {
      await dbV1.remove();
    } else if (dbV0 && !dbV0.closed) {
      await dbV0.remove();
    }
    dbV0 = undefined;
    dbV1 = undefined;
  });

  it("migrates a v0 document (no playbookId) to playbookId: \"general\" via the real createProjectDatabase() migration, leaving other fields untouched", async () => {
    // 1. Open a v0-schema database (production schema shape, but version 0
    //    and an empty migration chain — i.e. how this collection looked
    //    BEFORE this plan), insert a v0-shaped document (no playbookId in
    //    its `data`), then close (not remove) so the data survives.
    const schemaV0 = { ...projectEnvelopeSchema, version: 0 };
    dbV0 = await createRxDatabase({ name: "project-maker", storage: getRxStorageMemory() });
    await dbV0.addCollections({
      projects: { schema: schemaV0, migrationStrategies: {} }
    });

    const legacyProject = createEmptyProject("general", { id: "legacy-1", name: "Régi projekt" });
    // Strip playbookId to simulate a genuine pre-migration (Phase 1) v0
    // document, which never knew this field existed.
    const { playbookId: _omit, ...legacyProjectWithoutPlaybookId } = legacyProject;
    const v0Envelope = {
      id: "legacy-1",
      schemaVersion: 1,
      data: legacyProjectWithoutPlaybookId,
      revision: 1,
      updatedAt: new Date().toISOString(),
      updatedBy: "local-user",
      dirty: true
    };
    await (dbV0.projects as RxCollection).insert(v0Envelope);
    await dbV0.close();

    // 2. Open the REAL production createProjectDatabase() (v1 schema +
    //    migrationStrategies[1], as defined in db.ts) under the same
    //    database name — RxDB's addCollections() runs the migration
    //    automatically (autoMigrate default true) before its promise
    //    resolves.
    dbV1 = await createProjectDatabase(getRxStorageMemory());

    const adapter = new RxdbStorageAdapter(dbV1);
    const result = await adapter.get("legacy-1");

    expect(result).not.toBeNull();
    expect(result?.data.playbookId).toBe("general");
    // Untouched fields survive the migration unchanged.
    expect(result?.data.name).toBe("Régi projekt");
    expect(result?.data.id).toBe("legacy-1");

    expect(await (dbV1.projects as RxCollection).migrationNeeded()).toBe(false);
  });
});
