# Roadmap and Documentation Synchronization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a Git-tracked, feature-oriented roadmap and synchronized documentation set that accurately separates delivered Project Maker behavior from planned work, opportunities, and improvements.

**Architecture:** `docs/roadmap.md` becomes the canonical delivery catalogue, while `docs/README.md` becomes the documentation entry point. `.planning/REQUIREMENTS.md` and `.planning/STATE.md` retain their specialized governance roles but link to the roadmap. Existing plans remain historical evidence with factual delivery-status notices instead of rewritten checklists. Runtime state remains ignored.

**Tech Stack:** Markdown, Git, PowerShell, existing Angular/NestJS/TypeORM delivery evidence, and the repository's existing documentation layout.

## Global Constraints

- Work only on branch `dev-roadmap-documentation-sync`, based on `b4d4c9b`.
- Do not change application source, dependencies, API contracts, database migrations, Compose configuration, or UI behavior.
- Do not add estimates, forecasts, release dates, or completion percentages to the roadmap.
- Use only `DELIVERED`, `PLANNED`, `OPPORTUNITY`, or `IMPROVEMENT` as roadmap feature statuses.
- Mark behavior `DELIVERED` only when source, commit, test, or handoff evidence exists.
- Preserve historical plan task wording. Add a delivery-status notice instead of mass-ticking pre-execution checkboxes.
- Track authored `.planning/` and `docs/` Markdown material; never add `.superpowers/`, `.env`, backups, tokens, license values, or runtime state.
- Do not commit, push, create a GitHub issue, or modify GitHub Projects without a separate explicit user approval after the staged diff review.

---

## File Structure

| File | Responsibility |
| --- | --- |
| `docs/roadmap.md` | Canonical feature catalogue, status taxonomy, dependencies, and documentation lifecycle |
| `docs/README.md` | Documentation navigation and reader-oriented scope notes |
| `README.md` | Repository-level entry link to the documentation index and roadmap |
| `.planning/REQUIREMENTS.md` | Verified requirement checklist aligned with delivered lifecycle behavior |
| `.planning/STATE.md` | Current verified baseline, evidence routes, and next delivery boundary |
| `docs/operations-handoff.md` | Accurate migration inventory and operationally relevant delivered behavior |
| `docs/superpowers/plans/2026-08-06-guided-intake-persistence.md` | Historical guided-intake plan with a delivery-status notice |
| `docs/superpowers/plans/2026-08-07-strict-project-deletion.md` | Historical strict-deletion plan with a delivery-status notice |
| `docs/superpowers/specs/2026-08-07-strict-project-deletion-design.md` | Historical strict-deletion design whose status reflects delivery |
| `.planning/planning-show/product-delivery/guided-intake/standalone/2026-08-06-planning-show-handoff.md` | Published, unchanged planning handoff evidence |
| `docs/superpowers/specs/2026-08-08-roadmap-documentation-sync-design.md` | Approved design for this work |
| `docs/superpowers/plans/2026-08-08-roadmap-documentation-sync.md` | This execution plan |

### Task 1: Create the canonical feature roadmap

**Files:**
- Create: `docs/roadmap.md`
- Read: `docs/product-domain.md:5-74`
- Read: `.planning/REQUIREMENTS.md:8-41`
- Read: `docs/operations-handoff.md:187-288`
- Read: `apps/api/src/projects/projects.controller.ts:19-67`
- Read: `apps/web/src/app/app.routes.ts:3-47`

**Interfaces:**
- Consumes: requirement IDs (`FOUND-*`, `DOMAIN-01`, `INTAKE-*`, `SCORE-01`, `OUTPUT-*`, `DATA-*`, `MIG-01`, `PWA-01`, `SEC-01`, `AI-01`) and verified commit evidence.
- Produces: the single current feature-status source consumed by the documentation index and planning state.

- [x] **Step 1: Create the roadmap header and status contract.**

Write these sections in order:

```markdown
# Project Maker roadmap

## Purpose and update rule

This document is the current feature catalogue. It records verified delivery
status rather than a date-based release schedule. Update it in the same reviewed
change as a feature's delivery-state documentation.

## Status vocabulary

- `DELIVERED`: merged, evidenced behavior.
- `PLANNED`: accepted work with a requirement or design source.
- `OPPORTUNITY`: viable but uncommitted product possibility.
- `IMPROVEMENT`: security, reliability, usability, operations, or documentation hardening.
```

