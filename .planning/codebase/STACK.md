# Technology Stack

**Analysis Date:** 2026-07-08

## Languages

**Primary:**
- TypeScript 5.5.4 (strict mode) - All frontend source (`src/`)
- Rust (edition 2021) - Tauri desktop backend (`src-tauri/src/`)

**Secondary:**
- HTML - Single entry point `index.html`
- CSS - Global styles `src/styles.css`

## Runtime

**Environment:**
- Node.js (version not pinned; no `.nvmrc` or `.node-version` in repo; CI uses Node 22 — see `.github/workflows/ci.yml`)
- Rust toolchain via Cargo (dependency versions locked in `src-tauri/Cargo.lock`)

**Package Manager:**
- pnpm (workspace config in `pnpm-workspace.yaml`; CI pins pnpm 11.5.3 in `.github/workflows/ci.yml`)
- Lockfile: `pnpm-lock.yaml` present (committed)
- Cargo lockfile: `src-tauri/Cargo.lock` present (committed)

## Frameworks

**Core:**
- React 18.3.1 - UI rendering, no external state manager (`src/App.tsx`, `src/features/`)
- Tauri 2.0 (`@tauri-apps/api` ^2.0.0, `@tauri-apps/cli` ^2.0.0, Rust crate `tauri = "2"`) - Desktop app shell, native IPC bridge, OS integration, Windows installer packaging

**Testing:**
- Vitest 4.1.9 - Test runner and assertion library, config embedded in `vite.config.ts`
- @testing-library/react 16.3.2 - Component testing
- @testing-library/user-event 14.6.1 - User interaction simulation
- @testing-library/jest-dom 6.9.1 - DOM matchers
- jsdom 29.1.1 - DOM environment for tests (`environment: "jsdom"` in `vite.config.ts`)
- Test setup file: `src/test/setup.ts`

**Build/Dev:**
- Vite 8.0.16 - Dev server (port 5173) and production bundler (`vite.config.ts`)
- @vitejs/plugin-react 6.0.2 - React Fast Refresh and JSX transform
- TypeScript compiler (`tsc`) - Type checking, runs before build (`npm run build` = `tsc && vite build`)

## Key Dependencies

**Critical:**
- `@tauri-apps/api` ^2.0.0 - Frontend-to-Rust IPC bridge, used in `src/lib/storageAdapters.ts` and `src/lib/export.ts`
- `rusqlite` 0.32 (bundled feature) - Embedded SQLite for offline data storage, `src-tauri/src/lib.rs`
- `serde` / `serde_json` 1 - Rust JSON serialization for IPC payloads, `src-tauri/src/lib.rs`

**Infrastructure:**
- `jspdf` ^4.2.1 - PDF generation (landscape A4), `src/lib/export.ts`
- `jspdf-autotable` ^5.0.8 - Table rendering inside generated PDFs, `src/lib/export.ts`
- `pdfmake` ^0.2.20 / `@types/pdfmake` ^0.2.11 - Supplies VFS font bundle (Roboto TTF) used by jsPDF, `src/lib/export.ts`
- `fflate` ^0.8.3 - In-memory ZIP compression used to hand-assemble `.xlsx` files, `src/lib/export.ts`
- `lucide-react` ^0.468.0 - SVG icon set for UI components

## Configuration

**Environment:**
- No `.env` files present in the repo
- No runtime environment variables required by the frontend
- App is fully offline — no server-side config needed

**Build:**
- `tsconfig.json`: `strict: true`, `target: ES2020`, `moduleResolution: Node`, `jsx: react-jsx`, no path aliases
- `vite.config.ts`: shared config for dev server and Vitest; dev server on port 5173 (`strictPort: false`); `src-tauri/target` excluded from file watching
- `src-tauri/tauri.conf.json`: window size 1280x820 (min 960x680), bundle target `nsis` (Windows installer), dev URL `http://127.0.0.1:5173`, `frontendDist: ../dist`, CSP disabled (`security.csp: null`)
- `src-tauri/capabilities/default.json`: Tauri permission set restricted to `core:default` only
- `pnpm-workspace.yaml`: disables `core-js` build script, allows `esbuild` build script

## Platform Requirements

**Development:**
- Node.js + pnpm
- Rust toolchain + Cargo
- Tauri CLI (`@tauri-apps/cli` ^2.0.0)

**Production:**
- Windows desktop only (Tauri bundle target: `nsis`)
- Installer languages: Hungarian (primary, custom language file `src-tauri/windows/nsis/Hungarian.nsh`), English (secondary)
- App identifier: `com.projectmaker.desktop`
- Install mode: `currentUser`
- CI: GitHub Actions, `windows-latest` runner, runs `pnpm install --frozen-lockfile` then `pnpm checkpoint` (typecheck + test + build) — `.github/workflows/ci.yml`

---

*Stack analysis: 2026-07-08*
