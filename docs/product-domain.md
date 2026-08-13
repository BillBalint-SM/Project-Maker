# Project Maker product domain

This document is the platform-neutral source of truth for the Project Maker product model. It defines the reusable domain intent, workflow vocabulary, general intake playbook, and scoring rules independently from framework, persistence, and UI details so the Angular web client, NestJS API, and future workers can share the same meaning.

## Product purpose and workflow

Project Maker is an intake and requirements-clarification tool for PM, PO, and BA users. It is not a general project-management system. Its core outcome is a development-ready requirement package and an explicit list of unresolved questions, while coaching the user toward stronger discovery practice.

The canonical workflow is:

1. Create a draft project or open an existing one.
2. Capture project basics, the business problem, the desired outcome, ownership, and constraints.
3. Select a versioned playbook and work through its guided interview/checklist questions.
4. Record answers, open questions, owners, due dates, next steps, and follow-up outcomes.
5. Review current completion, readiness, factors, and ordered remediation gaps after relevant edits.
6. Resolve the highest-severity gaps through the Cockpit's explicit remediation target.
7. Review the future SCORE-01.2 Decision Score and recommendation when it is delivered; recording a formal Go, Conditional Go, or No-Go decision remains a later workflow.
8. Generate the canonical Markdown specification, then derive human-readable exports from it when the future output workflows are delivered.
9. Archive inactive projects; deletion remains a distinct, explicit operation.

## Domain terminology

- **Intake:** the structured first assessment used to decide whether an initiative is clear enough to estimate or develop.
- **Playbook:** a versioned question set with its own readiness and decision-scoring weights. A project stores the selected playbook ID.
- **Checklist answer:** the answer and operational state for one playbook item, including owner, due date, open question, and next step.
- **Discovery follow-up:** a project-owned discovery work item with a responsible owner, due date, status, answer/decision, next step, and an optional immutable source snapshot. The delivered `INTAKE-04` slices create, review, resolve, edit open working fields, and link an open item to its intake origin while retaining canonical terminal states.
- **Customer email follow-up:** an outbound communication cadence/schedule. It may send pings, but it is not a discovery work item and does not replace discovery follow-ups.
- **Completion:** progress through relevant playbook items. Items marked not relevant are excluded from the denominator.
- **Effective checklist status:** the current status derived from a valid answer unless a persisted assessment overrides it: `Nincs meg`, `Kész`, `Részben megvan`, or justified `Nem releváns`.
- **Readiness:** the delivered weighted measure of current base information, business clarification, ownership, relevant checklist status, and discovery-follow-up resolution.
- **Readiness gap / gap list:** a redacted remediation item classified as `Kritikus`, `Fontos`, or `Pontosítás`, with only its category, generic message, next step, and explicit target.
- **Decision input rating:** a project-level 1–5 assessment of business value, strategic alignment, urgency, confidence, complexity, or risk. Complexity and risk are inverted when scoring; no value is inferred from an intake answer.
- **Decision Score:** the planned, explainable decision-support result from the six Decision input ratings and current available readiness. It is not a formal Go, Conditional Go, or No-Go decision and remains unavailable until SCORE-01.2 is delivered.
- **Decision recommendation:** the planned policy-derived guidance to clarify, prepare an estimate, or treat the project as ready for estimation. It is not an approval and remains unavailable until SCORE-01.2 is delivered.
- **Estimate-blocking gap:** a current Initial Intake checklist item marked `requiredForEstimate` whose effective status is neither `Kész` nor `Nem releváns`. It is distinct from a critical readiness gap and from a generic open follow-up.
- **Cockpit:** the delivered review surface for readiness, factors, and prioritized gaps. The planned SCORE-01.2 Decision Review surface is absent.
- **Canonical specification:** the structured Markdown output from which acceptance criteria, user stories, PDF, and spreadsheet exports are derived.

The status vocabulary is defined only in the canonical general playbook contract below. Domain and application code must consume it from the contracts package instead of maintaining local copies.

## Domain data intent

The model below records semantic intent, not a database schema. Stable IDs and explicit timestamps are required so later persistence and sync designs can migrate without changing product meaning.

### Project