- [x] **Step 2: Add the complete initial `DELIVERED` catalogue.**

Add a `## DELIVERED` section, then one Markdown table with `ID`, `Outcome`,
`Delivered scope`, and `Evidence` columns. Add exactly these feature rows:

| ID | Outcome | Delivered scope | Evidence |
| --- | --- | --- | --- |
| `FOUND-01` | Run Project Maker as an internal web platform | Angular/NestJS/contracts monorepo, Compose topology, health, CORS boundary, PostgreSQL migrations | `README.md`, `docs/operations-handoff.md`, `29895ef`, `a5eacc6` |
| `DOMAIN-01` | Use a stable discovery vocabulary and versioned playbook | immutable `general` v1 contract, editable base-question bank, project schema snapshots | `docs/product-domain.md`, `packages/contracts`, question-bank routes |
| `INTAKE-01` | Manage the lifecycle of a discovery project | create, list, edit, archive, restore, and guarded deletion of an eligible draft | `5a26f53`, project controller, project-delete E2E |
| `INTAKE-02` | Run one reliable initial intake | immutable `INITIAL_INTAKE` rounds, answer recording, active-round recovery, completion validation | guided-intake commit series ending `8ae4e4e` |
| `INTAKE-03` | Preserve discovery answers through normal interruptions | 750 ms text autosave, immediate discrete saves, retry, reload/API restart recovery | guided-intake plan and browser E2E |
| `INTAKE-05` | Coach Hungarian users deterministically | Hungarian UI states and contract-derived guidance without live AI | guided-intake plan and web tests |
| `AUDIT-01` | Explain important project changes | bounded cockpit audit history and milestone trace | `d1043aa`, operations handoff |
| `OUTPUT-00` | Preserve revisioned project snapshots | manual and milestone-triggered Markdown revisions with download | Markdown routes and operations handoff |
| `COMM-01` | Send controlled customer communication | manual customer review and configurable follow-up ping delivery; this is not operational follow-up management | follow-up routes and operations handoff |

For `INTAKE-01`, state that deletion returns `204` only for an empty `DRAFT`
and maps retained activity to a generic `409`; it is not a project-list bulk
delete feature.

- [x] **Step 3: Add the exact `PLANNED`, `OPPORTUNITY`, and `IMPROVEMENT` catalogues.**

Create these three sections in order: `## PLANNED`, `## OPPORTUNITY`, and
`## IMPROVEMENT`. Under each section add one Markdown table with `ID`,
`Outcome`, `Boundary`, and `Source/dependency` columns. The `Section` column in
the planning table below is a placement instruction, not a column to copy into
`docs/roadmap.md`.

