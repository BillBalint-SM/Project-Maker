# Project state

**Verified delivery baseline:** the Angular 22.1 web platform with licensed
PrimeNG 22.0.0 and the delivered application workflows is based on `main`
commit `b4b81c4`, which includes the merged OUTPUT-01 delivery. Closeout
documentation and verification evidence are maintained in their reviewed
delivery change; no future merge identity is predicted here.

## Current implementation

- Monorepo: pnpm workspace.
- Web: Angular 22.1 standalone application with PrimeNG 22.0.0.
- API: NestJS with a health endpoint, CORS validation, TypeORM migrations, and PostgreSQL access.
- Shared package: `@project-maker/contracts`.
- Runtime topology: Nginx-hosted SPA, internal API, and PostgreSQL through Compose.
- Product/domain source of truth: `docs/product-domain.md` and `packages/contracts`.
- Project lifecycle: create, list, workspace edit, archive, restore, and guarded
  permanent deletion. Only a bare `DRAFT` can be deleted; retained activity
  returns a generic `409` and the project must be archived instead.
- Follow-up read boundary: a first `GET /projects/:projectId/follow-up` returns
  unsaved defaults without creating a persistence row; the first explicit
  `PATCH` creates the row.
- Discovery follow-ups: `INTAKE-04.1` creates and lists a separate project-owned
  work item through `GET`/`POST /projects/:projectId/discovery-follow-ups` with
  a canonical `Nyitott` initial status, category, owner, date-only due date,
  question, and next step. `INTAKE-04.2` resolves an unresolved work item through
  `POST /projects/:projectId/discovery-follow-ups/:followUpId/resolve` to the
  canonical `Megválaszolva` or `Nem releváns` status with a required persisted
  answer/decision. Verified `INTAKE-04.3a` adds a version-checked `PATCH` for the
  five open working fields; stale edits conflict, equivalent edits are no-ops, and
  real edits write a safe field-name-only audit event. `INTAKE-04.3b` adds an
  optional current-Initial-Intake source on creation and open-only add/change/
  removal later; resolved items retain compact historical provenance, while
  source audits omit the source ID and full source content. Archived projects
  remain readable, reject creation, editing, resolution, and source changes, and
  allow eligible open-item actions again after restore. A persisted discovery
  follow-up also prevents permanent project deletion.
- Guided intake and customer handoff: a published project question schema can
  start one open `INITIAL_INTAKE` round, recover it, persist answers, and end the
  meeting regardless of business completeness once all technical saves settle.
  Ending creates an editable version-1 customer-handoff draft. The employee can
  preview and send it immediately or later; sent versions are immutable, and a
  customer change request starts a summarized new draft that temporarily
  re-enables answer and assessment edits. Known delivery failures are retryable;
  uncertain outcomes require explicit operator verification before continuation.
- SCORE-01.1 readiness assessment: a valid answer is effective `Kész`; a
  persisted `Részben megvan` lowers completion/readiness, while justified `Nem
  releváns` is excluded from relevant completion and checklist readiness. These
  business states do not block ending the interview meeting.
  `GET /projects/:projectId/readiness` uses the canonical eligible initial
  intake source and returns an available review or an explicit unavailable
  state. The Cockpit shows completion, readiness, factors, and redacted gaps
  with Workspace, checklist, or discovery-follow-up remediation.
- SCORE-01.2 Decision Review: six nullable 1–5 Decision input ratings persist
  atomically on the project. The server derives the weighted Decision Score,
  label, recommendation, readiness/gap explanation, and canonical
  weights/inversions only when the ratings and current canonical readiness are
  complete. Critical gaps, readiness below 40, and more than two
  estimate-blocking gaps take precedence over positive recommendations. The
  Cockpit owns no duplicate calculation; it renders a deep Decision Review
  component with independent load/save/retry/read-only state. Archived reviews
  retain their inputs and are read-only until restore; persisted ratings also
  prevent permanent draft deletion.
- Persistence boundary: migration `InitialIntakeOpenRound0005InitialIntakeOpenRound1786262400000`
  enforces at most one open initial-intake round per project and fails fast on
  pre-existing duplicate open initial rounds.
