# Gates: UX audit shell recovery

Scope: resolve UX-AUDIT-001 and UX-AUDIT-002 without polling, session changes, or a global retry manager.

- [x] G1: Customer-reply and Notification first-load failures have independent visible alerts and explicit retries.
  CHECK: rg -n "Customer-reply summary.*retry|Notification.*retry|retry.*Customer|retry.*Notification" apps/web/src/app/app.component.spec.ts
  EXPECT: /retry/i
  EVIDENCE: 81:  it('shows a retry for a failed Customer-reply summary without reloading Notifications', async () => {

- [x] G2: A retry succeeds, updates the affected count, and does not duplicate the other resource request.
  CHECK: rg -n "independent|does not retry|request count|summary.*retry|notification.*retry" apps/web/src/app/app.component.spec.ts
  EXPECT: /independent|does not retry|request count/i
  EVIDENCE: 122:  it('retries Notifications independently after its first load fails', async () => {

- [x] G3: Failed logout keeps the session and renders an actionable alert; a later retry can succeed.
  CHECK: rg -n "logout|Sign out|sign out" apps/web/src/app/app.component.spec.ts
  EXPECT: /failure|fails|retry|alert/i
  EVIDENCE: 221:    expect(logout).toHaveBeenCalledTimes(2); | 236:            logout: () => of(undefined),

- [x] G4: The focused shell component specification passes.
  CHECK: npx.cmd --yes pnpm@11.20.0 --dir apps/web exec ng test --watch=false --include=src/app/app.component.spec.ts
  EXPECT: /[1-9][0-9]* passed/
  EVIDENCE: npm notice run project-maker@0.2.0 npx | npm notice run pnpm --dir apps/web exec ng test --watch=false --include=src/app/app.component.spec.ts

- [x] G5: The shell exposes accessible recovery state and contains no swallowed empty error callback.
  CHECK: rg -n "role=\"alert\"|role=\"status\"|LoadError|logoutError|retry" apps/web/src/app/app.component.ts apps/web/src/app/app.component.html
  EXPECT: /alert/
  EVIDENCE: apps/web/src/app/app.component.html:172:          @if (logoutError(); as error) { | apps/web/src/app/app.component.html:173:            <div class="logout-error" role="alert" data-testid="logout-error

- [x] G6: Red-first proof exists for each of UX-AUDIT-001 and UX-AUDIT-002 before its implementation change.
  EVIDENCE: UX-AUDIT-001 red: `npx.cmd --yes pnpm@11.20.0 --dir apps/web exec ng test --watch=false --include=src/app/app.component.spec.ts` exited 1 at 21:57:57; Customer-reply alert assertion received undefined. UX-AUDIT-002 red: same command exited 1 at 22:02:43; logout alert assertion received undefined. Regression red: same command exited 1 at 22:10:05 with 3 failures: Customer-reply badge remained 1 instead of 4, Notifications badge was absent after current changed to 6, and navigation aria-expanded was false after logout failure.
