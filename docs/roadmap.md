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

## DELIVERED

| ID | Outcome | Delivered scope | Evidence |
| --- | --- | --- | --- |
| `FOUND-01` | Run Project Maker as an internal web platform | pnpm monorepo; Angular/NestJS/contracts; internal Compose topology; health, CORS, and PostgreSQL migrations | [README](../README.md), [operations handoff](operations-handoff.md), `29895ef`, `a5eacc6` |
| `DOMAIN-01` | Use a stable discovery vocabulary and versioned playbook | immutable `general` v1 contract, editable base-question bank, and project question-schema snapshots | [product domain](product-domain.md), [general v1 contract](../packages/contracts/playbooks/general.v1.json), [project-schema route](../apps/api/src/question-bank/project-question-schema.controller.ts) |
| `INTAKE-01` | Manage the lifecycle of a discovery project | create, list, workspace edit, archive, restore, and guarded deletion of an eligible draft | `5a26f53`, [project controller](../apps/api/src/projects/projects.controller.ts), [lifecycle E2E](../apps/api/test/projects.e2e-spec.ts) |
| `INTAKE-02` | Run one reliable initial intake | immutable `INITIAL_INTAKE` rounds, answer recording, active-round recovery, and server-side completion validation | [guided-intake plan](superpowers/plans/2026-08-06-guided-intake-persistence.md), [round E2E](../apps/api/test/question-rounds.e2e-spec.ts), `8ae4e4e` |
| `INTAKE-03` | Preserve discovery answers through normal interruptions | 750 ms text autosave, immediate discrete saves, retry, and reload/API-restart recovery | [guided-intake plan](superpowers/plans/2026-08-06-guided-intake-persistence.md), [interview page](../apps/web/src/app/interviews/interview.page.ts) |
| `INTAKE-05` | Coach Hungarian users deterministically | Hungarian UI states and contract-derived answer guidance without live AI | [guided-intake plan](superpowers/plans/2026-08-06-guided-intake-persistence.md), [general v1 contract](../packages/contracts/playbooks/general.v1.json) |
| `AUDIT-01` | Explain important project changes | bounded cockpit audit history and milestone trace | `d1043aa`, [operations handoff](operations-handoff.md) |
| `OUTPUT-00` | Preserve revisioned project snapshots | manual and milestone-triggered Markdown revisions with download | `d1043aa`, [operations handoff](operations-handoff.md) |
| `COMM-01` | Send controlled customer communication | manual customer review and configurable follow-up ping delivery; this is not operational follow-up management | [operations handoff](operations-handoff.md), [follow-up routes](../apps/api/src/follow-ups/follow-up.controller.ts) |

For `INTAKE-01`, `DELETE /projects/:projectId` returns `204` only for a bare
`DRAFT`. Any retained activity maps to a generic `409` and the project must be
archived instead. This is not a project-list bulk-delete capability.

## PLANNED

| ID | Outcome | Boundary | Source/dependency |
| --- | --- | --- | --- |
| `INTAKE-04` | Turn unresolved discovery work into accountable follow-ups with owner, due date, status, answer/decision, and next step | Does not replace current email scheduling or project lifecycle | [requirements](../.planning/REQUIREMENTS.md); depends on project and intake data |
| `SCORE-01` | Show completion, readiness, gaps, Decision Score, and recommended action | Behavioral domain implementation, not static documentation | [requirements](../.planning/REQUIREMENTS.md); depends on answers and `INTAKE-04` |
| `OUTPUT-01` | Generate the canonical structured Markdown specification | Does not replace manual revision history or stored snapshots | [requirements](../.planning/REQUIREMENTS.md); depends on readiness and decision behavior |
| `OUTPUT-02` | Derive acceptance criteria and user stories from the canonical specification | Derived content starts only after `OUTPUT-01` | [requirements](../.planning/REQUIREMENTS.md); depends on `OUTPUT-01` |
| `OUTPUT-03` | Produce Hungarian-safe PDF and spreadsheet exports | No separate authoring source runs beside the canonical specification | [requirements](../.planning/REQUIREMENTS.md); depends on `OUTPUT-01` |
| `DATA-01` | Preserve complete discovery and derived-state provenance | Current tables support the delivered slice but do not prove storage for every planned field | [requirements](../.planning/REQUIREMENTS.md); depends on planned feature data |
| `DATA-02` | Evolve the schema through explicit, versioned migrations with reversible intent | The existing five migrations do not satisfy every future evolution and reversal need | [requirements](../.planning/REQUIREMENTS.md); depends on planned schema changes |
| `DATA-03` | Implement and verify platform backup and restore | A named Compose volume is not a proven backup or restore capability | [requirements](../.planning/REQUIREMENTS.md); operationalized by `OPS-01` |
| `DOC-01` | Publish a Hungarian end-user guide for stable delivered workflows | This roadmap and index are not the end-user guide | [requirements](../.planning/REQUIREMENTS.md); depends on stable user flows and documentation review |

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
delivery-status notice when their work is complete. `DOC-01` will become the
Hungarian end-user guide once the relevant user flows are stable.
