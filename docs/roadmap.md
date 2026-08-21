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
| `OUTPUT-01.1` | Deliver a Specification-derived Markdown artifact through Git | The same internal artifact is downloadable, available to actor-bound MCP reads, and used unchanged by the confirmed Git handoff; Customer email cannot consume it. | [Delivery API E2E](../apps/api/test/delivery-package.e2e-spec.ts), [MCP E2E](../apps/api/test/mcp.e2e-spec.ts), [employee guide](user-guide.md) |
| `OUTPUT-02` | Author a shared delivery package from the canonical Specification | One editable package is bound to an exact Specification version; its titles, stories, acceptance criteria, and optional excerpts remain editable, and each Git handoff retains an immutable snapshot. | [Delivery API E2E](../apps/api/test/delivery-package.e2e-spec.ts), [Delivery page](../apps/web/src/app/projects/delivery/delivery.page.ts) |
| `OUTPUT-03` | Produce Hungarian-safe print/PDF and CSV exports | Saved active or archived packages export as Markdown, formula-safe UTF-8 CSV, and Hungarian print/PDF-ready HTML with draft or handed-off provenance. | [Delivery API E2E](../apps/api/test/delivery-package.e2e-spec.ts), [Delivery page](../apps/web/src/app/projects/delivery/delivery.page.html) |
| `GIT-01` | Maintain shared Git setups and confirm one-way handoffs | Every Internal user can maintain and use shared SSH/HTTPS setups with retained credentials. Push needs an exact preview and confirmation, retains the package/target snapshot and commit SHA, and reconciles ambiguous results by expected SHA. | [Delivery API E2E](../apps/api/test/delivery-package.e2e-spec.ts), [local bare-Git integration](../apps/api/test/git-client.integration.spec.ts) |
| `MCP-01` | Connect each user's Claude Code to Project Maker workflows | One self-managed token identifies the Internal user at the VPN-only Streamable HTTP endpoint. Thirteen bounded tools reuse Project, Specification, Delivery package, Question Bank, Markdown template, and Git preview-confirm services; Git confirmation always requests fresh human approval. There is no provider API, shared Claude account, role/scope system, generic data access, or Customer-mail tool. | [ADR-0006](adr/0006-connect-claude-code-through-project-maker-mcp.md), [MCP E2E](../apps/api/test/mcp.e2e-spec.ts), [operations handoff](operations-handoff.md) |
| `COMM-01.1` | Separate Customer SMTP from internal agent handoffs | Versioned Interview customer handoff plus authored, previewed and optionally referenced Customer follow-up ping delivery through the Operator organization's dedicated TLS SMTP/IMAP gateway. The configured correspondence identity is the fixed sender; every logical delivery owns immutable outbound, correspondence and central Reply-To identities. Manual and PostgreSQL-coordinated scheduled attempts survive reload, preserve identity across explicit retry, retain `FAILED`/`UNKNOWN` recovery semantics, and never retry automatically. Customer follow-up production code and contracts expose no Markdown revision, `.md`, or Claude delivery concept. | [issue](https://github.com/BillBalint-SM/Project-Maker/issues/40), [operations handoff](operations-handoff.md), [API E2E](../apps/api/test/customer-smtp-boundary.e2e-spec.ts), [browser E2E](../apps/web/e2e/customer-smtp-boundary.spec.ts) |
| `DOC-01` | Teach employees every stable delivered workflow | Hungarian business-functional guide for all current routes, actions, states, side effects, recovery branches, and limitations, supported by eleven sanitized screenshots and three workflow diagrams | [user guide](user-guide.md), [guided-intake E2E](../apps/web/e2e/guided-intake.spec.ts), [discovery E2E](../apps/web/e2e/discovery-follow-ups.spec.ts), [readiness E2E](../apps/web/e2e/readiness-review.spec.ts), [deletion E2E](../apps/web/e2e/project-delete.spec.ts) |
| `SCORE-01.1` | Show completion, readiness, factors, and ordered remediation gaps | Delivered for the canonical current `general` v1 initial-intake schema: persisted effective checklist assessments, completion gating, readiness availability states, a dedicated Readiness page, and redacted remediation navigation. | [readiness E2E](../apps/web/e2e/readiness-review.spec.ts), [user guide](user-guide.md), [operations handoff](operations-handoff.md), `af6d81d` |
| `SCORE-01.2` | Show Decision Score and recommendation | A server-derived Decision Review atomically retains six nullable 1–5 inputs and, only with canonical current readiness, returns the rounded weighted Score, label, recommendation, safe readiness/gap explanation, and policy weights/inversions. It is read-only while archived, has no client scoring copy, and excludes formal Go/Conditional Go/No-Go recording and stored derived snapshots. | [Decision Review API E2E](../apps/api/test/projects.e2e-spec.ts), [browser E2E](../apps/web/e2e/decision-review.spec.ts), [product domain](product-domain.md), [ADR-0002](adr/0002-pre-delivery-decision-score-policy-correction.md) |

