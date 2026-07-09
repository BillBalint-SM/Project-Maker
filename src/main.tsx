import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { createStorageAdapter } from "./app/container";
import type { StoragePort } from "./domain/ports/StoragePort";
import { ProjectListView } from "./features/projects/ProjectListView";
import "./styles.css";

// Module-level lazy singleton: the real (Dexie-backed) StoragePort is
// created once, on first use, and reused for the app's lifetime.
// ProjectListView imports `getStorage` from this module rather than
// creating its own adapter, so that repeated calls never re-open the
// "project-maker" RxDB database (which would throw DB8 "name already
// used"). Tests mock this module entirely, so the real Dexie storage is
// never touched under jsdom/vitest.
let storagePromise: Promise<StoragePort> | null = null;

export function getStorage(): Promise<StoragePort> {
  if (!storagePromise) {
    storagePromise = createStorageAdapter(getRxStorageDexie());
  }
  return storagePromise;
}

// Note: the legacy `src/App.tsx` is left untouched in the repo as a
// reference — it is no longer mounted. The entry point below is now the
// React Router 7 data router with the Walking Skeleton's single route.
const router = createBrowserRouter([{ path: "/", Component: ProjectListView }]);

createRoot(document.getElementById("root")!).render(<RouterProvider router={router} />);
