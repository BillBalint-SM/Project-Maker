# Hungarian End-User Guide Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish a complete Hungarian, business-functional Project Maker guide that teaches a new employee every delivered workflow with real application screenshots, focused diagrams, error recovery, and honest current limitations.

**Architecture:** Keep one canonical task-oriented guide at `docs/user-guide.md`, supported by six real screenshots in `docs/assets/user-guide/` and three inline Mermaid diagrams. Build the content only from the current UI, contracts, service rules, and tests; keep technical operation in the existing operations handoff and synchronize every delivery-status source when the guide is complete.

**Tech Stack:** GitHub-flavored Markdown, Mermaid, Angular 22/PrimeNG 22 application UI, Playwright screenshot capture, existing NestJS/PostgreSQL runtime, Git/GitHub CLI.

## Global Constraints

- Document the application implemented at `main` commit `82a5449` and never present planned behavior as delivered.
- Write explanations in Hungarian business language while preserving exact mixed-language UI labels in code formatting.
- Treat role names as organizational responsibilities because the application has no authentication or enforced authorization.
- Use only fictional Hungarian example data and `example.test` email addresses in screenshots.
- Add no dependency, application code, runtime configuration, security policy, or operations-procedure change.
- Every workflow must state purpose, precondition, exact steps, resulting state or side effect, success evidence, likely failure, safe recovery, and next logical action.
- Use screenshots for page recognition and Mermaid for sequence or state; no visual may be the only source of an instruction.
- Restore an archived project before creating new interview or Markdown content, and describe the currently reachable archived routes as a limitation.
- Keep the existing `docs/` tree as the only documentation root.
- Do not commit the temporary screenshot-capture specification or any disposable database credentials, logs, traces, or test output.

---

## File Map

| Path | Responsibility |
| --- | --- |
| `docs/user-guide.md` | Canonical Hungarian employee guide and all inline Mermaid diagrams |
| `docs/assets/user-guide/01-projects.png` | Portfolio and project-creation orientation |
| `docs/assets/user-guide/02-cockpit.png` | Cockpit summary, workspace, and communication controls |
| `docs/assets/user-guide/03-question-bank.png` | Shared question-bank orientation |
| `docs/assets/user-guide/04-guided-interview.png` | Project schema, active round, coaching, and save-state orientation |
| `docs/assets/user-guide/05-discovery-follow-ups.png` | Discovery follow-up creation, ordering, and resolution |
| `docs/assets/user-guide/06-markdown-revisions.png` | Revision history, change summary, preview, and download |
| `README.md` | Prominent link from repository entry point |
| `docs/README.md` | End-user-guide entry point and design/plan evidence links |
| `docs/roadmap.md` | Move `DOC-01` from `PLANNED` to `DELIVERED` with evidence |
| `.planning/REQUIREMENTS.md` | Check `DOC-01` only after all acceptance checks pass |
| `.planning/STATE.md` | Record the delivered guide and current verified baseline |
| `apps/web/e2e/user-guide-capture.spec.ts` | Temporary, uncommitted deterministic screenshot harness; delete before staging |

---

### Task 1: Build and validate the deterministic screenshot fixture

**Files:**
- Temporarily create: `apps/web/e2e/user-guide-capture.spec.ts`
- Create: `docs/assets/user-guide/01-projects.png`
- Create: `docs/assets/user-guide/02-cockpit.png`
- Create: `docs/assets/user-guide/03-question-bank.png`
- Create: `docs/assets/user-guide/04-guided-interview.png`
- Create: `docs/assets/user-guide/05-discovery-follow-ups.png`
- Create: `docs/assets/user-guide/06-markdown-revisions.png`
- Delete before staging: `apps/web/e2e/user-guide-capture.spec.ts`

**Interfaces:**
- Consumes: existing Playwright configuration, API routes, canonical seeded question bank, and disposable PostgreSQL.
- Produces: six sanitized PNG files referenced by `docs/user-guide.md` using `assets/user-guide/<filename>`.

- [ ] **Step 1: Confirm a fresh Git state before creating the temporary harness**

Run:

