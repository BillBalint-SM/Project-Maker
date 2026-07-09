import type { RxStorage } from "rxdb";
import { createProjectDatabase } from "../adapters/storage/indexeddb/db";
import { RxdbStorageAdapter } from "../adapters/storage/indexeddb/StorageAdapter";
import { NoopLlmAdapter } from "../adapters/llm/noop";
import { NoopSyncAdapter } from "../adapters/sync/noop";
import type { StoragePort } from "../domain/ports/StoragePort";
import type { LlmPort } from "../domain/ports/LlmPort";
import type { SyncPort } from "../domain/ports/SyncPort";

/**
 * NOTE — ContentPort/ExportPort are intentionally NOT wired into this
 * composition root yet: there is no concrete adapter for either. Binding
 * `ContentPort` (coaching-content catalog) is Phase 3's concern; binding
 * `ExportPort` (MD/PDF/Excel serializers) is Phase 4's concern. Both ports
 * already exist as type contracts in `domain/ports/`.
 *
 * Composition root — wires the StoragePort to its RxDB-backed adapter.
 * Mirrors `src/lib/storageAdapters.ts` `createProjectStorageAdapter()`
 * (factory-selects-adapter pattern), but with type-safe DI and no Tauri
 * runtime detection (single web target now).
 *
 * The `storage` engine is injected by the caller (browser code passes
 * `getRxStorageDexie()`, tests pass `getRxStorageMemory()`).
 */
export async function createStorageAdapter(storage: RxStorage<unknown, unknown>): Promise<StoragePort> {
  const db = await createProjectDatabase(storage);
  return new RxdbStorageAdapter(db);
}

/**
 * Feature-flag switchboard for the composition root. `llmEnabled` is the
 * future `LiveLlmAdapter` hook point — there is currently no live branch
 * anywhere in the codebase (no `LiveLlmAdapter` exists yet), so this flag
 * does not yet branch anything. A future v2/Phase 8 plan will turn this
 * into real conditional wiring (`config.llmEnabled ? liveLlm(...) :
 * NoopLlmAdapter`), per ARCHITECTURE.md Pattern 5.
 */
export const config = {
  llmEnabled: false
};

/**
 * Full composition root — wires all currently-bindable ports:
 * StoragePort -> RxDB adapter, LlmPort -> NoopLlmAdapter (always, config
 * has no live alternative yet), SyncPort -> NoopSyncAdapter (always).
 * ContentPort/ExportPort are deliberately absent (see note above).
 */
export async function createContainer(storage: RxStorage<unknown, unknown>): Promise<{
  storage: StoragePort;
  llm: LlmPort;
  sync: SyncPort;
}> {
  return {
    storage: await createStorageAdapter(storage),
    llm: NoopLlmAdapter,
    sync: NoopSyncAdapter
  };
}
