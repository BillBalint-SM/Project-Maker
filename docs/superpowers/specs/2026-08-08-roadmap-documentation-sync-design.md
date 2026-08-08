# Roadmap and Documentation Synchronization Design

## Decision

Create one Git-tracked, feature-oriented roadmap without estimates or delivery
dates. It must distinguish delivered capability, accepted planned work,
uncommitted opportunities, and improvement work. Publish the authored planning
and design materials that explain the web application, while excluding tool
runtime state and credentials.

## Problem

The implementation baseline has advanced beyond the current planning state:

- the guided `INITIAL_INTAKE` vertical slice is implemented and verified;
- strict deletion of an eligible draft is implemented and merged into `main`;
- `.planning/REQUIREMENTS.md` still leaves `INTAKE-01` unchecked;
- `.planning/STATE.md` predates strict deletion;
- `docs/operations-handoff.md` lists four migrations although the current
  runtime has a fifth initial-intake integrity migration; and
- authored implementation plans and the planning-show handoff are local,
  untracked files, so GitHub lacks the reasoning behind delivered behavior.

Publishing raw plans unchanged would preserve incorrect unchecked task lists.
Conversely, publishing `.superpowers/` would expose ephemeral tool state rather
than product documentation. The documentation needs explicit ownership and
status rules.

## Scope

### In scope

- Add `docs/roadmap.md` as the canonical feature catalogue.
- Add `docs/README.md` as the documentation entry point.
- Reconcile `.planning/REQUIREMENTS.md` and `.planning/STATE.md` with the
  verified `main` baseline.
- Update the operational handoff where the migration inventory is stale.
- Publish the existing authored guided-intake handoff and the guided-intake and
  strict-deletion plans/specification.
- Add concise delivery-status notices to historical implementation plans when
  their pre-execution checklists remain intentionally preserved.
- Add documentation navigation from the repository README.

### Out of scope

- Source-code, dependency, API-contract, database-schema, or UI changes.
- Reviving the retired legacy desktop roadmap or its documentation tree.
- Rewriting historical plans into new implementation narratives.
- Producing a full end-user guide in this slice. The roadmap records it as a
  future documentation feature after the core user flows stabilize.
- Publishing `.superpowers/**`, local `.env` files, backups, test databases,
  tokens, or other tool/runtime material.
- Creating GitHub issues, Projects items, releases, estimates, forecasts, or
  calendar commitments.

## Documentation Model

| Location | Purpose | Status rule |
| --- | --- | --- |
| `docs/roadmap.md` | Canonical feature catalogue and sequence | Current source for delivery status |
| `docs/README.md` | Navigation for product, operational, planning, and future user documentation | Links only to tracked authored documents |
| `.planning/PROJECT.md` | Product purpose and constraints | Domain intent, not delivery proof |
| `.planning/REQUIREMENTS.md` | Requirement checklist | Mark complete only with implementation evidence |
| `.planning/STATE.md` | Current verified baseline | Must not name a stale branch or omit merged work |
| `docs/superpowers/` | Approved design and implementation history | Historical plans retain their original checklists plus a delivery-status notice |
| `.superpowers/` | Tool runtime/cache/ledger material | Always ignored and unpublished |

Each roadmap item uses exactly one status:

- `DELIVERED` — merged behavior with linked code, commit, test, or handoff
  evidence.
- `PLANNED` — accepted product direction with a source requirement or design,
  but no claim of delivery.
- `OPPORTUNITY` — plausible future capability not yet committed for delivery.
- `IMPROVEMENT` — security, reliability, usability, documentation, or
  operational hardening work.

Roadmap items have an ID, user or operator outcome, scope boundary, status,
evidence or source, and dependency. They intentionally do not have estimates,
forecasts, release dates, or invented completion percentages.

## Feature Catalogue Structure

The initial catalogue will separate these groups:

1. **Delivered platform and workflow** — web/API foundation, project lifecycle
   including guarded deletion, question-bank/schema flow, guided initial intake
   with persistence and Hungarian coaching, versioned Markdown revisions, audit
   history, and configured customer review/follow-up delivery behavior.
2. **Accepted planned product work** — operational follow-up management,
   readiness/gap/Decision Score behavior, canonical generated specification,
   derived acceptance criteria/user stories, exports, and an end-user guide.
3. **Exploration opportunities** — additional interview-round types, additional
   playbook versions, collaborative/multi-user workflows, import, PWA/offline
   behavior, and optional consented AI enrichment.
4. **Improvement and exposure gates** — authentication/authorization/rate
   limiting, SMTP outbox/idempotency and STARTTLS compatibility, backup
   retention and restore drill, documentation/link health, and explicit
   multi-client conflict handling.

The delivery sequence is dependency-based rather than time-based:

`project lifecycle + guided intake` → `operational follow-ups` →
`readiness and decision support` → `canonical specification` → `derived
outputs`; security and operational hardening remain mandatory gates before
exposure beyond the internal/VPN boundary.

## Acceptance Criteria

1. A reader can find one current roadmap and tell whether every listed feature
   is delivered, planned, an opportunity, or an improvement item.
2. Every `DELIVERED` item points to verifiable repository evidence; intended
   domain behavior is not represented as delivered merely because it exists in
   `docs/product-domain.md`.
3. The requirements and state records describe the strict-deletion and guided
   intake baseline consistently.
4. The operations handoff states the current migration inventory accurately.
5. All authored plan/specification/handoff Markdown files present in the
   working tree become trackable Git files; no `.superpowers/` runtime material
   is added.
6. The documentation index distinguishes product/domain intent, current
   delivery roadmap, operations, historical plans, and the future end-user
   guide.
7. No documentation contains actual credentials, license tokens, private
   backup contents, or local runtime artifacts.

## Risks and Controls

| Risk | Control |
| --- | --- |
| Historical checklist text looks unfinished | Add a factual delivery-status notice; preserve original task wording |
| Domain intent is mistaken for shipped functionality | Use the explicit status taxonomy and evidence links |
| Tool state is published as documentation | Stage only the named `.planning/` and `docs/` authored paths; retain `.superpowers/` ignore rule |
| Operations guidance becomes inaccurate | Reconcile migration count and current runtime behavior against source before editing |
| Documentation creates false schedule commitments | Prohibit dates, estimates, and percentage forecasts in the roadmap |
| Sensitive data is copied into Git | Scan authored Markdown before staging and review the exact staged file list |

## Verification

- Re-run repository work-state preflight before staging or publication.
- Inspect every changed Markdown file and validate its local links.
- Run a targeted secret-pattern scan over `.planning/` and `docs/`.
- Confirm `.superpowers/` remains ignored and absent from the staged list.
- Run `git diff --check`, inspect the staged diff, and verify the final status
  contains only the intended documentation changes.
- Present the written specification and subsequent documentation diff for user
  review before asking for a separate commit and GitHub publication decision.
