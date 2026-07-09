---
phase: 02
slug: felm-r-si-flow-s-coaching
status: planned
nyquist_compliant: true
wave_0_complete: true
created: 2026-07-09
updated: 2026-07-09
---

# Phase 02 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.9 + @testing-library/react 16.3.2 + @testing-library/user-event 14.6.1 |
| **Config file** | `vite.config.ts` (`test.environment: "jsdom"`, `test.setupFiles: "src/test/setup.ts"`) |
| **Quick run command** | `pnpm test` (vitest run) — task-szintre szűkítve, pl. `pnpm vitest run src/domain/scoring` |
| **Full suite command** | `pnpm run checkpoint` (`typecheck && test && build`) |
| **Estimated runtime** | not measured yet — baseline TBD after Wave 0 (Phase 1 suite currently runs in low single-digit seconds) |

---

## Sampling Rate

- **After every task commit:** Run `pnpm vitest run <task-érintett fájl(ok)>`
- **After every plan wave:** Run `pnpm run checkpoint` (typecheck + full test suite + build)
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** low single-digit seconds per task-scoped run (existing Phase 1 baseline)

---

## Per-Task Verification Map

> Wave-0-style tests were not delivered as a separate pre-wave; the planner embedded each one directly into its owning plan as a `tdd="true"` task (RED→GREEN). Task references below use `Plan NN / Task N` since these plans do not carry a separate formal Task ID token.

| Task Ref | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|--------|
| 02-05 / Task 1 | 02-05 | 2 | SURVEY-01, SURVEY-04 | — | N/A | unit (component) | `pnpm vitest run src/features/projects/CreateProjectModal.test.tsx` | ⬜ pending |
| 02-06 / Task 3 | 02-06 | 2 | SURVEY-02/05/14 | — | N/A | unit (component) | `pnpm vitest run src/features/survey/ChecklistCard.test.tsx` | ⬜ pending |
| 02-06 / Task 1 | 02-06 | 2 | SURVEY-03 | — | N/A | unit | `pnpm vitest run src/app/store/checklistUiStore.test.ts src/features/survey/useAutosave.test.ts` | ⬜ pending |
| 02-03 / Task 2 | 02-03 | 1 | SURVEY-06/07 | — | N/A | unit (regression) | `pnpm vitest run src/domain/scoring` | ⬜ pending |
| 02-04 / Task 2 | 02-04 | 1 | COACH-01/02/03 | — | N/A | unit | `pnpm vitest run src/adapters/content/staticContent.test.ts` | ⬜ pending |
| 02-02 / Task 2 | 02-02 | 1 | (migráció, D-03/playbookId) | T-02-02-01 (v1→v2 séma-migráció) | `migrationStrategies[1]` helyesen tölti fel `playbookId: "general"`-t v1-séma dokumentumon | unit | `pnpm vitest run src/adapters/storage/indexeddb/StorageAdapter.test.ts` | ⬜ pending |
| 02-02 / Task 3 | 02-02 | 1 | (regresszió, MIG-01) | T-02-02-02 (legacyImport playbookId backfill) | Meglévő 5 legacyImport teszt változatlanul zöld marad | unit (regression) | `pnpm vitest run src/adapters/migration/legacyImport.test.ts` | ⬜ pending |
| 02-04 / Task 1 | 02-04 | 1 | V5 Input Validation (statikus adat) | (hiányos/hibás CoachingContent build-időben észrevétlen) | Zod-parse + 30/30 lefedettség-teszt minden `content/coaching/` bejegyzésre | unit (smoke) | `pnpm vitest run src/content/coaching/general.test.ts` | ⬜ pending |
| 02-08 / Task 3 | 02-08 | 3 | SURVEY-02 (fixGap), SURVEY-03, SURVEY-05 | — | N/A | integration | `pnpm vitest run src/features/survey/SurveyView.test.tsx src/features/projects/ProjectListView.test.tsx` | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky — statuses flip to ✅/❌ during execution, not at plan time.*

---

## Wave 0 Requirements

Nincs külön Wave 0 pre-wave — a planner mind a 4 tételt a saját plánjába ágyazta `tdd="true"` taskként (RED→GREEN fegyelemmel), a Wave 1-2 részeként:

- [x] `src/domain/scoring/*.test.ts` — 02-03 / Task 2: legacy `src/lib/project.ts` scoring-tesztjeinek átemelése playbook-paraméteres formába, regresszió-teszttel a legacy referencia-értékek ellen.
- [x] `src/features/survey/useAutosave.test.ts` — 02-06 / Task 1: debounce időzítés tesztelése `vi.useFakeTimers()`-rel (a `checklistUiStore.test.ts`-szel együtt).
- [x] `src/content/coaching/general.test.ts` + ContentPort adapter teszt — 02-04 / Task 1 (30/30 lefedettség + Zod-validitás) és 02-04 / Task 2 (`staticContentAdapter` wiring).
- [x] `src/adapters/storage/indexeddb/StorageAdapter.test.ts` migrációs teszttel — 02-02 / Task 2 (v1 dokumentum → v2 upgrade → `playbookId: "general"`), plusz 02-02 / Task 3 a `legacyImport.ts` regressziója ellen.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Coaching-panel szöveg (miért/mit/hogyan/etikett) magyar nyelvi minősége és szakmai helyessége | COACH-01, COACH-02, COACH-03 | A tartalom szakmai/nyelvi minősége szubjektív ítélet, nem automatizálható assertion — csak a jelenléte/struktúrája (Zod-séma, 30/30 lefedettség) tesztelhető automatikusan | Fejlesztő vagy PM/BA átolvassa a `content/coaching/` katalógus mind a 30 bejegyzését, ellenőrzi a hangnemet és szakmai pontosságot a `02-CONTEXT.md`-ben rögzített elvek szerint |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify or Wave-0-equivalent inline `tdd="true"` coverage (confirmed by gsd-plan-checker across all 8 plans)
- [x] Sampling continuity: no 3 consecutive tasks without automated verify (plan-checker confirmed acceptance criteria + verify blocks on every task)
- [x] Wave 0 covers all MISSING references (delivered inline per plan, see Wave 0 Requirements above)
- [x] No watch-mode flags (`pnpm vitest run`, not `pnpm vitest` watch mode)
- [x] Feedback latency < 10s (task-scoped Vitest runs, Phase 1 baseline)
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** approved 2026-07-09 (gsd-plan-checker VERIFICATION PASSED, 0 blockers — see 02-01..02-08-PLAN.md `<threat_model>` blocks and acceptance criteria)
