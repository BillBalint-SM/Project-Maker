import { describe, expect, it } from "vitest";
import fixtureRows from "../../test/fixtures/legacy-export-fixture.json";
import { InMemoryStorageAdapter } from "../storage/memory/InMemoryStorageAdapter";
import { importLegacyExport } from "./legacyImport";
import type { LegacyProjectRow } from "./legacyImport";

function loadFixture(): LegacyProjectRow[] {
  // Fresh array per call so tests never share/mutate a module-cached import.
  return (fixtureRows as LegacyProjectRow[]).map((row) => ({ ...row }));
}

describe("importLegacyExport (fast in-memory StoragePort test double)", () => {
  it("imports valid rows, reports invalid rows, and reports zero already-exists on a fresh storage", async () => {
    const rows = loadFixture();
    const storage = new InMemoryStorageAdapter();

    const result = await importLegacyExport(rows, storage);

    expect(result.imported).toBe(3);
    expect(result.skippedInvalid).toHaveLength(1);
    expect(result.skippedExisting).toBe(0);
  });

  it("is idempotent: running the same fixture twice against the same storage imports nothing new the second time", async () => {
    const rows = loadFixture();
    const storage = new InMemoryStorageAdapter();

    await importLegacyExport(rows, storage);
    const second = await importLegacyExport(rows, storage);

    expect(second.imported).toBe(0);
    expect(second.skippedExisting).toBe(3);
  });

  it("does not let one invalid row block import of the other valid rows", async () => {
    const rows = loadFixture();
    const storage = new InMemoryStorageAdapter();

    const result = await importLegacyExport(rows, storage);

    const invalidRow = rows.find((row) => {
      const parsed = JSON.parse(row.data) as { name?: unknown };
      return parsed.name === undefined;
    });
    expect(invalidRow).toBeDefined();
    expect(result.skippedInvalid.map((entry) => entry.id)).toContain(invalidRow?.id);
    // 3 valid rows out of 4 total still got imported despite the invalid one.
    expect(result.imported).toBe(3);
  });

  it("preserves accented Hungarian fields byte-for-byte through the import", async () => {
    const rows = loadFixture();
    const storage = new InMemoryStorageAdapter();

    await importLegacyExport(rows, storage);

    const sourceRow = rows[0];
    const sourceProject = JSON.parse(sourceRow.data) as { customerOrOrganization: string };

    const stored = await storage.get(sourceRow.id);
    expect(stored).not.toBeNull();
    expect(stored?.data.customerOrOrganization).toBe(sourceProject.customerOrOrganization);
    expect(stored?.data.customerOrOrganization).toBe("Székesfehérvári Önkormányzat");
  });

  it("never calls storage.softDelete — migration import never tombstones", async () => {
    const rows = loadFixture();
    const storage = new InMemoryStorageAdapter();
    let softDeleteCalled = false;
    const originalSoftDelete = storage.softDelete.bind(storage);
    storage.softDelete = async (id: string) => {
      softDeleteCalled = true;
      return originalSoftDelete(id);
    };

    await importLegacyExport(rows, storage);

    expect(softDeleteCalled).toBe(false);
  });
});
