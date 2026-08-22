# Project Maker

The domain language used to describe discovery projects, intake work, and their follow-ups.

## Language

**Operator organization**:
The organization that owns and operates a Project Maker deployment and employs
its internal users. It supplies runtime infrastructure and configuration; it
is never the Customer in Project Maker product language. Historical Hungarian
material may call it `üzemeltető szervezet`; this is a legacy term, not an
employee-facing UI label.
_Avoid_: Customer, Customer tenant, Project Customer

**Internal user**:
A named employee of the Operator organization who reaches one Project Maker
deployment through its VPN boundary and signs in with a local email-and-password
account. Every Internal user has the same application capabilities across all
Projects in that deployment. VPN access permits network reachability; the local
account identifies the actor and grants the one shared internal access level.
_Avoid_: Anonymous VPN user, Customer contact, Project Customer user

**Internal user account**:
The self-managed local email-and-password identity of one Internal user. Its
owner creates, deactivates, and recovers it through the VPN-restricted
application; retained audit history continues to identify a deactivated owner.
_Avoid_: Administrator-provisioned account, application role, Customer account

**VPN boundary**:
The Operator organization-controlled network access boundary around one
Project Maker deployment. It limits who can reach the application but never
replaces Internal user authentication or actor-bound audit.
_Avoid_: User identity, application role, project permission

**Project Customer**:
The external organization for which a project is being prepared. The shorter
`Customer` qualifier is reserved for this organization and its correspondence;
it never denotes the Operator organization. Historical Hungarian material may
call it `projektügyfél`, or `ügyfél` where the Project context is unambiguous;
these are legacy terms, not employee-facing UI labels.
_Avoid_: Operator organization, deployment owner, application customer

**Customer contact**:
The named person at the Project Customer who receives Project Customer
communication and may own a project's next action. The employee-facing label is
`Customer contact`.
_Avoid_: Operator, internal project owner, infrastructure administrator

**Project contact**:
A named person retained only within one Project as relevant contact information.
It has no stakeholder-role taxonomy and does not grant application access.
_Avoid_: Global contact registry, application role, Customer account

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

**Project status update**:
One human-authored periodic snapshot of a Project's health, summary, changes,
risks, and next step. The latest update remains editable until a newer update is
recorded; retained earlier updates form the history. It never replaces the
server-derived Project preparation state or Human-readable project activity.
_Avoid_: Project status, audit event, automatic progress report

**Portfolio overview**:
The application-level starting context for current projects, their preparation
states, and the most important next actions. Its employee-facing name is
`Portfolio Overview`; it does not replace a selected project's working context or
the active project queue.
_Avoid_: Full project dossier, unfiltered project list

**Business goal**:
An Operator organization outcome used to group and explain related Initiatives.
It supplies strategic context without becoming a delivery schedule.
_Avoid_: Project, delivery milestone, Gantt item

**Initiative**:
A lightweight portfolio grouping of Projects that advance one Business goal.
It is not a task container, capacity plan, or delivery backlog.
_Avoid_: Project phase, sprint, epic

**Active project queue**:
A prioritized cross-project list of projects in active preparation, each with
one clear next action. Its employee-facing name is `Active Project Queue`; it is
distinct from a queue of individual discovery follow-ups.
_Avoid_: Discovery follow-up queue, project archive

**Selected project context**:
The visible context while a person works in one project. It identifies the
project and supplies a return route to the list from which the work began; it
is not a hidden global selection that persists across unrelated application
areas.
_Avoid_: Implicit current project, global sticky project state

**Project context navigation**:
The compact navigation inside a Selected project context: Project Status,
Initial Intake, Discoveries, Estimation Readiness, Decision Review,
Project Specification, Delivery Package, and Project Settings. A context may
explain a missing prerequisite but is not
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
The project-scoped administration context for basic project data, Project
Customer contact details, Project Customer reminder configuration, archive,
and deletion. It does not configure the Operator organization's mail gateway
and is separate from active project preparation work. Basic Project and
Customer-contact data remain editable while the Project is active, regardless
of Project question-schema publication.
_Avoid_: Day-to-day project coordination, hidden destructive controls

