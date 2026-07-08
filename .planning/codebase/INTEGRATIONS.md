# External Integrations

**Analysis Date:** 2026-07-08

## Tauri IPC Commands

All Rust commands are registered in `src-tauri/src/lib.rs` via `tauri::generate_handler![]` and invoked from the frontend using `@tauri-apps/api/core`'s `invoke()`.

| Command | Rust Function | Purpose |
|---------|---------------|---------|
| `project_storage_info` | `project_storage_info()` | Returns storage mode ("SQLite") and absolute DB path |
| `list_projects_native` | `list_projects_native(archived: bool)` | Returns `[{id, data}]` rows from SQLite, filtered by archived state |
| `get_project_native` | `get_project_native(id: String)` | Returns a single `{id, data}` row or null |
| `save_project_native` | `save_project_native(record: ProjectRecordInput)` | Upserts a project row (INSERT OR UPDATE ON CONFLICT) |
| `delete_project_native` | `delete_project_native(id: String)` | Hard-deletes a project row by id |
| `save_export_file` | `save_export_file(file_name: String, bytes: Vec<u8>)` | Writes binary export file to `<app_dir>/exports/` on disk |

**Frontend invocation pattern** (`src/lib/storageAdapters.ts`, `src/lib/export.ts`):
```typescript
const { invoke } = await import("@tauri-apps/api/core");
await invoke("save_project_native", { record: toProjectRecord(project) });
```

**Runtime detection:** Both `storageAdapters.ts` and `export.ts` check `window.__TAURI_INTERNALS__` or `window.__TAURI__` to decide whether to use Tauri IPC or browser fallbacks.

## Data Persistence

**Primary (Tauri desktop runtime):**
- SQLite via `rusqlite` 0.32 (bundled, no external SQLite install needed)
- Database file: `<app_executable_dir>/data/project-maker.db`
- Created automatically on first run (`CREATE TABLE IF NOT EXISTS`)
- Schema (single table `projects`):
  ```sql
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  status TEXT NOT NULL,
  priority TEXT NOT NULL,
  deadline TEXT NOT NULL,
  completion_state TEXT NOT NULL,
  completion_percent INTEGER NOT NULL,
  archived_at TEXT,
  updated_at TEXT NOT NULL,
  data TEXT NOT NULL   -- full JSON blob of the Project object
  ```
- Project data is stored twice: individual indexed columns for querying + full JSON in `data` column

**Fallback (browser / non-Tauri runtime):**
- `localStorage` under key `project-maker.projects.v1`
- Implemented in `src/lib/storageAdapters.ts` as `LocalProjectStorageAdapter`
- Full project list stored as a single JSON array

**Storage abstraction layer:**
- Interface: `ProjectStorageAdapter` (`src/lib/storageTypes.ts`)
- Adapters: `TauriSqliteProjectStorageAdapter`, `LocalProjectStorageAdapter` (`src/lib/storageAdapters.ts`)
- Factory: `createProjectStorageAdapter()` auto-selects at init time
- Repository: `ProjectRepository` (`src/lib/storage.ts`) — singleton exported as `projectRepository`

## File System / OS Integrations

**Export file saving (Tauri only):**
- Rust command `save_export_file` writes binary bytes to `<app_dir>/exports/<sanitized_filename>`
- Directory is created automatically (`fs::create_dir_all`)
- File names are sanitized (replaces `< > : " / \ | ? *` with `_`)
- Exposed via `src/lib/export.ts` → `saveExportBlob()`

**Browser fallback for exports:**
- Creates a temporary `<a download>` element and triggers a browser download
- No filesystem access; user chooses save location via browser dialog

**Database location:**
- `<app_executable_dir>/data/project-maker.db` (portable, relative to executable)

## Export / Document Generation

These are frontend-only integrations (no network calls):

**PDF export (`src/lib/export.ts`):**
- `jspdf` — generates landscape A4 PDF documents
- `jspdf-autotable` — renders key-value and data tables within PDFs
- `pdfmake` — supplies bundled VFS fonts (Roboto Regular + Medium TTF) loaded dynamically

**Excel (.xlsx) export (`src/lib/export.ts`):**
- Custom hand-written OOXML generation (no xlsx library)
- `fflate` — compresses OOXML XML files into a ZIP archive to form a valid `.xlsx` file

**Export presets** (`src/features/export/exportPreset.ts`): `executive`, `full`, `gaps`

## External APIs & Services

None. The application is fully offline. No HTTP calls to external services are made anywhere in the codebase.

## Authentication & Identity

Not applicable. Single-user offline desktop app; no authentication layer.

## Monitoring & Observability

**Error tracking:** None detected.
**Logging:** `console.warn` used for storage fallback warnings in `src/lib/storageAdapters.ts`. No structured logging framework.

## CI/CD & Deployment

**CI Pipeline:** GitHub Actions (`repo/.github/workflows/ci.yml`)
**Hosting:** Not applicable (desktop app distributed via NSIS installer)
**Bundle target:** Windows NSIS installer (`src-tauri/tauri.conf.json`)
**Code signing:** Documented in `docs/windows-code-signing.md` (PowerShell script at `scripts/Get-ReleaseSecurityReport.ps1`)

## Webhooks & Callbacks

**Incoming:** None
**Outgoing:** None

---

*Integration audit: 2026-07-08*
