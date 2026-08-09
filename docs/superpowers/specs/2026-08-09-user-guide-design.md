# DOC-01 Hungarian end-user guide design

## Outcome

Publish a self-contained Hungarian guide that enables a newly assigned employee
to understand what Project Maker is for, complete the delivered day-to-day
workflows, interpret each resulting business state, and recover from expected
errors without reading technical documentation or source code.

The guide documents the application implemented at `main` commit `82a5449`.
Planned domain behavior is named only in a clearly separated limitations
section and is never presented as available functionality.

## Audience and language

The primary audience is a PM, PO, BA, or other discovery worker receiving the
web application for daily use. A secondary audience is the organizational
steward responsible for the shared question bank.

- Explanations are Hungarian and use business language.
- Exact current UI labels are shown in code formatting because the interface is
  currently mixed English and Hungarian.
- A role name describes organizational responsibility only. The application
  currently has no login, authorization, or technically enforced admin role.
- Deployment, API, database, and SMTP implementation details remain in the
  operations handoff and are not duplicated in the user guide.

## Documentation structure

The guide lives at `docs/user-guide.md` and follows a progressive, task-oriented
sequence:

1. five-minute orientation and safe-use boundary;
2. screen and navigation map;
3. a complete first-project walkthrough;
4. detailed workflow chapters in normal working order;
5. lifecycle, terminology, and event reference;
6. failure and recovery playbook;
7. current limitations and unavailable capabilities;
8. daily and handoff checklists.

Each detailed workflow uses the same pattern:

1. business purpose;
2. when to use it and required starting state;
3. exact user steps and visible UI labels;
4. persisted state or external side effect;
5. visible success evidence;
6. likely validation, conflict, or availability failure;
7. safe recovery and the next logical workflow.

This repeated structure keeps the reader oriented and prevents the guide from
becoming a screen-by-screen feature inventory without operational meaning.

## Delivered workflow inventory

The guide must cover every current user route and every delivered user action.

| Area | Required workflow coverage |
| --- | --- |
| Application shell | `Projects` and `Settings` navigation, project return links, mixed-language labels |
| Portfolio | empty, loading, error, retry, project cards, ordering, archived visibility |
| Project creation | required name and customer contact, validation, cancel, successful cockpit opening, immutable contact limitation |
| Cockpit workspace | summary, lifecycle status, ball owner, next action, due date/time, save and failure recovery |
| Lifecycle | manual active statuses, automatic Markdown milestone on `READY_FOR_PLANNING`, archive, restore-to-`DRAFT`, permanent deletion and conflict recovery |
| Question bank | create, edit, versioning, stable key, order, active state, question types, options, required/estimate/blocking semantics, validation |
| Project schema | default selection, publish, update, version display, no-question state, open-round lock |
| Initial intake | start, active-round recovery, immutable snapshot, all answer types, coaching, autosave, discrete save, clear, retry, completion, required-answer conflict, completed lock, later round |
| Discovery follow-ups | category, question, owner, date-only due date, next step, canonical ordering and `Nyitott` status, resolution, cancel, archive/read-only behavior |
| Customer communication | settings, cadence, expiry, manual ping, automatic ping, customer review, Markdown prerequisite, delivery states and failures |
| Markdown revisions | manual and milestone generation, immutable history, latest-first selection, source/change meaning, previous revision, preview and download |
| Audit history | event meaning, safe payload limits, newest-first pagination, retry, absence of actor attribution |

## Business semantics that require explicit explanation

- Project status is a manual declaration; the current app does not calculate
  readiness or prevent arbitrary transitions between active statuses.
- Entering `READY_FOR_PLANNING` from another status automatically creates a
  `MILESTONE` Markdown revision named `READY_FOR_PLANNING`.
- Restoring an archived project always returns it to `DRAFT`; it does not restore
  the previous active status.
- Permanent deletion succeeds only for a `DRAFT` without retained child
  activity or audit history. A conflict leaves the project intact and the user
  must archive it instead.
- A question-bank save publishes a new immutable bank version. The stable key is
  unique and cannot be edited later.
- `Required` prevents round completion when unanswered. `Blocking` currently
  adds guidance but only blocks completion when the same question is also
  required. `Required for estimate` is stored metadata and does not yet drive a
  score or gate.
- A project schema and a started interview round are versioned snapshots. Later
  bank changes do not mutate an open or completed round.
- Text answers wait 750 ms after typing stops before autosave. Discrete answers
  save immediately. A failed draft remains visible and must be retried before
  completing the round.
- A discovery follow-up is ordered by due date and starts as `Nyitott`. It can be
  resolved only once to `Megválaszolva` or `Nem releváns`, with a required
  decision or explanation. Editing, reopening, and deletion are not delivered.
