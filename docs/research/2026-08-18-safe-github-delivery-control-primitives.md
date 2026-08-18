# Safe GitHub enforcement primitives for Delivery Control

**Date:** 2026-08-18
**Scope:** Wayfinder #69 — enforcement mechanisms only. This is research, not a
repository-configuration change.

## Decision summary

GitHub can enforce a useful part of Delivery Control, but no single native
primitive is a complete state machine or an atomic dispatcher. Use GitHub as
the authoritative record and put the policy in a versioned, read-only Delivery
Control CLI that is run by humans and CI. Let native issue relationships,
assignees, PR closing keywords, and required checks supply facts; do not infer
delivery from labels or a green general CI job.

For this repository, keep untrusted pull-request execution on `pull_request`
with a minimally scoped read-only token. Never execute a PR head from a fork
in a privileged `pull_request_target`, `workflow_run`, or issue-comment job.
Any workflow that writes issue state must run only code from trusted `main`,
must receive the narrowest explicit permission, and must report contradictions
for human triage rather than repairing them silently.

## Observed repository baseline

The following observations were made with `gh` on 2026-08-18:

| Surface | Observation | Consequence |
| --- | --- | --- |
| Repository | Private `BillBalint-SM/Project-Maker`; `main` is not protected. Merge, rebase, and squash merges are enabled. | A collaborator can bypass a PR-only process today. A human merge decision is a convention, not a GitHub-enforced gate. |
| Actions | Actions are enabled; all actions/workflows are allowed. The default `GITHUB_TOKEN` permission is `read`; it cannot approve PR reviews. | This is an appropriate secure baseline, but workflow/job `permissions` must remain explicit. Pinning third-party actions is not currently required. |
| Workflow | `.github/workflows/ci.yml` runs `checkpoint` and `container-smoke` on `pull_request` and pushes to `main`. It declares no explicit `permissions`. | The two jobs are evidence only; neither validates ticket/PR metadata nor is required before merging. |
| Branch controls | The REST branch-protection and rulesets endpoints return `403`: GitHub reports that this private repository needs Pro or public visibility for those features. | Required checks / PR review enforcement cannot be configured on this repository under its current plan. Keep the dispatch stop and human merge gate until this changes or an equivalent protected-host control exists. |

The observations are intentionally not treated as proof of a configuration that
cannot be queried: the `403` is a capability limitation, not a claim that no
future ruleset exists.

## Recommended control topology

