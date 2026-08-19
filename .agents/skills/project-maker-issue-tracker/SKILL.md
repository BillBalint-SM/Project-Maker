---
name: project-maker-issue-tracker
description: Work with Project Maker GitHub issues, triage labels, issue comments, and Wayfinder issue maps. Use when reading, creating, updating, triaging, relating, assigning, or closing repository issues; do not use for pull-request review or ordinary local code work.
---

# Project Maker issue tracker

Use GitHub issues as the repository's issue and specification tracker. Resolve
the repository from `git remote -v` and perform tracker operations with `gh`.

Read-only inspection is routine. Treat issue creation, comments, labels,
relationships, assignment, and closure as external mutations: perform only the
mutations the user requested. Obtain a separate user decision immediately
before closing an issue or publishing a Wayfinder decision resolution.

## Route the work

- For ordinary issue reads, searches, creation, comments, labels, and closure,
  read [references/operations.md](references/operations.md).
- For Wayfinder maps, frontier selection, dependencies, claims, or decision
  resolution, read [references/wayfinder.md](references/wayfinder.md).
- When translating Matt triage labels, read
  [references/triage-labels.md](references/triage-labels.md).

GitHub issues and pull requests share one number space. If a bare `#<number>`
is ambiguous, try `gh pr view` and fall back to `gh issue view`. Do not treat a
pull request as an issue-tracker request surface.