**Administrative project phase**:
The manually recorded business phase shown as `Administrative project phase`:
`In preparation`, `Discovery in progress`, `Awaiting internal alignment`,
`Awaiting Customer feedback`, or `Handed over for planning`. It is not the server-derived
Project preparation state and is not a complete delivery lifecycle with a
terminal successful-delivery state.
_Avoid_: Project lifecycle, preparation state, delivery completion

**Operational coordination data**:
The named Next-action owner, one next action, and due date used to coordinate
active project preparation. The owner is either the named Internal project
owner or the named Customer contact. Coordination is visible and quickly
editable from employee working contexts rather than buried in Project settings.
_Avoid_: Contact details used as an implicit assignment, project lifecycle control

**Internal project owner**:
The named internal employee who operates Project Maker for the project,
conducts the interview, and may own its next action. Employee-facing language
calls the role `Internal project owner`.
_Avoid_: Anonymous internal user, unqualified project role

**Next-action owner**:
The concrete person who currently has the project's next action: either the
Internal project owner or the Customer contact. Employee-facing language names
the role and person together as `Internal project owner – Name` or
`Customer contact – Name`.
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
sent to the project's named Customer contact after review. Its employee-facing
name is `Customer interview summary`.
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

**Published playbook version**:
An immutable, reusable discovery policy and question structure for one class of
Project. A materially changed policy or a different Project class receives a
new published version; `general` v1 is never rewritten.
_Avoid_: Mutable questionnaire, Project question schema, template

**Published Question Bank version**:
The immutable Question Bank state from which a new Project question schema may
select questions. A successful Question Bank change creates a successor version
and never rewrites an earlier Project question schema.
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
`Question schema required` preparation state until the interview starts.
_Avoid_: Browser-only wizard draft, silently abandoned input

**Frozen Project question schema**:
The Project question schema that belongs to a started or completed Initial
Intake interview round. It is not changed in place; a different assessment
uses a newly accepted schema and a new Initial Intake round.
_Avoid_: Rewriting answered questions, mutable historical assessment

**Question Bank reference file**:
An Operator organization-maintained file belonging to one question revision in
a Published Question Bank version. A Project question schema retains the exact
reference-file set it selected.
_Avoid_: Project work attachment, mutable link to the latest Question Bank

**Project work attachment**:
A Project-owned file attached to one Initial Intake checklist snapshot or one
Discovery follow-up. It remains separate from Question Bank guidance and
Customer inbound attachment metadata.
_Avoid_: Question Bank reference file, Customer inbound attachment, general Project document library

**Post-interview readiness transition**:
The direct transition from an ended Initial Intake meeting to that project's
`Estimation Readiness` context, where its current gaps are understood and acted on while
the ended interview supports versioned review and customer handoff.
_Avoid_: Returning blindly to a global list, treating completion as readiness

**Project preparation state**:
The one employee-facing preparation state shown for an active project:
`Question schema required`, `Initial Intake in progress`, `Clarification required`,
`Decision Review required`, `Ready for estimation preparation`, or `Ready for estimation`.
It conveys the next stage of project preparation, not a raw persistence status.
_Avoid_: DRAFT, inferred priority score, multiple competing project states

**Discovery follow-up queue**:
The cross-project working view named `Discovery Follow-ups`, containing open
Discovery follow-ups from active projects. It does not include Customer
reminders.
_Avoid_: Active project queue, customer follow-up queue

**Human-readable project activity**:
An employee-facing chronological summary of project changes expressed in
domain language. Raw audit event codes and payloads are diagnostic details,
not the normal project preparation journey.
_Avoid_: Raw audit log, technical event feed