| Delivery Control need | Safe GitHub primitive | Boundary / rule |
| --- | --- | --- |
| Atomic work definition | A YAML issue form in `.github/ISSUE_TEMPLATE`, with required goal, scope, out-of-scope, `AC-xx`, public seam, test level, required gates, and blockers. | Forms turn answers into editable issue Markdown, so the CLI must validate the current body and reject free-form or incomplete issues before `ready-for-agent`. Form validation is an intake aid, not an immutable contract. [Issue form syntax](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms) |
| Hierarchy and blocking | Native sub-issues for map/parent grouping; native `blocked by` relationships for actual prerequisites. | A parent/map is excluded by the CLI; an open blocker excludes a ticket. Dependencies expose the graph but do not prevent assignment, dispatch, PR creation, or merge. [Issue dependencies](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/creating-issue-dependencies) [Sub-issue fields](https://docs.github.com/en/issues/planning-and-tracking-with-projects/understanding-fields/about-parent-issue-and-sub-issue-progress-fields) |
| Lifecycle projection | One mutually exclusive human/CLI-managed lifecycle label; native assignee for `claimed`; issue closed state for `delivered`. | Labels and assignees are mutable facts, not authorization. The CLI recomputes eligibility from the issue, dependency graph, PR history, and `main` before every action. |
| Claim | A serialized orchestrator calls GitHub to assign the ticket, then immediately re-reads assignees and eligibility. | GitHub's documented `addAssigneesToAssignable` mutation adds assignees but exposes no conditional "assign only if unassigned" compare-and-set. Therefore a concurrent claim cannot be made atomically with native issue APIs; only the observed winner continues and all others stop. [GraphQL Issues reference](https://docs.github.com/en/graphql/reference/issues) |
| Completing PR | PR body contains exactly one `Closes #N` for the claimed atomic issue and a generated AC matrix: `AC | public seam | test/evidence | fresh result`. | Closing keywords close an issue only when the PR targets the default branch and is merged; `Refs`/`Implements` are not substitutes. The PR gate must reject missing, multiple, parent, or mismatched closing references. [Linking a PR to an issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/using-issues/linking-a-pull-request-to-an-issue?curius=2438) |
| Code and metadata validation | Separate read-only PR jobs: product tests; Delivery Control metadata/AC gate; independent standards/spec review artifact. Require all only once the host can protect `main`. | A status name alone is weak: any writer can set a status. When rulesets are available, bind required checks to their GitHub App/source and require the branch to be up to date. [Ruleset rules](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/available-rules-for-rulesets) [Status checks](https://docs.github.com/en/pull-requests/reference/status-checks) |
| Evidence retention | Upload a structured Delivery Control report and test outputs as workflow artifacts, including issue/PR IDs, base/head SHA, AC matrix, commands, results, and reviewer identity. | Artifacts preserve evidence and provide upload digests; they are not proof that a ticket is correct. Treat artifacts from untrusted PR runs as untrusted data and never execute them in a writer workflow. [Workflow artifacts](https://docs.github.com/en/actions/concepts/workflows-and-actions/workflow-artifacts) [Secure `pull_request_target`](https://docs.github.com/en/actions/reference/security/securely-using-pull_request_target) |
| Build provenance (optional) | GitHub artifact attestations for release artifacts only. | Attestations prove where/how an artifact was built; they do not prove acceptance coverage, a human review, or tracker truth. They require `attestations: write`, `id-token: write`, and `contents: read`; do not grant them to ordinary validation jobs. [Artifact attestations](https://docs.github.com/en/actions/how-tos/secure-your-work/use-artifact-attestations/increase-security-rating) |
| Merge | Human maintainer merges only after the report and independent review are green. Enable a ruleset/branch rule later: require PR, strict required checks from the expected source, review, and prevent force-push/direct pushes. | Under the observed plan, GitHub cannot enforce this for private `main`; no automation should merge or approve its own PR. |
| Post-merge reconciliation | A trusted `push`-to-`main` auditor reads the merged PR/issue/reports and emits a report. On contradiction it must fail and surface `needs-triage`; it must not silently relabel, close, or otherwise “heal” the issue. | Begin read-only. If a later approved design needs a write-side alert/comment, run only trusted default-branch code with `issues: write` and no checkout/execution of PR code; preserve the original contradictory state and make the mutation explicit in the report. |

## Fork and token threat boundary

The safe default is a `pull_request` workflow that executes the PR's merged
code with no secrets and a read-only `GITHUB_TOKEN`. GitHub applies those
restrictions to fork PRs. Explicitly set job permissions anyway, for example
`permissions: { contents: read }`, so a future repository default cannot widen
the validation job.

`pull_request_target` uses the base/default branch workflow and receives the
base repository token and secrets. It is safe for a narrowly scoped,
base-code-only metadata action, but becomes a pwn-request vulnerability when it
checks out, installs, builds, tests, or otherwise executes fork/PR code. The
same restriction applies to `workflow_run` and comment-triggered writers:
artifacts and PR content are untrusted input. Consequently this Delivery
Control design does **not** use `pull_request_target` for checkout/testing and
does **not** use a privileged workflow to consume a PR artifact.

The observed repository default is already `read` and cannot approve PR
reviews. Preserve that setting. Give any exceptional trusted writer only the
needed permission at workflow/job scope (`issues: write` for an explicit
triage-comment workflow; `pull-requests: write` only if it genuinely edits PR
metadata). Do not enable write tokens or secrets for fork PRs, and do not allow
Actions to approve PRs. GitHub documents both the fork-policy options and the
repository `GITHUB_TOKEN` defaults. [Actions settings](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/enabling-features-for-your-repository/managing-github-actions-settings-for-a-repository) [Actions permissions REST API](https://docs.github.com/en/rest/actions/permissions?apiVersion=2026-03-10)

## What GitHub cannot safely do by itself

1. It cannot make assignment a transactional eligibility-and-claim operation.
   Serialize selection in the orchestrator, re-read after assignment, and
   fail closed on a race.
2. Issue forms, labels, comments, and assignees cannot stop a privileged human
   from editing state. They are inputs to the Delivery Control CLI, not the
   policy engine.
3. An unprotected `main` cannot make a required check or a human merge decision
   technically mandatory. Until a protected-branch/ruleset-capable hosting plan
   is adopted, do not represent checks as enforcement.
4. A post-merge audit cannot prevent a merge that already happened. It should
   produce immutable-ish evidence and a visible failure; tracker correction
   requires a separately authorized, auditable human action.

## Minimum implementation sequence

1. Add the issue form and a pure/read-only Delivery Control CLI with fixtures
   that reject all known failure modes: parent ticket, open blocker, incomplete
   AC matrix, stale/merged scope, no closing keyword, wrong/multiple issue, and
   positive-only test evidence.
2. Add a `pull_request` metadata gate with `permissions: { contents: read,
   pull-requests: read }`; upload the report as an artifact beside the existing
   product checks. Do not add a privileged trigger.
3. Add the trusted, read-only post-merge reconciliation report. Make a human
   turn every contradiction into `needs-triage` rather than mutating it
   automatically.
4. Before lifting feature-dispatch stop, provision a host-level protection for
   `main` and configure strict required checks/review with an expected source,
   then prove it on the #40 pilot.

## Sources and research method

Only official GitHub documentation and repository API/workflow observations
were used. The GitHub Docs links appear at their supported claims above.
Repository observations came from `gh repo view`, `gh api` Actions/branch/
ruleset endpoints, and `.github/workflows/ci.yml` on 2026-08-18. The branch
protection/ruleset endpoint responses were retained as capability evidence in
the terminal audit, not copied into this document as a claim about future
configuration.
