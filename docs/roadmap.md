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
| `INTAKE-01` | Manage the lifecycle of a discovery project | create, list, workspace edit, archive, restore, and guarded deletion of an eligible draft | `5a26f53`, [project controller](../apps/api/src/projects/projects.controller.ts), [lifecycle E2E](../apps/api/test/projects.e2e-spec.ts) |
| `INTAKE-02` | Run one reliable initial intake | immutable `INITIAL_INTAKE` rounds, answer recording, active-round recovery, and server-side completion validation | [guided-intake plan](superpowers/plans/2026-08-06-guided-intake-persistence.md), [round E2E](../apps/api/test/question-rounds.e2e-spec.ts), `8ae4e4e` |
| `INTAKE-03` | Preserve discovery answers through normal interruptions | 750 ms text autosave, immediate discrete saves, retry, and reload/API-restart recovery | [guided-intake plan](superpowers/plans/2026-08-06-guided-intake-persistence.md), [interview page](../apps/web/src/app/interviews/interview.page.ts) |
| `INTAKE-04.1` | Create and review accountable discovery follow-ups | Separate project-owned `GET`/`POST` resource with category, question, owner, date-only due date, canonical `Nyitott` initial status, next step, a safe creation audit event, archive read-only behavior, restore re-enablement, and deletion-retention protection | [implementation plan](superpowers/plans/2026-08-08-intake-04-discovery-follow-ups.md), [API E2E](../apps/api/test/projects.e2e-spec.ts), [browser E2E](../apps/web/e2e/discovery-follow-ups.spec.ts) |
| `INTAKE-04.2` | Resolve accountable discovery follow-ups | Explicit `POST /projects/:projectId/discovery-follow-ups/:followUpId/resolve` command returns `200`, accepts only the canonical terminal statuses `Megválaszolva` and `Nem releváns`, persists a required answer/decision, rejects archived and already-resolved work items, and writes a safe two-key resolution audit event | [resolution implementation plan](superpowers/plans/2026-08-08-intake-04-follow-up-resolution.md), [API E2E](../apps/api/test/projects.e2e-spec.ts), [browser E2E](../apps/web/e2e/discovery-follow-ups.spec.ts) |
| `INTAKE-04.3a` | Edit an open discovery follow-up safely | Version-checked `PATCH` editing of category, question, owner, date-only due date, and next step; stale writes return `409`, equivalent edits are no-ops, real edits add a redacted update audit event, and archive remains read-only | [editing design](superpowers/specs/2026-08-10-intake-04-discovery-follow-up-editing-design.md), [API E2E](../apps/api/test/projects.e2e-spec.ts), [browser E2E](../apps/web/e2e/discovery-follow-ups.spec.ts) |
| `INTAKE-04.3b` | Link a discovery follow-up to its intake origin | Optional linked creation; candidates from the current Initial Intake source; open-only add/change/remove; immutable resolved provenance; version/no-op/audit safeguards; and compact, redacted cards and audit data | [source-linkage design](superpowers/specs/2026-08-11-intake-04-discovery-follow-up-source-linkage-design.md), [API E2E](../apps/api/test/projects.e2e-spec.ts), [browser E2E](../apps/web/e2e/discovery-follow-ups.spec.ts), [employee guide](user-guide.md) |
| `INTAKE-04` | Complete accepted discovery-follow-up management | `INTAKE-04.1`, `INTAKE-04.2`, `INTAKE-04.3a`, and `INTAKE-04.3b` deliver creation, review, resolution, safe open-item editing, and optional source linkage. This does not add customer email scheduling, future decision support, or other lifecycle work. | [product domain](product-domain.md), [operations handoff](operations-handoff.md), [user guide](user-guide.md) |
| `INTAKE-05` | Coach Hungarian users deterministically | Hungarian UI states and contract-derived answer guidance without live AI | [guided-intake plan](superpowers/plans/2026-08-06-guided-intake-persistence.md), [general v1 contract](../packages/contracts/playbooks/general.v1.json) |
| `AUDIT-01` | Explain important project changes | bounded cockpit audit history and milestone trace | `d1043aa`, [operations handoff](operations-handoff.md) |
| `OUTPUT-00` | Preserve revisioned project snapshots | manual and milestone-triggered Markdown revisions with download | `d1043aa`, [operations handoff](operations-handoff.md) |
| `COMM-01` | Send controlled customer communication | manual customer review and configurable follow-up ping delivery; this is not operational follow-up management | [operations handoff](operations-handoff.md), [follow-up routes](../apps/api/src/follow-ups/follow-up.controller.ts) |
| `DOC-01` | Teach employees every stable delivered workflow | Hungarian business-functional guide for all current routes, actions, states, side effects, recovery branches, and limitations, supported by eight sanitized screenshots and three workflow diagrams | [user guide](user-guide.md), [design](superpowers/specs/2026-08-09-user-guide-design.md), [implementation plan](superpowers/plans/2026-08-09-user-guide.md), [guided-intake E2E](../apps/web/e2e/guided-intake.spec.ts), [discovery E2E](../apps/web/e2e/discovery-follow-ups.spec.ts), [readiness E2E](../apps/web/e2e/readiness-review.spec.ts), [deletion E2E](../apps/web/e2e/project-delete.spec.ts) |
| `SCORE-01.1` | Show completion, readiness, factors, and ordered remediation gaps | Delivered for the canonical current `general` v1 initial-intake schema: persisted effective checklist assessments, completion gating, readiness availability states, a Cockpit review, and redacted remediation navigation. Browser proof passed 3/3 focused and 22/22 full E2E tests. | [readiness E2E](../apps/web/e2e/readiness-review.spec.ts), [user guide](user-guide.md), [operations handoff](operations-handoff.md), `af6d81d` |
| `SCORE-01.2` | Show Decision Score and recommendation | A server-derived Decision Review atomically retains six nullable 1–5 inputs and, only with canonical current readiness, returns the rounded weighted Score, label, recommendation, safe readiness/gap explanation, and policy weights/inversions. It is read-only while archived, has no client scoring copy, and excludes formal Go/Conditional Go/No-Go recording and stored derived snapshots. | [Decision Review API E2E](../apps/api/test/projects.e2e-spec.ts), [browser E2E](../apps/web/e2e/decision-review.spec.ts), [product domain](product-domain.md), [ADR-0002](adr/0002-pre-delivery-decision-score-policy-correction.md) |

