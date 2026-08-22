# User-facing runtime audit — 2026-08-22

## Audit status

- **Baseline:** `main` at `4632fe536d7bddce7865a144bfb3a30f77f7a963`
- **Original audit mode:** diagnosis only; no application behavior was changed in the audited baseline
- **Remediation status:** all six patches are implemented on `codex/ux-audit-remediation`; final independent-review and re-measurement gates are still in progress
- **Primary environment:** isolated current-`main` Compose stack at `http://127.0.0.1:18080`
- **Protected environment:** the existing `http://localhost:8080` stack was not modified
- **Supported viewport scope:** desktop/laptop widths only: 1024, 1280, 1440, and 1920 pixels
- **Finding gate:** a product defect is listed only when a deterministic detector could fail, the failure repeated, the case was minimized, and source inspection explained the behavior

This document is the implementation backlog produced by the audit. All six accepted patches are implemented; final closure remains gated by independent re-review and re-measured validation. Candidate failures that did not pass the finding gate remain recorded separately and must not be implemented as product fixes without new evidence.

## Severity rubric

| Severity | Meaning |
| --- | --- |
| P0 | Data loss, security boundary failure, or application-wide outage with no safe recovery |
| P1 | A primary workflow is blocked or produces materially wrong business state for ordinary users |
| P2 | A real workflow is misleading, locally blocked, or lacks a safe recovery path, but a workaround or server-side guard exists |
| P3 | User-visible or operational quality defect that does not block the workflow |

## Executive result

The audit confirmed **5 user-facing defects: 0 P0, 0 P1, 4 P2, and 1 P3**. It also confirmed **1 P3 runtime/API hygiene item** that is not visible in the ordinary employee UI but creates false-error browser and monitoring noise. All six have now been remediated, with the original distinction retained below.

| ID | Severity | Area | Confirmed behavior | Status |
| --- | --- | --- | --- | --- |
| `UX-AUDIT-001` | P2 | Global attention state | Independent unavailable states and bounded retries now recover both shell attention resources without losing later feature-local badge updates | RESOLVED |
| `UX-AUDIT-002` | P2 | Identity/session | Failed Sign out keeps the valid session and open navigation, shows an actionable alert, and permits a deliberate retry | RESOLVED |
| `UX-AUDIT-003` | P2 | Customer follow-up settings | Automation remains unavailable until a saved non-empty draft exists, with a direct route to the existing composer | RESOLVED |
| `UX-AUDIT-004` | P2 | Formal Decision | Loading, error, archived, and active Project states fail closed; only proven-active Projects expose decision creation | RESOLVED |
| `UX-AUDIT-005` | P3 hygiene | Known Projects now return `200`/JSON `null` for absent optional resources while unknown Projects and strict prerequisites remain errors | RESOLVED |
| `UX-AUDIT-006` | P3 | Product language | The four confirmed literals and current employee-facing language standards now use professional English | RESOLVED |

## Confirmed defect packets

### UX-AUDIT-001 — Initial shell attention loads fail silently and are not automatically retried

**User impact.** After a transient first-load failure, the shell can display zero Customer replies and zero Notifications without explaining that the counts are unavailable. The shell's automatic loader remains gated for the same signed-in user. A user can therefore miss work requiring attention until a full reload or a feature-local action updates the resource.

**Expected.** A transient failure must be visible as an unavailable state and offer a bounded retry. A successful retry must update the badges without requiring a new login.

**Actual.** The shell marks the current user as loaded before either request succeeds, swallows both errors, and suppresses later loads for that user.

**Deterministic evidence.** A Playwright route held and returned a transient `503` for one resource at a time. Each detector was run twice.

- Customer-reply summary: one shell request, no alert/unavailable state, no later shell request after unrelated route navigation, and no recovered badge.
- Notifications: one shell request, no alert/unavailable state, no later shell request after unrelated route navigation, and no recovered count.

The Notifications page does load/refresh Notifications, and correspondence commands can refresh reply summaries. Those feature-local recovery paths work and must be preserved; the defect is the silent, one-shot shell state, not a claim that no in-session request can ever occur.

