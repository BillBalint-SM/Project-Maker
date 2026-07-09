---
phase: 02-felm-r-si-flow-s-coaching
plan: 01
subsystem: infra
tags: [react, mantine, react-hook-form, zustand, postcss, vite, use-debounce]

# Dependency graph
requires:
  - phase: 01-adat-alap-portok-perzisztencia-es-mvp-migracio
    provides: "React Router 7 data-router entry point (src/main.tsx), Vitest+jsdom test setup (src/test/setup.ts), RxDB/StoragePort persistence"
provides:
  - "React 19.2.7 runtime (upgraded from 18.3.1)"
  - "Mantine 9.4.1 (@mantine/core, @mantine/hooks) wired into src/main.tsx via MantineProvider + createTheme"
  - "React Hook Form 7.81.0 + @hookform/resolvers 5.4.0 available for future checklist/form plans"
  - "Zustand 5.0.14 available for future UI-only state (e.g. checklistUiStore)"
  - "use-debounce 10.1.1 available for autosave hook"
  - "postcss.config.cjs resolving Mantine CSS variables under Vite"
  - "window.matchMedia jsdom mock in src/test/setup.ts for Mantine component tests"
affects: [02-05, 02-06, 02-07, 02-08]

# Tech tracking
tech-stack:
  added: ["react@19", "react-dom@19", "@mantine/core@9", "@mantine/hooks@9", "react-hook-form@7", "@hookform/resolvers@5", "zustand@5", "use-debounce@10", "postcss-preset-mantine@1", "postcss-simple-vars@7", "@types/react@19", "@types/react-dom@19"]
  patterns: ["8-point spacing/typography Mantine theme contract (createTheme with explicit px spacing/fontSizes, not Mantine's default rem scale)", "jsdom matchMedia stub for Mantine hooks under Vitest"]

key-files:
  created: ["postcss.config.cjs"]
  modified: ["package.json", "pnpm-lock.yaml", "src/main.tsx", "src/test/setup.ts"]

key-decisions:
  - "@types/react/@types/react-dom bumped to @19 alongside the react/react-dom runtime bump (not explicitly listed in 02-RESEARCH.md's install command, but required — tsc --noEmit would fail on JSX/type mismatches otherwise; plan Task 2 anticipated this explicitly)"
  - "Package legitimacy checkpoint (Task 1) confirmed via npm registry metadata (npm view repository.url/maintainers) for @mantine/core, @mantine/hooks, react-hook-form before install — all three matched the audited source repos (mantinedev/mantine, react-hook-form/react-hook-form), no typosquat indicators; user approved with 'jóváhagyva'"
  - "MantineProvider wraps the existing RouterProvider without touching router configuration (createBrowserRouter/single route unchanged) — Task 3 scope was strictly the provider+theme wrap, not routing changes"

requirements-completed: [SURVEY-02, SURVEY-05]

coverage:
  - id: D1
    description: "React 19 + Mantine 9 + RHF 7 + Zustand 5 + use-debounce stack installed and pinned in package.json/pnpm-lock.yaml at exact versions from 02-RESEARCH.md Standard Stack"
    requirement: SURVEY-02
    verification:
      - kind: unit
        ref: "pnpm ls @mantine/core react-hook-form zustand use-debounce (Task 2 automated verify) - confirmed @mantine/core@9.4.1, react-hook-form@7.81.0, use-debounce@10.1.1, zustand@5.0.14"
        status: pass
    human_judgment: false
  - id: D2
    description: "postcss.config.cjs resolves Mantine CSS variables (postcss-preset-mantine + postcss-simple-vars breakpoints) so Mantine component styles render correctly under Vite"
    requirement: SURVEY-05
    verification:
      - kind: integration
        ref: "pnpm run build (vite build succeeded, dist/assets/index-*.css generated at 240.33 kB, no unresolved CSS-variable warnings)"
        status: pass
    human_judgment: false
  - id: D3
    description: "MantineProvider + createTheme (8-point spacing/typography contract, brandTeal primary color) wraps the existing RouterProvider in src/main.tsx without altering router config"
    requirement: SURVEY-05
    verification:
      - kind: unit
        ref: "pnpm run checkpoint (tsc --noEmit + vitest run: 15 test files / 48 tests passed + vite build) - all green after the MantineProvider wrap"
        status: pass
    human_judgment: false
  - id: D4
    description: "window.matchMedia mock added to src/test/setup.ts so Mantine components (Accordion, Modal, Tabs) don't crash under jsdom in future Wave-2 tests"
    requirement: SURVEY-05
    verification:
      - kind: unit
        ref: "vitest run (existing 48-test suite passed with the mock present; no test in this plan yet exercises a Mantine component directly, so absence-of-crash is the proof available at this plan's scope)"
        status: pass
    human_judgment: false

duration: ~5min (excluding checkpoint-approval wait)
completed: 2026-07-09
status: complete
---

# Phase 2 Plan 01: React 19 + Mantine 9 + RHF 7 + Zustand 5 Stack Upgrade Summary

**Upgraded React 18.3.1→19.2.7 and introduced Mantine 9.4.1 (with an explicit 8-point createTheme), React Hook Form 7.81, Zustand 5.0.14, and use-debounce 10.1.1 — the foundation stack every Phase 2 Wave-2 UI plan builds on.**

## Performance

