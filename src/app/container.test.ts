import type { RxDatabase } from "rxdb";
import { getRxStorageMemory } from "rxdb/plugins/storage-memory";
import { afterEach, describe, expect, it } from "vitest";
import { NoopLlmAdapter } from "../adapters/llm/noop";
import { createContainer } from "./container";

// createContainer() opens the fixed-name "project-maker" RxDB database
// (see adapters/storage/indexeddb/db.ts). RxDB refuses a second
// createRxDatabase() call with the same name while the first instance is
// still open (DB8) — closing it after each test frees that name-lock for
// the next test in this file. `RxdbStorageAdapter` does not expose its
// `db` field publicly (by design — it is an implementation detail of the
// adapter, not part of StoragePort), so this test-only cast reaches it
// purely for teardown; production code never does this.
let dbToClose: RxDatabase | undefined;

afterEach(async () => {
  if (dbToClose && !dbToClose.closed) {
    await dbToClose.close();
  }
  dbToClose = undefined;
});

describe("createContainer", () => {
  it("wires llm to the NoopLlmAdapter singleton (referential equality)", async () => {
    const container = await createContainer(getRxStorageMemory());
    dbToClose = (container.storage as unknown as { db: RxDatabase }).db;

    expect(container.llm).toBe(NoopLlmAdapter);
  });

  it("wires sync to a NoopSyncAdapter whose pending() resolves to []", async () => {
    const container = await createContainer(getRxStorageMemory());
    dbToClose = (container.storage as unknown as { db: RxDatabase }).db;

    await expect(container.sync.pending()).resolves.toEqual([]);
  });

  it("wires storage to a working StoragePort — list() resolves without throwing (smoke test)", async () => {
    const container = await createContainer(getRxStorageMemory());
    dbToClose = (container.storage as unknown as { db: RxDatabase }).db;

    await expect(container.storage.list()).resolves.toEqual([]);
  });
});