**Proven cause.** [`app.component.ts`](../apps/web/src/app/app.component.ts) sets `loadedSummaryForUserId` at lines 48–55 before the Customer-reply request completes and uses the same one-shot gate for the Notification request at lines 56–59. Both subscriptions discard their error. The UI has no shell-level error state for either load.

**Smallest safe implementation.** Keep independent `idle/loading/loaded/error` state for Customer replies and Notifications. Mark each resource loaded only after success. Expose an actionable unavailable message and one explicit Retry action; optionally retry on a bounded navigation or visibility event. Do not add a real-time channel: the accepted `NOTIFY-01` behavior does not require one.

**Focused regression.** For each resource, force `503` once and success next. Assert visible failure, one deliberate retry, updated count, and no retry storm. Also retain the existing successful first-load badge test.

### UX-AUDIT-002 — Failed Sign out is silent

**User impact.** If the logout endpoint is temporarily unavailable, the navigation closes and the user remains signed in with no explanation. Reopening the menu shows Sign out enabled again, which looks like a missed click rather than a failed operation.

**Expected.** Preserve the valid session, show a concise error, and let the user retry.

**Actual.** The failure only resets the pending flag.

**Deterministic evidence.** A controlled `503` response for `/api/auth/logout` produced the same result in 2/2 runs: one request, unchanged authenticated URL, zero alerts, and a re-enabled Sign out action.

**Proven cause.** [`app.component.ts`](../apps/web/src/app/app.component.ts) lines 76–91 closes navigation before the request and handles `error` only by setting `loggingOut` to false. [`app.component.html`](../apps/web/src/app/app.component.html) lines 148–159 contains no logout error output.

**Smallest safe implementation.** Add a shell-level `logoutError`, set it to a safe actionable message on failure, and render it as an alert near the user actions. Leave the authenticated session unchanged and keep Sign out retryable.

**Focused regression.** Force `503`, assert the user stays authenticated and sees the error, then return success on retry and assert navigation to Login. Retain the pending double-submit guard.

### UX-AUDIT-003 — First-time automated follow-up setup has no path to its prerequisite

**User impact.** Project Settings allows a user to enable automated Customer follow-ups before a message draft exists. Save then fails with “Save a non-empty Customer follow-up draft first,” but the settings view contains neither the draft editor nor a direct link to the work surface that contains it. The server correctly prevents an invalid schedule, but first-time setup becomes a navigation guessing exercise.

**Expected.** The prerequisite must be obvious before save. If no draft exists, enabling should be disabled or accompanied by a direct “Create follow-up draft” route/action.

**Actual.** The settings form exposes Enable and Save without checking `current.messageDraft`. The draft composer is rendered only in work mode.

**Deterministic evidence.** On a new Project with the default interval and no draft, enabling and saving consistently reached the server guard. The strict true-red assertion reproduced 2/2 times and required the visible `FOLLOW_UP_DRAFT_REQUIRED` message.

**Proven cause.** [`customer-follow-up.component.html`](../apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.html) lines 37–242 place the draft workflow behind `mode() === 'work'`, while lines 244–314 render settings with an unconditional Enable control and Save action. [`follow-up.service.ts`](../apps/api/src/follow-ups/follow-up.service.ts) lines 1342–1346 correctly rejects the missing draft, and [`customer-follow-up-api.service.ts`](../apps/web/src/app/projects/customer-follow-up/customer-follow-up-api.service.ts) lines 138–143 maps that conflict to the visible message.

**Smallest safe implementation.** Preserve the server guard. In settings mode, derive `hasDraft` from loaded state, explain the prerequisite next to Enable, and provide a direct route/action to the Customer follow-up work surface. Disable enabling until the draft exists; do not duplicate the full composer in Project Settings.

**Focused regression.** New Project: Enable is unavailable and the prerequisite action reaches the draft editor. After saving a non-empty draft, return to settings, enable automation, save successfully, reload, and verify the schedule remains enabled.

### UX-AUDIT-004 — Archived Formal Decision form fails open when Project-state lookup fails

