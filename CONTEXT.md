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
An optional relationship from a discovery follow-up to its originating checklist item. It is not part of the general editing slice.
_Avoid_: Inferred link, general edit field

**Resolved discovery follow-up**:
A discovery follow-up in the `Megválaszolva` or `Nem releváns` terminal state; its business content is immutable and it is not reopened by the editing slice.
_Avoid_: Closed task, archived follow-up