| Section | ID | Outcome | Boundary | Source/dependency |
| --- | --- | --- | --- | --- |
| `PLANNED` | `INTAKE-04` | Turn unresolved discovery work into accountable follow-ups with owner, due date, status, answer/decision, and next step | Replaces neither current email scheduling nor project lifecycle | `.planning/REQUIREMENTS.md`; depends on current project and intake data |
| `PLANNED` | `SCORE-01` | Show completion, readiness, gaps, Decision Score, and recommended action | Behavioral domain implementation, not static documentation | Depends on answers and `INTAKE-04` |
| `PLANNED` | `OUTPUT-01` | Generate the canonical structured Markdown specification | Supersedes neither manual revision history nor stored snapshots | Depends on readiness/decision behavior |
| `PLANNED` | `OUTPUT-02` | Derive acceptance criteria and user stories from the canonical specification | Derived content only after `OUTPUT-01` | Depends on `OUTPUT-01` |
| `PLANNED` | `OUTPUT-03` | Produce Hungarian-safe PDF and spreadsheet exports | No parallel, independently authored export source | Depends on `OUTPUT-01` |
| `PLANNED` | `DATA-01` | Preserve complete discovery and derived-state provenance | Current tables support the delivered slice but do not prove storage for every planned follow-up or derived field | `.planning/REQUIREMENTS.md`; depends on planned feature data |
| `PLANNED` | `DATA-02` | Evolve the schema through explicit, versioned migrations with reversible intent | The existing five migrations do not satisfy every future evolution and reversal need | `.planning/REQUIREMENTS.md`; depends on planned schema changes |
| `PLANNED` | `DATA-03` | Implement and verify platform backup and restore | A named Compose volume is not a proven backup or restore capability | `.planning/REQUIREMENTS.md`; operationalized by `OPS-01` |
| `PLANNED` | `DOC-01` | Publish a Hungarian end-user guide for stable delivered workflows | This roadmap/index slice is not the full guide | Depends on stable user flows and documentation review |
| `OPPORTUNITY` | `ROUNDS-02` | Support `STAKEHOLDER` and `CLARIFICATION` rounds | No extension to the delivered `INITIAL_INTAKE` slice yet | Guided-intake explicit non-goal |
| `OPPORTUNITY` | `PLAYBOOK-02` | Support additional versioned playbooks | No mutation of `general` v1 | Domain contract versioning model |
| `OPPORTUNITY` | `MIG-01` | Import supported project exports idempotently | Import format and migration policy remain undecided | Requirement source |
| `OPPORTUNITY` | `PWA-01` | Support installable offline/update behavior | No offline queueing is implied | Requirement source |
| `OPPORTUNITY` | `AI-01` | Offer consented, replaceable AI enrichment | Core workflow stays deterministic without AI | Requirement source |
| `IMPROVEMENT` | `SEC-01` | Protect multi-user data access | Authentication, authorization, and rate limiting before exposure beyond internal/VPN boundary | Operations handoff |
| `IMPROVEMENT` | `MAIL-01` | Make email delivery operationally robust | Outbox/idempotency and STARTTLS/provider compatibility | Operations handoff |
| `IMPROVEMENT` | `OPS-01` | Harden recovery operations | Retention, rotation, and a restore drill operationalize `DATA-03`; they do not replace the backup implementation | Operations handoff and `DATA-03` |
| `IMPROVEMENT` | `CONC-01` | Define multi-client conflict handling | Current single-user persistence must not imply collaboration safety | Guided-intake explicit non-goal |
| `IMPROVEMENT` | `DOC-02` | Keep product and operational documentation current | Link health and delivery-state reconciliation | This synchronization design |

- [x] **Step 4: Add sequencing and documentation-lifecycle sections.**

Use this dependency sequence exactly:

```text
INTAKE-01 + INTAKE-02/03/05 → INTAKE-04 → SCORE-01 → OUTPUT-01 → OUTPUT-02/03
```

State that `SEC-01`, `MAIL-01`, and `OPS-01` are cross-cutting exposure and
reliability gates, not a postponement of their security requirements. Add a
documentation-lifecycle paragraph that identifies `docs/roadmap.md` as current
delivery status, `docs/product-domain.md` as domain intent, historical plans as
pre-execution evidence, and the future `DOC-01` as the end-user guide.

- [x] **Step 5: Review the roadmap against its status contract.**

Run:

```powershell
$requiredStatusSections = @('## DELIVERED', '## PLANNED', '## OPPORTUNITY', '## IMPROVEMENT')
$missingStatusSections = $requiredStatusSections | Where-Object {
  -not (Select-String -LiteralPath 'docs\roadmap.md' -SimpleMatch $_ -Quiet)
}
if ($missingStatusSections) {
  $missingStatusSections
  exit 1
}
$forbiddenTerms = rg -n -i '\b(estimate|forecast|Q[1-4]|release date)\b' docs\roadmap.md
if ($LASTEXITCODE -eq 0) {
  $forbiddenTerms
  exit 1
}
if ($LASTEXITCODE -ne 1) {
  exit $LASTEXITCODE
}
```

Expected: all four status sections are present, every catalogue item inherits
one of those status headings, and no estimate, timebox, or release-date
language appears.

### Task 2: Make the documentation navigable from the repository entry point

**Files:**
- Create: `docs/README.md`
- Modify: `README.md:11-17`
- Read: `docs/roadmap.md`
- Read: `docs/product-domain.md:1-74`
- Read: `docs/operations-handoff.md:1-288`

**Interfaces:**
- Consumes: the canonical roadmap from Task 1 and all tracked authored-document paths.
- Produces: relative links for a repository reader, future user-guide authors, and maintainers.

- [x] **Step 1: Create `docs/README.md` as the documentation index.**