- **Duration:** ~5 min active execution (paused for a blocking human-verify package-legitimacy checkpoint before resuming)
- **Completed:** 2026-07-09
- **Tasks:** 3/3 (Task 1 checkpoint approved by user, Task 2 + Task 3 executed)
- **Files modified:** 5 (package.json, pnpm-lock.yaml, postcss.config.cjs [new], src/main.tsx, src/test/setup.ts)

## Accomplishments
- Installed React 19.2.7, Mantine 9.4.1 (`@mantine/core`, `@mantine/hooks`), React Hook Form 7.81.0, `@hookform/resolvers` 5.4.0, Zustand 5.0.14, `use-debounce` 10.1.1, plus dev deps `@types/react@19`, `@types/react-dom@19`, `postcss-preset-mantine@1`, `postcss-simple-vars@7` — all at the exact versions verified in `02-RESEARCH.md`
- Created `postcss.config.cjs` following Mantine's official Vite guide (postcss-preset-mantine + postcss-simple-vars breakpoints)
- Wrapped the existing React Router 7 `RouterProvider` in `MantineProvider` with a `createTheme()` enforcing the UI-SPEC's 8-point spacing/typography contract (brandTeal primary palette, Inter font stack, defaultRadius 8px) in `src/main.tsx`
- Added a `window.matchMedia` jsdom mock to `src/test/setup.ts` so Mantine's internal hooks don't crash future component tests
- Full `pnpm run checkpoint` (typecheck + 48-test suite + build) green after the React 18→19 and Mantine 9 introduction — no existing test broke

## Task Commits

Each task was committed atomically:

1. **Task 1: Csomag-legitimitás ellenőrzés** - checkpoint only, no commit (human-verify gate; user approved "jóváhagyva" after npm registry cross-check of `@mantine/core`, `@mantine/hooks`, `react-hook-form`)
2. **Task 2: Csomagok telepítése + PostCSS-konfiguráció** - `f65fd44` (feat)
3. **Task 3: MantineProvider + téma bevezetése, matchMedia teszt-mock, teljes checkpoint** - `15b1dbe` (feat)

**Plan metadata:** commit pending (this SUMMARY + STATE/ROADMAP/REQUIREMENTS update)

## Files Created/Modified
- `postcss.config.cjs` - New. postcss-preset-mantine + postcss-simple-vars (breakpoint variables xs–xl) for resolving Mantine CSS vars under Vite
- `src/main.tsx` - Added `@mantine/core/styles.css` import, `MantineProvider`/`createTheme` (8-point theme), wraps existing `RouterProvider`
- `src/test/setup.ts` - Added `window.matchMedia` mock (always `matches: false`) below the existing `scrollIntoView` mock
- `package.json` / `pnpm-lock.yaml` - New dependency versions (react/react-dom@19, @mantine/core@9, @mantine/hooks@9, react-hook-form@7, @hookform/resolvers@5, zustand@5, use-debounce@10, @types/react@19, @types/react-dom@19, postcss-preset-mantine@1, postcss-simple-vars@7)

## Decisions Made
- Bumped `@types/react`/`@types/react-dom` to `@19` alongside the runtime packages even though `02-RESEARCH.md`'s literal install command only listed runtime packages — the plan's Task 2 explicitly called this out as technically required (otherwise `tsc --noEmit` fails on JSX/type mismatches against React 19).
- Verified package legitimacy for the 3 SUS-flagged packages (`@mantine/core`, `@mantine/hooks`, `react-hook-form`) via `npm view <pkg> repository.url maintainers time.modified` before requesting human approval — all three resolved to the expected source repos (`mantinedev/mantine`, `react-hook-form/react-hook-form`), reinforcing the audit's "too-new false positive" conclusion. User approved with "jóváhagyva".
- Kept router configuration (`createBrowserRouter`, single `/` route) untouched in Task 3 — only wrapped it in `MantineProvider`, per the plan's explicit scope boundary.

## Deviations from Plan

None - plan executed exactly as written (including the anticipated `@types/react`/`@types/react-dom` bump, which the plan itself flagged as required-but-not-in-the-literal-install-command).

## Issues Encountered
- `corepack pnpm` had to be used instead of bare `pnpm` (the executor's Bash shell PATH did not expose a global `pnpm` binary, but `corepack` — bundled with the pinned Node.js install — resolved it correctly to pnpm v11.10.0, matching the project's `pnpm-lock.yaml`). No functional impact; commands and outputs were otherwise identical to the plan's literal `pnpm add`/`pnpm run checkpoint` steps.
- Vite build reports one chunk (`dist/assets/index-*.js`, 633.75 kB / 197.77 kB gzip) exceeding the 500 kB warning threshold, attributable to the new Mantine + React 19 bundle. This is a pre-existing build-warning class (not a new correctness/security issue) and out of this plan's scope (Task 3 only asked for a green checkpoint, not bundle-size optimization) — logged here for awareness; a future UI plan may want dynamic `import()` code-splitting once more routes exist.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- The full Mantine 9 + React 19 + RHF 7 + Zustand 5 stack is installed, themed, and verified against the complete existing test suite and production build.
- Wave 2 UI plans (02-05..02-08 — checklist card list, coaching panel, project list/create modal, cockpit/decision panels) can now import `@mantine/core`, `@mantine/hooks`, `react-hook-form`, `zustand`, and `use-debounce` directly; `src/test/setup.ts` already covers the `matchMedia` gap for any test rendering Mantine components (Accordion, Modal, Tabs).
- No blockers identified for downstream plans.

---
*Phase: 02-felm-r-si-flow-s-coaching*
*Completed: 2026-07-09*