- Persistence boundary: migration
  `RoundQuestionAssessmentOverrides0009RoundQuestionAssessmentOverrides1786608000000`
  stores assessment overrides and refuses rollback while override rows exist.
- Markdown/audit: manual and milestone-triggered Markdown revisions are stored,
  downloadable, and generated as a canonical human-readable specification from
  a selected immutable published Markdown template version. Named drafts,
  preview, publication, a Default template, remembered project selection, and
  safe required/optional placeholders are delivered.
- Project coordination: creation records a named internal PO/PM owner. The next
  action is assigned by role to that concrete person or to the named customer
  contact; free-form `Ball owner` is no longer product language.
- Customer communication (`COMM-01.1`): versioned interview handoffs and configurable,
  authored, previewed customer follow-up ping delivery exist. Manual and
  PostgreSQL-coordinated scheduled ping attempts are durable across reload;
  scheduled claims commit before Microsoft Graph submission and revalidate current delivery inputs.
  Recovery occurs only by explicit `FAILED` retry or request-specific
  acknowledged `UNKNOWN` retry, and uncertain delivery pauses the cadence.
  Customer mail is separate from Claude Markdown and from `INTAKE-04`
  operational follow-up management. The still-planned `OUTPUT-01.1` internal
  Claude Code handoff may not add Markdown or `.md` inputs to Customer SMTP.
- Web intake UX: the interview page resumes the server active round, autosaves
  text answers after 750 ms, saves discrete values immediately, keeps failed
  drafts visible with retry, and renders deterministic Hungarian coaching from
  persisted question metadata.
- End-user documentation: `docs/user-guide.md` teaches every stable delivered
  route and business workflow with ten sanitized application screenshots,
  three state/workflow diagrams, recovery guidance, and explicit unavailable
  capability boundaries.

## Current delivery state

The delivered feature status and scope boundaries are maintained in
[`docs/roadmap.md`](../docs/roadmap.md). The verification surface includes
contracts/API/web typechecks, API and web tests, browser E2E, production build,
repository `verify`, Compose health and migration status, and active-round
recovery after an API restart. Aggregate suite counts belong here only when a
matching receipt is tracked at the baseline or freshly rerun.

The `DOC-01` verification surface also includes exact heading and action
coverage, local-link and image-target checks, original-resolution screenshot
inspection, Mermaid structure review, placeholder and planned-as-delivered
scans, documentation secret hygiene, and the normal repository gates.

The [guided-intake plan](../docs/superpowers/plans/2026-08-06-guided-intake-persistence.md)
and [strict-deletion plan](../docs/superpowers/plans/2026-08-07-strict-project-deletion.md)
preserve their approved pre-execution task lists; their delivery-status notices
and the roadmap explain what is actually shipped.

The [Hungarian end-user guide design](../docs/superpowers/specs/2026-08-09-user-guide-design.md)
and [implementation plan](../docs/superpowers/plans/2026-08-09-user-guide.md)
define `DOC-01` scope and evidence; the
[guide](../docs/user-guide.md) is the employee-facing source.

The verified guided-intake scope is intentionally limited to `INITIAL_INTAKE`.
`INTAKE-04` delivers discovery-follow-up creation, review, resolution,
conflict-safe editing of open items, and optional source linkage. The canonical
migration sequence now runs through `0018`; current aggregate
closeout counts are recorded only after the complete INTAKE-06 verification
receipt is available. SCORE-01.2
Decision Review has API coverage for
availability, atomic validation/persistence, recommendation precedence,
current-source recalculation, audit redaction, archive/delete lifecycle, and a
focused browser proof for display/save/reload, error isolation, and archive
read-only behavior. OUTPUT-01 canonical structured Markdown additionally has
focused browser proof for the template lifecycle, safe error recovery,
default/remembered selection, required and optional placeholders, immutable
provenance, and archive behavior. Authentication, authorization, backup operations,
acceptance-criteria/user-story derivation, and PDF/spreadsheet export coverage
remain separate until their requirements and verification evidence are complete.