Write these sections and links:

```markdown
# Project Maker documentation

## Start here

- [Current roadmap](roadmap.md) — delivered capability, planned work, opportunities, and improvements.
- [Product domain](product-domain.md) — platform-neutral intent and vocabulary; not a delivery-status record.
- [Operations handoff](operations-handoff.md) — runtime, recovery, email, and verification guidance.

## Planning and delivery evidence

- [Current requirement checklist](../.planning/REQUIREMENTS.md) — checked only with delivery evidence.
- [Current planning baseline](../.planning/STATE.md) — historical project context; verify Git decisions with a fresh `WORK_STATE` check.
- [Guided-intake prioritization handoff](../.planning/planning-show/product-delivery/guided-intake/standalone/2026-08-06-planning-show-handoff.md)
- [Guided-intake implementation plan](superpowers/plans/2026-08-06-guided-intake-persistence.md)
- [Strict-deletion design](superpowers/specs/2026-08-07-strict-project-deletion-design.md)
- [Strict-deletion implementation plan](superpowers/plans/2026-08-07-strict-project-deletion.md)
- [Roadmap/documentation synchronization design](superpowers/specs/2026-08-08-roadmap-documentation-sync-design.md)
- [Roadmap/documentation synchronization plan](superpowers/plans/2026-08-08-roadmap-documentation-sync.md)

## End-user guidance

The Hungarian end-user guide is planned as `DOC-01`. Until the stable core workflows are documented end-to-end, use the roadmap to distinguish delivered behavior from intended domain behavior.
```

- [x] **Step 2: Add a concise documentation section to the root README.**

Immediately after the existing product-domain and operations-handoff links,
insert:

```markdown
## Documentation

Start with the [documentation index](docs/README.md). The
[roadmap](docs/roadmap.md) is the current delivery-status source; the product
domain describes intended behavior and must not be read as a release record.
```

- [x] **Step 3: Check every new navigation target before continuing.**

Run:

```powershell
Get-Item 'docs\README.md', 'docs\roadmap.md', '.planning\planning-show\product-delivery\guided-intake\standalone\2026-08-06-planning-show-handoff.md', 'docs\superpowers\plans\2026-08-06-guided-intake-persistence.md', 'docs\superpowers\plans\2026-08-07-strict-project-deletion.md', 'docs\superpowers\specs\2026-08-07-strict-project-deletion-design.md', 'docs\superpowers\specs\2026-08-08-roadmap-documentation-sync-design.md', 'docs\superpowers\plans\2026-08-08-roadmap-documentation-sync.md'
```

Expected: all listed paths resolve as files.

### Task 3: Synchronize the requirement, state, and operational records

**Files:**
- Modify: `.planning/REQUIREMENTS.md:1-41`
- Modify: `.planning/STATE.md:1-43`
- Modify: `docs/operations-handoff.md:78-157`
- Modify: `docs/operations-handoff.md:187-270`
- Read: `apps/api/src/migrations/0005-initial-intake-open-round.ts`
- Read: `apps/api/src/projects/projects.controller.ts:19-67`

**Interfaces:**
- Consumes: Task 1 status taxonomy, `b4d4c9b` merged baseline, fifth migration, and strict-deletion behavior.
- Produces: consistent checklist, state, and operational facts that link readers to `docs/roadmap.md`.

- [x] **Step 1: Correct `.planning/REQUIREMENTS.md`.**

Replace `INTAKE-01` with a checked item whose text says the project lifecycle
is verified for create, list, workspace edit, archive, restore, and guarded
explicit deletion. State that a bare `DRAFT` is physically deleted and retained
activity returns a generic conflict directing the user to archive. Replace the
ignored `.superpowers/sdd/.../task-6-report.md` evidence pointer in the opening
paragraph with tracked references to the guided-intake plan and
`docs/roadmap.md`. Add this checked documentation requirement after
`OUTPUT-03`:

```markdown
- [x] **DOC-00:** A Git-tracked roadmap and documentation index distinguish delivered behavior, planned work, opportunities, improvements, and historical delivery evidence.
```

Add this unchecked requirement near the data/platform section:

```markdown
- [ ] **DOC-01:** A Hungarian end-user guide explains the stable delivered workflows without presenting planned domain behavior as available functionality.
```