| Area | Fields and intent |
|---|---|
| Identity | Stable `id`, `name`, selected `playbookId`, `createdAt`, `updatedAt`, optional `archivedAt` |
| Organization | `customerOrOrganization`, `affectedTeams` |
| Ownership | `projectManager`, `businessAnalyst`, `productOwner`, `techLead` |
| Contact | `contactPhone`, `contactEmail`, `contactOther` |
| Schedule | `kickoffDate`, `plannedDecisionDate`, `deadline` |
| Classification | `status`, `priority` |
| Business framing | `businessProblem`, `expectedBusinessOutcome`, `firstMvpGoal` |
| Decision input | Six nullable 1–5 ratings: business value, strategic alignment, urgency, confidence, complexity, and risk. They are retained when a later Initial Intake becomes current. |
| Formal decision | Future `finalDecision`, `decisionDate`, `decisionMaker`, and `decisionNote`; SCORE-01.2 does not record these. |
| Intake | Checklist answers keyed by playbook item ID and a list of follow-ups |
| Derived state | Delivered completion, readiness, factors, and ordered redacted readiness gaps; planned Decision Score, recommendation, and safe explanation derived on read, not stored as a snapshot |

Any persisted Decision input rating is project activity: a Draft project with one
is no longer a bare Draft and must be archived rather than physically deleted.

### Checklist answer

Each answer preserves `status`, `owner`, `dueDate`, free-text `answer`, `openQuestion`, `nextStep`, and `updatedAt`.

For the delivered initial-intake assessment, a valid answer is effectively `Kész`; no valid answer is `Nincs meg`. `Részben megvan` may be set only when a valid answer exists and remains a completion blocker. `Nem releváns` requires a nonblank rationale, excludes the item from completion and checklist readiness denominators, and can satisfy a required item's completion condition. The rationale is retained with the assessment but is not exposed in readiness gaps or assessment audit payloads. Completed rounds make answers and assessments immutable.

### Discovery follow-up

Each discovery follow-up preserves a stable `id`, `category`, `question`, `owner`, `dueDate`, `status`, `decisionOrAnswer`, `nextStep`, and zero or one immutable source snapshot. A new or replacement source must belong to the latest open `INITIAL_INTAKE` round, or to the latest completed one when no initial intake is open. A later intake never rewrites an existing link. Resolved follow-ups retain their source as immutable provenance, while only open follow-ups may add, change, or remove it. Cards and audit records expose a compact human reference (order, topic, control point), not the source ID or full source question. Customer email follow-up state is a separate scheduling concern and is not part of this entity.

### Readiness gap

Each delivered gap preserves `severity`, `category`, explanatory `message`, recommended `nextStep`, and a navigation target: overview, checklist, or follow-ups. Optional snapshot and follow-up identifiers support direct remediation. The readiness result deliberately excludes source answers, assessment rationales, owner names, dates, follow-up content, decisions, and next-step values.

### Readiness source and availability

Readiness uses the latest open `INITIAL_INTAKE` round for a project; if none is open, it uses the latest completed one. It is available only when that source contains the exact current 30 stable keys of the canonical `general` v1 playbook. With no initial intake it reports `NO_INITIAL_INTAKE`; a noncanonical source reports `UNSUPPORTED_SCHEMA`. These availability states are not a score and do not prevent normal Workspace or discovery-follow-up work. The planned Decision Score is unavailable rather than partially calculated when readiness is unavailable.

## Canonical playbook contract

The framework-neutral, immutable source of truth for the `general` v1 template is [`packages/contracts/playbooks/general.v1.json`](../packages/contracts/playbooks/general.v1.json). It contains the 30 stable question IDs, Hungarian labels and hints, required/blocking metadata, status vocabularies, and readiness and decision-scoring policy.

NestJS, Angular, and future workers should consume the typed, immutable `generalPlaybookV1` export from `@project-maker/contracts`; they must not duplicate or adapt these values in framework, persistence, or UI code. The contract is stable for the current playbook version, not a claim that the policy is final. The agreed correction to the unshipped Decision Score policy is the narrow pre-delivery exception documented in [ADR-0002](adr/0002-pre-delivery-decision-score-policy-correction.md). After the policy has been delivered for use, a material change requires a new playbook version and explicit treatment of historical project data.
