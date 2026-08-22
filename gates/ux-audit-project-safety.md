# Gates: UX audit Project workflow safety

Scope: resolve UX-AUDIT-003 and UX-AUDIT-004 while retaining both server-side guards.

- [x] G1: Follow-up Settings prevents enabling without a draft and offers a direct route to the draft composer.
  CHECK: rg -n "customer-correspondences|customer-communication|messageDraft|Enable automated" apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.ts
  EXPECT: customer-correspondences
  EVIDENCE: apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html:273:            [routerLink]="['/projects', projectId(), 'customer-correspondences']" | apps/web/src/app/projects/custome

- [x] G2: The focused Customer follow-up prerequisite specification passes.
  CHECK: npx.cmd --yes pnpm@11.20.0 --dir apps/web exec ng test --watch=false --include=src/app/projects/customer-follow-up/customer-follow-up.component.spec.ts
  EXPECT: /[1-9][0-9]* passed/
  EVIDENCE: npm notice run project-maker@0.2.0 npx | npm notice run pnpm --dir apps/web exec ng test --watch=false --include=src/app/projects/customer-follow-up/customer-follow-up.component.spec.ts

- [x] G3: Formal Decision has explicit loading, active, archived, and error states; unknown/error never exposes an enabled mutation form.
  CHECK: rg -n "loading|active|archived|error|Retry|Record decision" apps/web/src/app/projects/decision-review.page.ts apps/web/src/app/projects/decision-review.page.html
  EXPECT: Retry
  EVIDENCE: apps/web/src/app/projects/decision-review.page.ts:181:  | { readonly state: 'archived' } | apps/web/src/app/projects/decision-review.page.ts:182:  | { readonly state: 'error'; readonly message: string

- [x] G4: The focused Formal Decision specification proves fail-closed retry-to-archived behavior, rejects out-of-order retry results, and retains the active creation control case.
  CHECK: npx.cmd --yes pnpm@11.20.0 --dir apps/web exec ng test --watch=false --include=src/app/projects/decision-review.page.spec.ts
  EXPECT: /[1-9][0-9]* passed/
  EVIDENCE: npm notice run project-maker@0.2.0 npx | npm notice run pnpm --dir apps/web exec ng test --watch=false --include=src/app/projects/decision-review.page.spec.ts

- [x] G5: The existing API draft and archive guards remain present.
  CHECK: rg -n "FOLLOW_UP_DRAFT_REQUIRED|archived Project.*decision|decision.*archived Project" apps/api/src/follow-ups/follow-up.service.ts apps/api/src/decision-portfolio
  EXPECT: /FOLLOW_UP_DRAFT_REQUIRED/
  EVIDENCE: apps/api/src/follow-ups/follow-up.service.ts:1344:      code: 'FOLLOW_UP_DRAFT_REQUIRED',

- [x] G6: Red-first proof exists for each of UX-AUDIT-003 and UX-AUDIT-004, including the final out-of-order Retry race, before its implementation change.
  EVIDENCE: 2026-08-22 genuine red runs: customer-follow-up.component.spec.ts failed at line 29, expected disabled toggle true but received false; decision-review.page.spec.ts initially failed 2 assertions because formal-decision-availability-loading and formal-decision-availability-error were absent. Final adversarial review then added an out-of-order Retry detector that failed because the stale active result replaced the newer archived result. Each failure was captured before its implementation change.
