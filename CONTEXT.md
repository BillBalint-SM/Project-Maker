# Project Maker

The domain language used to describe discovery projects, intake work, and their follow-ups.

## Language

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
The most recently created open Initial Intake round for a project; when none
is open, the most recently created completed Initial Intake round. It defines
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
