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
  EVIDENCE: (node:44540) ExperimentalWarning: localStorage is not available because --localstorage-file was not provided. | (Use `node --trace-warnings ...` to show where the warning was created)

- [x] G5: The audit ledger marks exactly UX-AUDIT-001 through UX-AUDIT-006 resolved with evidence links.
  CHECK: rg -n "UX-AUDIT-00[1-6].*RESOLVED|\[x\].*UX-AUDIT-00[1-6]" docs/user-facing-runtime-audit-2026-08-22.md
  EXPECT: UX-AUDIT-006
  EVIDENCE: 209:- [x] `UX-AUDIT-005` successful optional-resource absence contract | 210:- [x] `UX-AUDIT-006` professional-English completion and documentation alignment

- [x] G6: The complete baseline-to-HEAD plus working-tree diff is structurally clean and contains no new TODO/FIXME in the remediation scope.
  CHECK: git diff --check 4632fe536d7bddce7865a144bfb3a30f77f7a963...HEAD && git diff --check && node -e "const cp=require('node:child_process');const scope=['--','apps/web','apps/api','docs','gates',':(exclude)gates/ux-audit-root.md','.agents/skills/project-maker-angular-conventions','README.md','CONTEXT.md','PLAN.md'];const committed=cp.execFileSync('git',['diff','--unified=0','4632fe536d7bddce7865a144bfb3a30f77f7a963...HEAD',...scope],{encoding:'utf8'});const working=cp.execFileSync('git',['diff','--unified=0',...scope],{encoding:'utf8'});if(/^\+.*(?:TODO|FIXME)/m.test(committed+'\n'+working))process.exit(1);console.log('No added TODO or FIXME')"
  EXPECT: No added TODO or FIXME
  EVIDENCE: warning: in the working copy of 'PLAN.md', LF will be replaced by CRLF the next time Git touches it | warning: in the working copy of 'docs/user-facing-runtime-audit-2026-08-22.md', LF will be replace

- [x] G7: One independent final code review finds no unresolved P1/P2 Standards or specification issue.
  EVIDENCE: Independent Standards and specification reviewers inspected `4632fe536d7bddce7865a144bfb3a30f77f7a963...c5c9afb` and found no unresolved P1/P2. The adversarial reviewer then found one P2 out-of-order Formal Decision Retry race. Commit `07c875b` added latest-request-only acceptance plus a red-first regression detector. Independent adversarial and specification re-reviews of `4632fe536d7bddce7865a144bfb3a30f77f7a963...07c875b` found no unresolved P1/P2.

- [x] G8: Final report counts and validation claims are re-measured from gate status and command output.
  EVIDENCE: Re-measured 2026-08-22: 20/20 leaf gates; 10/10 branch gates; 31/31 web test files and 104/104 component tests; 6/6 focused Formal Decision tests; 2/2 adjacent API suites and 5/5 tests on a freshly migrated database; 4/4 focused real-browser recoveries; repository typecheck and both production builds passed. The final root run is 9/9.

- [x] G9: One focused real-browser batch proves the four user-facing P2 recoveries at a supported desktop width.
  CHECK: npx.cmd --yes pnpm@11.20.0 --dir apps/web exec playwright test e2e/ux-audit-remediation.spec.ts
  EXPECT: /4 passed/
  EVIDENCE: [WebServer] | [WebServer] 23:16:09 [vite] (client) [console.error] Project API request failed. {"action":"load the projects","status":503,"statusText":"Service Unavailable"}
