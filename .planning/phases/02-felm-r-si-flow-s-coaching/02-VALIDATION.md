---
phase: 02
slug: felm-r-si-flow-s-coaching
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-07-09
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

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| TBD (planner assigns) | TBD | TBD | SURVEY-01 | — | N/A | unit | `pnpm vitest run src/features/projects/ProjectListView.test.tsx` | ✅ (bővítendő) | ⬜ pending |
| TBD | TBD | TBD | SURVEY-02/05/14 | — | N/A | unit (component) | `pnpm vitest run src/features/survey/ChecklistCard.test.tsx` | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | SURVEY-03 | — | N/A | unit | `pnpm vitest run src/features/survey/useAutosave.test.ts` | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | SURVEY-04 | — | N/A | unit (component) | `pnpm vitest run src/features/projects/CreateProjectModal.test.tsx` | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | SURVEY-06/07 | — | N/A | unit | `pnpm vitest run src/domain/scoring` | ❌ Wave 0 (logika átemelve, tesztek bővítendők) | ⬜ pending |
| TBD | TBD | TBD | COACH-01/02/03 | — | N/A | unit | `pnpm vitest run src/adapters/content/staticContent.test.ts` | ❌ Wave 0 | ⬜ pending |
| TBD | TBD | TBD | (migráció, D-03/playbookId) | T-02-01 (v0→v1 séma-migráció) | `migrationStrategies[1]` helyesen tölti fel `playbookId: "general"`-t v0-séma dokumentumon | unit | `pnpm vitest run src/adapters/storage/indexeddb/StorageAdapter.test.ts` | ✅ fájl létezik, teszteset bővítendő | ⬜ pending |
| TBD | TBD | TBD | V5 Input Validation (statikus adat) | T-02-02 (hiányos/hibás CoachingContent/Playbook build-időben észrevétlen) | Zod-parse minden `content/playbook/` és `content/coaching/` bejegyzésre | unit (smoke) | `pnpm vitest run src/adapters/content/staticContent.test.ts` | ❌ Wave 0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `src/domain/scoring/*.test.ts` — legacy `src/lib/project.ts` scoring-tesztjeinek átemelése playbook-paraméteres formába; ha nincs meglévő legacy teszt, új teszt írandó a legacy referencia-értékek ellen (30 tételes "Általános" playbook ugyanazt az eredményt adja, mint a régi hardcoded verzió).
- [ ] `src/features/survey/useAutosave.test.ts` — debounce időzítés tesztelése `vi.useFakeTimers()`-rel.
- [ ] `src/adapters/content/staticContent.test.ts` — ContentPort implementáció + a 30 coaching-bejegyzés jelenlétének smoke-tesztje (COACH-01/02 lefedettség: mind a 30 `PlaybookItem.id`-hez van `CoachingContent`), plusz Zod-parse minden bejegyzésre.
- [ ] `src/adapters/storage/indexeddb/StorageAdapter.test.ts` bővítése migrációs teszttel (v0 dokumentum → v1 upgrade → `playbookId: "general"`).

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|--------------------|
| Coaching-panel szöveg (miért/mit/hogyan/etikett) magyar nyelvi minősége és szakmai helyessége | COACH-01, COACH-02, COACH-03 | A tartalom szakmai/nyelvi minősége szubjektív ítélet, nem automatizálható assertion — csak a jelenléte/struktúrája (Zod-séma, 30/30 lefedettség) tesztelhető automatikusan | Fejlesztő vagy PM/BA átolvassa a `content/coaching/` katalógus mind a 30 bejegyzését, ellenőrzi a hangnemet és szakmai pontosságot a `02-CONTEXT.md`-ben rögzített elvek szerint |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
