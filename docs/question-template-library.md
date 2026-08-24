# Question Template Library

## Outcome

Internal users can prepare reusable, focused Question Templates outside a Project and apply one published version when accepting a Project question schema. The Library shows whether a template is draft-only, published, or has unpublished changes, and which Projects currently use its latest applied provenance.

## Boundaries

- A Question Template belongs to the Operator organization deployment, not to a Project or Project Customer.
- The editable draft contains a name and an ordered, non-empty list of Question Bank stable keys with `required` and `blocking` values.
- Publishing validates every stable key against the latest Published Question Bank and creates an immutable template version.
- Applying a template resolves its latest published version against the latest Published Question Bank, then creates the normal immutable Project question schema and records template id, name, and version provenance.
- A later Question Bank, template draft, or template publication never rewrites a Project schema or interview snapshot.
- Manual Project question-schema selection remains available and has no template provenance.
- Deleting a template removes it from future selection without erasing published history or Project-schema provenance.
- A template may name one focused Project as organizational context. Focus does not grant ownership or prevent reuse by other Projects.

## States

| Library state | Meaning |
| --- | --- |
| `Draft` | The template has no published version. |
| `Published vN` | The draft matches the latest immutable published selection. |
| `Unpublished changes` | A published version exists and the current draft differs. |

Question availability remains a Question Bank concern. If a published template later references a missing or inactive question, the template stays historical but cannot be applied until its draft is corrected and published again.

## Persistence

`question_templates` stores identity, unique name, editable draft questions, optional focused Project, logical deletion, and timestamps. `question_template_versions` stores immutable version number, published name, ordered questions, and publication time. `projects` stores the template selected during internal Project creation. `project_question_schemas` retains template id/name/version provenance with an all-or-none constraint. Only the latest Project schema per Project contributes to the Library's current Project assignments.

## API

- `GET /settings/question-templates` lists summaries, draft and latest published selections, state, and current Project assignments.
- `POST /settings/question-templates` creates a draft.
- `PUT /settings/question-templates/:id/draft` replaces its name and draft selection.
- `POST /settings/question-templates/:id/publish` validates and publishes the next immutable version.
- `DELETE /settings/question-templates/:id` logically deletes the template while retaining history.
- Existing Project question-schema `POST` and `PATCH` accept either a manual `questions` selection or one `questionTemplateId`, never both.

## UI

The global **Question Templates** page provides name search plus Project and state filters, compact template summaries with focused Project context, a Question Bank-backed draft editor with required/blocking overrides, explicit Publish, and confirmed deletion. Internal Project creation requires an available published Question Template; Initial Intake preselects that choice. Existing Projects without a saved choice retain the manual selection path for backward compatibility. Selecting or changing individual questions returns the Project setup to manual selection so template provenance is never overstated.
