# Technology Stack

**Analysis Date:** 2026-07-08

## Languages

**Primary:**
- TypeScript 5.5.4 - All frontend source (`src/`)
- Rust (edition 2021) - Tauri backend (`src-tauri/src/`)

**Secondary:**
- HTML - Single entry point `index.html`
- CSS - Global styles `src/styles.css`

## Runtime

**Environment:**
- Node.js (version not pinned; no `.nvmrc` or `.node-version` found)
- Rust toolchain via Cargo (version tracked in `src-tauri/Cargo.lock`)

**Package Manager:**
- pnpm (workspace config in `pnpm-workspace.yaml`)
- Lockfile: `pnpm-lock.yaml` present

## Frameworks

**Core:**
- React 18.3.1 - UI rendering (`src/`)
- Tauri 2.0 - Desktop app shell, native IPC, OS integration (`src-tauri/`)

**Testing:**
- Vitest 4.1.9 - Test runner and assertion library (config in `vite.config.ts`)
- @testing-library/react 16.3.2 - Component testing
- @testing-library/user-event 14.6.1 - User interaction simulation
- jsdom 29.1.1 - DOM environment for tests

**Build/Dev:**
- Vite 8.0.16 - Dev server and production bundler (`vite.config.ts`)
- @vitejs/plugin-react 6.0.2 - React Fast Refresh and JSX transform

## Key Dependencies

**Critical:**
- `@tauri-apps/api` ^2.0.0 - Frontend-to-Rust IPC bridge (`src/lib/storageAdapters.ts`, `src/lib/export.ts`)
- `react` / `react-dom` ^18.3.1 - UI layer
- `rusqlite` 0.32 (bundled) - Embedded SQLite for offline data storage (`src-tauri/src/lib.rs`)
- `serde` / `serde_json` 1 - Rust JSON serialization for IPC payloads (`src-tauri/src/lib.rs`)

**Export / Document Generation:**
- `jspdf` ^4.2.1 - PDF generation (landscape A4, `src/lib/export.ts`)
- `jspdf-autotable` ^5.0.8 - Table rendering inside PDFs (`src/lib/export.ts`)
- `pdfmake` ^0.2.20 - Provides VFS font bundle (Roboto TTF, `src/lib/export.ts`)
- `fflate` ^0.8.3 - In-memory ZIP compression for `.xlsx` file assembly (`src/lib/export.ts`)

**Icons:**
- `lucide-react` ^0.468.0 - SVG icon set used in UI components

## Configuration

**TypeScript:**
- `tsconfig.json`: `strict: true`, target `ES2020`, `moduleResolution: Node`, `jsx: react-jsx`
- No path aliases defined

**Build:**
- `vite.config.ts`: shared config for dev server (port 5173) and Vitest (`jsdom` environment, setup file `src/test/setup.ts`)
- `src-tauri/tauri.conf.json`: Tauri app config — window size (1280x820), bundle target `nsis` (Windows installer), dev URL `http://127.0.0.1:5173`

**Environment:**
- No `.env` files detected; no runtime environment variables required by the frontend
- Tauri capabilities defined in `src-tauri/capabilities/default.json` (`core:default` permissions only)

## Dev Tooling

**Type checking:** `tsc --noEmit` (run via `pnpm typecheck`)
**Linting/Formatting:** No ESLint, Prettier, or Biome config detected
**Scripts:**
```bash
pnpm dev          # Vite dev server only (frontend)
pnpm tauri:dev    # Full Tauri app in dev mode
pnpm test         # Vitest single-run
pnpm typecheck    # TypeScript check
pnpm build        # tsc + Vite production build
pnpm checkpoint   # typecheck + test + build (CI gate)
pnpm tauri:build  # Tauri production bundle (NSIS installer)
```

## Platform Requirements

**Development:**
- Node.js + pnpm
- Rust toolchain + Cargo
- Tauri CLI (`@tauri-apps/cli` ^2.0.0)

**Production:**
- Windows desktop only (bundle target: `nsis`)
- Installer language: Hungarian (primary), English (secondary)
- App identifier: `com.projectmaker.desktop`

---

*Stack analysis: 2026-07-08*
