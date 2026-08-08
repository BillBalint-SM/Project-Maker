# Planning-Show Handoff: Guided Intake Feature Prioritization

Status: COMPLETE
Session mode: NEW
Session: PM-PS-2026-08-06-intake-prioritization-v1
Scope: Project Maker feature prioritization and the first guided-intake vertical slice
Topic: Guided intake, answer persistence, and deterministic Hungarian coaching
Parent: explicit none
Roadmap item: explicit none
Outcome owner: User (Product Owner and developer)

## Shared understanding

Prioritize the current feature list by end-user time-to-value, then prepare one
implementation-ready first feature. The first delivery slice is the
`INITIAL_INTAKE` guided flow with server persistence, recovery, and the full
deterministic Hungarian coaching surface defined by the current playbook
contract.

The implementation must remain within the current Angular/PrimeNG, NestJS,
PostgreSQL, and Compose platform. Core operation must not depend on live AI,
offline synchronization, authentication, or public exposure.

## Original brief

The session should prioritize the feature list and define the first feature's
scope, acceptance criteria, risks, and verification plan so implementation can
start from a controlled, measurable vertical slice.

## Decision tree result

1. The outcome owner is the User as Product Owner and developer.
2. The primary prioritization model is end-user time-to-value.
3. The first slice is `INTAKE-02 + INTAKE-03 + INTAKE-05`.
4. The first slice supports only `INITIAL_INTAKE` and requires a published
   project question schema.
5. A project has at most one open `INITIAL_INTAKE` round. An existing open
   round is resumed; a second start is a deterministic conflict.
6. Open rounds are autosaveable and resumable. Text inputs use debounced
   saves; discrete controls and explicit answer clearing save immediately.
7. A save failure keeps the current-session draft visible and exposes a
   Hungarian retry path. Offline queueing is out of scope.
8. Browser refresh/tab reopen and API/Compose restart must recover all values
   successfully persisted to PostgreSQL.
9. Completion requires every `required` answer to be present and type-valid.
   `blocking` produces critical guidance but does not independently block
   completion.
10. Completed rounds are immutable. A changed interview starts a new round.
11. User-facing copy, question examples, hints, required/blocking guidance,
    answer-state feedback, errors, and recovery states are Hungarian.
12. Coaching is contract-based and deterministic: no keyword heuristic and no
    semantic AI/LLM evaluation.
13. The first slice excludes schema administration, `STAKEHOLDER` and
    `CLARIFICATION` rounds, scoring, Markdown and export output, follow-up
    delivery, authentication, multi-client conflict handling, offline/PWA
    synchronization, and AI enrichment.

## Rejected interpretations

- Foundation-first or output-first prioritization instead of end-user value.
- Multiple simultaneous open rounds or a round-history selector in the first
  slice.
- Editing a completed round in place.
- Blur-only saves or a request for every keypress.
- Local/offline answer queues and multi-client conflict resolution.
- Heuristic answer-quality scoring or AI/LLM evaluation.
- Combining schema administration and all round types with the first slice.

## Acceptance and evidence

The first slice is accepted only when all of the following are observable:

- A project with a published schema can start one `INITIAL_INTAKE` round and
  can resume it after reload.
- A missing schema produces an actionable Hungarian blocking state.
- Text answers save after the debounce window; select, boolean, date,
  multi-select, and explicit clear operations save immediately.
- The UI exposes Hungarian saving, saved, and error/retry states without
  silently discarding the current draft.
- Required, optional, blocking, and type-invalid answer states are rendered
  from the contract data.
- API and Compose restart do not remove values that were successfully saved.
- Completion rejects missing required answers and invalid answer values, then
  makes the completed round read-only.
- A second open `INITIAL_INTAKE` start is rejected deterministically.
- API integration tests cover lifecycle, persistence, recovery, validation,
  duplicate-open protection, and save failure behavior.
- Playwright covers the Hungarian guided-intake flow, autosave/recovery, the
  missing-schema state, and completion failure/success paths.
- Typecheck, production build, relevant tests, and Compose verification pass.

Evidence sources inspected during the session include:

- `.planning/PROJECT.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `docs/product-domain.md`
- `packages/contracts/playbooks/general.v1.json`
- `packages/contracts/src/interviews.ts`
- `apps/api/src/interviews/interviews.controller.ts`
- `apps/api/src/interviews/interviews.service.ts`
- `apps/web/src/app/interviews/interview.page.ts`
- `apps/web/src/app/interviews/interview.page.html`
- `apps/api/test/projects.e2e-spec.ts`
- `apps/api/test/question-rounds.e2e-spec.ts`

## Unknowns, risks, and dependencies

- The exact active-round read endpoint and any persistence-contract change
  must be confirmed during implementation. Owner: User/developer. Next action:
  trace the current entities and add the smallest compatible read path; stop
  for a migration decision if the contract requires new persisted fields.
- The test environment needs a published project-schema fixture. Owner:
  User/developer. Next action: verify the existing seed path and create a
  bounded fixture only if it is absent.
- The debounce interval is an implementation parameter; 750 ms is the
  recommended starting value. Owner: User/developer. Next action: validate it
  against the E2E timing and API-load evidence.
- Hungarian copy needs a final product review. Owner: User. Next action:
  review the rendered guided-intake states before delivery sign-off.
- `DATA-01` and `DATA-02` remain cross-cutting gates for persistence changes;
  `SEC-01` remains a gate before public or multi-user exposure.

## Open decision frontier

None. All material product, scope, prioritization, recovery, coaching,
completion, risk-boundary, and verification decisions are settled. The items
above are implementation-discovery actions, not unresolved product decisions.

## Scope delta

- Accepted: the first slice includes the full Hungarian user-facing and
  deterministic coaching behavior represented by `INTAKE-05`.
- Accepted: the first slice is limited to `INITIAL_INTAKE`; other round types
  and adjacent product areas remain separate delivery slices.
- Accepted: the handoff is standalone with no Milestone/Epic parent or
  roadmap-item parent.

## Final confirmation

Confirmed: YES
Confirmed by: User
Confirmation basis: explicit confirmation of the final synthesis and the
standalone handoff target.

## Next bounded action

Create the implementation plan for the first slice, starting with a read-only
trace of active-round recovery, schema fixtures, and current test boundaries.
The implementation plan must be reviewed and approved before code changes.

## Suggested continuation

Use a small implementation plan with separate API/contract, web UX, and
verification slices, followed by independent verification before completion.