**User impact.** On an archived Project, if decision history loads but the separate Project workspace request fails, the page presents an active “Record decision” form. Submission reaches the API and is rejected with `409`. No archived data is changed because the server guard works, but the UI invites an impossible operation and reports the wrong state.

**Expected.** Until archive state is known, the form must fail closed and show a load error with Retry. Once the Project is known to be archived, only the read-only explanation may be shown.

**Actual.** Archive state defaults to `false`; the metadata-load error is discarded, so “unknown” is treated as “active.”

**Deterministic evidence.** For an archived Project, only `GET /api/projects` was forced to return `503`; decision and work-state requests succeeded. In 2/2 strict runs the form stayed enabled and attempted `POST /api/projects/:id/decisions`; the API rejected it with `409`.

**Proven cause.** [`decision-review.page.ts`](../apps/web/src/app/projects/decision-review.page.ts) initializes `archived` to `false` at line 46 and discards the independent Project-load error at lines 68–75. The save guard at lines 98–106 and template branch in [`decision-review.page.html`](../apps/web/src/app/projects/decision-review.page.html) lines 13–55 therefore cannot distinguish active from unknown.

**Smallest safe implementation.** Model Project availability as `loading/active/archived/error`. Render or enable the Formal Decision form only in the proven active state. On error, show Retry and prevent POST. Keep the API archive guard unchanged.

**Focused regression.** Archived Project plus metadata `503`: no enabled form and no POST, visible Retry. A successful retry must resolve to the archived explanation. Add one active-Project control case where decision creation still works.

### UX-AUDIT-005 — Runtime/API hygiene: expected absence emits false-error HTTP 404 responses

**Operational impact.** The employee UI correctly treats two valid empty states as `null`, but the browser Network/Console and HTTP monitoring still receive a 404. This makes a normal first-use route look broken to support/development staff, obscures real 404s, and creates avoidable diagnostic noise. It is explicitly **not counted as an employee-visible product defect** and does not block the visible workflow.

**Confirmed cases.** Each case reproduced 2/2 times, and the 20-route desktop sweep observed the Delivery Package response at every tested width.

1. A valid draft Project without a Question Schema: Initial Intake requests `/question-schema`; the API returns `404`; the client catches it and continues with `null`.
2. A valid Project with a specification but no Delivery Package: Delivery requests `/delivery-package`; the API returns `404`; the client catches it and displays the first-package editor.

**Proven cause.** [`question-bank.service.ts`](../apps/api/src/question-bank/question-bank.service.ts) lines 269–275 and [`delivery-package.service.ts`](../apps/api/src/delivery/delivery-package.service.ts) lines 67–76 express expected absence as `NotFoundException`. The browser adapters explicitly convert those 404s to `null` in [`question-bank-api.service.ts`](../apps/web/src/app/settings/question-bank-api.service.ts) lines 58–68 and [`delivery-api.service.ts`](../apps/web/src/app/projects/delivery/delivery-api.service.ts) lines 18–23. Initial Intake and Delivery request them unconditionally from [`interview.page.ts`](../apps/web/src/app/interviews/interview.page.ts) lines 137–145 and [`delivery.page.ts`](../apps/web/src/app/projects/delivery/delivery.page.ts) lines 96–102.

**Smallest safe implementation.** Define an explicit successful absence contract for these read endpoints, or skip the read when already-known workflow state proves the resource cannot exist. Preserve a real missing Project as `404` and preserve write-time conflict guards.

**Focused regression.** Valid Project plus absent optional resource returns the agreed successful absence representation and renders the existing editor/empty state. Unknown Project still returns `404`.

### UX-AUDIT-006 — Professional-English migration is incomplete

**User impact.** The English UI can still show a Hungarian section title or a mixed-language failure message. This is especially confusing in support situations because the action in the error cannot be copied consistently into English operating documentation.

**Deterministic evidence.** The visible heading and each forced-error fallback were asserted twice.