**Project archive**:
The deliberate pause and removal of a project from active work while retaining
its complete saved workflow state and readable history. Restoring an archived
project resumes that saved state; completed events and external actions remain
history and are not repeated.
_Avoid_: Deleted project, preparation reset, replayed project

**Project draft deletion**:
The explicit, irreversible removal of an administrative `DRAFT` Project and
all of its Project-owned internal working data. Customer communication or Git
handoff history makes the Project ineligible for deletion and requires archive;
technical audit, schema, internal discovery, and draft outputs alone do not.
_Avoid_: Empty-only deletion, deletion of Customer or Git history, archive

**Markdown template**:
A named, reusable, user-editable Markdown structure stored for future
Specification version generation. Multiple templates may be saved separately;
editing one never rewrites an already saved immutable Specification version.
_Avoid_: Specification version, hard-coded renderer, editable historical snapshot

**Markdown template library**:
The organization-level collection of named Markdown templates available when a
project generates a future Specification version. Its employee-facing context
is `Specification templates`.
_Avoid_: Project-owned template copy, Specification version history

**Project specification**:
The project context named `Project Specification`, which presents immutable,
versioned specification snapshots. Markdown remains the download format, not
the employee-facing name of the context.
_Avoid_: Markdown terv, editable live document

**Delivery handoff**:
A human-confirmed, one-way projection of the exact package shown in a delivery
preview to an external Git repository. Confirmation retains the pushed snapshot,
commit identifier, and backlink; external state never rewrites Project Maker's
canonical source.
_Avoid_: Two-way synchronization, canonical delivery backlog, Customer handoff

**Delivery package**:
A shared editable projection of one exact Specification version into delivery
items and acceptance criteria. It may be exported while still being edited; the
immutable historical record is created by a confirmed Delivery handoff, not by
a separate approval workflow.
_Avoid_: Second canonical specification, approval queue, delivery backlog

**Specification version**:
One immutable Project specification snapshot, shown as `Specification version` and
listed under `Version history`. It retains the selected published template and
source snapshot; later project or template changes do not rewrite it.
_Avoid_: Markdown revision, live project state, editable historical snapshot

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

**Customer correspondence**:
A project-owned conversation anchored to one outbound Customer communication
and containing every related Customer inbound message in received order.
_Avoid_: Delivery attempt, single reply field, project-wide mailbox

**Correspondence mailbox**:
The Operator organization-controlled mailbox dedicated to Project Customer
messages. It is shared by Projects; Project Customers neither own nor configure
it, and it is not an employee's personal working inbox.
_Avoid_: Customer mailbox, Internal project owner's mailbox, Project inbox

**Mail-system acceptance**:
Confirmation that an outbound Customer message was accepted by the
organization's mail system for processing. It does not prove delivery to or
reading by the Customer.
_Avoid_: Delivered, read receipt, Customer response

**Outbound Customer sender**:
The Operator organization-controlled sender identity captured as the immutable
`From` identity of one outbound Customer communication. Project Maker does not
treat that address as proof of employee identity, and Reply-To remains separate.
_Avoid_: Reply-To address, authenticated employee identity, current Project owner

**Customer correspondence status**:
The employee-owned processing state of a Customer correspondence: `Awaiting
response`, `New response`, `Processing`, or `Closed`. Unread count and outbound
delivery state are separate; a later inbound message returns a closed
correspondence to the employee-facing `New response` state (stored internally as `Új válasz`).
_Avoid_: Email delivery status, unread flag, Project preparation state

**Customer inbound message**:
One retained, human-readable reply received through the Customer correspondence
channel. It preserves safe message text and bounded attachment metadata, but
not attachment content.
_Avoid_: Delivery receipt, audit payload, executable email content

