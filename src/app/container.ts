import type { RxStorage } from "rxdb";
import { createProjectDatabase } from "../adapters/storage/indexeddb/db";
import { RxdbStorageAdapter } from "../adapters/storage/indexeddb/StorageAdapter";
import type { StoragePort } from "../domain/ports/StoragePort";

/**
 * Composition root — wires the StoragePort to its RxDB-backed adapter.
 * Mirrors `src/lib/storageAdapters.ts` `createProjectStorageAdapter()`
 * (factory-selects-adapter pattern), but with type-safe DI and no Tauri
 * runtime detection (single web target now).
 *
 * The `storage` engine is injected by the caller (browser code passes
 * `getRxStorageDexie()`, tests pass `getRxStorageMemory()`).
 *
 * This plan does NOT export a fully-wired `container` singleton — the
 * Task 4 UI only needs to call this factory once at app startup. The full
 * `container` object (llm/sync/content/export ports added) is created in
 * this same file by 01-04-PLAN.md.
 */
export async function createStorageAdapter(storage: RxStorage<unknown, unknown>): Promise<StoragePort> {
  const db = await createProjectDatabase(storage);
  return new RxdbStorageAdapter(db);
}