```powershell
& C:\Users\littl\.agents\tools\work-state-preflight.ps1 `
  -RepositoryPath (Get-Location).Path -OutputFormat Markdown
git status --short --branch
```

Expected: branch `dev-user-guide`, clean worktree, HEAD at the committed design/plan baseline.

- [ ] **Step 2: Create the asset directory**

Run:

```powershell
New-Item -ItemType Directory -Force -Path docs/assets/user-guide
```

Expected: the empty directory exists; Git still shows no path until a screenshot is written.

- [ ] **Step 3: Add the temporary Playwright capture specification with deterministic fictional data**

Use `apply_patch` to create `apps/web/e2e/user-guide-capture.spec.ts`. The specification must:

- set a `1440 × 900` viewport and Hungarian locale;
- use `request.post` to create `Digitális ügyfélportál` for `Kovács Anna` at `anna.kovacs@example.test`;
- save workspace state `INTAKE_IN_PROGRESS`, ball owner `Nagy Dóra — Product Owner`, next action `A nyitott üzleti és integrációs kérdések lezárása`, and a fixed future due date;
- publish a project schema from the first four active bank questions;
- create one open `INITIAL_INTAKE` round and persist valid answers for the first two questions according to their actual types;
- create one `BUSINESS` and one `INTEGRATION` discovery follow-up, then resolve the business item to `Megválaszolva` with a fictional decision;
- create one `MANUAL` Markdown revision;
- navigate through the real UI and capture the exact six filenames from the File Map;
- hide no product controls and perform no pixel editing after capture;
- assert each screenshot target is visible before writing the PNG.

The data must contain no production-looking hostname, company secret, real customer, real email domain, credential, token, or local path.

- [ ] **Step 4: Start a disposable PostgreSQL database**

Run an exact named, loopback-only container with a randomly generated password held only in the current PowerShell process:

```powershell
$guideDbPassword = [Convert]::ToHexString([Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
docker run --rm --detach `
  --name project-maker-user-guide-capture `
  --publish 127.0.0.1:55461:5432 `
  --env POSTGRES_DB=project_maker_user_guide `
  --env POSTGRES_USER=project_maker `
  --env "POSTGRES_PASSWORD=$guideDbPassword" `
  postgres:18.4-alpine
$env:DATABASE_URL = "postgresql://project_maker:$guideDbPassword@127.0.0.1:55461/project_maker_user_guide"
```

Expected: only the exact container `project-maker-user-guide-capture` is started; the password is not printed or persisted.

- [ ] **Step 5: Apply migrations and run the screenshot specification**

Run after PostgreSQL reports ready:

```powershell
pnpm --filter @project-maker/api migration:run
pnpm --filter @project-maker/web exec playwright test e2e/user-guide-capture.spec.ts --workers=1
```

Expected: migrations `0001`–`0007` apply; one screenshot test passes; all six PNG files exist.

- [ ] **Step 6: Stop the disposable environment and verify cleanup**

Run:

```powershell
docker stop project-maker-user-guide-capture
docker ps --all --filter name=project-maker-user-guide-capture --format '{{.Names}}'
Get-NetTCPConnection -LocalPort 55461,3000,4200 -ErrorAction SilentlyContinue
```

Expected: no matching container and no listener owned by the capture run remains.

- [ ] **Step 7: Inspect every image at original resolution**

Use `view_image` with `detail: original` for all six files. Verify:

- text is legible at the documented display width;
- the page and workflow state match the filename;
- only fictional data appears;
- no browser chrome, developer console, extension, toast overlap, spinner, trace, or file path appears;
- the screenshot does not imply a capability absent from the guide.

If any check fails, recapture that image from the clean disposable fixture; do not edit pixels.

- [ ] **Step 8: Remove the temporary screenshot harness**

Use `apply_patch` to delete `apps/web/e2e/user-guide-capture.spec.ts`.

Run:

```powershell
git status --short
```

Expected: only the six PNG assets are new; the temporary specification is absent.

---

### Task 2: Write the orientation, workflow spine, and visual explanations

**Files:**
- Create: `docs/user-guide.md`
- Reference: `docs/assets/user-guide/*.png`

**Interfaces:**
- Consumes: six verified screenshots and the approved design semantics.
- Produces: the guide structure, navigation anchors, three diagrams, and terminology used by every later chapter.

- [ ] **Step 1: Create the canonical guide with the exact top-level structure**

Use `apply_patch` to create `docs/user-guide.md` with these headings in this order:

```markdown
# Project Maker felhasználói kézikönyv
## Hogyan használd ezt az útmutatót?
## Project Maker öt percben
## Mielőtt dolgozni kezdesz
## A felület térképe
## A teljes napi workflow
## Első projekted: vezetett gyorsindítás
## Projektek és a portfolio
## A projekt cockpit használata
## A közös kérdésbank kezelése
## Projektséma és kezdő interjú
## Discovery follow-upok kezelése
## Ügyfél-emlékeztetők és review email
## Markdown-revíziók és átadási pillanatképek
## Audit history: mi történt a projekttel?
## Archiválás, visszaállítás és végleges törlés
## Hibahelyzetek és biztonságos folytatás
## Fogalomtár és állapotreferencia
## Mit nem tud még a jelenlegi verzió?
## Napi és átadási ellenőrzőlisták
```

Add a linked table of contents after the opening paragraph. Use short paragraphs, task tables, numbered procedures, blockquote warnings, and descriptive captions. Do not use a changelog or implementation history.

- [ ] **Step 2: Write the operating boundary and audience contract**

State prominently:

- the product supports discovery and requirements clarification, not general project management;
- the current application is for an organization-controlled internal network;
- no login or permission enforcement exists;
- anyone with access can modify project and shared question data;
- `Settings` is an organizationally restricted steward activity;
- customer contact and outbound mail must be checked before sending;
- exact UI labels may be English although the guide is Hungarian.

- [ ] **Step 3: Add the end-to-end daily workflow Mermaid diagram**

Use a left-to-right `flowchart LR` with these delivered nodes and branches:

```mermaid
flowchart LR
    A[Projekt létrehozása] --> B[Cockpit és felelős kijelölése]
    B --> C[Projektséma közzététele]
    C --> D[Kezdő interjú]
    D --> E{Minden kötelező válasz mentve?}
    E -- Nem --> D
    E -- Igen --> F[Interjúkör lezárása]
    F --> G[Discovery follow-upok lezárása]
    G --> H[Markdown-revízió ellenőrzése]
    H --> I[Ügyfél-review vagy belső átadás]
    I --> J{Folytatódik az aktív munka?}
    J -- Igen --> B
    J -- Nem --> K[Archiválás]
```

Explain immediately below that status progression is manual and this diagram is the recommended operating order, not an enforced wizard.

- [ ] **Step 4: Add the lifecycle Mermaid diagram**

Use `stateDiagram-v2` to show unrestricted manual transitions among the five active statuses, a deliberate archive transition, and restore exclusively to `DRAFT`. Put the active statuses in a composite state so the diagram remains readable. Add a note that entering `READY_FOR_PLANNING` creates a milestone Markdown revision.

- [ ] **Step 5: Add the data-lineage Mermaid diagram**

Use `flowchart LR` with:

```mermaid
flowchart LR
    A[Közös kérdésbank-verzió] --> B[Projekt kérdésséma-verzió]
    B --> C[Kezdő interjú változatlan pillanatképe]
    C --> D[Mentett válaszok]
    B --> E[Markdown forráspillanatkép]
    C --> E
    D --> E
    E --> F[Letölthető Markdown-revízió]
```

Explain that later bank edits do not rewrite existing schemas or rounds, and that the Markdown snapshot currently excludes discovery and customer follow-up state.

- [ ] **Step 6: Place the six screenshots at the corresponding first-use chapters**

Use relative links and exact alt-text intent, for example:

```markdown
![A Project Maker projektlistája egy aktív mintaprojekttel és az új projekt indítási lehetőségével](assets/user-guide/01-projects.png)

*A projektlista a napi munka kiindulópontja; a státusz, a felelős és a következő lépés már a kártyán látható.*
```

Use at most one screenshot before any single procedure and never place two large screenshots back-to-back without explanatory prose.

---

### Task 3: Write every detailed business workflow and recovery branch

**Files:**
- Modify: `docs/user-guide.md`

**Interfaces:**
- Consumes: the guide headings, workflow terminology, screenshots, and diagrams from Task 2.
- Produces: complete standalone operating instructions for every delivered route and action.

- [ ] **Step 1: Write portfolio and project-creation workflows**

Cover loading, empty, list, error/retry, project ordering, archived cards, `New project`, required fields, input limits, cancel, successful redirect, and the current inability to edit project name or customer contact later. Explain that a project card shows lifecycle status, ball owner, and next action.

- [ ] **Step 2: Write cockpit summary and workspace workflows**

Define every status in business terms:

| Status | Guide meaning |
| --- | --- |
| `DRAFT` | Előkészítés; a projekt még szabadon formálódik. |
| `INTAKE_IN_PROGRESS` | Aktív igényfelmérés és interjú folyik. |
| `WAITING_INTERNAL` | A következő érdemi lépés belső információra vagy döntésre vár. |
| `WAITING_CUSTOMER` | A következő érdemi lépés ügyfélválaszra vár. |
| `READY_FOR_PLANNING` | A felhasználó üzletileg tervezésre késznek jelöli; a rendszer nem számolja ki ezt. |
| `ARCHIVED` | Az aktív követés lezárt; a megőrzött projektet előbb vissza kell állítani. |

Explain ball owner, one concrete next action, local due date/time stored as an exact moment, manual save, empty optional fields, validation, and concurrent-action disabling. Explain the automatic `READY_FOR_PLANNING` Markdown milestone.

- [ ] **Step 3: Write the question-bank steward workflow**

Cover `Settings`, bank version, create/edit, immutable stable key, active/inactive behavior, order shifting, hint, one-option-per-line rule, unique options, all seven question types, and the four behavior flags. Explicitly state the present enforcement difference among `Required`, `Required for estimate`, and `Blocking`.

- [ ] **Step 4: Write project-schema publication and versioning workflow**

Cover default selection of active questions, at-least-one rule, first publish versus update, schema and bank version display, no-active-question recovery, open-round lock, and the fact that a successor schema affects only later rounds.

- [ ] **Step 5: Write initial-intake round workflow**

Cover start prerequisite, only `INITIAL_INTAKE`, duplicate-open protection, active-round recovery after navigation or restart, immutable snapshot, question guidance, required/blocking labels, all answer controls, and clearing an answer.

Include the save-state table:

| Visible state | Worker action |
| --- | --- |
| `Piszkozat – automatikus mentésre vár` | Maradj az oldalon; a 750 ms-os csend után mentés indul. |
| `Mentés folyamatban…` | Várd meg a mentés végét a lezárás előtt. |
| `Mentve` | A válasz a szerveren megmaradt. |
| `Még nincs mentve` | Nincs rögzített válasz. |
| `Nem sikerült menteni…` | A piszkozat megmaradt; használd a `Mentés újrapróbálása` gombot. |

Explain completion preconditions, missing-required conflict, failed/pending save blocking, completed lock, post-reload absence of completed-round history on this page, later initial round, and Markdown as the available historical review surface.

- [ ] **Step 6: Write discovery follow-up workflows**

Define all eight categories with one-line business examples. Cover required question, owner, real date-only due date, next step, earliest-due-first ordering, initial `Nyitott`, no automatic overdue highlight, one open resolution form, cancel, required resolution explanation, terminal statuses, duplicate prevention, no edit/reopen/delete, archived read-only list, restore and retry.

- [ ] **Step 7: Write customer communication workflows**

Separate three actions clearly:

1. follow-up settings control an automatic schedule;
2. `Send follow-up ping` sends one reminder immediately and optionally includes the latest Markdown;
3. `Send customer review email` immediately sends the latest required Markdown revision.

Cover interval `1`–`525600`, future expiry when enabled, no-expiry meaning, dirty settings disabling send controls, `Enabled/Disabled`, `Never/SENT/FAILED`, last/next ping, safe delivery error code, missing mail configuration, no revision for review, failed send, automatic expiry, archive behavior, fixed recipient, and audit evidence. Put a warning immediately before external-send instructions.

- [ ] **Step 8: Write Markdown revision workflows**

Cover no-revision state, `MANUAL` versus `MILESTONE`, required milestone name, immutable latest-first versions, selected revision, creation metadata, source version, previous link, change summary, content preview, `execution-plan.md` download, no editing/deletion, repeated no-change revision, and review-before-email. State exactly what the source snapshot includes and excludes.

- [ ] **Step 9: Write audit-history workflow and event dictionary**

Explain newest-first pages of 10, previous/next, retry, empty state, JSON payload purpose, no secret answer content in discovery-resolution events, and no actor attribution. Include every current event type:

`PROJECT_ARCHIVED`, `PROJECT_RESTORED`, `PROJECT_QUESTION_SCHEMA_PUBLISHED`, `INTERVIEW_ROUND_CREATED`, `ROUND_ANSWER_SAVED`, `ROUND_ANSWER_CLEARED`, `INTERVIEW_ROUND_COMPLETED`, `DISCOVERY_FOLLOW_UP_CREATED`, `DISCOVERY_FOLLOW_UP_RESOLVED`, `MARKDOWN_REVISION_CREATED`, `FOLLOW_UP_SETTINGS_UPDATED`, `FOLLOW_UP_PING_SENT`, `FOLLOW_UP_PING_FAILED`, `CUSTOMER_REVIEW_EMAIL_SENT`, and `CUSTOMER_REVIEW_EMAIL_FAILED`.

State that ordinary workspace saves and project creation are not complete actor-attributed audit entries.

- [ ] **Step 10: Write archive, restore, and deletion workflows**

Cover archive as the default retention action, read-only cockpit behavior, retained list visibility, restore exclusively to `DRAFT`, resolution draft clearing across archive/restore, deletion button visibility, confirmation cancel, permanent success redirect, server conflict, retained activity categories, and archive-as-recovery. Include a prominent irreversible-action warning.

- [ ] **Step 11: Write the consolidated failure-and-recovery matrix**

Include at least these visible situations: API unreachable, page load error, project/revision not found, stale `409`, invalid fields, pending autosave, failed autosave, missing required answers, missing project schema, no active questions, missing mail configuration, missing Markdown for review, failed email, archived mutation, and delete conflict. Every row must say what remains safe and the next user action.

- [ ] **Step 12: Write glossary, limitations, and checklists**

Define project, cockpit, ball owner, question bank, project schema, interview round, discovery follow-up, customer follow-up, Markdown revision, and audit event. List all absent capabilities from the design. Finish with concise start-of-day, before-customer-send, before-handoff, and end-of-active-work checklists.

- [ ] **Step 13: Perform a prose-focused self-edit**

Review the entire guide top to bottom and correct:

- unexplained English label use;
- paragraphs longer than one focused idea;
- steps that start without a precondition;
- repeated technical detail already owned by operations handoff;
- inconsistent terms for the same state;
- forward references without links;
- warnings that appear after, rather than before, the consequential action;
- any claim that scoring, canonical specification, exports, AI, permissions, or full archive enforcement already exists.

- [ ] **Step 14: Commit the guide and visual assets**

Stage only:

```powershell
git add -- docs/user-guide.md docs/assets/user-guide/01-projects.png docs/assets/user-guide/02-cockpit.png docs/assets/user-guide/03-question-bank.png docs/assets/user-guide/04-guided-interview.png docs/assets/user-guide/05-discovery-follow-ups.png docs/assets/user-guide/06-markdown-revisions.png
git diff --cached --check
git commit -m "docs: add Hungarian user guide"
```

Expected: one cohesive guide/assets commit; no capture harness or test artifact is staged.

---

### Task 4: Synchronize documentation discovery and DOC-01 delivery state

**Files:**
- Modify: `README.md`
- Modify: `docs/README.md`
- Modify: `docs/roadmap.md`
- Modify: `.planning/REQUIREMENTS.md`
- Modify: `.planning/STATE.md`

**Interfaces:**
- Consumes: committed `docs/user-guide.md` and its verification-ready assets.
- Produces: one consistent repository statement that DOC-01 is delivered and discoverable.

- [ ] **Step 1: Link the guide from the repository README**

Add the Hungarian guide as the first end-user link in the Documentation section. Keep the documentation index, roadmap, product-domain, and operations links intact.

- [ ] **Step 2: Make the guide the first `Start here` entry in `docs/README.md`**

Replace the placeholder text saying DOC-01 is planned with a direct end-user guide link and a one-line audience description. Add links to the approved design and implementation plan under planning evidence.

- [ ] **Step 3: Move DOC-01 to DELIVERED in the roadmap**

Add one `DELIVERED` row with outcome “Teach employees every stable delivered workflow” and evidence links to the guide, design, implementation plan, and relevant browser tests. Remove the `DOC-01` row from `PLANNED` without changing unrelated feature status.

- [ ] **Step 4: Check DOC-01 in requirements**

Change exactly:

```markdown
- [ ] **DOC-01:**
```

to:

```markdown
- [x] **DOC-01:**
```

Preserve the requirement text.

- [ ] **Step 5: Synchronize planning state**

Update the verified delivery baseline to the current guide-delivery branch context without claiming a final merge SHA before merge. Add the guide to current implementation and verification surfaces; preserve the warning that Git decisions require fresh WORK_STATE evidence.

- [ ] **Step 6: Commit status synchronization**

Run:

```powershell
git add -- README.md docs/README.md docs/roadmap.md .planning/REQUIREMENTS.md .planning/STATE.md docs/superpowers/plans/2026-08-09-user-guide.md
git diff --cached --check
git commit -m "docs: publish DOC-01 status"
```

Expected: documentation discovery and delivery-state sources change together.

---

### Task 5: Verify completeness, rendering, security, and repository health

**Files:**
- Verify: `docs/user-guide.md`
- Verify: `docs/assets/user-guide/*.png`
- Verify: documentation status files from Task 4

**Interfaces:**
- Consumes: complete documentation commits.
- Produces: evidence that the guide is internally coherent, linked, sanitized, and does not regress the repository.

- [ ] **Step 1: Run placeholder and planned-as-delivered scans**

Run:

```powershell
rg -n 'TBD|TODO|FIXME|PLACEHOLDER|coming soon' docs/user-guide.md
rg -n 'Decision Score|readiness|PDF|Excel|spreadsheet|AI|authentication|authorization|offline' docs/user-guide.md
```

Expected: first command has no matches. Every second-command match is in a clearly qualified limitation or “not yet available” statement.

- [ ] **Step 2: Verify all guide links and image targets**

Run this read-only PowerShell check from the repository root:

```powershell
$guidePath = (Resolve-Path 'docs/user-guide.md').Path
$guideDirectory = Split-Path -Parent $guidePath
$guideText = Get-Content -Raw -LiteralPath $guidePath
$targets = [regex]::Matches($guideText, '!?' + '\[[^\]]*\]\(([^)]+)\)') |
  ForEach-Object { $_.Groups[1].Value } |
  Where-Object { $_ -notmatch '^(https?://|#|mailto:)' } |
  ForEach-Object { ($_ -split '#', 2)[0] } |
  Where-Object { $_ } |
  Sort-Object -Unique
$missing = foreach ($target in $targets) {
  $decoded = [Uri]::UnescapeDataString($target)
  $resolved = Join-Path $guideDirectory $decoded
  if (-not (Test-Path -LiteralPath $resolved)) { $target }
}
if ($missing) { throw "Missing user-guide targets: $($missing -join ', ')" }
```

Expected: no exception.

- [ ] **Step 3: Verify route and action coverage mechanically**

Run:

```powershell
rg -o 'label="[^"]+"' apps/web/src/app -g '*.html' | Sort-Object -Unique
rg -n '^## |^### ' docs/user-guide.md
```

Review every consequential label against the guide. Loading-only spinners may be grouped; create, save, send, resolve, archive, restore, delete, retry, generate, publish, complete, and download actions must be explicitly covered.

- [ ] **Step 4: Reinspect all screenshots and Mermaid blocks**

Use `view_image` at original resolution for every PNG. Then inspect each fenced `mermaid` block for balanced fences, valid diagram declarations, unique node IDs within its block, and terminology matching the adjacent prose.

- [ ] **Step 5: Run documentation and secret hygiene checks**

Run:

```powershell
git diff main...HEAD --check
git status --short --branch
rg -n --hidden --glob '!node_modules/**' --glob '!.git/**' `
  '(eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{10,}|BEGIN [A-Z ]+PRIVATE KEY|password\s*[:=]\s*[^<\s])' `
  docs README.md .planning
```

Expected: whitespace check passes; only intended files are tracked; no literal credential or token candidate appears.

- [ ] **Step 6: Run repository verification**

Run against a disposable migrated PostgreSQL instance:

```powershell
pnpm verify
pnpm test:e2e
```

Expected: contracts, API, web unit tests, production builds, and all browser E2E tests pass. Record any pre-existing non-blocking warning separately; do not weaken a gate.

- [ ] **Step 7: Review the complete diff for scope and readability**

Run:

```powershell
git diff --stat main...HEAD
git diff --name-status main...HEAD
git log --oneline --decorate main..HEAD
```

Expected: only the design, plan, guide, six images, and five documentation-status files differ from `main`.

---

### Task 6: Publish through a reviewed GitHub PR and synchronize local main

**Files:**
- No new content files; Git/GitHub state only.

**Interfaces:**
- Consumes: clean verified `dev-user-guide` branch.
- Produces: merged GitHub `main`, successful CI, and matching clean local `main`.

- [ ] **Step 1: Refresh all Git and GitHub state before publishing**

Run WORK_STATE preflight, `git ls-remote --heads origin main dev-user-guide`, and `gh pr list --head dev-user-guide --state all`. Stop if local main, remote main, branch HEAD, worktree, upstream, or PR evidence conflicts.

- [ ] **Step 2: Push the branch with tracking**

Run:

```powershell
git push -u origin dev-user-guide
```

Refresh WORK_STATE immediately after push.

- [ ] **Step 3: Create a ready PR against main**

Use title `Publish Hungarian end-user guide` and summarize:

- complete employee workflow guide;
- six sanitized application screenshots;
- three workflow/state diagrams;
- DOC-01 status synchronization;
- verification and known current limitations.

Create a ready, non-draft PR and refresh WORK_STATE.

- [ ] **Step 4: Inspect the rendered GitHub guide before merge**

Open the PR’s rendered `docs/user-guide.md`. Verify table of contents navigation, Mermaid rendering, screenshot scaling, alt text, headings, tables, warnings, and relative links. Fix any rendering defect on the branch, rerun targeted checks, commit, and push before proceeding.

- [ ] **Step 5: Wait for required GitHub checks**

Run `gh pr checks <number> --watch --interval 10`. Expected: every required check completes successfully and PR merge state is `CLEAN`.

- [ ] **Step 6: Merge with a merge commit**

Run `gh pr merge <number> --merge`. Do not squash or force-push. Refresh WORK_STATE and verify the PR is `MERGED` and remote `main` points to the reported merge commit.

- [ ] **Step 7: Wait for the post-merge main CI**

Find the push-triggered run for the merge SHA with `gh run list --branch main`, then use `gh run watch <run-id> --exit-status`. Expected: conclusion `success`.

- [ ] **Step 8: Fast-forward local main**

With a clean worktree:

```powershell
git fetch origin main
git switch main
git merge --ff-only origin/main
```

Refresh WORK_STATE after fetch, switch, and merge. Final expected state: local `main` equals `origin/main`, worktree clean, PR merged, GitHub main CI successful.

---

## Final self-review checklist

- [ ] Every section of the approved design maps to at least one task above.
- [ ] No task contains a placeholder, undecided filename, invented route, or unqualified future behavior.
- [ ] Screenshot filenames, guide links, and repository-status files are identical across all tasks.
- [ ] The plan preserves a documentation-only final diff and removes the temporary capture harness.
- [ ] Destructive deletion and external email warnings precede their procedures.
- [ ] Git operations include fresh state gates and never force-push or squash.
