# Project Maker web-platform requirements

This is the current delivery baseline. Checked items are verified in the
Angular/NestJS monorepo; unchecked items remain future delivery work.
Current delivery status is maintained in [`docs/roadmap.md`](../docs/roadmap.md).
The historical guided-intake execution record is preserved in the tracked
[guided-intake plan](../docs/superpowers/plans/2026-08-06-guided-intake-persistence.md).

## Foundation

- [x] **FOUND-01:** pnpm monorepo contains Angular web, NestJS API, and shared contracts packages.
- [x] **FOUND-02:** API exposes `GET /health` with `{ "status": "ok" }`.
- [x] **FOUND-03:** Web shell renders Project Maker and configures PrimeNG.
- [x] **FOUND-04:** Compose defines web, internal API, and internal PostgreSQL with health checks and named persistence.
- [x] **FOUND-05:** API startup requires one exact HTTP(S) `CORS_ORIGIN` and rejects malformed or unsafe values.
- [x] **FOUND-06:** Compose image build and host HTTP smoke pass with Docker Desktop Linux engine available.

## Product domain and intake

- [x] **DOMAIN-01:** Product workflow, domain terms, the version-1 playbook, and scoring contract are defined in `docs/product-domain.md` and `packages/contracts`.
- [x] **INTAKE-01:** Users can create, list, edit, archive, restore, and explicitly delete projects. A bare `DRAFT` is physically deleted; any persisted activity returns a generic conflict and the project must be archived instead.
- [x] **INTAKE-02:** Users can run the versioned guided interview/checklist and record answers. A published project question schema starts exactly one `OPEN` round, records answers and assessments, rejects duplicate open starts with HTTP 409, and always permits `OPEN → ENDED` once technical saves are settled. An ended round remains editable only through its one active customer-handoff draft; sent versions are immutable, later Initial Intake rounds are allowed, and archived projects are read-only.
- [x] **INTAKE-06:** Ending an interview creates a versioned customer-handoff draft that can be previewed, explicitly emailed, retried with delivery-risk safeguards, revised into later immutable sent versions, and inspected as history. Named internal/customer ownership and archived read-only behavior are enforced by API and UI.
- [x] **INTAKE-03:** Answers autosave and remain recoverable after restart. Verified for persisted answers in the first `INITIAL_INTAKE` slice: text autosaves after the 750 ms quiet period, discrete values save immediately, failed saves keep the draft and expose retry, reload/API restart/Compose-backed recovery return the same active round and answer from PostgreSQL.
- [ ] **INTAKE-04:** Users can manage follow-ups with owner, due date, status, answer/decision, and next step.
- [x] **INTAKE-05:** The UI provides Hungarian coaching content and deterministic answer-quality guidance. Verified for the first `INITIAL_INTAKE` slice: loading, blocked, save, retry, validation, completion, and round-state messages are Hungarian, and question coaching is rendered deterministically from persisted contract metadata without a model or keyword path.

## Customer communication

- [x] **COMM-01.1:** Customer SMTP is structurally separated from internal Markdown delivery. The versioned Interview customer handoff is the only full customer-summary email; authored follow-up pings use exact preview, durable manual and scheduled delivery, explicit `FAILED`/`UNKNOWN` recovery, redacted audit data, and no Markdown revision, `.md` attachment, or Claude instruction input.

## Scoring and output

- [x] **SCORE-01:** Completion, readiness, gaps, Decision Score, and recommended action implement the domain contract and have behavioral tests.
- [x] **OUTPUT-01:** Structured Markdown is the canonical generated specification. Verified through a published Default template, named draft/published template lifecycle, safe placeholders, server-side preview and rendering, remembered project selection, and immutable revision provenance.
- [ ] **OUTPUT-01.1:** A reviewed Markdown revision can be delivered as an internal Claude Code handoff. `COMM-01.1` is its satisfied safety prerequisite; no Customer SMTP route may consume this handoff.
- [ ] **OUTPUT-02:** Acceptance criteria and user stories derive from the canonical specification.
- [ ] **OUTPUT-03:** PDF and spreadsheet exports derive from the canonical specification and handle Hungarian text and dynamic content.
- [x] **DOC-00:** A Git-tracked roadmap and documentation index distinguish delivered behavior, planned work, opportunities, improvements, and historical delivery evidence.

## Data and platform evolution

- [ ] **DATA-01:** PostgreSQL schema preserves stable IDs, timestamps, archived state, selected playbook version, answers, follow-ups, and derived-state provenance.
- [ ] **DATA-02:** Schema migrations are explicit, versioned, and reversible where practical.
- [ ] **DATA-03:** Backup and restore are implemented and verified on the current platform.
- [x] **DOC-01:** A Hungarian end-user guide explains the stable delivered workflows without presenting planned domain behavior as available functionality.
- [ ] **MIG-01:** Supported project exports can be imported non-destructively and idempotently.
- [ ] **PWA-01:** The Angular application is installable and its offline/update behavior is verified.
- [ ] **SEC-01:** Authentication and authorization are defined before multi-user data access is enabled.
- [ ] **AI-01:** Any live LLM integration is optional, explicitly consented, and isolated behind a replaceable boundary.
