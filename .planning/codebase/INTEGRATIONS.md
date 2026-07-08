# External Integrations

**Analysis Date:** 2026-07-08

## APIs & External Services

**None.** Project Maker is an offline-first desktop application. No outbound network calls, third-party API clients, or SaaS SDKs were found in `src/` or `src-tauri/src/`. The only network-shaped strings in the codebase are XML namespace URIs used for constructing `.xlsx` file XML parts (`src/lib/export.ts`), which are not fetched at runtime.

## Data Storage

**Databases:**
- SQLite (embedded, via `rusqlite` 0.32 with the `bundled` feature — no external SQLite install required)
  - Access: Tauri IPC commands in `src-tauri/src/lib.rs` (`list_projects_native`, `get_project_native`, `save_project_native`, `delete_project_native`, `project_storage_info`)
  - Client: `TauriSqliteProjectStorageAdapter` in `src/lib/storageAdapters.ts`
  - Schema note: each project row stores queryable columns (`name`, `status`, etc.) alongside a duplicated full `Project` JSON blob in a `data` column; both must be kept in sync via `toProjectRecord()`

**Fallback storage:**
- Browser `localStorage`, used when not running inside the Tauri shell (e.g. plain browser/dev preview)
  - Implementation: `LocalProjectStorageAdapter` in `src/lib/storageAdapters.ts`
  - Selection: `createProjectStorageAdapter()` factory in `src/lib/storageTypes.ts` picks Tauri SQLite vs localStorage at runtime

**File Storage:**
- Local filesystem only, via Tauri's `save_export_file` command (`src-tauri/src/lib.rs`) — used for writing exported PDF/XLSX files to disk

**Caching:**
- None

## Authentication & Identity

**Auth Provider:**
- None — single-user local desktop app, no login/auth flow, no user accounts

## Monitoring & Observability

**Error Tracking:**
- None — no Sentry, Bugsnag, or similar service integrated

**Logs:**
- No structured logging framework detected; errors from async operations are caught with try/catch and surfaced in UI state (see `src/App.tsx`)

## CI/CD & Deployment

**Hosting:**
- Not applicable — distributed as a Windows desktop installer (NSIS), not deployed to a server/host

**CI Pipeline:**
- GitHub Actions (`.github/workflows/ci.yml`), `windows-latest` runner
  - Steps: checkout → setup pnpm 11.5.3 → setup Node 22 (pnpm cache) → `pnpm install --frozen-lockfile` → `pnpm checkpoint` (typecheck + vitest + build)
  - Triggers: push to `main`, pull requests targeting `main`
  - No deployment/release/publish step present in the workflow

## Environment Configuration

**Required env vars:**
- None found

**Secrets location:**
- Not applicable — no `.env` files, no secrets detected in the repository

## Webhooks & Callbacks

**Incoming:**
- None

**Outgoing:**
- None

## Tauri IPC Surface (internal, not external integration)

- `save_export_file` - writes exported files (PDF/XLSX) to disk
- `project_storage_info` - reports storage backend info
- `list_projects_native` / `get_project_native` / `save_project_native` / `delete_project_native` - SQLite-backed CRUD
- Capability scope: `src-tauri/capabilities/default.json` restricts the frontend to `core:default` permissions only (no filesystem/shell/http plugin permissions granted)

---

*Integration audit: 2026-07-08*
