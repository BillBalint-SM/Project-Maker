# Gates: UX audit runtime branch

Scope: integrate shell recovery and Project workflow safety.

- [x] G1: The shell leaf is parent-verified.
  CHECK: node C:/Users/littl/.codex/skills/unlazy/scripts/gate-check.mjs --status gates/ux-audit-shell.md
  EXPECT: ALL MET
  EVIDENCE: gates/ux-audit-shell.md: 6 gates | ALL MET (6 met)

- [x] G2: The Project safety leaf is parent-verified.
  CHECK: node C:/Users/littl/.codex/skills/unlazy/scripts/gate-check.mjs --status gates/ux-audit-project-safety.md
  EXPECT: ALL MET
  EVIDENCE: gates/ux-audit-project-safety.md: 6 gates | ALL MET (6 met)

- [x] G3: All web component tests pass after the two leaves compose.
  CHECK: npx.cmd --yes pnpm@11.20.0 --dir apps/web test
  EXPECT: /[1-9][0-9]* passed/
  EVIDENCE: (node:34160) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided. | (Use `node --trace-warnings ...` to show where the warning was created)

- [x] G4: The Angular application typechecks and production-builds without budget regression.
  CHECK: npx.cmd --yes pnpm@11.20.0 --dir apps/web typecheck && npx.cmd --yes pnpm@11.20.0 --dir apps/web build
  EXPECT: /Application bundle generation complete/
  EVIDENCE: ▲ [WARNING] src/app/interviews/interview.page.scss exceeded maximum budget. Budget 4.00 kB was not met by 175 bytes with a total of 4.17 kB. | ▲ [WARNING] src/app/settings/question-bank.page.scss exce

- [x] G5: Driver adversarial review confirms no polling, global command manager, duplicate draft editor, or weakened server guard.
  EVIDENCE: Reviewed the composed shell, Customer follow-up Settings, and Formal Decision diff. Recovery remains feature-local and deliberate; no timer or shared command coordinator was added. Settings links to the existing correspondence composer instead of rendering another editor. The existing `FOLLOW_UP_DRAFT_REQUIRED` and archived-Project API guards remain unchanged. Account-switch cancellation also preserves feature-local badge publications without accepting the shell's stale in-flight reads.