For `INTAKE-01`, `DELETE /projects/:projectId` returns `204` only for a bare
`DRAFT`. Any retained activity maps to a generic `409` and the project must be
archived instead. This remains the delivered behavior, but `PROJECT-UX-01`
accepts its simplification rather than treating an audit row as permanent
business history.

## PLANNED

| ID | Outcome | Current implementation state and remaining boundary | Source/dependency |
| --- | --- | --- | --- |
| `PROJECT-UX-01` | Remove lifecycle dead ends from normal Project work | Project basics and the Customer contact remain editable after schema publication; previous outbound records retain their own snapshots. Restore returns the Project to its previous phase instead of `DRAFT`. Explicit deletion cascades internal-only draft data, while retained Customer communication or Git handoff requires archive. Archived Projects remain read-only but their retained outputs stay downloadable. | Accepted process audit; [delivered limitations](user-guide.md) and [project service](../apps/api/src/projects/projects.service.ts) |
| `CONTACT-01` | Keep additional Project contacts lightweight | Add normal Project-scoped contact CRUD with actor audit and no role taxonomy, permission effect, organization directory, or forced optimistic-conflict ceremony. | [Batch 2](https://github.com/BillBalint-SM/Project-Maker/issues/118) |
| `ROUNDS-02` | Support `STAKEHOLDER` and `CLARIFICATION` rounds | Permit one open round per type so the two workflows can proceed independently. A round may freeze Question Bank selections or employee-authored ad-hoc clarification questions; it does not introduce stakeholder roles or meeting management. | [Batch 2](https://github.com/BillBalint-SM/Project-Maker/issues/118), [requirements](../.planning/REQUIREMENTS.md) |
| `INSIGHT-01` | Capture findings and their sources in one flow | The Insight form attaches or snapshots answer, message, metric, link, or governed-attachment sources inline. Evidence remains a reusable internal record, not a prerequisite screen or a generic knowledge graph. | [Batch 2](https://github.com/BillBalint-SM/Project-Maker/issues/118) |
| `ATTACH-01` | Retain bounded discovery attachments safely | Keep authenticated access, size/type limits, safe names, inert PostgreSQL storage, safe download, and source lifecycle checks. Reuse an Operator-provided antivirus service when configured, but do not fail closed on its absence or block unrelated discovery work on ClamAV, format-specific parsers, performance drills, or a full restore gate. | [storage decision](adr/0005-store-bounded-attachments-in-postgresql.md), [Batch 2](https://github.com/BillBalint-SM/Project-Maker/issues/118) |
| `PLAYBOOK-02` | Support additional versioned playbooks | Add system-integration and data-migration versions without mutating `general` v1. A Project may change its selection until its first interview round starts; the selection then freezes for provenance. | [Batch 2](https://github.com/BillBalint-SM/Project-Maker/issues/118), [product domain](product-domain.md) |
| `DECISION-01` | Record concise formal human decisions | Retain outcome, date, decision maker, rationale, conditional fields, actor, and optional references to the applicable Decision Review, Insights, and Specification. Do not duplicate a full approval snapshot or require the recommendation to agree. | [Batch 3](https://github.com/BillBalint-SM/Project-Maker/issues/119) |
| `STATUS-01` | Publish practical Project status updates | Record health, summary, changes, risks, and next step. The latest update is editable until another is published; older updates form readable history without correction-only entries. | [Batch 3](https://github.com/BillBalint-SM/Project-Maker/issues/119) |
| `PORTFOLIO-01` | Filter and sort the Project portfolio | Provide the accepted fixed filters, sorts, archive scope, and browser-local saved views with ordinary bounded page/offset pagination. Add opaque cursor and query fingerprints only after measured scale requires them. | [Batch 3](https://github.com/BillBalint-SM/Project-Maker/issues/119) |
| `ROADMAP-01` | Group Projects under Business goals and Initiatives | Keep the lightweight hierarchy. Confirmed Goal deletion removes its Initiatives and unassigns their Projects; confirmed Initiative deletion unassigns its Projects instead of forcing manual emptying. | [Batch 3](https://github.com/BillBalint-SM/Project-Maker/issues/119) |
| `COLLAB-01` | Collect narrow Customer responses | Support several independent expiring/revocable requests per active Project. Send the exact frozen preview after one confirmation, preserve form answers in browser-local draft storage, and retain one immutable submitted response. | [Batch 4](https://github.com/BillBalint-SM/Project-Maker/issues/120) |
| `NOTIFY-01` | Surface only immediate shared attention items | Start with due/overdue Project work, new Customer response or reply, and failed Customer delivery. Use one bounded current-state list without a signed cursor, rule engine, cadence reminder, or personal notification-preference system. | [Batch 4](https://github.com/BillBalint-SM/Project-Maker/issues/120) |
| `DATA-01` | Preserve complete discovery and derived-state provenance | Current entities preserve the delivered project, intake, follow-up, and Markdown-revision slices. Storage for every future derived-state and provenance field is not yet proven. | [requirements](../.planning/REQUIREMENTS.md); depends on planned feature data |
| `DATA-02` | Evolve the schema through explicit forward migrations | Additive migrations and preservation of retained business data are required. A destructive down-migration and a guarded reversal test are not mandatory for every feature; use backup/forward correction when safe reversal is not realistic. | [requirements](../.planning/REQUIREMENTS.md), [operations handoff](operations-handoff.md) |
| `DATA-03` | Implement and verify platform backup and restore | The operations handoff documents manual PostgreSQL backup and controlled restore commands, but retention, rotation, and a verified restore drill remain unproven. | [requirements](../.planning/REQUIREMENTS.md); [operations handoff](operations-handoff.md); operationalized by `OPS-01` |

## OPPORTUNITY

| ID | Outcome | Boundary | Source/dependency |
| --- | --- | --- | --- |
| `MIG-01` | Import supported project exports idempotently | Import format and migration policy remain undecided | [requirements](../.planning/REQUIREMENTS.md) |
| `PWA-01` | Support installable offline and update behavior | Does not imply offline queueing | [requirements](../.planning/REQUIREMENTS.md) |

## IMPROVEMENT

| ID | Outcome | Boundary | Source/dependency |
| --- | --- | --- | --- |
| `SEC-01` | Protect named Internal user access | The VPN remains the reachability boundary. Add self-service local email/password identity, actor-bound audit, session/Origin protection, and rate limiting for authentication, recovery, and public Customer endpoints. Every authenticated Internal user has the same capabilities, with no SSO, RBAC, membership, tenant, or internal per-user security workflow. | [Batch 1](https://github.com/BillBalint-SM/Project-Maker/issues/117), [requirements](../.planning/REQUIREMENTS.md), [operations handoff](operations-handoff.md) |
| `MAIL-01` | Make email delivery operationally robust | Durable outbox/idempotency remains separate hardening work; the current gateway activation uses controlled TLS SMTP/IMAP smoke evidence | [operations handoff](operations-handoff.md), [mail gateway](mail-gateway.md) |
| `OPS-01` | Harden recovery operations | Retention, rotation, and a representative restore drill operationalize `DATA-03` as an Operator task running in parallel with product delivery, not as a gate for unrelated slices. | [operations handoff](operations-handoff.md), `DATA-03` |
| `CONC-01` | Protect high-loss concurrent edits where needed | Apply optimistic version conflicts only to observed/high-value shared editing where overwriting would lose meaningful work. Ordinary internal CRUD uses normal saves, timestamps, and actor audit. | [Batch 1](https://github.com/BillBalint-SM/Project-Maker/issues/117), [requirements](../.planning/REQUIREMENTS.md) |
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
