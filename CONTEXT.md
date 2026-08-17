# Project Maker

The domain language used to describe discovery projects, intake work, and their follow-ups.

## Language

**Project preparation journey**:
The primary employee journey for a PM, PO, or BA from selecting a project,
through completing the Initial Intake and resolving its resulting work, to
preparing or being ready for estimation. It uses named task contexts rather
than requiring a person to discover prerequisite work by scrolling a project
overview.
_Avoid_: Cockpit scroll journey, administrator configuration journey

**Project status**:
The compact project-specific entry context that shows the current preparation
state, operational coordination data, one next relevant task, customer
communication actions, and recent human-readable activity. It is not the
container for every project workflow or for raw diagnostic data.
_Avoid_: One-page project workspace, all-workflow editor

**Portfolio overview**:
The application-level starting context for current projects, their preparation
states, and the most important next actions. It does not replace a selected
project's working context or the active project queue.
_Avoid_: Full project dossier, unfiltered project list

**Active project queue**:
A prioritized cross-project list of projects in active preparation, each with
one clear next action. It is distinct from a queue of individual discovery
follow-ups.
_Avoid_: Discovery follow-up queue, project archive

**Selected project context**:
The visible context while a person works in one project. It identifies the
project and supplies a return route to the list from which the work began; it
is not a hidden global selection that persists across unrelated application
areas.
_Avoid_: Implicit current project, global sticky project state

**Project context navigation**:
The compact navigation inside a Selected project context: Projektállapot,
Felmérés, Felkészültség, Döntési értékelés, Markdown terv, and
Projektbeállítások. A context may explain a missing prerequisite but is not
hidden merely because the project is earlier in preparation.
_Avoid_: Global application menu, scroll-only project navigation

**Navigation boundary**:
A change between a named global application context or a named Project context
is a page and URL transition. Setup steps, filters, selected records, revision
selection, previews, and activity detail are local view state; accepting a
Project question schema is the deliberate transition from project creation to
the Initial Intake interview.
_Avoid_: Scroll navigation, URL for every transient selection, hidden context switch

**Project settings**:
The project-scoped administration context for basic project data, customer
contact details, customer email configuration, archive, and deletion. It is
separate from active project preparation work.
_Avoid_: Day-to-day project coordination, hidden destructive controls

**Operational coordination data**:
The named Next-action owner, one next action, and due date used to coordinate
active project preparation. The owner is either the named Internal project
owner or the named Customer contact. Coordination is visible and quickly
editable from employee working contexts rather than buried in Project settings.
_Avoid_: Contact details used as an implicit assignment, project lifecycle control

**Internal project owner**:
The named internal PO/PM user who operates Project Maker for the project,
conducts the interview, and may own its next action.
_Avoid_: Anonymous internal user, unqualified project role

**Next-action owner**:
The concrete person who currently has the project's next action: either the
Internal project owner or the Customer contact. Employee-facing language names
the role and person together.
_Avoid_: Ball owner, free-form owner label

**Ended interview**:
An Initial Intake meeting that has ended independently of information
completeness. Its working record may support a first or later handoff draft.
_Avoid_: Immutable completed round, readiness approval

**Interview review**:
An editable interval after an Initial Intake meeting ends, used to prepare its
first customer handoff or a later correction version. Answer completeness
affects readiness and gaps, not whether the meeting can end.
_Avoid_: One-time pre-send state, readiness approval

**Interview customer handoff**:
One numbered, immutable, human-readable question-and-answer snapshot explicitly
sent to the project's named Customer contact after review.
_Avoid_: Customer follow-up ping, arbitrary-recipient email, raw data export

**Interview revision draft**:
The single editable next handoff version based on the current working interview
and latest sent version. Starting it never changes an earlier handoff.
_Avoid_: Rewriting a sent handoff, parallel correction drafts

**Modification summary**:
The customer-visible explanation of what changed in an Interview customer
handoff after version one.
_Avoid_: Raw inbound email, diagnostic audit text

**Question Bank**:
The organization-maintained, configurable source collection of available
questions. It is administered separately from choosing a project's questions.
_Avoid_: Project question schema, interview round

