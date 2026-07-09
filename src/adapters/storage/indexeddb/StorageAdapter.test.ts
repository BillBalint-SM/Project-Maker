import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import type { RxDatabase } from "rxdb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Envelope } from "../../../domain/model/envelope";
import { CURRENT_APP_SCHEMA_VERSION } from "../../../domain/model/envelope";
import { createEmptyProject } from "../../../domain/model/factory";
import type { Project } from "../../../domain/model/types";
import { createProjectDatabase } from "./db";
import { RxdbStorageAdapter } from "./StorageAdapter";

function buildEnvelope(overrides: Partial<Envelope<Project>> = {}): Envelope<Project> {
  const id = overrides.id ?? crypto.randomUUID();
  return {
    id,
    schemaVersion: CURRENT_APP_SCHEMA_VERSION,
    data: createEmptyProject({ id, name: "Teszt projekt" }),
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