- [x] **Step 2: Replace stale baseline language in `.planning/STATE.md`.**

Set the baseline paragraph to the Angular 22.1 / PrimeNG 22.0.0 web platform at
merged `main` commit `b4d4c9b`, with guided initial intake and strict deletion.
Add bullets for guarded project deletion, the non-mutating first follow-up read,
and the fifth initial-intake integrity migration. In the delivery-state section,
name the verified contracts/API/web typechecks, API and web tests, browser E2E,
production build, repository verify, and Compose recovery gates. Include an
aggregate count only when a matching receipt is tracked at `b4d4c9b` or freshly
rerun during this slice; otherwise do not invent a count. Link readers to
`docs/roadmap.md` and tracked plan evidence. Preserve the existing warning that
this state file never replaces a fresh `WORK_STATE` check.

- [x] **Step 3: Correct the migration and functional handoff in `docs/operations-handoff.md`.**

Add migration `0005-initial-intake-open-round.ts` after `0004`, describing its
partial unique index for one open `INITIAL_INTAKE` round. Replace all statements
that expect four migrations with five migrations. In the project-flow section,
add explicit lifecycle wording: a project can be archived/restored, and the
cockpit exposes permanent deletion only for an eligible `DRAFT`; projects with
persisted activity are retained and must be archived. Do not describe the
existing follow-up email timer as the unimplemented `INTAKE-04` follow-up
management feature.

- [x] **Step 4: Cross-check the three records.**

Run:

```powershell
rg -n "INTAKE-01|b4d4c9b|0005|five migrations|four migrations|docs/roadmap.md|DOC-0" .planning\REQUIREMENTS.md .planning\STATE.md docs\operations-handoff.md
```

Expected: `INTAKE-01` is checked, `0005`/five migrations are present, no stale
"four migrations" claim remains, and the roadmap links are present.

### Task 4: Publish authored historical plans without falsifying their history

**Files:**
- Modify: `docs/superpowers/plans/2026-08-06-guided-intake-persistence.md:1-10`
- Modify: `docs/superpowers/plans/2026-08-07-strict-project-deletion.md:1-10`
- Modify: `docs/superpowers/specs/2026-08-07-strict-project-deletion-design.md:1-16`
- Add to Git tracking unchanged: `.planning/planning-show/product-delivery/guided-intake/standalone/2026-08-06-planning-show-handoff.md`
- Add to Git tracking: `docs/superpowers/specs/2026-08-08-roadmap-documentation-sync-design.md`
- Add to Git tracking: `docs/superpowers/plans/2026-08-08-roadmap-documentation-sync.md`

**Interfaces:**
- Consumes: delivery evidence from `8ae4e4e`, `5a26f53`, and `b4d4c9b`.
- Produces: GitHub-readable planning provenance that does not misstate historical checklists as current work.

- [x] **Step 1: Add a guided-intake historical-status notice.**

Insert directly below the title of
`docs/superpowers/plans/2026-08-06-guided-intake-persistence.md`:

```markdown
> **Delivery status:** Delivered on `main` through the guided-intake commit series ending at `8ae4e4e`. The unchecked task list below is preserved as the approved pre-execution plan; current delivery status is maintained in [`docs/roadmap.md`](../../roadmap.md).
```

- [x] **Step 2: Add strict-deletion historical-status notices.**

Insert directly below the strict-deletion plan title:

```markdown
> **Delivery status:** Delivered in `5a26f53` and merged into `main` by `b4d4c9b`. The unchecked task list below is preserved as the approved pre-execution plan; current delivery status is maintained in [`docs/roadmap.md`](../../roadmap.md).
```

Replace the strict-deletion design status line with:

```markdown
**Status:** delivered in `5a26f53`, merged into `main` by `b4d4c9b`; the pre-delivery wording below is retained as historical design evidence
```

- [x] **Step 3: Confirm publication scope before staging.**

Run:

```powershell
git status --short
git check-ignore -v .superpowers\brainstorm\.last-token
```

Expected: every new/modified authored file is under `.planning/` or `docs/`;
the second command confirms `.superpowers/` remains ignored. Do not stage any
file yet.

### Task 5: Validate the documentation change and prepare review evidence