**Published Question Bank version**:
The versioned, published Question Bank state from which a new Project question
schema may select questions. Editing occurs in a draft and does not rewrite a
previously approved Project question schema.
_Avoid_: Live mutation of an active interview, unversioned question source

**Project question schema**:
The approved selection of Question Bank questions for one project. Its
acceptance creates and opens that project's Initial Intake interview round.
_Avoid_: Editing the Question Bank, unanswered interview

**Unavailable Project question schema**:
The project-start situation in which no active Question Bank question can be
selected. The schema cannot be accepted or start an interview, while the
entered project basic data remains available to resume after the Question Bank
is corrected.
_Avoid_: Empty interview round, discarded project-start input

**Project-start draft**:
A persistent project created from valid basic data before its Project question
schema is accepted. It remains resumable and is visibly in the
`Kérdésséma szükséges` preparation state until the interview starts.
_Avoid_: Browser-only wizard draft, silently abandoned input

**Frozen Project question schema**:
The Project question schema that belongs to a started or completed Initial
Intake interview round. It is not changed in place; a different assessment
uses a newly accepted schema and a new Initial Intake round.
_Avoid_: Rewriting answered questions, mutable historical assessment

**Post-interview readiness transition**:
The direct transition from an ended Initial Intake meeting to that project's
Felkészültség context, where its current gaps are understood and acted on while
the ended interview supports versioned review and customer handoff.
_Avoid_: Returning blindly to a global list, treating completion as readiness

**Project preparation state**:
The one employee-facing preparation state shown for an active project:
`Kérdésséma szükséges`, `Felmérés folyamatban`, `Tisztázás szükséges`,
`Döntési értékelés szükséges`, `Becslés előkészíthető`, or `Becslésre kész`.
It conveys the next stage of project preparation, not a raw persistence status.
_Avoid_: DRAFT, inferred priority score, multiple competing project states

**Discovery follow-up queue**:
The cross-project working view of open Discovery follow-ups. It does not
include customer communication follow-ups.
_Avoid_: Active project queue, customer follow-up queue

**Human-readable project activity**:
An employee-facing chronological summary of project changes expressed in
domain language. Raw audit event codes and payloads are diagnostic details,
not the normal project preparation journey.
_Avoid_: Raw audit log, technical event feed

**Project archive**:
The deliberate removal of a project from active preparation lists while
retaining its readable history. Restoring an archived project resumes its
preparation at the `Kérdésséma szükséges` state.
_Avoid_: Deleted project, completed estimation handoff

**Markdown template**:
A named, reusable, user-editable Markdown structure stored for future
Markdown revision generation. Multiple templates may be saved separately;
editing one never rewrites an already saved immutable Markdown revision.
_Avoid_: Markdown revision, hard-coded renderer, editable historical snapshot

**Markdown template library**:
The organization-level collection of named Markdown templates available when a
project generates a future Markdown revision.
_Avoid_: Project-owned template copy, Markdown revision history

**Default Markdown template**:
The initial published Markdown template available from the Markdown template
library. It gives every project a usable, human-readable starting point
without requiring a person to create a template before its first Markdown
revision.
_Avoid_: Hard-coded renderer, mandatory custom template setup

**Published Markdown template version**:
A versioned Markdown template state that is eligible for future revision
generation. Template editing is performed as a draft; a generated Markdown
revision records the selected template's name and published version.
_Avoid_: Editable historical revision, unversioned production template

**Required Markdown template placeholder**:
A Markdown template placeholder whose project data must be available before a
revision can be generated. Missing required data blocks generation with a
specific explanation; an optional placeholder's block is omitted instead.
_Avoid_: Silent blank value, misleading incomplete document

**Markdown template placeholder**:
A documented, safe reference to supported project data that a Markdown
template can render. It is not arbitrary executable logic or an exposed raw
data payload.
_Avoid_: Script, unrestricted interpolation, default JSON dump

**Discovery follow-up**:
A project-owned accountable discovery work item with a question, owner, due date, status, and next step.
_Avoid_: Customer email follow-up, task

**Open discovery follow-up**:
A discovery follow-up in the `Nyitott` state; it remains eligible for general editing.
_Avoid_: Resolved follow-up, editable lifecycle state

