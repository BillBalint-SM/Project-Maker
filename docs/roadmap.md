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

## Reconciliation note

The `PLANNED` catalogue below was reconciled after the merged Discovery
follow-up deep-module delivery. That delivery improved module ownership,
independent loading failure recovery, and style locality for already-delivered
follow-up workflows; it did not add a new business outcome. No `PLANNED` item
therefore changes status in this reconciliation. Each row records the delivered
foundation separately from the remaining accepted scope.

## DELIVERED

| ID | Outcome | Delivered scope | Evidence |
| --- | --- | --- | --- |
| `FOUND-01` | Run Project Maker as an internal web platform | pnpm monorepo; Angular/NestJS/contracts; internal Compose topology; health, CORS, and PostgreSQL migrations | [README](../README.md), [operations handoff](operations-handoff.md), `29895ef`, `a5eacc6` |
| `DOMAIN-01` | Use a stable discovery vocabulary and versioned playbook | immutable `general` v1 contract, editable base-question bank, and project question-schema snapshots | [product domain](product-domain.md), [general v1 contract](../packages/contracts/playbooks/general.v1.json), [project-schema route](../apps/api/src/question-bank/project-question-schema.controller.ts) |
| `INTAKE-01` | Manage the lifecycle of a discovery project | create, list, coordination and lifecycle edit, archive, restore, and guarded deletion of an eligible draft | `5a26f53`, [project controller](../apps/api/src/projects/projects.controller.ts), [lifecycle E2E](../apps/api/test/projects.e2e-spec.ts) |
| `INTAKE-02` | Run one reliable initial intake | `INITIAL_INTAKE` question snapshots, answer recording, active-round recovery, and durable meeting-end state | [round E2E](../apps/api/test/question-rounds.e2e-spec.ts), [interview API](../apps/api/src/interviews), [browser E2E](../apps/web/e2e/guided-intake.spec.ts) |
| `INTAKE-03` | Preserve discovery answers through normal interruptions | 750 ms text autosave, immediate discrete saves, retry, and reload/API-restart recovery | [interview page](../apps/web/src/app/interviews/interview.page.ts), [browser E2E](../apps/web/e2e/guided-intake.spec.ts) |
| `INTAKE-04.1` | Create and review accountable discovery follow-ups | Separate project-owned `GET`/`POST` resource with category, question, owner, date-only due date, canonical `Nyitott` initial status, next step, a safe creation audit event, archive read-only behavior, restore re-enablement, and deletion-retention protection | [API E2E](../apps/api/test/projects.e2e-spec.ts), [browser E2E](../apps/web/e2e/discovery-follow-ups.spec.ts) |
| `INTAKE-04.2` | Resolve accountable discovery follow-ups | Explicit `POST /projects/:projectId/discovery-follow-ups/:followUpId/resolve` command returns `200`, accepts only the canonical terminal statuses `Megválaszolva` and `Nem releváns`, persists a required answer/decision, rejects archived and already-resolved work items, and writes a safe two-key resolution audit event | [API E2E](../apps/api/test/projects.e2e-spec.ts), [browser E2E](../apps/web/e2e/discovery-follow-ups.spec.ts) |
| `INTAKE-04.3a` | Edit an open discovery follow-up safely | Version-checked `PATCH` editing of category, question, owner, date-only due date, and next step; stale writes return `409`, equivalent edits are no-ops, real edits add a redacted update audit event, and archive remains read-only | [API E2E](../apps/api/test/projects.e2e-spec.ts), [browser E2E](../apps/web/e2e/discovery-follow-ups.spec.ts) |
| `INTAKE-04.3b` | Link a discovery follow-up to its intake origin | Optional linked creation; candidates from the current Initial Intake source; open-only add/change/remove; immutable resolved provenance; version/no-op/audit safeguards; and compact, redacted cards and audit data | [API E2E](../apps/api/test/projects.e2e-spec.ts), [browser E2E](../apps/web/e2e/discovery-follow-ups.spec.ts), [employee guide](user-guide.md) |
| `INTAKE-04` | Complete accepted discovery-follow-up management | `INTAKE-04.1`, `INTAKE-04.2`, `INTAKE-04.3a`, and `INTAKE-04.3b` deliver creation, review, resolution, safe open-item editing, and optional source linkage. This does not add customer email scheduling, future decision support, or other lifecycle work. | [product domain](product-domain.md), [operations handoff](operations-handoff.md), [user guide](user-guide.md) |
| `INTAKE-05` | Coach Hungarian users deterministically | Hungarian UI states and contract-derived answer guidance without live AI | [general v1 contract](../packages/contracts/playbooks/general.v1.json), [browser E2E](../apps/web/e2e/guided-intake.spec.ts) |
| `INTAKE-06` | Close every interview meeting and hand a versioned summary to the customer | Meeting end is independent from business completeness; the named internal owner and concrete next-action party replace free-form ball ownership; the first editable handoff can be sent immediately or later; sent versions are immutable; customer feedback starts a summarized new draft; preview freshness, single-flight sending, retry, and unknown-delivery recovery prevent silent duplicate or stale sends. | [API E2E](../apps/api/test/interview-customer-handoff.e2e-spec.ts), [employee guide](user-guide.md) |
| `AUDIT-01` | Explain important project changes | protected technical audit plus five allow-listed, human-readable Project-status activities | `d1043aa`, [operations handoff](operations-handoff.md) |
| `OUTPUT-00` | Preserve revisioned project snapshots | manual and milestone-triggered Markdown revisions with download | `d1043aa`, [operations handoff](operations-handoff.md) |
| `OUTPUT-01` | Generate the canonical structured Markdown specification | Organisation-level named template library with editable drafts, immutable published versions, safe required/optional placeholders, representative preview, a published Default template, remembered per-project selection, and immutable template provenance on generated revisions | [specification](https://github.com/BillBalint-SM/Project-Maker/issues/31), [API E2E](../apps/api/test/projects.e2e-spec.ts), [browser E2E](../apps/web/e2e/markdown-template-library.spec.ts), [employee guide](user-guide.md) |
| `COMM-01.1` | Separate Customer SMTP from internal agent handoffs | Versioned Interview customer handoff plus authored, previewed and optionally referenced Customer follow-up ping delivery through the Operator organization's dedicated TLS SMTP/IMAP gateway. The configured correspondence identity is the fixed sender; every logical delivery owns immutable outbound, correspondence and central Reply-To identities. Manual and PostgreSQL-coordinated scheduled attempts survive reload, preserve identity across explicit retry, retain `FAILED`/`UNKNOWN` recovery semantics, and never retry automatically. Customer follow-up production code and contracts expose no Markdown revision, `.md`, or Claude delivery concept. | [issue](https://github.com/BillBalint-SM/Project-Maker/issues/40), [boundary verification](../scripts/verify-comm-01-1-boundary.mjs), [operations handoff](operations-handoff.md), [API E2E](../apps/api/test/customer-smtp-boundary.e2e-spec.ts), [browser E2E](../apps/web/e2e/customer-smtp-boundary.spec.ts) |
| `DOC-01` | Teach employees every stable delivered workflow | Hungarian business-functional guide for all current routes, actions, states, side effects, recovery branches, and limitations, supported by eleven sanitized screenshots and three workflow diagrams | [user guide](user-guide.md), [guided-intake E2E](../apps/web/e2e/guided-intake.spec.ts), [discovery E2E](../apps/web/e2e/discovery-follow-ups.spec.ts), [readiness E2E](../apps/web/e2e/readiness-review.spec.ts), [deletion E2E](../apps/web/e2e/project-delete.spec.ts) |
| `SCORE-01.1` | Show completion, readiness, factors, and ordered remediation gaps | Delivered for the canonical current `general` v1 initial-intake schema: persisted effective checklist assessments, completion gating, readiness availability states, a dedicated Readiness page, and redacted remediation navigation. | [readiness E2E](../apps/web/e2e/readiness-review.spec.ts), [user guide](user-guide.md), [operations handoff](operations-handoff.md), `af6d81d` |
| `SCORE-01.2` | Show Decision Score and recommendation | A server-derived Decision Review atomically retains six nullable 1–5 inputs and, only with canonical current readiness, returns the rounded weighted Score, label, recommendation, safe readiness/gap explanation, and policy weights/inversions. It is read-only while archived, has no client scoring copy, and excludes formal Go/Conditional Go/No-Go recording and stored derived snapshots. | [Decision Review API E2E](../apps/api/test/projects.e2e-spec.ts), [browser E2E](../apps/web/e2e/decision-review.spec.ts), [product domain](product-domain.md), [ADR-0002](adr/0002-pre-delivery-decision-score-policy-correction.md) |

For `INTAKE-01`, `DELETE /projects/:projectId` returns `204` only for a bare
`DRAFT`. Any retained activity maps to a generic `409` and the project must be
archived instead. This is not a project-list bulk-delete capability.

## PLANNED

| ID | Outcome | Current implementation state and remaining boundary | Source/dependency |
| --- | --- | --- | --- |
| `ATTACH-01` | Retain governed discovery attachments where employees use them | No retained file-content module exists. The final implementation plan adds versioned Question Bank reference files and Project work attachments on Initial Intake checklist snapshots and Discovery follow-ups, with bounded disk-spooled upload, strict type inspection, ClamAV scanning, idempotent retry, PostgreSQL integrity, safe download, lifecycle enforcement, measured performance, and recovery coverage. It does not create a general document library or retain Customer inbound attachment content from the Correspondence mailbox. Implementation can be tested with synthetic identity, but production routes and UI remain disabled until `SEC-01` supplies authenticated employee authorization and CSRF/rate-limit controls. | [final plan](attach-01-governed-discovery-attachments.md), [storage decision](adr/0005-store-bounded-attachments-in-postgresql.md), and [primary-source research](research/attach-01-file-upload-best-practices.md); implements a `DATA-02` migration slice, advances `DATA-01`/`DATA-03`, and depends on the `SEC-01` production-activation gate |
| `OUTPUT-01.1` | Deliver a reviewed Markdown revision as an internal Claude Code handoff | No Claude Code handoff delivery exists. The `COMM-01.1` Customer SMTP separation prerequisite is satisfied; implementation must remain on an internal boundary and cannot add Markdown or `.md` input to Customer email. | [requirements](../.planning/REQUIREMENTS.md); depends on delivered `OUTPUT-01` and `COMM-01.1` |
| `OUTPUT-02` | Derive acceptance criteria and user stories from the canonical specification | No derivation pipeline exists. It starts only after `OUTPUT-01` establishes the canonical source. | [requirements](../.planning/REQUIREMENTS.md); depends on `OUTPUT-01` |
| `OUTPUT-03` | Produce Hungarian-safe PDF and spreadsheet exports | No PDF or spreadsheet export pipeline exists. It must derive from `OUTPUT-01`, not introduce a parallel authoring source. | [requirements](../.planning/REQUIREMENTS.md); depends on `OUTPUT-01` |
| `DATA-01` | Preserve complete discovery and derived-state provenance | Current entities preserve the delivered project, intake, follow-up, and Markdown-revision slices. Storage for every future derived-state and provenance field is not yet proven. | [requirements](../.planning/REQUIREMENTS.md); depends on planned feature data |
| `DATA-02` | Evolve the schema through explicit, versioned migrations with reversible intent | Twenty-four explicit migrations support the delivered slices. The current sequence retains versioned handoffs and pings, mailbox delta state, inbound Customer messages, correspondence processing, receipt-proven revision history, unmatched-mail triage, and provider-neutral Operator sender snapshots; guarded reversal refuses to discard retained communication evidence. A durable policy for every future evolution and reversal remains planned and must accompany the relevant schema change. | [requirements](../.planning/REQUIREMENTS.md); [operations handoff](operations-handoff.md); [supported-baseline migration proof](../apps/api/test/m365-channel-upgrade-migration.e2e-spec.ts) |
| `DATA-03` | Implement and verify platform backup and restore | The operations handoff documents manual PostgreSQL backup and controlled restore commands, but retention, rotation, and a verified restore drill remain unproven. | [requirements](../.planning/REQUIREMENTS.md); [operations handoff](operations-handoff.md); operationalized by `OPS-01` |

## OPPORTUNITY

| ID | Outcome | Boundary | Source/dependency |
| --- | --- | --- | --- |
| `ROUNDS-02` | Support `STAKEHOLDER` and `CLARIFICATION` rounds | Does not extend the delivered `INITIAL_INTAKE` slice yet | [requirements](../.planning/REQUIREMENTS.md), [product domain](product-domain.md) |
| `PLAYBOOK-02` | Support additional versioned playbooks | Does not mutate `general` v1 | [product domain](product-domain.md) |
| `MIG-01` | Import supported project exports idempotently | Import format and migration policy remain undecided | [requirements](../.planning/REQUIREMENTS.md) |
| `PWA-01` | Support installable offline and update behavior | Does not imply offline queueing | [requirements](../.planning/REQUIREMENTS.md) |
| `AI-01` | Offer consented, replaceable AI enrichment | The core workflow remains deterministic without AI | [requirements](../.planning/REQUIREMENTS.md) |

## IMPROVEMENT

| ID | Outcome | Boundary | Source/dependency |
| --- | --- | --- | --- |
| `SEC-01` | Protect multi-user data access | Authentication, authorization, and rate limiting are required before exposure beyond an internal/VPN boundary | [requirements](../.planning/REQUIREMENTS.md), [operations handoff](operations-handoff.md) |
| `MAIL-01` | Make email delivery operationally robust | Durable outbox/idempotency remains separate hardening work; the current gateway activation uses controlled TLS SMTP/IMAP smoke evidence | [operations handoff](operations-handoff.md), [mail gateway](mail-gateway.md) |
| `OPS-01` | Harden recovery operations | Retention, rotation, and a restore drill operationalize `DATA-03`; they do not replace the backup implementation | [operations handoff](operations-handoff.md), `DATA-03` |
| `CONC-01` | Define multi-client conflict handling | Current single-user persistence does not imply collaboration safety | [requirements](../.planning/REQUIREMENTS.md) |
| `DOC-02` | Keep product and operational documentation current | Link health and delivery-state reconciliation are part of every documentation change | [documentation index](README.md), [roadmap](roadmap.md) |

## Dependencies and gates

```text
INTAKE-01 + INTAKE-02/03/05 → INTAKE-06 → INTAKE-04 → SCORE-01 → OUTPUT-01 → OUTPUT-02/03
```

`SEC-01`, `MAIL-01`, and `OPS-01` are cross-cutting exposure and reliability
gates. They do not postpone their underlying security or operational needs.

## Documentation lifecycle

`docs/roadmap.md` is the current delivery-status source. The
[product domain](product-domain.md) defines domain intent rather than delivered
behavior. Source, tests, and operational documentation are the evidence for
current behavior. The [Hungarian end-user guide](user-guide.md) is the canonical
daily-work manual for the delivered user workflows; roadmap-only behavior
remains explicitly outside its available-function boundary.