- Customer email always targets the contact address entered at project creation.
  The UI has no recipient override or pre-send confirmation.
- A manual or automatic follow-up ping can be sent without a Markdown revision;
  the latest revision is included when one exists. Customer review email always
  requires the latest Markdown revision.
- A Markdown revision snapshots project, project-schema, and interview data. It
  does not currently include discovery follow-ups or customer follow-up
  settings, and it is not the planned canonical generated specification.
- Audit history is a project event trace, not a complete edit log and not an
  actor-attributed user log.

## Visual strategy

Use a hybrid visual approach: real screenshots teach page recognition, while
Mermaid diagrams teach sequence and state. Visuals are included only when they
reduce cognitive load or prevent a consequential misunderstanding.

### Screenshots

Capture the real application from an isolated database populated only with
fictional Hungarian business data. Store the images under
`docs/assets/user-guide/`.

1. project portfolio and new-project entry point;
2. cockpit summary and workspace controls;
3. shared base-question bank;
4. project schema and active guided interview;
5. discovery follow-up creation and resolution area;
6. Markdown revision history and detail view.

Each screenshot has meaningful Hungarian alt text and a short caption explaining
what the reader should notice. Screenshots must contain no secret, real email,
personal data, local file path, browser extension, developer console, or test
diagnostic. A screenshot is not used as the sole source of an instruction.

### Diagrams

The guide contains three focused Mermaid diagrams:

1. the end-to-end daily workflow from project creation to handoff;
2. lifecycle status and archive/restore behavior;
3. question bank → project schema → interview snapshot → Markdown revision data
   lineage.

The diagrams use the same terminology as the prose and do not show planned
features as delivered branches.

## Safe-use and limitation treatment

The guide opens with a visible operating boundary:

- use only inside the organization-controlled network;
- anyone with access can currently change shared data and question-bank content;
- verify the customer contact and the latest Markdown preview before sending;
- prefer archive over deletion when any useful history exists.

The current archive boundary is described honestly. Cockpit workspace,
discovery-follow-up, and customer-email mutations are disabled while archived,
but the interview and Markdown routes remain reachable in the current release.
The documented safe workflow is to restore before creating any new content, and
the route inconsistency is listed as a current limitation rather than normalized
as intended behavior.

The limitations section also names the absence of authentication/authorization,
search/filtering, contact editing, follow-up editing/reopening, readiness and
Decision Score calculation, canonical specification generation, PDF/spreadsheet
exports, PWA/offline operation, and live AI enrichment.

## Repository integration

The delivery updates the existing sterile documentation tree rather than
introducing a parallel documentation root:

- add `docs/user-guide.md`;
- add the six screenshot assets under `docs/assets/user-guide/`;
- link the guide prominently from `README.md` and `docs/README.md`;
- move `DOC-01` from `PLANNED` to `DELIVERED` in `docs/roadmap.md`;
- check `DOC-01` in `.planning/REQUIREMENTS.md`;
- synchronize the verified documentation baseline in `.planning/STATE.md`.

No application code, dependency, runtime configuration, security policy, or
operations procedure changes are part of this delivery.

## Verification

1. Build a workflow coverage matrix from the route templates, service rules,
   shared contracts, API integration tests, and browser E2E tests.
2. Verify that every current button and consequential empty/error/read-only state
   is represented in the guide or intentionally grouped under a general recovery
   rule.
3. Inspect every screenshot at original resolution for readability, fictional
   data, correct state, and absence of sensitive information.
4. validate Mermaid syntax and ensure each diagram matches the prose.
5. Check all relative Markdown links and image targets.
6. Scan for placeholders, contradictions, accidental planned-as-delivered claims,
   secrets, and technical implementation leakage.
7. Run `git diff --check` and review the final documentation-only diff.
8. Run the repository and GitHub quality gates required by the publication flow.

## Acceptance criteria

- A first-time employee can complete the normal end-to-end project workflow using
  the guide alone.
- Every delivered user workflow, branch, side effect, irreversible action,
  validation case, and practical recovery path is covered.
- The document explains what each field, status, event, and generated artifact
  means to daily work, not how its API or database is implemented.
- The guide remains coherent when read top to bottom and remains useful as a
  task reference through its table of contents, consistent workflow template,
  cross-links, and checklists.
- Screenshots and diagrams materially improve orientation without replacing
  accessible prose.
- Current limitations are explicit, and no roadmap-only capability is presented
  as available.
- Documentation indexes, roadmap, requirement state, and planning state agree
  that `DOC-01` is delivered only after the guide and verification evidence are
  merged to `main`.
