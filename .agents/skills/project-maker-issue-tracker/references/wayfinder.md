# Wayfinder issue maps

A map uses GitHub's native issue hierarchy and dependency graph. The map has
`wayfinder:map`; each direct child has exactly one of `wayfinder:research`,
`wayfinder:prototype`, `wayfinder:grilling`, or `wayfinder:task`.

## Prepare labels

Inspect existing labels and create only missing labels:

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

## Create and inspect a map

Create the map and all children before wiring dependencies:

```powershell
gh issue create --title '<map title>' --body-file <map-body.md> --label 'wayfinder:map'
gh issue view <map number> --json title,body,subIssues
gh issue create --title '<decision title>' --body-file <ticket-body.md> `
  --label 'wayfinder:research' --parent <map number>
```

Add the relationship to the ticket that waits:

```powershell
gh issue edit <dependent ticket number> --add-blocked-by <blocking ticket number>
```

## Claim the frontier

Assignment is the claim. Inspect only open direct children and select tickets
with no assignee and no open blocker:

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

A selected frontier ticket must be claimed before its investigation begins.
When assignment is authorized, claim it with
`gh issue edit <number> --add-assignee '@me'`; otherwise report the candidate
and stop before investigating it.

## Resolve a decision

Prepare the resolution comment, close action, and one-line map update first.
Obtain a separate user decision immediately before posting the resolution,
closing the ticket, and appending its link and gist to the map's
`Decisions so far` section. Assignment never implies permission to close.