**Customer reply classification**:
An employee-recorded interpretation of a Customer inbound message:
`Accepted`, `Change requested`, `Question or answer`, or `Other`. It is not a
formal Project decision and does not create one automatically.
_Avoid_: Automatic sentiment, delivery result, Go/No-Go decision

**Unrecognized Customer reply sender**:
A Customer inbound message whose sender cannot be matched to the Project's
named Customer contact. The message remains available for employee review but
is not treated as coming from a verified Customer contact.
_Avoid_: Rejected reply, verified Customer contact

**Unmatched Customer message**:
A message received by the Correspondence mailbox that cannot yet be
linked to a Project-owned Customer correspondence. It remains available for
explicit linking or dismissal rather than being silently discarded.
_Avoid_: Spam, deleted reply, automatically inferred Project message

**Mail-system event**:
A non-conversational message such as a delivery failure, delivery report, or
automatic absence response received through the Correspondence mailbox.
It may explain delivery state but is not a Customer reply.
_Avoid_: Customer inbound message, Customer decision, unread reply

**Internal notification**:
An Internal user-facing notice created by a fixed, explainable Project Maker
rule. It draws attention to existing Project work or operational state without
creating hidden tasks, decisions, or automatic Customer communication.
_Avoid_: Discovery follow-up, general automation rule, automatic retry

**Discovery follow-up**:
A project-owned accountable discovery work item shown to employees as a
`Discovery follow-up`, with a question, owner, due date, status, and next step.
_Avoid_: Customer email follow-up, task

**Open discovery follow-up**:
A discovery follow-up in the Open state (legacy stored value `Nyitott`); it
remains eligible for general editing.
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

**Evidence**:
An immutable Project-owned reference or snapshot of an observable source such
as an interview answer, Customer message excerpt, metric, link, or governed
attachment. It can be captured or reused inline while an Insight is authored;
employees do not have to prepare a separate Evidence record first.
_Avoid_: Interpretation, automatically inferred fact, mutable source text

**Insight**:
A human-authored Project finding whose supporting sources are attached in the
same workflow. It may inform questions, Discovery follow-ups, and formal
decisions, but is never an automatic decision.
_Avoid_: Evidence, AI conclusion, Decision recommendation

**Current Initial Intake source**:
The most recently created `OPEN` or `ENDED` Initial Intake round for a project,
regardless of which of those two lifecycle states it has. It defines
the eligible checklist snapshots for a new or changed discovery follow-up
source linkage.
_Avoid_: Any historical checklist, automatically repointed source

**Resolved discovery follow-up**:
A discovery follow-up in the `Answered` or `Not applicable` terminal state; its business content is immutable and it is not reopened by the editing slice.
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
effective checklist status is neither `Complete` nor `Not applicable`. It is a
policy-defined estimate gate; it is not every important readiness gap or an
unresolved discovery follow-up.
_Avoid_: Critical gap, generic open work

**Decision critical gap**:
A current available readiness gap classified by the selected policy as
`Critical`. It takes precedence over a positive estimation recommendation and
may be distinct from an estimate-blocking gap.
_Avoid_: Estimate-blocking gap, any unresolved follow-up

**Claude Code workspace connection**:
An Internal user's actor-identified MCP connection from their own Claude Code
session to the VPN-restricted Project Maker deployment. It exposes a small set
of existing Project Maker business actions and keeps their current rules,
including exact Git preview and a Claude Code-enforced fresh human confirmation.
Project Maker never
receives, shares, or uses the user's Claude subscription credentials and does
not call a model API.
_Avoid_: Embedded AI provider, shared Claude account, generic database access,
anonymous VPN automation

**MCP connection token**:
The one self-managed Project Maker integration credential that identifies an
Internal user when Claude Code calls the MCP endpoint. The owner can create,
replace, or revoke it from their account; only its digest is retained. It is
neither an application role nor an Anthropic API key and grants exactly the
same application capabilities as that Internal user.
_Avoid_: Permission scope, shared Operator token, Claude credential