For `INTAKE-01`, `DELETE /projects/:projectId` returns `204` only for a bare
`DRAFT`. Any retained activity maps to a generic `409` and the project must be
archived instead. This is not a project-list bulk-delete capability.

## PLANNED

| ID | Outcome | Current implementation state and remaining boundary | Source/dependency |
| --- | --- | --- | --- |
| `OUTPUT-01` | Generate the canonical structured Markdown specification | `OUTPUT-00` already stores manual and milestone Markdown revisions, but that history is not the canonical structured specification. A generator driven by readiness and decision behavior remains planned. | [requirements](../.planning/REQUIREMENTS.md); depends on readiness and decision behavior |
| `OUTPUT-02` | Derive acceptance criteria and user stories from the canonical specification | No derivation pipeline exists. It starts only after `OUTPUT-01` establishes the canonical source. | [requirements](../.planning/REQUIREMENTS.md); depends on `OUTPUT-01` |
| `OUTPUT-03` | Produce Hungarian-safe PDF and spreadsheet exports | No PDF or spreadsheet export pipeline exists. It must derive from `OUTPUT-01`, not introduce a parallel authoring source. | [requirements](../.planning/REQUIREMENTS.md); depends on `OUTPUT-01` |
| `DATA-01` | Preserve complete discovery and derived-state provenance | Current entities preserve the delivered project, intake, follow-up, and Markdown-revision slices. Storage for every future derived-state and provenance field is not yet proven. | [requirements](../.planning/REQUIREMENTS.md); depends on planned feature data |
| `DATA-02` | Evolve the schema through explicit, versioned migrations with reversible intent | Eleven explicit migrations support the delivered slices. Migration `0009` has a guarded rollback that refuses to remove persisted assessment overrides; migration `0010` reversibly aligns database text-answer whitespace validation with the API; and `0011` reversibly adds the discovery-follow-up source relationship. A durable policy for every future evolution and reversal remains planned and must accompany the relevant schema change. | [requirements](../.planning/REQUIREMENTS.md); [operations handoff](operations-handoff.md); depends on planned schema changes |
| `DATA-03` | Implement and verify platform backup and restore | The operations handoff documents manual PostgreSQL backup and controlled restore commands, but retention, rotation, and a verified restore drill remain unproven. | [requirements](../.planning/REQUIREMENTS.md); [operations handoff](operations-handoff.md); operationalized by `OPS-01` |

