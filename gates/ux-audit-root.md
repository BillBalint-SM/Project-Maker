# Gates: UX-AUDIT-001 through UX-AUDIT-006 complete

Scope: prove all six accepted audit items are resolved with proportional regression coverage and unchanged business rules.

- [x] G1: Runtime recovery and workflow safety branch is fully met.
  CHECK: node C:/Users/littl/.codex/skills/unlazy/scripts/gate-check.mjs --status gates/ux-audit-node-runtime.md
  EXPECT: ALL MET
  EVIDENCE: gates/ux-audit-node-runtime.md: 5 gates | ALL MET (5 met)

- [x] G2: Contract and professional-English branch is fully met.
  CHECK: node C:/Users/littl/.codex/skills/unlazy/scripts/gate-check.mjs --status gates/ux-audit-node-quality.md
  EXPECT: ALL MET
  EVIDENCE: gates/ux-audit-node-quality.md: 5 gates | ALL MET (5 met)

- [x] G3: Repository typechecks and all production builds pass after integration.
  CHECK: npx.cmd --yes pnpm@11.20.0 typecheck && npx.cmd --yes pnpm@11.20.0 build
  EXPECT: /Application bundle generation complete/
  EVIDENCE: npm notice run pnpm build | $ pnpm -r --if-present build

- [x] G4: The complete web component suite passes once after integration.
  CHECK: npx.cmd --yes pnpm@11.20.0 --dir apps/web test
  EXPECT: /[1-9][0-9]* passed/
  EVIDENCE: (node:22344) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided. | (Use `node --trace-warnings ...` to show where the warning was created)

- [x] G5: The audit ledger marks exactly UX-AUDIT-001 through UX-AUDIT-006 resolved with evidence links.
  CHECK: rg -n "UX-AUDIT-00[1-6].*RESOLVED|\[x\].*UX-AUDIT-00[1-6]" docs/user-facing-runtime-audit-2026-08-22.md
  EXPECT: UX-AUDIT-006
  EVIDENCE: 209:- [x] `UX-AUDIT-005` successful optional-resource absence contract | 210:- [x] `UX-AUDIT-006` professional-English completion and documentation alignment

- [x] G6: The final diff is structurally clean and contains no new TODO/FIXME in the remediation scope.
  CHECK: git diff --check && node -e "const cp=require('node:child_process');const diff=cp.execFileSync('git',['diff','--unified=0','--','apps/web','apps/api','docs','README.md','CONTEXT.md','PLAN.md'],{encoding:'utf8'});if(/^\+.*(?:TODO|FIXME)/m.test(diff)){process.exit(1)}console.log('No added TODO or FIXME')"
  EXPECT: No added TODO or FIXME
  EVIDENCE: warning: in the working copy of 'docs/roadmap.md', LF will be replaced by CRLF the next time Git touches it | warning: in the working copy of 'docs/user-guide.md', LF will be replaced by CRLF the next

- [ ] G7: One independent final code review finds no unresolved P1/P2 Standards or specification issue.
  EVIDENCE: pending

- [ ] G8: Final report counts and validation claims are re-measured from gate status and command output.
  EVIDENCE: pending

- [x] G9: One focused real-browser batch proves the four user-facing P2 recoveries at a supported desktop width.
  CHECK: npx.cmd --yes pnpm@11.20.0 --dir apps/web exec playwright test e2e/ux-audit-remediation.spec.ts
  EXPECT: /4 passed/
  EVIDENCE: [WebServer] | [WebServer] 22:23:03 [vite] (client) [console.error] Project API request failed. {"action":"load the projects","status":503,"statusText":"Service Unavailable"}
