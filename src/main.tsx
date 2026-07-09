import "@mantine/core/styles.css";
import { MantineProvider, createTheme } from "@mantine/core";
import { createRoot } from "react-dom/client";
import { createBrowserRouter } from "react-router";
import { RouterProvider } from "react-router/dom";
import { getRxStorageDexie } from "rxdb/plugins/storage-dexie";
import { createStorageAdapter } from "./app/container";
import type { StoragePort } from "./domain/ports/StoragePort";
import { ProjectListView } from "./features/projects/ProjectListView";
import "./styles.css";

// 8-point spacing/typography contract (02-UI-SPEC.md "Mantine theme setup") —
// Mantine's default rem-based spacing scale does NOT match this project's
// 8-point px scale, so every token is explicitly overridden here.
const theme = createTheme({
  fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  primaryColor: "brandTeal",
  colors: {
    // 10-shade Mantine palette generated around the existing --primary (#126b68)
    brandTeal: [
      "#e6f5f4", "#c7e6e3", "#a3d6d1", "#7ec5bf", "#5fb5ad",
      "#126b68", "#0f5653", "#0c4341", "#093230", "#062221"
    ]
  },
  spacing: { xs: "4px", sm: "8px", md: "16px", lg: "24px", xl: "32px" },
  fontSizes: { xs: "14px", sm: "14px", md: "16px", lg: "20px", xl: "28px" },
  defaultRadius: "8px"
});

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

createRoot(document.getElementById("root")!).render(
  <MantineProvider theme={theme}>
    <RouterProvider router={router} />
  </MantineProvider>
);