- Delivery side panel heading: `Kimenetek`.
- Git setup update fallback: `Unable to menteni a Git setupot...`.
- Insight creation fallback: `...menteni az insightot...`.
- Project contact update fallback: `...menteni a projektkapcsolatot...`.

**Proven cause.** The remaining literals are in [`delivery.page.html`](../apps/web/src/app/projects/delivery/delivery.page.html) line 112, [`delivery-api.service.ts`](../apps/web/src/app/projects/delivery/delivery-api.service.ts) line 46, and [`discovery-api.service.ts`](../apps/web/src/app/projects/discovery/discovery-api.service.ts) lines 27 and 41.

The current repository convention explicitly requires professional English in [the Angular conventions](../.agents/skills/project-maker-angular-conventions/SKILL.md) lines 56–60. Documentation has not caught up: [`PLAN.md`](../PLAN.md) line 10 still makes Hungarian user-facing copy authoritative; [`roadmap.md`](roadmap.md) lines 66, 73, 77, and 141 still prescribe Hungarian behavior; [`user-guide.md`](user-guide.md) line 37 declares the UI Hungarian; [`README.md`](../README.md) lines 24–25 directs daily users to that Hungarian guide; and [`CONTEXT.md`](../CONTEXT.md) lines 74–77, 91–94, and 104–107 still prescribe Hungarian employee-facing navigation names. This documentation drift is part of the language-completion work, not a reason to revert the runtime UI.

**Smallest safe implementation.** Replace the four confirmed literals with established software-development and project-management English. Run a focused user-facing source-copy scan, then update the roadmap and user guide so they describe the accepted English product. Preserve user-authored text and persisted legacy wire values; translate only at presentation boundaries.

**Focused regression.** Force the three failed commands and assert complete, actionable English. Assert the Delivery heading. Add a narrow source scan for known Hungarian product-copy fragments; do not introduce a broad runtime translation framework.

## Green coverage matrix

These paths completed without a confirmed product defect. A green row means the observable UI workflow and relevant persistence/reload boundary passed; it does not certify unrelated internals.

| Area | Covered user actions | Result |
| --- | --- | --- |
| Account and session | Sign up, Sign in, invalid credentials, deactivate, restore, password change, authenticated reload; held-request double-submit guard on login, signup, and restore | PASS |
| Project Portfolio | Search; every Health, Decision, and Project-scope option; sorting; saved views; cursor pagination; reload and browser back/forward | PASS |
| Active Queue | Readiness and urgency filters, search, refresh, actions, cursor pagination, reload and back/forward | PASS |
| Notifications | Refresh, Open, target navigation, return navigation, and notification clearing through the Customer-response workflow | PASS |
| Roadmap | Goal/Initiative create and rename; assign, change assignment, unassign, delete Initiative/Goal; reload persistence and retained Project | PASS |
| Question Bank | Publish successor, edit question, allowed TXT reference upload/download/remove, version increment, and reload persistence | PASS |
| Markdown templates | Edit, save draft, preview rendered substitution, publish successor, library/version state after reload | PASS |
| Project creation and setup | Create Project, persist draft, resume, edit Project basics and Customer contacts, publish Project Question Schema | PASS |
| Initial Intake | Start/resume, 30 long-text answers, save/autosave, clear, assessment inputs, end round, attachment persistence after fully loaded reload | PASS |
| Discovery | Contacts, evidence, insights, source linking, stale-write conflict, clarification follow-ups, attachment allow/reject/download/remove/archive | PASS |
| Readiness and decisions | Readiness evaluation, Decision Review, active-Project Formal Decision creation and history | PASS |
| Specification | Alternate template, validation, draft/publish versions v1–v3, milestone validation, download, double-submit guard | PASS |
| Delivery and exports | Delivery Package create/update, Markdown, CSV, print/PDF-ready export paths | PASS |
| Git handoff | Setup use, exact preview, explicit confirmation, and controlled loopback transport failure/recovery | PASS within boundary |
| MCP | Connection/token lifecycle and Project/package access through the local MCP boundary | PASS within boundary |
| Archive/restore | Archive, restore complete workflow state, and verify that historical side effects such as Customer reminders are not replayed | PASS |
| Customer follow-up and public response | Draft, preview, cancel/focus return, send, reply correlation, inbound refresh, public response, review Notification, clear | PASS with local SMTP/test boundary |
| Correspondence triage | Link unmatched, Dismiss, Mark reviewed, Start processing, Accepted/Other classification, Close, counts, and visible two-tab `409` recovery | PASS with isolated fixtures |
| Desktop layout | 20 routes at 1024, 1280, 1440, and 1920 pixels: 80 route-width checks with no horizontal overflow | PASS |

