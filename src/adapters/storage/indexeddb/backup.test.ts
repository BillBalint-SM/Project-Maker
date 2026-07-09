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
    updatedBy: "local-user",
    deletedAt: null,
    dirty: true,
    ...overrides
  };
}

describe("backup export/import (RxdbStorageAdapter, memory storage — no real IndexedDB needed)", () => {
  let db: RxDatabase;
  let adapter: RxdbStorageAdapter;

  beforeEach(async () => {
    db = await createProjectDatabase(getRxStorageMemory());
    adapter = new RxdbStorageAdapter(db);
  });

  afterEach(async () => {
    await db.remove();
  });

  it("exportBackup() includes tombstoned records; importBackup() into an emptied database restores the exact original state", async () => {
    const active = buildEnvelope({ id: "active-1" });
    const tombstoned = buildEnvelope({ id: "deleted-1" });

    await adapter.put(active);
    await adapter.put(tombstoned);
    await adapter.softDelete(tombstoned.id);

    const blob = await adapter.exportBackup();
    const parsed = JSON.parse(await blob.text()) as { projects: Array<{ id: string; deletedAt: string | null }> };
    expect(parsed.projects).toHaveLength(2);
    const tombstonedEntry = parsed.projects.find((entry) => entry.id === "deleted-1");
    expect(tombstonedEntry?.deletedAt).not.toBeNull();

    // Empty the database entirely, then restore from the backup.
    await db.projects.find().remove();
    expect(await adapter.list()).toHaveLength(0);

    await adapter.importBackup(blob);

    const afterRestore = await adapter.list();
    expect(afterRestore).toHaveLength(1);
    expect(afterRestore[0].id).toBe("active-1");

    // The restored tombstone is hidden from list() but reachable via get(),
    // exactly like it was before the export (DATA-03 convention preserved).
    const restoredTombstone = await adapter.get("deleted-1");
    expect(restoredTombstone).not.toBeNull();
    expect(restoredTombstone?.deletedAt).not.toBeNull();
  });

  it("importBackup() rejects a blob with an invalid entry (missing name) and writes nothing", async () => {
    const kept = buildEnvelope({ id: "kept-1" });
    await adapter.put(kept);

    const invalid = buildEnvelope({ id: "bad-1" });
    const invalidPayload = {
      schemaVersion: CURRENT_APP_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      projects: [
        kept,
        {
          ...invalid,
          data: { ...invalid.data, name: undefined }
        }
      ]
    };
    const invalidBlob = new Blob([JSON.stringify(invalidPayload)], {
      type: "application/json"
    });

    const before = await adapter.list();
    expect(before).toHaveLength(1);

    await expect(adapter.importBackup(invalidBlob)).rejects.toThrow();

    const after = await adapter.list();
    expect(after).toHaveLength(1);
    expect(after[0].id).toBe("kept-1");
  });
});
