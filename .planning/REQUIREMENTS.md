# Project Maker web-platform requirements

This is the current delivery baseline. Checked items are verified in the
Angular/NestJS monorepo; unchecked items remain future delivery work.
Current delivery status is maintained in [`docs/roadmap.md`](../docs/roadmap.md).
The current implementation and delivery status are maintained in
[the roadmap](../docs/roadmap.md) and the relevant source and test files.

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
- [ ] **PROJECT-UX-01:** Project basics and the Customer contact remain editable after schema publication; restore returns the previous phase; explicit deletion cascades internal-only draft data; Customer communication or Git handoff history requires archive; archived outputs remain downloadable.
- [x] **INTAKE-02:** Users can run the versioned guided interview/checklist and record answers. A published project question schema starts exactly one `OPEN` round, records answers and assessments, rejects duplicate open starts with HTTP 409, and always permits `OPEN → ENDED` once technical saves are settled. An ended round remains editable only through its one active customer-handoff draft; sent versions are immutable, later Initial Intake rounds are allowed, and archived projects are read-only.
- [x] **INTAKE-06:** Ending an interview creates a versioned customer-handoff draft that can be previewed, explicitly emailed, retried with delivery-risk safeguards, revised into later immutable sent versions, and inspected as history. Named internal/customer ownership and archived read-only behavior are enforced by API and UI.
- [x] **INTAKE-03:** Answers autosave and remain recoverable after restart. Verified for persisted answers in the first `INITIAL_INTAKE` slice: text autosaves after the 750 ms quiet period, discrete values save immediately, failed saves keep the draft and expose retry, reload/API restart/Compose-backed recovery return the same active round and answer from PostgreSQL.
- [x] **INTAKE-04:** Users can manage follow-ups with owner, due date, status, answer/decision, next step, and optional Initial Intake source linkage.
- [x] **INTAKE-05:** The UI provides Hungarian coaching content and deterministic answer-quality guidance. Verified for the first `INITIAL_INTAKE` slice: loading, blocked, save, retry, validation, completion, and round-state messages are Hungarian, and question coaching is rendered deterministically from persisted contract metadata without a model or keyword path.
- [ ] **CONTACT-01:** Users can maintain simple Project-owned contacts with no stakeholder roles, permissions, organization directory, or CRM workflow.
- [ ] **ROUNDS-02:** `STAKEHOLDER` and `CLARIFICATION` rounds can be open independently. They freeze selected Question Bank prompts or employee-authored ad-hoc clarification questions without adding meeting management.
- [ ] **INSIGHT-01:** Users author an Insight and attach or snapshot its supporting Project sources in the same form; Evidence remains reusable provenance rather than a prerequisite workflow.
- [ ] **ATTACH-01:** Authenticated employees can upload and download bounded governed attachments with size/type limits, safe names, inert PostgreSQL storage, safe download, and lifecycle checks. Operator-provided antivirus is reused when configured but its absence does not block unrelated discovery work.
- [ ] **PLAYBOOK-02:** System-integration and data-migration playbook versions are added without rewriting `general` v1. A Project can change playbook until its first interview round starts.

## Customer communication

- [x] **COMM-01.1:** Customer SMTP is structurally separated from internal Markdown delivery. The versioned Interview customer handoff is the only full customer-summary email; authored follow-up pings use exact preview, durable manual and scheduled delivery, explicit `FAILED`/`UNKNOWN` recovery, redacted audit data, and no Markdown revision, `.md` attachment, or Claude instruction input.
- [ ] **COLLAB-01:** Users can send several independent expiring/revocable Customer response requests per active Project. One frozen preview and confirmation sends the request; browser-local draft recovery protects unsent answers; submission is retained once without creating Customer accounts.
- [ ] **NOTIFY-01:** A bounded shared list surfaces due/overdue work, new Customer responses or replies, and failed Customer delivery. It has no rule builder, cadence reminder, signed cursor, personal preferences, or realtime delivery.

## Scoring and output

- [x] **SCORE-01:** Completion, readiness, gaps, Decision Score, and recommended action implement the domain contract and have behavioral tests.
- [ ] **DECISION-01:** Users record concise Go, Conditional Go, or No-Go decisions with rationale, actor, conditional fields, and optional references to the applicable Decision Review, Insights, and Specification; no full approval snapshot is duplicated.
- [ ] **STATUS-01:** Users publish health, summary, changes, risks, and next step. The latest status update remains editable until a newer update is published.
- [ ] **PORTFOLIO-01:** Fixed filters, sorts, archive scope, bounded page/offset pagination, and browser-local saved views support Portfolio work without a generic query framework.
- [ ] **ROADMAP-01:** Business goals group Initiatives and Projects. Confirmed container deletion unassigns Projects instead of requiring manual emptying.
- [x] **OUTPUT-01:** Structured Markdown is the canonical generated specification. Verified through a published Default template, named draft/published template lifecycle, safe placeholders, server-side preview and rendering, remembered project selection, and immutable revision provenance.
- [x] **OUTPUT-01.1:** A Specification-derived Markdown artifact can be downloaded, read through the actor-bound MCP connection, and used unchanged by the confirmed internal Git handoff. No Customer SMTP route may consume it.
- [x] **OUTPUT-02:** A shared editable Delivery package derives stories and acceptance criteria from one exact Specification version. Exact excerpt selection and a separate approval state do not block editing, export, or handoff preview.
- [x] **OUTPUT-03:** Hungarian-safe print/PDF and CSV exports derive from any saved Delivery package, including retained archived content, and identify draft versus handed-off provenance.
- [x] **GIT-01:** Every Internal user can maintain and use shared SSH/HTTPS Git setups with retained encrypted credentials. A push uses one exact preview and confirmation, stores its snapshot and commit SHA, and reconciles an ambiguous result by SHA before retry.
- [x] **DOC-00:** A Git-tracked roadmap and documentation index distinguish delivered behavior, planned work, opportunities, improvements, and historical delivery evidence.

## Data and platform evolution

- [ ] **DATA-01:** PostgreSQL schema preserves stable IDs, timestamps, archived state, selected playbook version, answers, follow-ups, and derived-state provenance.
- [ ] **DATA-02:** Schema migrations are explicit and forward-safe. Retained business data must be preserved, but every feature does not require a destructive down-migration or guarded reversal test.
- [ ] **DATA-03:** Backup and restore are implemented and verified on the current platform.
- [x] **DOC-01:** A Hungarian end-user guide explains the stable delivered workflows without presenting planned domain behavior as available functionality.
- [ ] **MIG-01:** Supported project exports can be imported non-destructively and idempotently.
- [ ] **PWA-01:** The Angular application is installable and its offline/update behavior is verified.
- [ ] **SEC-01:** The VPN restricts reachability; local email/password sessions identify actors; every active Internal user has the same capabilities. Origin/session protection and rate limits cover authentication, recovery, and public Customer boundaries without roles, memberships, or per-user setup permissions.
- [ ] **CONC-01:** Optimistic conflicts protect only high-value shared edits where an overwrite would lose meaningful work; ordinary internal CRUD uses normal save, timestamps, and actor audit.
- [x] **MCP-01:** Each Internal user can create, replace, and revoke one actor-bound Project Maker token and connect their own Claude Code subscription to the VPN-only `/mcp` endpoint. The bounded tools read Projects and Specifications and call the existing Delivery package, Question Bank, Markdown template, and Git preview-confirm services; Project Maker receives no Claude credential, calls no model API, adds no roles or scopes, and exposes no Customer-mail action. Claude Code must request fresh human approval for the Git confirmation tool.