## Rejected candidates and test debt

These results must not be filed as product defects without new evidence.

| Candidate | Verdict | Reason / follow-up |
| --- | --- | --- |
| Login email focus is invisible | WITHDRAWN | The real focused field has a visible cyan border (`rgb(49, 183, 255)`) versus the unfocused border (`rgb(70, 81, 111)`). The old assertion inspected only outline/shadow and was an invalid oracle. |
| Initial Intake attachment disappears after reload | WITHDRAWN | The diagnostic asserted body text before Angular finished loading. Persisted ownership is correct and a settled reload renders the file. |
| Active Queue horizontal overflow | OUT OF SCOPE | Reproduced only at 390 px. The accepted product scope is desktop/laptop; all four supported widths passed. |
| Discovery dropdown is obstructed | NOT REPRODUCED | Independent 1024 and 1280 runs passed. Keep as a flaky-test observation unless a deterministic user failure is captured. |
| Collapsed navigation links are missing | STALE TEST | Three existing assertions assume links are visible before opening the current desktop Navigation control. The control and links work when opened. |
| Customer-reply badge lacks an accessible name | WITHDRAWN | With a nonzero count and expanded navigation, the badge exposes `Open 3 new Customer replies`. |
| Rejected executable attachment is a failure | EXPECTED | The API returns validation failure and the UI shows an actionable message; the accepted file boundary intentionally rejects it. |
| Badge does not update in real time | ACCEPTED LIMIT | `NOTIFY-01` intentionally has no real-time channel. `UX-AUDIT-001` is limited to silent first-load/recovery failure. |
| SMTP boundary suite fails against reused database | TEST ISOLATION | A reused database can contain older due reminders. The same SMTP boundary spec passed 3/3 on a clean dedicated database. Either keep final validation isolated or disarm prior reminders in test setup. |

The existing browser suite finished **61 passed / 8 failed** during the audit. The eight failures mapped to four 390 px checks outside scope, three stale collapsed-navigation assumptions, and one non-reproduced dropdown interaction. They are QA maintenance, not eight product defects.

## Explicit audit boundaries and remaining coverage

- No real Git remote, Customer mailbox, SMTP provider, VPN, or production deployment was changed or contacted. Git transport failure used a controlled loopback target; mail workflows used test SMTP/local fixtures and a disposable database.
- The correspondence API boundary passed 4/4 focused reply cases plus 1/1 mailbox-baseline case. The live isolated UI passed the same actions, including two-tab stale-command recovery.
- External provider deliverability, provider throttling, real mailbox latency, VPN routing, and production secrets remain deployment acceptance concerns rather than local application findings.
- Mobile and 390 px behavior is intentionally excluded by the accepted desktop/laptop scope.
- The final isolated admin closure covered Roadmap assignment/change/unassign/delete with reload, Question Bank edit/reference-file successor lifecycle, and Markdown-template draft/preview/publish successor. All passed; only isolated test data was changed.

## Implementation order

Do not fragment these findings into six unrelated micro-projects.

### Batch 1 — Runtime recovery and workflow safety

- [x] `UX-AUDIT-001` independent recoverable shell loads
- [x] `UX-AUDIT-002` visible Sign out failure and retry
- [x] `UX-AUDIT-003` follow-up draft prerequisite path
- [x] `UX-AUDIT-004` fail-closed Formal Decision state

Validation should be limited to the four focused red-to-green browser detectors, the directly affected web tests/typecheck, and one active-path regression per workflow.

### Batch 2 — Contract and language correctness

