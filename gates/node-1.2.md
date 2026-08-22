# Gates: application and runtime integration

Scope: UI/queue and contracts/container simplification preserve business behavior together.

- [x] G1: Every UI/queue leaf gate passes.
  CHECK: node C:/Users/littl/.codex/skills/unlazy/scripts/gate-check.mjs --status gates/leaf-1.2.1.md
  EXPECT: ALL MET
  EVIDENCE: gates/leaf-1.2.1.md: 6 gates | ALL MET (6 met)

- [x] G2: Every contracts/container leaf gate passes.
  CHECK: node C:/Users/littl/.codex/skills/unlazy/scripts/gate-check.mjs --status gates/leaf-1.2.2.md
  EXPECT: ALL MET
  EVIDENCE: gates/leaf-1.2.2.md: 5 gates | ALL MET (5 met)

- [x] G3: The Angular production build passes after runtime dependency changes.
  CHECK: npx.cmd --yes pnpm@11.20.0 --filter @project-maker/web build
  EXPECT: Application bundle generation complete
  EVIDENCE: npm notice run pnpm --filter @project-maker/web build | $ ng build

- [x] G4: The API production build resolves the same contracts export as the tests.
  CHECK: npx.cmd --yes pnpm@11.20.0 --filter @project-maker/api build
  EXPECT: nest build
  EVIDENCE: npm notice run pnpm --filter @project-maker/api build | $ nest build

- [x] G5: Focused queue and return-context evidence remains.
  EVIDENCE: 2026-08-22 — 14/14 PostgreSQL queue e2e, 2/2 cursor unit, and 75/75 Angular tests pass; return URL/history code is untouched.
