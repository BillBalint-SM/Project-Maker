---
status: accepted
---

# Keep pending state with the command that owns it

Each browser command owns its own pending state. The same command is
single-flight until it settles, while independent commands in another project
feature stay usable. A shared, controlled HTTP-error formatter gives ordinary
failures an actionable Hungarian message without exposing server diagnostics.

This replaces the project-wide operation policy in ADR-0004. It keeps server
validation, lifecycle rules, and selected optimistic conflicts authoritative;
it does not add a global command manager, role check, approval step, or queue.

**Evidence:** [command helper](../../apps/web/src/app/projects/project-command-pending.ts),
[helper tests](../../apps/web/src/app/projects/project-command-pending.spec.ts),
and [controlled error formatter](../../apps/web/src/app/shared/http-error-message.ts).
