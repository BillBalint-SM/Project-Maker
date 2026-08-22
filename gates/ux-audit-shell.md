# Gates: UX audit shell recovery

Scope: resolve UX-AUDIT-001 and UX-AUDIT-002 without polling, session changes, or a global retry manager.

- [x] G1: Customer-reply and Notification first-load failures have independent visible alerts and explicit retries.
  CHECK: rg -n "Customer-reply summary.*retry|Notification.*retry|retry.*Customer|retry.*Notification" apps/web/src/app/app.component.spec.ts
  EXPECT: /retry/i
  EVIDENCE: 92:  it('shows a retry for a failed Customer-reply summary without reloading Notifications', async () => {

- [x] G2: Retry and later feature-local recovery update only the current user's affected count without duplicating the other request or accepting a prior session's result.
  CHECK: npx.cmd --yes pnpm@11.20.0 --dir apps/web exec ng test --watch=false --include=src/app/app.component.spec.ts --include=src/app/projects/customer-replies-api.service.spec.ts --include=src/app/notifications/notifications-api.service.spec.ts
  EXPECT: /14 passed/
  EVIDENCE: npm notice run project-maker@0.2.0 npx | npm notice run pnpm --dir apps/web exec ng test --watch=false --include=src/app/app.component.spec.ts --include=src/app/projects/customer-replies-api.service.s

- [x] G3: Failed logout keeps the session, never exposes an arbitrary backend diagnostic, renders the controlled actionable alert, and permits a later retry.
  CHECK: node -e "const fs=require('node:fs');const s=fs.readFileSync('apps/web/src/app/app.component.ts','utf8');const t=fs.readFileSync('apps/web/src/app/app.component.spec.ts','utf8');if(!s.includes('Unable to sign out. Check your connection and try again.')||!t.includes('ECONNRESET at internal-auth-node-7')||!t.includes(\"not.toContain('ECONNRESET')\"))process.exit(1);console.log('Logout failure copy is controlled and regression-covered')"
  EXPECT: Logout failure copy is controlled and regression-covered
  EVIDENCE: Logout failure copy is controlled and regression-covered

- [x] G4: The focused shell component specification passes.
  CHECK: npx.cmd --yes pnpm@11.20.0 --dir apps/web exec ng test --watch=false --include=src/app/app.component.spec.ts
  EXPECT: /12 passed/
  EVIDENCE: npm notice run project-maker@0.2.0 npx | npm notice run pnpm --dir apps/web exec ng test --watch=false --include=src/app/app.component.spec.ts

- [x] G5: The shell exposes accessible recovery state and its logout failure callback uses only the controlled safe copy.
  CHECK: rg -n "role=\"alert\"|role=\"status\"|LoadError|logoutError|retry" apps/web/src/app/app.component.ts apps/web/src/app/app.component.html
  EXPECT: /alert/
  EVIDENCE: apps/web/src/app/app.component.ts:193:    this.logoutError.set(null); | apps/web/src/app/app.component.ts:205:          this.logoutError.set(logoutFailureMessage);

- [x] G6: Red-first proof exists for each of UX-AUDIT-001 and UX-AUDIT-002 before its implementation change.
  EVIDENCE: UX-AUDIT-001 red: `npx.cmd --yes pnpm@11.20.0 --dir apps/web exec ng test --watch=false --include=src/app/app.component.spec.ts` exited 1 at 21:57:57; Customer-reply alert assertion received undefined. UX-AUDIT-002 red: same command exited 1 at 22:02:43; logout alert assertion received undefined. Regression red at 22:10:05 proved three badge/navigation propagation failures. Review red proved unsafe `ECONNRESET at internal-auth-node-7` reached the logout alert. Cross-session red at 22:40:08 failed 2/12: a prior user's feature-local Customer summary changed the badge from 2 to 9, and a prior user's Notification result replaced the current badge.
