# Project Maker roadmap

## Purpose and update rule

This document is the current feature catalogue. It records verified delivery
status rather than a date-based release schedule. Update it in the same reviewed
change as a feature's delivery-state documentation. It contains no planned dates,
completion percentages, or effort calculations.

## Status vocabulary

- `DELIVERED`: merged behavior with code, commit, test, or handoff evidence.
- `PLANNED`: accepted work with a requirement or design source.
- `OPPORTUNITY`: viable product possibility that is not committed for delivery.
- `IMPROVEMENT`: security, reliability, usability, operations, or documentation hardening.

## Accepted macro roadmap

The [Wayfinder map](https://github.com/BillBalint-SM/Project-Maker/issues/116)
groups the accepted work into five outcome-sized delivery batches. These are
large planning and delivery groupings, not serial release gates, one-PR mandates,
or a reason to create one implementation ticket per field, endpoint, or screen.
Only the concrete prerequisites named below may block a slice in another batch.
The batches carry no promised dates, effort percentages, or hidden work-item
hierarchy.

| Order | Macro batch | Included outcomes | Dependency boundary | Minimum affected-risk exit evidence |
| --- | --- | --- | --- | --- |
| `1` | [Trust and operability](https://github.com/BillBalint-SM/Project-Maker/issues/117) | VPN-restricted Login / Sign up; self-managed local email-and-password accounts; actor-bound audit; durable mail outbox; targeted conflict protection; backup/restore operations; authentication/public-boundary rate limiting; CSRF and accessibility baseline | Identity must precede general multi-user exposure. Mail recovery applies only to Customer sends. Backup drills run operationally in parallel and do not block unrelated features. | Authentication and actor-audit API evidence; outbox recovery only when mail changes; one representative keyboard/focus browser path |
| `2` | [Evidence-based discovery](https://github.com/BillBalint-SM/Project-Maker/issues/118) | Editable Project contacts without roles; parallel `STAKEHOLDER` and `CLARIFICATION` rounds with frozen bank or ad-hoc questions; inline Evidence/Insight capture; bounded attachments; selectable versioned playbooks | Authentication protects production file access. Individual discovery slices need not wait for the whole trust batch or attachment scanner. | One focused contact/round/Insight API path; upload boundary checks only when attachment code changes; one short critical browser path |
| `3` | [Decision and portfolio](https://github.com/BillBalint-SM/Project-Maker/issues/119) | Concise Go / Conditional Go / No-Go records; practical Portfolio filtering, sorting, archive access, and local saved views; editable-latest Project status updates; lightweight Business goal → Initiative → Project roadmap | Decision records may reference delivered Decision Review, Specification, or Insights, but none of the Portfolio/status/roadmap slices waits for Batch 2 as a whole. | One decision API path; independent filter/sort contracts without cross-products; one status-to-Portfolio browser path |
| `4` | [Customer collaboration](https://github.com/BillBalint-SM/Project-Maker/issues/120) | Narrow Customer response links with browser-local draft recovery; multiple independent requests per Project; a small notification list for due work, new Customer responses, and failed delivery | The public response boundary needs identity separation, safe capability links, and the existing mail path. It does not depend on Portfolio, attachments, or Batch 3. | One invalid-link group, one request/submit/review path, and one check per retained notification family |
| `5` | [Outputs and delivery](https://github.com/BillBalint-SM/Project-Maker/issues/121) | Editable Specification-derived delivery packages; Markdown, print/PDF, and CSV export from saved or archived content; shared retained Git setups; one preview-and-confirm Git handoff; actor-bound Project Maker MCP connection for each user's own Claude Code subscription | Package and exports depend only on delivered `OUTPUT-01`. MCP reuses existing Project Maker services; Git handoff additionally needs a saved package and Git setup. Customer collaboration is unrelated and is not exposed. | Package/output contracts; one local bare-Git preview/push/reconciliation path; one MCP handshake/tool-contract check plus the same Git preview-confirm path |

Verification follows affected risk, not batch membership: test the changed
domain/API contract and at most one short critical user journey. Add migration,
restore, concurrency, idempotency, or external-reconciliation evidence only when
that exact change touches durable data, concurrent high-value editing, or an
external side effect. Security-negative paths and accessibility checks remain
mandatory only at the boundary they protect. Unrelated suites are not release
gates for a slice.

## Reconciliation note

The catalogue was reconciled after the Outputs and delivery implementation.
`OUTPUT-01.1`, `OUTPUT-02`, `OUTPUT-03`, `GIT-01`, and `MCP-01` now have code
and targeted evidence, so they moved from `PLANNED` to `DELIVERED`. The MCP
connector replaces the earlier embedded/provider-AI proposal; it reuses the
existing business services and the user's own Claude Code subscription.

## DELIVERED

| ID | Outcome | Delivered scope | Evidence |
| --- | --- | --- | --- |
| `FOUND-01` | Run Project Maker as an internal web platform | pnpm monorepo; Angular/NestJS/contracts; internal Compose topology; health, CORS, and PostgreSQL migrations | [README](../README.md), [operations handoff](operations-handoff.md), `29895ef`, `a5eacc6` |
| `DOMAIN-01` | Use a stable discovery vocabulary and versioned playbook | immutable `general` v1 contract, editable base-question bank, and project question-schema snapshots | [product domain](product-domain.md), [general v1 contract](../packages/contracts/playbooks/general.v1.json), [project-schema route](../apps/api/src/question-bank/project-question-schema.controller.ts) |
| `INTAKE-01` | Manage the lifecycle of a discovery project | create, list, coordination and lifecycle edit, archive, restore, and guarded deletion of an eligible draft | `5a26f53`, [project controller](../apps/api/src/projects/projects.controller.ts), [lifecycle E2E](../apps/api/test/projects.e2e-spec.ts) |
| `PROJECT-UX-01` | Remove lifecycle dead ends from normal Project work | Active basics and Customer contact editing continue after schema publication; archive/restore resumes the complete saved phase and reminder cadence without replay; explicit `DRAFT` deletion cascades internal-only work while Customer communication or Git handoff history requires archive; retained archived outputs remain downloadable. | [project lifecycle E2E](../apps/api/test/projects.e2e-spec.ts), [reminder E2E](../apps/api/test/customer-follow-up-ping.e2e-spec.ts), [migration 0034](../apps/api/src/migrations/0034-project-draft-deletion.ts) |
| `INTAKE-02` | Run one reliable initial intake | `INITIAL_INTAKE` question snapshots, answer recording, active-round recovery, and durable meeting-end state | [round E2E](../apps/api/test/question-rounds.e2e-spec.ts), [interview API](../apps/api/src/interviews), [browser E2E](../apps/web/e2e/guided-intake.spec.ts) |
| `INTAKE-03` | Preserve discovery answers through normal interruptions | 750 ms text autosave, immediate discrete saves, retry, and reload/API-restart recovery | [interview page](../apps/web/src/app/interviews/interview.page.ts), [browser E2E](../apps/web/e2e/guided-intake.spec.ts) |
| `INTAKE-04.1` | Create and review accountable discovery follow-ups | Separate project-owned `GET`/`POST` resource with category, question, owner, date-only due date, canonical `Nyitott` initial status, next step, a safe creation audit event, archive read-only behavior, restore re-enablement, and inclusion in the explicit internal-only `DRAFT` project cascade | [API E2E](../apps/api/test/projects.e2e-spec.ts), [browser E2E](../apps/web/e2e/discovery-follow-ups.spec.ts) |
| `INTAKE-04.2` | Resolve accountable discovery follow-ups | Explicit `POST /projects/:projectId/discovery-follow-ups/:followUpId/resolve` command returns `200`, accepts only the canonical terminal statuses `Megválaszolva` and `Nem releváns`, persists a required answer/decision, rejects archived and already-resolved work items, and writes a safe two-key resolution audit event | [API E2E](../apps/api/test/projects.e2e-spec.ts), [browser E2E](../apps/web/e2e/discovery-follow-ups.spec.ts) |
| `INTAKE-04.3a` | Edit an open discovery follow-up safely | Version-checked `PATCH` editing of category, question, owner, date-only due date, and next step; stale writes return `409`, equivalent edits are no-ops, real edits add a redacted update audit event, and archive remains read-only | [API E2E](../apps/api/test/projects.e2e-spec.ts), [browser E2E](../apps/web/e2e/discovery-follow-ups.spec.ts) |
| `INTAKE-04.3b` | Link a discovery follow-up to its intake origin | Optional linked creation; candidates from the current Initial Intake source; open-only add/change/remove; immutable resolved provenance; version/no-op/audit safeguards; and compact, redacted cards and audit data | [API E2E](../apps/api/test/projects.e2e-spec.ts), [browser E2E](../apps/web/e2e/discovery-follow-ups.spec.ts), [employee guide](user-guide.md) |
| `INTAKE-04` | Complete accepted discovery-follow-up management | `INTAKE-04.1`, `INTAKE-04.2`, `INTAKE-04.3a`, and `INTAKE-04.3b` deliver creation, review, resolution, safe open-item editing, and optional source linkage. This does not add customer email scheduling, future decision support, or other lifecycle work. | [product domain](product-domain.md), [operations handoff](operations-handoff.md), [user guide](user-guide.md) |
| `INTAKE-05` | Coach Hungarian users deterministically | Hungarian UI states and contract-derived answer guidance without live AI | [general v1 contract](../packages/contracts/playbooks/general.v1.json), [browser E2E](../apps/web/e2e/guided-intake.spec.ts) |
| `INTAKE-06` | Close every interview meeting and hand a versioned summary to the customer | Meeting end is independent from business completeness; the named internal owner and concrete next-action party replace free-form ball ownership; the first editable handoff can be sent immediately or later; sent versions are immutable; customer feedback starts a summarized new draft; preview freshness, single-flight sending, retry, and unknown-delivery recovery prevent silent duplicate or stale sends. | [API E2E](../apps/api/test/interview-customer-handoff.e2e-spec.ts), [employee guide](user-guide.md) |
| `AUDIT-01` | Explain important project changes | protected technical audit plus five allow-listed, human-readable Project-status activities | `d1043aa`, [operations handoff](operations-handoff.md) |
| `OUTPUT-00` | Preserve revisioned project snapshots | manual and milestone-triggered Markdown revisions with download | `d1043aa`, [operations handoff](operations-handoff.md) |
| `OUTPUT-01` | Generate the canonical structured Markdown specification | Organisation-level named template library with editable drafts, immutable published versions, safe required/optional placeholders, representative preview, a published Default template, remembered per-project selection, and immutable template provenance on generated revisions | [specification](https://github.com/BillBalint-SM/Project-Maker/issues/31), [API E2E](../apps/api/test/projects.e2e-spec.ts), [browser E2E](../apps/web/e2e/markdown-template-library.spec.ts), [employee guide](user-guide.md) |
| `OUTPUT-01.1` | Deliver a Specification-derived Markdown artifact through Git | The same internal artifact is downloadable, available to actor-bound MCP reads, and used unchanged by the confirmed Git handoff; Customer email cannot consume it. | [Delivery API E2E](../apps/api/test/delivery-package.e2e-spec.ts), [MCP E2E](../apps/api/test/mcp.e2e-spec.ts), [employee guide](user-guide.md) |
| `OUTPUT-02` | Author a shared delivery package from the canonical Specification | One editable package is bound to an exact Specification version; its titles, stories, acceptance criteria, and optional excerpts remain editable, and each Git handoff retains an immutable snapshot. | [Delivery API E2E](../apps/api/test/delivery-package.e2e-spec.ts), [Delivery page](../apps/web/src/app/projects/delivery/delivery.page.ts) |
| `OUTPUT-03` | Produce Hungarian-safe print/PDF and CSV exports | Saved active or archived packages export as Markdown, formula-safe UTF-8 CSV, and Hungarian print/PDF-ready HTML with draft or handed-off provenance. | [Delivery API E2E](../apps/api/test/delivery-package.e2e-spec.ts), [Delivery page](../apps/web/src/app/projects/delivery/delivery.page.html) |
| `GIT-01` | Maintain shared Git setups and confirm one-way handoffs | Every Internal user can maintain and use shared SSH/HTTPS setups with retained credentials. Push needs an exact preview and confirmation, retains the package/target snapshot and commit SHA, and reconciles ambiguous results by expected SHA. | [Delivery API E2E](../apps/api/test/delivery-package.e2e-spec.ts), [local bare-Git integration](../apps/api/test/git-client.integration.spec.ts) |
| `MCP-01` | Connect each user's Claude Code to Project Maker workflows | One self-managed token identifies the Internal user at the VPN-only Streamable HTTP endpoint. Thirteen bounded tools reuse Project, Specification, Delivery package, Question Bank, Markdown template, and Git preview-confirm services; Git confirmation always requests fresh human approval. There is no provider API, shared Claude account, role/scope system, generic data access, or Customer-mail tool. | [ADR-0006](adr/0006-connect-claude-code-through-project-maker-mcp.md), [MCP E2E](../apps/api/test/mcp.e2e-spec.ts), [operations handoff](operations-handoff.md) |
| `COMM-01.1` | Separate Customer SMTP from internal agent handoffs | Versioned Interview customer handoff plus authored, previewed and optionally referenced Customer follow-up ping delivery through the Operator organization's dedicated TLS SMTP/IMAP gateway. The configured correspondence identity is the fixed sender; every logical delivery owns immutable outbound, correspondence and central Reply-To identities. Manual and PostgreSQL-coordinated scheduled attempts survive reload, preserve identity across explicit retry, retain `FAILED`/`UNKNOWN` recovery semantics, and never retry automatically. Customer follow-up production code and contracts expose no Markdown revision, `.md`, or Claude delivery concept. | [issue](https://github.com/BillBalint-SM/Project-Maker/issues/40), [operations handoff](operations-handoff.md), [API E2E](../apps/api/test/customer-smtp-boundary.e2e-spec.ts), [browser E2E](../apps/web/e2e/customer-smtp-boundary.spec.ts) |
| `DOC-01` | Teach employees every stable delivered workflow | Hungarian business-functional guide for all current routes, actions, states, side effects, recovery branches, and limitations, supported by eleven sanitized screenshots and three workflow diagrams | [user guide](user-guide.md), [guided-intake E2E](../apps/web/e2e/guided-intake.spec.ts), [discovery E2E](../apps/web/e2e/discovery-follow-ups.spec.ts), [readiness E2E](../apps/web/e2e/readiness-review.spec.ts), [deletion E2E](../apps/web/e2e/project-delete.spec.ts) |
| `SCORE-01.1` | Show completion, readiness, factors, and ordered remediation gaps | Delivered for the canonical current `general` v1 initial-intake schema: persisted effective checklist assessments, completion gating, readiness availability states, a dedicated Readiness page, and redacted remediation navigation. | [readiness E2E](../apps/web/e2e/readiness-review.spec.ts), [user guide](user-guide.md), [operations handoff](operations-handoff.md), `af6d81d` |
| `SCORE-01.2` | Show Decision Score and recommendation | A server-derived Decision Review atomically retains six nullable 1–5 inputs and, only with canonical current readiness, returns the rounded weighted Score, label, recommendation, safe readiness/gap explanation, and policy weights/inversions. It is read-only while archived, has no client scoring copy, and excludes formal Go/Conditional Go/No-Go recording and stored derived snapshots. | [Decision Review API E2E](../apps/api/test/projects.e2e-spec.ts), [browser E2E](../apps/web/e2e/decision-review.spec.ts), [product domain](product-domain.md), [ADR-0002](adr/0002-pre-delivery-decision-score-policy-correction.md) |
| `CONTACT-01`, `ROUNDS-02`, `INSIGHT-01`, `PLAYBOOK-02` | Deliver evidence-based discovery without role or meeting overhead | Project contacts; independent Stakeholder and Clarification rounds; inline/reusable Evidence and Insights; and frozen `system-integration`/`data-migration` playbooks are delivered. | [Discovery API E2E](../apps/api/test/evidence-discovery.e2e-spec.ts), [browser E2E](../apps/web/e2e/evidence-discovery.spec.ts), [migration 0026](../apps/api/src/migrations/0026-evidence-based-discovery.ts) |
| `DECISION-01`, `STATUS-01`, `PORTFOLIO-01`, `ROADMAP-01` | Deliver decision and portfolio working surfaces | Append-only formal decisions, editable-latest status updates, fixed paged Portfolio filters with browser-local saved views, and Business goal → Initiative grouping are delivered. | [Decision/Portfolio API E2E](../apps/api/test/decision-portfolio.e2e-spec.ts), [browser E2E](../apps/web/e2e/decision-portfolio.spec.ts), [migration 0027](../apps/api/src/migrations/0027-decision-and-portfolio.ts) |
| `NOTIFY-01` | Surface immediate shared work | The shared current-state list covers overdue work, Customer responses/replies, and delivery failures without a rule engine, cursor, preferences, or realtime channel. | [Customer response API E2E](../apps/api/test/customer-response-notifications.e2e-spec.ts), [browser E2E](../apps/web/e2e/customer-response-notifications.spec.ts), [migration 0028](../apps/api/src/migrations/0028-customer-response-and-notifications.ts) |
| `COLLAB-01` | Collect narrow Customer responses without Customer accounts | Several independent expiring/revocable requests can be previewed, confirmed, submitted once and reviewed. The public form keeps unsent answers in browser-local storage and clears them after successful submission. | [Customer response API E2E](../apps/api/test/customer-response-notifications.e2e-spec.ts), [public response page](../apps/web/src/app/customer-response/public-customer-response.page.ts), [browser E2E](../apps/web/e2e/customer-response-notifications.spec.ts) |
| `SEC-01` | Use the simple Internal-user boundary | VPN limits reachability; self-service local email/password sessions identify actors; origin/session controls and rate limits protect the relevant boundaries, with no roles, memberships, or per-user setup permissions. | [auth E2E](../apps/api/test/auth.e2e-spec.ts), [migration 0025](../apps/api/src/migrations/0025-local-identity-and-audit-actor.ts) |
| `CONC-01` | Limit optimistic conflicts to consequential shared edits | Version conflicts protect Insights, discovery-follow-up edits, correspondence processing, and other high-loss writes; ordinary CRUD stays direct with audit/timestamps. | [Discovery API E2E](../apps/api/test/evidence-discovery.e2e-spec.ts), [follow-up API E2E](../apps/api/test/projects.e2e-spec.ts) |
| `DATA-01`, `DATA-02` | Preserve data through forward-only evolution | Stable project, identity, discovery, output, Customer-mail, delivery provenance, resumable archive state, explicit draft deletion, and governed attachment ownership survive the retained `0001` → `0035` migration chain. | [supported migration proof](../apps/api/test/supported-migration-sequence.e2e-spec.ts), [migration sequence](../apps/api/test/migration-sequence.spec.ts) |
| `SIMPLIFY-02` | Keep UI mutation state local | Same-command single-flight permits independent project features to remain usable; shared controlled HTTP errors replace repeated diagnostic leakage. | [ADR-0007](adr/0007-command-local-pending-state.md), [web helper](../apps/web/src/app/projects/project-command-pending.ts) |
| `SIMPLIFY-03` | Ship one contracts runtime with a pruned API image | The API consumes the canonical shared contracts artifact directly; its production image does not retain the workspace or package manager runtime. | [API Dockerfile](../apps/api/Dockerfile), [contracts package](../packages/contracts/package.json) |
| `SIMPLIFY-04` | Canonicalize Customer-mail persistence | New/linked Customer-mail records use immutable outbound/correspondence/attempt storage; old incomplete mail records remain readable rather than fabricated or deleted. IMAP uses a strict, plain versioned checkpoint and safely resets an invalid or old checkpoint to a baseline. | [migration 0032](../apps/api/src/migrations/0032-canonical-customer-mail-persistence.ts), [mail migration proof](../apps/api/test/canonical-customer-mail-persistence-migration.e2e-spec.ts) |
| `SIMPLIFY-05` | Prefer no-squash forward migration proof | The oldest supported `0001` schema moves through the retained chain to `0035`; normal recovery is backup plus forward correction, not destructive rollback ceremony. | [supported migration proof](../apps/api/test/supported-migration-sequence.e2e-spec.ts), [operations handoff](operations-handoff.md) |
| `ATTACH-01` | Retain bounded governed attachments safely | Separate Operator organization Question Bank reference-file and Project work-attachment ownership retains exact published-bank/schema reference sets, PostgreSQL bytes, authenticated inert downloads, and archived Project read-only downloads. PDF, PNG, JPEG, and inert UTF-8 TXT are accepted up to 50 MiB or the lower Operator-configured limit. | [attachment design](attach-01-governed-discovery-attachments.md), [attachment API E2E](../apps/api/test/evidence-discovery.e2e-spec.ts), [attachment browser E2E](../apps/web/e2e/discovery-follow-ups.spec.ts), [migration 0035](../apps/api/src/migrations/0035-question-bank-reference-files.ts) |

For `INTAKE-01` and `PROJECT-UX-01`, `DELETE /projects/:projectId` returns `204`
for a `DRAFT` without Customer communication or Git handoff history and removes
its Project-owned internal working data in the same transaction. A non-DRAFT or
either retained external history maps to a generic `409`; the complete Project
remains and must be archived instead.

## PLANNED

| ID | Outcome | Current implementation state and remaining boundary | Source/dependency |
| --- | --- | --- | --- |
| `DATA-03` | Implement and verify platform backup and restore | The operations handoff documents manual PostgreSQL backup and controlled restore commands, but retention, rotation, and a verified restore drill remain unproven. | [requirements](../.planning/REQUIREMENTS.md); [operations handoff](operations-handoff.md); operationalized by `OPS-01` |

## OPPORTUNITY

| ID | Outcome | Boundary | Source/dependency |
| --- | --- | --- | --- |
| `MIG-01` | Import supported project exports idempotently | Import format and migration policy remain undecided | [requirements](../.planning/REQUIREMENTS.md) |
| `PWA-01` | Support installable offline and update behavior | Does not imply offline queueing | [requirements](../.planning/REQUIREMENTS.md) |

## IMPROVEMENT

| ID | Outcome | Boundary | Source/dependency |
| --- | --- | --- | --- |
| `MAIL-01` | Make email delivery operationally robust | Durable outbox/idempotency remains separate hardening work; the current gateway activation uses controlled TLS SMTP/IMAP smoke evidence | [operations handoff](operations-handoff.md), [mail gateway](mail-gateway.md) |
| `OPS-01` | Harden recovery operations | Retention, rotation, and a representative restore drill operationalize `DATA-03` as an Operator task running in parallel with product delivery, not as a gate for unrelated slices. | [operations handoff](operations-handoff.md), `DATA-03` |
| `DOC-02` | Keep product and operational documentation current | Link health and delivery-state reconciliation are part of every documentation change | [documentation index](README.md), [roadmap](roadmap.md) |

## Actual dependencies

```text
SEC-01 → general multi-user production exposure
OUTPUT-01 → OUTPUT-02 → OUTPUT-03
OUTPUT-02 + saved Git setup → confirmed GIT-01 handoff
Internal user token + existing services → MCP-01
ROUNDS-02 or an unresolved follow-up → optional COLLAB-01 prompt source
```

These are slice-level prerequisites. A batch never waits for another batch as a
whole. `MAIL-01` is required only when a changed flow sends Customer email;
`OPS-01` runs as parallel Operator work. Project Maker feature delivery uses the
repository's normal issue/branch/PR flow and targeted verification; no separate
Delivery Control evaluator or feature-dispatch stop applies.

## Documentation lifecycle

`docs/roadmap.md` is the current delivery-status source. The
[product domain](product-domain.md) defines domain intent rather than delivered
behavior. Source, tests, and operational documentation are the evidence for
current behavior. The [Hungarian end-user guide](user-guide.md) is the canonical
daily-work manual for the delivered user workflows; roadmap-only behavior
remains explicitly outside its available-function boundary.
