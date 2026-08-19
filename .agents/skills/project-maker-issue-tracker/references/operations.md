# GitHub issue operations

Use `gh` from inside the repository so it infers the remote automatically.

## Create

Build a PowerShell here-string and pass it as one argument:

```powershell
$issueBody = @'
Multi-line issue body.
'@
gh issue create --title '...' --body $issueBody
```

## Read and list

- Read one issue and its discussion with
  `gh issue view <number> --comments`; fetch labels as well when they matter.
- List issues with
  `gh issue list --state open --json number,title,body,labels,comments` and use
  `--label`, `--state`, and `--jq` to return only the relevant fields.
- When a workflow says to fetch the relevant ticket, use
  `gh issue view <number> --comments`.
- Before reporting that an implementation ticket is actionable, fetch its
  labels, assignees, and native `blockedBy` relationship. Report every open
  blocker; a `ready-for-agent` label does not override an open dependency.

```powershell
gh issue view <number> --json number,title,state,labels,assignees,blockedBy
```

## Mutate

- Comment: `gh issue comment <number> --body '...'`
- Add labels: `gh issue edit <number> --add-label '...'`
- Remove labels: `gh issue edit <number> --remove-label '...'`
- Close after the required separate decision:
  `gh issue close <number> --comment '...'`

When a workflow says to publish to the issue tracker, create a GitHub issue.

## Delivery reconciliation

A PR that completes one issue uses a GitHub closing keyword such as
`Closes #42`. Use `Refs #42` only for intentionally partial delivery. After a
completing PR merges, verify that the issue closed and remove stale dispatch
metadata such as `ready-for-agent` or a completed claim. A green merge alone
does not complete the tracker transition.

Before dispatching a `ready-for-agent` issue:

- exclude maps, epics, parents, and umbrellas whose work is represented by
  child tickets;
- inspect cross-referenced PRs and merge history, and reconcile an already
  delivered ticket instead of dispatching it again;
- require no assignee and no open native blocker;
- verify every material negative acceptance path at its agreed public test
  seam rather than treating green CI as sufficient evidence.

If a PR references the wrong issue, record the correction on both the delivered
ticket and the incorrectly referenced ticket before changing tracker state.