- [x] `UX-AUDIT-005` successful optional-resource absence contract
- [x] `UX-AUDIT-006` professional-English completion and documentation alignment

The stale navigation/focus/SMTP assumptions listed above remain separate QA debt. They are not accepted product defects and were intentionally not converted into behavior changes by this remediation.

Validation should be limited to the two optional-resource API/browser cases, the four confirmed copy cases, the relevant API/web typechecks, and one desktop checkpoint after both batches.

## Remediation evidence

- `UX-AUDIT-001/002`: [`app.component.ts`](../apps/web/src/app/app.component.ts), [`app.component.html`](../apps/web/src/app/app.component.html), [`app.component.spec.ts`](../apps/web/src/app/app.component.spec.ts), and the two badge-service specifications cover independent failures and retries, successful feature-local recovery after an initial failure, session-scoped badge publications, rejection of prior-session races, logout double-submit protection, retained session, a fixed safe error that never propagates backend diagnostics, and successful retry.
- `UX-AUDIT-003`: [`customer-follow-up.component.ts`](../apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.ts), its template, and [`customer-follow-up.component.spec.ts`](../apps/web/src/app/projects/customer-follow-up/customer-follow-up.component.spec.ts) enforce the saved-draft prerequisite while retaining the existing API guard and composer.
- `UX-AUDIT-004`: [`decision-review.page.ts`](../apps/web/src/app/projects/decision-review.page.ts), its template, and [`decision-review.page.spec.ts`](../apps/web/src/app/projects/decision-review.page.spec.ts) prove loading/error fail-closed behavior, retry-to-archived resolution, rejection of an older out-of-order Retry result, and the proven-active creation path.
- `UX-AUDIT-005`: [`question-bank-reference-files.e2e-spec.ts`](../apps/api/test/question-bank-reference-files.e2e-spec.ts) and [`delivery-package.e2e-spec.ts`](../apps/api/test/delivery-package.e2e-spec.ts) prove `200`/JSON `null` for a known empty Project and `404` for an unknown Project. The browser-adapter specifications prove that real errors are no longer reinterpreted as absence.
- `UX-AUDIT-006`: the Delivery `Outputs` title, three command-failure specifications, source-copy guard, and reconciled [`CONTEXT.md`](../CONTEXT.md), [`PLAN.md`](../PLAN.md), [`README.md`](../README.md), roadmap, user guide, and ADR establish professional-English runtime copy and exact English UI labels in operating documentation. Explanatory prose may retain its intended reader language; no translation framework or persisted-value rewrite was introduced.
- [`ux-audit-remediation.spec.ts`](../apps/web/e2e/ux-audit-remediation.spec.ts) runs the four P2 recoveries through a real browser at a supported desktop width: both independent shell retries, failed-then-successful Sign out, first-time draft-to-schedule setup with reload persistence, and error-to-archived Formal Decision retry. All 4/4 passed against the real local API and a disposable fresh database.
- Orchestrated evidence is retained in [`ux-audit-shell.md`](../gates/ux-audit-shell.md), [`ux-audit-project-safety.md`](../gates/ux-audit-project-safety.md), [`ux-audit-contract-english.md`](../gates/ux-audit-contract-english.md), and the two branch gate files. All 20/20 leaf gates, all 10/10 branch gates, and all 9/9 root gates passed. Final re-measurement produced 31/31 web test files and 104/104 component tests, 6/6 focused Formal Decision tests, 2/2 adjacent API suites and 5/5 tests on a freshly migrated database, 4/4 real-browser recoveries, repository typecheck, and both production builds.
- Independent Standards and specification reviews found no unresolved P1/P2. A separate adversarial review found the final out-of-order Formal Decision Retry race; after the red-first fix in `07c875b`, both adversarial and specification re-reviews of the complete baseline-to-HEAD range found no unresolved P1/P2.

## Completion rule

A backlog item may be marked complete only when its original deterministic detector passes, the directly adjacent happy path still passes, and no accepted Project Maker function or Customer-facing business rule has changed. Broad unrelated test sweeps are not required.
