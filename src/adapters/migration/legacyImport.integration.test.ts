import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { describe, expect, it } from "vitest";
import { createStorageAdapter } from "../../app/container";
import fixtureRows from "../../test/fixtures/legacy-export-fixture.json";
import { importLegacyExport } from "./legacyImport";
import type { LegacyProjectRow } from "./legacyImport";

function loadFixture(): LegacyProjectRow[] {
  return (fixtureRows as LegacyProjectRow[]).map((row) => ({ ...row }));
}

describe("importLegacyExport (real RxDB-backed StorageAdapter, via container.ts)", () => {
  it("imports the 3 valid fixture rows into real IndexedDB-path persistence, then confirms idempotency on a second run", async () => {
    // Single test in this file (no beforeEach/afterEach db.remove() needed,
    // unlike StorageAdapter.test.ts) — RxdbStorageAdapter does not expose
    // its private db handle, so there is nothing to explicitly tear down,
    // and there is only one createStorageAdapter() call in this file's
    // lifetime, so RxDB's "name already used" (DB8) registration never
    // collides within this suite.
    const storage = await createStorageAdapter(getRxStorageMemory());

    const rows = loadFixture();
    const firstRun = await importLegacyExport(rows, storage);

    expect(firstRun.imported).toBe(3);
    expect(firstRun.skippedInvalid).toHaveLength(1);

    // (a) the real, tombstone-filtered, Zod-validating list() query path
    // returns the 3 successfully-imported projects by name.
    const listed = await storage.list();
    const listedNames = listed.map((item) => item.name).sort();
    const expectedNames = rows
      .map((row) => JSON.parse(row.data) as { name?: string })
      .filter((project): project is { name: string } => typeof project.name === "string")
      .map((project) => project.name)
      .sort();
    expect(listedNames).toEqual(expectedNames);

    // (b) running the same fixture a second time against the same real
    // adapter reports zero new imports — idempotency holds against the
    // full persistence layer, not just the in-memory test double.
    const secondRun = await importLegacyExport(rows, storage);
    expect(secondRun.imported).toBe(0);
    expect(secondRun.skippedExisting).toBe(3);
  });
});