**Editing a discovery follow-up**:
A change to an open follow-up's category, question, owner, due date, or next step. Status and decision or answer change only through resolution.
_Avoid_: Resolving, reopening, lifecycle change

**Discovery follow-up edit audit**:
A project audit record that identifies an edited follow-up and names the fields changed, without duplicating their values.
_Avoid_: Full free-text change history, untracked edit

**Discovery follow-up edit conflict**:
An edit that cannot be saved because the follow-up changed after editing began; the user refreshes the current record before deciding whether to submit again.
_Avoid_: Silent overwrite, last writer wins

**Discovery follow-up edit draft**:
The unsaved inputs preserved after an edit conflict until the user explicitly reloads the current record or cancels editing.
_Avoid_: Automatically discarded work, automatic merge

**Discovery follow-up version**:
A positive record revision used to prove that an edit is based on the current follow-up; it changes only after a real edit or resolution.
_Avoid_: Timestamp-based conflict token, user-facing lifecycle state

**Discovery follow-up source linkage**:
An optional historical relationship from a discovery follow-up to one immutable
checklist snapshot eligible in the project's current Initial Intake source at
the time of linking. An open discovery follow-up may change or remove the
relationship; a resolved follow-up retains it as readable provenance even when
a later intake round becomes current. It is not part of the general editing
slice.
_Avoid_: Inferred link, general edit field

**Current Initial Intake source**:
The most recently created `OPEN` or `ENDED` Initial Intake round for a project,
regardless of which of those two lifecycle states it has. It defines
the eligible checklist snapshots for a new or changed discovery follow-up
source linkage.
_Avoid_: Any historical checklist, automatically repointed source

**Resolved discovery follow-up**:
A discovery follow-up in the `Megválaszolva` or `Nem releváns` terminal state; its business content is immutable and it is not reopened by the editing slice.
_Avoid_: Closed task, archived follow-up

**Contracts runtime distribution**:
The complete executable publication of the shared contracts and canonical policy data that an application runtime consumes as one artifact.
_Avoid_: Partial runtime copy, application-owned policy duplicate

**Decision input rating**:
A project-level, 1–5 assessment of business value, strategic alignment, urgency,
confidence, complexity, or risk. It is explicit user input for the Decision
Score and is not inferred from an Initial Intake answer.
_Avoid_: Checklist status, readiness factor

**Decision Score**:
An explainable weighted result derived from the six Decision input ratings and
available readiness under the selected playbook policy. It is decision support,
not a recorded Go, Conditional Go, or No-Go decision.
_Avoid_: Final decision, readiness

**Decision recommendation**:
A policy-derived statement of whether clarification is needed, estimate
preparation is possible, or the project is ready for estimation. It explains
the current Decision Score and readiness state without deciding for a person.
_Avoid_: Approval, automatic Go/No-Go

**Decision recommendation precedence**:
Clarification need is evaluated before positive estimation recommendations: a
critical gap, readiness below 40, or more than two estimate-blocking gaps
requires clarification. Otherwise, estimate readiness requires a score and
readiness of at least 65 with no estimate-blocking gaps; estimate preparation
requires a score of at least 40 and readiness of at least 65.
_Avoid_: Positive recommendation that bypasses a clarification gate

**Decision Score completeness**:
Decision Score is available only when all six Decision input ratings are valid
and the current Initial Intake source has available canonical readiness. A
partial input assessment is retained without a fabricated score or
recommendation.
_Avoid_: Partial score, zero score for missing input

**Decision Review**:
The project-scoped resource that atomically holds the six Decision input
ratings and returns their server-derived Decision Score, recommendation, and
safe explanation. It is distinct from generic project workspace updates.
_Avoid_: Client-side scoring copy, final decision record

**Estimate-blocking gap**:
A current Initial Intake checklist item marked `requiredForEstimate` whose
effective checklist status is neither `Kész` nor `Nem releváns`. It is a
policy-defined estimate gate; it is not every important readiness gap or an
unresolved discovery follow-up.
_Avoid_: Critical gap, generic open work

**Decision critical gap**:
A current available readiness gap classified by the selected policy as
`Kritikus`. It takes precedence over a positive estimation recommendation and
may be distinct from an estimate-blocking gap.
_Avoid_: Estimate-blocking gap, any unresolved follow-up
