# Project Maker user guide

Project Maker is a desktop-first internal workspace for PMs, POs, BAs, and delivery teams. It turns a Customer request into a traceable preparation record: Initial Intake, discovery evidence, readiness, decision support, a versioned specification, an editable Delivery Package, and an optional one-way Git handoff.

Use the application inside the Operator organization's VPN-controlled network. Every Internal user has a self-managed local email-and-password account and the same application capabilities. Project Maker has no roles, project permissions, Customer accounts, or administrator-only workflow.

> **Supported workspace:** desktop and laptop browsers with at least 1024 CSS pixels of width. Mobile-specific behaviour is outside the supported product scope.

## Contents

- [Working principles](#working-principles)
- [Navigation and project states](#navigation-and-project-states)
- [A complete preparation workflow](#a-complete-preparation-workflow)
- [Portfolio and work queues](#portfolio-and-work-queues)
- [Create and coordinate a project](#create-and-coordinate-a-project)
- [Question Bank, schemas, and reference files](#question-bank-schemas-and-reference-files)
- [Initial Intake and Discovery](#initial-intake-and-discovery)
- [Readiness and Decision Review](#readiness-and-decision-review)
- [Customer communication](#customer-communication)
- [Specification, Delivery Package, and Git handoff](#specification-delivery-package-and-git-handoff)
- [Templates, roadmap, notifications, and account](#templates-roadmap-notifications-and-account)
- [Archive, restore, and delete](#archive-restore-and-delete)
- [Recovery guidance](#recovery-guidance)
- [Product boundaries](#product-boundaries)

## Working principles

- Record only information required to prepare the Project. Never place passwords, access tokens, private keys, or other secrets in an interview answer, follow-up, template, or delivery item.
- Save one clear next action, its owner, and—where relevant—a due date. The owner is either the named **Internal project owner** or the named **Customer contact**.
- Treat generated Specification versions, sent Customer interview summaries, and confirmed Git handoffs as immutable historical records. Later edits create new working state or a later version; they do not rewrite history.
- Customer communication and Git handoff are separate concerns. A Markdown specification or Claude Code MCP connection is not a Customer-facing communication channel.
- Before repeating an action that may send email or push to Git, inspect the visible delivery or handoff history. Do not retry blindly.

## Navigation and project states

The global navigation provides the cross-Project work areas:

| Area | Purpose |
| --- | --- |
| **Portfolio** | `Portfolio Overview`: Projects, filters, saved browser views, correspondence summary, and creation entry point. |
| **Workspace Map** | Interactive views of the user workflow, preparation lifecycle, Customer communication, feature/data flow, and runtime architecture. |
| **Roadmap** | Business goals, Initiatives, and their Project context. |
| **Notifications** | Your in-app notification list. |
| **New project** | Create a resumable Project-start draft. |
| **Active project queue** | Prioritized active Projects and their next action. |
| **Discovery follow-ups** | Open follow-ups across active Projects. |
| **Specification templates** | Shared, versioned Markdown templates. |
| **Git connections** | Shared Git destination connections. |
| **Question Bank** | Shared, versioned discovery questions and reference files. |
| **Your email address** | `My account`, including self-service account status and Claude Code MCP connection information. |

Inside a selected Project, the context navigation is **Project Status**, **Initial Intake**, **Discovery**, **Estimation Readiness**, **Decision Review**, **Project Specification**, **Delivery Package**, and **Project Settings**. The return link preserves the relevant Portfolio or follow-up context when available.

The employee-facing preparation state explains the next stage of work. It is distinct from the manually maintained **Administrative project phase**.

Use the [Preparation lifecycle map](visual-maps.md#preparation-lifecycle) when you need to see how the source records and independent state dimensions relate.

| Preparation state | Meaning |
| --- | --- |
| `Question schema required` | The Project exists, but its first Question Bank selection has not been accepted. |
| `Initial Intake in progress` | An Initial Intake round is open and can be continued. |
| `Clarification required` | Readiness identifies unresolved information that needs attention. |
| `Decision Review required` | The team needs to complete or revisit its decision ratings. |
| `Ready for estimation preparation` | Preparation is substantially complete, but a decision review or other preparation work remains. |
| `Ready for estimation` | The current record supports estimation preparation; it is not an automatic approval or delivery decision. |

Administrative project phases are **In preparation**, **Discovery in progress**, **Awaiting internal alignment**, **Awaiting Customer feedback**, and **Handed over for planning**. Update them manually to reflect the operational situation.

## A complete preparation workflow

The [Project Preparation Journey map](visual-maps.md#user-workflow) provides an interactive end-to-end view of the steps below and their Customer and delivery branches.

1. Create a Project with its core name, Internal project owner, and Customer contact.
2. Set the next action, next-action owner, due date, and administrative phase on **Project Status** or **Project Settings**.
3. Select and accept a Project question schema from the active Question Bank. This starts the first Initial Intake round.
4. Capture the Initial Intake responses and any Project work attachments. Complete the round when the meeting ends; missing information remains visible through readiness rather than blocking technical completion.
5. Use **Discovery** for additional contacts, targeted interview rounds, and evidence-based insights. Use **Estimation Readiness** for actionable Discovery follow-ups.
6. Complete **Decision Review** when the team needs its score and recommendation. It supports a human decision; it never makes a formal decision automatically.
7. Generate and review an immutable **Project Specification** version. Build an editable **Delivery Package** from an exact Specification version.
8. Export the package or create a Git preview. Push only after reviewing the exact preview and explicitly confirming it.
9. Archive inactive Projects. Restoration resumes the saved workflow state without recreating completed events or repeating external actions.

## Portfolio and work queues

### Portfolio Overview

Use **Portfolio Overview** as the starting point. Search by Project or owner, filter by health, decision, and Project scope, then select **Apply filters**. You can name the current filter set and save it in the browser; saved views are local to that browser, not shared server-side configuration.

Project cards show the current preparation state, coordination information, and the primary action. Use the card action to open the relevant Project context instead of manually constructing a URL. The **Correspondence mailbox** panel links to unmatched Customer messages and can refresh mailbox-derived information.

### Active project queue and Discovery Follow-ups

Use **Active project queue** to prioritize Projects with active preparation work. Use **Discovery Follow-ups** for the narrower queue of open follow-ups. A follow-up is not a Customer reminder: it is a Project-owned clarification item with an owner, next step, and target date.

## Create and coordinate a project

Select **New project**, enter the Project details and Customer contact information, then choose **Save and continue to Initial Intake**. If a schema cannot yet be accepted, the created Project remains a persistent draft and can be resumed later; no browser-only wizard state is required.

On **Project Status**, maintain the operational coordination data:

- choose the next-action owner;
- enter one concrete next action;
- set a due date when the work has a real deadline;
- review Customer correspondence status and recent human-readable activity;
- record a Project status update when the team needs a durable narrative snapshot of health, changes, risks, and next step.

Use **Project Settings** for editable basic Project data, Customer contact details, reminder configuration, the administrative project phase, archive, and draft deletion. Basic data remains editable after the schema is accepted while the Project is active. Earlier Customer communication and Git handoff records retain their original snapshot values.

## Question Bank, schemas, and reference files

**Question Bank** is shared across the deployment. Any Internal user can maintain it, so agree on ownership before changing live questions. Saving a material change creates a successor Question Bank version; it does not rewrite a Project's already accepted schema.

For each question, maintain the prompt, category, answer type, readiness implications, and any reference files. A **Question Bank reference file** belongs to a question revision and is retained by the selected Project schema. It is not a general Project attachment.

On a new Project's **Initial Intake** page, select the active questions required for that Project and choose **Accept question schema and start Initial Intake**. This one deliberate action stores the immutable Project question schema and opens the Initial Intake round. If the schema was saved but starting the round failed, use **Retry starting Initial Intake**; do not create the schema again.

## Initial Intake and Discovery

### Initial Intake

Answer the displayed questions in the open round. Text answers save after a short pause; wait for the visible saved state before leaving the page. Selection, number, date, and boolean answers save directly. The same open round and its saved answers load when you return.

Attach Project work files only where the intake checklist allows it. These are Project-owned work attachments and remain separate from Question Bank reference files and Customer-message attachment metadata.

When the meeting ends, use the appropriate completion action:

- **Complete intake and review gaps** opens **Estimation Readiness**.
- **Complete and preview interview summary** prepares the Customer-facing summary.

Completing an Initial Intake is not a claim that all information is complete. Unsatisfied readiness items become visible as gaps and can become follow-ups.

### Discovery

Use **Discovery** for information that benefits from a lightweight record rather than a free-form note:

- add, edit, or remove additional Project contacts;
- start a **Stakeholder round** or **Clarification round** against a schema question or ad hoc clarification topic;
- open an additional round in the Initial Intake view;
- create or update an **Evidence-based insight**, linked to a saved interview response or existing evidence source.

Archived Project Discovery content is read-only. Restore the Project before adding, editing, or deleting anything.

## Readiness and Decision Review

**Estimation Readiness** summarizes the current Initial Intake, checklist, and open follow-ups. Follow the provided links to fix the underlying source rather than attempting to edit a derived score.

Create a **Discovery follow-up** when an uncertainty needs explicit ownership. Set its category, responsible person, next step, and target date; optionally link it to the relevant Initial Intake source. When resolving a follow-up, record the decision or substantive answer. Closed follow-ups are retained as history and are not reopened or deleted; create a new follow-up if new work emerges.

**Decision Review** has six rated criteria and an explicit weighting model. Rate all required criteria to make the score and recommendation available. Treat its result as decision support: the team records a formal `Go`, `Conditional Go`, or `No-Go` decision separately when needed. The application does not issue that decision itself.

## Customer communication

The [Customer communication map](visual-maps.md#customer-communication) shows the exact preview, confirmation, delivery, reply-correlation, and processing sequence.

### Customer interview summary

After an Initial Intake ends, review the **Customer interview summary** preview before sending it to the named Customer contact. A sent summary is an immutable numbered snapshot. To correct later information, start the next revision draft, enter a Customer-visible modification summary, make the needed changes, and preview before sending again.

The mail system accepting a message does not prove delivery or reading. When the result is uncertain, inspect the visible history and the Operator organization's designated outbound mailbox before attempting another send.

### Customer correspondence and reminders

Open **Customer correspondence** from Project Status to work with the Project-owned conversation for an outbound Customer communication. Customer replies appear in received order and can be reviewed, classified, and processed. An unrecognized sender remains available for manual review; it does not silently become a trusted Customer response.

Use the **Unmatched Customer messages** page for messages the mailbox integration cannot safely associate with one correspondence. Refreshing mailbox data does not change Project preparation state by itself.

Configure automatic reminders in **Project Settings**. Use the Customer correspondence workspace for manual reminder drafting, preview, sending, and recovery. Save changed reminder settings before requesting a preview or send. Reminder delivery history is distinct from Discovery follow-ups.

## Specification, Delivery Package, and Git handoff

### Project Specification

On **Project Specification**, select a published template and a generation reason, then choose **Generate specification version**. A milestone generation also requires a milestone name. Generation captures the relevant Project and interview data as an immutable source snapshot.

Use **Version history** to select a version, examine the source version and template provenance, read the change summary and content preview, and download Markdown. A later Project change or template edit never changes an existing Specification version.

### Delivery Package

Select an exact Specification version as the source, then edit the shared package items. Each item has a title, user story, one or more acceptance criteria, and optional exact source excerpts. Select **Save Delivery Package** to persist the working draft. There is no additional internal approval gate.

The **Outputs** panel provides Markdown, CSV, and **Print / PDF** outputs from the saved package. A package can be exported while the team continues to refine it; the confirmed Git handoff retains the historical external handoff record.

### Shared Git connections and handoff

In **Git connections**, any Internal user can create, test, edit, or delete a shared destination. Enter a name, HTTPS or SSH remote URL, branch, authentication mode, credential, and optional repository web URL. Credentials are retained for the shared setup; leave a credential field empty while editing to keep the existing stored value.

To hand off a saved package:

1. Choose the target shared connection in **Delivery Package**.
2. Save package edits; a dirty package cannot be previewed.
3. Select **Create Git preview** and review the remote, branch, artifact path, commit message, and exact content.
4. Select **Confirm preview and push to Git** only when the preview is correct.
5. Use **Handoff history** to inspect the resulting commit and repository backlink, or retry an explicitly failed/conflicting handoff after resolving the cause.

Git handoff is one-way. External repository changes never rewrite Project Maker's canonical Project or Specification data.

## Templates, roadmap, notifications, and account

### Specification templates

Use **Specification templates** to create and maintain named Markdown templates. Edit the draft, use **Preview** to review its rendering, then **Publish** to make an immutable template version available for future Specification generation. Editing a template never rewrites an existing Specification version.

### Roadmap and notifications

Use **Roadmap** to organize Business goals, Initiatives, and Project context without turning Project Maker into a task board or capacity-planning system. Use **Notifications** to review and manage in-app notifications relevant to your work.

### My account and Claude Code

Use **My account** to manage your own local account status and recovery. It is self-service: there is no administrator provisioning flow. The page also presents the personal Claude Code MCP connection information for your existing Claude subscription. MCP can read and work with the Project Maker resources exposed by the connection; it is not a paid model API, a Customer channel, or unrestricted database/file-system access.

## Archive, restore, and delete

Archive a Project in the **Danger zone** of **Project Settings** when active work pauses or finishes. Archiving preserves the complete saved workflow state and history, but makes Project work areas read-only.

To resume work, open the archived Project and select **Restore project**. Restoration resumes the state that existed before archiving. It does not restore unsaved browser form input, recreate a stale preview, resend Customer email, or push to Git again.

**Permanently delete project** is available only for an administrative `DRAFT` Project that has no Customer communication or Git handoff history. It irreversibly removes Project-owned internal working data. If a Project has useful history or an ineligible deletion state, archive it instead.

## Recovery guidance

| Situation | Safe next step |
| --- | --- |
| A page is loading or saving | Wait for the visible final state. Do not submit a parallel action. |
| A page reports a load error | Use that page's **Reload** or **Retry** action, then inspect the refreshed state. |
| An interview text answer shows an unsaved or failed state | Stay on the page and use **Retry save** after checking the text. |
| A schema was accepted but the Initial Intake did not start | Use **Retry starting Initial Intake**; do not accept a second schema. |
| A follow-up save conflicts | Refresh the follow-up data as the page directs, compare the current record, then make a deliberate new save. |
| An email or Git result is uncertain | Check the visible delivery/handoff history and the relevant Operator-managed mailbox or repository before retrying. |
| A Project is archived | Restore it before creating or changing Project content. |
| A direct link cannot find a Project or Specification version | Return to Portfolio or Version history and select an existing item through the UI. |

When reporting a recurring problem to the Operator organization, include the Project name, page name, time, and visible error text. Do not include secrets or full unnecessary Customer data.

## Product boundaries

Project Maker deliberately does **not** provide:

- roles, per-Project permissions, SSO, Customer accounts, or employee provisioning;
- a task board, sprint planner, Gantt chart, resource planner, or general CRM;
- automatic formal decisions, automatic AI-generated user stories, or an embedded paid AI provider API;
- two-way Git synchronization or a Git repository as the canonical Project record;
- an editable historical Specification version, sent Customer summary, or confirmed Git handoff;
- native Excel export (use CSV), offline/PWA operation, or a mobile-specific interface;
- deletion or reopening of closed Discovery follow-ups.

For deployment configuration, mail gateway setup, and operational procedures, see [Operations handoff](operations-handoff.md) and [Configuration reference](configuration.md).