**Files:**
- Review: every file listed in the File Structure table
- Do not modify: `.superpowers/**`, `.env`, backups, source code, dependency files, or GitHub metadata

**Interfaces:**
- Consumes: all documentation changes from Tasks 1-4.
- Produces: a review packet with scope, link, secret, whitespace, and Git-state evidence.

- [x] **Step 1: Run the Markdown relative-link check.**

Run this PowerShell block from the repository root:

```powershell
$markdownFiles = @(
  Get-Item 'README.md'
  Get-ChildItem -Path '.planning', 'docs' -Recurse -File -Filter '*.md'
)
$brokenLinks = foreach ($file in $markdownFiles) {
  $content = Get-Content -Raw -LiteralPath $file.FullName
  foreach ($match in [regex]::Matches($content, '\\[[^\\]]+\\]\\((?:<)?([^#)>]+)(?:#[^)]*)?(?:>)?\\)')) {
    $target = $match.Groups[1].Value.Trim()
    if ($target -match '^(https?://|mailto:|/)') { continue }
    $candidate = Join-Path $file.DirectoryName $target
    if (-not (Test-Path -LiteralPath $candidate)) {
      "$($file.FullName): $target"
    }
  }
}
if ($brokenLinks) {
  $brokenLinks
  exit 1
}
```

Expected: exit code `0` and no broken relative-link output.

- [x] **Step 2: Run the targeted documentation security scan.**

Run:

```powershell
rg -n -i "(api[_-]?key|secret|password|token|authorization:|bearer |gho_|ghp_|postgres(ql)?://[^\\s]*:[^\\s]*)" --glob '*.md' .planning docs
```

Expected: review any hits as literal environment-variable names, example-only
instructions, or explicit security guidance only. Stop if a real credential,
license token, or connection string with a real password appears.

- [x] **Step 3: Run scope and whitespace checks.**

Run:

```powershell
git diff --check
rg -n '[ \t]+$' README.md .planning docs --glob '*.md'
if ($LASTEXITCODE -eq 0) {
  exit 1
}
if ($LASTEXITCODE -ne 1) {
  exit $LASTEXITCODE
}
git status --short
git diff --name-only
```

Expected: no whitespace errors; changed paths limited to `.planning/`, `docs/`,
and `README.md`; no `.superpowers/` or application source path appears.

- [x] **Step 4: Build the exact future staged-file inventory without staging.**

Verify that the intended review set is exactly:

```text
README.md
.planning/REQUIREMENTS.md
.planning/STATE.md
.planning/planning-show/product-delivery/guided-intake/standalone/2026-08-06-planning-show-handoff.md
docs/README.md
docs/roadmap.md
docs/operations-handoff.md
docs/superpowers/plans/2026-08-06-guided-intake-persistence.md
docs/superpowers/plans/2026-08-07-strict-project-deletion.md
docs/superpowers/plans/2026-08-08-roadmap-documentation-sync.md
docs/superpowers/specs/2026-08-07-strict-project-deletion-design.md
docs/superpowers/specs/2026-08-08-roadmap-documentation-sync-design.md
```

If the inventory differs, investigate and resolve the scope mismatch before
asking the user to review. Do not use `git add -A`.

- [ ] **Step 5: Present the documentation diff for user approval.**

Report the completed status synchronization, feature catalogue, documentation
paths, validation evidence, and any security-scan matches. Request explicit
approval to stage the exact twelve-file inventory, then request separate commit
and GitHub publication approval after the staged-diff review.

## Plan Review Checklist

- [x] The plan covers all in-scope requirements from `docs/superpowers/specs/2026-08-08-roadmap-documentation-sync-design.md`.
- [x] Every roadmap status has a concrete initial catalogue entry and source boundary.
- [x] `DATA-01`, `DATA-02`, and `DATA-03` each have their own roadmap entry and do not overclaim the delivered persistence model.
- [x] No task introduces a date, estimate, forecast, or source-code change.
- [x] Every historical plan that would otherwise look unfinished receives a factual status notice.
- [x] The validation task excludes `.superpowers/` and checks authored-document links and secret-like material.

## Execution Handoff

After the user approves this plan, execute Tasks 1-5 in order on
`dev-roadmap-documentation-sync`. Pause after Task 5 for the required content
and staged-diff review; do not commit or publish without the user's separate
explicit approval.
