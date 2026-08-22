# Gates: UX audit runtime branch

Scope: integrate shell recovery and Project workflow safety.

- [x] G1: The shell leaf is parent-verified.
  CHECK: node C:/Users/littl/.codex/skills/unlazy/scripts/gate-check.mjs --status gates/ux-audit-shell.md
  EXPECT: ALL MET
  EVIDENCE: gates/ux-audit-shell.md: 6 gates | ALL MET (6 met)

- [x] G2: The Project safety leaf is parent-verified after the out-of-order Formal Decision Retry correction.
  CHECK: node C:/Users/littl/.codex/skills/unlazy/scripts/gate-check.mjs --status gates/ux-audit-project-safety.md
  EXPECT: ALL MET
  EVIDENCE: gates/ux-audit-project-safety.md: 6 gates | ALL MET (6 met)

- [x] G3: All web component tests pass after the two leaves compose.
  CHECK: npx.cmd --yes pnpm@11.20.0 --dir apps/web test
  EXPECT: /[1-9][0-9]* passed/
  EVIDENCE: (node:39812) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided. | (Use `node --trace-warnings ...` to show where the warning was created)

- [x] G4: The Angular application typechecks and production-builds without budget regression.
  CHECK: npx.cmd --yes pnpm@11.20.0 --dir apps/web typecheck && npx.cmd --yes pnpm@11.20.0 --dir apps/web build
  EXPECT: /Application bundle generation complete/
  EVIDENCE: ▲ [WARNING] src/app/settings/question-bank.page.scss exceeded maximum budget. Budget 4.00 kB was not met by 26 bytes with a total of 4.03 kB. | ▲ [WARNING] src/app/interviews/interview.page.scss excee

- [x] G5: Driver adversarial review confirms no polling, global command manager, duplicate draft editor, weakened server guard, or stale Formal Decision availability result.
  EVIDENCE: Reviewed the composed shell, Customer Follow-up Settings, and Formal Decision diff after the final correction. Recovery remains feature-local and deliberate; no timer or shared command coordinator was added. Settings links to the existing correspondence composer. The existing `FOLLOW_UP_DRAFT_REQUIRED` and archived-Project API guards remain unchanged. Account-scoped badges reject prior-session publications, and a monotonically increasing availability request id rejects every older Formal Decision result.
