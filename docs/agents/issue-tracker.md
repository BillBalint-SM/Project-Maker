# Issue tracker: GitHub

Issues and specs for this repo live as GitHub issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue**: build a PowerShell here-string, then pass it as one argument:

```powershell
$issueBody = @'
Multi-line issue body.
'@
gh issue create --title '...' --body $issueBody
```

- **Read an issue**: `gh issue view <number> --comments`, filtering comments by `jq` and also fetching labels.
- **List issues**: `gh issue list --state open --json number,title,body,labels,comments --jq '[.[] | {number, title, body, labels: [.labels[].name], comments: [.comments[].body]}]'` with appropriate `--label` and `--state` filters.
- **Comment on an issue**: `gh issue comment <number> --body "..."`
- **Apply / remove labels**: `gh issue edit <number> --add-label "..."` / `--remove-label "..."`
- **Close**: `gh issue close <number> --comment "..."`

Infer the repo from `git remote -v` — `gh` does this automatically when run inside a clone.

## Pull requests as a triage surface

**PRs as a request surface: no.**

GitHub shares one number space across issues and PRs, so a bare `#42` may be either — resolve with `gh pr view 42` and fall back to `gh issue view 42`.

### Delivery reconciliation

An atomic implementation PR that completes an issue must use a GitHub closing
keyword such as `Closes #42`. Use `Refs #42` only when the PR is intentionally
partial and the issue must remain open. `Implements #42`, `Reference: #42`, and
a plain issue URL do not close the issue.

After a completing PR merges, verify that the issue is closed and remove stale
dispatch metadata (`ready-for-agent` and any completed claim). A successful
merge is not a complete tracker transition while its ticket still appears as
unassigned agent-ready work.

Before scheduling any `ready-for-agent` candidate:

- exclude map, epic, parent, and umbrella issues whose executable work is
  represented by child tickets;
- inspect cross-referenced PRs and the relevant merge history; if the complete
  acceptance scope is already merged, reconcile and close the ticket instead
  of dispatching it again;
- require no assignee and no open native blocker;
- do not treat green CI as proof of an untested acceptance criterion. Confirm
  that each material negative path named by the issue has an observable test at
  the agreed public seam.

When a PR body references the wrong issue, record the correction on both the
delivered ticket and any incorrectly referenced ticket before changing state.

## When a skill says "publish to the issue tracker"

Create a GitHub issue.

## When a skill says "fetch the relevant ticket"

Run `gh issue view <number> --comments`.

## Wayfinding operations

Wayfinder maps use GitHub's native issue hierarchy and dependency graph. A
map carries `wayfinder:map`; each direct child carries exactly one of
`wayfinder:research`, `wayfinder:prototype`, `wayfinder:grilling`, or
`wayfinder:task`.

### Prepare labels

Before creating a map, inspect the labels and create only those that are
missing:

```powershell
$wayfinderLabels = @(
  @{ Name = 'wayfinder:map'; Description = 'Wayfinder decision map'; Color = '5319e7' },
  @{ Name = 'wayfinder:research'; Description = 'Wayfinder research decision'; Color = '0e8a16' },
  @{ Name = 'wayfinder:prototype'; Description = 'Wayfinder prototype decision'; Color = '1d76db' },
  @{ Name = 'wayfinder:grilling'; Description = 'Wayfinder human decision'; Color = 'd4c5f9' },
  @{ Name = 'wayfinder:task'; Description = 'Wayfinder prerequisite task'; Color = 'fbca04' }
)
$existingLabels = gh label list --limit 100 --json name --jq '.[].name'
foreach ($label in $wayfinderLabels) {
  if ($existingLabels -notcontains $label.Name) {
    gh label create $label.Name --description $label.Description --color $label.Color
  }
}
```

### Create and inspect a map

Create one map issue from its prepared Markdown body. Keep the URL returned by
the command; it identifies the map for all child operations.

```powershell
gh issue create --title '<map title>' --body-file <map-body.md> --label 'wayfinder:map'
gh issue view <map number> --json title,body,subIssues
```

Create each specified ticket as a direct sub-issue of the map. Create all
issues before wiring their dependencies.

```powershell
gh issue create --title '<decision title>' --body-file <ticket-body.md> `
  --label 'wayfinder:research' --parent <map number>
```

### Wire and claim the frontier

The ticket that waits receives the `blocked by` relationship. Use the native
relationship only after both issue numbers exist.

```powershell
gh issue edit <dependent ticket number> --add-blocked-by <blocking ticket number>
```

Claim a selected frontier ticket before investigating it. Its assignee is the
claim.

```powershell
gh issue edit <ticket number> --add-assignee '@me'
```

To find candidates, inspect only open direct children, then select those with
no assignee and no open blocker:

```powershell
$openChildren = gh issue view <map number> --json subIssues --jq '.subIssues.nodes[] | select(.state == "OPEN") | .number'
foreach ($ticketNumber in $openChildren) {
  $ticket = gh issue view $ticketNumber --json number,title,url,assignees,blockedBy,state | ConvertFrom-Json
  $openBlockers = @($ticket.blockedBy.nodes | Where-Object state -eq 'OPEN')
  if ($ticket.assignees.Count -eq 0 -and $openBlockers.Count -eq 0) {
    $ticket | Select-Object number,title,url
  }
}
```

### Resolve a decision

Prepare the resolution comment, close action, and one-line map update first.
Obtain a separate user decision immediately before posting the comment,
closing the ticket, and appending the link and gist to the map's `Decisions so
far` section. Closing a ticket is not implied by assigning it.