## OPPORTUNITY

| ID | Outcome | Boundary | Source/dependency |
| --- | --- | --- | --- |
| `ROUNDS-02` | Support `STAKEHOLDER` and `CLARIFICATION` rounds | Does not extend the delivered `INITIAL_INTAKE` slice yet | [guided-intake plan](superpowers/plans/2026-08-06-guided-intake-persistence.md) |
| `PLAYBOOK-02` | Support additional versioned playbooks | Does not mutate `general` v1 | [product domain](product-domain.md) |
| `MIG-01` | Import supported project exports idempotently | Import format and migration policy remain undecided | [requirements](../.planning/REQUIREMENTS.md) |
| `PWA-01` | Support installable offline and update behavior | Does not imply offline queueing | [requirements](../.planning/REQUIREMENTS.md) |
| `AI-01` | Offer consented, replaceable AI enrichment | The core workflow remains deterministic without AI | [requirements](../.planning/REQUIREMENTS.md) |

## IMPROVEMENT

| ID | Outcome | Boundary | Source/dependency |
| --- | --- | --- | --- |
| `SEC-01` | Protect multi-user data access | Authentication, authorization, and rate limiting are required before exposure beyond an internal/VPN boundary | [requirements](../.planning/REQUIREMENTS.md), [operations handoff](operations-handoff.md) |
| `MAIL-01` | Make email delivery operationally robust | Outbox/idempotency and STARTTLS/provider compatibility remain separate hardening work | [operations handoff](operations-handoff.md) |
| `OPS-01` | Harden recovery operations | Retention, rotation, and a restore drill operationalize `DATA-03`; they do not replace the backup implementation | [operations handoff](operations-handoff.md), `DATA-03` |
| `CONC-01` | Define multi-client conflict handling | Current single-user persistence does not imply collaboration safety | [guided-intake plan](superpowers/plans/2026-08-06-guided-intake-persistence.md) |
| `DOC-02` | Keep product and operational documentation current | Link health and delivery-state reconciliation are part of every documentation change | [roadmap/documentation design](superpowers/specs/2026-08-08-roadmap-documentation-sync-design.md) |

## Dependencies and gates

```text
INTAKE-01 + INTAKE-02/03/05 → INTAKE-04 → SCORE-01 → OUTPUT-01 → OUTPUT-02/03
```

`SEC-01`, `MAIL-01`, and `OPS-01` are cross-cutting exposure and reliability
gates. They do not postpone their underlying security or operational needs.

## Documentation lifecycle

`docs/roadmap.md` is the current delivery-status source. The
[product domain](product-domain.md) defines domain intent rather than delivered
behavior. Historical plans preserve their pre-execution task lists and carry a
delivery-status notice when their work is complete. The
[Hungarian end-user guide](user-guide.md) is the canonical daily-work manual for
the delivered user workflows; roadmap-only behavior remains explicitly outside
its available-function boundary.
