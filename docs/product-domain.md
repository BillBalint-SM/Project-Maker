# Project Maker product domain

This document is the platform-neutral source of truth for the Project Maker product model. It defines the reusable domain intent, workflow vocabulary, general intake playbook, and scoring rules independently from framework, persistence, and UI details so the Angular web client, NestJS API, and future workers can share the same meaning.

## Product purpose and workflow

Project Maker is an intake and requirements-clarification tool for PM, PO, and BA users. It is not a general project-management system. Its core outcome is a development-ready requirement package and an explicit list of unresolved questions, while coaching the user toward stronger discovery practice.

The canonical workflow is:

1. Create a draft project or open an existing one.
2. Capture project basics, the business problem, the desired outcome, ownership, and constraints.
3. Select a versioned playbook and work through its guided interview/checklist questions.
4. Record answers, open questions, owners, due dates, next steps, and follow-up outcomes.
5. Recalculate completion, readiness, blocking gaps, and Decision Score after edits.
6. Review the cockpit and resolve the highest-severity gaps.
7. Record a Go, Conditional Go, or No-Go decision.
8. Generate the canonical Markdown specification, then derive human-readable exports from it.
9. Archive inactive projects; deletion remains a distinct, explicit operation.

## Domain terminology

- **Intake:** the structured first assessment used to decide whether an initiative is clear enough to estimate or develop.
- **Playbook:** a versioned question set with its own readiness and decision-scoring weights. A project stores the selected playbook ID.
- **Checklist answer:** the answer and operational state for one playbook item, including owner, due date, open question, and next step.
- **Discovery follow-up:** a project-owned unresolved discovery work item with a responsible owner, due date, status, answer/decision, and next step. The delivered `INTAKE-04.1` slice records category, question, owner, date-only due date, canonical initial status, and next step; answer/decision and source linkage remain later work.
- **Customer email follow-up:** an outbound communication cadence/schedule. It may send pings, but it is not a discovery work item and does not replace discovery follow-ups.
- **Completion:** progress through relevant playbook items. Items marked not relevant are excluded from the denominator.
- **Readiness:** a weighted measure of whether the project has enough business, ownership, checklist, and follow-up information for estimation or development.
- **Readiness gap / gap list:** information that blocks or weakens estimation or a decision, classified as Critical, Important, or Clarification.
- **Decision Score:** a decision-support score based on business value, strategic alignment, urgency, confidence, inverted complexity, inverted risk, and readiness.
- **Cockpit:** the review surface for readiness, Decision Score, recommended action, and prioritized gaps.
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
| Decision | `finalDecision`, `decisionDate`, `decisionMaker`, `decisionNote`, six input scores |
| Intake | Checklist answers keyed by playbook item ID and a list of follow-ups |
| Derived state | Completion, readiness, Decision Score, recommendation, and ordered readiness gaps |

### Checklist answer

Each answer preserves `status`, `owner`, `dueDate`, free-text `answer`, `openQuestion`, `nextStep`, and `updatedAt`.

### Discovery follow-up

Each discovery follow-up ultimately preserves a stable `id`, optional source checklist item ID, `category`, `question`, `owner`, `dueDate`, `status`, `decisionOrAnswer`, and `nextStep`. Customer email follow-up state is a separate scheduling concern and is not part of this entity.

### Readiness gap

Each gap preserves `severity`, `category`, explanatory `message`, recommended `nextStep`, and a navigation target: overview, checklist, follow-ups, or decision. Optional target field, checklist item ID, and follow-up ID support direct remediation.

## Canonical playbook contract

The framework-neutral, immutable source of truth for the `general` v1 template is [`packages/contracts/playbooks/general.v1.json`](../packages/contracts/playbooks/general.v1.json). It contains the 30 stable question IDs, Hungarian labels and hints, required/blocking metadata, status vocabularies, and readiness and decision-scoring policy.

NestJS, Angular, and future workers should consume the typed, immutable `generalPlaybookV1` export from `@project-maker/contracts`; they must not duplicate or adapt these values in framework, persistence, or UI code. The contract is stable for the current playbook version, not a claim that the policy is final. Any future redesign must introduce a new playbook version and explicitly migrate stored answers.
